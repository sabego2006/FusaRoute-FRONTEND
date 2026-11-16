/**
 * Abre `uri` en la pestaña actual a través de una ancla efímera, igual que un clic del usuario
 * en un enlace. Sirve para esquemas que no son http (p. ej. `otpauth://`), que Angular no deja
 * enlazar en la plantilla sin marcar la URL como confiable; así el componente no necesita
 * desactivar la sanitización (Sonar S6268). Quien llama valida el esquema antes.
 */
export function openUri(uri: string): void {
  const link = document.createElement('a');
  link.href = uri;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
