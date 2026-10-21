import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261021153917 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "email_delivery" add column if not exists "resolution" text check ("resolution" in ('sent', 'not_sent')) null, add column if not exists "resolved_at" timestamptz null, add column if not exists "resolved_by" text null, add column if not exists "resolution_note" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "email_delivery" drop column if exists "resolution", drop column if exists "resolved_at", drop column if exists "resolved_by", drop column if exists "resolution_note";`);
  }

}
