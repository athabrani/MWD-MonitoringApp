export type MWDMeasurementInput = {
  toolRunTime?: number | string | null
  slideIndicator?: number | string | null
  depthMd?: number | string | null
  hole_depth?: number | string | null
  inclination?: number | string | null
  continuousInclination?: number | string | null
  azimuth?: number | string | null
  continuousAzimuth?: number | string | null
  verticalSection?: number | string | null
  rawSensorAx?: number | string | null
  rawSensorAy?: number | string | null
  rawSensorAz?: number | string | null
  rawSensorMx?: number | string | null
  rawSensorMy?: number | string | null
  rawSensorMz?: number | string | null
  magneticToolface?: number | string | null
  gravityToolface?: number | string | null
  totalGravity?: number | string | null
  dipAngle?: number | string | null
  magneticField?: number | string | null
  gammaRay?: number | string | null
  temperature?: number | string | null
  batteryVoltage?: number | string | null
  battery2OnOff?: number | string | null
  rotationSpeed?: number | string | null
  downholeRpm?: number | string | null
  rotaryTorque?: number | string | null
  shock?: number | string | null
  shockAxial?: number | string | null
  shockLateral?: number | string | null
  vibration?: number | string | null
  vibrationAxial?: number | string | null
  vibrationLateral?: number | string | null
  genericVariable0?: number | string | null
  genericVariable1?: number | string | null
  genericVariable2?: number | string | null
  genericVariable3?: number | string | null
  genericVariable4?: number | string | null
  genericVariable5?: number | string | null
  genericVariable6?: number | string | null
  genericVariable7?: number | string | null
  rop?: number | string | null
  hookLoad?: number | string | null
  hookPosition?: number | string | null
  standpipePressure?: number | string | null
  flowOut?: number | string | null
  flowIn?: number | string | null
  gasAverage?: number | string | null
  annularPressure?: number | string | null
  borePressure?: number | string | null
  mwdPressure?: number | string | null
  kpwd2?: number | string | null
  differentialPressure?: number | string | null
  annularDifferentialPressure?: number | string | null
  mudWeight?: number | string | null
  ecd?: number | string | null
  ecd2?: number | string | null
  ecdTvd?: number | string | null
  ecdDd?: number | string | null
  ssi?: number | string | null
  tvdCalc?: number | string | null
  confidence?: number | string | null
  pulseAmplitude?: number | string | null
  decoderPressure?: number | string | null
  avo?: number | string | null
  shallowResistivity?: number | string | null
}

export type MeasurementField = keyof MWDMeasurementInput

type PendingParsedMeasurementField = {
  provided: boolean
  value: number | string | null | undefined | 'invalid'
}

export type ParsedMeasurementFields = {
  [Field in MeasurementField]: {
    provided: boolean
    value: number | string | null | undefined
  }
}

export type WitsMeasurementDefinition = {
  field: MeasurementField
  measurement: string
  pulseWord?: string
  witsId?: string
  units?: string
  priority?: number
}

export const MWD_MEASUREMENT_FIELDS = [
  'toolRunTime',
  'slideIndicator',
  'depthMd',
  'hole_depth',
  'inclination',
  'continuousInclination',
  'azimuth',
  'continuousAzimuth',
  'verticalSection',
  'rawSensorAx',
  'rawSensorAy',
  'rawSensorAz',
  'rawSensorMx',
  'rawSensorMy',
  'rawSensorMz',
  'magneticToolface',
  'gravityToolface',
  'totalGravity',
  'dipAngle',
  'magneticField',
  'gammaRay',
  'temperature',
  'batteryVoltage',
  'battery2OnOff',
  'rotationSpeed',
  'downholeRpm',
  'rotaryTorque',
  'shock',
  'shockAxial',
  'shockLateral',
  'vibration',
  'vibrationAxial',
  'vibrationLateral',
  'genericVariable0',
  'genericVariable1',
  'genericVariable2',
  'genericVariable3',
  'genericVariable4',
  'genericVariable5',
  'genericVariable6',
  'genericVariable7',
  'rop',
  'hookLoad',
  'hookPosition',
  'standpipePressure',
  'flowOut',
  'flowIn',
  'gasAverage',
  'annularPressure',
  'borePressure',
  'mwdPressure',
  'kpwd2',
  'differentialPressure',
  'annularDifferentialPressure',
  'mudWeight',
  'ecd',
  'ecd2',
  'ecdTvd',
  'ecdDd',
  'ssi',
  'tvdCalc',
  'confidence',
  'pulseAmplitude',
  'decoderPressure',
  'avo',
  'shallowResistivity',
] as const satisfies readonly MeasurementField[]

export const WITS_RECEIVED_MEASUREMENT_DEFINITIONS = [
  {
    field: 'toolRunTime',
    measurement: 'Tool Run Time',
    witsId: '0010',
  },
  {
    field: 'slideIndicator',
    measurement: 'Slide Indicator',
    witsId: '0012',
  },
  {
    field: 'hole_depth',
    measurement: 'Hole Depth',
    witsId: '0110',
    priority: 0,
  },
  {
    field: 'depthMd',
    measurement: 'Bit Depth',
    witsId: '0108',
    priority: 1,
  },
  {
    field: 'rop',
    measurement: 'Rate of Penetration',
    witsId: '0113',
  },
  {
    field: 'hookPosition',
    measurement: 'Hook Position',
    witsId: '0112',
  },
  {
    field: 'hookLoad',
    measurement: 'Weight on Bit',
    witsId: '0117',
  },
  {
    field: 'rotaryTorque',
    measurement: 'Rotary Torque',
    witsId: '0119',
  },
  {
    field: 'rotationSpeed',
    measurement: 'Rotary Speed',
    witsId: '0120',
    units: 'rpm',
  },
  {
    field: 'standpipePressure',
    measurement: 'Pump Pressure',
    witsId: '0121',
  },
  {
    field: 'flowOut',
    measurement: 'Flow Out',
    witsId: '0128',
  },
  {
    field: 'flowIn',
    measurement: 'Flow In',
    witsId: '0130',
  },
  {
    field: 'gasAverage',
    measurement: 'Gas Avg',
    witsId: '0140',
  },
  {
    field: 'mudWeight',
    measurement: 'Mud Weight',
    witsId: '0150',
  },
  {
    field: 'tvdCalc',
    measurement: 'TVD',
    witsId: '0709',
    units: 'm',
  },
  {
    field: 'inclination',
    measurement: 'Inclination',
    witsId: '0713',
    units: 'degrees (°)',
  },
  {
    field: 'azimuth',
    measurement: 'Azimuth',
    witsId: '0715',
    units: 'degrees (°)',
    priority: 0,
  },
  {
    field: 'continuousInclination',
    measurement: 'Continuous Inclination',
    witsId: '0780',
    units: 'degrees (°)',
  },
  {
    field: 'continuousAzimuth',
    measurement: 'Continuous Azimuth',
    witsId: '0781',
    units: 'degrees (°)',
  },
  {
    field: 'totalGravity',
    measurement: 'Total Gravity Field (Sharewell)',
    witsId: '0142',
    units: 'g',
  },
  {
    field: 'magneticField',
    measurement: 'Total Magnetic Field (Sharewell)',
    witsId: '0143',
    units: 'g',
  },
  {
    field: 'dipAngle',
    measurement: 'Dip Angle (Sharewell)',
    witsId: '0145',
    units: 'degrees (°)',
  },
  {
    field: 'vibration',
    measurement: 'Vibration (Sharewell)',
    witsId: '0146',
    units: 'g',
  },
  {
    field: 'azimuth',
    measurement: 'Azimuth',
    witsId: '0714',
    units: 'degrees (°)',
    priority: 1,
  },
  {
    field: 'dipAngle',
    measurement: 'Dip Angle',
    witsId: '0722',
    units: 'degrees (°)',
  },
  {
    field: 'verticalSection',
    measurement: 'Vertical Section',
    witsId: '0723',
    units: 'm',
  },
  {
    field: 'batteryVoltage',
    measurement: 'Battery Voltage (GUIDE)',
    witsId: '0724',
    units: 'volts',
  },
  {
    field: 'magneticField',
    measurement: 'Total Magnetic Field',
    witsId: '0725',
    units: 'g',
  },
  {
    field: 'totalGravity',
    measurement: 'Total Gravity Field',
    witsId: '0726',
    units: 'g',
  },
  {
    field: 'dipAngle',
    measurement: 'Dip Angle',
    witsId: '0728',
    units: 'degrees (°)',
  },
  {
    field: 'temperature',
    measurement: 'Temperature',
    witsId: '0733',
    units: 'C',
  },
  {
    field: 'batteryVoltage',
    measurement: 'Battery Voltage (TolTech)',
    witsId: '0734',
    units: 'volts',
  },
  {
    field: 'gammaRay',
    measurement: 'Gamma Corrected',
    witsId: '0824',
  },
  {
    field: 'batteryVoltage',
    measurement: 'Battery Voltage (Keydrill)',
    witsId: '0921',
    units: 'volts',
  },
  {
    field: 'differentialPressure',
    measurement: 'KPWD DPWD',
    witsId: '0801',
  },
  {
    field: 'mwdPressure',
    measurement: 'KPWD IPWD',
    witsId: '0802',
  },
  {
    field: 'annularPressure',
    measurement: 'KPWD APWD',
    witsId: '0803',
  },
  {
    field: 'temperature',
    measurement: 'Temperature',
    witsId: '0835',
    units: 'C',
  },
  {
    field: 'temperature',
    measurement: 'Temperature',
    witsId: '0836',
    units: 'C',
  },
  {
    field: 'ecdTvd',
    measurement: 'ECD TVD Survey Based',
    witsId: '0850',
  },
  {
    field: 'ecd',
    measurement: 'ECD Calculation SG',
    witsId: '0851',
  },
  {
    field: 'ecd2',
    measurement: 'ECD Calculation PPG',
    witsId: '0852',
  },
  {
    field: 'tvdCalc',
    measurement: 'TVD Calc',
    witsId: '0853',
  },
  {
    field: 'mwdPressure',
    measurement: 'MWD Pressure',
    witsId: '0888',
  },
  {
    field: 'borePressure',
    measurement: 'KPWD Bore',
    witsId: '0899',
  },
  {
    field: 'kpwd2',
    measurement: 'KPWD 2',
    witsId: '0900',
  },
  {
    field: 'magneticToolface',
    measurement: 'Magnetic Toolface (Extreme)',
    witsId: '8916',
    units: 'degrees (°)',
  },
  {
    field: 'gravityToolface',
    measurement: 'Gravity Toolface (Extreme)',
    witsId: '8917',
    units: 'degrees (°)',
  },
  {
    field: 'dipAngle',
    measurement: 'Dip Angle (Extreme)',
    witsId: '9014',
    units: 'degrees (°)',
  },
  {
    field: 'magneticField',
    measurement: 'Total Magnetic Field (Extreme)',
    witsId: '9016',
    units: 'g',
  },
  {
    field: 'totalGravity',
    measurement: 'Total Gravity Field (Extreme)',
    witsId: '9017',
    units: 'g',
  },
  {
    field: 'gravityToolface',
    measurement: 'GTF Relog',
    witsId: '5717',
    units: 'degrees (°)',
  },
  {
    field: 'totalGravity',
    measurement: 'Total Gravity Relog',
    witsId: '5731',
    units: 'g',
  },
  {
    field: 'magneticField',
    measurement: 'Mag Field Relog',
    witsId: '5732',
    units: 'g',
  },
  {
    field: 'temperature',
    measurement: 'Temperature Relog',
    witsId: '5733',
    units: 'C',
  },
  {
    field: 'batteryVoltage',
    measurement: 'Battery Voltage Relog',
    witsId: '5734',
    units: 'volts',
  },
  {
    field: 'battery2OnOff',
    measurement: 'Battery 2 Relog',
    witsId: '5735',
  },
  {
    field: 'annularPressure',
    measurement: 'Pressure - Annular Relog',
    witsId: '5757',
  },
  {
    field: 'borePressure',
    measurement: 'Pressure - Bore Relog',
    witsId: '5758',
  },
  {
    field: 'differentialPressure',
    measurement: 'Diff Pressure Relog',
    witsId: '5759',
  },
  {
    field: 'annularDifferentialPressure',
    measurement: 'Annular Differential Restriction Relog',
    witsId: '5760',
  },
  {
    field: 'temperature',
    measurement: 'Temperature Relog',
    witsId: '5835',
    units: 'C',
  },
  {
    field: 'temperature',
    measurement: 'Temperature Relog',
    witsId: '5836',
    units: 'C',
  },
  {
    field: 'ecd',
    measurement: 'ECD Calculation Relog',
    witsId: '5850',
  },
  {
    field: 'ecd',
    measurement: 'ECD Calculation SG Relog',
    witsId: '5851',
  },
  {
    field: 'ecd2',
    measurement: 'ECD Calculation PPG Relog',
    witsId: '5852',
  },
  {
    field: 'tvdCalc',
    measurement: 'TVD Calc Relog',
    witsId: '5853',
  },
  {
    field: 'mwdPressure',
    measurement: 'MWD Pressure Relog',
    witsId: '5888',
  },
  {
    field: 'confidence',
    measurement: 'Confidence',
    witsId: '6410',
  },
  {
    field: 'pulseAmplitude',
    measurement: 'Pulse Amp',
    witsId: '6411',
  },
  {
    field: 'decoderPressure',
    measurement: 'Decoder Pressure',
    witsId: '6425',
  },
  {
    field: 'tvdCalc',
    measurement: 'TVD CAL CINC',
    witsId: '6666',
  },
  {
    field: 'avo',
    measurement: 'AVO',
    witsId: '7777',
  },
  {
    field: 'ecdDd',
    measurement: 'ECD DD',
    witsId: '8888',
  },
  {
    field: 'shallowResistivity',
    measurement: 'Shallow Res',
    witsId: '9910',
  },
] as const satisfies readonly WitsMeasurementDefinition[]

export const WITS_SENT_MEASUREMENT_DEFINITIONS = [
  {
    field: 'inclination',
    measurement: 'Inclination',
    pulseWord: 'Inc',
    witsId: '0713',
    units: 'degrees (°)',
  },
  {
    field: 'continuousInclination',
    measurement: 'Continuous Inclination',
    pulseWord: 'cINC',
    witsId: '0780',
    units: 'degrees (°)',
  },
  {
    field: 'azimuth',
    measurement: 'Azimuth',
    pulseWord: 'Azm',
    witsId: '0715',
    units: 'degrees (°)',
  },
  {
    field: 'continuousAzimuth',
    measurement: 'Continuous Azimuth',
    pulseWord: 'cAZM',
    witsId: '0781',
    units: 'degrees (°)',
  },
  {
    field: 'rawSensorAx',
    measurement: 'Raw Sensor - Ax',
    pulseWord: 'Axs',
    witsId: '0765',
    units: 'g',
  },
  {
    field: 'rawSensorAy',
    measurement: 'Raw Sensor - Ay',
    pulseWord: 'Ays',
    witsId: '0766',
    units: 'g',
  },
  {
    field: 'rawSensorAz',
    measurement: 'Raw Sensor - Az',
    pulseWord: 'Azs',
    witsId: '0767',
    units: 'g',
  },
  {
    field: 'rawSensorMx',
    measurement: 'Raw Sensor - Mx',
    pulseWord: 'Mxs',
    witsId: '0768',
    units: 'g',
  },
  {
    field: 'rawSensorMy',
    measurement: 'Raw Sensor - My',
    pulseWord: 'Mys',
    witsId: '0769',
    units: 'g',
  },
  {
    field: 'rawSensorMz',
    measurement: 'Raw Sensor - Mz',
    pulseWord: 'Mzs',
    witsId: '0770',
    units: 'g',
  },
  {
    field: 'magneticToolface',
    measurement: 'Magnetic Toolface',
    pulseWord: 'mTFA',
    witsId: '0716',
    units: 'degrees (°)',
  },
  {
    field: 'gravityToolface',
    measurement: 'Gravity Toolface',
    pulseWord: 'gTFA',
    witsId: '0717',
    units: 'degrees (°)',
  },
  {
    field: 'totalGravity',
    measurement: 'Total Gravity',
    pulseWord: 'Grav',
    witsId: '0731',
    units: 'g',
  },
  {
    field: 'dipAngle',
    measurement: 'Dip Angle',
    pulseWord: 'DipA',
    witsId: '0730',
    units: 'degrees (°)',
  },
  {
    field: 'magneticField',
    measurement: 'Magnetic Field',
    pulseWord: 'MagFt',
    witsId: '0732',
    units: 'g',
  },
  {
    field: 'gammaRay',
    measurement: 'Gamma',
    pulseWord: 'Gama',
    witsId: '0823',
    units: 'cps',
  },
  {
    field: 'batteryVoltage',
    measurement: 'Battery Voltage',
    pulseWord: 'BatV',
    witsId: '0724',
    units: 'volts',
  },
  {
    field: 'battery2OnOff',
    measurement: 'Battery 2 On/Off',
    pulseWord: 'Bat2',
    witsId: '0735',
  },
  {
    field: 'downholeRpm',
    measurement: 'RPM Downhole',
    pulseWord: 'rpm',
    witsId: '0738',
    units: 'rpm',
  },
  {
    field: 'shock',
    measurement: 'Shock',
    pulseWord: 'SHK1',
    witsId: '0736',
    units: 'g',
  },
  {
    field: 'shockAxial',
    measurement: 'Shock Axial',
    pulseWord: 'SHK1',
    witsId: '0736',
    units: 'g',
  },
  {
    field: 'vibration',
    measurement: 'Vibration',
    pulseWord: 'VIB1',
    witsId: '0737',
    units: 'g',
  },
  {
    field: 'vibrationAxial',
    measurement: 'Vibration Axial',
    pulseWord: 'VIB1',
    witsId: '0737',
    units: 'g',
  },
  {
    field: 'annularPressure',
    measurement: 'Pressure - Annular',
    pulseWord: 'PAnn',
    witsId: '0757',
  },
  {
    field: 'borePressure',
    measurement: 'Pressure - Bore',
    pulseWord: 'PBore',
    witsId: '0758',
  },
  {
    field: 'differentialPressure',
    measurement: 'Diff Pressure',
    pulseWord: 'DP',
    witsId: '0759',
  },
  {
    field: 'annularDifferentialPressure',
    measurement: 'Annular Differential Restriction',
    pulseWord: 'ADP',
    witsId: '0760',
  },
  {
    field: 'genericVariable4',
    measurement: 'Generic Variable',
    pulseWord: 'GV4',
    witsId: '0761',
  },
  {
    field: 'genericVariable5',
    measurement: 'Generic Variable',
    pulseWord: 'GV5',
    witsId: '0762',
  },
  {
    field: 'genericVariable6',
    measurement: 'Generic Variable',
    pulseWord: 'GV6',
    witsId: '0763',
  },
  {
    field: 'genericVariable7',
    measurement: 'Generic Variable',
    pulseWord: 'GV7',
    witsId: '0764',
  },
] as const satisfies readonly WitsMeasurementDefinition[]

const WITS_MEASUREMENT_DEFINITIONS = [
  ...WITS_RECEIVED_MEASUREMENT_DEFINITIONS,
  ...WITS_SENT_MEASUREMENT_DEFINITIONS,
] as const satisfies readonly WitsMeasurementDefinition[]

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const looksLikeWitsKey = (value: string) => {
  return /^(\d{4}|\d{2}\s?\d{2})$/.test(value.trim())
}

const RAW_WITS_TEXT_FIELDS = [
  'raw',
  'rawWits',
  'witsRaw',
  'witsText',
  'dataReceived',
  'dataTransmitted',
  'payload',
  'message',
  'data',
] as const

export const normalizeWitsId = (value: unknown) => {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return String(value).padStart(4, '0')
  }

  if (typeof value !== 'string') {
    return null
  }

  const digitsOnly = value.replace(/\D/g, '')

  if (!digitsOnly) {
    return null
  }

  return digitsOnly.length >= 4 ? digitsOnly : digitsOnly.padStart(4, '0')
}

export const formatWitsId = (witsId: string) => {
  return witsId.length === 4
    ? `${witsId.slice(0, 2)} ${witsId.slice(2)}`
    : witsId
}

const unwrapMeasurementValue = (value: unknown) => {
  if (isRecord(value)) {
    if ('value' in value) {
      return value.value
    }

    if ('reading' in value) {
      return value.reading
    }

    if ('measurement' in value) {
      return value.measurement
    }
  }

  return value
}

const isNullMeasurementSentinel = (value: number) => {
  return value === -9999
}

const parseOptionalDecimal = (
  value: unknown,
): PendingParsedMeasurementField => {
  if (value === undefined) {
    return { provided: false, value: undefined }
  }

  if (value === null || value === '') {
    return { provided: true, value: null }
  }

  if (typeof value === 'number') {
    if (isNullMeasurementSentinel(value)) {
      return { provided: true, value: null }
    }

    return Number.isFinite(value)
      ? { provided: true, value }
      : { provided: true, value: 'invalid' }
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()

    if (!trimmed) {
      return { provided: true, value: null }
    }

    const parsed = Number(trimmed)

    if (Number.isFinite(parsed) && isNullMeasurementSentinel(parsed)) {
      return { provided: true, value: null }
    }

    return Number.isFinite(parsed)
      ? { provided: true, value: trimmed }
      : { provided: true, value: 'invalid' }
  }

  return { provided: true, value: 'invalid' }
}

const collectWitsValuesFromRecord = (
  values: Map<string, unknown>,
  record: Record<string, unknown>,
) => {
  for (const [key, value] of Object.entries(record)) {
    if (!looksLikeWitsKey(key)) {
      continue
    }

    const normalizedWitsId = normalizeWitsId(key)

    if (!normalizedWitsId) {
      continue
    }

    values.set(normalizedWitsId, unwrapMeasurementValue(value))
  }
}

const collectWitsValuesFromArray = (
  values: Map<string, unknown>,
  items: unknown[],
) => {
  for (const item of items) {
    if (!isRecord(item)) {
      continue
    }

    const normalizedWitsId = normalizeWitsId(
      item.witsId ?? item.id ?? item.tag ?? item.word ?? item.code,
    )

    if (!normalizedWitsId) {
      continue
    }

    values.set(
      normalizedWitsId,
      unwrapMeasurementValue(
        item.value ?? item.reading ?? item.measurement ?? item.data,
      ),
    )
  }
}

const parseRawWitsLine = (line: string) => {
  const trimmed = line.trim()

  if (!trimmed || trimmed === '&&' || trimmed === '!!') {
    return null
  }

  const separatedMatch = trimmed.match(
    /^(\d{4})\s*[:=,\t ]\s*([-+]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[-+]?\d+)?)$/i,
  )

  if (separatedMatch) {
    const [, witsId, value] = separatedMatch

    if (!witsId || !value) {
      return null
    }

    return {
      witsId,
      value,
    }
  }

  const compactMatch = trimmed.match(
    /^(\d{4})([-+]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[-+]?\d+)?)$/i,
  )

  if (compactMatch) {
    const [, witsId, value] = compactMatch

    if (!witsId || !value) {
      return null
    }

    return { witsId, value }
  }

  const embeddedMatch = trimmed.match(
    /(?:^|[^\d])(\d{4})\s*[:=,\t ]\s*([-+]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[-+]?\d+)?)/i,
  )

  if (!embeddedMatch) {
    return null
  }

  const [, witsId, value] = embeddedMatch

  if (!witsId || !value) {
    return null
  }

  return { witsId, value }
}

const collectWitsValuesFromRawText = (
  values: Map<string, unknown>,
  text: string,
) => {
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseRawWitsLine(line)

    if (!parsed) {
      continue
    }

    values.set(parsed.witsId, parsed.value)
  }
}

export const collectWitsValues = (source: Record<string, unknown>) => {
  const values = new Map<string, unknown>()

  for (const key of [
    'wits',
    'witsData',
    'witsMeasurements',
    'measurements',
  ] as const) {
    const rawValue = source[key]

    if (Array.isArray(rawValue)) {
      collectWitsValuesFromArray(values, rawValue)
      continue
    }

    if (isRecord(rawValue)) {
      collectWitsValuesFromRecord(values, rawValue)
    }
  }

  for (const key of RAW_WITS_TEXT_FIELDS) {
    const rawValue = source[key]

    if (typeof rawValue === 'string') {
      collectWitsValuesFromRawText(values, rawValue)
    }
  }

  collectWitsValuesFromRecord(values, source)

  return values
}

export const parseMeasurementFields = (source: Record<string, unknown>) => {
  const parsedFields = Object.fromEntries(
    MWD_MEASUREMENT_FIELDS.map((fieldName) => [
      fieldName,
      parseOptionalDecimal(source[fieldName]),
    ]),
  ) as Record<MeasurementField, PendingParsedMeasurementField>

  const witsValues = collectWitsValues(source)
  const appliedWitsFields = new Set<MeasurementField>()
  const sortedWitsDefinitions = [
    ...WITS_MEASUREMENT_DEFINITIONS,
  ] as WitsMeasurementDefinition[]
  sortedWitsDefinitions.sort(
    (left, right) => (left.priority ?? 0) - (right.priority ?? 0),
  )

  for (const definition of sortedWitsDefinitions) {
    if (!definition.witsId || !witsValues.has(definition.witsId)) {
      continue
    }

    if (appliedWitsFields.has(definition.field)) {
      continue
    }

    parsedFields[definition.field] = parseOptionalDecimal(
      witsValues.get(definition.witsId),
    )
    appliedWitsFields.add(definition.field)

    if (parsedFields[definition.field].value === 'invalid') {
      return {
        error: `${definition.measurement} (WITS ${formatWitsId(definition.witsId)}) must be a valid number`,
      }
    }
  }

  for (const [fieldName, fieldValue] of Object.entries(parsedFields)) {
    if (fieldValue.value === 'invalid') {
      return { error: `${fieldName} must be a valid number` }
    }
  }

  return { parsedFields: parsedFields as ParsedMeasurementFields }
}

export const applyMeasurementFields = (
  target: MWDMeasurementInput,
  parsedFields: ParsedMeasurementFields,
) => {
  for (const fieldName of MWD_MEASUREMENT_FIELDS) {
    if (parsedFields[fieldName].provided) {
      target[fieldName] = parsedFields[fieldName].value ?? null
    }
  }
}
