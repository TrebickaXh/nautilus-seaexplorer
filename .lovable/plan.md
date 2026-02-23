

## Database Cleanup: Stale Data Only

### What will be deleted

1. **10,220 overdue pending task instances** - All `task_instances` where `status = 'pending'` and `due_at < now()` (dating back to Oct 2025)
2. **12,326 edge function logs** - Debug logs, no longer needed
3. **Old onboarding sessions** - 37 completed/abandoned sessions

### What will be kept

- ~1,235 future pending task instances
- 46 completed/skipped task instances (historical)
- 49 completions (historical records)
- All configuration: routines, shifts, locations, departments, users, profiles

### Then: Fix Urgency Scores

After cleanup, we'll fix the urgency system in the same pass:
- Update the `update_task_urgency` function to call the correct `calculate_urgency_score` overload (the one accepting integer criticality and returning 0.0-1.0)
- Drop the old text-based `calculate_urgency_score(timestamptz, text)` function
- Recalculate urgency scores on all remaining pending tasks

### Technical Steps

**Migration SQL will:**

```text
1. DELETE FROM task_instances WHERE status = 'pending' AND due_at < now()
2. DELETE FROM edge_function_logs
3. DELETE FROM onboarding_sessions WHERE status != 'in_progress'
4. Replace update_task_urgency() to use correct function signature
5. Drop old calculate_urgency_score(timestamptz, text)
6. Run SELECT update_task_urgency() to recalculate scores
```

### Expected Result

- Database reduced from ~24,000 rows of clutter to ~1,400 meaningful rows
- Urgency scores will be 0.0-1.0 (not inflated integers)
- Kiosk will show correct percentages and color-coded urgency levels
