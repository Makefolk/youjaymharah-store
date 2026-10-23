import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261023030420 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "support_request" add column if not exists "links_revoked_at" timestamptz null;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "support_request" drop column if exists "links_revoked_at";`,
    );
  }
}
