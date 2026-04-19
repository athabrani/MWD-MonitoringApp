import * as mwdDataService from "../services/mwd-data.service.js";

const toNumericDepth = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof value === "object" && value !== null && "toString" in value) {
    const parsed = Number(String(value));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

type SyncTimestampAndDepthInput = {
  sessionId: number;
  measuredAt?: Date | null;
  depthMd?: number | string | null;
};

export const syncTimestampAndDepth = async (
  input: SyncTimestampAndDepthInput,
) => {
  const latestRecord = await mwdDataService.getLatestMWDDataBySessionId(input.sessionId);
  const originalMeasuredAt = input.measuredAt ?? null;
  const latestMeasuredAt = latestRecord?.measuredAt ?? null;
  const latestDepthMd = toNumericDepth(latestRecord?.depthMd);
  const currentDepthMd = toNumericDepth(input.depthMd);

  let measuredAt = input.measuredAt ?? new Date();
  let adjusted = false;
  let reason = input.measuredAt ? null : "generated_current_timestamp";

  if (latestMeasuredAt && measuredAt.getTime() <= latestMeasuredAt.getTime()) {
    measuredAt = new Date(latestMeasuredAt.getTime() + 1);
    adjusted = true;

    reason =
      currentDepthMd !== null &&
      latestDepthMd !== null &&
      currentDepthMd >= latestDepthMd
        ? "shifted_to_keep_depth_timestamp_sequence"
        : "shifted_to_keep_monotonic_timestamp";
  }

  return {
    measuredAt,
    syncInfo: {
      adjusted,
      reason,
      originalMeasuredAt,
      latestMeasuredAt,
      latestDepthMd,
      currentDepthMd,
    },
  };
};
