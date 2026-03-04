# SLO and Alerting Baseline

## Service Indicators

- Availability:
  - `GET /health`
  - `GET /readyz`
- API correctness:
  - HTTP 5xx rate from `kutm_http_requests_total`
- Latency:
  - request duration buckets from `kutm_http_request_duration_ms_bucket`
- Dependency health:
  - `GET /api/v1/ops/health`
  - DB migration/constraint checks from CI

## Minimum Alerts

- Health endpoint unavailable for 2 minutes
- Error ratio (`5xx / total`) > 2% for 5 minutes
- P95 latency > 750ms for 10 minutes
- DB connectivity failures in `/api/v1/ops/health`

## Drill Procedure

Run periodic synthetic drill and retain evidence:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-slo-drill.ps1
```

Save `artifacts/slo-drill.json` with incident/release records.
