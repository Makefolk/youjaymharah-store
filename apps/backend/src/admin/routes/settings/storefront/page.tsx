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
  RadioGroup,
  Select,
  Switch,
  Text,
  Textarea,
  toast,
  usePrompt,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { usePermissions } from "../../../lib/permissions";
import { sdk } from "../../../lib/sdk";
import { uploadImage } from "../../../lib/upload-image";
import { RenderFromQuery } from "../../../components/render-from-query";
import { AnnouncementsSection } from "../../../components/announcements/announcements-section";
import { AboutSection } from "../../../components/homepage-about/about-section";

type Branding = {
  id: string;
  name: string;
  logo_url: string | null;
  favicon_url: string | null;
  support_email: string | null;
};

const SOCIAL_NETWORKS = [
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "tiktok", label: "TikTok" },
  { key: "x", label: "X" },
  { key: "youtube", label: "YouTube" },
  { key: "pinterest", label: "Pinterest" },
] as const;

type SocialNetwork = (typeof SOCIAL_NETWORKS)[number]["key"];

type HomepageHero = {
  enabled: boolean;
  eyebrow: string | null;
  title: string | null;
  description: string | null;
  desktop_image_url: string | null;
  mobile_image_url: string | null;
  desktop_video_url: string | null;
  mobile_video_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
};

type StoreMenuPromoTargetType = "collection" | "category" | "product";

type StoreMenuPromo = {
  target_type: StoreMenuPromoTargetType;
  target_id: string;
  image_url: string;
  mobile_image_url: string | null;
};

type PromoOption = {
  id: string;
  title: string;
  type: StoreMenuPromoTargetType;
};

type StorefrontSettings = {
  id: string;
  new_badge_days: number;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  twitter_handle: string | null;
  social_links: Partial<Record<SocialNetwork, string | null>>;
  allow_indexing: boolean;
  google_site_verification: string | null;
  /** Rows saved before the home page settings existed hold only `enabled`. */
  homepage_hero: Partial<HomepageHero>;
  featured_collection_id: string | null;
  store_menu_cards: StoreMenuPromo[];
};

const BRANDING_QUERY_KEY = ["branding"];
const SETTINGS_QUERY_KEY = ["storefront-settings"];
const COLLECTION_OPTIONS_QUERY_KEY = ["storefront-settings", "collections"];
const HERO_HISTORY_QUERY_KEY = ["storefront-settings", "hero-history"];
const PROMO_OPTIONS_QUERY_KEY = ["storefront-settings", "promo-options"];

type HeroRevision = {
  id: string;
  hero: HomepageHero;
  replaced_at: string;
  replaced_by: { id: string; email: string | null; name: string | null } | null;
};

const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 155;

/** Staff without edit rights get a 403; say why instead of a raw error. */
function saveError(error: Error & { status?: number }, who: string) {
  toast.error(
    error.status === 403
      ? `Only ${who} can change these settings.`
      : error.message,
  );
}

const StorefrontSettingsPage = () => (
  <div className="flex flex-col gap-y-3">
    <BrandSection />
    <HomepageSection />
    <AboutSection />
    <AnnouncementsSection />
    <NavigationSection />
    <SharingSection />
    <ProductsSection />
  </div>
);

// Brand -------------------------------------------------------------------

const BrandSection = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: BRANDING_QUERY_KEY,
    queryFn: () => sdk.client.fetch<{ branding: Branding }>("/admin/branding"),
  });

  const branding = data?.branding;
  const { can } = usePermissions();

  return (
    <Section
      title="Brand"
      description="Your store's name, logo, browser icon and support address. The name, logo and support address also appear in customer emails."
      badge="Store owner"
      canEdit={Boolean(branding) && can("branding", "update")}
      onEdit={() => setOpen(true)}
      isLoading={isLoading}
      error={error ? "You don't have access to the brand settings." : null}
    >
      {branding && (
        <>
          <Row label="Store name" value={branding.name} />
          <Row label="Support email" value={branding.support_email} />
          <ImageRow label="Logo" url={branding.logo_url} alt={branding.name} />
          <ImageRow
            label="Browser icon"
            url={branding.favicon_url}
            alt="Browser icon"
            square
          />
          <EditBrandDrawer
            branding={branding}
            open={open}
            onOpenChange={setOpen}
            onSaved={(updated) =>
              queryClient.setQueryData<{ branding: Branding }>(
                BRANDING_QUERY_KEY,
                { branding: updated },
              )
            }
          />
        </>
      )}
    </Section>
  );
};

const EditBrandDrawer = ({
  branding,
  open,
  onOpenChange,
  onSaved,
}: {
  branding: Branding;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (branding: Branding) => void;
}) => {
  const [name, setName] = useState(branding.name);
  const [supportEmail, setSupportEmail] = useState(
    branding.support_email ?? "",
  );
  const [logoUrl, setLogoUrl] = useState(branding.logo_url ?? "");
  const [faviconUrl, setFaviconUrl] = useState(branding.favicon_url ?? "");

  useEffect(() => {
    if (open) {
      setName(branding.name);
      setSupportEmail(branding.support_email ?? "");
      setLogoUrl(branding.logo_url ?? "");
      setFaviconUrl(branding.favicon_url ?? "");
    }
  }, [open, branding]);

  const upload = useMutation({
    mutationFn: ({ file }: { file: File; target: "logo" | "favicon" }) =>
      uploadImage(file),
    onSuccess: (url, { target }) =>
      target === "logo" ? setLogoUrl(url) : setFaviconUrl(url),
    onError: (error: Error) => toast.error(`Upload failed: ${error.message}`),
  });

  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ branding: Branding }>("/admin/branding", {
        method: "POST",
        body: {
          name: name.trim(),
          support_email: supportEmail.trim() || null,
          logo_url: logoUrl || null,
          favicon_url: faviconUrl || null,
        },
      }),
    onSuccess: ({ branding: updated }) => {
      toast.success("Brand settings updated.");
      onSaved(updated);
      onOpenChange(false);
    },
    onError: (error: Error & { status?: number }) =>
      saveError(error, "the store owner"),
  });

  const busy = save.isPending || upload.isPending;

  return (
    <EditDrawer
      title="Edit brand"
      open={open}
      onOpenChange={onOpenChange}
      busy={busy}
      saving={save.isPending}
      canSave={Boolean(name.trim())}
      onSave={() => save.mutate()}
    >
      <Field id="brand-name" label="Store name">
        <Input
          id="brand-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <Field
        id="brand-support-email"
        label="Support email"
        hint="Shown at the bottom of every email you send."
      >
        <Input
          id="brand-support-email"
          type="email"
          value={supportEmail}
          onChange={(event) => setSupportEmail(event.target.value)}
        />
      </Field>
      <ImageField
        label="Logo"
        hint="PNG or SVG on a transparent background, around 240px wide."
        url={logoUrl}
        busy={busy}
        uploading={upload.isPending && upload.variables?.target === "logo"}
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        onUpload={(file) => upload.mutate({ file, target: "logo" })}
        onRemove={() => setLogoUrl("")}
      />
      <ImageField
        label="Browser icon (favicon)"
        hint="A square PNG, at least 512 x 512px. Also used when someone saves the site to their phone's home screen."
        url={faviconUrl}
        square
        busy={busy}
        uploading={upload.isPending && upload.variables?.target === "favicon"}
        accept="image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
        onUpload={(file) => upload.mutate({ file, target: "favicon" })}
        onRemove={() => setFaviconUrl("")}
      />
    </EditDrawer>
  );
};

// Homepage ------------------------------------------------------------------

/** Radix Select can't hold an empty value, so "no collection" needs a name. */
const NO_COLLECTION = "none";

type CollectionOption = { id: string; title: string };

/** Mirrors the backend: a store path like /new-arrivals, or a full address. */
function isLinkDestination(value: string): boolean {
  return (
    (value.startsWith("/") && !value.startsWith("//")) ||
    /^https?:\/\/[^\s/]+\.[^\s]+$/i.test(value)
  );
}

/**
 * Uploads pass through the backend's memory on their way to storage, and a
 * home page video should load quickly on mobile data anyway.
 */
const MAX_VIDEO_MB = 25;

type HeroMedia = "photo" | "video";

type HeroDraft = {
  enabled: boolean;
  eyebrow: string;
  title: string;
  description: string;
  media: HeroMedia;
  desktopImageUrl: string;
  mobileImageUrl: string;
  desktopVideoUrl: string;
  mobileVideoUrl: string;
  ctaLabel: string;
  ctaUrl: string;
};

type UploadTarget =
  "desktopImageUrl" | "mobileImageUrl" | "desktopVideoUrl" | "mobileVideoUrl";

type HeroProblems = Partial<Record<keyof HeroDraft, string>>;

function heroProblems(draft: HeroDraft): HeroProblems {
  const problems: HeroProblems = {};
  const label = draft.ctaLabel.trim();
  const url = draft.ctaUrl.trim();
  const isVideo = draft.media === "video";

  if (isVideo && draft.enabled && !draft.desktopVideoUrl) {
    problems.desktopVideoUrl =
      "Add a desktop video before turning the hero on, or choose Photo.";
  }

  if (isVideo && draft.mobileVideoUrl && !draft.desktopVideoUrl) {
    problems.desktopVideoUrl =
      "Add a desktop video first. The mobile video only replaces it on phones.";
  }

  if (url && !isLinkDestination(url)) {
    problems.ctaUrl =
      'Use a page on the store starting with "/", like /new-arrivals, or a full https:// address.';
  }

  if (label && !url) {
    problems.ctaUrl = "Add where the button goes, or clear its label.";
  }

  if (url && !label) {
    problems.ctaLabel = "Add the button's label, or clear its destination.";
  }

  if (draft.enabled && !draft.title.trim()) {
    problems.title = "Add a headline before turning the hero on.";
  }

  if (draft.enabled && !draft.desktopImageUrl) {
    problems.desktopImageUrl = isVideo
      ? "Add a desktop poster image before turning the hero on. It shows while the video loads or can't play."
      : "Add a desktop image before turning the hero on.";
  }

  return problems;
}

const HomepageSection = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () =>
      sdk.client.fetch<{ settings: StorefrontSettings }>(
        "/admin/storefront-settings",
      ),
  });

  const settings = data?.settings;

  const { can } = usePermissions();
  const collections = useQuery({
    queryKey: COLLECTION_OPTIONS_QUERY_KEY,
    queryFn: async (): Promise<CollectionOption[]> => {
      const { collections } = await sdk.admin.productCollection.list({
        limit: 200,
        fields: "id,title",
        order: "title",
      });
      return collections.map(({ id, title }) => ({ id, title }));
    },
    enabled: Boolean(settings),
  });

  const hero = settings?.homepage_hero ?? {};
  const featuredId = settings?.featured_collection_id ?? null;
  const featured = collections.data?.find(({ id }) => id === featuredId);

  const getFeaturedLabel = () => {
    if (!featuredId) return null;

    if (featured) return featured.title;

    if (collections.isLoading) return "Loading...";

    return "A deleted collection. The website shows none; choose another.";
  };

  const canEditSettings = can("storefront_settings", "update");
  const featuredLabel = getFeaturedLabel();

  return (
    <Section
      title="Homepage"
      description="The content of the website's home page: the large banner at the top and one featured collection. The page's layout is set by the website itself."
      badge="Marketing & Store Manager"
      canEdit={Boolean(settings) && canEditSettings}
      onEdit={() => setOpen(true)}
      isLoading={isLoading}
      error={error ? "You don't have access to these settings." : null}
    >
      {settings && (
        <>
          <div className="grid grid-cols-2 items-center gap-x-4 px-6 py-4">
            <Text size="small" leading="compact" weight="plus">
              Hero banner
            </Text>
            <div>
              <Badge size="2xsmall" color={hero.enabled ? "green" : "grey"}>
                {hero.enabled ? "Showing" : "Hidden"}
              </Badge>
            </div>
          </div>
          <Row label="Eyebrow" value={hero.eyebrow ?? null} />
          <Row label="Headline" value={hero.title ?? null} />
          <Row label="Description" value={hero.description ?? null} />
          <Row
            label="Media"
            value={hero.desktop_video_url ? "Video" : "Photo"}
          />
          {hero.desktop_video_url && (
            <>
              <VideoRow label="Desktop video" url={hero.desktop_video_url} />
              <VideoRow
                label="Mobile video"
                url={hero.mobile_video_url ?? null}
              />
            </>
          )}
          <ImageRow
            label={
              hero.desktop_video_url ? "Desktop poster image" : "Desktop image"
            }
            url={hero.desktop_image_url ?? null}
            alt="Desktop hero image"
          />
          <ImageRow
            label={
              hero.desktop_video_url ? "Mobile poster image" : "Mobile image"
            }
            url={hero.mobile_image_url ?? null}
            alt="Mobile hero image"
          />
          <Row
            label="Button"
            value={
              hero.cta_label && hero.cta_url
                ? `${hero.cta_label} → ${hero.cta_url}`
                : null
            }
          />
          <Row
            label="Featured collection"
            value={featuredLabel}
            hint="Shown with the collection's own description and images."
          />
          <HeroHistory onRestored={onHeroChanged} />
          <EditHomepageDrawer
            settings={settings}
            collections={collections.data ?? []}
            collectionsLoading={collections.isLoading}
            open={open}
            onOpenChange={setOpen}
            onSaved={onHeroChanged}
          />
        </>
      )}
    </Section>
  );

  function onHeroChanged(updated: StorefrontSettings) {
    queryClient.setQueryData<{ settings: StorefrontSettings }>(
      SETTINGS_QUERY_KEY,
      { settings: updated },
    );
    // A save or restore that changed the hero added the old one to history.
    void queryClient.invalidateQueries({ queryKey: HERO_HISTORY_QUERY_KEY });
  }
};

function describeReplacement(revision: HeroRevision): string {
  const when = new Date(revision.replaced_at).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const who = revision.replaced_by
    ? (revision.replaced_by.name ??
      revision.replaced_by.email ??
      "a former staff member")
    : null;

  return who ? `Replaced ${when} by ${who}` : `Replaced ${when}`;
}

/**
 * The last few heroes that saves replaced, each restorable. Restoring saves
 * it as the current hero, so the one it replaces appears here in turn.
 */
const HeroHistory = ({
  onRestored,
}: {
  onRestored: (settings: StorefrontSettings) => void;
}) => {
  const prompt = usePrompt();

  const { data, isLoading, isError } = useQuery({
    queryKey: HERO_HISTORY_QUERY_KEY,
    queryFn: () =>
      sdk.client.fetch<{ revisions: HeroRevision[] }>(
        "/admin/storefront-settings/hero-history",
      ),
  });

  const restore = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch<{ settings: StorefrontSettings }>(
        `/admin/storefront-settings/hero-history/${id}/restore`,
        { method: "POST" },
      ),
    onSuccess: ({ settings }) => {
      toast.success("Previous banner restored.");
      onRestored(settings);
    },
    onError: (err: Error & { status?: number }) =>
      saveError(err, "Marketing, the Store Manager and the store owner"),
  });

  const { can } = usePermissions();
  const canRestore = can("storefront_settings", "update");
  const revisions = data?.revisions ?? [];

  const onRestore = async (revision: HeroRevision) => {
    const confirmed = await prompt({
      title: "Restore this banner?",
      description: `"${revision.hero.title ?? "Untitled banner"}" replaces the current banner on the website, ${revision.hero.enabled ? "shown" : "hidden"} as it was. The current banner is kept here, so you can switch back.`,
      confirmText: "Restore",
      cancelText: "Cancel",
    });

    if (confirmed) {
      restore.mutate(revision.id);
    }
  };

  return (
    <div className="flex flex-col gap-y-3 px-6 py-4">
      <div className="flex flex-col gap-y-1">
        <Text size="small" leading="compact" weight="plus">
          Previous banners
        </Text>
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          Each save that changes the banner keeps the one it replaced. The last
          10 are kept.
        </Text>
      </div>
      <RenderFromQuery
        isLoading={isLoading}
        isError={isError}
        isEmpty={!revisions.length}
        loading={<Spinner className="text-ui-fg-subtle animate-spin" />}
        error={
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            Previous banners couldn't be loaded.
          </Text>
        }
        empty={
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            None yet.
          </Text>
        }
      >
        <ul className="border-ui-border-base flex flex-col divide-y rounded-lg border">
          {revisions.map((revision) => (
            <li
              key={revision.id}
              className="flex items-center gap-x-3 px-3 py-2"
            >
              {revision.hero.desktop_image_url ? (
                <img
                  src={revision.hero.desktop_image_url}
                  alt=""
                  className="h-10 w-16 shrink-0 rounded object-cover"
                />
              ) : (
                <div className="bg-ui-bg-subtle h-10 w-16 shrink-0 rounded" />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-y-1">
                <div className="flex items-center gap-x-2">
                  <Text
                    size="small"
                    leading="compact"
                    weight="plus"
                    className="truncate"
                  >
                    {revision.hero.title ?? "Untitled banner"}
                  </Text>
                  {revision.hero.desktop_video_url && (
                    <Badge size="2xsmall" color="blue">
                      Video
                    </Badge>
                  )}
                  {!revision.hero.enabled && (
                    <Badge size="2xsmall" color="grey">
                      Hidden
                    </Badge>
                  )}
                </div>
                <Text
                  size="small"
                  leading="compact"
                  className="text-ui-fg-subtle truncate"
                >
                  {describeReplacement(revision)}
                </Text>
              </div>
              {canRestore && (
                <Button
                  size="small"
                  variant="secondary"
                  disabled={restore.isPending}
                  isLoading={
                    restore.isPending && restore.variables === revision.id
                  }
                  onClick={() => void onRestore(revision)}
                >
                  Restore
                </Button>
              )}
            </li>
          ))}
        </ul>
      </RenderFromQuery>
    </div>
  );
};

function draftFrom(hero: Partial<HomepageHero>): HeroDraft {
  return {
    enabled: hero.enabled === true,
    eyebrow: hero.eyebrow ?? "",
    title: hero.title ?? "",
    description: hero.description ?? "",
    media: hero.desktop_video_url ? "video" : "photo",
    desktopImageUrl: hero.desktop_image_url ?? "",
    mobileImageUrl: hero.mobile_image_url ?? "",
    desktopVideoUrl: hero.desktop_video_url ?? "",
    mobileVideoUrl: hero.mobile_video_url ?? "",
    ctaLabel: hero.cta_label ?? "",
    ctaUrl: hero.cta_url ?? "",
  };
}

const EditHomepageDrawer = ({
  settings,
  collections,
  collectionsLoading,
  open,
  onOpenChange,
  onSaved,
}: {
  settings: StorefrontSettings;
  collections: CollectionOption[];
  collectionsLoading: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (settings: StorefrontSettings) => void;
}) => {
  const [draft, setDraft] = useState<HeroDraft>(() =>
    draftFrom(settings.homepage_hero),
  );
  const [collectionId, setCollectionId] = useState(NO_COLLECTION);
  const [showProblems, setShowProblems] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(draftFrom(settings.homepage_hero));
      setCollectionId(settings.featured_collection_id ?? NO_COLLECTION);
      setShowProblems(false);
    }
  }, [open, settings]);

  const set = <K extends keyof HeroDraft>(key: K, value: HeroDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const problems = showProblems ? heroProblems(draft) : {};

  const upload = useMutation({
    mutationFn: async ({
      file,
      target,
    }: {
      file: File;
      target: UploadTarget;
    }) => {
      const isVideoTarget =
        target === "desktopVideoUrl" || target === "mobileVideoUrl";

      if (isVideoTarget && file.size > MAX_VIDEO_MB * 1024 * 1024) {
        throw new Error(
          `the video is ${Math.ceil(file.size / 1024 / 1024)} MB. Export a shorter or more compressed MP4 under ${MAX_VIDEO_MB} MB.`,
        );
      }

      return uploadImage(file);
    },
    onSuccess: (url, { target }) => set(target, url),
    onError: (error: Error) => toast.error(`Upload failed: ${error.message}`),
  });

  const uploadingTo = (target: UploadTarget) =>
    upload.isPending && upload.variables?.target === target;

  const isVideo = draft.media === "video";

  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ settings: StorefrontSettings }>(
        "/admin/storefront-settings",
        {
          method: "POST",
          body: {
            homepage_hero: {
              enabled: draft.enabled,
              eyebrow: draft.eyebrow.trim() || null,
              title: draft.title.trim() || null,
              description: draft.description.trim() || null,
              desktop_image_url: draft.desktopImageUrl || null,
              mobile_image_url: draft.mobileImageUrl || null,
              // Choosing Photo removes the videos; the hero is a video
              // exactly when a desktop video is stored.
              desktop_video_url: isVideo ? draft.desktopVideoUrl || null : null,
              mobile_video_url: isVideo ? draft.mobileVideoUrl || null : null,
              cta_label: draft.ctaLabel.trim() || null,
              cta_url: draft.ctaUrl.trim() || null,
            },
            featured_collection_id:
              collectionId === NO_COLLECTION ? null : collectionId,
          },
        },
      ),
    onSuccess: ({ settings: updated }) => {
      toast.success("Homepage settings updated.");
      onSaved(updated);
      onOpenChange(false);
    },
    onError: (error: Error & { status?: number }) =>
      saveError(error, "Marketing, the Store Manager and the store owner"),
  });

  const onSave = () => {
    if (Object.keys(heroProblems(draft)).length) {
      setShowProblems(true);
      return;
    }

    save.mutate();
  };

  const busy = save.isPending || upload.isPending;
  // A collection that was deleted after being featured has no option; list it
  // so the Select still shows something and staff can see why to change it.
  const featuredMissing =
    collectionId !== NO_COLLECTION &&
    !collectionsLoading &&
    !collections.some(({ id }) => id === collectionId);

  return (
    <EditDrawer
      title="Edit homepage"
      open={open}
      onOpenChange={onOpenChange}
      busy={busy}
      saving={save.isPending}
      canSave
      onSave={onSave}
    >
      <div className="border-ui-border-base flex items-start justify-between gap-x-4 rounded-lg border px-4 py-3">
        <div className="flex flex-col gap-y-1">
          <Label htmlFor="hero-enabled" size="small" weight="plus">
            Show the hero banner
          </Label>
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            While off, the home page starts with its next section. Anything
            filled in below is kept, so you can prepare a banner before showing
            it.
          </Text>
        </div>
        <Switch
          id="hero-enabled"
          checked={draft.enabled}
          onCheckedChange={(checked) => set("enabled", checked)}
        />
      </div>
      <Field
        id="hero-eyebrow"
        label="Eyebrow (optional)"
        hint="A short line above the headline, like NEW SEASON."
      >
        <Input
          id="hero-eyebrow"
          value={draft.eyebrow}
          maxLength={40}
          placeholder="NEW SEASON"
          onChange={(event) => set("eyebrow", event.target.value)}
        />
      </Field>
      <Field
        id="hero-title"
        label="Headline"
        hint={problems.title ?? "Required to show the banner. Keep it short."}
        error={Boolean(problems.title)}
      >
        <Input
          id="hero-title"
          value={draft.title}
          maxLength={120}
          placeholder="Designed to be remembered."
          aria-invalid={Boolean(problems.title)}
          onChange={(event) => set("title", event.target.value)}
        />
      </Field>
      <Field
        id="hero-description"
        label="Description (optional)"
        hint={`${draft.description.length}/300. A sentence or two under the headline.`}
      >
        <Textarea
          id="hero-description"
          rows={3}
          value={draft.description}
          maxLength={300}
          onChange={(event) => set("description", event.target.value)}
        />
      </Field>
      <div className="flex flex-col gap-y-2">
        <Label size="small" weight="plus">
          Banner media
        </Label>
        <RadioGroup
          value={draft.media}
          onValueChange={(value) => set("media", value as HeroMedia)}
          className="flex gap-x-6"
        >
          <div className="flex items-center gap-x-2">
            <RadioGroup.Item value="photo" id="hero-media-photo" />
            <Label htmlFor="hero-media-photo" size="small">
              Photo
            </Label>
          </div>
          <div className="flex items-center gap-x-2">
            <RadioGroup.Item value="video" id="hero-media-video" />
            <Label htmlFor="hero-media-video" size="small">
              Video
            </Label>
          </div>
        </RadioGroup>
        {isVideo && (
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            A short silent loop. The photos below are still needed: they show
            while the video loads, on phones that block autoplay, and for
            visitors who turn off motion. Saving with Photo chosen removes the
            videos.
          </Text>
        )}
      </div>
      {isVideo && (
        <>
          <VideoField
            label="Desktop video"
            hint={`Required for a video banner. Landscape MP4 (H.264), under ${MAX_VIDEO_MB} MB, around 10 to 20 seconds. Plays without sound.`}
            error={problems.desktopVideoUrl}
            url={draft.desktopVideoUrl}
            busy={busy}
            uploading={uploadingTo("desktopVideoUrl")}
            onUpload={(file) =>
              upload.mutate({ file, target: "desktopVideoUrl" })
            }
            onRemove={() => set("desktopVideoUrl", "")}
          />
          <VideoField
            label="Mobile video (optional)"
            hint={`Portrait MP4, under ${MAX_VIDEO_MB} MB. Phones show the desktop video, cropped, when this is empty.`}
            url={draft.mobileVideoUrl}
            busy={busy}
            uploading={uploadingTo("mobileVideoUrl")}
            onUpload={(file) =>
              upload.mutate({ file, target: "mobileVideoUrl" })
            }
            onRemove={() => set("mobileVideoUrl", "")}
          />
        </>
      )}
      <ImageField
        label={isVideo ? "Desktop poster image" : "Desktop image"}
        hint={
          isVideo
            ? "Required to show the banner. Use a still from the video's first frame, landscape, at least 2400 x 1200px."
            : "Required to show the banner. Landscape, at least 2400 x 1200px, with the subject away from where the headline sits."
        }
        error={problems.desktopImageUrl}
        url={draft.desktopImageUrl}
        busy={busy}
        uploading={uploadingTo("desktopImageUrl")}
        accept="image/png,image/jpeg,image/webp"
        onUpload={(file) => upload.mutate({ file, target: "desktopImageUrl" })}
        onRemove={() => set("desktopImageUrl", "")}
      />
      <ImageField
        label={
          isVideo ? "Mobile poster image (optional)" : "Mobile image (optional)"
        }
        hint={
          isVideo
            ? "A still from the mobile video, portrait, at least 1080 x 1350px. Phones use the desktop poster, cropped, when this is empty."
            : "Portrait, at least 1080 x 1350px. Phones use the desktop image, cropped, when this is empty."
        }
        url={draft.mobileImageUrl}
        busy={busy}
        uploading={uploadingTo("mobileImageUrl")}
        accept="image/png,image/jpeg,image/webp"
        onUpload={(file) => upload.mutate({ file, target: "mobileImageUrl" })}
        onRemove={() => set("mobileImageUrl", "")}
      />
      <Field
        id="hero-cta-label"
        label="Button label (optional)"
        hint={
          problems.ctaLabel ?? "Leave both button fields empty for no button."
        }
        error={Boolean(problems.ctaLabel)}
      >
        <Input
          id="hero-cta-label"
          value={draft.ctaLabel}
          maxLength={40}
          placeholder="Shop New Arrivals"
          aria-invalid={Boolean(problems.ctaLabel)}
          onChange={(event) => set("ctaLabel", event.target.value)}
        />
      </Field>
      <Field
        id="hero-cta-url"
        label="Button destination"
        hint={
          problems.ctaUrl ??
          'A page on the store, starting with "/" (like /new-arrivals), or a full https:// address.'
        }
        error={Boolean(problems.ctaUrl)}
      >
        <Input
          id="hero-cta-url"
          value={draft.ctaUrl}
          maxLength={2048}
          placeholder="/new-arrivals"
          aria-invalid={Boolean(problems.ctaUrl)}
          onChange={(event) => set("ctaUrl", event.target.value)}
        />
      </Field>
      <Field
        id="homepage-featured-collection"
        label="Featured collection"
        hint="Shown on the home page with the collection's own description and images, set on the collection's page under Products › Collections."
      >
        <Select
          value={collectionId}
          onValueChange={setCollectionId}
          disabled={collectionsLoading}
        >
          <Select.Trigger id="homepage-featured-collection">
            <Select.Value
              placeholder={collectionsLoading ? "Loading collections…" : "None"}
            />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value={NO_COLLECTION}>None</Select.Item>
            {featuredMissing && (
              <Select.Item value={collectionId}>Deleted collection</Select.Item>
            )}
            {collections.map(({ id, title }) => (
              <Select.Item key={id} value={id}>
                {title}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </Field>
    </EditDrawer>
  );
};

// Navigation ----------------------------------------------------------------

const NO_PROMO_TARGET = "none";

const NavigationSection = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { can } = usePermissions();
  const { data, isLoading, error } = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () =>
      sdk.client.fetch<{ settings: StorefrontSettings }>(
        "/admin/storefront-settings",
      ),
  });
  const settings = data?.settings;

  return (
    <Section
      title="Navigation"
      description="The optional visual cards in the Store menu. Choose a live catalogue destination instead of entering a URL, so storefront links stay valid when handles change. These are merchandising cards, not discounts."
      badge="Marketing & Store Manager"
      canEdit={Boolean(settings) && can("storefront_settings", "update")}
      onEdit={() => setOpen(true)}
      isLoading={isLoading}
      error={error ? "You don't have access to these settings." : null}
    >
      {settings && (
        <>
          <Row
            label="Store menu cards"
            value={
              settings.store_menu_cards.length
                ? settings.store_menu_cards
                    .map((promo) => `${promo.target_type}: ${promo.target_id}`)
                    .join(", ")
                : null
            }
            hint="Up to two cards, shown on large screens."
          />
          <EditNavigationDrawer
            settings={settings}
            open={open}
            onOpenChange={setOpen}
            onSaved={(updated) =>
              queryClient.setQueryData<{ settings: StorefrontSettings }>(
                SETTINGS_QUERY_KEY,
                { settings: updated },
              )
            }
          />
        </>
      )}
    </Section>
  );
};

const EditNavigationDrawer = ({
  settings,
  open,
  onOpenChange,
  onSaved,
}: {
  settings: StorefrontSettings;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (settings: StorefrontSettings) => void;
}) => {
  const [promos, setPromos] = useState<StoreMenuPromo[]>([]);
  const options = useQuery({
    queryKey: PROMO_OPTIONS_QUERY_KEY,
    queryFn: async (): Promise<PromoOption[]> => {
      const [collections, categories, products] = await Promise.all([
        sdk.admin.productCollection.list({
          limit: 200,
          fields: "id,title",
          order: "title",
        }),
        sdk.admin.productCategory.list({
          limit: 200,
          fields: "id,name",
          order: "name",
        }),
        sdk.admin.product.list({
          limit: 200,
          fields: "id,title",
          order: "title",
        }),
      ]);

      return [
        ...collections.collections.map(({ id, title }) => ({
          id,
          title,
          type: "collection" as const,
        })),
        ...categories.product_categories.map(({ id, name }) => ({
          id,
          title: name,
          type: "category" as const,
        })),
        ...products.products.map(({ id, title }) => ({
          id,
          title,
          type: "product" as const,
        })),
      ];
    },
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setPromos(settings.store_menu_cards);
    }
  }, [open, settings]);

  const upload = useMutation({
    mutationFn: ({ file }: { file: File; index: number; mobile: boolean }) =>
      uploadImage(file),
    onSuccess: (url, { index, mobile }) =>
      setPromos((current) =>
        current.map((promo, currentIndex) =>
          currentIndex === index
            ? {
                ...promo,
                ...(mobile ? { mobile_image_url: url } : { image_url: url }),
              }
            : promo,
        ),
      ),
    onError: (error: Error) => toast.error(`Upload failed: ${error.message}`),
  });

  const updatePromo = (index: number, changes: Partial<StoreMenuPromo>) =>
    setPromos((current) =>
      current.map((promo, currentIndex) =>
        currentIndex === index ? { ...promo, ...changes } : promo,
      ),
    );

  const valid = promos.every((promo) =>
    Boolean(promo.target_id && promo.image_url),
  );
  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ settings: StorefrontSettings }>(
        "/admin/storefront-settings",
        { method: "POST", body: { store_menu_cards: promos } },
      ),
    onSuccess: ({ settings: updated }) => {
      toast.success("Store menu cards updated.");
      onSaved(updated);
      onOpenChange(false);
    },
    onError: (error: Error & { status?: number }) =>
      saveError(error, "Marketing, the Store Manager and the store owner"),
  });

  const busy = save.isPending || upload.isPending;
  const choices = options.data ?? [];

  return (
    <EditDrawer
      title="Edit Store menu cards"
      open={open}
      onOpenChange={onOpenChange}
      busy={busy}
      saving={save.isPending}
      canSave={valid}
      onSave={() => save.mutate()}
    >
      <Text size="small" leading="compact" className="text-ui-fg-subtle">
        Pick a catalogue item for each card. The storefront derives its URL from
        that item's current handle, and ignores it if the item is later deleted.
      </Text>
      {promos.map((promo, index) => {
        const targetOptions = choices.filter(
          (option) => option.type === promo.target_type,
        );
        const targetMissing =
          Boolean(promo.target_id) &&
          !options.isLoading &&
          !targetOptions.some((option) => option.id === promo.target_id);

        return (
          <div
            key={`${promo.target_type}-${promo.target_id}-${index}`}
            className="border-ui-border-base flex flex-col gap-y-4 rounded-lg border p-4"
          >
            <div className="flex items-center justify-between gap-x-4">
              <Heading level="h3">Card {index + 1}</Heading>
              <Button
                size="small"
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  setPromos((current) =>
                    current.filter((_, currentIndex) => currentIndex !== index),
                  )
                }
              >
                Remove
              </Button>
            </div>
            <Field id={`promo-type-${index}`} label="Destination type">
              <Select
                value={promo.target_type}
                onValueChange={(value) =>
                  updatePromo(index, {
                    target_type: value as StoreMenuPromoTargetType,
                    target_id: "",
                  })
                }
              >
                <Select.Trigger id={`promo-type-${index}`}>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="collection">Collection</Select.Item>
                  <Select.Item value="category">Category</Select.Item>
                  <Select.Item value="product">Product</Select.Item>
                </Select.Content>
              </Select>
            </Field>
            <Field
              id={`promo-target-${index}`}
              label="Destination"
              hint="Only existing catalogue items can be selected."
            >
              <Select
                value={promo.target_id || NO_PROMO_TARGET}
                disabled={options.isLoading}
                onValueChange={(value) =>
                  updatePromo(index, {
                    target_id: value === NO_PROMO_TARGET ? "" : value,
                  })
                }
              >
                <Select.Trigger id={`promo-target-${index}`}>
                  <Select.Value
                    placeholder={options.isLoading ? "Loading…" : "Choose one"}
                  />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value={NO_PROMO_TARGET}>Choose one</Select.Item>
                  {targetMissing && (
                    <Select.Item value={promo.target_id}>
                      Deleted destination
                    </Select.Item>
                  )}
                  {targetOptions.map((option) => (
                    <Select.Item key={option.id} value={option.id}>
                      {option.title}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </Field>
            <ImageField
              label="Desktop image"
              hint="Required. Portrait image, at least 704 × 880px."
              url={promo.image_url}
              busy={busy}
              uploading={
                upload.isPending &&
                upload.variables?.index === index &&
                !upload.variables.mobile
              }
              accept="image/png,image/jpeg,image/webp"
              onUpload={(file) => upload.mutate({ file, index, mobile: false })}
              onRemove={() => updatePromo(index, { image_url: "" })}
            />
            <ImageField
              label="Mobile image (optional)"
              hint="Portrait image for smaller screens. The desktop image is used when empty."
              url={promo.mobile_image_url ?? ""}
              busy={busy}
              uploading={
                upload.isPending &&
                upload.variables?.index === index &&
                upload.variables.mobile
              }
              accept="image/png,image/jpeg,image/webp"
              onUpload={(file) => upload.mutate({ file, index, mobile: true })}
              onRemove={() => updatePromo(index, { mobile_image_url: null })}
            />
          </div>
        );
      })}
      {promos.length < 2 && (
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() =>
            setPromos((current) => [
              ...current,
              {
                target_type: "collection",
                target_id: "",
                image_url: "",
                mobile_image_url: null,
              },
            ])
          }
        >
          Add card
        </Button>
      )}
    </EditDrawer>
  );
};

// Sharing & search ----------------------------------------------------------

const SharingSection = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () =>
      sdk.client.fetch<{ settings: StorefrontSettings }>(
        "/admin/storefront-settings",
      ),
  });

  const settings = data?.settings;
  const { can } = usePermissions();
  const canEditSettings = can("storefront_settings", "update");
  const links = settings
    ? SOCIAL_NETWORKS.filter(({ key }) => settings.social_links?.[key])
    : [];

  return (
    <Section
      title="Sharing & search"
      description="How the store appears in search results and when a link is shared on WhatsApp, Instagram or X. Pages without their own details use these."
      badge="Marketing"
      canEdit={Boolean(settings) && canEditSettings}
      onEdit={() => setOpen(true)}
      isLoading={isLoading}
      error={error ? "You don't have access to these settings." : null}
    >
      {settings && (
        <>
          {!settings.allow_indexing && (
            <div className="px-6 py-4">
              <Badge color="orange" size="small">
                Hidden from search engines
              </Badge>
            </div>
          )}
          <Row label="Home page title" value={settings.seo_title} />
          <Row label="Description" value={settings.seo_description} />
          <ImageRow
            label="Share image"
            url={settings.og_image_url}
            alt="Share image"
          />
          <Row label="X username" value={settings.twitter_handle} />
          <Row
            label="Social profiles"
            value={links.map(({ label }) => label).join(", ") || null}
          />
          <Row
            label="Google Search Console"
            value={
              settings.google_site_verification ? "Verified tag added" : null
            }
          />
          <EditSharingDrawer
            settings={settings}
            open={open}
            onOpenChange={setOpen}
            onSaved={(updated) =>
              queryClient.setQueryData<{ settings: StorefrontSettings }>(
                SETTINGS_QUERY_KEY,
                { settings: updated },
              )
            }
          />
        </>
      )}
    </Section>
  );
};

/** Accepts the whole `<meta name="google-site-verification" ...>` tag too. */
function verificationCode(value: string): string {
  const fromTag = new RegExp(/content=["']([^"']+)["']/i).exec(value);
  return (fromTag?.[1] ?? value).trim();
}

const EditSharingDrawer = ({
  settings,
  open,
  onOpenChange,
  onSaved,
}: {
  settings: StorefrontSettings;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (settings: StorefrontSettings) => void;
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ogImageUrl, setOgImageUrl] = useState("");
  const [twitterHandle, setTwitterHandle] = useState("");
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const [allowIndexing, setAllowIndexing] = useState(true);
  const [verification, setVerification] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(settings.seo_title ?? "");
      setDescription(settings.seo_description ?? "");
      setOgImageUrl(settings.og_image_url ?? "");
      setTwitterHandle(settings.twitter_handle ?? "");
      setSocialLinks(
        Object.fromEntries(
          SOCIAL_NETWORKS.map(({ key }) => [
            key,
            settings.social_links?.[key] ?? "",
          ]),
        ),
      );
      setAllowIndexing(settings.allow_indexing);
      setVerification(settings.google_site_verification ?? "");
    }
  }, [open, settings]);

  const upload = useMutation({
    mutationFn: uploadImage,
    onSuccess: setOgImageUrl,
    onError: (error: Error) => toast.error(`Upload failed: ${error.message}`),
  });

  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ settings: StorefrontSettings }>(
        "/admin/storefront-settings",
        {
          method: "POST",
          body: {
            seo_title: title.trim() || null,
            seo_description: description.trim() || null,
            og_image_url: ogImageUrl || null,
            twitter_handle: twitterHandle.trim() || null,
            social_links: Object.fromEntries(
              SOCIAL_NETWORKS.map(({ key }) => [
                key,
                socialLinks[key]?.trim() || null,
              ]),
            ),
            allow_indexing: allowIndexing,
            google_site_verification: verificationCode(verification) || null,
          },
        },
      ),
    onSuccess: ({ settings: updated }) => {
      toast.success("Sharing & search settings updated.");
      onSaved(updated);
      onOpenChange(false);
    },
    onError: (error: Error & { status?: number }) =>
      saveError(error, "Marketing and the store owner"),
  });

  const busy = save.isPending || upload.isPending;

  return (
    <EditDrawer
      title="Edit sharing & search"
      open={open}
      onOpenChange={onOpenChange}
      busy={busy}
      saving={save.isPending}
      canSave
      onSave={() => save.mutate()}
    >
      <Field
        id="seo-title"
        label="Home page title"
        hint={`${title.length}/${TITLE_LIMIT}. Search results cut titles off at about ${TITLE_LIMIT} characters. Leave empty to use the store name. Other pages show "Page name | Store name".`}
      >
        <Input
          id="seo-title"
          value={title}
          maxLength={70}
          placeholder="Youjaymharah | Womenswear made in Lagos"
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>
      <Field
        id="seo-description"
        label="Description"
        hint={`${description.length}/${DESCRIPTION_LIMIT}. Shown under the title in search results and in link previews.`}
      >
        <Textarea
          id="seo-description"
          rows={3}
          value={description}
          maxLength={200}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      <ImageField
        label="Share image"
        hint="Shown when a link to the store is shared. 1200 x 630px, with anything important away from the edges. Product pages use the product photo instead."
        url={ogImageUrl}
        busy={busy}
        uploading={upload.isPending}
        accept="image/png,image/jpeg,image/webp"
        onUpload={(file) => upload.mutate(file)}
        onRemove={() => setOgImageUrl("")}
      />
      <Field
        id="seo-twitter"
        label="X username"
        hint="Credits the store on link previews in X."
      >
        <Input
          id="seo-twitter"
          value={twitterHandle}
          placeholder="@youjaymharah"
          onChange={(event) => setTwitterHandle(event.target.value)}
        />
      </Field>
      <div className="flex flex-col gap-y-2">
        <Label size="small" weight="plus">
          Social profiles
        </Label>
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          Full profile addresses. They tell search engines these accounts belong
          to the store, and the website can link to them.
        </Text>
        {SOCIAL_NETWORKS.map(({ key, label }) => (
          <div
            key={key}
            className="grid grid-cols-[96px_1fr] items-center gap-x-3"
          >
            <Label htmlFor={`social-${key}`} size="small">
              {label}
            </Label>
            <Input
              id={`social-${key}`}
              type="url"
              value={socialLinks[key] ?? ""}
              placeholder={`https://${key === "x" ? "x" : key}.com/youjaymharah`}
              onChange={(event) =>
                setSocialLinks((current) => ({
                  ...current,
                  [key]: event.target.value,
                }))
              }
            />
          </div>
        ))}
      </div>
      <Field
        id="seo-verification"
        label="Google Search Console verification"
        hint='In Search Console, choose the "HTML tag" method and paste the tag or just its code.'
      >
        <Input
          id="seo-verification"
          value={verification}
          onChange={(event) => setVerification(event.target.value)}
        />
      </Field>
      <div className="border-ui-border-base flex items-start justify-between gap-x-4 rounded-lg border px-4 py-3">
        <div className="flex flex-col gap-y-1">
          <Label htmlFor="seo-indexing" size="small" weight="plus">
            Show the store in search engines
          </Label>
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            Turn off only before launch or on a test copy of the store. While
            off, Google and others are asked not to list any page.
          </Text>
        </div>
        <Switch
          id="seo-indexing"
          checked={allowIndexing}
          onCheckedChange={setAllowIndexing}
        />
      </div>
    </EditDrawer>
  );
};

// Products ------------------------------------------------------------------

const ProductsSection = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () =>
      sdk.client.fetch<{ settings: StorefrontSettings }>(
        "/admin/storefront-settings",
      ),
  });

  const settings = data?.settings;
  const { can } = usePermissions();
  const canEditSettings = can("storefront_settings", "update");

  return (
    <Section
      title="Products"
      description="How products are presented on the website."
      badge="Marketing & Store Manager"
      canEdit={Boolean(settings) && canEditSettings}
      onEdit={() => setOpen(true)}
      isLoading={isLoading}
      error={error ? "You don't have access to these settings." : null}
    >
      {settings && (
        <>
          <Row
            label="New badge"
            value={`${settings.new_badge_days} ${settings.new_badge_days === 1 ? "day" : "days"}`}
            hint="Counted from launch for coming-soon products, otherwise from when the product was created."
          />
          <EditProductsDrawer
            settings={settings}
            open={open}
            onOpenChange={setOpen}
            onSaved={(updated) =>
              queryClient.setQueryData<{ settings: StorefrontSettings }>(
                SETTINGS_QUERY_KEY,
                { settings: updated },
              )
            }
          />
        </>
      )}
    </Section>
  );
};

const EditProductsDrawer = ({
  settings,
  open,
  onOpenChange,
  onSaved,
}: {
  settings: StorefrontSettings;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (settings: StorefrontSettings) => void;
}) => {
  const [days, setDays] = useState(String(settings.new_badge_days));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDays(String(settings.new_badge_days));
      setError(null);
    }
  }, [open, settings]);

  const save = useMutation({
    mutationFn: (newBadgeDays: number) =>
      sdk.client.fetch<{ settings: StorefrontSettings }>(
        "/admin/storefront-settings",
        { method: "POST", body: { new_badge_days: newBadgeDays } },
      ),
    onSuccess: ({ settings: updated }) => {
      toast.success("Product settings updated.");
      onSaved(updated);
      onOpenChange(false);
    },
    onError: (err: Error & { status?: number }) =>
      saveError(err, "Marketing, the Store Manager and the store owner"),
  });

  const onSave = () => {
    const value = Number(days);

    if (!Number.isInteger(value) || value < 1 || value > 365) {
      setError("Enter a whole number of days from 1 to 365.");
      return;
    }

    save.mutate(value);
  };

  return (
    <EditDrawer
      title="Edit product settings"
      open={open}
      onOpenChange={onOpenChange}
      busy={save.isPending}
      saving={save.isPending}
      canSave
      onSave={onSave}
    >
      <Field
        id="storefront-new-badge-days"
        label="Show the New badge for"
        hint={
          error ??
          "Days, from 1 to 365. The website picks up a change within a few minutes."
        }
        error={Boolean(error)}
      >
        <div className="flex items-center gap-x-2">
          <Input
            id="storefront-new-badge-days"
            type="number"
            min={1}
            max={365}
            step={1}
            className="w-28"
            value={days}
            aria-invalid={Boolean(error)}
            onChange={(event) => {
              setDays(event.target.value);
              setError(null);
            }}
          />
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            days
          </Text>
        </div>
      </Field>
    </EditDrawer>
  );
};

// Shared pieces -------------------------------------------------------------

const Section = ({
  title,
  description,
  badge,
  canEdit,
  onEdit,
  isLoading,
  error,
  children,
}: {
  title: string;
  description: string;
  badge: string;
  canEdit: boolean;
  onEdit: () => void;
  isLoading: boolean;
  error: string | null;
  children: ReactNode;
}) => (
  <Container className="divide-y p-0">
    <div className="flex items-start justify-between gap-x-4 px-6 py-4">
      <div className="flex flex-col gap-y-1">
        <div className="flex items-center gap-x-2">
          <Heading level="h2">{title}</Heading>
          <Badge size="2xsmall" color="grey">
            {badge}
          </Badge>
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          {description}
        </Text>
      </div>
      <Button
        size="small"
        variant="secondary"
        disabled={!canEdit}
        onClick={onEdit}
      >
        <PencilSquare />
        Edit
      </Button>
    </div>
    <RenderFromQuery
      isLoading={isLoading}
      isError={!!error}
      loading={
        <div className="flex items-center justify-center px-6 py-8">
          <Spinner className="text-ui-fg-subtle animate-spin" />
        </div>
      }
      error={
        <div className="px-6 py-4">
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            {error}
          </Text>
        </div>
      }
    >
      {children}
    </RenderFromQuery>
  </Container>
);

const Row = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | null;
  hint?: string;
}) => (
  <div className="grid grid-cols-2 items-start gap-x-4 px-6 py-4">
    <div className="flex flex-col gap-y-1">
      <Text size="small" leading="compact" weight="plus">
        {label}
      </Text>
      {hint && (
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          {hint}
        </Text>
      )}
    </div>
    <Text
      size="small"
      leading="compact"
      className="text-ui-fg-subtle wrap-break-word"
    >
      {value || "Not set"}
    </Text>
  </div>
);

const ImageRow = ({
  label,
  url,
  alt,
  square,
}: {
  label: string;
  url: string | null;
  alt: string;
  square?: boolean;
}) => (
  <div className="grid grid-cols-2 items-center gap-x-4 px-6 py-4">
    <Text size="small" leading="compact" weight="plus">
      {label}
    </Text>
    {url ? (
      <img
        src={url}
        alt={alt}
        className={
          square
            ? "h-10 w-10 rounded object-contain"
            : "h-10 w-auto object-contain"
        }
      />
    ) : (
      <Text size="small" leading="compact" className="text-ui-fg-subtle">
        Not set
      </Text>
    )}
  </div>
);

const Field = ({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: boolean;
  children: ReactNode;
}) => (
  <div className="flex flex-col gap-y-2">
    <Label size="small" weight="plus" htmlFor={id}>
      {label}
    </Label>
    {children}
    {hint && (
      <Text
        size="small"
        leading="compact"
        className={error ? "text-ui-fg-error" : "text-ui-fg-subtle"}
      >
        {hint}
      </Text>
    )}
  </div>
);

const ImageField = ({
  label,
  hint,
  error,
  url,
  square,
  busy,
  uploading,
  accept,
  onUpload,
  onRemove,
}: {
  label: string;
  hint: string;
  /** Shown in place of the hint when set. */
  error?: string;
  url: string;
  square?: boolean;
  busy: boolean;
  uploading: boolean;
  accept: string;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-y-2">
      <Label size="small" weight="plus">
        {label}
      </Label>
      {url && (
        <img
          src={url}
          alt={`${label} preview`}
          className={
            square
              ? "h-16 w-16 rounded object-contain"
              : "h-24 w-auto self-start rounded object-contain"
          }
        />
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onUpload(file);
          }
          event.target.value = "";
        }}
      />
      <div className="flex gap-2">
        <Button
          size="small"
          variant="secondary"
          disabled={busy}
          isLoading={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {url ? "Replace image" : "Upload image"}
        </Button>
        {url && (
          <Button
            size="small"
            variant="transparent"
            disabled={busy}
            onClick={onRemove}
          >
            Remove
          </Button>
        )}
      </div>
      <Text
        size="small"
        leading="compact"
        className={error ? "text-ui-fg-error" : "text-ui-fg-subtle"}
      >
        {error ?? hint}
      </Text>
    </div>
  );
};

const VideoRow = ({ label, url }: { label: string; url: string | null }) => (
  <div className="grid grid-cols-2 items-center gap-x-4 px-6 py-4">
    <Text size="small" leading="compact" weight="plus">
      {label}
    </Text>
    {url ? (
      <video
        src={url}
        muted
        loop
        playsInline
        preload="metadata"
        className="h-10 w-auto self-start rounded"
      />
    ) : (
      <Text size="small" leading="compact" className="text-ui-fg-subtle">
        Not set
      </Text>
    )}
  </div>
);

const VideoField = ({
  label,
  hint,
  error,
  url,
  busy,
  uploading,
  onUpload,
  onRemove,
}: {
  label: string;
  hint: string;
  /** Shown in place of the hint when set. */
  error?: string;
  url: string;
  busy: boolean;
  uploading: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-y-2">
      <Label size="small" weight="plus">
        {label}
      </Label>
      {url && (
        <video
          src={url}
          controls
          muted
          playsInline
          preload="metadata"
          className="h-32 w-auto self-start rounded"
        />
      )}
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onUpload(file);
          }
          event.target.value = "";
        }}
      />
      <div className="flex gap-2">
        <Button
          size="small"
          variant="secondary"
          disabled={busy}
          isLoading={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {url ? "Replace video" : "Upload video"}
        </Button>
        {url && (
          <Button
            size="small"
            variant="transparent"
            disabled={busy}
            onClick={onRemove}
          >
            Remove
          </Button>
        )}
      </div>
      <Text
        size="small"
        leading="compact"
        className={error ? "text-ui-fg-error" : "text-ui-fg-subtle"}
      >
        {error ?? hint}
      </Text>
    </div>
  );
};

const EditDrawer = ({
  title,
  open,
  onOpenChange,
  busy,
  saving,
  canSave,
  onSave,
  children,
}: {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
  children: ReactNode;
}) => (
  <Drawer open={open} onOpenChange={onOpenChange}>
    <Drawer.Content>
      <Drawer.Header>
        <Drawer.Title>{title}</Drawer.Title>
      </Drawer.Header>
      <Drawer.Body className="flex flex-col gap-5 overflow-y-auto">
        {children}
      </Drawer.Body>
      <Drawer.Footer>
        <Button
          size="small"
          variant="secondary"
          disabled={busy}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          size="small"
          disabled={busy || !canSave}
          isLoading={saving}
          onClick={onSave}
        >
          Save
        </Button>
      </Drawer.Footer>
    </Drawer.Content>
  </Drawer>
);

export const config = defineRouteConfig({
  label: "Storefront",
  rank: 1,
});

export default StorefrontSettingsPage;
