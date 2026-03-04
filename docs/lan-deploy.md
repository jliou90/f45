# KUTM LAN Pilot Deployment (Single Origin HTTPS)

This guide deploys KUTM on one LAN server with one browser origin:

- `https://kutm.local/` for frontend
- `https://kutm.local/api/*` proxied to backend (`/api/v1/*` unchanged)

## Prerequisites

- Docker Desktop (Windows server PC)
- PowerShell 5.1+ (PowerShell 7 preferred)
- `mkcert` installed and in `PATH`

## 1) Create `.env` from `.env.example`

From repo root:

```powershell
Copy-Item .env.example .env
```

Then edit `.env`:

- set `KUTM_HOSTNAME` (default `kutm.local`)
- set strong `JWT_SECRET` (required when `APP_ENV=prod`)
- set `TRUSTED_HOSTS` to include `kutm.local`, server hostname, and server LAN IP
- optionally set `KUTM_SEED_TENANT`, `KUTM_SEED_EMAIL`, `KUTM_SEED_PASSWORD`

## 2) Generate TLS certs with mkcert

From repo root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\tls\mkcert-setup.ps1 -Domain kutm.local
```

This creates cert/key in `./secrets/tls/` (git-ignored).

## 3) Point `kutm.local` to server LAN IP

Use local DNS or hosts entries.

Server and workstation hosts file example:

```text
192.168.1.50 kutm.local
```

## 4) Bring up stack

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\lan-up.ps1
```

This validates `.env`, TLS files, prod secret guardrails, starts compose, and waits for `https://<host>/readyz`.

## 5) Verify HTTPS endpoints

Expected to return `200`:

- `https://kutm.local/`
- `https://kutm.local/readyz` with `{"ready": true, ...}`
- `https://kutm.local/api/v1/ops/health`
- `https://kutm.local/openapi.json`

Run checker:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-deploy.ps1
```

## 6) Seed first admin (optional)

Automatic seed during API startup only runs when all are set in `.env`:

- `KUTM_SEED_TENANT`
- `KUTM_SEED_EMAIL`
- `KUTM_SEED_PASSWORD`

Idempotent behavior:

- tenant is created if missing
- user is created if missing
- ADMIN membership is created if missing
- password is not rotated unless `KUTM_SEED_FORCE_PASSWORD=true`

Manual run:

```powershell
docker compose exec api python seed_admin.py
```

## Workstation Setup

1. Add `kutm.local` hosts entry (or use LAN DNS).
2. Trust the mkcert CA used on the server:

```powershell
mkcert -CAROOT
```

Import the CA root certificate from that directory into workstation Trusted Root Certification Authorities.

## Backup and Restore

Create compressed custom-format backup (`.dump`):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\backup-db.ps1
```

Restore backup (requires explicit confirmation switch):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\restore-db.ps1 -BackupFile C:\KUTM\Backups\kutm_YYYYMMDD_HHMMSS.dump -Confirm
```

## Contract Drift Guard

Create/update baseline intentionally:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\contract-snapshot.ps1
```

Check running API against baseline:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\contract-check.ps1
```

If drift is expected, re-run snapshot and commit `contracts/openapi.baseline.json`.

## Frontend Typed OpenAPI Helper

Generate `frontend/src/gen/openapi.d.ts` from running stack:

```powershell
cd .\frontend
npm run gen:openapi:types
npm run check:openapi:types
```

## Logs and Troubleshooting

Follow logs:

```powershell
docker compose logs -f web
docker compose logs -f api
docker compose logs -f postgres
```

Common TLS issues:

- `NET::ERR_CERT_AUTHORITY_INVALID`: CA not trusted on workstation.
- hostname mismatch: cert does not include `kutm.local` or hostname in URL.
- `ERR_CONNECTION_REFUSED`: stack not up or ports 80/443 unavailable.

Stop stack:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\lan-down.ps1
```

Stop and remove volumes (destructive):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\lan-down.ps1 -RemoveVolumes
```
