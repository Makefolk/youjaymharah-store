import { captureNewsletterSignup } from "../steps/capture-newsletter-signup";
import { resolveNewsletterToken } from "../steps/resolve-newsletter-token";
import { syncNewsletterContact } from "../steps/sync-newsletter-contact";
import { ResendAudienceClient } from "../../modules/newsletter/resend-audience";
import { confirmationToken } from "../../modules/newsletter/tokens";
import type { MedusaContainer } from "@medusajs/framework/types";

jest.mock("../../modules/newsletter/resend-audience");

function fixture() {
  const subscriber = {
    id: "nlsub_1",
    email: "buyer@example.com",
    first_name: null as string | null,
    status: "pending",
    token: "a".repeat(64),
    consent_at: new Date(),
    sync_pending: true,
    resend_contact_id: null,
  };
  let queue = Promise.resolve();
  const locking = {
    execute: jest.fn((_key, job) => {
      const result = queue.then(job);
      queue = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    }),
  };
  const service = {
    retrieveSettings: jest.fn().mockResolvedValue({
      enabled: true,
      double_opt_in: true,
      audience_id: "audience",
    }),
    listNewsletterSubscribers: jest.fn(async (filter) =>
      Object.entries(filter).every(([key, value]) => subscriber[key] === value)
        ? [{ ...subscriber }]
        : [],
    ),
    updateNewsletterSubscribers: jest.fn(async ([patch]) => {
      Object.assign(subscriber, patch);
      return [{ ...subscriber }];
    }),
    createNewsletterSubscribers: jest.fn(),
  };
  const container = {
    resolve: (key: string) =>
      key === "newsletter"
        ? service
        : key === "locking"
          ? locking
          : { error: jest.fn() },
  } as unknown as MedusaContainer;
  return { subscriber, service, container };
}

describe("newsletter consent and synchronization", () => {
  beforeEach(() => jest.clearAllMocks());
  it("coalesces repeat pending signups without rotating the token", async () => {
    const { container, service } = fixture();
    const outcomes = await Promise.all(
      Array.from({ length: 10 }, () =>
        captureNewsletterSignup({ email: "BUYER@example.com" }, container),
      ),
    );
    expect(outcomes.every((outcome) => outcome.already_subscribed)).toBe(true);
    expect(service.updateNewsletterSubscribers).not.toHaveBeenCalled();
  });
  it("does not replay a confirmation after unsubscribe", async () => {
    const { container, subscriber } = fixture();
    const token = confirmationToken(subscriber);
    expect(
      (await resolveNewsletterToken({ token, action: "confirm" }, container))
        .changed,
    ).toBe(true);
    expect(
      (await resolveNewsletterToken({ token, action: "confirm" }, container))
        .changed,
    ).toBe(false);
    await resolveNewsletterToken(
      { token: subscriber.token, action: "unsubscribe" },
      container,
    );
    await expect(
      resolveNewsletterToken({ token, action: "confirm" }, container),
    ).rejects.toThrow("no longer valid");
    expect(subscriber.status).toBe("unsubscribed");
    expect(subscriber.sync_pending).toBe(true);
  });
  it("saves the confirmation name and syncs it to the email contact", async () => {
    const { container, subscriber } = fixture();
    await resolveNewsletterToken(
      {
        token: confirmationToken(subscriber),
        action: "confirm",
        first_name: "  Ada  ",
      },
      container,
    );
    expect(subscriber.first_name).toBe("Ada");
    await syncNewsletterContact({ subscriber_id: subscriber.id }, container);
    expect(ResendAudienceClient.prototype.addContact).toHaveBeenCalledWith({
      audienceId: "audience",
      email: subscriber.email,
      firstName: "Ada",
    });
  });
  it("does not overwrite the name when a confirmation is replayed", async () => {
    const { container, subscriber, service } = fixture();
    const token = confirmationToken(subscriber);
    await resolveNewsletterToken(
      { token, action: "confirm", first_name: "Ada" },
      container,
    );
    service.updateNewsletterSubscribers.mockClear();
    await resolveNewsletterToken(
      { token, action: "confirm", first_name: "Another name" },
      container,
    );
    expect(subscriber.first_name).toBe("Ada");
    expect(service.updateNewsletterSubscribers).not.toHaveBeenCalled();
  });
  it("does not save a name from an invalid confirmation", async () => {
    const { container, subscriber, service } = fixture();
    await expect(
      resolveNewsletterToken(
        {
          token: confirmationToken(subscriber) + "invalid",
          action: "confirm",
          first_name: "Ada",
        },
        container,
      ),
    ).rejects.toThrow("no longer valid");
    expect(subscriber.first_name).toBeNull();
    expect(service.updateNewsletterSubscribers).not.toHaveBeenCalled();
  });
  it("keeps failed syncs queued and clears the flag after recovery", async () => {
    const { container, subscriber } = fixture();
    subscriber.status = "subscribed";
    const add = jest.spyOn(ResendAudienceClient.prototype, "addContact");
    add
      .mockRejectedValueOnce(new Error("unavailable"))
      .mockResolvedValueOnce("contact");
    await syncNewsletterContact({ subscriber_id: subscriber.id }, container);
    expect(subscriber.sync_pending).toBe(true);
    await syncNewsletterContact({ subscriber_id: subscriber.id }, container);
    expect(subscriber.sync_pending).toBe(false);
    expect(subscriber.resend_contact_id).toBe("contact");
  });
  it("syncs the latest consent, never a stale workflow's subscribe instruction", async () => {
    const { container, subscriber } = fixture();
    subscriber.status = "unsubscribed";
    await syncNewsletterContact({ subscriber_id: subscriber.id }, container);
    expect(
      ResendAudienceClient.prototype.unsubscribeContact,
    ).toHaveBeenCalled();
    expect(ResendAudienceClient.prototype.addContact).not.toHaveBeenCalled();
  });
});
