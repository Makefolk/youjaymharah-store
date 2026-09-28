import {
  AbstractNotificationProviderService,
  MedusaError,
} from "@medusajs/framework/utils";
import {
  Logger,
  ILockingModule,
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from "@medusajs/framework/types";
import { render } from "react-email";
import { BoundedResend } from "./client";

import { resolveEmailTemplate } from "./emails";
import type EmailDeliveryModuleService from "../email-delivery/service";
import { deliverEmail } from "./delivery";
import { describeSendFailure } from "./send-failure";
import { snapshotKey } from "./snapshot";
import { resolveEmailSender, type EmailSenderOptions } from "./email-sender";
import type { CreateEmailOptions } from "resend";

type ResendOptions = EmailSenderOptions & {
  api_key: string;
  encryption_key?: string;
};

type InjectedDependencies = {
  logger: Logger;
  emailDelivery: EmailDeliveryModuleService;
  locking: ILockingModule;
};

class ResendNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "notification-resend";
  private resendClient: BoundedResend;
  private options: ResendOptions;
  private logger: Logger;
  private deliveries: EmailDeliveryModuleService;
  private locking: ILockingModule;

  constructor(
    { logger, emailDelivery, locking }: InjectedDependencies,
    options: ResendOptions,
  ) {
    super();
    this.resendClient = new BoundedResend(options.api_key);
    this.options = options;
    this.logger = logger;
    this.deliveries = emailDelivery;
    this.locking = locking;
  }

  static validateOptions(options: Record<any, any>) {
    if (!options.api_key) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Option `api_key` is required in the provider's options.",
      );
    }

    if (!options.from) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Option `from` is required in the provider's options.",
      );
    }
  }

  async send(
    notification: ProviderSendNotificationDTO,
  ): Promise<ProviderSendNotificationResultsDTO> {
    if (!notification.to) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "No recipient was provided for the notification.",
      );
    }

    const key = notification.provider_data?.idempotency_key;
    if (typeof key !== "string" || !/^email:[a-f\d]{64}$/.test(key)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Email requires a stable delivery identity from emailIdempotency.",
      );
    }
    return deliverEmail({
      service: this.deliveries,
      locking: this.locking,
      key,
      encryptionKey: snapshotKey(this.options.encryption_key),
      prepare: () => this.prepare(notification),
      send: async (payload, idempotencyKey) => {
        // Resend reports a refusal as a returned `error`, not a throw.
        let reason = "no receipt returned";
        try {
          const { data, error } = await this.resendClient.emails.send(payload, {
            idempotencyKey,
          });
          if (error) reason = describeSendFailure(error);
          if (error || typeof data?.id !== "string" || !data.id)
            throw new MedusaError(
              MedusaError.Types.UNEXPECTED_STATE,
              "Provider did not confirm acceptance",
            );
          return data.id;
        } catch (thrown) {
          if (!(thrown instanceof MedusaError))
            reason = describeSendFailure(thrown);
          this.logger.error(
            `Email provider acceptance was not confirmed (${reason}); delivery retry/review is required.`,
          );
          throw new MedusaError(
            MedusaError.Types.UNEXPECTED_STATE,
            "Email provider acceptance was not confirmed; retry uses the saved delivery snapshot.",
          );
        }
      },
    });
  }

  private async prepare(
    notification: ProviderSendNotificationDTO,
  ): Promise<CreateEmailOptions> {
    // A React Email template under ./emails wins when the name matches one.
    const resolved = resolveEmailTemplate(
      notification.template,
      notification.data,
    );

    // Otherwise the caller supplies the rendered body inline via `content`.
    const html = notification.content?.html;
    const text = notification.content?.text;

    if (!resolved && !html && !text) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `No template registered under "${notification.template}" and no inline \`html\`/\`text\` content was provided.`,
      );
    }

    const base = {
      from: resolveEmailSender(
        notification.template,
        this.options,
        notification.from,
      ),
      to: notification.to,
      replyTo:
        typeof notification.data?.reply_to === "string"
          ? notification.data.reply_to
          : undefined,
      // An explicit subject from the caller overrides the template's default.
      subject:
        notification.content?.subject ?? resolved?.subject ?? "Notification",
      attachments: notification.attachments?.map((attachment) => ({
        content: Buffer.isBuffer(attachment.content)
          ? attachment.content.toString("base64")
          : attachment.content,
        filename: attachment.filename,
        contentType: attachment.content_type,
        contentId: attachment.id,
      })),
    };

    // Templates are rendered here rather than handed to Resend as `react`, so
    // the HTML and plain-text parts come from the same render and nothing
    // depends on Resend resolving its optional @react-email/render peer. This
    // project is on React 18 because @medusajs/dashboard pins it; react-email's
    // `render` supports that (its Node build renders with
    // renderToPipeableStream), so no React 19 is needed.
    const rendered = resolved
      ? {
          html: await render(resolved.react),
          text: await render(resolved.react, { plainText: true }),
        }
      : undefined;

    // `CreateEmailOptions` requires at least one of react/html/text, so the
    // branches stay separate rather than spreading a possibly-undefined body.
    return rendered
      ? { ...base, ...rendered }
      : html
        ? { ...base, html, ...(text ? { text } : {}) }
        : { ...base, text: text as string };
  }
}

export default ResendNotificationProviderService;
