/**
 * Resolves the admin app's public URL.
 * Priority: APP_URL env > Vercel production URL > localhost fallback.
 */
export function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3001";
}
