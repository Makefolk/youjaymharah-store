import type {
  MedusaRequest,
  MedusaResponse,
  MedusaNextFunction,
} from "@medusajs/framework/http";

export function enforcePasswordPolicy(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const password = (req.body as { password?: unknown } | undefined)?.password;
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  ) {
    res
      .status(400)
      .json({ message: "Use a password between 8 and 128 characters." });
    return;
  }
  next();
}
