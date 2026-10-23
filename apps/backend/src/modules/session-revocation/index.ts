import { Module } from "@medusajs/framework/utils";

import SessionRevocationModuleService from "./service";

export const SESSION_REVOCATION_MODULE = "sessionRevocation";

export default Module(SESSION_REVOCATION_MODULE, {
  service: SessionRevocationModuleService,
});
