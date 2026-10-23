import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261023112018 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "storefront_settings" add column if not exists "homepage_about" jsonb not null default '{"enabled":true,"eyebrow":"A little about us","title":"Pieces you love.\\nStyle that’s yours.","description":"Find pieces that feel like you. We bring together clothing, accessories and everyday favourites to help you build a wardrobe with your own point of view.\\n\\nDiscover something new, return to what you love, and make every look your own.","image_url":null,"image_alt":null,"cta_label":"Explore the collection","cta_url":"/products"}';`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "storefront_settings" drop column if exists "homepage_about";`);
  }

}
