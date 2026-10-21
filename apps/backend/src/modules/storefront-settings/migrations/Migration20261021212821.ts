import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261021212821 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "storefront_settings" add column if not exists "content_pages" jsonb not null default '{}';`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "storefront_settings" drop column if exists "content_pages";`,
    );
  }
}
