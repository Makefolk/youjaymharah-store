import { normalizeEmailOutcome } from "../outcome";

const event = (type: string, data: Record<string, unknown> = {}) => ({
  type,
  created_at: "2026-10-21T10:00:00.000Z",
  data: { email_id: "re_123", to: ["buyer@example.com"], ...data },
});

describe("normalizeEmailOutcome", () => {
  it("maps Resend delivery events to outcomes", () => {
    expect(normalizeEmailOutcome(event("email.delivered"))).toEqual({
      provider_id: "re_123",
      outcome: "delivered",
      occurred_at: "2026-10-21T10:00:00.000Z",
      detail: null,
    });
    expect(
      normalizeEmailOutcome(event("email.delivery_delayed"))?.outcome,
    ).toBe("delayed");
    expect(normalizeEmailOutcome(event("email.failed"))?.outcome).toBe(
      "failed",
    );
  });

  it("keeps the bounce reason without the recipient's address", () => {
    const outcome = normalizeEmailOutcome(
      event("email.bounced", {
        bounce: {
          type: "Permanent",
          subType: "General",
          message: "550 buyer@example.com: mailbox does not exist",
        },
      }),
    );
    expect(outcome?.outcome).toBe("bounced");
    expect(outcome?.detail).toBe(
      "Permanent / General: 550 [email]: mailbox does not exist",
    );
  });

  it("ignores events that say nothing about delivery", () => {
    expect(normalizeEmailOutcome(event("email.sent"))).toBeNull();
    expect(normalizeEmailOutcome(event("email.opened"))).toBeNull();
    expect(
      normalizeEmailOutcome({
        type: "contact.updated",
        created_at: "2026-10-21T10:00:00.000Z",
        data: { id: "contact", unsubscribed: true },
      }),
    ).toBeNull();
  });

  it("ignores delivery events without an email id", () => {
    expect(
      normalizeEmailOutcome(event("email.delivered", { email_id: undefined })),
    ).toBeNull();
  });
});
