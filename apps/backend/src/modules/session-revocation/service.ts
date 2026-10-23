import { MedusaService } from "@medusajs/framework/utils";

import { SessionCutoff } from "./models/session-cutoff";

export type SessionActor = { actor_type: string; actor_id: string };

export default class SessionRevocationModuleService extends MedusaService({
  SessionCutoff,
}) {
  /** The actor's cutoff in epoch seconds, or null when they have none. */
  async cutoffFor(actor: SessionActor): Promise<number | null> {
    const [cutoff] = await this.listSessionCutoffs(actor, { take: 1 });
    return cutoff
      ? Math.floor(new Date(cutoff.signed_out_at).getTime() / 1000)
      : null;
  }

  /** Moves each actor's cutoff to `at`, creating it on first use. */
  async signOutBefore(actors: SessionActor[], at: Date) {
    for (const actor of actors) {
      const [existing] = await this.listSessionCutoffs(actor, { take: 1 });
      if (existing) {
        await this.updateSessionCutoffs({
          id: existing.id,
          signed_out_at: at,
        });
      } else {
        await this.createSessionCutoffs({ ...actor, signed_out_at: at });
      }
    }
  }
}
