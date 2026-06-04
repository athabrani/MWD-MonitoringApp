import type { NextFunction, Request, Response } from "express";

const isProduction = process.env.NODE_ENV === "production";

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
  const message =
    !isProduction && error instanceof Error
      ? error.message
      : "Internal server error";

  if (!isProduction && error instanceof Error) {
    console.error(error);
  }

  res.status(500).json({ message });
};
