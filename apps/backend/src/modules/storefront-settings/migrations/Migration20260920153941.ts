import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260920153941 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "storefront_settings" add column if not exists "announcement_bar" jsonb not null default '{"enabled":false,"appearance":"dark","dismissible":true,"items":[]}';`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "storefront_settings" drop column if exists "announcement_bar";`,
    );
  }
}
