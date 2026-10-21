import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";

import { CART_REMINDER_MODULE } from "../../../../../modules/cart-reminder";
import type CartReminderModuleService from "../../../../../modules/cart-reminder/service";
import { NEWSLETTER_MODULE } from "../../../../../modules/newsletter";
import type NewsletterModuleService from "../../../../../modules/newsletter/service";
import { PRODUCT_ALERT_MODULE } from "../../../../../modules/product-alert";
import type ProductAlertModuleService from "../../../../../modules/product-alert/service";
import { WISHLIST_MODULE } from "../../../../../modules/wishlist";
import type WishlistModuleService from "../../../../../modules/wishlist/service";
import { listEmailHistory } from "../../../email-history";

const LIMIT = 10;

/**
 * What a support agent needs beside Medusa's own customer page: the emails
 * the customer was sent and whether they arrived, whether their address is
 * suppressed, and what they were waiting on or left in their bag. Records
 * kept by address (alerts, reminders, newsletter) are matched on the
 * account's email as well as its ID, so guest activity shows too.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const {
    data: [customer],
  } = await query.graph({
    entity: "customer",
    fields: ["id", "email"],
    filters: { id: req.params.id },
  });

  if (!customer) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Customer not found.");
  }

  const email = customer.email?.trim().toLowerCase() || null;
  const newsletter: NewsletterModuleService =
    req.scope.resolve(NEWSLETTER_MODULE);
  const wishlists: WishlistModuleService = req.scope.resolve(WISHLIST_MODULE);
  const alerts: ProductAlertModuleService =
    req.scope.resolve(PRODUCT_ALERT_MODULE);
  const reminders: CartReminderModuleService =
    req.scope.resolve(CART_REMINDER_MODULE);

  const byCustomerOrEmail = email
    ? { $or: [{ customer_id: customer.id }, { email }] }
    : { customer_id: customer.id };

  const [
    emails,
    [subscriber],
    [wishlist],
    [alertRows, alertCount],
    [reminderRows, reminderCount],
    optOuts,
  ] = await Promise.all([
    email
      ? listEmailHistory(
          req.scope,
          { to: [...new Set([customer.email!, email])] },
          LIMIT,
        )
      : [],
    email
      ? newsletter.listNewsletterSubscribers(
          { email },
          {
            select: [
              "status",
              "confirmed_at",
              "unsubscribed_at",
              "email_suppressed_at",
              "email_suppression_reason",
            ],
          },
        )
      : [],
    wishlists.listWishlists(
      { customer_id: customer.id },
      { relations: ["items"] },
    ),
    alerts.listAndCountProductAlerts(byCustomerOrEmail, {
      select: [
        "id",
        "product_id",
        "variant_id",
        "reason",
        "status",
        "notified_at",
        "created_at",
      ],
      order: { created_at: "DESC" },
      take: LIMIT,
    }),
    reminders.listAndCountCartReminders(byCustomerOrEmail, {
      select: [
        "id",
        "cart_id",
        "status",
        "reminders_sent",
        "last_sent_at",
        "restored_at",
        "recovered_at",
        "order_id",
      ],
      order: { created_at: "DESC" },
      take: LIMIT,
    }),
    email
      ? reminders.listCartReminderOptOuts({ email }, { select: ["id"] })
      : [],
  ]);

  const wishlistItems = [...(wishlist?.items ?? [])]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, LIMIT);

  const productIds = [
    ...new Set([
      ...wishlistItems.map((item) => item.product_id),
      ...alertRows.map((alert) => alert.product_id),
    ]),
  ];
  const variantIds = [
    ...new Set(
      [
        ...wishlistItems.map((item) => item.product_variant_id),
        ...alertRows.map((alert) => alert.variant_id),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];

  const [products, variants] = await Promise.all([
    productIds.length
      ? query
          .graph({
            entity: "product",
            fields: ["id", "title", "thumbnail"],
            filters: { id: productIds },
          })
          .then(({ data }) => data)
      : [],
    variantIds.length
      ? query
          .graph({
            entity: "product_variant",
            fields: ["id", "title"],
            filters: { id: variantIds },
          })
          .then(({ data }) => data)
      : [],
  ]);
  const productById = new Map(
    products.map((product) => [product.id, product] as const),
  );
  const variantTitle = new Map(
    variants.map((variant) => [variant.id, variant.title] as const),
  );
  const product = (id: string) => {
    const found = productById.get(id);
    return {
      id,
      title: found?.title ?? null,
      thumbnail: found?.thumbnail ?? null,
    };
  };

  res.json({
    email: customer.email ?? null,
    emails,
    newsletter: subscriber
      ? {
          status: subscriber.status,
          confirmed_at: subscriber.confirmed_at,
          unsubscribed_at: subscriber.unsubscribed_at,
          suppressed_at: subscriber.email_suppressed_at,
          suppression_reason: subscriber.email_suppression_reason,
        }
      : null,
    wishlist: {
      count: wishlist?.items?.length ?? 0,
      items: wishlistItems.map((item) => ({
        id: item.id,
        product: product(item.product_id),
        variant_title: item.product_variant_id
          ? (variantTitle.get(item.product_variant_id) ?? null)
          : null,
        created_at: item.created_at,
      })),
    },
    product_alerts: {
      count: alertCount,
      items: alertRows.map((alert) => ({
        id: alert.id,
        product: product(alert.product_id),
        variant_title: alert.variant_id
          ? (variantTitle.get(alert.variant_id) ?? null)
          : null,
        reason: alert.reason,
        status: alert.status,
        notified_at: alert.notified_at,
        created_at: alert.created_at,
      })),
    },
    cart_reminders: {
      count: reminderCount,
      opted_out: optOuts.length > 0,
      items: reminderRows,
    },
  });
};
