/**
 * The storefront's Content-Security-Policy and friends, for next.config.
 * Kept free of Next imports so the config and tests can both use it.
 *
 * Next.js inlines its bootstrap scripts and styles, and a nonce-based policy
 * would make every page dynamic (no static or cached pages), so inline
 * scripts are allowed. The policy still stops the page being framed
 * (clickjacking), loading scripts or sending data anywhere but this site
 * and Sentry, and posting forms elsewhere. Payment and Google sign-in leave
 * by navigation, which this doesn't restrict.
 */
export function contentSecurityPolicy({
  imageOrigins,
  sentryDsn,
  development,
}: {
  /** IMAGE_REMOTE_URLS, comma-separated. */
  imageOrigins?: string
  sentryDsn?: string
  development: boolean
}): string {
  const origins = (imageOrigins ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .flatMap((entry) => {
      try {
        return [new URL(entry).origin]
      } catch {
        return []
      }
    })
  let sentry: string[] = []
  try {
    if (sentryDsn) sentry = [new URL(sentryDsn).origin]
  } catch {
    // An unparseable DSN disables Sentry anyway.
  }

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // Development's fast refresh evaluates code.
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...(development ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...origins],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...sentry, ...(development ? ["ws:"] : [])],
    "frame-src": ["'self'"],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
  }

  return [
    ...Object.entries(directives).map(
      ([name, values]) => `${name} ${[...new Set(values)].join(" ")}`,
    ),
    ...(development ? [] : ["upgrade-insecure-requests"]),
  ].join("; ")
}

export function securityHeaders(
  options: Parameters<typeof contentSecurityPolicy>[0],
) {
  return [
    {
      key: "Content-Security-Policy",
      value: contentSecurityPolicy(options),
    },
    // For browsers that predate frame-ancestors.
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=()",
    },
  ]
}
