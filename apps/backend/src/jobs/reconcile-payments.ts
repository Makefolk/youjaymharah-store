import type { MedusaContainer } from "@medusajs/framework/types";

import { reconcilePaymentsWorkflow } from "../workflows/reconcile-payments";

/** Finds paid bags that never became orders (Needs attention). */
export default async function reconcilePayments(container: MedusaContainer) {
  await reconcilePaymentsWorkflow(container).run();
}

export const config = {
  name: "reconcile-payments",
  schedule: "*/5 * * * *",
};
