# Pagination and Filtering Matrix

Purpose: keep list endpoint behavior consistent and visible at release time.

## Conventions
- Pagination envelope: `PageResult` with `items` + `meta`.
- Standard query params: `page`, `size`.
- Optional sort params: `sort`, `order` (module-specific allowed fields enforced server-side).
- Optional search/filter params: module-specific and documented below.

## Matrix
| Endpoint | Pagination | Sort | Filters/Search |
|---|---|---|---|
| `GET /api/v1/dms/customers` | `page,size` | yes | `q` |
| `GET /api/v1/dms/vehicles` | `page,size` | yes | `q` |
| `GET /api/v1/dms/appointments` | `page,size` | yes | `status`, `from_date`, `to_date` |
| `GET /api/v1/deals/queue/by-state` | `page,size` | yes | `state`, `q` |
| `GET /api/v1/inventory/queue` | `page,size` | yes | `state`, `q` |
| `GET /api/v1/funding/queue` | `page,size` | yes | `status`, `q` |
| `GET /api/v1/service/queue` | `page,size` | yes | `status`, `q` |
| `GET /api/v1/audit/events` | `page,size` | yes | `entity_type`, `entity_id`, `actor_id`, `action`, date window |

## Verification artifacts
- `backend/tests/test_api_contract_hardening.py`
- `backend/tests/test_patch_f_contract_regressions.py`
- `backend/tests/test_openapi_generation.py`

## Release sign-off
- [ ] New list endpoints are added to this matrix.
- [ ] Response envelope shape remains `PageResult`.
- [ ] OpenAPI and frontend generated types are up to date.
