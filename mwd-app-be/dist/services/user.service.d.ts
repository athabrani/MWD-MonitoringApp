type CreateUserInput = {
    roleId: number;
    username: string;
    email: string;
    password: string;
    isActive?: boolean;
};
type UpdateUserInput = {
    roleId?: number;
    username?: string;
    email?: string;
    password?: string;
    isActive?: boolean;
};
export declare const createUser: (input: CreateUserInput) => Promise<{
    id: number;
    createdAt: Date;
    roleId: number;
    username: string;
    email: string;
    isActive: boolean;
    lastLoginAt: Date | null;
    updatedAt: Date;
    role: {
        id: number;
        name: string;
    };
}>;
export declare const getAllUsers: () => Promise<{
    id: number;
    createdAt: Date;
    roleId: number;
    username: string;
    email: string;
    isActive: boolean;
    lastLoginAt: Date | null;
    updatedAt: Date;
    role: {
        id: number;
        name: string;
    };
}[]>;
export declare const getUserById: (id: number) => Promise<{
    id: number;
    createdAt: Date;
    roleId: number;
    username: string;
    email: string;
    isActive: boolean;
    lastLoginAt: Date | null;
    updatedAt: Date;
    role: {
        id: number;
        name: string;
    };
} | null>;
export declare const updateUser: (id: number, input: UpdateUserInput) => Promise<{
    id: number;
    createdAt: Date;
    roleId: number;
    username: string;
    email: string;
    isActive: boolean;
    lastLoginAt: Date | null;
    updatedAt: Date;
    role: {
        id: number;
        name: string;
    };
}>;
export declare const deleteUser: (id: number) => Promise<{
    id: number;
    createdAt: Date;
    roleId: number;
    username: string;
    email: string;
    isActive: boolean;
    lastLoginAt: Date | null;
    updatedAt: Date;
    role: {
        id: number;
        name: string;
    };
}>;
export {};
//# sourceMappingURL=user.service.d.ts.map