import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261021070910 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "storefront_settings" add column if not exists "returns_enabled" boolean not null default true, add column if not exists "return_window_days" integer not null default 7;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "storefront_settings" drop column if exists "returns_enabled", drop column if exists "return_window_days";`,
    );
  }
}
