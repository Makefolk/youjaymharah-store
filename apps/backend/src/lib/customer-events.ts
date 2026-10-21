/**
 * A customer proved they own their account's email: by opening a
 * verification link, or by signing in with a provider that verifies emails
 * (Google). Data: { customer_id, email }.
 */
export const CUSTOMER_EMAIL_VERIFIED_EVENT = "customer.email_verified";

export type CustomerEmailVerifiedData = {
  customer_id: string;
  email: string;
};
