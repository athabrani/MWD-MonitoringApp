import { z } from "zod";

const stringOrNumber = z.union([z.string(), z.number()]);
const nullableStringOrNumber = z.union([z.string(), z.number(), z.null()]);
const positiveIntLike = z.union([
  z.number().int().positive(),
  z.string().trim().regex(/^\d+$/),
]);
const dateLike = z.string().trim().datetime({ offset: true });

export const loginBodySchema = z
  .object({
    identifier: z.string().trim().min(1).max(150),
    password: z.string().min(1).max(255),
  })
  .strict();

export const userCreateBodySchema = z
  .object({
    roleId: positiveIntLike,
    username: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(150),
    password: z.string().min(1).max(255),
    isActive: z.boolean().optional(),
  })
  .strict();

export const userUpdateBodySchema = userCreateBodySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const sessionCreateBodySchema = z
  .object({
    userId: positiveIntLike.optional(),
    sessionCode: z.string().trim().min(1).max(100),
    company: z.string().trim().max(150).nullable().optional(),
    wellName: z.string().trim().max(150).optional(),
    wellId: z.string().trim().max(100).nullable().optional(),
    rigName: z.string().trim().max(150).optional(),
    fieldName: z.string().trim().max(150).nullable().optional(),
    field: z.string().trim().max(150).nullable().optional(),
    jobNumber: z.string().trim().max(100).nullable().optional(),
    province: z.string().trim().max(150).nullable().optional(),
    countyParish: z.string().trim().max(150).nullable().optional(),
    country: z.string().trim().max(150).nullable().optional(),
    location: z.string().trim().max(255).nullable().optional(),
    latitude: nullableStringOrNumber.optional(),
    longitude: nullableStringOrNumber.optional(),
    notes: z.string().trim().max(10_000).nullable().optional(),
    connectionStatusId: positiveIntLike.nullable().optional(),
    startedAt: dateLike.optional(),
    endedAt: dateLike.nullable().optional(),
  })
  .strict();

export const sessionUpdateBodySchema = sessionCreateBodySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const mwdDataCreateBodySchema = z
  .object({
    sessionId: positiveIntLike,
    measuredAt: dateLike.optional(),
  })
  .passthrough();

export const mwdDataUpdateBodySchema = z
  .object({
    sessionId: positiveIntLike.optional(),
    measuredAt: dateLike.optional(),
  })
  .passthrough()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const gatewayBodySchema = z.union([
  z.record(z.string(), z.unknown()),
  z.array(z.record(z.string(), z.unknown())).min(1).max(50),
  z.object({ data: z.unknown() }).passthrough(),
]);

export const textImportQuerySchema = z.object({
  delimiter: stringOrNumber.optional(),
});
