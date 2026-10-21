import type { PaystackOptions } from "./paystack/client";
import type { CredoOptions } from "./credo/types";

/**
 * Gateway options from the environment, shared by medusa-config.ts and the
 * admin payment lookup, which asks the gateways directly and so needs the
 * same keys without going through the payment module.
 */

export function credoOptionsFromEnv(env = process.env): CredoOptions {
  return {
    publicKey: env.CREDO_PUBLIC_KEY as string,
    secretKey: env.CREDO_SECRET_KEY as string,
    mode: env.CREDO_MODE === "live" ? "live" : "test",
    callbackUrl: env.PAYMENT_CALLBACK_URL,
    webhookToken: env.CREDO_WEBHOOK_TOKEN,
    businessCode: env.CREDO_BUSINESS_CODE,
  } as CredoOptions;
}

export function paystackOptionsFromEnv(env = process.env): PaystackOptions {
  return {
    secretKey: env.PAYSTACK_SECRET_KEY as string,
    callbackUrl: env.PAYMENT_CALLBACK_URL,
  };
}
