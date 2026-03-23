
Audit result (what is currently broken):
1) Signup is failing intermittently because confirmation emails are still being sent and hitting a backend email rate limit (`/signup` returning 429 `email rate limit exceeded` in auth logs).
2) New signup records confirm this: latest user is created with `email_confirmed_at = null`, so email confirmation is still active.
3) `src/pages/Auth.tsx` uses one strict schema for both signup and login. That means login can be blocked by signup-only password rules (bad UX and false failures).
4) Error handling currently shows raw backend errors, which makes failures confusing.

Implementation plan:
1) Align auth mode with your request (“disable email confirmation for now”):
   - Update Lovable Cloud auth setting so new users are auto-confirmed during testing.
   - Re-verify by checking a fresh signup creates a session immediately (no confirmation email flow).
2) Fix frontend validation separation in `src/pages/Auth.tsx`:
   - Create `loginSchema` (email + non-empty password only).
   - Keep strict `signupSchema` for registration.
3) Improve signup reliability UX:
   - Map common auth errors to friendly messages (`rate limit`, `already registered`, `invalid email`).
   - Keep password requirements visible during signup and add a compact “all requirements met” state before submit.
4) Tighten post-signup behavior:
   - If session exists → navigate to onboarding.
   - If session does not exist (fallback mode) → clear explanation + next-step CTA.
5) Regression-check the full auth flow:
   - Signup with valid password (new email)
   - Immediate login
   - Forgot password + reset page
   - Repeat signup attempts to confirm no more rate-limit blocker in normal usage

Technical details (files/settings to touch):
- `src/pages/Auth.tsx` (schema split, error mapping, clearer success/error flow)
- Optional helper: `src/lib/authErrors.ts` (centralized auth error-to-message mapping)
- Lovable Cloud auth setting: temporary auto-confirm for testing (no DB migration required)

Done criteria:
- New users can register in one attempt without verification-email dependency.
- Login is no longer blocked by signup-only password constraints.
- Errors are actionable and human-readable.
- End-to-end signup/login/reset path works reliably in preview.
