const DEFAULT_MAX_BUFFER_LENGTH = 8192;
const NUMERIC_PATTERN = /^[-+]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[-+]?\d+)?$/i;
const normalizeNewlines = (value) => value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
const normalizeRawValue = (value) => value.trim().replace(/^[:,=\t ]+/, "").trim();
const parseNumericValue = (value) => {
    if (!NUMERIC_PATTERN.test(value)) {
        return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};
export const parseSerialWitsLine = (rawLine) => {
    const trimmed = rawLine.replace(/\0/g, "").trim();
    if (!trimmed) {
        return {
            rawLine,
            witsId: null,
            rawValue: null,
            numericValue: null,
            malformed: true,
            reason: "empty_line",
        };
    }
    const match = trimmed.match(/^(\d{4})(.*)$/);
    if (!match?.[1]) {
        return {
            rawLine,
            witsId: null,
            rawValue: null,
            numericValue: null,
            malformed: true,
            reason: "missing_wits_id",
        };
    }
    const rawValue = normalizeRawValue(match[2] ?? "");
    if (!rawValue) {
        return {
            rawLine,
            witsId: match[1],
            rawValue: "",
            numericValue: null,
            malformed: true,
            reason: "missing_value",
        };
    }
    return {
        rawLine,
        witsId: match[1],
        rawValue,
        numericValue: parseNumericValue(rawValue),
        malformed: false,
    };
};
export const parseSerialWitsBlock = (rawBlock) => {
    const rawLines = normalizeNewlines(rawBlock)
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && line !== "&&" && line !== "!!");
    const lines = rawLines.map(parseSerialWitsLine);
    const values = {};
    const numericValues = {};
    const malformedLines = [];
    for (const line of lines) {
        if (line.malformed || !line.witsId || line.rawValue === null) {
            malformedLines.push(line);
            continue;
        }
        values[line.witsId] = line.rawValue;
        if (line.numericValue !== null) {
            numericValues[line.witsId] = line.numericValue;
        }
    }
    return {
        rawBlock,
        rawLines,
        lines,
        values,
        numericValues,
        malformedLines,
    };
};
export class SerialWitsStreamParser {
    maxBufferLength;
    lineBuffer = "";
    blockLines = [];
    insideBlock = false;
    constructor(maxBufferLength = DEFAULT_MAX_BUFFER_LENGTH) {
        this.maxBufferLength = maxBufferLength;
    }
    reset() {
        this.lineBuffer = "";
        this.blockLines = [];
        this.insideBlock = false;
    }
    push(chunk) {
        const result = {
            blocks: [],
            standaloneLines: [],
        };
        this.lineBuffer += normalizeNewlines(chunk);
        if (this.lineBuffer.length > this.maxBufferLength) {
            this.lineBuffer = this.lineBuffer.slice(-this.maxBufferLength);
            this.blockLines = [];
            this.insideBlock = false;
        }
        const lines = this.lineBuffer.split("\n");
        this.lineBuffer = lines.pop() ?? "";
        for (const rawLine of lines) {
            this.processLine(rawLine, result);
        }
        return result;
    }
    processLine(rawLine, result) {
        const line = rawLine.replace(/\0/g, "").trim();
        if (!line && !this.insideBlock) {
            return;
        }
        if (line === "&&") {
            this.insideBlock = true;
            this.blockLines = [];
            return;
        }
        if (line === "!!") {
            if (!this.insideBlock) {
                return;
            }
            const rawBlock = ["&&", ...this.blockLines, "!!"].join("\n");
            result.blocks.push(parseSerialWitsBlock(rawBlock));
            this.insideBlock = false;
            this.blockLines = [];
            return;
        }
        if (this.insideBlock) {
            this.blockLines.push(rawLine);
            return;
        }
        if (line) {
            result.standaloneLines.push(rawLine);
        }
    }
}
//# sourceMappingURL=serial-wits-parser.js.map