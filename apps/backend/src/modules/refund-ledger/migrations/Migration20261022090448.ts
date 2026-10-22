import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261022090448 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "refund_record" drop constraint if exists "refund_record_provider_reference_unique";`,
    );
    this.addSql(
      `create table if not exists "refund_record" ("id" text not null, "provider" text not null, "reference" text not null, "transaction_reference" text not null, "refund_id" text not null, "amount_in_minor" integer not null, "currency_code" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "refund_record_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_refund_record_deleted_at" ON "refund_record" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_refund_record_provider_reference_unique" ON "refund_record" ("provider", "reference") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "refund_record" cascade;`);
  }
}
