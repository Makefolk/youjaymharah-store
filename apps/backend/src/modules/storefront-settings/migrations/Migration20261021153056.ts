import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261021153056 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "storefront_settings" add column if not exists "support_info" jsonb not null default '{}';`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "storefront_settings" drop column if exists "support_info";`,
    );
  }
}
