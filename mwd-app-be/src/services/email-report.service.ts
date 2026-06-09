import { randomUUID } from "node:crypto";
import net from "node:net";
import tls from "node:tls";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import * as historicalDataService from "./historical-data.service.js";
import {
  buildExportFileName,
  serializeHistoricalDataAsCsv,
  serializeHistoricalDataAsJson,
} from "./export.service.js";
import { buildLasExport } from "./las-export.service.js";
import { buildPdfPlot } from "./pdf-plot.service.js";

type PrismaDbClient = PrismaClient | Prisma.TransactionClient;

type EmailReportAttachmentType =
  | "pdf_plot"
  | "las"
  | "historical_csv"
  | "historical_json";

type EmailReportAttachmentRequest =
  | EmailReportAttachmentType
  | {
      type?: string;
      options?: Record<string, unknown>;
    };

type SessionLike = {
  id: number;
  sessionCode: string;
  wellName?: string | null;
  rigName?: string | null;
};

type EmailAddressInput = {
  name?: string;
  email: string;
};

type SendEmailInput = {
  sentById: number;
  session?: SessionLike | null;
  to: EmailAddressInput[];
  cc?: EmailAddressInput[];
  bcc?: EmailAddressInput[];
  subject: string;
  message?: string | null;
  dryRun?: boolean;
  attachmentRequests?: EmailReportAttachmentRequest[];
  options?: Record<string, unknown>;
};

type RawEmailInput = {
  from: string;
  to: EmailAddressInput[];
  cc: EmailAddressInput[];
  bcc: EmailAddressInput[];
  subject: string;
  message: string;
  attachments: ReportAttachment[];
};

type ReportAttachment = {
  type: EmailReportAttachmentType | "test";
  fileName: string;
  contentType: string;
  content: Buffer;
  rowCount?: number;
};

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  ignoreTls: boolean;
  rejectUnauthorized: boolean;
  user?: string;
  pass?: string;
  from: string;
  timeoutMs: number;
};

const reportEmailLogSelect = {
  id: true,
  sessionId: true,
  sentById: true,
  toRecipients: true,
  ccRecipients: true,
  bccRecipients: true,
  subject: true,
  message: true,
  status: true,
  dryRun: true,
  attachmentTypes: true,
  attachments: true,
  errorMessage: true,
  providerMessageId: true,
  sentAt: true,
  createdAt: true,
  session: {
    select: {
      id: true,
      sessionCode: true,
      wellName: true,
      rigName: true,
      userId: true,
    },
  },
  sentBy: {
    select: {
      id: true,
      username: true,
      email: true,
    },
  },
} as const;

const db = (client: PrismaDbClient = prisma) => client as unknown as {
  reportEmailLog: {
    create: (args: unknown) => Promise<Record<string, unknown>>;
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
  };
};

const toFiniteNumber = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : NaN;

  return Number.isFinite(parsed) ? parsed : undefined;
};

const toPositiveInt = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : NaN;

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const toDate = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const getOptionRecord = (value: unknown) => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
};

const getMergedOptions = (
  rootOptions: Record<string, unknown>,
  attachmentOptions: Record<string, unknown>,
  key: string,
) => {
  return {
    ...rootOptions,
    ...getOptionRecord(rootOptions[key]),
    ...attachmentOptions,
  };
};

const getBooleanOption = (
  value: unknown,
  fallback: boolean,
) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true" || normalized === "1") {
      return true;
    }

    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }

  return fallback;
};

const getSmtpConfig = (): SmtpConfig | null => {
  const host = process.env.SMTP_HOST?.trim();

  if (!host) {
    return null;
  }

  const secure = getBooleanOption(process.env.SMTP_SECURE, false);
  const portFromEnv = Number(process.env.SMTP_PORT);
  const port = Number.isInteger(portFromEnv) && portFromEnv > 0
    ? portFromEnv
    : secure
      ? 465
      : 587;
  const from =
    process.env.SMTP_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    "mwd-monitoring@example.com";
  const timeoutFromEnv = Number(process.env.SMTP_TIMEOUT_MS);

  const config: SmtpConfig = {
    host,
    port,
    secure,
    ignoreTls: getBooleanOption(process.env.SMTP_IGNORE_TLS, false),
    rejectUnauthorized: getBooleanOption(
      process.env.SMTP_TLS_REJECT_UNAUTHORIZED,
      true,
    ),
    from,
    timeoutMs:
      Number.isInteger(timeoutFromEnv) && timeoutFromEnv > 0
        ? timeoutFromEnv
        : 30_000,
  };
  const user = process.env.SMTP_USER?.trim();

  if (user) {
    config.user = user;
  }

  if (process.env.SMTP_PASS !== undefined) {
    config.pass = process.env.SMTP_PASS;
  }

  return config;
};

const sanitizeFileName = (value: string) => {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
};

const normalizeAttachmentType = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/[-\s]+/g, "_");

  if (
    normalized === "pdf_plot" ||
    normalized === "las" ||
    normalized === "historical_csv" ||
    normalized === "historical_json"
  ) {
    return normalized;
  }

  if (normalized === "csv") {
    return "historical_csv";
  }

  if (normalized === "json") {
    return "historical_json";
  }

  if (normalized === "pdf") {
    return "pdf_plot";
  }

  return null;
};

const normalizeAttachmentRequests = (
  value: EmailReportAttachmentRequest[] | undefined,
) => {
  const source = value && value.length > 0 ? value : ["pdf_plot"];
  const normalized: Array<{
    type: EmailReportAttachmentType;
    options: Record<string, unknown>;
  }> = [];

  for (const item of source) {
    if (typeof item === "string") {
      const type = normalizeAttachmentType(item);

      if (type) {
        normalized.push({ type, options: {} });
      }

      continue;
    }

    if (typeof item === "object" && item !== null) {
      const type = normalizeAttachmentType(item.type);

      if (type) {
        normalized.push({
          type,
          options: getOptionRecord(item.options),
        });
      }
    }
  }

  if (normalized.length === 0) {
    throw new Error("attachments must contain at least one supported type");
  }

  return normalized;
};

const makeAddressText = (address: EmailAddressInput) => {
  const email = address.email.trim();
  const name = address.name?.trim();

  if (!name) {
    return email;
  }

  const escapedName = name.replace(/"/g, "\\\"");
  return `"${escapedName}" <${email}>`;
};

const extractEmailAddress = (address: string) => {
  const match = address.match(/<([^>]+)>/);
  return (match?.[1] ?? address).trim();
};

const encodeHeader = (value: string) => {
  return /^[\x20-\x7E]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
};

const wrapBase64 = (buffer: Buffer) => {
  return buffer.toString("base64").replace(/.{1,76}/g, "$&\r\n").trimEnd();
};

const buildMimeMessage = (input: RawEmailInput, messageId: string) => {
  const boundary = `mwd_report_${randomUUID().replace(/-/g, "")}`;
  const recipients = input.to.map(makeAddressText).join(", ");
  const ccRecipients = input.cc.map(makeAddressText).join(", ");
  const headers = [
    `From: ${input.from}`,
    `To: ${recipients}`,
    ...(ccRecipients ? [`Cc: ${ccRecipients}`] : []),
    `Subject: ${encodeHeader(input.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${messageId}>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ];
  const bodyParts = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(input.message || "Attached MWD report.", "utf8")),
  ];

  for (const attachment of input.attachments) {
    bodyParts.push(
      `--${boundary}`,
      `Content-Type: ${attachment.contentType}; name="${attachment.fileName}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${attachment.fileName}"`,
      "",
      wrapBase64(attachment.content),
    );
  }

  bodyParts.push(`--${boundary}--`, "");
  return `${headers.join("\r\n")}\r\n\r\n${bodyParts.join("\r\n")}`;
};

const dotStuffMessage = (message: string) => {
  return message
    .replace(/\r?\n/g, "\r\n")
    .split("\r\n")
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n");
};

const waitForSocketConnect = (
  socket: net.Socket | tls.TLSSocket,
  timeoutMs: number,
) => {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      settled = true;
      reject(new Error("SMTP connection timeout"));
    }, timeoutMs);
    const settle = (error?: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      socket.removeListener("connect", onConnect);
      socket.removeListener("secureConnect", onConnect);
      socket.removeListener("error", onError);

      if (error) {
        reject(error);
        return;
      }

      resolve();
    };
    const onConnect = () => settle();
    const onError = (error: Error) => settle(error);

    socket.once("connect", onConnect);
    socket.once("secureConnect", onConnect);
    socket.once("error", onError);
  });
};

const sendSmtpEmail = async (config: SmtpConfig, input: RawEmailInput) => {
  let socket: net.Socket | tls.TLSSocket = config.secure
    ? tls.connect({
        host: config.host,
        port: config.port,
        servername: config.host,
        rejectUnauthorized: config.rejectUnauthorized,
      })
    : net.connect({ host: config.host, port: config.port });
  let responseBuffer = "";
  let pending:
    | {
        resolve: (value: { code: number; text: string }) => void;
        reject: (error: Error) => void;
        timer: NodeJS.Timeout;
      }
    | null = null;

  const parseResponse = () => {
    if (!responseBuffer.includes("\n")) {
      return null;
    }

    const lines = responseBuffer
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter(Boolean);
    const lastLine = lines[lines.length - 1];
    const match = lastLine?.match(/^(\d{3})\s/);

    if (!match) {
      return null;
    }

    const code = Number(match[1]);
    const text = lines.join("\n");
    responseBuffer = "";
    return { code, text };
  };

  const onData = (chunk: Buffer | string) => {
    responseBuffer += chunk.toString();
    const parsed = parseResponse();

    if (parsed && pending) {
      clearTimeout(pending.timer);
      const currentPending = pending;
      pending = null;
      currentPending.resolve(parsed);
    }
  };

  const attachSocket = (nextSocket: net.Socket | tls.TLSSocket) => {
    socket.removeListener("data", onData);
    socket = nextSocket;
    socket.setEncoding("utf8");
    socket.on("data", onData);
  };

  socket.setEncoding("utf8");
  socket.on("data", onData);

  await waitForSocketConnect(socket, config.timeoutMs);

  const waitForResponse = async () => {
    const existingResponse = parseResponse();

    if (existingResponse) {
      return existingResponse;
    }

    return await new Promise<{ code: number; text: string }>((resolve, reject) => {
      pending = {
        resolve,
        reject,
        timer: setTimeout(() => {
          pending = null;
          reject(new Error("SMTP response timeout"));
        }, config.timeoutMs),
      };
    });
  };

  const assertCode = (
    response: { code: number; text: string },
    validCodes: number[],
  ) => {
    if (!validCodes.includes(response.code)) {
      throw new Error(`SMTP error ${response.code}: ${response.text}`);
    }
  };

  const sendCommand = async (command: string, validCodes: number[]) => {
    socket.write(`${command}\r\n`);
    const response = await waitForResponse();
    assertCode(response, validCodes);
    return response;
  };

  try {
    assertCode(await waitForResponse(), [220]);
    await sendCommand("EHLO localhost", [250]);

    if (!config.secure && !config.ignoreTls) {
      await sendCommand("STARTTLS", [220]);
      responseBuffer = "";

      const tlsSocket = tls.connect({
        socket,
        servername: config.host,
        rejectUnauthorized: config.rejectUnauthorized,
      });

      await waitForSocketConnect(tlsSocket, config.timeoutMs);
      attachSocket(tlsSocket);
      await sendCommand("EHLO localhost", [250]);
    }

    if (config.user && config.pass !== undefined) {
      const authPayload = Buffer.from(
        `\u0000${config.user}\u0000${config.pass}`,
        "utf8",
      ).toString("base64");
      await sendCommand(`AUTH PLAIN ${authPayload}`, [235, 503]);
    }

    const envelopeFrom = extractEmailAddress(config.from);
    const recipients = [...input.to, ...input.cc, ...input.bcc].map((address) =>
      extractEmailAddress(address.email),
    );
    const messageId = `${randomUUID()}@mwd-monitoring.local`;
    const mimeMessage = buildMimeMessage(input, messageId);

    await sendCommand(`MAIL FROM:<${envelopeFrom}>`, [250]);

    for (const recipient of recipients) {
      await sendCommand(`RCPT TO:<${recipient}>`, [250, 251]);
    }

    await sendCommand("DATA", [354]);
    socket.write(`${dotStuffMessage(mimeMessage)}\r\n.\r\n`);
    await waitForResponse().then((response) => assertCode(response, [250]));
    await sendCommand("QUIT", [221]).catch(() => undefined);

    return `<${messageId}>`;
  } finally {
    socket.end();
  }
};

const buildPdfAttachment = async (
  session: SessionLike,
  options: Record<string, unknown>,
) => {
  const templateId = toPositiveInt(options.templateId);
  const depthMin = toFiniteNumber(options.depthMin ?? options.startDepth);
  const depthMax = toFiniteNumber(options.depthMax ?? options.endDepth);
  const template = getOptionRecord(options.template);
  const input: Parameters<typeof buildPdfPlot>[0] = {
    sessionId: session.id,
    sessionCode: session.sessionCode,
  };

  if (session.wellName !== undefined) {
    input.wellName = session.wellName;
  }

  if (session.rigName !== undefined) {
    input.rigName = session.rigName;
  }

  if (templateId !== undefined) {
    input.templateId = templateId;
  }

  if (depthMin !== undefined) {
    input.depthMin = depthMin;
  }

  if (depthMax !== undefined) {
    input.depthMax = depthMax;
  }

  if (Object.keys(template).length > 0) {
    input.template = template;
  }

  const pdf = await buildPdfPlot(input);

  return {
    type: "pdf_plot" as const,
    fileName: sanitizeFileName(pdf.fileName),
    contentType: "application/pdf",
    content: Buffer.isBuffer(pdf.content) ? pdf.content : Buffer.from(pdf.content),
    rowCount: pdf.rowCount,
  };
};

const buildLasAttachment = async (
  session: SessionLike,
  options: Record<string, unknown>,
) => {
  const measuredFrom = toDate(options.measuredFrom);
  const measuredTo = toDate(options.measuredTo);
  const depthMin = toFiniteNumber(options.depthMin ?? options.startDepth);
  const depthMax = toFiniteNumber(options.depthMax ?? options.endDepth);
  const stepDepth = toFiniteNumber(options.stepDepth);
  const maxGap = toFiniteNumber(options.maxGap);
  const nullValue = toFiniteNumber(options.nullValue);
  const input: Parameters<typeof buildLasExport>[0] = {
    sessionId: session.id,
    sessionCode: session.sessionCode,
    includeWits: getBooleanOption(options.includeWits, true),
    includeSurvey: getBooleanOption(options.includeSurvey, true),
    stopAtLastSurveyDepth: getBooleanOption(options.stopAtLastSurveyDepth, false),
    dateTimeInFirstColumn: getBooleanOption(options.dateTimeInFirstColumn, false),
    correctDepthColumnForTvd: getBooleanOption(
      options.correctDepthColumnForTvd,
      false,
    ),
    interpolateSurvey: getBooleanOption(options.interpolateSurvey, false),
    includeSurveysInOtherSection: getBooleanOption(
      options.includeSurveysInOtherSection,
      false,
    ),
  };

  if (session.wellName !== undefined) {
    input.wellName = session.wellName;
  }

  if (session.rigName !== undefined) {
    input.rigName = session.rigName;
  }

  if (measuredFrom !== undefined) {
    input.measuredFrom = measuredFrom;
  }

  if (measuredTo !== undefined) {
    input.measuredTo = measuredTo;
  }

  if (depthMin !== undefined) {
    input.depthMin = depthMin;
  }

  if (depthMax !== undefined) {
    input.depthMax = depthMax;
  }

  if (stepDepth !== undefined) {
    input.stepDepth = stepDepth;
  }

  if (maxGap !== undefined) {
    input.maxGap = maxGap;
  }

  if (nullValue !== undefined) {
    input.nullValue = nullValue;
  }

  if (typeof options.depthUnit === "string" && options.depthUnit.trim()) {
    input.depthUnit = options.depthUnit.trim();
  }

  if (
    typeof options.surveyStationType === "string" &&
    options.surveyStationType.trim()
  ) {
    input.surveyStationType = options.surveyStationType.trim();
  }

  if (Array.isArray(options.columns)) {
    input.columns = options.columns as NonNullable<
      Parameters<typeof buildLasExport>[0]["columns"]
    >;
  }

  if (Array.isArray(options.wellInfo)) {
    input.wellInfo = options.wellInfo as NonNullable<
      Parameters<typeof buildLasExport>[0]["wellInfo"]
    >;
  }

  const las = await buildLasExport(input);

  return {
    type: "las" as const,
    fileName: sanitizeFileName(las.fileName),
    contentType: "text/plain; charset=utf-8",
    content: Buffer.from(las.content, "utf8"),
    rowCount: las.rowCount,
  };
};

const buildHistoricalAttachment = async (
  session: SessionLike,
  options: Record<string, unknown>,
  format: "csv" | "json",
) => {
  const measuredFrom = toDate(options.measuredFrom);
  const measuredTo = toDate(options.measuredTo);
  const depthMin = toFiniteNumber(options.depthMin ?? options.startDepth);
  const depthMax = toFiniteNumber(options.depthMax ?? options.endDepth);
  const query: Parameters<typeof historicalDataService.getHistoricalData>[0] = {
    sessionId: session.id,
    includeHidden: getBooleanOption(options.includeHidden, false),
  };

  if (measuredFrom !== undefined) {
    query.measuredFrom = measuredFrom;
  }

  if (measuredTo !== undefined) {
    query.measuredTo = measuredTo;
  }

  if (depthMin !== undefined) {
    query.depthMin = depthMin;
  }

  if (depthMax !== undefined) {
    query.depthMax = depthMax;
  }

  const historicalData = await historicalDataService.getHistoricalData(query);
  const content =
    format === "csv"
      ? serializeHistoricalDataAsCsv(historicalData.data)
      : serializeHistoricalDataAsJson(historicalData.data);

  return {
    type: format === "csv" ? ("historical_csv" as const) : ("historical_json" as const),
    fileName: sanitizeFileName(buildExportFileName(session.sessionCode, format)),
    contentType:
      format === "csv"
        ? "text/csv; charset=utf-8"
        : "application/json; charset=utf-8",
    content: Buffer.from(content, "utf8"),
    rowCount: historicalData.count,
  };
};

const buildReportAttachments = async (
  session: SessionLike | null | undefined,
  attachmentRequests: EmailReportAttachmentRequest[] | undefined,
  rootOptions: Record<string, unknown>,
) => {
  const normalizedRequests = normalizeAttachmentRequests(attachmentRequests);

  if (!session) {
    throw new Error("sessionId is required when sending report attachments");
  }

  const attachments: ReportAttachment[] = [];

  for (const request of normalizedRequests) {
    if (request.type === "pdf_plot") {
      attachments.push(
        await buildPdfAttachment(
          session,
          getMergedOptions(rootOptions, request.options, "pdfPlot"),
        ),
      );
      continue;
    }

    if (request.type === "las") {
      attachments.push(
        await buildLasAttachment(
          session,
          getMergedOptions(rootOptions, request.options, "las"),
        ),
      );
      continue;
    }

    if (request.type === "historical_csv") {
      attachments.push(
        await buildHistoricalAttachment(
          session,
          getMergedOptions(rootOptions, request.options, "historical"),
          "csv",
        ),
      );
      continue;
    }

    attachments.push(
      await buildHistoricalAttachment(
        session,
        getMergedOptions(rootOptions, request.options, "historical"),
        "json",
      ),
    );
  }

  return attachments;
};

const attachmentSummary = (attachments: ReportAttachment[]) => {
  return attachments.map((attachment) => ({
    type: attachment.type,
    fileName: attachment.fileName,
    contentType: attachment.contentType,
    bytes: attachment.content.length,
    rowCount: attachment.rowCount ?? null,
  }));
};

const createReportEmailLog = async (input: {
  sessionId?: number | null;
  sentById: number;
  to: EmailAddressInput[];
  cc: EmailAddressInput[];
  bcc: EmailAddressInput[];
  subject: string;
  message?: string | null;
  status: "sent" | "failed" | "dry_run";
  dryRun: boolean;
  attachments: ReportAttachment[];
  errorMessage?: string | null;
  providerMessageId?: string | null;
}) => {
  const data: Record<string, unknown> = {
    sessionId: input.sessionId ?? null,
    sentById: input.sentById,
    toRecipients: input.to,
    ccRecipients: input.cc,
    bccRecipients: input.bcc,
    subject: input.subject,
    message: input.message ?? null,
    status: input.status,
    dryRun: input.dryRun,
    attachmentTypes: input.attachments.map((attachment) => attachment.type),
    attachments: attachmentSummary(input.attachments),
    errorMessage: input.errorMessage ?? null,
    providerMessageId: input.providerMessageId ?? null,
    sentAt: input.status === "sent" || input.status === "dry_run" ? new Date() : null,
  };

  return await db().reportEmailLog.create({
    data,
    select: reportEmailLogSelect,
  });
};

export const sendEmailReport = async (input: SendEmailInput) => {
  const to = input.to;
  const cc = input.cc ?? [];
  const bcc = input.bcc ?? [];
  const dryRun = input.dryRun === true;
  const message =
    input.message ??
    `Attached MWD report${input.session ? ` for ${input.session.sessionCode}` : ""}.`;
  const attachments = await buildReportAttachments(
    input.session,
    input.attachmentRequests,
    input.options ?? {},
  );
  const config = getSmtpConfig();

  if (dryRun) {
    const log = await createReportEmailLog({
      sessionId: input.session?.id ?? null,
      sentById: input.sentById,
      to,
      cc,
      bcc,
      subject: input.subject,
      message,
      status: "dry_run",
      dryRun,
      attachments,
    });

    return {
      status: "dry_run",
      smtpConfigured: config !== null,
      log,
      attachments: attachmentSummary(attachments),
    };
  }

  if (!config) {
    const log = await createReportEmailLog({
      sessionId: input.session?.id ?? null,
      sentById: input.sentById,
      to,
      cc,
      bcc,
      subject: input.subject,
      message,
      status: "failed",
      dryRun,
      attachments,
      errorMessage: "SMTP_HOST is not configured",
    });

    throw Object.assign(new Error("SMTP_HOST is not configured"), { log });
  }

  try {
    const providerMessageId = await sendSmtpEmail(config, {
      from: config.from,
      to,
      cc,
      bcc,
      subject: input.subject,
      message,
      attachments,
    });
    const log = await createReportEmailLog({
      sessionId: input.session?.id ?? null,
      sentById: input.sentById,
      to,
      cc,
      bcc,
      subject: input.subject,
      message,
      status: "sent",
      dryRun,
      attachments,
      providerMessageId,
    });

    return {
      status: "sent",
      smtpConfigured: true,
      providerMessageId,
      log,
      attachments: attachmentSummary(attachments),
    };
  } catch (error: unknown) {
    const messageText =
      error instanceof Error ? error.message : "Failed to send email report";
    const log = await createReportEmailLog({
      sessionId: input.session?.id ?? null,
      sentById: input.sentById,
      to,
      cc,
      bcc,
      subject: input.subject,
      message,
      status: "failed",
      dryRun,
      attachments,
      errorMessage: messageText,
    });

    throw Object.assign(new Error(messageText), { log });
  }
};

export const sendTestEmail = async (input: Omit<SendEmailInput, "session" | "attachmentRequests">) => {
  const testAttachment: ReportAttachment = {
    type: "test",
    fileName: "smtp-test.txt",
    contentType: "text/plain; charset=utf-8",
    content: Buffer.from("MWD Monitoring SMTP test email.", "utf8"),
  };
  const config = getSmtpConfig();
  const to = input.to;
  const cc = input.cc ?? [];
  const bcc = input.bcc ?? [];
  const dryRun = input.dryRun === true;
  const message = input.message ?? "MWD Monitoring SMTP test email.";

  if (dryRun) {
    const log = await createReportEmailLog({
      sentById: input.sentById,
      to,
      cc,
      bcc,
      subject: input.subject,
      message,
      status: "dry_run",
      dryRun,
      attachments: [testAttachment],
    });

    return {
      status: "dry_run",
      smtpConfigured: config !== null,
      log,
      attachments: attachmentSummary([testAttachment]),
    };
  }

  if (!config) {
    const log = await createReportEmailLog({
      sentById: input.sentById,
      to,
      cc,
      bcc,
      subject: input.subject,
      message,
      status: "failed",
      dryRun,
      attachments: [testAttachment],
      errorMessage: "SMTP_HOST is not configured",
    });

    throw Object.assign(new Error("SMTP_HOST is not configured"), { log });
  }

  try {
    const providerMessageId = await sendSmtpEmail(config, {
      from: config.from,
      to,
      cc,
      bcc,
      subject: input.subject,
      message,
      attachments: [testAttachment],
    });
    const log = await createReportEmailLog({
      sentById: input.sentById,
      to,
      cc,
      bcc,
      subject: input.subject,
      message,
      status: "sent",
      dryRun,
      attachments: [testAttachment],
      providerMessageId,
    });

    return {
      status: "sent",
      smtpConfigured: true,
      providerMessageId,
      log,
      attachments: attachmentSummary([testAttachment]),
    };
  } catch (error: unknown) {
    const messageText =
      error instanceof Error ? error.message : "Failed to send test email";
    const log = await createReportEmailLog({
      sentById: input.sentById,
      to,
      cc,
      bcc,
      subject: input.subject,
      message,
      status: "failed",
      dryRun,
      attachments: [testAttachment],
      errorMessage: messageText,
    });

    throw Object.assign(new Error(messageText), { log });
  }
};

export const getEmailReportLogs = async (
  options: { sessionId?: number; status?: string; limit?: number } = {},
) => {
  return await db().reportEmailLog.findMany({
    where: {
      ...(options.sessionId !== undefined ? { sessionId: options.sessionId } : {}),
      ...(options.status !== undefined ? { status: options.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 100,
    select: reportEmailLogSelect,
  });
};
