from __future__ import annotations

import json
import zipfile
from hashlib import sha256
from pathlib import Path

import pytest

from supervisor.app.main import _verify_backup


def test_verify_backup_success(tmp_path: Path) -> None:
    dump_bytes = b"not-a-real-dump-but-non-empty"
    manifest = {
        "product_name": "KUTM",
        "kutm_version": "0.1.0",
        "created_at": "2026-03-03T00:00:00Z",
        "format_version": 1,
        "schema_heads": {"expected_heads": ["abc"], "current_heads": ["abc"]},
        "db_dump_format": "pg_dump_custom",
        "checksums": {
            "db.dump": sha256(dump_bytes).hexdigest(),
        },
    }
    manifest_bytes = json.dumps(manifest).encode("utf-8")
    checksums = f"{sha256(manifest_bytes).hexdigest()}  manifest.json\n{sha256(dump_bytes).hexdigest()}  db.dump\n"

    backup_file = tmp_path / "sample.kutmbackup"
    with zipfile.ZipFile(backup_file, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", manifest_bytes)
        archive.writestr("db.dump", dump_bytes)
        archive.writestr("checksums.txt", checksums)

    result = _verify_backup(str(backup_file))
    assert result["file"] == "sample.kutmbackup"
    assert int(result["size_bytes"]) > 0


def test_verify_backup_checksum_mismatch(tmp_path: Path) -> None:
    backup_file = tmp_path / "broken.kutmbackup"
    manifest = {
        "product_name": "KUTM",
        "kutm_version": "0.1.0",
        "created_at": "2026-03-03T00:00:00Z",
        "format_version": 1,
        "schema_heads": {"expected_heads": ["abc"], "current_heads": ["abc"]},
        "db_dump_format": "pg_dump_custom",
        "checksums": {"db.dump": "deadbeef"},
    }
    with zipfile.ZipFile(backup_file, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest))
        archive.writestr("db.dump", b"content")

    with pytest.raises(RuntimeError, match="checksum mismatch"):
        _verify_backup(str(backup_file))
