const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /\+?\d?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;

export function redactSecrets(input: string): string {
  return input
    .replace(/authorization:\s*[^\s]+/gi, "authorization:[REDACTED]")
    .replace(/bearer\s+[a-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/(access_token|refresh_token|token)=([^&\s]+)/gi, "$1=[REDACTED]")
    .replace(/cookie:\s*[^\s]+/gi, "cookie:[REDACTED]");
}

export function redactPii(input: string): string {
  return redactSecrets(input).replace(EMAIL_RE, "[REDACTED_EMAIL]").replace(PHONE_RE, "[REDACTED_PHONE]");
}

export function sanitizeUrl(url: string): { url: string; path: string } {
  try {
    const parsed = new URL(url, window.location.origin);
    return { url: `${parsed.origin}${parsed.pathname}`, path: parsed.pathname };
  } catch {
    return { url, path: url };
  }
}
