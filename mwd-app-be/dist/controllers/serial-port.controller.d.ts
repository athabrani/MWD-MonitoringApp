import type { Request, Response } from "express";
export declare const getSerialPorts: (_req: Request, res: Response) => Promise<void>;
export declare const getSerialStatus: (_req: Request, res: Response) => void;
export declare const connectSerialPort: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const disconnectSerialPort: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=serial-port.controller.d.ts.map