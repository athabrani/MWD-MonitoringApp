type EmailReportAttachmentType = "pdf_plot" | "las" | "historical_csv" | "historical_json";
type EmailReportAttachmentRequest = EmailReportAttachmentType | {
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
export declare const sendEmailReport: (input: SendEmailInput) => Promise<{
    status: string;
    smtpConfigured: boolean;
    log: Record<string, unknown>;
    attachments: {
        type: EmailReportAttachmentType | "test";
        fileName: string;
        contentType: string;
        bytes: number;
        rowCount: number | null;
    }[];
    providerMessageId?: never;
} | {
    status: string;
    smtpConfigured: boolean;
    providerMessageId: string;
    log: Record<string, unknown>;
    attachments: {
        type: EmailReportAttachmentType | "test";
        fileName: string;
        contentType: string;
        bytes: number;
        rowCount: number | null;
    }[];
}>;
export declare const sendTestEmail: (input: Omit<SendEmailInput, "session" | "attachmentRequests">) => Promise<{
    status: string;
    smtpConfigured: boolean;
    log: Record<string, unknown>;
    attachments: {
        type: EmailReportAttachmentType | "test";
        fileName: string;
        contentType: string;
        bytes: number;
        rowCount: number | null;
    }[];
    providerMessageId?: never;
} | {
    status: string;
    smtpConfigured: boolean;
    providerMessageId: string;
    log: Record<string, unknown>;
    attachments: {
        type: EmailReportAttachmentType | "test";
        fileName: string;
        contentType: string;
        bytes: number;
        rowCount: number | null;
    }[];
}>;
export declare const getEmailReportLogs: (options?: {
    sessionId?: number;
    status?: string;
    limit?: number;
}) => Promise<Record<string, unknown>[]>;
export {};
//# sourceMappingURL=email-report.service.d.ts.map