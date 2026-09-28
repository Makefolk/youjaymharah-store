import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260928100351 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "newsletter_subscriber" add column if not exists "first_name" text null;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "newsletter_subscriber" drop column if exists "first_name";`,
    );
  }
}
