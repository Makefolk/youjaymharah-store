/** Anything shaped like an address, including one inside <> or (). */
const EMAIL_ADDRESS = /[^\s<>()"',;:@]+@[^\s<>()"',;:@]+/g;

export function redactEmailAddresses(text: string): string {
  return text.replace(EMAIL_ADDRESS, "[email]");
}

/**
 * Resend's reason for a refused send, fit for a log line: its error code and
 * HTTP status, and its message with email addresses blanked. Some messages
 * name the recipient or the account owner ("You can only send testing emails
 * to your own email address (...)"), and logs outlive both.
 *
 * In development the SDK prints its raw errors to the console itself; in
 * production it prints nothing, so this line is the only record of why.
 */
export function describeSendFailure(error: unknown): string {
  if (!error || typeof error !== "object") return "no reason given";

  const { name, statusCode, message } = error as {
    name?: unknown;
    statusCode?: unknown;
    message?: unknown;
  };
  const code = [
    typeof name === "string" ? name : null,
    typeof statusCode === "number" ? String(statusCode) : null,
  ]
    .filter(Boolean)
    .join(" ");
  const detail =
    typeof message === "string" ? redactEmailAddresses(message) : "";

  return [code, detail].filter(Boolean).join(": ") || "no reason given";
}
