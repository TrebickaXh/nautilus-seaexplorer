

## Disable All 6 Cron Jobs

### What will happen

All 6 active cron jobs will be unscheduled using `cron.unschedule()`. This stops all scheduled backend function invocations (~860+/day) immediately.

### Jobs to disable

| Job | Schedule | Daily calls |
|-----|----------|-------------|
| materialize-tasks-v2 | Every 5 min | ~288 |
| materialize-tasks-6hr | Every 6 hrs | ~4 |
| update-urgency | Every 5 min | ~288 |
| update-urgency-5min | Every 5 min | ~288 |
| update-urgency-every-5-minutes | Every 5 min (duplicate) | ~288 |
| defer-tasks | Every hour | ~24 |

### What will be kept

- All edge function code (materialize-tasks-v2, update-urgency, defer-tasks) remains deployed and callable manually
- All database functions (update_task_urgency, calculate_urgency_score) remain intact
- All data, configuration, users untouched

### Technical Steps

```text
1. SELECT cron.unschedule('materialize-tasks-v2');
2. SELECT cron.unschedule('materialize-tasks-6hr');
3. SELECT cron.unschedule('update-urgency');
4. SELECT cron.unschedule('update-urgency-5min');
5. SELECT cron.unschedule('update-urgency-every-5-minutes');
6. SELECT cron.unschedule('defer-tasks');
```

### Result

- Zero scheduled invocations going forward
- Cloud usage drops to near-zero (only on-demand requests from the app itself)
- You can re-enable any job later when ready to use the platform actively

