import { prisma } from "../lib/prisma.js";

const parsePositiveInt = (value: unknown) => {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
};

export const resolveGatewaySessionId = async (
  envValue: string | undefined,
  label = "Gateway",
): Promise<number | null> => {
  const trimmed = envValue?.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.toLowerCase() !== "auto") {
    const parsed = parsePositiveInt(trimmed);

    if (parsed === null) {
      throw new Error(`${label} sessionId must be a positive integer or "auto".`);
    }

    return parsed;
  }

  // 1. Prioritas utama: pakai sessionId dari data MWD terakhir yang pernah masuk
  const latestData = await prisma.mWDData.findFirst({
    orderBy: [
      { createdAt: "desc" },
      { measuredAt: "desc" },
      { id: "desc" },
    ],
    select: {
      sessionId: true,
    },
  });

  if (latestData?.sessionId) {
    console.log(`[${label}] Using auto sessionId from latest MWD data: ${latestData.sessionId}`);
    return latestData.sessionId;
  }

  // 2. Kalau belum ada data sama sekali, fallback ke session aktif terbaru
  const latestOpenSession = await prisma.mWDSession.findFirst({
    where: {
      endedAt: null,
    },
    orderBy: [
      { startedAt: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ],
    select: {
      id: true,
    },
  });

  if (latestOpenSession) {
    console.log(`[${label}] Using auto sessionId from latest open session: ${latestOpenSession.id}`);
    return latestOpenSession.id;
  }

  // 3. Kalau tidak ada session aktif, fallback ke session terbaru yang pernah dibuat
  const fallbackSession = await prisma.mWDSession.findFirst({
    orderBy: [
      { startedAt: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ],
    select: {
      id: true,
    },
  });

  if (!fallbackSession) {
    throw new Error("No MWD session found. Please create a session first.");
  }

  console.log(`[${label}] Using auto sessionId from latest created session: ${fallbackSession.id}`);
  return fallbackSession.id;
};