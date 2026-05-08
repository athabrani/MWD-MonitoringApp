import type { Request, Response } from "express";
import {
  GatewayIngestError,
  ingestGatewayPayloads,
} from "../services/gateway-ingest.service.js";

export const ingestMWDData = async (req: Request, res: Response) => {
  try {
    const rawPayload = req.body?.data ?? req.body;
    const createdItems = await ingestGatewayPayloads(rawPayload);

    res.status(201).json({
      message: "MWD data ingested successfully",
      count: createdItems.length,
      data: createdItems,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";

    if (error instanceof GatewayIngestError) {
      return res.status(error.statusCode).json({ message });
    }

    res.status(500).json({ message });
  }
};
