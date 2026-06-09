type SessionInput = {
    userId: number;
    sessionCode: string;
    company?: string | null;
    wellName?: string | null;
    wellId?: string | null;
    rigName?: string | null;
    fieldName?: string | null;
    jobNumber?: string | null;
    province?: string | null;
    countyParish?: string | null;
    country?: string | null;
    location?: string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
    notes?: string | null;
    connectionStatusId?: number | null;
    startedAt?: Date;
    endedAt?: Date | null;
};
type SessionUpdateInput = {
    userId?: number;
    sessionCode?: string;
    company?: string | null;
    wellName?: string | null;
    wellId?: string | null;
    rigName?: string | null;
    fieldName?: string | null;
    jobNumber?: string | null;
    province?: string | null;
    countyParish?: string | null;
    country?: string | null;
    location?: string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
    notes?: string | null;
    connectionStatusId?: number | null;
    startedAt?: Date;
    endedAt?: Date | null;
};
export declare const createSession: (input: SessionInput) => Promise<{
    id: number;
    createdAt: Date;
    user: {
        id: number;
        username: string;
        email: string;
        role: {
            id: number;
            name: string;
        };
    };
    userId: number;
    updatedAt: Date;
    _count: {
        mwdData: number;
        witsDataValues: number;
        surveyStations: number;
    };
    sessionCode: string;
    company: string | null;
    wellName: string | null;
    wellId: string | null;
    rigName: string | null;
    fieldName: string | null;
    jobNumber: string | null;
    province: string | null;
    countyParish: string | null;
    country: string | null;
    location: string | null;
    latitude: import("@prisma/client/runtime/library").Decimal | null;
    longitude: import("@prisma/client/runtime/library").Decimal | null;
    notes: string | null;
    connectionStatusId: number | null;
    startedAt: Date;
    endedAt: Date | null;
    connectionStatus: {
        id: number;
        source: string;
        status: string;
        checkedAt: Date;
    } | null;
}>;
export declare const getAllSessions: (userId?: number) => Promise<{
    id: number;
    createdAt: Date;
    user: {
        id: number;
        username: string;
        email: string;
        role: {
            id: number;
            name: string;
        };
    };
    userId: number;
    updatedAt: Date;
    _count: {
        mwdData: number;
        witsDataValues: number;
        surveyStations: number;
    };
    sessionCode: string;
    company: string | null;
    wellName: string | null;
    wellId: string | null;
    rigName: string | null;
    fieldName: string | null;
    jobNumber: string | null;
    province: string | null;
    countyParish: string | null;
    country: string | null;
    location: string | null;
    latitude: import("@prisma/client/runtime/library").Decimal | null;
    longitude: import("@prisma/client/runtime/library").Decimal | null;
    notes: string | null;
    connectionStatusId: number | null;
    startedAt: Date;
    endedAt: Date | null;
    connectionStatus: {
        id: number;
        source: string;
        status: string;
        checkedAt: Date;
    } | null;
}[]>;
export declare const getSessionById: (id: number) => Promise<{
    id: number;
    createdAt: Date;
    user: {
        id: number;
        username: string;
        email: string;
        role: {
            id: number;
            name: string;
        };
    };
    userId: number;
    updatedAt: Date;
    _count: {
        mwdData: number;
        witsDataValues: number;
        surveyStations: number;
    };
    sessionCode: string;
    company: string | null;
    wellName: string | null;
    wellId: string | null;
    rigName: string | null;
    fieldName: string | null;
    jobNumber: string | null;
    province: string | null;
    countyParish: string | null;
    country: string | null;
    location: string | null;
    latitude: import("@prisma/client/runtime/library").Decimal | null;
    longitude: import("@prisma/client/runtime/library").Decimal | null;
    notes: string | null;
    connectionStatusId: number | null;
    startedAt: Date;
    endedAt: Date | null;
    connectionStatus: {
        id: number;
        source: string;
        status: string;
        checkedAt: Date;
    } | null;
} | null>;
export declare const updateSession: (id: number, input: SessionUpdateInput) => Promise<{
    id: number;
    createdAt: Date;
    user: {
        id: number;
        username: string;
        email: string;
        role: {
            id: number;
            name: string;
        };
    };
    userId: number;
    updatedAt: Date;
    _count: {
        mwdData: number;
        witsDataValues: number;
        surveyStations: number;
    };
    sessionCode: string;
    company: string | null;
    wellName: string | null;
    wellId: string | null;
    rigName: string | null;
    fieldName: string | null;
    jobNumber: string | null;
    province: string | null;
    countyParish: string | null;
    country: string | null;
    location: string | null;
    latitude: import("@prisma/client/runtime/library").Decimal | null;
    longitude: import("@prisma/client/runtime/library").Decimal | null;
    notes: string | null;
    connectionStatusId: number | null;
    startedAt: Date;
    endedAt: Date | null;
    connectionStatus: {
        id: number;
        source: string;
        status: string;
        checkedAt: Date;
    } | null;
}>;
export declare const deleteSession: (id: number) => Promise<{
    id: number;
    createdAt: Date;
    user: {
        id: number;
        username: string;
        email: string;
        role: {
            id: number;
            name: string;
        };
    };
    userId: number;
    updatedAt: Date;
    _count: {
        mwdData: number;
        witsDataValues: number;
        surveyStations: number;
    };
    sessionCode: string;
    company: string | null;
    wellName: string | null;
    wellId: string | null;
    rigName: string | null;
    fieldName: string | null;
    jobNumber: string | null;
    province: string | null;
    countyParish: string | null;
    country: string | null;
    location: string | null;
    latitude: import("@prisma/client/runtime/library").Decimal | null;
    longitude: import("@prisma/client/runtime/library").Decimal | null;
    notes: string | null;
    connectionStatusId: number | null;
    startedAt: Date;
    endedAt: Date | null;
    connectionStatus: {
        id: number;
        source: string;
        status: string;
        checkedAt: Date;
    } | null;
}>;
export {};
//# sourceMappingURL=mwd-session.service.d.ts.map