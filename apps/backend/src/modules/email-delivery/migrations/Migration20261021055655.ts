import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261021055655 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "email_delivery" add column if not exists "outcome" text check ("outcome" in ('delivered', 'delayed', 'bounced', 'complained', 'suppressed', 'failed')) null, add column if not exists "outcome_at" timestamptz null, add column if not exists "outcome_detail" text null;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_email_delivery_provider_id" ON "email_delivery" ("provider_id") WHERE provider_id IS NOT NULL AND deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_email_delivery_provider_id";`);
    this.addSql(
      `alter table if exists "email_delivery" drop column if exists "outcome", drop column if exists "outcome_at", drop column if exists "outcome_detail";`,
    );
  }
}
