import { createHash } from "node:crypto";
import { MedusaError, MedusaService } from "@medusajs/framework/utils";
import { RefundRecord } from "./models/refund-record";

export default class RefundLedgerModuleService extends MedusaService({
  RefundRecord,
}) {
  async claim(input: {
    provider: string;
    reference: string;
    transaction_reference: string;
    refund_id: string;
    amount_in_minor: number;
    currency_code: string;
  }) {
    const reference = input.reference.trim().toUpperCase();
    const id = `refr_${createHash("sha256").update(`${input.provider}:${reference}`).digest("hex")}`;
    const [existing] = await this.listRefundRecords({ id });
    if (
      existing?.refund_id === input.refund_id &&
      existing.transaction_reference === input.transaction_reference &&
      Number(existing.amount_in_minor) === input.amount_in_minor &&
      existing.currency_code === input.currency_code
    )
      return;
    if (existing) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        "This gateway refund is already recorded or awaiting reconciliation. Do not refund it again.",
      );
    }
    // This survives a failed local payment write. Reconciliation is safer than
    // releasing the reference and risking a second local refund entry.
    try {
      await this.createRefundRecords({ ...input, id, reference });
    } catch (error) {
      const [record] = await this.listRefundRecords({ id });
      if (record)
        throw new MedusaError(
          MedusaError.Types.CONFLICT,
          "This gateway refund has already been claimed. Check the order before retrying.",
        );
      throw error;
    }
  }
}
