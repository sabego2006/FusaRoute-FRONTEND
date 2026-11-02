import { LoginResponse } from './auth.model';

/** Espeja la respuesta de GET /api/users/me/totp. */
export interface TotpStatus {
  enabled: boolean;
}

/** Espeja la respuesta de POST /api/users/me/totp/enroll. */
export interface TotpEnrollResponse {
  secret: string;
  otpauthUri: string;
  /** PNG del QR codificado en base64, sin el prefijo `data:`. */
  qrPngBase64: string;
}

/** Cuerpo de la petición POST /api/users/me/totp/confirm. */
export interface TotpConfirmRequest {
  code: string;
}

/** Respuesta de POST /api/users/me/totp/confirm: el JWT completo más los códigos de respaldo. */
export interface TotpConfirmResponse extends LoginResponse {
  recoveryCodes: string[];
}

/**
 * Respuesta de POST /api/users/me/totp/recovery-codes: el conjunto nuevo de
 * códigos de respaldo. Los anteriores dejan de servir y estos se muestran una
 * sola vez, igual que al confirmar el enrolamiento.
 */
export interface RecoveryCodesResponse {
  recoveryCodes: string[];
}
