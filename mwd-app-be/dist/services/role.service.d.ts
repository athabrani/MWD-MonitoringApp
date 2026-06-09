export declare const syncSystemRoles: () => Promise<void>;
export declare const createRole: (name: string) => Promise<{
    id: number;
    createdAt: Date;
    updatedAt: Date;
    name: string;
}>;
export declare const getAllRoles: () => Promise<{
    id: number;
    createdAt: Date;
    updatedAt: Date;
    name: string;
}[]>;
export declare const getRoleById: (id: number) => Promise<{
    id: number;
    createdAt: Date;
    updatedAt: Date;
    name: string;
} | null>;
export declare const updateRole: (id: number, name: string) => Promise<{
    id: number;
    createdAt: Date;
    updatedAt: Date;
    name: string;
}>;
export declare const deleteRole: (id: number) => Promise<{
    id: number;
    createdAt: Date;
    updatedAt: Date;
    name: string;
}>;
//# sourceMappingURL=role.service.d.ts.map