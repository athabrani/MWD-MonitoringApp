import bcrypt from 'bcrypt'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const systemRoles = ['admin', 'engineer', 'operator']
const defaultWitsConfigs = [
  {
    witsId: '0010',
    name: 'Tool Run Time',
    mappedField: 'toolRunTime',
    lasTag: 'TRTIME',
  },
  {
    witsId: '0012',
    name: 'Slide Indicator',
    mappedField: 'slideIndicator',
    lasTag: 'SLIDE',
  },
  { witsId: '0108', name: 'Bit Depth', mappedField: 'depthMd', lasTag: 'DEPT' },
  {
    witsId: '0110',
    name: 'Hole Depth',
    mappedField: 'hole_depth',
    lasTag: 'HDEPT',
  },
  {
    witsId: '0112',
    name: 'Hook Position',
    mappedField: 'hookPosition',
    lasTag: 'HKPOS',
  },
  {
    witsId: '0113',
    name: 'Rate of Penetration',
    mappedField: 'rop',
    lasTag: 'ROP',
  },
  {
    witsId: '0117',
    name: 'Weight on Bit',
    mappedField: 'hookLoad',
    lasTag: 'HKLD',
  },
  {
    witsId: '0119',
    name: 'Rotary Torque',
    mappedField: 'rotaryTorque',
    lasTag: 'RTORQ',
  },
  {
    witsId: '0120',
    name: 'Rotary Speed',
    mappedField: 'rotationSpeed',
    units: 'rpm',
    lasTag: 'RPM',
  },
  {
    witsId: '0121',
    name: 'Pump Pressure',
    mappedField: 'standpipePressure',
    lasTag: 'SPPA',
  },
  {
    witsId: '0128',
    name: 'Flow Out',
    mappedField: 'flowOut',
    lasTag: 'FLOOUT',
  },
  { witsId: '0130', name: 'Flow In', mappedField: 'flowIn', lasTag: 'FLOIN' },
  {
    witsId: '0140',
    name: 'Gas Avg',
    mappedField: 'gasAverage',
    lasTag: 'GASAVG',
  },
  {
    witsId: '0150',
    name: 'Mud Weight',
    mappedField: 'mudWeight',
    lasTag: 'MWT',
  },
  {
    witsId: '0709',
    name: 'TVD',
    mappedField: 'tvdCalc',
    units: 'm',
    lasTag: 'TVD',
  },
  {
    witsId: '0142',
    name: 'Total Gravity Field',
    mappedField: 'totalGravity',
    units: 'g',
    lasTag: 'GTOT',
  },
  {
    witsId: '0143',
    name: 'Total Magnetic Field',
    mappedField: 'magneticField',
    units: 'g',
    lasTag: 'BTOT',
  },
  {
    witsId: '0145',
    name: 'Dip Angle',
    mappedField: 'dipAngle',
    units: 'deg',
    lasTag: 'DIPA',
  },
  {
    witsId: '0146',
    name: 'Vibration',
    mappedField: 'vibration',
    units: 'g',
    lasTag: 'VIB',
  },
  {
    witsId: '0713',
    name: 'Inclination',
    mappedField: 'inclination',
    units: 'deg',
    lasTag: 'INCL',
  },
  {
    witsId: '0714',
    name: 'Azimuth',
    mappedField: 'azimuth',
    units: 'deg',
    lasTag: 'AZIM',
  },
  {
    witsId: '0715',
    name: 'Azimuth',
    mappedField: 'azimuth',
    units: 'deg',
    lasTag: 'AZIM',
  },
  {
    witsId: '0716',
    name: 'Magnetic Toolface',
    mappedField: 'magneticToolface',
    units: 'deg',
    lasTag: 'MTF',
  },
  {
    witsId: '0717',
    name: 'Gravity Toolface',
    mappedField: 'gravityToolface',
    units: 'deg',
    lasTag: 'GTF',
  },
  {
    witsId: '0723',
    name: 'Vertical Section',
    mappedField: 'verticalSection',
    units: 'm',
    lasTag: 'VS',
  },
  {
    witsId: '0724',
    name: 'Battery Voltage',
    mappedField: 'batteryVoltage',
    units: 'V',
    lasTag: 'BATV',
  },
  {
    witsId: '0725',
    name: 'Total Magnetic Field',
    mappedField: 'magneticField',
    units: 'g',
    lasTag: 'BTOT',
  },
  {
    witsId: '0726',
    name: 'Total Gravity Field',
    mappedField: 'totalGravity',
    units: 'g',
    lasTag: 'GTOT',
  },
  {
    witsId: '0722',
    name: 'Dip Angle',
    mappedField: 'dipAngle',
    units: 'deg',
    lasTag: 'DIPA',
  },
  {
    witsId: '0728',
    name: 'Dip Angle',
    mappedField: 'dipAngle',
    units: 'deg',
    lasTag: 'DIPA',
  },
  {
    witsId: '0730',
    name: 'Dip Angle',
    mappedField: 'dipAngle',
    units: 'deg',
    lasTag: 'DIPA',
  },
  {
    witsId: '0731',
    name: 'Total Gravity',
    mappedField: 'totalGravity',
    units: 'g',
    lasTag: 'GTOT',
  },
  {
    witsId: '0732',
    name: 'Magnetic Field',
    mappedField: 'magneticField',
    units: 'g',
    lasTag: 'BTOT',
  },
  {
    witsId: '0733',
    name: 'Temperature',
    mappedField: 'temperature',
    units: 'C',
    lasTag: 'TEMP',
  },
  {
    witsId: '0734',
    name: 'Battery Voltage',
    mappedField: 'batteryVoltage',
    units: 'V',
    lasTag: 'BATV',
  },
  {
    witsId: '0735',
    name: 'Battery 2 On/Off',
    mappedField: 'battery2OnOff',
    lasTag: 'BAT2',
  },
  {
    witsId: '0736',
    name: 'Shock Axial',
    mappedField: 'shockAxial',
    units: 'g',
    lasTag: 'SHKAX',
  },
  {
    witsId: '0737',
    name: 'Vibration Axial',
    mappedField: 'vibrationAxial',
    units: 'g',
    lasTag: 'VIBAX',
  },
  {
    witsId: '0738',
    name: 'Downhole RPM',
    mappedField: 'downholeRpm',
    units: 'rpm',
    lasTag: 'DHRPM',
  },
  {
    witsId: '0757',
    name: 'Pressure - Annular',
    mappedField: 'annularPressure',
    lasTag: 'PANN',
  },
  {
    witsId: '0758',
    name: 'Pressure - Bore',
    mappedField: 'borePressure',
    lasTag: 'PBORE',
  },
  {
    witsId: '0759',
    name: 'Diff Pressure',
    mappedField: 'differentialPressure',
    lasTag: 'DPRES',
  },
  {
    witsId: '0760',
    name: 'Annular Differential Restriction',
    mappedField: 'annularDifferentialPressure',
    lasTag: 'ADP',
  },
  {
    witsId: '0761',
    name: 'Generic Variable 4',
    mappedField: 'genericVariable4',
    lasTag: 'GV4',
    enableLogging: false,
  },
  {
    witsId: '0762',
    name: 'Generic Variable 5',
    mappedField: 'genericVariable5',
    lasTag: 'GV5',
    enableLogging: false,
  },
  {
    witsId: '0763',
    name: 'Generic Variable 6',
    mappedField: 'genericVariable6',
    lasTag: 'GV6',
    enableLogging: false,
  },
  {
    witsId: '0764',
    name: 'Generic Variable 7',
    mappedField: 'genericVariable7',
    lasTag: 'GV7',
    enableLogging: false,
  },
  {
    witsId: '0765',
    name: 'Raw Sensor Ax',
    mappedField: 'rawSensorAx',
    units: 'g',
    lasTag: 'AX',
  },
  {
    witsId: '0766',
    name: 'Raw Sensor Ay',
    mappedField: 'rawSensorAy',
    units: 'g',
    lasTag: 'AY',
  },
  {
    witsId: '0767',
    name: 'Raw Sensor Az',
    mappedField: 'rawSensorAz',
    units: 'g',
    lasTag: 'AZ',
  },
  {
    witsId: '0768',
    name: 'Raw Sensor Mx',
    mappedField: 'rawSensorMx',
    units: 'g',
    lasTag: 'MX',
  },
  {
    witsId: '0769',
    name: 'Raw Sensor My',
    mappedField: 'rawSensorMy',
    units: 'g',
    lasTag: 'MY',
  },
  {
    witsId: '0770',
    name: 'Raw Sensor Mz',
    mappedField: 'rawSensorMz',
    units: 'g',
    lasTag: 'MZ',
  },
  {
    witsId: '0780',
    name: 'Continuous Inclination',
    mappedField: 'continuousInclination',
    units: 'deg',
    lasTag: 'CINC',
  },
  {
    witsId: '0781',
    name: 'Continuous Azimuth',
    mappedField: 'continuousAzimuth',
    units: 'deg',
    lasTag: 'CAZM',
  },
  {
    witsId: '0801',
    name: 'KPWD DPWD',
    mappedField: 'differentialPressure',
    lasTag: 'KDPWD',
  },
  {
    witsId: '0802',
    name: 'KPWD IPWD',
    mappedField: 'mwdPressure',
    lasTag: 'KIPWD',
  },
  {
    witsId: '0803',
    name: 'KPWD APWD',
    mappedField: 'annularPressure',
    lasTag: 'KAPWD',
  },
  {
    witsId: '0823',
    name: 'Gamma',
    mappedField: 'gammaRay',
    units: 'cps',
    lasTag: 'GR',
  },
  {
    witsId: '0824',
    name: 'Gamma API',
    mappedField: 'gammaRay',
    units: 'API',
    decimalPlaces: 0,
    scaleFactor: 1,
    biasOffset: 0,
    sensorToBitSpacing: 37,
    plotScaleLeft: 0,
    plotScaleRight: 150,
    lineColor: '#0000ff',
    wrapColor: '#ff0000',
    depthTrackingMode: 'bit_depth',
    depthTrackingField: 'depth',
    alarmEnabled: false,
    alarmMin: -9999.9,
    alarmMax: 99999.9,
    dataSource: 'serial_port_wits',
    dataInputValue: 70,
    sendToRigWitsPort: true,
    doNotRepeat: false,
    lasTag: 'gamma',
    lasDescription: 'Gamma API reading',
    lasFilter: 0,
  },
  {
    witsId: '0835',
    name: 'Temperature',
    mappedField: 'temperature',
    units: 'C',
    lasTag: 'TEMP',
  },
  {
    witsId: '0836',
    name: 'Temperature',
    mappedField: 'temperature',
    units: 'C',
    lasTag: 'TEMP',
  },
  {
    witsId: '0850',
    name: 'ECD TVD Survey Based',
    mappedField: 'ecdTvd',
    lasTag: 'ECDTVD',
  },
  {
    witsId: '0851',
    name: 'ECD Calculation SG',
    mappedField: 'ecd',
    lasTag: 'ECDSG',
  },
  {
    witsId: '0852',
    name: 'ECD Calculation PPG',
    mappedField: 'ecd2',
    lasTag: 'ECDPPG',
  },
  {
    witsId: '0853',
    name: 'TVD Calc',
    mappedField: 'tvdCalc',
    units: 'm',
    lasTag: 'TVDC',
  },
  {
    witsId: '0888',
    name: 'MWD Pressure',
    mappedField: 'mwdPressure',
    lasTag: 'MWDPRS',
  },
  {
    witsId: '0899',
    name: 'KPWD Bore',
    mappedField: 'borePressure',
    lasTag: 'KBORE',
  },
  { witsId: '0900', name: 'KPWD 2', mappedField: 'kpwd2', lasTag: 'KPWD2' },
  {
    witsId: '0921',
    name: 'Battery Voltage',
    mappedField: 'batteryVoltage',
    units: 'V',
    lasTag: 'BATV',
  },
  {
    witsId: '8916',
    name: 'Magnetic Toolface',
    mappedField: 'magneticToolface',
    units: 'deg',
    lasTag: 'MTF',
  },
  {
    witsId: '8917',
    name: 'Gravity Toolface',
    mappedField: 'gravityToolface',
    units: 'deg',
    lasTag: 'GTF',
  },
  {
    witsId: '9014',
    name: 'Dip Angle',
    mappedField: 'dipAngle',
    units: 'deg',
    lasTag: 'DIPA',
  },
  {
    witsId: '9016',
    name: 'Total Magnetic Field',
    mappedField: 'magneticField',
    units: 'g',
    lasTag: 'BTOT',
  },
  {
    witsId: '9017',
    name: 'Total Gravity Field',
    mappedField: 'totalGravity',
    units: 'g',
    lasTag: 'GTOT',
  },
  {
    witsId: '5717',
    name: 'GTF Relog',
    mappedField: 'gravityToolface',
    units: 'deg',
    lasTag: 'GTF',
  },
  {
    witsId: '5731',
    name: 'Total Gravity Relog',
    mappedField: 'totalGravity',
    units: 'g',
    lasTag: 'GTOT',
  },
  {
    witsId: '5732',
    name: 'Mag Field Relog',
    mappedField: 'magneticField',
    units: 'g',
    lasTag: 'BTOT',
  },
  {
    witsId: '5733',
    name: 'Temperature Relog',
    mappedField: 'temperature',
    units: 'C',
    lasTag: 'TEMP',
  },
  {
    witsId: '5734',
    name: 'Battery Voltage Relog',
    mappedField: 'batteryVoltage',
    units: 'V',
    lasTag: 'BATV',
  },
  {
    witsId: '5735',
    name: 'Battery 2 Relog',
    mappedField: 'battery2OnOff',
    lasTag: 'BAT2',
  },
  {
    witsId: '5757',
    name: 'Pressure - Annular Relog',
    mappedField: 'annularPressure',
    lasTag: 'PANN',
  },
  {
    witsId: '5758',
    name: 'Pressure - Bore Relog',
    mappedField: 'borePressure',
    lasTag: 'PBORE',
  },
  {
    witsId: '5759',
    name: 'Diff Pressure Relog',
    mappedField: 'differentialPressure',
    lasTag: 'DPRES',
  },
  {
    witsId: '5760',
    name: 'Annular Differential Restriction Relog',
    mappedField: 'annularDifferentialPressure',
    lasTag: 'ADP',
  },
  {
    witsId: '5835',
    name: 'Temperature Relog',
    mappedField: 'temperature',
    units: 'C',
    lasTag: 'TEMP',
  },
  {
    witsId: '5836',
    name: 'Temperature Relog',
    mappedField: 'temperature',
    units: 'C',
    lasTag: 'TEMP',
  },
  {
    witsId: '5850',
    name: 'ECD Calculation Relog',
    mappedField: 'ecd',
    lasTag: 'ECD',
  },
  {
    witsId: '5851',
    name: 'ECD Calculation SG Relog',
    mappedField: 'ecd',
    lasTag: 'ECDSG',
  },
  {
    witsId: '5852',
    name: 'ECD Calculation PPG Relog',
    mappedField: 'ecd2',
    lasTag: 'ECDPPG',
  },
  {
    witsId: '5853',
    name: 'TVD Calc Relog',
    mappedField: 'tvdCalc',
    units: 'm',
    lasTag: 'TVDC',
  },
  {
    witsId: '5888',
    name: 'MWD Pressure Relog',
    mappedField: 'mwdPressure',
    lasTag: 'MWDPRS',
  },
  {
    witsId: '6410',
    name: 'Confidence',
    mappedField: 'confidence',
    lasTag: 'CONF',
  },
  {
    witsId: '6411',
    name: 'Pulse Amp',
    mappedField: 'pulseAmplitude',
    lasTag: 'PAMP',
  },
  {
    witsId: '6425',
    name: 'Decoder Pressure',
    mappedField: 'decoderPressure',
    lasTag: 'DECPRS',
  },
  {
    witsId: '6666',
    name: 'TVD CAL CINC',
    mappedField: 'tvdCalc',
    units: 'm',
    lasTag: 'TVDC',
  },
  { witsId: '7777', name: 'AVO', mappedField: 'avo', lasTag: 'AVO' },
  { witsId: '8888', name: 'ECD DD', mappedField: 'ecdDd', lasTag: 'ECDDD' },
  {
    witsId: '9910',
    name: 'Shallow Res',
    mappedField: 'shallowResistivity',
    lasTag: 'RSHAL',
  },
]

const defaultPlotTemplate = {
  name: 'MWD MD 1:500',
  description: 'Default MWD log plot template based on MD 1:500 layout',
  isDefault: true,
  config: {
    title: 'MD 1:500',
    scaleRatio: 500,
    depthPerPage: 150,
    depthStep: 50,
    minorDepthStep: 10,
    page: {
      size: 'a4',
      orientation: 'portrait',
      marginTop: 28,
      marginRight: 22,
      marginBottom: 24,
      marginLeft: 24,
      headerHeightFirstPage: 126,
      headerHeightOtherPages: 18,
      trackHeaderHeight: 172,
    },
    headerFields: [
      { label: 'Company', value: '' },
      { label: 'Well Name', source: 'wellName' },
      { label: 'Field', value: '' },
      { label: 'Rig Id', source: 'rigName' },
      { label: 'Well ID', value: '' },
      { label: 'Job number', value: '' },
      { label: 'Province', value: '' },
      { label: 'County/Parish', value: '' },
      { label: 'Country', value: '' },
      { label: 'Location', value: '' },
      { label: 'Start Date', value: '' },
      { label: 'End Date', value: '' },
    ],
    tracks: [
      {
        title: 'Pressure',
        min: 0,
        max: 4000,
        curves: [
          {
            key: 'annularPressure',
            label: 'Pressure - Annular',
            unit: 'psi',
            min: 0,
            max: 4000,
            color: '#008000',
          },
          {
            key: 'borePressure',
            label: 'Pressure - Bore',
            unit: 'psi',
            min: 0,
            max: 4000,
            color: '#1f77b4',
          },
          {
            key: 'standpipePressure',
            label: 'Pump Press',
            unit: 'PSI',
            min: 0,
            max: 4000,
            color: '#ff7f0e',
          },
          {
            key: 'mwdPressure',
            label: 'APWD - memory',
            unit: '',
            min: 0,
            max: 4000,
            color: '#2ca02c',
          },
        ],
      },
      {
        title: 'Density Depth',
        min: 0,
        max: 2000,
        curves: [
          {
            key: 'mudWeight',
            label: 'Mud Weight (SG)',
            unit: 'SG',
            min: 0,
            max: 2,
            color: '#8c564b',
          },
          {
            key: 'ecd',
            label: 'ECD from Annular Pressure - SG',
            unit: 'SG',
            min: 0,
            max: 2,
            color: '#9467bd',
          },
          {
            key: 'hole_depth',
            label: 'Hole Depth',
            unit: 'm',
            min: 0,
            max: 2000,
            color: '#111111',
          },
          {
            key: 'ecd2',
            label: 'ECD - calc from memory',
            unit: '',
            min: 0,
            max: 2,
            color: '#17becf',
          },
        ],
      },
      {
        title: 'Dynamics',
        min: 0,
        max: 100,
        curves: [
          {
            key: 'shockAxial',
            label: 'Shock (ax,lat)',
            unit: 'g',
            min: 0,
            max: 90,
            color: '#d62728',
          },
          {
            key: 'vibrationAxial',
            label: 'Vib (ax,lat)',
            unit: 'g',
            min: 0,
            max: 25,
            color: '#2ca02c',
          },
          {
            key: 'ssi',
            label: 'SSI',
            unit: '',
            min: 0,
            max: 5,
            color: '#17becf',
          },
          {
            key: 'downholeRpm',
            label: 'RPM Downhole',
            unit: 'rpm',
            min: 0,
            max: 100,
            color: '#bcbd22',
          },
          {
            key: 'temperature',
            label: 'Temp',
            unit: 'C',
            min: 0,
            max: 100,
            color: '#e377c2',
          },
        ],
      },
      {
        title: 'Surface',
        min: 0,
        max: 30,
        curves: [
          {
            key: 'rop',
            label: 'ROP',
            unit: '',
            min: 0,
            max: 10,
            color: '#7f7f7f',
          },
          {
            key: 'hookLoad',
            label: 'WOB',
            unit: 'klbs',
            min: 0,
            max: 20,
            color: '#aec7e8',
          },
          {
            key: 'hookPosition',
            label: 'hookpos',
            unit: 'm',
            min: 0,
            max: 30,
            color: '#ff7f0e',
          },
        ],
      },
    ],
  },
}

const normalizeRoleName = (value) => {
  if (typeof value !== 'string') {
    return ''
  }

  const normalized = value.trim().toLowerCase()

  if (normalized === 'user') {
    return 'operator'
  }

  return normalized
}

const syncSystemRoles = async () => {
  const existingRoles = await prisma.role.findMany({
    orderBy: { id: 'asc' },
    select: {
      id: true,
      name: true,
    },
  })

  const groupedRoles = new Map()

  for (const role of existingRoles) {
    const canonicalRoleName = normalizeRoleName(role.name)

    if (!systemRoles.includes(canonicalRoleName)) {
      continue
    }

    const existingGroup = groupedRoles.get(canonicalRoleName) ?? []
    existingGroup.push(role)
    groupedRoles.set(canonicalRoleName, existingGroup)
  }

  for (const roleName of systemRoles) {
    const matchingRoles = groupedRoles.get(roleName) ?? []

    if (matchingRoles.length === 0) {
      await prisma.role.create({
        data: { name: roleName },
      })
      continue
    }

    let canonicalRole =
      matchingRoles.find((role) => role.name === roleName) ?? matchingRoles[0]

    if (canonicalRole.name !== roleName) {
      canonicalRole = await prisma.role.update({
        where: { id: canonicalRole.id },
        data: { name: roleName },
        select: {
          id: true,
          name: true,
        },
      })
    }

    for (const duplicateRole of matchingRoles) {
      if (duplicateRole.id === canonicalRole.id) {
        continue
      }

      await prisma.user.updateMany({
        where: { roleId: duplicateRole.id },
        data: { roleId: canonicalRole.id },
      })

      await prisma.role.delete({
        where: { id: duplicateRole.id },
      })
    }
  }
}

const syncDefaultWitsConfigs = async () => {
  for (const config of defaultWitsConfigs) {
    const updateData = {
      name: config.name,
      units: config.units ?? null,
      mappedField: config.mappedField ?? null,
      lasTag: config.lasTag ?? null,
      enableLogging: config.enableLogging ?? true,
    }

    for (const fieldName of [
      'decimalPlaces',
      'scaleFactor',
      'biasOffset',
      'sensorToBitSpacing',
      'plotScaleLeft',
      'plotScaleRight',
      'lineColor',
      'wrapColor',
      'depthTrackingMode',
      'depthTrackingField',
      'alarmEnabled',
      'alarmMin',
      'alarmMax',
      'dataSource',
      'dataInputValue',
      'sendToRigWitsPort',
      'doNotRepeat',
      'lasDescription',
      'lasFilter',
    ]) {
      if (Object.prototype.hasOwnProperty.call(config, fieldName)) {
        updateData[fieldName] = config[fieldName]
      }
    }

    await prisma.witsConfig.upsert({
      where: { witsId: config.witsId },
      update: updateData,
      create: {
        ...config,
        decimalPlaces: config.decimalPlaces ?? 2,
        scaleFactor: config.scaleFactor ?? 1,
        biasOffset: config.biasOffset ?? 0,
        enableLogging: config.enableLogging ?? true,
        dataSource: config.dataSource ?? 'serial_port_wits',
      },
    })
  }
}

const syncDefaultPlotTemplate = async () => {
  await prisma.plotTemplate.upsert({
    where: { name: defaultPlotTemplate.name },
    update: {
      description: defaultPlotTemplate.description,
      config: defaultPlotTemplate.config,
      isDefault: defaultPlotTemplate.isDefault,
    },
    create: defaultPlotTemplate,
  })
}

async function main() {
  await syncSystemRoles()

  const adminRole = await prisma.role.findUnique({
    where: { name: 'admin' },
  })
  const engineerRole = await prisma.role.findUnique({
    where: { name: 'engineer' },
  })

  if (!adminRole || !engineerRole) {
    throw new Error('System roles were not created successfully')
  }

  const adminUsername = process.env.ADMIN_USERNAME ?? 'admin'
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@example.com'
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin12345'
  const engineerUsername = process.env.ENGINEER_USERNAME ?? 'engineer'
  const engineerEmail = process.env.ENGINEER_EMAIL ?? 'engineer@example.com'
  const engineerPassword = process.env.ENGINEER_PASSWORD ?? 'engineer12345'
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10)
  const engineerPasswordHash = await bcrypt.hash(engineerPassword, 10)

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      username: adminUsername,
      roleId: adminRole.id,
      passwordHash: adminPasswordHash,
      isActive: true,
    },
    create: {
      roleId: adminRole.id,
      username: adminUsername,
      email: adminEmail,
      passwordHash: adminPasswordHash,
      isActive: true,
    },
  })

  await prisma.user.upsert({
    where: { email: engineerEmail },
    update: {
      username: engineerUsername,
      roleId: engineerRole.id,
      passwordHash: engineerPasswordHash,
      isActive: true,
    },
    create: {
      roleId: engineerRole.id,
      username: engineerUsername,
      email: engineerEmail,
      passwordHash: engineerPasswordHash,
      isActive: true,
    },
  })

  await syncDefaultWitsConfigs()
  await syncDefaultPlotTemplate()
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
