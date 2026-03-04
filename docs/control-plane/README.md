# KUTM Control Plane (v1)

KUTM v1 ships a local-only control plane with two pieces:

- `supervisor/` container: local HTTP control API on `127.0.0.1:7331`
- `control_panel/` Windows service + tray: privileged UX for stack control and support actions

## Local-First Guarantees

- No cloud dependency
- Supervisor bound to localhost only
- Backup files written to `C:\KUTM\Backups`
- Diagnostics bundles written to `C:\KUTM\Support`

## Backups (v1)

- Trigger with `POST /backup`
- Output is `.kutmbackup` (zip with manifest + db dump + checksums)
- Verify with `POST /backup/verify`
- Scheduled backups can be enabled in supervisor env (`KUTM_BACKUP_SCHEDULE_ENABLED=1`)
- Restore is available behind explicit confirmation via `POST /restore` and is intended for technician/dev workflows.

## Diagnostics for Support

- Trigger with `POST /diagnostics` (or tray button)
- Bundle includes:
  - status snapshot
  - container log tails
  - docker version info (best effort)
  - backend `/api/v1/ops/version` + `/readyz` snapshot (best effort)
- Sensitive token/password patterns are redacted.

## Related Docs

- [SUPERVISOR_API.md](./SUPERVISOR_API.md)
- [PATHS.md](./PATHS.md)
- [BACKUPS.md](./BACKUPS.md)
- [CONTROL_PANEL.md](./CONTROL_PANEL.md)
- [FIRST_DEALER_INSTALL_CHECKLIST.md](./FIRST_DEALER_INSTALL_CHECKLIST.md)
