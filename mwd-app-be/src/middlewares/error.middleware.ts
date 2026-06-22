import type { NextFunction, Request, Response } from "express";

const isProduction = process.env.NODE_ENV === "production";

type HttpErrorLike = Error & {
  status?: number;
  statusCode?: number;
  type?: string;
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    message: "Route not found",
    path: req.originalUrl,
  });
};

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const httpError = error instanceof Error ? (error as HttpErrorLike) : null;
  const status = httpError?.status ?? httpError?.statusCode;

  if (status === 413 || httpError?.type === "entity.too.large") {
    if (!isProduction && error instanceof Error) {
      console.error(error.message);
    }

    return res.status(413).json({ message: "Request payload too large" });
  }

  const message =
    !isProduction && error instanceof Error
      ? error.message
      : "Internal server error";

  if (!isProduction && error instanceof Error) {
    console.error(error);
  }

  res.status(500).json({ message });
};
