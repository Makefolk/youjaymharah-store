"use client"

import {
  FacebookLogoIcon,
  Icon,
  InstagramLogoIcon,
  PinterestLogoIcon,
  TiktokLogoIcon,
  XLogoIcon,
  YoutubeLogoIcon,
} from "@phosphor-icons/react"
import Image from "next/image"
import Link from "next/link"

import { NewsletterSignup } from "@/components/newsletter/newsletter-signup"
import { Button } from "@/components/ui/button"
import { useStorefrontSettings } from "@/features/site-settings/provider"
import { StorefrontSettings } from "@/lib/medusa/storefront-settings"
import {
  ABOUT_PATH,
  CONTACT_PATH,
  DELIVERY_PATH,
  PRIVACY_PATH,
  PRODUCTS_PATH,
  TERMS_PATH,
  RETURNS_POLICY_PATH,
  TRACK_ORDER_PATH,
} from "@/lib/seo/routes"
import { cn } from "@/lib/util/cn"

const navLinks = [
  { href: PRODUCTS_PATH, label: "Catalog" },
  { href: TRACK_ORDER_PATH, label: "Track an order" },
  { href: DELIVERY_PATH, label: "Delivery" },
  { href: RETURNS_POLICY_PATH, label: "Returns" },
  { href: CONTACT_PATH, label: "Contact" },
]

type TSocialPlatform = keyof StorefrontSettings["seo"]["social_links"]

export function Footer() {
  const { brand, seo, pages } = useStorefrontSettings()
  // About, Privacy and Terms only once written (Settings › Pages).
  const links = [
    ...navLinks,
    ...(pages.about ? [{ href: ABOUT_PATH, label: "About" }] : []),
    ...(pages.privacy ? [{ href: PRIVACY_PATH, label: "Privacy" }] : []),
    ...(pages.terms ? [{ href: TERMS_PATH, label: "Terms" }] : []),
  ]

  return (
    <footer className="dark bg-background py-6 text-foreground">
      <div className="container-wrapper flex flex-col gap-6 px-5 py-6 sm:px-6 lg:px-8">
        {/* Hidden rather than left as a bare divider while signup is off. */}
        <div className="border-b pb-10 empty:hidden">
          <NewsletterSignup source="footer" />
        </div>

        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center font-display text-xl">
            {brand.logo_url && (
              <Image
                src={brand.logo_url}
                alt={brand.name}
                width={150}
                height={150}
                className="-ml-1 h-auto w-8"
                title={brand.name}
              />
            )}

            <span className="hidden min-[440px]:block">{brand.name}</span>
          </Link>

          <div className="flex items-center">
            {Object.entries(seo.social_links)
              .filter(([_, url]) => !!url)
              .map(([platform, url]) => (
                <SocialLink
                  key={platform}
                  url={url!}
                  {...SOCIAL_LINKS_CONFIG[platform as TSocialPlatform]}
                />
              ))}
          </div>
        </div>

        <nav>
          <ul className="flex flex-wrap gap-4 text-sm font-medium text-foreground md:gap-6">
            {links.map((link) => (
              <li key={link.label}>
                <a
                  className="underline-offset-5 hover:underline"
                  href={link.href}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="flex items-center justify-between gap-4 border-t px-5 py-4 text-sm font-extralight text-muted-foreground sm:px-6 lg:px-8">
        <p>
          &copy; {new Date().getFullYear()} {brand.name}
        </p>

        {/*<p className="inline-flex items-center gap-1">
          <span>Built by</span>
          <a
            aria-label="x/twitter"
            className="inline-flex items-center gap-1 text-foreground/80 hover:text-foreground hover:underline"
            href={"https://x.com/shabanhr"}
            rel="noreferrer"
            target="_blank"
          >
            <img
              alt="shaban"
              className="size-4 rounded-full"
              height="auto"
              src="https://github.com/shabanhr.png"
              width="auto"
            />
            Shaban
          </a>
        </p>*/}
      </div>
    </footer>
  )
}

interface SocialLinkConfig {
  name: string
  icon: Icon
}

function SocialLink({
  url,
  className,
  ...props
}: { url: string; className?: string } & SocialLinkConfig) {
  return (
    <Button
      variant={"ghost"}
      size={"icon"}
      nativeButton={false}
      render={
        <Link
          href={url}
          className={cn("", className)}
          aria-label={props.name}
        />
      }
    >
      <props.icon weight="duotone" />
    </Button>
  )
}

const SOCIAL_LINKS_CONFIG: Record<TSocialPlatform, SocialLinkConfig> = {
  instagram: {
    name: "Instagram",
    icon: InstagramLogoIcon,
  },
  tiktok: {
    name: "TikTok",
    icon: TiktokLogoIcon,
  },
  facebook: {
    name: "Facebook",
    icon: FacebookLogoIcon,
  },
  x: {
    name: "X",
    icon: XLogoIcon,
  },
  pinterest: {
    name: "Pinterest",
    icon: PinterestLogoIcon,
  },
  youtube: {
    name: "YouTube",
    icon: YoutubeLogoIcon,
  },
}
