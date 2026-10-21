import { definePolicies } from "@medusajs/framework/utils";

/**
 * Medusa 2.20.1's refund and capture routes require refund:create and
 * capture:create, but Medusa doesn't register those policies, so no role
 * could be given them and only the owner could refund or capture. Registered
 * here so the Store Manager and Support roles can. Remove once Medusa
 * registers them itself.
 */
export const refundCapturePolicies = definePolicies([
  {
    name: "ReadRefund",
    resource: "refund",
    operation: "read",
    description: "View refunds on payments",
  },
  {
    name: "CreateRefund",
    resource: "refund",
    operation: "create",
    description: "Refund payments to customers",
  },
  {
    name: "ReadCapture",
    resource: "capture",
    operation: "read",
    description: "View payment captures",
  },
  {
    name: "CreateCapture",
    resource: "capture",
    operation: "create",
    description: "Capture authorized payments",
  },
]);
