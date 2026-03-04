# Supervisor API (v1 Contract)

Supervisor is local-only and expected to be reachable at `http://127.0.0.1:7331`.

## Response Envelope

All endpoints return:

```json
{
  "ok": true,
  "code": "string_code",
  "message": "Human readable message",
  "data": {},
  "request_id": "optional-request-id"
}
```

`data` and `request_id` are optional.

## Endpoints

- `GET /status`
- `POST /stack/start`
- `POST /stack/stop`
- `POST /stack/restart`
- `POST /backup`
- `POST /backup/verify`
- `POST /restore`
- `POST /diagnostics`

## Notes

- `POST /restore` requires explicit confirmation phrase (`RESTORE_KUTM` by default) and is intended for dev/technician-controlled use.
- Scheduled backups are supported when enabled via environment:
  - `KUTM_BACKUP_SCHEDULE_ENABLED=1`
  - `KUTM_BACKUP_SCHEDULE_INTERVAL_MINUTES=1440`
  - `KUTM_BACKUP_RETENTION_COUNT=14`
- Privileged stack control/backup/diagnostics actions are intended for Control Panel (tray/service), not the web UI.
