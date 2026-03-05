

# Nautilus Platform Audit and Improvement Plan

## Current State Summary

Nautilus is a task management platform for frontline teams with: AI onboarding, kiosk mode (PIN-based task completion), routines/scheduling, shift management, reports, and team management. The platform currently has no active users, all cron jobs disabled, and ~2,000 rows of test data.

---

## 1. Issues Found (Things Not Working Well)

### 1A. Dashboard Realtime Subscription Leak
The `loadDashboardData` function in `Dashboard.tsx` creates a new Supabase realtime channel every time it runs but only returns the cleanup function from inside `loadDashboardData` — which is never actually used as a useEffect cleanup. This causes channel subscriptions to stack up infinitely.

### 1B. Auth Flow: Sign-up Skips Email Verification
`Auth.tsx` immediately navigates to `/onboarding` after `signUp()` without waiting for email confirmation. If auto-confirm is off, the user lands on onboarding without a valid session and gets errors.

### 1C. Onboarding: `invite-user` Doesn't Set Password
The invite-user edge function creates users via `admin.createUser()` without setting a password. Invited team members have no way to log in — there's no password reset flow or magic link mechanism.

### 1D. Onboarding: Night Shift Auto-Creation Logic is Flawed
The gap detection logic (line 451) checks `s.start >= "22:00" || s.end <= "06:00"` which would match almost any shift ending before 06:00 (e.g., a morning shift ending at 05:00). This creates unwanted "Night (Auto-created)" shifts.

### 1E. Dashboard "Manage Schedules" Quick Action Links to `/schedules` — Route Doesn't Exist
Line 354 in `Dashboard.tsx` navigates to `/schedules` which is not defined in `App.tsx`. This is a dead link.

### 1F. Settings Page Only Accessible to `org_admin`
Settings page checks `primaryRole !== 'org_admin'` but the sidebar shows it to all roles. Either the sidebar should hide it from non-admins, or settings should show role-appropriate content.

### 1G. Reports Page Has Debug Console Logs
`Reports.tsx` lines 41-62 contain `console.log` debug statements left in production code.

### 1H. `complete-task` and `invite-user` Edge Functions Missing `verify_jwt = false`
`complete-task` is not listed in `config.toml` at all, meaning it defaults to JWT verification. The Kiosk flow calls it without an authenticated session context (PIN-based), which could cause auth failures.

---

## 2. UX and Usability Improvements

### 2A. Loading States Are Bare
Every page shows "Loading..." as plain text. Replace with proper skeleton loaders or a branded spinner component for a polished feel.

### 2B. No Empty State Guidance
When there are no routines, tasks, or shifts, the empty states just say "No X found." Add actionable guidance: "Create your first routine to start generating tasks automatically" with a CTA button.

### 2C. No Search or Filtering on Key Pages
- **Users page**: No search by name/email.
- **Task Routines**: No search/filter by department or location.
- **Shifts**: No filter by location or department.

### 2D. No Breadcrumb Navigation
Pages have inconsistent back buttons. Add breadcrumbs to AppLayout header for consistent navigation context.

### 2E. Kiosk Mode UX Improvements
- PIN input should auto-focus and use a numpad-style input.
- Task completion success should show a clear animated confirmation (checkmark animation) before returning to the task list.
- Add a "clock" display showing current shift time prominently.

### 2F. Dashboard Should Adapt to Role
Currently the dashboard shows the same layout for all roles. Crew members should see their own tasks and a simplified view; managers should see team-level metrics.

### 2G. Mobile Responsiveness
The sidebar collapses but several pages (TaskInstances filters, Reports filters) have horizontal layouts that overflow on mobile. These need responsive stacking.

### 2H. Task Completion from Admin Dashboard
Admins can only complete tasks from the Tasks page or Kiosk. Add inline quick-complete from the dashboard's "Recent Completions" or overdue task cards.

---

## 3. AI Onboarding Improvements

### 3A. Missing Data Attribution Issues
The onboarding collects data but several fields are not properly mapped to the database:

| Collected Field | Status |
|---|---|
| Organization name, timezone | Working |
| Locations + areas | Working |
| Departments | Working |
| Shifts | Working |
| Team members (invite) | Partially broken — no password set, users can't log in |
| Task routines | Working (with name-matching fragility) |
| One-off tasks | Working |
| **Task rules** (assignment type, incomplete action, defer) | **Stored in org settings JSON but never read/used anywhere** |
| **Notifications** (overdue alerts, auto reports, report access) | **Stored in org settings JSON but never read/used anywhere** |
| **Operating days/hours** | **Stored but never used** |
| **Industry** | **Not stored at all** — collected but not saved to the database |

### 3B. Name Matching is Fragile
Routines reference departments, shifts, and areas by name strings. If the AI slightly varies the name (e.g., "Kitchen" vs "kitchen" or "Front Desk" vs "Front desk"), the match fails silently and the routine is skipped.

**Fix**: Use case-insensitive matching and fuzzy matching in `setupOrganization()`.

### 3C. No Progress Indicator
The onboarding mentions "10 steps" but there's no visual step tracker. Users don't know how far along they are.

**Fix**: Track the current step number from the AI response (add a `currentStep` field to the AI tool output) and display a progress bar.

### 3D. No Error Recovery UX
If the organization setup fails partway through (e.g., a routine fails to create), the user sees "Setting up your organization..." then gets redirected to dashboard with incomplete data. No feedback on what failed.

**Fix**: After `setupOrganization()`, return a summary of what was created vs. what failed, and show it to the user before redirecting.

### 3E. AI Model Upgrade
Currently using `google/gemini-2.5-flash`. Upgrade to `google/gemini-3-flash-preview` for better conversational quality and structured output reliability.

### 3F. Conversation History Grows Unbounded
The full conversation is sent to the AI every message. For a 10-step onboarding, this can become very large. Consider summarizing earlier steps or using a sliding window.

---

## 4. Future: In-Platform AI Assistant (Planned for Later)

This would be a floating chat widget accessible from the AppLayout that helps managers:
- Navigate to the right page ("Show me overdue tasks" -> navigates to Tasks with overdue filter)
- Explain metrics ("What does urgency score mean?")
- Create routines through conversation
- Generate reports

**Architecture**: A new `ai-assistant` edge function using Lovable AI with a system prompt aware of all platform features, plus a `<ChatWidget>` component in AppLayout.

This is noted for a later phase as requested.

---

## Implementation Priority (Recommended Order)

### Phase 1: Fix Critical Issues
1. Fix realtime subscription leak in Dashboard
2. Add `complete-task` to `config.toml` with `verify_jwt = false`
3. Fix dead `/schedules` link in Dashboard
4. Fix auth flow — handle unconfirmed email gracefully
5. Fix night shift auto-creation logic
6. Remove debug console.logs from Reports

### Phase 2: Onboarding Improvements
7. Add case-insensitive name matching in `setupOrganization()`
8. Add onboarding progress indicator (step tracker)
9. Add setup completion summary with success/failure counts
10. Upgrade AI model to `gemini-3-flash-preview`
11. Fix invite-user to handle password setup flow
12. Store industry field in organizations table

### Phase 3: UX Polish
13. Add skeleton loading states across all pages
14. Improve empty states with CTAs
15. Add search/filter to Users, Routines, Shifts pages
16. Add breadcrumb navigation to AppLayout
17. Make filter layouts responsive for mobile
18. Role-adaptive dashboard views

