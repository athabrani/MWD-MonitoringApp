export type MWDMeasurementInput = {
    toolRunTime?: number | string | null;
    slideIndicator?: number | string | null;
    depthMd?: number | string | null;
    hole_depth?: number | string | null;
    inclination?: number | string | null;
    continuousInclination?: number | string | null;
    azimuth?: number | string | null;
    continuousAzimuth?: number | string | null;
    verticalSection?: number | string | null;
    rawSensorAx?: number | string | null;
    rawSensorAy?: number | string | null;
    rawSensorAz?: number | string | null;
    rawSensorMx?: number | string | null;
    rawSensorMy?: number | string | null;
    rawSensorMz?: number | string | null;
    magneticToolface?: number | string | null;
    gravityToolface?: number | string | null;
    totalGravity?: number | string | null;
    dipAngle?: number | string | null;
    magneticField?: number | string | null;
    gammaRay?: number | string | null;
    temperature?: number | string | null;
    batteryVoltage?: number | string | null;
    battery2OnOff?: number | string | null;
    rotationSpeed?: number | string | null;
    downholeRpm?: number | string | null;
    rotaryTorque?: number | string | null;
    shock?: number | string | null;
    shockAxial?: number | string | null;
    shockLateral?: number | string | null;
    vibration?: number | string | null;
    vibrationAxial?: number | string | null;
    vibrationLateral?: number | string | null;
    genericVariable0?: number | string | null;
    genericVariable1?: number | string | null;
    genericVariable2?: number | string | null;
    genericVariable3?: number | string | null;
    genericVariable4?: number | string | null;
    genericVariable5?: number | string | null;
    genericVariable6?: number | string | null;
    genericVariable7?: number | string | null;
    rop?: number | string | null;
    hookLoad?: number | string | null;
    hookPosition?: number | string | null;
    standpipePressure?: number | string | null;
    flowOut?: number | string | null;
    flowIn?: number | string | null;
    gasAverage?: number | string | null;
    annularPressure?: number | string | null;
    borePressure?: number | string | null;
    mwdPressure?: number | string | null;
    kpwd2?: number | string | null;
    differentialPressure?: number | string | null;
    annularDifferentialPressure?: number | string | null;
    mudWeight?: number | string | null;
    ecd?: number | string | null;
    ecd2?: number | string | null;
    ecdTvd?: number | string | null;
    ecdDd?: number | string | null;
    ssi?: number | string | null;
    tvdCalc?: number | string | null;
    confidence?: number | string | null;
    pulseAmplitude?: number | string | null;
    decoderPressure?: number | string | null;
    avo?: number | string | null;
    shallowResistivity?: number | string | null;
};
export type MeasurementField = keyof MWDMeasurementInput;
export type ParsedMeasurementFields = {
    [Field in MeasurementField]: {
        provided: boolean;
        value: number | string | null | undefined;
    };
};
export type WitsMeasurementDefinition = {
    field: MeasurementField;
    measurement: string;
    pulseWord?: string;
    witsId?: string;
    units?: string;
    priority?: number;
};
export declare const MWD_MEASUREMENT_FIELDS: readonly ["toolRunTime", "slideIndicator", "depthMd", "hole_depth", "inclination", "continuousInclination", "azimuth", "continuousAzimuth", "verticalSection", "rawSensorAx", "rawSensorAy", "rawSensorAz", "rawSensorMx", "rawSensorMy", "rawSensorMz", "magneticToolface", "gravityToolface", "totalGravity", "dipAngle", "magneticField", "gammaRay", "temperature", "batteryVoltage", "battery2OnOff", "rotationSpeed", "downholeRpm", "rotaryTorque", "shock", "shockAxial", "shockLateral", "vibration", "vibrationAxial", "vibrationLateral", "genericVariable0", "genericVariable1", "genericVariable2", "genericVariable3", "genericVariable4", "genericVariable5", "genericVariable6", "genericVariable7", "rop", "hookLoad", "hookPosition", "standpipePressure", "flowOut", "flowIn", "gasAverage", "annularPressure", "borePressure", "mwdPressure", "kpwd2", "differentialPressure", "annularDifferentialPressure", "mudWeight", "ecd", "ecd2", "ecdTvd", "ecdDd", "ssi", "tvdCalc", "confidence", "pulseAmplitude", "decoderPressure", "avo", "shallowResistivity"];
export declare const WITS_RECEIVED_MEASUREMENT_DEFINITIONS: readonly [{
    readonly field: "toolRunTime";
    readonly measurement: "Tool Run Time";
    readonly witsId: "0010";
}, {
    readonly field: "slideIndicator";
    readonly measurement: "Slide Indicator";
    readonly witsId: "0012";
}, {
    readonly field: "hole_depth";
    readonly measurement: "Hole Depth";
    readonly witsId: "0110";
    readonly priority: 0;
}, {
    readonly field: "depthMd";
    readonly measurement: "Bit Depth";
    readonly witsId: "0108";
    readonly priority: 1;
}, {
    readonly field: "rop";
    readonly measurement: "Rate of Penetration";
    readonly witsId: "0113";
}, {
    readonly field: "hookPosition";
    readonly measurement: "Hook Position";
    readonly witsId: "0112";
}, {
    readonly field: "hookLoad";
    readonly measurement: "Weight on Bit";
    readonly witsId: "0117";
}, {
    readonly field: "rotaryTorque";
    readonly measurement: "Rotary Torque";
    readonly witsId: "0119";
}, {
    readonly field: "rotationSpeed";
    readonly measurement: "Rotary Speed";
    readonly witsId: "0120";
    readonly units: "rpm";
}, {
    readonly field: "standpipePressure";
    readonly measurement: "Pump Pressure";
    readonly witsId: "0121";
}, {
    readonly field: "flowOut";
    readonly measurement: "Flow Out";
    readonly witsId: "0128";
}, {
    readonly field: "flowIn";
    readonly measurement: "Flow In";
    readonly witsId: "0130";
}, {
    readonly field: "gasAverage";
    readonly measurement: "Gas Avg";
    readonly witsId: "0140";
}, {
    readonly field: "mudWeight";
    readonly measurement: "Mud Weight";
    readonly witsId: "0150";
}, {
    readonly field: "tvdCalc";
    readonly measurement: "TVD";
    readonly witsId: "0709";
    readonly units: "m";
}, {
    readonly field: "inclination";
    readonly measurement: "Inclination";
    readonly witsId: "0713";
    readonly units: "degrees (°)";
}, {
    readonly field: "azimuth";
    readonly measurement: "Azimuth";
    readonly witsId: "0715";
    readonly units: "degrees (°)";
    readonly priority: 0;
}, {
    readonly field: "continuousInclination";
    readonly measurement: "Continuous Inclination";
    readonly witsId: "0780";
    readonly units: "degrees (°)";
}, {
    readonly field: "continuousAzimuth";
    readonly measurement: "Continuous Azimuth";
    readonly witsId: "0781";
    readonly units: "degrees (°)";
}, {
    readonly field: "totalGravity";
    readonly measurement: "Total Gravity Field (Sharewell)";
    readonly witsId: "0142";
    readonly units: "g";
}, {
    readonly field: "magneticField";
    readonly measurement: "Total Magnetic Field (Sharewell)";
    readonly witsId: "0143";
    readonly units: "g";
}, {
    readonly field: "dipAngle";
    readonly measurement: "Dip Angle (Sharewell)";
    readonly witsId: "0145";
    readonly units: "degrees (°)";
}, {
    readonly field: "vibration";
    readonly measurement: "Vibration (Sharewell)";
    readonly witsId: "0146";
    readonly units: "g";
}, {
    readonly field: "azimuth";
    readonly measurement: "Azimuth";
    readonly witsId: "0714";
    readonly units: "degrees (°)";
    readonly priority: 1;
}, {
    readonly field: "dipAngle";
    readonly measurement: "Dip Angle";
    readonly witsId: "0722";
    readonly units: "degrees (°)";
}, {
    readonly field: "verticalSection";
    readonly measurement: "Vertical Section";
    readonly witsId: "0723";
    readonly units: "m";
}, {
    readonly field: "batteryVoltage";
    readonly measurement: "Battery Voltage (GUIDE)";
    readonly witsId: "0724";
    readonly units: "volts";
}, {
    readonly field: "magneticField";
    readonly measurement: "Total Magnetic Field";
    readonly witsId: "0725";
    readonly units: "g";
}, {
    readonly field: "totalGravity";
    readonly measurement: "Total Gravity Field";
    readonly witsId: "0726";
    readonly units: "g";
}, {
    readonly field: "dipAngle";
    readonly measurement: "Dip Angle";
    readonly witsId: "0728";
    readonly units: "degrees (°)";
}, {
    readonly field: "temperature";
    readonly measurement: "Temperature";
    readonly witsId: "0733";
    readonly units: "C";
}, {
    readonly field: "batteryVoltage";
    readonly measurement: "Battery Voltage (TolTech)";
    readonly witsId: "0734";
    readonly units: "volts";
}, {
    readonly field: "gammaRay";
    readonly measurement: "Gamma Corrected";
    readonly witsId: "0824";
}, {
    readonly field: "batteryVoltage";
    readonly measurement: "Battery Voltage (Keydrill)";
    readonly witsId: "0921";
    readonly units: "volts";
}, {
    readonly field: "differentialPressure";
    readonly measurement: "KPWD DPWD";
    readonly witsId: "0801";
}, {
    readonly field: "mwdPressure";
    readonly measurement: "KPWD IPWD";
    readonly witsId: "0802";
}, {
    readonly field: "annularPressure";
    readonly measurement: "KPWD APWD";
    readonly witsId: "0803";
}, {
    readonly field: "temperature";
    readonly measurement: "Temperature";
    readonly witsId: "0835";
    readonly units: "C";
}, {
    readonly field: "temperature";
    readonly measurement: "Temperature";
    readonly witsId: "0836";
    readonly units: "C";
}, {
    readonly field: "ecdTvd";
    readonly measurement: "ECD TVD Survey Based";
    readonly witsId: "0850";
}, {
    readonly field: "ecd";
    readonly measurement: "ECD Calculation SG";
    readonly witsId: "0851";
}, {
    readonly field: "ecd2";
    readonly measurement: "ECD Calculation PPG";
    readonly witsId: "0852";
}, {
    readonly field: "tvdCalc";
    readonly measurement: "TVD Calc";
    readonly witsId: "0853";
}, {
    readonly field: "mwdPressure";
    readonly measurement: "MWD Pressure";
    readonly witsId: "0888";
}, {
    readonly field: "borePressure";
    readonly measurement: "KPWD Bore";
    readonly witsId: "0899";
}, {
    readonly field: "kpwd2";
    readonly measurement: "KPWD 2";
    readonly witsId: "0900";
}, {
    readonly field: "magneticToolface";
    readonly measurement: "Magnetic Toolface (Extreme)";
    readonly witsId: "8916";
    readonly units: "degrees (°)";
}, {
    readonly field: "gravityToolface";
    readonly measurement: "Gravity Toolface (Extreme)";
    readonly witsId: "8917";
    readonly units: "degrees (°)";
}, {
    readonly field: "dipAngle";
    readonly measurement: "Dip Angle (Extreme)";
    readonly witsId: "9014";
    readonly units: "degrees (°)";
}, {
    readonly field: "magneticField";
    readonly measurement: "Total Magnetic Field (Extreme)";
    readonly witsId: "9016";
    readonly units: "g";
}, {
    readonly field: "totalGravity";
    readonly measurement: "Total Gravity Field (Extreme)";
    readonly witsId: "9017";
    readonly units: "g";
}, {
    readonly field: "gravityToolface";
    readonly measurement: "GTF Relog";
    readonly witsId: "5717";
    readonly units: "degrees (°)";
}, {
    readonly field: "totalGravity";
    readonly measurement: "Total Gravity Relog";
    readonly witsId: "5731";
    readonly units: "g";
}, {
    readonly field: "magneticField";
    readonly measurement: "Mag Field Relog";
    readonly witsId: "5732";
    readonly units: "g";
}, {
    readonly field: "temperature";
    readonly measurement: "Temperature Relog";
    readonly witsId: "5733";
    readonly units: "C";
}, {
    readonly field: "batteryVoltage";
    readonly measurement: "Battery Voltage Relog";
    readonly witsId: "5734";
    readonly units: "volts";
}, {
    readonly field: "battery2OnOff";
    readonly measurement: "Battery 2 Relog";
    readonly witsId: "5735";
}, {
    readonly field: "annularPressure";
    readonly measurement: "Pressure - Annular Relog";
    readonly witsId: "5757";
}, {
    readonly field: "borePressure";
    readonly measurement: "Pressure - Bore Relog";
    readonly witsId: "5758";
}, {
    readonly field: "differentialPressure";
    readonly measurement: "Diff Pressure Relog";
    readonly witsId: "5759";
}, {
    readonly field: "annularDifferentialPressure";
    readonly measurement: "Annular Differential Restriction Relog";
    readonly witsId: "5760";
}, {
    readonly field: "temperature";
    readonly measurement: "Temperature Relog";
    readonly witsId: "5835";
    readonly units: "C";
}, {
    readonly field: "temperature";
    readonly measurement: "Temperature Relog";
    readonly witsId: "5836";
    readonly units: "C";
}, {
    readonly field: "ecd";
    readonly measurement: "ECD Calculation Relog";
    readonly witsId: "5850";
}, {
    readonly field: "ecd";
    readonly measurement: "ECD Calculation SG Relog";
    readonly witsId: "5851";
}, {
    readonly field: "ecd2";
    readonly measurement: "ECD Calculation PPG Relog";
    readonly witsId: "5852";
}, {
    readonly field: "tvdCalc";
    readonly measurement: "TVD Calc Relog";
    readonly witsId: "5853";
}, {
    readonly field: "mwdPressure";
    readonly measurement: "MWD Pressure Relog";
    readonly witsId: "5888";
}, {
    readonly field: "confidence";
    readonly measurement: "Confidence";
    readonly witsId: "6410";
}, {
    readonly field: "pulseAmplitude";
    readonly measurement: "Pulse Amp";
    readonly witsId: "6411";
}, {
    readonly field: "decoderPressure";
    readonly measurement: "Decoder Pressure";
    readonly witsId: "6425";
}, {
    readonly field: "tvdCalc";
    readonly measurement: "TVD CAL CINC";
    readonly witsId: "6666";
}, {
    readonly field: "avo";
    readonly measurement: "AVO";
    readonly witsId: "7777";
}, {
    readonly field: "ecdDd";
    readonly measurement: "ECD DD";
    readonly witsId: "8888";
}, {
    readonly field: "shallowResistivity";
    readonly measurement: "Shallow Res";
    readonly witsId: "9910";
}];
export declare const WITS_SENT_MEASUREMENT_DEFINITIONS: readonly [{
    readonly field: "inclination";
    readonly measurement: "Inclination";
    readonly pulseWord: "Inc";
    readonly witsId: "0713";
    readonly units: "degrees (°)";
}, {
    readonly field: "continuousInclination";
    readonly measurement: "Continuous Inclination";
    readonly pulseWord: "cINC";
    readonly witsId: "0780";
    readonly units: "degrees (°)";
}, {
    readonly field: "azimuth";
    readonly measurement: "Azimuth";
    readonly pulseWord: "Azm";
    readonly witsId: "0715";
    readonly units: "degrees (°)";
}, {
    readonly field: "continuousAzimuth";
    readonly measurement: "Continuous Azimuth";
    readonly pulseWord: "cAZM";
    readonly witsId: "0781";
    readonly units: "degrees (°)";
}, {
    readonly field: "rawSensorAx";
    readonly measurement: "Raw Sensor - Ax";
    readonly pulseWord: "Axs";
    readonly witsId: "0765";
    readonly units: "g";
}, {
    readonly field: "rawSensorAy";
    readonly measurement: "Raw Sensor - Ay";
    readonly pulseWord: "Ays";
    readonly witsId: "0766";
    readonly units: "g";
}, {
    readonly field: "rawSensorAz";
    readonly measurement: "Raw Sensor - Az";
    readonly pulseWord: "Azs";
    readonly witsId: "0767";
    readonly units: "g";
}, {
    readonly field: "rawSensorMx";
    readonly measurement: "Raw Sensor - Mx";
    readonly pulseWord: "Mxs";
    readonly witsId: "0768";
    readonly units: "g";
}, {
    readonly field: "rawSensorMy";
    readonly measurement: "Raw Sensor - My";
    readonly pulseWord: "Mys";
    readonly witsId: "0769";
    readonly units: "g";
}, {
    readonly field: "rawSensorMz";
    readonly measurement: "Raw Sensor - Mz";
    readonly pulseWord: "Mzs";
    readonly witsId: "0770";
    readonly units: "g";
}, {
    readonly field: "magneticToolface";
    readonly measurement: "Magnetic Toolface";
    readonly pulseWord: "mTFA";
    readonly witsId: "0716";
    readonly units: "degrees (°)";
}, {
    readonly field: "gravityToolface";
    readonly measurement: "Gravity Toolface";
    readonly pulseWord: "gTFA";
    readonly witsId: "0717";
    readonly units: "degrees (°)";
}, {
    readonly field: "totalGravity";
    readonly measurement: "Total Gravity";
    readonly pulseWord: "Grav";
    readonly witsId: "0731";
    readonly units: "g";
}, {
    readonly field: "dipAngle";
    readonly measurement: "Dip Angle";
    readonly pulseWord: "DipA";
    readonly witsId: "0730";
    readonly units: "degrees (°)";
}, {
    readonly field: "magneticField";
    readonly measurement: "Magnetic Field";
    readonly pulseWord: "MagFt";
    readonly witsId: "0732";
    readonly units: "g";
}, {
    readonly field: "gammaRay";
    readonly measurement: "Gamma";
    readonly pulseWord: "Gama";
    readonly witsId: "0823";
    readonly units: "cps";
}, {
    readonly field: "batteryVoltage";
    readonly measurement: "Battery Voltage";
    readonly pulseWord: "BatV";
    readonly witsId: "0724";
    readonly units: "volts";
}, {
    readonly field: "battery2OnOff";
    readonly measurement: "Battery 2 On/Off";
    readonly pulseWord: "Bat2";
    readonly witsId: "0735";
}, {
    readonly field: "downholeRpm";
    readonly measurement: "RPM Downhole";
    readonly pulseWord: "rpm";
    readonly witsId: "0738";
    readonly units: "rpm";
}, {
    readonly field: "shock";
    readonly measurement: "Shock";
    readonly pulseWord: "SHK1";
    readonly witsId: "0736";
    readonly units: "g";
}, {
    readonly field: "shockAxial";
    readonly measurement: "Shock Axial";
    readonly pulseWord: "SHK1";
    readonly witsId: "0736";
    readonly units: "g";
}, {
    readonly field: "vibration";
    readonly measurement: "Vibration";
    readonly pulseWord: "VIB1";
    readonly witsId: "0737";
    readonly units: "g";
}, {
    readonly field: "vibrationAxial";
    readonly measurement: "Vibration Axial";
    readonly pulseWord: "VIB1";
    readonly witsId: "0737";
    readonly units: "g";
}, {
    readonly field: "annularPressure";
    readonly measurement: "Pressure - Annular";
    readonly pulseWord: "PAnn";
    readonly witsId: "0757";
}, {
    readonly field: "borePressure";
    readonly measurement: "Pressure - Bore";
    readonly pulseWord: "PBore";
    readonly witsId: "0758";
}, {
    readonly field: "differentialPressure";
    readonly measurement: "Diff Pressure";
    readonly pulseWord: "DP";
    readonly witsId: "0759";
}, {
    readonly field: "annularDifferentialPressure";
    readonly measurement: "Annular Differential Restriction";
    readonly pulseWord: "ADP";
    readonly witsId: "0760";
}, {
    readonly field: "genericVariable4";
    readonly measurement: "Generic Variable";
    readonly pulseWord: "GV4";
    readonly witsId: "0761";
}, {
    readonly field: "genericVariable5";
    readonly measurement: "Generic Variable";
    readonly pulseWord: "GV5";
    readonly witsId: "0762";
}, {
    readonly field: "genericVariable6";
    readonly measurement: "Generic Variable";
    readonly pulseWord: "GV6";
    readonly witsId: "0763";
}, {
    readonly field: "genericVariable7";
    readonly measurement: "Generic Variable";
    readonly pulseWord: "GV7";
    readonly witsId: "0764";
}];
export declare const normalizeWitsId: (value: unknown) => string | null;
export declare const formatWitsId: (witsId: string) => string;
export declare const collectWitsValues: (source: Record<string, unknown>) => Map<string, unknown>;
export declare const parseMeasurementFields: (source: Record<string, unknown>) => {
    error: string;
    parsedFields?: never;
} | {
    parsedFields: ParsedMeasurementFields;
    error?: never;
};
export declare const applyMeasurementFields: (target: MWDMeasurementInput, parsedFields: ParsedMeasurementFields) => void;
//# sourceMappingURL=mwd-measurements.d.ts.map