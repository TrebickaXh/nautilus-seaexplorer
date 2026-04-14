

## Fix: Kiosk Not Showing Overnight/Cross-Midnight Shifts

### Root Cause
In `src/pages/Kiosk.tsx` line 144-146, the active shift filter uses a naive time comparison that fails when `end_time <= start_time` (shift crosses midnight):

```typescript
const isTimeInRange = currentTime >= shift.start_time.slice(0, 5) 
                   && currentTime <= shift.end_time.slice(0, 5);
```

Your "Debugging" shift is 14:00-00:00. At 17:05, `"17:05" <= "00:00"` evaluates to false, so it's excluded.

The dashboard's `ShiftInProgressCard` already handles this correctly with an overnight check.

### Fix
**File: `src/pages/Kiosk.tsx`** (lines 144-147)

Replace the time range check with overnight-aware logic:

```typescript
const currentActiveShifts = shifts?.filter((shift: Shift) => {
  const start = shift.start_time.slice(0, 5);
  const end = shift.end_time.slice(0, 5);
  if (end <= start) {
    // Overnight shift: active if current time is after start OR before end
    return currentTime >= start || currentTime < end;
  }
  return currentTime >= start && currentTime < end;
}) || [];
```

This mirrors the exact logic already used in `ShiftInProgressCard.tsx`. One file changed, ~5 lines replaced.

