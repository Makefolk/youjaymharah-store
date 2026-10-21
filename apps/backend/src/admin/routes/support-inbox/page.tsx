import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ChatBubbleLeftRight, Spinner } from "@medusajs/icons";
import { Badge, Button, Container, Heading, Input, Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { sdk } from "../../lib/sdk";
import {
  KIND_LABELS,
  STATUS_LABELS,
  when,
  type SupportRequest,
  type SupportStatus,
} from "./shared";

type Inbox = {
  requests: SupportRequest[];
  count: number;
  counts: Record<SupportStatus, number>;
};

const TABS: { status: SupportStatus; label: string }[] = [
  { status: "open", label: "Waiting on us" },
  { status: "awaiting_customer", label: "Waiting on customer" },
  { status: "resolved", label: "Resolved" },
];

const PAGE = 50;

/** Customer requests from the contact page and orders' "Get help" forms. */
const SupportInboxPage = () => {
  const [status, setStatus] = useState<SupportStatus>("open");
  const [mine, setMine] = useState(false);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);

  const inbox = useQuery({
    queryKey: ["support-inbox", status, mine, search, offset],
    queryFn: () =>
      sdk.client.fetch<Inbox>("/admin/support-requests", {
        query: {
          status,
          ...(mine ? { assigned_to: "me" } : {}),
          ...(search.trim() ? { q: search.trim() } : {}),
          offset,
          limit: PAGE,
        },
      }),
  });

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-4 px-6 py-4">
        <div className="flex flex-col gap-y-1">
          <Heading level="h1">Support inbox</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Messages from the contact page and orders' "Get help" forms. Replies
            here are emailed to the customer with a link to the conversation.
          </Text>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((tab) => (
            <Button
              key={tab.status}
              size="small"
              variant={status === tab.status ? "primary" : "secondary"}
              onClick={() => {
                setStatus(tab.status);
                setOffset(0);
              }}
            >
              {tab.label}
              {inbox.data && ` (${inbox.data.counts[tab.status]})`}
            </Button>
          ))}
          <Button
            size="small"
            variant={mine ? "primary" : "transparent"}
            onClick={() => {
              setMine(!mine);
              setOffset(0);
            }}
          >
            Assigned to me
          </Button>
          <Input
            size="small"
            type="search"
            placeholder="Reference, email or name"
            className="ml-auto w-64"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setOffset(0);
            }}
          />
        </div>
      </div>

      {inbox.isLoading ? (
        <div className="flex justify-center px-6 py-8">
          <Spinner className="text-ui-fg-subtle animate-spin" />
        </div>
      ) : inbox.isError ? (
        <Text size="small" className="text-ui-fg-error px-6 py-4">
          Couldn't load the inbox.
        </Text>
      ) : !inbox.data?.requests.length ? (
        <Text size="small" className="text-ui-fg-subtle px-6 py-4">
          Nothing here.
        </Text>
      ) : (
        <>
          {inbox.data.requests.map((request) => (
            <Link
              key={request.id}
              to={`/support-inbox/${request.id}`}
              className="hover:bg-ui-bg-base-hover flex flex-col gap-1 px-6 py-3 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Text size="small" leading="compact" weight="plus">
                    {request.name}
                  </Text>
                  <Text
                    size="small"
                    leading="compact"
                    className="text-ui-fg-subtle"
                  >
                    {request.reference}
                  </Text>
                  {request.priority === "high" && (
                    <Badge size="2xsmall" color="red">
                      High
                    </Badge>
                  )}
                  <Badge
                    size="2xsmall"
                    color={STATUS_LABELS[request.status].color}
                  >
                    {STATUS_LABELS[request.status].label}
                  </Badge>
                </div>
                <Text
                  size="small"
                  leading="compact"
                  className="text-ui-fg-subtle"
                >
                  {KIND_LABELS[request.kind] ?? request.kind}
                  {request.order_display_id
                    ? ` · order #${request.order_display_id}`
                    : ""}{" "}
                  · {request.email}
                </Text>
              </div>
              <Text
                size="small"
                leading="compact"
                className="text-ui-fg-subtle shrink-0"
              >
                {when(request.last_message_at)}
              </Text>
            </Link>
          ))}
          {inbox.data.count > PAGE && (
            <div className="flex items-center justify-between px-6 py-3">
              <Text size="small" className="text-ui-fg-subtle">
                {offset + 1}–{Math.min(offset + PAGE, inbox.data.count)} of{" "}
                {inbox.data.count}
              </Text>
              <div className="flex gap-2">
                <Button
                  size="small"
                  variant="secondary"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE))}
                >
                  Previous
                </Button>
                <Button
                  size="small"
                  variant="secondary"
                  disabled={offset + PAGE >= inbox.data.count}
                  onClick={() => setOffset(offset + PAGE)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Support inbox",
  icon: ChatBubbleLeftRight,
});

export default SupportInboxPage;
