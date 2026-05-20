export type AuthUser = {
    _id: string;
    name: string;
    email: string;
    isSuper: boolean;
    isVerified: boolean;
    roleId?: string;
};

export type LoginResponse = {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
};
