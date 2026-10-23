import { defineConfig } from "vitepress";
import { existsSync } from "node:fs";
import {
  createBrandingHandler,
  loadBrandingConfig,
} from "../scripts/branding-proxy.mjs";
import { storefrontStyles, syncBrand } from "../scripts/sync-brand.mjs";

export default defineConfig({
  title: "YouJaymharah",
  description:
    "The team's guide to running, supporting and maintaining the store.",
  srcDir: "content",
  outDir: "dist",
  cleanUrls: true,
  lastUpdated: existsSync(new URL("../../../.git", import.meta.url)),
  vite: {
    plugins: [
      {
        name: "docs-branding",
        async configureServer(server) {
          server.middlewares.use(
            createBrandingHandler(await loadBrandingConfig()),
          );
          server.watcher.add(storefrontStyles);
        },
        async handleHotUpdate({ file }) {
          if (file === storefrontStyles) await syncBrand();
        },
      },
    ],
  },
  head: [
    ["meta", { name: "robots", content: "noindex, nofollow, noarchive" }],
    ["meta", { name: "referrer", content: "no-referrer" }],
    ["link", { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" }],
  ],
  themeConfig: {
    siteTitle: false,
    search: { provider: "local" },
    outline: [2, 3],
    nav: [
      { text: "Start here", link: "/start" },
      { text: "Scenarios", link: "/scenarios" },
      { text: "Launch checklist", link: "/operations/launch" },
    ],
    sidebar: [
      {
        text: "Start here",
        items: [
          { text: "Using this handbook", link: "/start" },
          { text: "Scenario index", link: "/scenarios" },
          { text: "Roles and responsibilities", link: "/staff/roles" },
        ],
      },
      {
        text: "Customer journeys",
        collapsed: false,
        items: [
          { text: "Browse, search and select", link: "/customers/catalog" },
          { text: "Bags, delivery and checkout", link: "/customers/checkout" },
          { text: "Payments and recovery", link: "/customers/payments" },
          { text: "Accounts and sign-in", link: "/customers/accounts" },
          {
            text: "Orders, returns and support",
            link: "/customers/after-purchase",
          },
          {
            text: "Wishlists and subscriptions",
            link: "/customers/subscriptions",
          },
        ],
      },
      {
        text: "Run the store",
        collapsed: false,
        items: [
          { text: "Daily operations", link: "/staff/daily" },
          { text: "Catalog, inventory and pricing", link: "/staff/catalog" },
          { text: "Fulfillment and delivery", link: "/staff/fulfillment" },
          { text: "Returns, claims and refunds", link: "/staff/refunds" },
          { text: "Support inbox", link: "/staff/support" },
          { text: "Content and marketing", link: "/staff/content" },
          { text: "Email delivery and review", link: "/staff/email" },
        ],
      },
      {
        text: "Operate production",
        collapsed: true,
        items: [
          { text: "Launch acceptance", link: "/operations/launch" },
          { text: "Deploy and roll back", link: "/operations/deployment" },
          { text: "Monitoring and incidents", link: "/operations/incidents" },
          { text: "Backups and restore", link: "/operations/recovery" },
          { text: "Security and private data", link: "/operations/security" },
          { text: "Host the internal docs", link: "/operations/docs-hosting" },
        ],
      },
      {
        text: "Develop the project",
        collapsed: true,
        items: [
          { text: "Local setup and commands", link: "/development/setup" },
          {
            text: "Architecture and conventions",
            link: "/development/architecture",
          },
          {
            text: "Testing and release evidence",
            link: "/development/testing",
          },
          {
            text: "Configuration reference",
            link: "/development/configuration",
          },
          {
            text: "Maintain this handbook",
            link: "/development/documentation",
          },
        ],
      },
      {
        text: "Detailed reference",
        collapsed: true,
        items: [
          { text: "Custom API", link: "/reference/generated/api" },
          {
            text: "Store manager handbook",
            link: "/reference/generated/store-manager-handbook",
          },
          {
            text: "Deployment runbook",
            link: "/reference/generated/deployment",
          },
          {
            text: "Email reliability",
            link: "/reference/generated/email-reliability",
          },
          {
            text: "Resend webhooks",
            link: "/reference/generated/resend-webhooks",
          },
          { text: "Announcements", link: "/reference/generated/announcements" },
          {
            text: "Search privacy",
            link: "/reference/generated/search-privacy",
          },
          {
            text: "Production operations",
            link: "/reference/generated/production-operations",
          },
        ],
      },
    ],
    footer: {
      message:
        "Internal team documentation. Verify live configuration before acting.",
    },
  },
});
