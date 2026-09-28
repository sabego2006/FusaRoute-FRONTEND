/** Espeja RegisterUserResponse del backend (POST /api/auth/register → 201). */
export interface RegisterResponse {
  id: number;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  active: boolean;
}

/** Cuerpo de la petición POST /api/auth/register. */
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

/** Espeja LoginResponse del backend (POST /api/auth/login → 200). */
export interface LoginResponse {
  token: string;
  tokenType: string;
  expiresAt: string;
  user: UserSummary;
}

/** Datos del usuario dentro de LoginResponse. Sin passwordHash. */
export interface UserSummary {
  id: number;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  active: boolean;
}

/** Cuerpo de la petición POST /api/auth/login. */
export interface LoginCredentials {
  email: string;
  password: string;
}

/** Espeja UserProfileResponse del backend (GET/PUT /api/users/me). */
export interface UserProfile {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: 'USER' | 'ADMIN';
}

/** Cuerpo de la petición PUT /api/users/me. */
export interface UpdateProfileRequest {
  name: string;
  email: string;
  phone: string | null;
}

/** Cuerpo de la petición PUT /api/users/me/password. */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** Una violación de campo en el cuerpo de error 400 del backend. */
export interface FieldViolation {
  field: string;
  message: string;
}

/** Cuerpo de error ProblemDetail (RFC 9457) del backend. */
export interface ProblemDetail {
  type?: string;
  title?: string;
  status: number;
  detail: string;
  errors?: FieldViolation[];
}
