

## Plan: Timezone Selector Redesign + Bulk Invite

### 1. Redesign Timezone Selector (Grouped by GMT offset with major cities)

**File: `src/lib/industryTemplates.ts`**

Replace the flat `TIMEZONE_OPTIONS` array with a grouped structure. Each group represents a GMT offset and lists major cities within it.

New format:
```text
GMT -10  — Honolulu
GMT -9   — Anchorage
GMT -8   — Los Angeles, Vancouver
GMT -7   — Denver, Phoenix
GMT -6   — Chicago, Mexico City
GMT -5   — New York, Toronto, Bogotá
GMT -3   — São Paulo, Buenos Aires
GMT  0   — London, Reykjavik, Lisbon
GMT +1   — Paris, Berlin, Rome, Madrid, Amsterdam
GMT +2   — Helsinki, Athens, Cairo, Johannesburg
GMT +3   — Moscow, Istanbul, Dubai (note: Dubai is +4, will be separate)
GMT +4   — Dubai
GMT +5   — Karachi
GMT +5:30 — Mumbai, Delhi
GMT +6   — Dhaka
GMT +7   — Bangkok, Jakarta
GMT +8   — Singapore, Shanghai, Hong Kong, Perth
GMT +9   — Tokyo, Seoul
GMT +10  — Sydney, Melbourne
GMT +12  — Auckland
```

Each option's label will show: `(GMT +1) Paris, Berlin, Rome, Madrid`
The `value` will remain a single canonical IANA timezone (e.g. `Europe/Paris`) since the DB stores one timezone string.

**File: `src/components/onboarding/OnboardingStep1.tsx`**

Update the Combobox to use `CommandGroup` elements for visual grouping by GMT offset. Search will match on city names and GMT values.

### 2. Bulk Invite via CSV Template

**File: `src/pages/Users.tsx`**

Add a "Bulk Import" button next to the existing "Add Team Member" button.

**New file: `src/components/BulkInviteDialog.tsx`**

A dialog with two steps:
1. **Download Template** — generates and downloads a CSV file with headers: `email, display_name, role, phone, employee_id, shift_type`. Role column includes a note that valid values are `crew`, `location_manager`, `org_admin`.
2. **Upload & Preview** — user uploads the filled CSV. Parse it client-side, show a preview table with validation (highlight rows with errors like missing email, invalid role). Show count of valid/invalid rows.
3. **Submit** — loop through valid rows calling the existing `invite-user` edge function for each. Show a progress indicator and summary of successes/failures.

The template CSV will not include `location_id` or `department_id` (UUIDs are not user-friendly). Instead, the dialog will have a single Location and Department selector at the top that applies to all imported users — since bulk imports typically target one location/department.

### Technical Details

- **Timezone grouping**: The grouped array will use a structure like `{ group: string; options: { value: string; label: string }[] }[]` and render with multiple `CommandGroup` elements in the combobox.
- **CSV generation**: Use `Blob` + `URL.createObjectURL` for client-side CSV download. No external library needed.
- **CSV parsing**: Use a simple split-based parser (no library) since the template is controlled and simple. Handle quoted fields for names with commas.
- **Bulk invite calls**: Sequential calls to `invite-user` edge function with a small delay to avoid rate limiting. Show progress as "3 of 12 invited..."
- **No DB changes needed** — reuses existing `invite-user` edge function.

### Files to create/edit
- `src/lib/industryTemplates.ts` — replace `TIMEZONE_OPTIONS` with grouped version
- `src/components/onboarding/OnboardingStep1.tsx` — update combobox to render groups
- `src/components/BulkInviteDialog.tsx` — new component
- `src/pages/Users.tsx` — add Bulk Import button and dialog

