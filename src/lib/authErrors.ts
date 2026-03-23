/**
 * Maps raw Supabase auth error messages to user-friendly strings.
 */
export function friendlyAuthError(raw: string): string {
  const lower = raw.toLowerCase();

  if (lower.includes("rate limit") || lower.includes("rate_limit"))
    return "Too many attempts — please wait a minute and try again.";

  if (lower.includes("user already registered") || lower.includes("already been registered"))
    return "An account with this email already exists. Try signing in instead.";

  if (lower.includes("invalid login credentials"))
    return "Incorrect email or password. Please try again.";

  if (lower.includes("email not confirmed"))
    return "Please verify your email before signing in.";

  if (lower.includes("invalid email"))
    return "Please enter a valid email address.";

  if (lower.includes("weak password") || lower.includes("password"))
    return "Your password doesn't meet the requirements. Please check and try again.";

  if (lower.includes("network") || lower.includes("fetch"))
    return "Network error — please check your connection and try again.";

  return raw;
}
