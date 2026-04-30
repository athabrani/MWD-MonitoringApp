export interface WitsDictionaryEntry {
  id: string;
  label: string;
  description: string;
  unit?: string;
}

export interface DecodedWitsPacket {
  witsId: string;
  label: string;
  description: string;
  value: number | null;
  rawValue: string;
  parsedValue: string;
  rawPacket: string;
}

const entries: WitsDictionaryEntry[] = [
  { id: "0108", label: "Bit depth", description: "Current bit depth", unit: "m" },
  { id: "0110", label: "Hole depth", description: "Measured hole depth", unit: "m" },
  { id: "0113", label: "ROP", description: "Rate of penetration", unit: "m/hr" },
  { id: "0117", label: "WOB", description: "Weight on bit", unit: "klbs" },
  { id: "0121", label: "Pump pressure", description: "Standpipe or pump pressure", unit: "psi" },
  { id: "0130", label: "Flow in", description: "Flow in to the drill string", unit: "gpm" },
  { id: "0140", label: "Total gas average", description: "Average total gas reading", unit: "unit" },
  { id: "0713", label: "Inclination", description: "Survey inclination", unit: "deg" },
  { id: "0714", label: "Azimuth", description: "Survey azimuth", unit: "deg" },
  { id: "0716", label: "Magnetic tool face", description: "Magnetic toolface angle", unit: "deg" },
  { id: "0717", label: "Gravity tool face", description: "Gravity toolface angle", unit: "deg" },
  { id: "0720", label: "DLS", description: "Dogleg severity", unit: "deg/30m" },
  { id: "0728", label: "Dip angle", description: "Formation dip angle", unit: "deg" },
  { id: "0815", label: "Resistivity 1", description: "Primary resistivity curve", unit: "ohm.m" },
  { id: "0819", label: "Resistivity 2", description: "Secondary resistivity curve", unit: "ohm.m" },
  { id: "0823", label: "Gamma raw", description: "Raw gamma measurement", unit: "API" },
  { id: "0824", label: "Gamma corrected", description: "Corrected gamma measurement", unit: "API" },
  { id: "0835", label: "Temperature", description: "Tool temperature reading", unit: "degF" },
  { id: "0836", label: "Temperature", description: "Auxiliary temperature reading", unit: "degF" },
  { id: "0921", label: "Battery voltage", description: "Battery voltage", unit: "V" },
  { id: "6410", label: "Average confidence factor", description: "Decoder confidence factor", unit: "%" },
  { id: "6411", label: "Average signal amplitude", description: "Average signal amplitude", unit: "amp" },
  { id: "6425", label: "Decoder pressure", description: "Decoder internal pressure", unit: "psi" },
  { id: "8916", label: "Magnetic toolface", description: "Mapped magnetic toolface", unit: "deg" },
  { id: "8917", label: "Gravity toolface", description: "Mapped gravity toolface", unit: "deg" },
  { id: "9014", label: "Dip angle", description: "Mapped dip angle", unit: "deg" },
  { id: "9015", label: "Toolface mode", description: "Current toolface mode", unit: "mode" },
];

export const WITS_DICTIONARY = Object.fromEntries(
  entries.map((entry) => [entry.id, entry])
) as Record<string, WitsDictionaryEntry>;

export function getWitsLabel(id: string): string {
  return WITS_DICTIONARY[id]?.label ?? "Unknown WITS ID";
}

export function getWitsDescription(id: string): string {
  return WITS_DICTIONARY[id]?.description ?? "No dictionary description available";
}

export function lookupWitsEntry(id: string): WitsDictionaryEntry | null {
  return WITS_DICTIONARY[id] ?? null;
}

export function decodeWitsPacket(packet: string): DecodedWitsPacket | null {
  const match = packet.match(/^\s*(\d{4})\s*[-,\s]\s*([+-]?\d+(?:\.\d+)?)\s*$/);
  if (!match) {
    return null;
  }

  const [, witsId, rawValue] = match;
  const entry = lookupWitsEntry(witsId);
  const numericValue = Number(rawValue);

  return {
    witsId,
    label: entry?.label ?? "Unknown WITS ID",
    description: entry?.description ?? "No dictionary description available",
    value: Number.isFinite(numericValue) ? numericValue : null,
    rawValue,
    parsedValue: Number.isFinite(numericValue)
      ? entry?.unit
        ? `${numericValue} ${entry.unit}`
        : `${numericValue}`
      : rawValue,
    rawPacket: packet,
  };
}

export function parseWitsPacket(packet: string): DecodedWitsPacket | null {
  return decodeWitsPacket(packet);
}
