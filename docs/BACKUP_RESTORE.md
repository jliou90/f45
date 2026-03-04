# Backup and Restore Runbook

This runbook covers logical Postgres backups for KUTM.

## 1. Create Backup

From repo root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\backup-db.ps1
```

Output:

- writes a custom-format dump (`.dump`) in `C:\KUTM\Backups\` by default

Optional custom output directory:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\backup-db.ps1 -OutputDir .\artifacts\backups
```

## 2. Restore Backup

Restore is destructive. Two supported paths:

### A) Supervisor restore (recommended for appliance flow)

```powershell
$body = @{
  path = "kutm-backup-YYYYMMDD-HHMMSS.kutmbackup"
  confirm_phrase = "RESTORE_KUTM"
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:7331/restore" -ContentType "application/json" -Body $body
```

### B) Dev script restore (database dump path)

Restore is **dev-only** in v1 and is destructive for the target DB.
Re-run with `-Confirm` to proceed.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\restore-db.ps1 `
  -BackupFile C:\KUTM\Backups\kutm_YYYYMMDD_HHMMSS.dump `
  -Confirm
```

## 3. Verify After Restore

- `GET /health`
- `GET /api/v1/ops/health`
- run smoke login and one tenant-scoped read
- run SLO drill snapshot:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-slo-drill.ps1
```

## 4. Backup Policy Guidance

- keep daily backups and at least one weekly retention snapshot
- enable supervisor scheduler for unattended backups (`KUTM_BACKUP_SCHEDULE_ENABLED=1`)
- test restore at least monthly
- store off-machine/off-host copy
- encrypt at rest and in transit
