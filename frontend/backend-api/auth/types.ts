export type AuthUser = {
    _id: string;
    name: string;
    email: string;
    isSuper: boolean;
    isVerified: boolean;
    roleId?: string;
    /** What the user's role allows, resource by resource. */
    permissions?: { resource: string; actions: string[] }[];
};

export type LoginResponse = {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
};
