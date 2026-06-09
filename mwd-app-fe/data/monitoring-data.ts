import {
  LogDataRecord,
  PortStatus,
  SurveyInputSummary,
  SurveyRecord,
  SurveyStorageConfig,
  WitsPacketLog,
} from "@/types/monitoring";
import { decodeWitsPacket, getWitsDescription, getWitsLabel } from "@/lib/wits-map";

function isoMinutesAgo(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

function buildPacketLog(
  id: string,
  rawPacket: string,
  timestamp: string,
  source: string,
  port: string
): WitsPacketLog {
  const decoded = decodeWitsPacket(rawPacket);

  return {
    id,
    timestamp,
    source,
    port,
    rawPacket,
    witsId: decoded?.witsId ?? "----",
    rawValue: decoded?.rawValue ?? rawPacket,
    parsedValue: decoded?.parsedValue ?? "Unparsed packet",
    label: decoded?.label ?? "Unknown WITS ID",
    description: decoded?.description ?? "Packet does not match supported WITS format",
  };
}

export const defaultRigPortStatus: PortStatus = "Open";
export const defaultAuxPortStatus: PortStatus = "Open";

export const mockRigWitsReceivedPackets: WitsPacketLog[] = [
  buildPacketLog("rig-rx-1", "0110 3847.5", isoMinutesAgo(1), "Rig pump room", "COM-RT-12"),
  buildPacketLog("rig-rx-2", "0113 28.6", isoMinutesAgo(2), "Rig WITS feed", "COM-RT-12"),
  buildPacketLog("rig-rx-3", "0713 32.40", isoMinutesAgo(3), "MWD survey relay", "COM-RT-12"),
  buildPacketLog("rig-rx-4", "0714,247.80", isoMinutesAgo(4), "MWD survey relay", "COM-RT-12"),
  buildPacketLog("rig-rx-5", "0121-3250.0", isoMinutesAgo(5), "Rig hydraulics", "COM-RT-12"),
  buildPacketLog("rig-rx-6", "0130 845.0", isoMinutesAgo(6), "Rig hydraulics", "COM-RT-12"),
];

export const mockRigWitsTransmittedPackets: WitsPacketLog[] = [
  buildPacketLog("rig-tx-1", "0824,26.45", isoMinutesAgo(2), "Decoder output", "TCP 10.20.0.14"),
  buildPacketLog("rig-tx-2", "0836-9999.0", isoMinutesAgo(4), "Decoder output", "TCP 10.20.0.14"),
  buildPacketLog("rig-tx-3", "6410 92.4", isoMinutesAgo(7), "Quality control", "TCP 10.20.0.14"),
];

export const mockAuxPortReceivedPackets: WitsPacketLog[] = [
  buildPacketLog("aux-rx-1", "0836-9999.0", isoMinutesAgo(1), "Aux decoder", "AUX-1"),
  buildPacketLog("aux-rx-2", "0716 178.2", isoMinutesAgo(2), "Directional package", "AUX-1"),
  buildPacketLog("aux-rx-3", "0717 207.53", isoMinutesAgo(3), "Directional package", "AUX-1"),
  buildPacketLog("aux-rx-4", "0823 84.1", isoMinutesAgo(4), "Gamma sub", "AUX-1"),
  buildPacketLog("aux-rx-5", "0824,26.45", isoMinutesAgo(5), "Gamma correction", "AUX-1"),
  buildPacketLog("aux-rx-6", "0921 28.6", isoMinutesAgo(6), "Battery monitor", "AUX-1"),
];

export const mockAuxPortTransmittedPackets: WitsPacketLog[] = [
  buildPacketLog("aux-tx-1", "9015 2", isoMinutesAgo(6), "Aux forwarder", "AUX-TX"),
  buildPacketLog("aux-tx-2", "6411 68.5", isoMinutesAgo(8), "Aux forwarder", "AUX-TX"),
];

export const mockSurveyInputSummary: SurveyInputSummary = {
  md: 3847.5,
  inc: 32.4,
  azm: 247.8,
  tvd: 3679.2,
  ns: -512.3,
  ew: -775.4,
  dls: 2.1,
  vs: -923.8,
  toolfaceMode: "Gravity",
};

export const mockSurveyRecords: SurveyRecord[] = [
  {
    id: "survey-1",
    md: 3847.5,
    inc: 32.4,
    azm: 247.8,
    tvd: 3679.2,
    ns: -512.3,
    ew: -775.4,
    dls: 2.1,
    vs: -923.8,
    toolfaceMode: "Gravity",
    timestamp: isoMinutesAgo(5),
    isProjection: false,
  },
  {
    id: "survey-2",
    md: 3795,
    inc: 32,
    azm: 247.2,
    tvd: 3635.1,
    ns: -498.2,
    ew: -752.7,
    dls: 1.9,
    vs: -896.6,
    toolfaceMode: "Gravity",
    timestamp: isoMinutesAgo(65),
    isProjection: false,
  },
  {
    id: "survey-3",
    md: 3740,
    inc: 31.5,
    azm: 246.4,
    tvd: 3589.8,
    ns: -483.1,
    ew: -729.1,
    dls: 1.8,
    vs: -868.9,
    toolfaceMode: "Magnetic",
    timestamp: isoMinutesAgo(125),
    isProjection: false,
  },
];

export const mockSurveyStorageConfig: SurveyStorageConfig = {
  columnLabels: {
    md: "Measured Depth",
    inc: "Inclination",
    azm: "Azimuth",
    tvd: "True Vertical Depth",
    ns: "North/South",
    ew: "East/West",
    dls: "Dogleg Severity",
    vs: "Vertical Section",
  },
  userDefinedInput: "Motor yield, slide quality, survey verifier initials",
  captureRigWits: true,
  captureAuxDecoded: true,
  captureToolfaceMode: true,
};

export const mockLogDataRecords: LogDataRecord[] = [
  {
    id: "log-1",
    witsId: "0824",
    label: getWitsLabel("0824"),
    depth: 3810,
    value: 25.9,
    timestamp: isoMinutesAgo(55),
    hidden: false,
    source: "Rig WITS",
    notes: "Corrected gamma sweep",
  },
  {
    id: "log-2",
    witsId: "0824",
    label: getWitsLabel("0824"),
    depth: 3825,
    value: 26.2,
    timestamp: isoMinutesAgo(43),
    hidden: false,
    source: "Rig WITS",
  },
  {
    id: "log-3",
    witsId: "0824",
    label: getWitsLabel("0824"),
    depth: 3840,
    value: 26.45,
    timestamp: isoMinutesAgo(31),
    hidden: false,
    source: "Rig WITS",
  },
  {
    id: "log-4",
    witsId: "0716",
    label: getWitsLabel("0716"),
    depth: 3810,
    value: 177.3,
    timestamp: isoMinutesAgo(48),
    hidden: false,
    source: "Aux Port",
    notes: getWitsDescription("0716"),
  },
  {
    id: "log-5",
    witsId: "0716",
    label: getWitsLabel("0716"),
    depth: 3825,
    value: 178.1,
    timestamp: isoMinutesAgo(36),
    hidden: false,
    source: "Aux Port",
  },
  {
    id: "log-6",
    witsId: "0717",
    label: getWitsLabel("0717"),
    depth: 3810,
    value: 206.8,
    timestamp: isoMinutesAgo(44),
    hidden: false,
    source: "Aux Port",
  },
  {
    id: "log-7",
    witsId: "0717",
    label: getWitsLabel("0717"),
    depth: 3825,
    value: 207.53,
    timestamp: isoMinutesAgo(33),
    hidden: true,
    source: "Aux Port",
  },
  {
    id: "log-8",
    witsId: "0921",
    label: getWitsLabel("0921"),
    depth: 3810,
    value: 28.3,
    timestamp: isoMinutesAgo(40),
    hidden: false,
    source: "Decoder",
  },
  {
    id: "log-9",
    witsId: "0921",
    label: getWitsLabel("0921"),
    depth: 3840,
    value: 28.6,
    timestamp: isoMinutesAgo(20),
    hidden: false,
    source: "Decoder",
  },
];
