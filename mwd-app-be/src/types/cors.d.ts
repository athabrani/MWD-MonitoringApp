declare module "cors" {
  import type { RequestHandler } from "express";

  type CorsOptions = {
    origin?: string | string[] | boolean | RegExp | ((origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => void);
    credentials?: boolean;
    methods?: string | string[];
    allowedHeaders?: string | string[];
    exposedHeaders?: string | string[];
    maxAge?: number;
    preflightContinue?: boolean;
    optionsSuccessStatus?: number;
  };

  export default function cors(options?: CorsOptions): RequestHandler;
}

