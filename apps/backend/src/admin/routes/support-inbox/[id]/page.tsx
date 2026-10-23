import { Spinner } from "@medusajs/icons";
import {
  Badge,
  Button,
  Container,
  Heading,
  Select,
  Switch,
  Text,
  Textarea,
  toast,
  usePrompt,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { usePermissions } from "../../../lib/permissions";
import { sdk } from "../../../lib/sdk";
import {
  KIND_LABELS,
  STATUS_LABELS,
  when,
  type SupportMessage,
  type SupportRequest,
  type SupportStatus,
} from "../shared";

type User = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

const userName = (user: User) =>
  [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;

/** One request: its conversation, a reply box, and who is working it. */
const SupportRequestPage = () => {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canUpdate = can("support_request", "update");
  const prompt = usePrompt();
  const key = ["support-request", id];

  const request = useQuery({
    queryKey: key,
    queryFn: () =>
      sdk.client.fetch<{
        request: SupportRequest & { messages: SupportMessage[] };
      }>(`/admin/support-requests/${id}`),
  });
  const users = useQuery({
    queryKey: ["support-users"],
    queryFn: () => sdk.admin.user.list({ limit: 100 }),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: ["support-inbox"] });
  };

  const update = useMutation({
    mutationFn: (
      body: Partial<
        Pick<SupportRequest, "status" | "priority" | "assigned_to">
      >,
    ) =>
      sdk.client.fetch(`/admin/support-requests/${id}`, {
        method: "POST",
        body,
      }),
    onSuccess: () => {
      toast.success("Saved.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const revokeLinks = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/support-requests/${id}/revoke-links`, {
        method: "POST",
      }),
    onSuccess: () => {
      toast.success("Earlier links no longer work.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const confirmRevokeLinks = async () => {
    const confirmed = await prompt({
      title: "Cancel the customer's links?",
      description:
        "Every link to this request we've emailed so far stops working, for a link that was forwarded or leaked. The customer can still open it signed in, and your next reply emails a new link.",
      confirmText: "Cancel links",
      cancelText: "Keep them",
    });
    if (confirmed) revokeLinks.mutate();
  };

  if (request.isLoading) {
    return (
      <Container className="flex justify-center px-6 py-8">
        <Spinner className="text-ui-fg-subtle animate-spin" />
      </Container>
    );
  }
  if (!request.data) {
    return (
      <Container className="px-6 py-4">
        <Text size="small" className="text-ui-fg-error">
          Couldn't load this request.
        </Text>
      </Container>
    );
  }

  const r = request.data.request;
  const assignee = users.data?.users.find((user) => user.id === r.assigned_to);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Container className="flex flex-col gap-1 px-6 py-4">
          <Link
            to="/support-inbox"
            className="text-ui-fg-subtle txt-compact-small"
          >
            ← Support inbox
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Heading level="h1">{r.reference}</Heading>
            <Badge size="2xsmall" color={STATUS_LABELS[r.status].color}>
              {STATUS_LABELS[r.status].label}
            </Badge>
            {r.priority === "high" && (
              <Badge size="2xsmall" color="red">
                High priority
              </Badge>
            )}
          </div>
          <Text size="small" className="text-ui-fg-subtle">
            {KIND_LABELS[r.kind] ?? r.kind} · from {r.name} &lt;{r.email}&gt; ·
            opened {when(r.created_at)}
          </Text>
        </Container>

        <Container className="divide-y p-0">
          {r.messages.map((message) => (
            <Message key={message.id} message={message} />
          ))}
        </Container>

        {canUpdate && <ReplyBox requestId={r.id} onSent={refresh} />}
      </div>

      <Container className="flex flex-col gap-4 px-6 py-4 lg:w-80 lg:shrink-0">
        <Field label="Status">
          <Select
            value={r.status}
            disabled={!canUpdate || update.isPending}
            onValueChange={(value) =>
              update.mutate({ status: value as SupportStatus })
            }
          >
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {(Object.keys(STATUS_LABELS) as SupportStatus[]).map((status) => (
                <Select.Item key={status} value={status}>
                  {STATUS_LABELS[status].label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </Field>
        <Field label="Assigned to">
          <Select
            value={r.assigned_to ?? "none"}
            disabled={!canUpdate || update.isPending}
            onValueChange={(value) =>
              update.mutate({ assigned_to: value === "none" ? null : value })
            }
          >
            <Select.Trigger>
              <Select.Value
                placeholder={assignee ? userName(assignee) : "Nobody"}
              />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="none">Nobody</Select.Item>
              {(users.data?.users ?? []).map((user) => (
                <Select.Item key={user.id} value={user.id}>
                  {userName(user as User)}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </Field>
        <div className="flex items-center justify-between">
          <Text size="small" weight="plus">
            High priority
          </Text>
          <Switch
            checked={r.priority === "high"}
            disabled={!canUpdate || update.isPending}
            onCheckedChange={(on) =>
              update.mutate({ priority: on ? "high" : "normal" })
            }
          />
        </div>
        {r.order_id && (
          <Link
            to={`/orders/${r.order_id}`}
            className="text-ui-fg-interactive txt-compact-small-plus"
          >
            Open order #{r.order_display_id}
          </Link>
        )}
        {!r.order_id && r.order_display_id && (
          <Text size="small" className="text-ui-fg-subtle">
            Mentions order #{r.order_display_id}, which isn't one placed with
            this email. Check before sharing any details.
          </Text>
        )}
        {r.customer_id && (
          <Link
            to={`/customers/${r.customer_id}`}
            className="text-ui-fg-interactive txt-compact-small-plus"
          >
            Open customer
          </Link>
        )}
        {canUpdate && (
          <div className="flex flex-col gap-1 border-t pt-4">
            <Button
              size="small"
              variant="secondary"
              isLoading={revokeLinks.isPending}
              onClick={confirmRevokeLinks}
            >
              Cancel guest links
            </Button>
            <Text size="small" className="text-ui-fg-subtle">
              {r.links_revoked_at
                ? `Links sent before ${when(r.links_revoked_at)} no longer work.`
                : "Emailed links work for 90 days."}
            </Text>
          </div>
        )}
      </Container>
    </div>
  );
};

/**
 * Private photos come as backend paths (`/admin/support-requests/...`),
 * served after a permission check with the dashboard's session cookie.
 */
const photoSrc = (url: string) =>
  url.startsWith("/")
    ? `${(import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "")}${url}`
    : url;

const Message = ({ message }: { message: SupportMessage }) => (
  <div
    className={message.internal ? "bg-ui-bg-highlight px-6 py-4" : "px-6 py-4"}
  >
    <div className="flex flex-wrap items-center gap-2">
      <Text size="small" weight="plus">
        {message.author === "customer"
          ? (message.author_name ?? "Customer")
          : (message.author_name ?? "Staff")}
      </Text>
      {message.internal && (
        <Badge size="2xsmall" color="purple">
          Staff note
        </Badge>
      )}
      <Text size="small" className="text-ui-fg-subtle">
        {when(message.created_at)}
      </Text>
    </div>
    <Text size="small" className="mt-2 whitespace-pre-wrap">
      {message.body}
    </Text>
    {(message.attachments?.files ?? []).length > 0 && (
      <div className="mt-3 flex flex-wrap gap-2">
        {message.attachments!.files!.map((file) => (
          <a
            key={file.url}
            href={photoSrc(file.url)}
            target="_blank"
            rel="noreferrer"
          >
            <img
              src={photoSrc(file.url)}
              alt={file.name}
              className="h-24 w-24 rounded-md object-cover"
            />
          </a>
        ))}
      </div>
    )}
  </div>
);

const ReplyBox = ({
  requestId,
  onSent,
}: {
  requestId: string;
  onSent: () => void;
}) => {
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const send = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/support-requests/${requestId}/messages`, {
        method: "POST",
        body: { body, internal },
      }),
    onSuccess: () => {
      toast.success(internal ? "Note added." : "Reply sent to the customer.");
      setBody("");
      onSent();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Container className="flex flex-col gap-3 px-6 py-4">
      <Textarea
        rows={5}
        value={body}
        placeholder={
          internal
            ? "A note only staff will see"
            : "Your reply, emailed to the customer"
        }
        onChange={(event) => setBody(event.target.value)}
      />
      <div className="flex items-center justify-between gap-4">
        <label className="flex items-center gap-2">
          <Switch checked={internal} onCheckedChange={setInternal} />
          <Text size="small">Note only (not sent to the customer)</Text>
        </label>
        <Button
          size="small"
          disabled={!body.trim()}
          isLoading={send.isPending}
          onClick={() => send.mutate()}
        >
          {internal ? "Add note" : "Send reply"}
        </Button>
      </div>
    </Container>
  );
};

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-y-2">
    <Text size="small" weight="plus">
      {label}
    </Text>
    {children}
  </div>
);

export default SupportRequestPage;
