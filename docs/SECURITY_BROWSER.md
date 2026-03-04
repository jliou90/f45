# Browser Security Posture

## Token storage

- Access and refresh tokens are stored in `sessionStorage` plus in-memory cache.
- Legacy tokens found in `localStorage` are migrated once to `sessionStorage` and removed.
- This reduces long-lived token persistence across browser restarts.

## Headers

- API responses include strict security headers (`CSP`, `Permissions-Policy`, `COOP`, `CORP`, `X-Frame-Options`, `nosniff`).
- Nginx serving the frontend also sets CSP and related hardening headers.

## Operational note

- Browser UI remains read-only for privileged control actions.
- Start/stop/backup/restore/diagnostics are routed through local supervisor/control panel.
