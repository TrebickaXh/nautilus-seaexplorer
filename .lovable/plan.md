

# Clean Up Unused Database Tables

Remove 10 orphaned tables that have no application code references and are not part of any active feature.

## Tables to Drop

| Table | Rows | Reason |
|---|---|---|
| `labor_rules` | 0 | No code references |
| `positions` | 0 | No code references |
| `schedule_notes` | 0 | No code references |
| `schedule_templates` | 0 | No code references |
| `shift_claims` | 0 | No code references |
| `swap_requests` | 0 | No code references |
| `time_off_requests` | 0 | No code references |
| `suggestions` | 0 | No code references |
| `schedule_assignments` | 179 | No code references |
| `open_shift_pool` | 301 | No code references |

## Also Clean Up

- Drop associated custom enum types that are only used by these tables: `assignment_status`, `claim_status`, `swap_type`, `swap_status`, `suggestion_status`
- Drop the `trg_check_shift_department` database function if it's only used by triggers on these tables

## Implementation

Single database migration that:
1. Drops all 10 tables (with `CASCADE` to remove RLS policies and foreign key references automatically)
2. Drops orphaned enum types
3. No code changes needed since nothing references these tables

## What We Keep

- `audit_events` and `edge_function_logs` — written to by edge functions, useful for debugging
- `shift_reports` — part of the reporting schema, may be wired up later

