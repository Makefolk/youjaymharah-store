import { definePolicies } from "@medusajs/framework/utils";

/**
 * Makes the return policy assignable in the role editor. The Store Manager
 * sets it; Support can see it, to quote it to customers.
 */
export const returnPolicyPolicies = definePolicies([
  {
    name: "ReadReturnPolicy",
    resource: "return_policy",
    operation: "read",
    description: "View whether customers can request returns, and for how long",
  },
  {
    name: "UpdateReturnPolicy",
    resource: "return_policy",
    operation: "update",
    description:
      "Turn customer return requests on or off and set the return window",
  },
]);
