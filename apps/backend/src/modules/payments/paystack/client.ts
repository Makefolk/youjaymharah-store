import { MedusaError } from "@medusajs/framework/utils";

import type { RedirectProviderOptions } from "../shared/types";

const BASE_URL = "https://api.paystack.co";

export type PaystackOptions = RedirectProviderOptions & {
  /** Secret key (`sk_test_...` / `sk_live_...`). Also verifies webhooks. */
  secretKey: string;
  /** Restrict the channels shown on the hosted page. Defaults to Paystack's own. */
  channels?: string[];
};

export type PaystackTransactionState =
  "pending" | "successful" | "failed" | "canceled";

export class PaystackClient {
  constructor(private readonly options: PaystackOptions) {}

  async initialize(payload: Record<string, unknown>): Promise<{
    reference: string;
    redirectUrl: string;
    raw: Record<string, unknown>;
  }> {
    const data = await this.request<Record<string, unknown>>(
      "POST",
      "/transaction/initialize",
      payload,
    );

    const redirectUrl = data.authorization_url;

    if (typeof redirectUrl !== "string") {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Paystack did not return an authorization_url. Keys received: ${Object.keys(data).join(", ")}`,
      );
    }

    return {
      reference: String(data.reference ?? payload.reference),
      redirectUrl,
      raw: data,
    };
  }

  async verify(reference: string): Promise<{
    state: PaystackTransactionState;
    amountInMinor?: number;
    currencyCode?: string;
    raw: Record<string, unknown>;
  }> {
    const data = await this.request<Record<string, unknown>>(
      "GET",
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );

    return {
      state: normalizeStatus(data.status),
      amountInMinor: typeof data.amount === "number" ? data.amount : undefined,
      currencyCode:
        typeof data.currency === "string" ? data.currency : undefined,
      raw: data,
    };
  }

  async retrieveRefund(id: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      "GET",
      `/refund/${encodeURIComponent(id)}`,
    );
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<T> {
    let response: Response;

    try {
      response = await fetch(`${BASE_URL}${path}`, {
        signal: AbortSignal.timeout(15_000),
        method,
        headers: {
          Authorization: `Bearer ${this.options.secretKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Could not reach Paystack at ${path}: ${(error as Error).message}`,
      );
    }

    const text = await response.text();
    let envelope: { status?: boolean; message?: string; data?: T };

    try {
      envelope = text ? JSON.parse(text) : {};
    } catch {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Paystack returned a non-JSON response (${response.status}): ${text.slice(0, 200)}`,
      );
    }

    if (!response.ok || envelope.status === false) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Paystack ${method} ${path} failed (${response.status}): ${envelope.message ?? text.slice(0, 200)}`,
      );
    }

    return (envelope.data ?? {}) as T;
  }
}

export function normalizeStatus(status: unknown): PaystackTransactionState {
  switch (String(status ?? "").toLowerCase()) {
    case "success":
      return "successful";
    case "failed":
    case "reversed":
      return "failed";
    case "abandoned":
      return "canceled";
    default:
      return "pending";
  }
}
