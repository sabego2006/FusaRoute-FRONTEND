/**
 * Guardia anti-PROD: estas pruebas crean y modifican datos reales de DEV, así que solo
 * pueden correr contra el backend local. Si la URL apunta a un host desplegado, se
 * aborta antes de hacer una sola petición.
 */
const PROHIBIDOS = ['onrender.com', 'vercel.app', 'supabase.co'];

export function backendUrl(): string {
  return (process.env['E2E_API_URL'] ?? 'http://localhost:8080').replace(/\/+$/, '');
}

export function assertBackendLocal(url: string = backendUrl()): void {
  const extra = (process.env['PROD_HOST'] ?? '').trim();
  const prohibidos = extra ? [...PROHIBIDOS, extra] : PROHIBIDOS;
  const host = new URL(url).hostname;
  const hit = prohibidos.find((p) => host.includes(p));
  if (hit) {
    throw new Error(`GUARDIA: el backend ${url} parece desplegado (${hit}). Las pruebas E2E del admin solo corren contra el backend local.`);
  }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(host)) {
    throw new Error(`GUARDIA: el backend ${url} no es local (localhost/127.0.0.1).`);
  }
}
