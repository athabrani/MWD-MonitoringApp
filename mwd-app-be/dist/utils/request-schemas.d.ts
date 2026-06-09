import { z } from "zod";
export declare const loginBodySchema: z.ZodObject<{
    identifier: z.ZodString;
    password: z.ZodString;
}, z.core.$strict>;
export declare const userCreateBodySchema: z.ZodObject<{
    roleId: z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>;
    username: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strict>;
export declare const userUpdateBodySchema: z.ZodObject<{
    roleId: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
    username: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    password: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strict>;
export declare const sessionCreateBodySchema: z.ZodObject<{
    userId: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
    sessionCode: z.ZodString;
    company: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    wellName: z.ZodOptional<z.ZodString>;
    wellId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    rigName: z.ZodOptional<z.ZodString>;
    fieldName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    field: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    jobNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    province: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    countyParish: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    country: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    location: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    latitude: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodNull]>>;
    longitude: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodNull]>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    connectionStatusId: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>>;
    startedAt: z.ZodOptional<z.ZodString>;
    endedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strict>;
export declare const sessionUpdateBodySchema: z.ZodObject<{
    userId: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>>;
    sessionCode: z.ZodOptional<z.ZodString>;
    company: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    wellName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    wellId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    rigName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    fieldName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    field: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    jobNumber: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    province: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    countyParish: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    country: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    location: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    latitude: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodNull]>>>;
    longitude: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodNull]>>>;
    notes: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    connectionStatusId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>>>;
    startedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    endedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
}, z.core.$strict>;
export declare const mwdDataCreateBodySchema: z.ZodObject<{
    sessionId: z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>;
    measuredAt: z.ZodOptional<z.ZodString>;
}, z.core.$loose>;
export declare const mwdDataUpdateBodySchema: z.ZodObject<{
    sessionId: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
    measuredAt: z.ZodOptional<z.ZodString>;
}, z.core.$loose>;
export declare const gatewayBodySchema: z.ZodUnion<readonly [z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>, z.ZodObject<{
    data: z.ZodUnknown;
}, z.core.$loose>]>;
export declare const textImportQuerySchema: z.ZodObject<{
    delimiter: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
}, z.core.$strip>;
//# sourceMappingURL=request-schemas.d.ts.map