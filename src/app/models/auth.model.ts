export interface UserProfile {
    name: string;
    email: string;
    phone: string | null;
}

export interface AuthResponse {
    token: string;
    user: UserProfile;
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterRequest {
    name: string;
    email: string;
    password: string;
}

export interface UpdateProfileRequest {
    name: string;
    email: string;
    phone: string;
}

export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
}
