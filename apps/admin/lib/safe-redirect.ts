/**
 * Return a same-origin relative path suitable for client navigation, or
 * `fallback` if `next` is missing, absolute, or protocol-relative.
 *
 * Guards `?next=` query params from being used as an open-redirect vector:
 * Next.js `router.push` performs a hard cross-origin navigation when handed
 * an absolute or `//`-prefixed URL, so a crafted `/login?next=https://evil.com`
 * would bounce a freshly-authed user off-site.
 */
export function safeRedirect(next: string | null, fallback: string): string {
  if (!next) return fallback;
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  return fallback;
}
