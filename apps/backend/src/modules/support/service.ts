import { MedusaService } from "@medusajs/framework/utils";

import { SupportMessage } from "./models/support-message";
import { SupportRequest } from "./models/support-request";

class SupportModuleService extends MedusaService({
  SupportRequest,
  SupportMessage,
}) {}

export default SupportModuleService;
