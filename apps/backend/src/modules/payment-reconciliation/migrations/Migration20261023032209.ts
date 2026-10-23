import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261023032209 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "payment_check" drop constraint if exists "payment_check_session_id_unique";`,
    );
    this.addSql(
      `create table if not exists "payment_check" ("id" text not null, "session_id" text not null, "provider_id" text not null, "reference" text not null, "cart_id" text null, "email" text null, "amount" numeric not null, "currency_code" text not null, "session_created_at" timestamptz not null, "status" text check ("status" in ('checking', 'needs_staff', 'resolved')) not null default 'checking', "verdict" text null, "attempts" integer not null default 0, "next_check_at" timestamptz null, "last_checked_at" timestamptz null, "resolution" text null, "resolved_at" timestamptz null, "resolved_by" text null, "note" text null, "raw_amount" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "payment_check_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payment_check_session_id_unique" ON "payment_check" ("session_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_check_deleted_at" ON "payment_check" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_check_status_next_check_at" ON "payment_check" ("status", "next_check_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_check_session_created_at" ON "payment_check" ("session_created_at") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "payment_check" cascade;`);
  }
}
