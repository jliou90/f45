# Repository Structure (Canonical)

## Runtime components

- `backend/`: FastAPI API service and Alembic migrations.
- `frontend/`: canonical web frontend for build and release.
- `supervisor/`: local control-plane API bound to `127.0.0.1:7331` via compose.
- `control_panel/`: Windows service and tray app.

## Archived components

- `attic/kutm-frontend/`: archived legacy frontend, not built, not shipped.

## Release/build scripts use

- Compose web image builds from `frontend/` (`frontend/Dockerfile`).
- `scripts/dev-bootstrap.ps1` installs frontend dependencies in `frontend/`.
- `scripts/build-release.ps1` builds and exports frontend assets from `frontend/`.
