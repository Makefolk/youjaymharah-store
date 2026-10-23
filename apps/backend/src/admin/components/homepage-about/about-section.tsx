import { PencilSquare } from "@medusajs/icons";
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
  Textarea,
  toast,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";

import {
  HomepageAbout,
  completeHomepageAbout,
  type HomepageAboutContent,
} from "../../../modules/storefront-settings/homepage-about";
import { usePermissions } from "../../lib/permissions";
import { sdk } from "../../lib/sdk";
import { uploadImage } from "../../lib/upload-image";

const SETTINGS_KEY = ["storefront-settings"];
type SettingsResponse = {
  settings: { homepage_about: HomepageAboutContent };
};

export function AboutSection() {
  const [open, setOpen] = useState(false);
  const { can } = usePermissions();
  const settings = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () =>
      sdk.client.fetch<SettingsResponse>("/admin/storefront-settings"),
  });
  const about = settings.data?.settings.homepage_about;
  const canEdit = can("storefront_settings", "update");

  return (
    <Container className="p-0">
      <div className="flex items-start justify-between gap-4 px-6 py-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Heading level="h2">Homepage About</Heading>
            <Badge size="2xsmall" color="grey">
              Marketing &amp; Store Manager
            </Badge>
          </div>
          <Text size="small" className="text-ui-fg-subtle">
            A short introduction below the homepage collections. The full About
            page is managed in Settings → Pages.
          </Text>
        </div>
        <Button
          size="small"
          variant="secondary"
          disabled={!canEdit || !about}
          onClick={() => setOpen(true)}
        >
          <PencilSquare /> Edit
        </Button>
      </div>
      <div className="border-ui-border-base border-t px-6 py-4">
        {settings.isLoading ? (
          <Text size="small">Loading About section...</Text>
        ) : settings.isError || !about ? (
          <Text size="small" role="alert">
            The About section could not be loaded.
          </Text>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <Badge color={about.enabled ? "green" : "grey"}>
                {about.enabled ? "Visible" : "Hidden"}
              </Badge>
            </div>
            {about.eyebrow && (
              <Text size="small" className="text-ui-fg-subtle">
                {about.eyebrow}
              </Text>
            )}
            {about.title && (
              <Text weight="plus" className="whitespace-pre-line">
                {about.title}
              </Text>
            )}
            {about.description && (
              <Text
                size="small"
                className="text-ui-fg-subtle max-w-2xl whitespace-pre-line"
              >
                {about.description}
              </Text>
            )}
            {about.image_url ? (
              <img
                src={about.image_url}
                alt={about.image_alt ?? ""}
                className="h-28 w-24 rounded object-cover"
              />
            ) : (
              <Text size="small" className="text-ui-fg-subtle">
                Uses the store’s brand panel. Add an image to replace it.
              </Text>
            )}
            {about.cta_label && (
              <Text size="small">
                {about.cta_label} → {about.cta_url}
              </Text>
            )}
          </div>
        )}
      </div>
      {open && about && canEdit && (
        <AboutEditor initial={about} onClose={() => setOpen(false)} />
      )}
    </Container>
  );
}

const TEXT_FIELDS = [
  { key: "eyebrow", label: "Small heading", max: 60 },
  {
    key: "title",
    label: "Heading",
    max: 120,
    rows: 2,
    hint: "Use a new line where you want the heading to break.",
  },
  {
    key: "description",
    label: "Introduction",
    max: 1200,
    rows: 7,
    hint: "Separate paragraphs with a blank line. Plain text only.",
  },
  {
    key: "cta_label",
    label: "Link label",
    max: 40,
    hint: "Optional. Leave both link fields empty for no link.",
  },
  {
    key: "cta_url",
    label: "Link destination",
    max: 2048,
    hint: "For example, /products. Use /about after publishing the full About page.",
  },
] as const;

function AboutEditor({
  initial,
  onClose,
}: {
  initial: HomepageAboutContent;
  onClose: () => void;
}) {
  const [about, setAbout] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const upload = useMutation({
    mutationFn: uploadImage,
    onSuccess: (url) => setAbout((current) => ({ ...current, image_url: url })),
    onError: (error: Error) => toast.error(error.message),
  });
  const save = useMutation({
    mutationFn: (value: HomepageAboutContent) =>
      sdk.client.fetch<SettingsResponse>("/admin/storefront-settings", {
        method: "POST",
        body: { homepage_about: value },
      }),
    onSuccess: (response) => {
      queryClient.setQueryData(SETTINGS_KEY, response);
      toast.success("Homepage About saved");
      onClose();
    },
    onError: (error: Error & { status?: number }) => {
      toast.error(
        error.status === 403
          ? "Your role cannot edit storefront content."
          : error.message,
      );
    },
  });
  const busy = upload.isPending || save.isPending;
  const setText = (
    key: keyof Omit<HomepageAboutContent, "enabled">,
    value: string,
  ) => {
    setAbout((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    save.reset();
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const parsed = HomepageAbout.safeParse(completeHomepageAbout(about));
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        nextErrors[String(issue.path[0])] = issue.message;
      setErrors(nextErrors);
      document.getElementById(`about-${Object.keys(nextErrors)[0]}`)?.focus();
      return;
    }
    setErrors({});
    save.mutate(completeHomepageAbout(parsed.data));
  }

  return (
    <Drawer
      open
      onOpenChange={(opened) => {
        if (!opened && !busy) onClose();
      }}
    >
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Edit homepage About</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="overflow-y-auto">
          <form id="homepage-about-form" onSubmit={submit} noValidate>
            <fieldset disabled={busy} className="flex flex-col gap-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="about-enabled">Show on homepage</Label>
                  <Text size="small" className="text-ui-fg-subtle">
                    Turn off to hide the section while you prepare it.
                  </Text>
                </div>
                <Switch
                  id="about-enabled"
                  checked={about.enabled}
                  onCheckedChange={(enabled) =>
                    setAbout((current) => ({ ...current, enabled }))
                  }
                />
              </div>
              {TEXT_FIELDS.map((field) => {
                const id = `about-${field.key}`;
                const props = {
                  id,
                  value: about[field.key] ?? "",
                  maxLength: field.max,
                  onChange: (
                    event: React.ChangeEvent<
                      HTMLInputElement | HTMLTextAreaElement
                    >,
                  ) => setText(field.key, event.target.value),
                  "aria-invalid": Boolean(errors[field.key]),
                  "aria-describedby": `${id}-hint`,
                };
                return (
                  <div key={field.key} className="flex flex-col gap-2">
                    <Label htmlFor={id}>{field.label}</Label>
                    {"rows" in field ? (
                      <Textarea {...props} rows={field.rows} />
                    ) : (
                      <Input {...props} />
                    )}
                    <Text
                      id={`${id}-hint`}
                      size="small"
                      className={
                        errors[field.key]
                          ? "text-ui-fg-error"
                          : "text-ui-fg-subtle"
                      }
                    >
                      {errors[field.key] ||
                        ("hint" in field
                          ? field.hint
                          : `Up to ${field.max} characters.`)}
                    </Text>
                  </div>
                );
              })}
              <div className="flex flex-col gap-2">
                <Label htmlFor="about-image_url">Image (optional)</Label>
                {about.image_url && (
                  <img
                    src={about.image_url}
                    alt={about.image_alt ?? "Image preview"}
                    className="h-48 w-40 rounded object-cover"
                  />
                )}
                <input
                  id="about-image_url"
                  ref={fileInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    if (
                      !["image/png", "image/jpeg", "image/webp"].includes(
                        file.type,
                      ) ||
                      file.size > 10 * 1024 * 1024
                    ) {
                      toast.error(
                        "Choose a PNG, JPEG or WebP image up to 10 MB.",
                      );
                      return;
                    }
                    upload.mutate(file);
                  }}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="small"
                    variant="secondary"
                    disabled={busy}
                    isLoading={upload.isPending}
                    onClick={() => fileInput.current?.click()}
                  >
                    {about.image_url ? "Replace image" : "Upload image"}
                  </Button>
                  {about.image_url && (
                    <Button
                      type="button"
                      size="small"
                      variant="transparent"
                      onClick={() =>
                        setAbout((current) => ({
                          ...current,
                          image_url: null,
                          image_alt: null,
                        }))
                      }
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <Text size="small" className="text-ui-fg-subtle">
                  A portrait image works best. Without an image, the store’s
                  brand panel appears.
                </Text>
                {errors.image_url && (
                  <Text size="small" className="text-ui-fg-error">
                    {errors.image_url}
                  </Text>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="about-image_alt">Image description</Label>
                <Input
                  id="about-image_alt"
                  value={about.image_alt ?? ""}
                  maxLength={240}
                  disabled={!about.image_url}
                  aria-invalid={Boolean(errors.image_alt)}
                  aria-describedby="about-image_alt-hint"
                  onChange={(event) => setText("image_alt", event.target.value)}
                />
                <Text
                  id="about-image_alt-hint"
                  size="small"
                  className={
                    errors.image_alt ? "text-ui-fg-error" : "text-ui-fg-subtle"
                  }
                >
                  {errors.image_alt ||
                    "Briefly describe the photo for people using screen readers."}
                </Text>
              </div>
              {save.isError && (
                <Text role="alert" size="small" className="text-ui-fg-error">
                  Your changes weren’t saved. Please check the fields and try
                  again.
                </Text>
              )}
            </fieldset>
          </form>
        </Drawer.Body>
        <Drawer.Footer>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="homepage-about-form"
            disabled={busy}
            isLoading={save.isPending}
          >
            Save
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
}
