export type ParsedSerialWitsLine = {
    rawLine: string;
    witsId: string | null;
    rawValue: string | null;
    numericValue: number | null;
    malformed: boolean;
    reason?: string;
};
export type ParsedSerialWitsBlock = {
    rawBlock: string;
    rawLines: string[];
    lines: ParsedSerialWitsLine[];
    values: Record<string, string>;
    numericValues: Record<string, number>;
    malformedLines: ParsedSerialWitsLine[];
};
export type SerialWitsStreamResult = {
    blocks: ParsedSerialWitsBlock[];
    standaloneLines: string[];
};
export declare const parseSerialWitsLine: (rawLine: string) => ParsedSerialWitsLine;
export declare const parseSerialWitsBlock: (rawBlock: string) => ParsedSerialWitsBlock;
export declare class SerialWitsStreamParser {
    private readonly maxBufferLength;
    private lineBuffer;
    private blockLines;
    private insideBlock;
    constructor(maxBufferLength?: number);
    reset(): void;
    push(chunk: string): SerialWitsStreamResult;
    private processLine;
}
//# sourceMappingURL=serial-wits-parser.d.ts.map