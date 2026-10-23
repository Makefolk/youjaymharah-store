import { z } from "@medusajs/framework/zod";

export const DEFAULT_HOMEPAGE_ABOUT = {
  enabled: true,
  eyebrow: "A little about us",
  title: "Pieces you love.\nStyle that’s yours.",
  description:
    "Find pieces that feel like you. We bring together clothing, accessories and everyday favourites to help you build a wardrobe with your own point of view.\n\nDiscover something new, return to what you love, and make every look your own.",
  image_url: null,
  image_alt: null,
  cta_label: "Explore the collection",
  cta_url: "/products",
};

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

function isWebAddress(value: string) {
  try {
    const url = new URL(value);
    return (
      /^https?:\/\//i.test(value) &&
      !/[\s\\]/.test(value) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

const ImageAddress = z
  .string()
  .trim()
  .max(2048)
  .refine(isWebAddress, "Use a full http:// or https:// image address.");

const LinkDestination = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) =>
      (value.startsWith("/") &&
        !value.startsWith("//") &&
        !/[\s\\]/.test(value)) ||
      isWebAddress(value),
    'Use a store path starting with "/" or a full http:// or https:// address.',
  );

export const HomepageAbout = z
  .object({
    enabled: z.boolean(),
    eyebrow: optionalText(60),
    title: optionalText(120),
    description: optionalText(1200),
    image_url: ImageAddress.nullable().optional(),
    image_alt: optionalText(240),
    cta_label: optionalText(40),
    cta_url: LinkDestination.nullable().optional(),
  })
  .superRefine((about, ctx) => {
    if (about.enabled) {
      for (const field of ["title", "description"] as const) {
        if (!about[field]) {
          ctx.addIssue({
            code: "custom",
            path: [field],
            message: `Add a ${field === "title" ? "heading" : "description"} before showing the About section.`,
          });
        }
      }
    }
    if (about.image_url && !about.image_alt) {
      ctx.addIssue({
        code: "custom",
        path: ["image_alt"],
        message: "Describe the image for people using screen readers.",
      });
    }
    if (Boolean(about.cta_label) !== Boolean(about.cta_url)) {
      ctx.addIssue({
        code: "custom",
        path: [about.cta_label ? "cta_url" : "cta_label"],
        message: "A link needs both a label and a destination.",
      });
    }
  });

export type HomepageAboutInput = z.infer<typeof HomepageAbout>;

/** Explicit nulls clear omitted fields when Medusa merges JSON updates. */
export function completeHomepageAbout(value: unknown) {
  const about = (value ?? {}) as Record<string, unknown>;
  const text = (key: string) =>
    typeof about[key] === "string" ? about[key].trim() || null : null;
  return {
    enabled: about.enabled === true,
    eyebrow: text("eyebrow"),
    title: text("title"),
    description: text("description"),
    image_url: text("image_url"),
    image_alt: text("image_alt"),
    cta_label: text("cta_label"),
    cta_url: text("cta_url"),
  };
}

export type HomepageAboutContent = ReturnType<typeof completeHomepageAbout>;
