import type { Request, Response } from "express";
export declare const sendEmailReport: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const sendTestEmail: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getEmailReportLogs: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=email-report.controller.d.ts.map