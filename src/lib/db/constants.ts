export const accountStatuses = ["ACTIVE", "SUSPENDED", "DISABLED"] as const;
export type AccountStatus = (typeof accountStatuses)[number];

export const roleKeys = ["SUPER_ADMIN", "ADMIN", "STAFF"] as const;
export type RoleKey = (typeof roleKeys)[number];

export const loginEventTypes = [
  "login_succeeded",
  "login_failed",
  "logout",
  "session_revoked",
  "auth_throttled",
  "password_changed",
  "password_reset_requested",
  "password_reset_completed",
  "mfa_challenge_issued",
  "mfa_succeeded",
  "mfa_failed",
  "mfa_enrolled",
  "mfa_disabled",
  "recovery_code_used",
  "otp_sent",
  "otp_failed",
] as const;
export type LoginEventType = (typeof loginEventTypes)[number];

export const eventOutcomes = ["success", "failure", "denied", "pending"] as const;
export type EventOutcome = (typeof eventOutcomes)[number];

export const failureCodes = [
  "unknown_email",
  "invalid_password",
  "account_unavailable",
  "rate_limited",
  "mfa_invalid",
  "mfa_expired",
  "validation_error",
  "otp_invalid",
  "otp_expired",
] as const;
export type FailureCode = (typeof failureCodes)[number];

export const auditOutcomes = ["success", "failure"] as const;
export type AuditOutcome = (typeof auditOutcomes)[number];
