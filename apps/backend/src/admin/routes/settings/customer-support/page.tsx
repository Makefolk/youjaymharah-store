import { defineRouteConfig } from "@medusajs/admin-sdk";
import { PencilSquare, Spinner } from "@medusajs/icons";
import {
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
import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";

import { usePermissions } from "../../../lib/permissions";
import { sdk } from "../../../lib/sdk";

type SupportInfo = {
  hours: string | null;
  response_time: string | null;
  phone: string | null;
  whatsapp: string | null;
  delivery_information: string | null;
};

const SUPPORT_INFO_KEY = ["support-info"];

const FIELDS: {
  key: keyof SupportInfo;
  label: string;
  hint: string;
  placeholder: string;
  multiline?: boolean;
}[] = [
  {
    key: "hours",
    label: "Support hours",
    hint: "When someone answers messages and calls.",
    placeholder: "Monday to Friday, 9am to 6pm (WAT)",
  },
  {
    key: "response_time",
    label: "Typical reply time",
    hint: 'Completes "We usually reply …" on the contact page and in the reply customers get after writing.',
    placeholder: "within one working day",
  },
  {
    key: "phone",
    label: "Phone",
    hint: "International form, starting with +. Leave empty to show no number.",
    placeholder: "+2348012345678",
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    hint: "International form; the website links straight to a chat.",
    placeholder: "+2348012345678",
  },
  {
    key: "delivery_information",
    label: "Delivery information",
    hint: "Where you deliver, how long it takes and what it costs, for the delivery page. Prices at checkout come from your shipping options.",
    placeholder:
      "Lagos: 1 to 2 working days.\nRest of Nigeria: 3 to 5 working days.",
    multiline: true,
  },
];

function saveError(error: Error & { status?: number }) {
  toast.error(
    error.status === 403
      ? "Only the Store Manager and the store owner can change these details."
      : error.message,
  );
}

/**
 * What the website's contact and delivery pages show. The support email is
 * set under Settings › Storefront › Brand.
 */
const CustomerSupportPage = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { can } = usePermissions();
  const canEdit = can("support_info", "update");

  const query = useQuery({
    queryKey: SUPPORT_INFO_KEY,
    queryFn: () =>
      sdk.client.fetch<{ support_info: SupportInfo }>("/admin/support-info"),
  });
  const info = query.data?.support_info;

  return (
    <Container className="divide-y p-0">
      <div className="flex items-start justify-between gap-x-4 px-6 py-4">
        <div className="flex flex-col gap-y-1">
          <Heading level="h2">Customer support</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            How customers can reach you, shown on the website's contact page.
            Messages from its form go to the support email under Settings ›
            Storefront › Brand.
          </Text>
        </div>
        {canEdit && (
          <Button
            size="small"
            variant="secondary"
            disabled={!info}
            onClick={() => setOpen(true)}
          >
            <PencilSquare />
            Edit
          </Button>
        )}
      </div>
      {query.isLoading ? (
        <div className="flex justify-center px-6 py-8">
          <Spinner className="text-ui-fg-subtle animate-spin" />
        </div>
      ) : query.error ? (
        <Row label="Details" value="You don't have access to these details." />
      ) : info ? (
        <>
          {FIELDS.map((field) => (
            <Row
              key={field.key}
              label={field.label}
              value={
                info[field.key] ? (
                  <span className="whitespace-pre-line">{info[field.key]}</span>
                ) : (
                  "Not shown"
                )
              }
            />
          ))}
          <EditDrawer
            info={info}
            open={open}
            onOpenChange={setOpen}
            onSaved={(updated) =>
              queryClient.setQueryData<{ support_info: SupportInfo }>(
                SUPPORT_INFO_KEY,
                { support_info: updated },
              )
            }
          />
        </>
      ) : null}
    </Container>
  );
};

const EditDrawer = ({
  info,
  open,
  onOpenChange,
  onSaved,
}: {
  info: SupportInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (info: SupportInfo) => void;
}) => {
  const [values, setValues] = useState<Record<keyof SupportInfo, string>>(() =>
    blank(info),
  );

  useEffect(() => {
    if (open) setValues(blank(info));
  }, [open, info]);

  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ support_info: SupportInfo }>("/admin/support-info", {
        method: "POST",
        body: values,
      }),
    onSuccess: ({ support_info }) => {
      toast.success("Contact details saved.");
      onSaved(support_info);
      onOpenChange(false);
    },
    onError: saveError,
  });

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Edit contact details</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-5 overflow-y-auto">
          {FIELDS.map((field) => {
            const id = `support-${field.key}`;
            const props = {
              id,
              value: values[field.key],
              placeholder: field.placeholder,
              onChange: (
                event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
              ) =>
                setValues((current) => ({
                  ...current,
                  [field.key]: event.target.value,
                })),
            };
            return (
              <div key={field.key} className="flex flex-col gap-y-2">
                <Label htmlFor={id} size="small" weight="plus">
                  {field.label}
                </Label>
                {field.multiline ? (
                  <Textarea rows={5} {...props} />
                ) : (
                  <Input {...props} />
                )}
                <Text
                  size="small"
                  leading="compact"
                  className="text-ui-fg-subtle"
                >
                  {field.hint}
                </Text>
              </div>
            );
          })}
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
          <Button
            size="small"
            isLoading={save.isPending}
            onClick={() => save.mutate()}
          >
            Save
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

const blank = (info: SupportInfo) =>
  Object.fromEntries(
    FIELDS.map((field) => [field.key, info[field.key] ?? ""]),
  ) as Record<keyof SupportInfo, string>;

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
  label: "Customer support",
});

export default CustomerSupportPage;
