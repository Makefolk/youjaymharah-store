import type { Metadata } from "next"
import Link from "next/link"
import type { ReactNode } from "react"

import { Faq } from "@/components/help/faq"
import { formatPhone, whatsappUrl } from "@/lib/help/contact-links"
import { getStorefrontSettings } from "@/lib/medusa/storefront-settings"
import {
  DELIVERY_PATH,
  RETURNS_POLICY_PATH,
  TRACK_ORDER_PATH,
} from "@/lib/seo/routes"

import { ContactForm, TOPICS, type Topic } from "./contact-form"

export const metadata: Metadata = {
  title: "Contact us",
  description:
    "Questions about an order, a return or a piece? Send us a message, email or call.",
}

const linkClass = "text-foreground underline underline-offset-4"

export default async function ContactPage({
  searchParams,
}: PageProps<"/contact">) {
  const [{ brand, support, returns }, params] = await Promise.all([
    getStorefrontSettings(),
    searchParams,
  ])
  // Prefilled by links such as an order page's "Get help with this order".
  const topic = TOPICS.find((value) => value === params.topic) ?? ""
  const order =
    typeof params.order === "string" && /^\d{1,10}$/.test(params.order)
      ? params.order
      : ""

  // Only what the store has set; an unset way to reach us is left out.
  const channels = [
    brand.support_email && {
      label: "Email",
      value: (
        <a href={`mailto:${brand.support_email}`} className={linkClass}>
          {brand.support_email}
        </a>
      ),
    },
    support.whatsapp && {
      label: "WhatsApp",
      value: (
        <a
          href={whatsappUrl(support.whatsapp)}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          {formatPhone(support.whatsapp)}
        </a>
      ),
    },
    support.phone && {
      label: "Phone",
      value: (
        <a href={`tel:${support.phone}`} className={linkClass}>
          {formatPhone(support.phone)}
        </a>
      ),
    },
    support.hours && { label: "Hours", value: support.hours },
  ].filter(Boolean) as { label: string; value: ReactNode }[]

  const faqs = [
    {
      question: "Where's my order?",
      answer: (
        <>
          Your order page shows its progress and the courier&apos;s tracking
          link once it ships. Open it from your confirmation email, or{" "}
          <Link href={TRACK_ORDER_PATH} className={linkClass}>
            find it with your order number and email
          </Link>
          .
        </>
      ),
    },
    {
      question: "How do I return something?",
      answer: returns.enabled ? (
        <>
          Request a return from your order page within {returns.window_days}{" "}
          days of delivery, and we&apos;ll arrange collection or drop-off.{" "}
          <Link href={RETURNS_POLICY_PATH} className={linkClass}>
            Our returns policy
          </Link>{" "}
          has the details.
        </>
      ) : (
        <>
          Send us a message below with your order number and what you&apos;d
          like to return, and we&apos;ll arrange it with you.
        </>
      ),
    },
    {
      question: "When will I get my refund?",
      answer:
        "Once the items reach us and we've checked them, we refund to the way you paid and email you. Your bank may take a few working days to show it.",
    },
    {
      question: "Can I change or cancel my order?",
      answer:
        "Message us as soon as you can with your order number. Until it ships we can usually change the size, colour or address, or cancel it.",
    },
    {
      question: "How long does delivery take?",
      answer: (
        <>
          {support.delivery_information
            ? "It depends on where you are. "
            : "Delivery options and prices for your address are shown at checkout. "}
          <Link href={DELIVERY_PATH} className={linkClass}>
            Delivery information
          </Link>{" "}
          has the details.
        </>
      ),
    },
    {
      question: "Do I need an account to order?",
      answer:
        "No. You can check out as a guest and follow your order from its email. An account keeps all your orders in one place.",
    },
  ]

  return (
    <main className="container-wrapper max-w-5xl px-5 py-12 sm:px-6 sm:py-16">
      <h1 className="text-2xl font-medium tracking-[-0.01em]">Contact us</h1>
      <p className="mt-3 max-w-[60ch] text-[15px] text-muted-foreground">
        Questions about an order, a return or a piece? Send us a message and
        {support.response_time
          ? ` we'll usually reply ${support.response_time}.`
          : " we'll reply as soon as we can."}
      </p>

      <div className="mt-10 grid gap-12 md:grid-cols-[1fr_16rem] md:gap-16">
        <section aria-labelledby="contact-form">
          <h2 id="contact-form" className="sr-only">
            Send a message
          </h2>
          <ContactForm
            responseTime={support.response_time}
            initialTopic={topic as Topic | ""}
            initialOrderNumber={order}
          />
        </section>

        {channels.length > 0 && (
          <section aria-labelledby="contact-other" className="md:order-last">
            <h2
              id="contact-other"
              className="border-b border-border/70 pb-3 text-[15px] font-medium"
            >
              Other ways to reach us
            </h2>
            <dl className="mt-4 flex flex-col gap-4 text-[15px]">
              {channels.map((channel) => (
                <div key={channel.label}>
                  <dt className="text-[12px] tracking-[0.08em] text-muted-foreground uppercase">
                    {channel.label}
                  </dt>
                  <dd className="mt-1">{channel.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>

      <section aria-labelledby="contact-faq" className="mt-16">
        <h2 id="contact-faq" className="mb-4 text-[15px] font-medium">
          Common questions
        </h2>
        <Faq items={faqs} />
      </section>
    </main>
  )
}
