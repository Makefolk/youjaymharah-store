import { defineRouteConfig } from "@medusajs/admin-sdk";
import { PencilSquare, Spinner } from "@medusajs/icons";
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Switch,
  Text,
  toast,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";

import { usePermissions } from "../../../lib/permissions";
import { sdk } from "../../../lib/sdk";

type ReturnPolicy = { enabled: boolean; window_days: number };

const POLICY_KEY = ["return-policy"];

const days = (count: number) => `${count} ${count === 1 ? "day" : "days"}`;

/** Staff without edit rights get a 403; say why instead of a raw error. */
function saveError(error: Error & { status?: number }) {
  toast.error(
    error.status === 403
      ? "Only the Store Manager and the store owner can change the return policy."
      : error.message,
  );
}

const ReturnsPage = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { can } = usePermissions();
  const canEdit = can("return_policy", "update");

  const policyQuery = useQuery({
    queryKey: POLICY_KEY,
    queryFn: () =>
      sdk.client.fetch<{ return_policy: ReturnPolicy }>("/admin/return-policy"),
  });
  const policy = policyQuery.data?.return_policy;

  return (
    <Container className="divide-y p-0">
      <div className="flex items-start justify-between gap-x-4 px-6 py-4">
        <div className="flex flex-col gap-y-1">
          <div className="flex items-center gap-x-2">
            <Heading level="h2">Returns</Heading>
            {policy && (
              <Badge size="2xsmall" color={policy.enabled ? "green" : "grey"}>
                {policy.enabled ? "On" : "Off"}
              </Badge>
            )}
          </div>
          <Text size="small" className="text-ui-fg-subtle">
            Lets customers request a return from their order page on the
            website. Each request appears on the order as a requested return for
            you to receive and refund as usual.
          </Text>
        </div>
        {canEdit && (
          <Button
            size="small"
            variant="secondary"
            disabled={!policy}
            onClick={() => setOpen(true)}
          >
            <PencilSquare />
            Edit
          </Button>
        )}
      </div>
      {policyQuery.isLoading ? (
        <div className="flex justify-center px-6 py-8">
          <Spinner className="text-ui-fg-subtle animate-spin" />
        </div>
      ) : policyQuery.error ? (
        <Row
          label="Policy"
          value="You don't have access to the return policy."
        />
      ) : policy ? (
        <>
          <Row
            label="Return requests"
            value={
              policy.enabled
                ? "Customers can request a return online."
                : "Off. Customers are asked to contact you instead."
            }
          />
          <Row
            label="Return window"
            value={`${days(policy.window_days)} after delivery`}
          />
          <div className="flex flex-col gap-y-2 px-6 py-4">
            <Text size="small" leading="compact" weight="plus">
              How the window is counted
            </Text>
            <Text size="small" leading="compact" className="text-ui-fg-subtle">
              From when a shipment is marked delivered. If it was never marked
              delivered, from when it was marked shipped, so mark deliveries to
              give customers the full window. Staff can always create a return
              from the order page, inside or outside the window.
            </Text>
          </div>
          <EditDrawer
            policy={policy}
            open={open}
            onOpenChange={setOpen}
            onSaved={(updated) =>
              queryClient.setQueryData<{ return_policy: ReturnPolicy }>(
                POLICY_KEY,
                { return_policy: updated },
              )
            }
          />
        </>
      ) : null}
    </Container>
  );
};

const EditDrawer = ({
  policy,
  open,
  onOpenChange,
  onSaved,
}: {
  policy: ReturnPolicy;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (policy: ReturnPolicy) => void;
}) => {
  const [enabled, setEnabled] = useState(policy.enabled);
  const [windowDays, setWindowDays] = useState("");
  const [showProblem, setShowProblem] = useState(false);

  useEffect(() => {
    if (open) {
      setEnabled(policy.enabled);
      setWindowDays(String(policy.window_days));
      setShowProblem(false);
    }
  }, [open, policy]);

  const parsed = Number(windowDays);
  const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 365;

  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ return_policy: ReturnPolicy }>(
        "/admin/return-policy",
        { method: "POST", body: { enabled, window_days: parsed } },
      ),
    onSuccess: ({ return_policy }) => {
      toast.success("Return policy saved.");
      onSaved(return_policy);
      onOpenChange(false);
    },
    onError: saveError,
  });

  const onSave = () => {
    if (!valid) {
      setShowProblem(true);
      return;
    }
    save.mutate();
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Edit return policy</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-5 overflow-y-auto">
          <div className="border-ui-border-base flex items-start justify-between gap-x-4 rounded-lg border px-4 py-3">
            <div className="flex flex-col gap-y-1">
              <Label htmlFor="returns-enabled" size="small" weight="plus">
                Let customers request returns
              </Label>
              <Text
                size="small"
                leading="compact"
                className="text-ui-fg-subtle"
              >
                Off hides "Request a return" on the website. Requests already
                made are unaffected.
              </Text>
            </div>
            <Switch
              id="returns-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="returns-window" size="small" weight="plus">
              Return window
            </Label>
            <div className="flex items-center gap-x-2">
              <Input
                id="returns-window"
                type="number"
                min={1}
                max={365}
                step={1}
                className="w-28"
                value={windowDays}
                aria-invalid={showProblem && !valid}
                onChange={(event) => setWindowDays(event.target.value)}
              />
              <Text
                size="small"
                leading="compact"
                className="text-ui-fg-subtle"
              >
                days after delivery
              </Text>
            </div>
            <Text
              size="small"
              leading="compact"
              className={
                showProblem && !valid ? "text-ui-fg-error" : "text-ui-fg-subtle"
              }
            >
              {showProblem && !valid
                ? "Enter whole days from 1 to 365."
                : "Applies to every order, including ones already delivered."}
            </Text>
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Button
            size="small"
            variant="secondary"
            disabled={save.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button size="small" isLoading={save.isPending} onClick={onSave}>
            Save
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

const Row = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="grid grid-cols-2 items-start gap-x-4 px-6 py-4">
    <Text size="small" leading="compact" weight="plus">
      {label}
    </Text>
    <Text size="small" leading="compact" className="text-ui-fg-subtle">
      {value}
    </Text>
  </div>
);

export const config = defineRouteConfig({
  label: "Returns",
});

export default ReturnsPage;
