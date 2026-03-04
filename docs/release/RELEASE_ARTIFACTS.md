# Dealer Install Release Artifacts

This repository ships a local-first appliance bundle for dealer install. The release output is assembled by `scripts/build-release.ps1` into `release_out/`.

## Included

- `frontend_dist/`: compiled frontend assets from `frontend/dist/`
- `compose/`: compose/runtime files required to run local services
  - `docker-compose.yml`
- `MANIFEST.json`: release metadata (`version`, `git_sha`, creation timestamp)
- `VERSION`: canonical product version

## Excluded

- Source-only and dev-only directories (`frontend/node_modules`, `backend/.venv`, caches, logs)
- Local appliance runtime data under `C:\KUTM\...`
- Secrets and local TLS material

## Notes

- v1 includes backup, backup verification, and diagnostics collection.
- Restore is intentionally excluded from v1 and planned for v1.1.
