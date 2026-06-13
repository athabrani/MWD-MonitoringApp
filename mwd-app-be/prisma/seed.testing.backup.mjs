import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CONFIG = {
  passwordRounds: 10,
  users: [
    { username: 'admin_test', email: 'admin.test@mwd.local', password: 'TestPassword123!', role: 'admin' },
    { username: 'engineer_test', email: 'engineer.test@mwd.local', password: 'TestPassword123!', role: 'engineer' },
    { username: 'operator_test', email: 'operator.test@mwd.local', password: 'TestPassword123!', role: 'operator' },
  ],
  sessions: [
    { code: 'TEST-MWD-001', wellName: 'TEST-WELL-A', status: ['ACTIVE', 'active'], rowCount: 180 },
    { code: 'TEST-MWD-002', wellName: 'TEST-WELL-B', status: ['COMPLETED', 'completed', 'CLOSED', 'closed'], rowCount: 60 },
    { code: 'TEST-MWD-003', wellName: 'TEST-WELL-C', status: ['PLANNED', 'planned', 'INACTIVE', 'inactive'], rowCount: 0 },
  ],
};

const models = Prisma.dmmf.datamodel.models;
const enums = Prisma.dmmf.datamodel.enums;

const normalize = (value) => String(value ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase();
const lowerFirst = (value) => value.charAt(0).toLowerCase() + value.slice(1);

function findModel(candidates, required = true) {
  const normalized = candidates.map(normalize);
  const model = models.find((item) => normalized.includes(normalize(item.name)));
  if (!model && required) {
    throw new Error(`Model tidak ditemukan. Kandidat: ${candidates.join(', ')}`);
  }
  return model ?? null;
}

function getDelegate(model) {
  const name = lowerFirst(model.name);
  const delegate = prisma[name];
  if (!delegate) {
    throw new Error(`Prisma delegate tidak ditemukan untuk model ${model.name} (perkiraan: prisma.${name}).`);
  }
  return delegate;
}

function findField(model, candidates, required = false) {
  const normalized = candidates.map(normalize);
  const field = model.fields.find((item) => normalized.includes(normalize(item.name)));
  if (!field && required) {
    throw new Error(`Field pada model ${model.name} tidak ditemukan. Kandidat: ${candidates.join(', ')}`);
  }
  return field ?? null;
}

function getIdField(model) {
  return model.fields.find((field) => field.isId) ??
    model.fields.find((field) => field.isUnique) ??
    null;
}

function enumValues(enumName) {
  return enums.find((item) => item.name === enumName)?.values.map((item) => item.name) ?? [];
}

function chooseEnum(field, preferred = []) {
  if (!field || field.kind !== 'enum') return undefined;
  const available = enumValues(field.type);
  for (const wanted of preferred) {
    const found = available.find((value) => normalize(value) === normalize(wanted));
    if (found) return found;
  }
  return available[0];
}

function setIfField(data, model, candidates, value) {
  const field = findField(model, candidates);
  if (field && value !== undefined) data[field.name] = value;
  return field;
}

function fallbackScalar(field, prefix) {
  if (field.kind === 'enum') return chooseEnum(field);

  switch (field.type) {
    case 'String': return `${prefix}-${field.name}`;
    case 'Boolean': return true;
    case 'Int': return 0;
    case 'BigInt': return 0n;
    case 'Float': return 0;
    case 'Decimal': return new Prisma.Decimal(0);
    case 'DateTime': return new Date();
    case 'Json': return {};
    case 'Bytes': return Buffer.from('');
    default: return undefined;
  }
}

function fillRequiredScalars(model, data, prefix) {
  for (const field of model.fields) {
    if (Object.hasOwn(data, field.name)) continue;
    if (!field.isRequired || field.hasDefaultValue || field.isUpdatedAt) continue;
    if (!['scalar', 'enum'].includes(field.kind)) continue;

    const fallback = fallbackScalar(field, prefix);
    if (fallback !== undefined) data[field.name] = fallback;
  }
  return data;
}

async function loadHasher() {
  try {
    const imported = await import('bcryptjs');
    return imported.default ?? imported;
  } catch {}

  try {
    const imported = await import('bcrypt');
    return imported.default ?? imported;
  } catch {}

  throw new Error('Paket bcryptjs atau bcrypt tidak ditemukan. Instal salah satu: npm install bcryptjs');
}

async function createOrUpdate(model, lookupCandidates, lookupValue, rawData, prefix) {
  const delegate = getDelegate(model);
  const lookupField = findField(model, lookupCandidates, true);
  const data = fillRequiredScalars(model, { ...rawData }, prefix);
  const existing = await delegate.findFirst({ where: { [lookupField.name]: lookupValue } });

  if (!existing) return delegate.create({ data });

  const idField = getIdField(model);
  if (!idField || existing[idField.name] === undefined) {
    return existing;
  }

  const updateData = { ...data };
  delete updateData[idField.name];
  return delegate.update({
    where: { [idField.name]: existing[idField.name] },
    data: updateData,
  });
}

function relationConnect(model, targetModel, targetId, scalarCandidates, relationCandidates, data) {
  const scalar = findField(model, scalarCandidates);
  if (scalar) {
    data[scalar.name] = targetId;
    return;
  }

  const relation = model.fields.find((field) =>
    field.kind === 'object' &&
    normalize(field.type) === normalize(targetModel.name) &&
    relationCandidates.map(normalize).includes(normalize(field.name)),
  );

  if (!relation) return;
  const targetIdField = getIdField(targetModel);
  if (!targetIdField) return;
  data[relation.name] = { connect: { [targetIdField.name]: targetId } };
}

function pseudoRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function rounded(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function main() {
  const hasher = await loadHasher();

  const roleModel = findModel(['Role']);
  const userModel = findModel(['User']);
  const sessionModel = findModel(['MWDSession', 'MwdSession', 'Session']);
  const dataModel = findModel(['MWDData', 'MwdData'], false);
  const witsConfigModel = findModel(['WitsConfig', 'WITSConfig', 'WitsConfiguration'], false);
  const witsValueModel = findModel(['WitsDataValue', 'WITSDataValue', 'WitsValue'], false);

  console.log(`Model terdeteksi: role=${roleModel.name}, user=${userModel.name}, session=${sessionModel.name}`);
  if (dataModel) console.log(`Model data MWD: ${dataModel.name}`);
  if (witsConfigModel) console.log(`Model WITS config: ${witsConfigModel.name}`);
  if (witsValueModel) console.log(`Model WITS value: ${witsValueModel.name}`);

  const roleIdField = getIdField(roleModel);
  const userIdField = getIdField(userModel);
  const sessionIdField = getIdField(sessionModel);
  if (!roleIdField || !userIdField || !sessionIdField) {
    throw new Error('Model Role, User, dan Session harus memiliki id/unique field.');
  }

  const roles = new Map();
  for (const roleName of ['admin', 'engineer', 'operator']) {
    const data = {};
    setIfField(data, roleModel, ['name', 'roleName', 'code', 'slug'], roleName);
    setIfField(data, roleModel, ['description', 'label'], `System role for ${roleName}`);
    const role = await createOrUpdate(
      roleModel,
      ['name', 'roleName', 'code', 'slug'],
      roleName,
      data,
      `role-${roleName}`,
    );
    roles.set(roleName, role);
  }

  const users = new Map();
  for (const definition of CONFIG.users) {
    const role = roles.get(definition.role);
    const data = {};
    setIfField(data, userModel, ['username', 'userName', 'login', 'identifier'], definition.username);
    setIfField(data, userModel, ['email', 'emailAddress'], definition.email);
    setIfField(data, userModel, ['isActive', 'active', 'enabled'], true);
    setIfField(data, userModel, ['name', 'fullName', 'displayName'], `${definition.role} test`);

    const passwordField = findField(userModel, ['passwordHash', 'password', 'hashedPassword'], true);
    data[passwordField.name] = await hasher.hash(definition.password, CONFIG.passwordRounds);

    relationConnect(
      userModel,
      roleModel,
      role[roleIdField.name],
      ['roleId', 'role_id'],
      ['role'],
      data,
    );

    const user = await createOrUpdate(
      userModel,
      ['username', 'userName', 'login', 'identifier'],
      definition.username,
      data,
      `user-${definition.username}`,
    );
    users.set(definition.username, user);
  }

  const sessionStatusField = findField(sessionModel, ['status', 'sessionStatus']);
  const adminUser = users.get('admin_test');
  const sessions = [];

  for (let index = 0; index < CONFIG.sessions.length; index += 1) {
    const definition = CONFIG.sessions[index];
    const data = {};
    setIfField(data, sessionModel, ['sessionCode', 'code', 'name', 'sessionName', 'identifier'], definition.code);
    setIfField(data, sessionModel, ['wellName', 'well', 'well_name'], definition.wellName);
    setIfField(data, sessionModel, ['rigName', 'rig', 'rig_name'], `TEST-RIG-${index + 1}`);
    setIfField(data, sessionModel, ['description', 'notes'], `Deterministic testing session ${definition.code}`);
    setIfField(data, sessionModel, ['isActive', 'active'], index === 0);
    setIfField(data, sessionModel, ['startedAt', 'startTime', 'startDate', 'createdAt'], new Date(Date.UTC(2026, 5, 1 + index, 0, 0, 0)));
    setIfField(data, sessionModel, ['endedAt', 'endTime', 'endDate'], index === 1 ? new Date(Date.UTC(2026, 5, 3, 12, 0, 0)) : null);

    if (sessionStatusField) {
      if (sessionStatusField.kind === 'enum') {
        data[sessionStatusField.name] = chooseEnum(sessionStatusField, definition.status);
      } else {
        data[sessionStatusField.name] = definition.status[0];
      }
    }

    relationConnect(
      sessionModel,
      userModel,
      adminUser[userIdField.name],
      ['createdById', 'userId', 'ownerId'],
      ['createdBy', 'user', 'owner'],
      data,
    );

    const session = await createOrUpdate(
      sessionModel,
      ['sessionCode', 'code', 'name', 'sessionName', 'identifier'],
      definition.code,
      data,
      `session-${definition.code}`,
    );
    sessions.push({ ...definition, record: session });
  }

  // Isi model relasi user-session bila schema memilikinya.
  const assignmentModel = models.find((model) => {
    const key = normalize(model.name);
    return key !== normalize(sessionModel.name) &&
      key.includes('session') &&
      (key.includes('user') || key.includes('assignment') || key.includes('member')) &&
      findField(model, ['sessionId', 'mwdSessionId']) &&
      findField(model, ['userId']);
  });

  if (assignmentModel) {
    const assignmentDelegate = getDelegate(assignmentModel);
    const assignmentSessionField = findField(assignmentModel, ['sessionId', 'mwdSessionId'], true);
    const assignmentUserField = findField(assignmentModel, ['userId'], true);
    const testSessionIds = sessions.map((item) => item.record[sessionIdField.name]);
    await assignmentDelegate.deleteMany({
      where: { [assignmentSessionField.name]: { in: testSessionIds } },
    });

    for (const session of sessions) {
      for (const user of users.values()) {
        const data = {
          [assignmentSessionField.name]: session.record[sessionIdField.name],
          [assignmentUserField.name]: user[userIdField.name],
        };
        setIfField(data, assignmentModel, ['isActive', 'active'], true);
        fillRequiredScalars(assignmentModel, data, `assignment-${session.code}-${user[userIdField.name]}`);
        await assignmentDelegate.create({ data });
      }
    }
    console.log(`Assignment user-session dibuat melalui model ${assignmentModel.name}.`);
  }

  if (dataModel) {
    const dataDelegate = getDelegate(dataModel);
    const dataSessionField = findField(dataModel, ['sessionId', 'mwdSessionId', 'mwd_session_id'], true);
    const testSessionIds = sessions.map((item) => item.record[sessionIdField.name]);
    await dataDelegate.deleteMany({ where: { [dataSessionField.name]: { in: testSessionIds } } });

    for (let sessionIndex = 0; sessionIndex < sessions.length; sessionIndex += 1) {
      const session = sessions[sessionIndex];
      const random = pseudoRandom(1000 + sessionIndex);
      const rows = [];
      const startedAt = new Date(Date.UTC(2026, 5, 1 + sessionIndex, 0, 0, 0));

      for (let index = 0; index < session.rowCount; index += 1) {
        const depth = 1000 + index * 0.5;
        const row = { [dataSessionField.name]: session.record[sessionIdField.name] };
        setIfField(row, dataModel, ['measuredAt', 'timestamp', 'recordedAt', 'createdAt'], new Date(startedAt.getTime() + index * 5000));
        setIfField(row, dataModel, ['measuredDepth', 'depth', 'md'], rounded(depth, 2));
        setIfField(row, dataModel, ['bitDepth'], rounded(depth - 0.3, 2));
        setIfField(row, dataModel, ['inclination', 'inc'], rounded(2 + index * 0.03 + random() * 0.2, 3));
        setIfField(row, dataModel, ['azimuth', 'azi'], rounded((90 + index * 0.4) % 360, 3));
        setIfField(row, dataModel, ['gammaRay', 'gamma', 'gr'], rounded(45 + random() * 30, 3));
        setIfField(row, dataModel, ['temperature', 'temp'], rounded(70 + index * 0.02 + random(), 3));
        setIfField(row, dataModel, ['pressure', 'annularPressure'], rounded(2500 + index * 2 + random() * 10, 3));
        setIfField(row, dataModel, ['toolface', 'toolFace'], rounded((index * 5.5) % 360, 3));
        setIfField(row, dataModel, ['dls', 'doglegSeverity'], rounded(0.5 + random() * 1.5, 3));
        fillRequiredScalars(dataModel, row, `mwd-${session.code}-${index}`);
        rows.push(row);
      }

      if (rows.length > 0) {
        await dataDelegate.createMany({ data: rows });
      }
    }
  }

  const configsBySession = new Map();
  if (witsConfigModel) {
    const delegate = getDelegate(witsConfigModel);
    const configSessionField = findField(witsConfigModel, ['sessionId', 'mwdSessionId'], true);
    const testSessionIds = sessions.map((item) => item.record[sessionIdField.name]);

    if (witsValueModel) {
      const valueDelegate = getDelegate(witsValueModel);
      const valueSessionField = findField(witsValueModel, ['sessionId', 'mwdSessionId']);
      const valueConfigField = findField(witsValueModel, ['witsConfigId', 'configId', 'channelId']);

      if (valueSessionField) {
        await valueDelegate.deleteMany({ where: { [valueSessionField.name]: { in: testSessionIds } } });
      } else if (valueConfigField) {
        const configIdField = getIdField(witsConfigModel);
        if (configIdField) {
          const existingConfigs = await delegate.findMany({
            where: { [configSessionField.name]: { in: testSessionIds } },
            select: { [configIdField.name]: true },
          });
          const configIds = existingConfigs.map((item) => item[configIdField.name]);
          if (configIds.length > 0) {
            await valueDelegate.deleteMany({
              where: { [valueConfigField.name]: { in: configIds } },
            });
          }
        }
      }
    }

    await delegate.deleteMany({ where: { [configSessionField.name]: { in: testSessionIds } } });

    const channelDefinitions = [
      ['0108', 'Measured Depth', 'm', 'measuredDepth'],
      ['0110', 'Bit Depth', 'm', 'bitDepth'],
      ['0120', 'Inclination', 'deg', 'inclination'],
      ['0121', 'Azimuth', 'deg', 'azimuth'],
      ['0130', 'Gamma Ray', 'API', 'gammaRay'],
      ['0140', 'Temperature', 'C', 'temperature'],
      ['0150', 'Pressure', 'psi', 'pressure'],
      ['0160', 'Toolface', 'deg', 'toolface'],
    ];

    for (const session of sessions) {
      const configs = [];
      for (let index = 0; index < channelDefinitions.length; index += 1) {
        const [witsId, label, unit, mappedField] = channelDefinitions[index];
        const data = { [configSessionField.name]: session.record[sessionIdField.name] };
        setIfField(data, witsConfigModel, ['witsId', 'witsCode', 'channelId', 'recordId'], witsId);
        setIfField(data, witsConfigModel, ['label', 'name', 'description'], label);
        setIfField(data, witsConfigModel, ['unit', 'unitName'], unit);
        setIfField(data, witsConfigModel, ['mappedField', 'fieldName', 'sourceField'], mappedField);
        setIfField(data, witsConfigModel, ['isActive', 'enabled', 'active'], true);
        setIfField(data, witsConfigModel, ['sortOrder', 'order', 'position'], index + 1);
        fillRequiredScalars(witsConfigModel, data, `wits-config-${session.code}-${witsId}`);
        configs.push(await delegate.create({ data }));
      }
      configsBySession.set(session.code, configs);
    }
  }

  if (witsValueModel && witsConfigModel) {
    const delegate = getDelegate(witsValueModel);
    const valueSessionField = findField(witsValueModel, ['sessionId', 'mwdSessionId']);
    const valueConfigField = findField(witsValueModel, ['witsConfigId', 'configId', 'channelId']);
    const configIdField = getIdField(witsConfigModel);

    for (let sessionIndex = 0; sessionIndex < sessions.length; sessionIndex += 1) {
      const session = sessions[sessionIndex];
      const configs = configsBySession.get(session.code) ?? [];
      const rows = [];
      const limit = Math.min(session.rowCount, 120);
      const startedAt = new Date(Date.UTC(2026, 5, 1 + sessionIndex, 0, 0, 0));

      for (let index = 0; index < limit; index += 1) {
        for (let configIndex = 0; configIndex < configs.length; configIndex += 1) {
          const row = {};
          if (valueSessionField) row[valueSessionField.name] = session.record[sessionIdField.name];
          if (valueConfigField && configIdField) row[valueConfigField.name] = configs[configIndex][configIdField.name];
          setIfField(row, witsValueModel, ['measuredAt', 'timestamp', 'recordedAt', 'createdAt'], new Date(startedAt.getTime() + index * 5000));
          setIfField(row, witsValueModel, ['value', 'numericValue', 'dataValue'], rounded(1000 + index * 0.5 + configIndex, 3));
          setIfField(row, witsValueModel, ['rawValue'], String(1000 + index * 0.5 + configIndex));
          fillRequiredScalars(witsValueModel, row, `wits-value-${session.code}-${index}-${configIndex}`);
          rows.push(row);
        }
      }

      if (rows.length > 0) await delegate.createMany({ data: rows });
    }
  }

  console.log('\nSeed testing selesai.');
  console.log('Akun:');
  for (const user of CONFIG.users) {
    console.log(`- ${user.username} / ${user.password}`);
  }

  console.log('\nSession:');
  for (const session of sessions) {
    console.log(`- ${session.code}: id=${session.record[sessionIdField.name]}, target MWD rows=${session.rowCount}`);
  }

  if (dataModel) {
    const delegate = getDelegate(dataModel);
    const dataSessionField = findField(dataModel, ['sessionId', 'mwdSessionId', 'mwd_session_id'], true);
    for (const session of sessions) {
      const count = await delegate.count({
        where: { [dataSessionField.name]: session.record[sessionIdField.name] },
      });
      console.log(`Verifikasi ${session.code}: ${count} row MWD.`);
    }
  }
}

main()
  .catch((error) => {
    console.error('\nSEED TESTING GAGAL');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
