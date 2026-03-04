# Backend Boot Paths

Primary deployment path (LAN pilot):
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\lan-up.ps1
```

See `docs/lan-deploy.md` for full HTTPS + mkcert setup.

## Backend Dev Boot

Canonical command (run from repo root):
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

Optional flags:
- `-SkipComposeUp`: do not run `docker compose up`; use when local Postgres is already running
- `-SkipSmoke`: skip API smoke checks
- `-Host <host>` and `-Port <port>`: override API bind address

Script behavior:
1. Ensures `backend/.env` exists (copies from `.env.example` if missing)
2. Ensures `backend/.venv` exists and installs dependencies
3. Verifies DB reachability and starts Docker Postgres when needed
4. Runs migrations (`alembic upgrade head`)
5. Runs deterministic seed (`seed_admin.py`)
6. Starts API with Uvicorn
7. Runs smoke (`tools/smoke_api.ps1`) unless `-SkipSmoke`

If smoke fails, the script exits with an error and stops the spawned API process.

Default dev seed/smoke credentials:
- Email: `you@example.com`
- Password: `Password123!`
- Tenant: `Default`
- Override via env: `KUTM_SEED_EMAIL`, `KUTM_SEED_PASSWORD`, `KUTM_SEED_TENANT`

Feature flag defaults:
- `KUTM_FLAG_SCAFFOLD_ENABLED=0` keeps scaffold-only frontend modules hidden by default.
- `KUTM_FLAG_REALTIME_STUB_ENABLED=0` keeps `/api/v1/ops/events` disabled by default.
