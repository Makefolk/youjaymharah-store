import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261022154145 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "session_cutoff" drop constraint if exists "session_cutoff_actor_type_actor_id_unique";`,
    );
    this.addSql(
      `create table if not exists "session_cutoff" ("id" text not null, "actor_type" text not null, "actor_id" text not null, "signed_out_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "session_cutoff_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_session_cutoff_deleted_at" ON "session_cutoff" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_session_cutoff_actor_type_actor_id_unique" ON "session_cutoff" ("actor_type", "actor_id") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "session_cutoff" cascade;`);
  }
}
