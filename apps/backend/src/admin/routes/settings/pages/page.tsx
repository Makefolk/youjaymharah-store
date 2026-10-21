import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Spinner } from "@medusajs/icons";
import {
  Badge,
  Button,
  Container,
  Heading,
  Label,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { usePermissions } from "../../../lib/permissions";
import { sdk } from "../../../lib/sdk";

type Pages = {
  about: string | null;
  privacy: string | null;
  terms: string | null;
};

const PAGES_KEY = ["content-pages"];

const PAGES: { key: keyof Pages; title: string; path: string; hint: string }[] =
  [
    {
      key: "about",
      title: "About",
      path: "/about",
      hint: "Who you are and what the brand stands for.",
    },
    {
      key: "privacy",
      title: "Privacy policy",
      path: "/privacy",
      hint: "What personal data you collect, why, who it's shared with (payment, email and delivery providers), how long you keep it and how customers can ask for it or have it deleted. Have it checked against Nigeria's data protection law.",
    },
    {
      key: "terms",
      title: "Terms of sale",
      path: "/terms",
      hint: "Pricing and payment, delivery, returns and refunds (the Returns page shows your current window), and the law that applies. Have a lawyer check it.",
    },
  ];

/**
 * The website's About, Privacy and Terms pages. A page with no text isn't linked
 * from the footer, so nothing half-written goes live.
 */
const ContentPagesPage = () => {
  const { can } = usePermissions();
  const canEdit = can("storefront_settings", "update");
  const query = useQuery({
    queryKey: PAGES_KEY,
    queryFn: () => sdk.client.fetch<{ pages: Pages }>("/admin/content-pages"),
  });

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="flex flex-col gap-y-1 px-6 py-4">
        <Heading level="h1">Pages</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Separate paragraphs with a blank line. Start a line with "## " for a
          heading or "- " for a bullet point. Saved text appears on the website
          within a few minutes.
        </Text>
      </Container>
      {query.isLoading ? (
        <Container className="flex justify-center px-6 py-8">
          <Spinner className="text-ui-fg-subtle animate-spin" />
        </Container>
      ) : query.data ? (
        PAGES.map((page) => (
          <PageEditor
            key={page.key}
            page={page}
            text={query.data.pages[page.key]}
            canEdit={canEdit}
          />
        ))
      ) : (
        <Container className="px-6 py-4">
          <Text size="small" className="text-ui-fg-error">
            Couldn't load the pages.
          </Text>
        </Container>
      )}
    </div>
  );
};

const PageEditor = ({
  page,
  text,
  canEdit,
}: {
  page: (typeof PAGES)[number];
  text: string | null;
  canEdit: boolean;
}) => {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(text ?? "");
  useEffect(() => setValue(text ?? ""), [text]);
  const changed = value.trim() !== (text ?? "").trim();

  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ pages: Pages }>("/admin/content-pages", {
        method: "POST",
        body: { [page.key]: value },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(PAGES_KEY, data);
      toast.success(
        data.pages[page.key]
          ? `${page.title} saved.`
          : `${page.title} cleared and taken out of the footer.`,
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const id = `page-${page.key}`;
  return (
    <Container className="flex flex-col gap-y-3 px-6 py-4">
      <div className="flex items-center gap-x-2">
        <Label htmlFor={id} weight="plus">
          {page.title}
        </Label>
        <Badge size="2xsmall" color={text ? "green" : "grey"}>
          {text ? `Live at ${page.path}` : "Not on the website"}
        </Badge>
      </div>
      <Text size="small" className="text-ui-fg-subtle">
        {page.hint}
      </Text>
      <Textarea
        id={id}
        rows={14}
        maxLength={30000}
        disabled={!canEdit}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      {canEdit && (
        <div className="flex justify-end">
          <Button
            size="small"
            disabled={!changed}
            isLoading={save.isPending}
            onClick={() => save.mutate()}
          >
            Save
          </Button>
        </div>
      )}
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Pages",
});

export default ContentPagesPage;
