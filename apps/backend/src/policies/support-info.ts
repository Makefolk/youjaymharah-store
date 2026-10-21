import { definePolicies } from "@medusajs/framework/utils";

/**
 * Makes the contact details on the website assignable in the role editor.
 * The Store Manager sets them; Support can see them.
 */
export const supportInfoPolicies = definePolicies([
  {
    name: "ReadSupportInfo",
    resource: "support_info",
    operation: "read",
    description:
      "View the support hours, reply time, phone numbers and delivery information on the contact page",
  },
  {
    name: "UpdateSupportInfo",
    resource: "support_info",
    operation: "update",
    description:
      "Change the support hours, reply time, phone numbers and delivery information on the contact page",
  },
]);
