# Backup Format (`.kutmbackup`)

KUTM v1 backup artifacts are ZIP files with extension `.kutmbackup`.

## Required entries

- `manifest.json`
- `db.dump` (PostgreSQL custom format from `pg_dump -Fc`)

## Manifest shape

`manifest.json` includes:

- `product_name` (`"KUTM"`)
- `kutm_version`
- `created_at` (UTC ISO timestamp)
- `format_version` (`1`)
- `schema_heads` (`expected_heads` / `current_heads`)
- `db_dump_format` (`pg_dump_custom`)
- `checksums` object containing SHA-256 value for `db.dump`

## Verification

`POST /backup/verify` validates:

- zip readability
- required files present
- manifest fields present
- checksum match
- `db.dump` exists and size is greater than zero

## Restore

`POST /restore` restores a verified `.kutmbackup` into Postgres after explicit confirmation phrase validation.
This path is intended for local technician/dev workflows.
