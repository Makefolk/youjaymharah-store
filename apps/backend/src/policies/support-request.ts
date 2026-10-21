import { definePolicies } from "@medusajs/framework/utils";

/** Makes Support inbox assignable in the role editor. */
export const supportRequestPolicies = definePolicies([
  {
    name: "ReadSupportRequest",
    resource: "support_request",
    operation: "read",
    description: "View customer support requests and their conversations",
  },
  {
    name: "UpdateSupportRequest",
    resource: "support_request",
    operation: "update",
    description:
      "Reply to support requests, add staff notes, assign and change their status",
  },
]);
