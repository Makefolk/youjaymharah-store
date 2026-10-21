import { defineRouteConfig } from "@medusajs/admin-sdk";
import { EnvelopeSolid, Spinner } from "@medusajs/icons";
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { TEMPLATE_LABELS } from "../../components/email-history/email-history-list";
import { usePermissions } from "../../lib/permissions";
import { sdk } from "../../lib/sdk";

type ReviewEntry = {
  id: string;
  state: "needs_review" | "stalled";
  attempts: number;
  first_attempt_at: string | null;
  template: string | null;
  to: string | null;
  resource_type: string | null;
  resource_id: string | null;
};

type Verdict = "sent" | "not_sent";

const QUEUE_KEY = ["email-review"];

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Unknown";

/** After "not sent": how to get the customer what they missed. */
function replacementAdvice(entry: ReviewEntry): string {
  switch (entry.template) {
    case "order-placed":
      return "Open the order and use Resend › Order confirmation.";
    case "order-shipped":
      return "Open the order and use Resend › Shipping email.";
    case "password-reset":
    case "email-verification":
    case "return-access":
      return "Its link has likely expired; ask the customer to request a new one from the website.";
    case "invite-user":
      return "Send the invite again from Settings › Users.";
    default:
      return "If it matters, tell the customer yourself by email.";
  }
}

/**
 * Emails whose fate is unknown: Resend didn't answer, so the store stopped
 * sending rather than risk a duplicate. Check each against Resend's email log
 * and record what happened (docs/email-reliability.md, "Reviewing uncertain
 * deliveries").
 */
const EmailReviewPage = () => {
  const { can } = usePermissions();
  const canResolve = can("order", "update");
  const [resolving, setResolving] = useState<{
    entry: ReviewEntry;
    verdict: Verdict;
  } | null>(null);

  const queue = useQuery({
    queryKey: QUEUE_KEY,
    queryFn: () =>
      sdk.client.fetch<{ deliveries: ReviewEntry[]; count: number }>(
        "/admin/email-review",
      ),
  });
  const entries = queue.data?.deliveries ?? [];

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-y-1 px-6 py-4">
        <div className="flex items-center gap-x-2">
          <Heading level="h1">Email review</Heading>
          {queue.data && (
            <Badge size="2xsmall" color={queue.data.count ? "orange" : "green"}>
              {queue.data.count ? `${queue.data.count} to check` : "All clear"}
            </Badge>
          )}
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          Emails Resend never confirmed. The store stopped sending them rather
          than risk the customer getting two. Find each one in Resend's email
          log by recipient and time, then record what happened.
        </Text>
      </div>

      {queue.isLoading ? (
        <div className="flex justify-center px-6 py-8">
          <Spinner className="text-ui-fg-subtle animate-spin" />
        </div>
      ) : queue.isError ? (
        <Text size="small" className="text-ui-fg-error px-6 py-4">
          Couldn't load the emails to review.
        </Text>
      ) : !entries.length ? (
        <Text size="small" className="text-ui-fg-subtle px-6 py-4">
          Nothing to check. Every recent email was either sent or is still being
          retried.
        </Text>
      ) : (
        entries.map((entry) => (
          <div
            key={entry.id}
            className="flex flex-col gap-3 px-6 py-4 md:flex-row md:items-start md:justify-between"
          >
            <div className="flex min-w-0 flex-col gap-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Text size="small" leading="compact" weight="plus">
                  {entry.template
                    ? (TEMPLATE_LABELS[entry.template] ?? entry.template)
                    : "Unknown email"}
                </Text>
                <Badge size="2xsmall" color="orange">
                  {entry.state === "needs_review" ? "Blocked" : "No answer"}
                </Badge>
              </div>
              <Text
                size="small"
                leading="compact"
                className="text-ui-fg-subtle"
              >
                To {entry.to ?? "an unknown address"} · first tried{" "}
                {formatDate(entry.first_attempt_at)} · {entry.attempts}{" "}
                {entry.attempts === 1 ? "attempt" : "attempts"}
              </Text>
              {entry.resource_type === "order" && entry.resource_id && (
                <Link
                  to={`/orders/${entry.resource_id}`}
                  className="text-ui-fg-interactive txt-compact-small"
                >
                  Open the order
                </Link>
              )}
            </div>
            {canResolve && (
              <div className="flex shrink-0 gap-2">
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => setResolving({ entry, verdict: "sent" })}
                >
                  It was sent
                </Button>
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => setResolving({ entry, verdict: "not_sent" })}
                >
                  It wasn't sent
                </Button>
              </div>
            )}
          </div>
        ))
      )}

      {resolving && (
        <ResolveDrawer
          entry={resolving.entry}
          verdict={resolving.verdict}
          onClose={() => setResolving(null)}
        />
      )}
    </Container>
  );
};

const ResolveDrawer = ({
  entry,
  verdict,
  onClose,
}: {
  entry: ReviewEntry;
  verdict: Verdict;
  onClose: () => void;
}) => {
  const queryClient = useQueryClient();
  const [resendId, setResendId] = useState("");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!open) onClose();
  }, [open, onClose]);

  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/email-review/${entry.id}/resolve`, {
        method: "POST",
        body:
          verdict === "sent"
            ? { resolution: "sent", provider_id: resendId.trim(), note }
            : { resolution: "not_sent", note },
      }),
    onSuccess: () => {
      toast.success(
        verdict === "sent"
          ? "Recorded as sent."
          : `Recorded as not sent. ${replacementAdvice(entry)}`,
      );
      void queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
      setOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>
            {verdict === "sent" ? "Record as sent" : "Record as not sent"}
          </Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-5 overflow-y-auto">
          <Text size="small" className="text-ui-fg-subtle">
            {verdict === "sent"
              ? "Only if Resend's email log shows this email to this address at about this time. Paste its ID from there as evidence."
              : `Only if Resend's email log has no such email. It stays blocked, so it can never go out late. ${replacementAdvice(entry)}`}
          </Text>
          {verdict === "sent" && (
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="resend-id" size="small" weight="plus">
                Resend email ID
              </Label>
              <Input
                id="resend-id"
                placeholder="4ef9a417-02e9-4d39-ad75-9611e0fcc33c"
                value={resendId}
                onChange={(event) => setResendId(event.target.value)}
              />
            </div>
          )}
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="resolution-note" size="small" weight="plus">
              Note (optional)
            </Label>
            <Textarea
              id="resolution-note"
              rows={3}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Button
            size="small"
            variant="secondary"
            disabled={save.isPending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            size="small"
            isLoading={save.isPending}
            disabled={verdict === "sent" && !resendId.trim()}
            onClick={() => save.mutate()}
          >
            Record
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

export const config = defineRouteConfig({
  label: "Email review",
  icon: EnvelopeSolid,
});

export default EmailReviewPage;
