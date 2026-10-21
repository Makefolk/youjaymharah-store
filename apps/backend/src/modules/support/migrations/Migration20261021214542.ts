import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261021214542 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "support_request" drop constraint if exists "support_request_reference_unique";`,
    );
    this.addSql(
      `create table if not exists "support_request" ("id" text not null, "reference" text not null, "kind" text check ("kind" in ('question', 'order', 'delivery', 'return', 'product', 'cancel', 'change_address', 'exchange', 'damaged', 'missing')) not null, "status" text check ("status" in ('open', 'awaiting_customer', 'resolved')) not null default 'open', "priority" text check ("priority" in ('normal', 'high')) not null default 'normal', "email" text not null, "name" text not null, "customer_id" text null, "order_id" text null, "order_display_id" integer null, "assigned_to" text null, "last_message_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "support_request_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_support_request_reference_unique" ON "support_request" ("reference") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_support_request_deleted_at" ON "support_request" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_support_request_status_last_message_at" ON "support_request" ("status", "last_message_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_support_request_customer_id" ON "support_request" ("customer_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_support_request_email" ON "support_request" ("email") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_support_request_order_id" ON "support_request" ("order_id") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "support_message" ("id" text not null, "author" text check ("author" in ('customer', 'staff')) not null, "author_id" text null, "author_name" text null, "body" text not null, "internal" boolean not null default false, "attachments" jsonb null, "request_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "support_message_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_support_message_request_id" ON "support_message" ("request_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_support_message_deleted_at" ON "support_message" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_support_message_request_id_created_at" ON "support_message" ("request_id", "created_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `alter table if exists "support_message" add constraint "support_message_request_id_foreign" foreign key ("request_id") references "support_request" ("id") on update cascade;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "support_message" drop constraint if exists "support_message_request_id_foreign";`,
    );

    this.addSql(`drop table if exists "support_request" cascade;`);

    this.addSql(`drop table if exists "support_message" cascade;`);
  }
}
