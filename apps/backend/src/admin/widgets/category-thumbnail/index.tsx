import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type {
  AdminProductCategory,
  DetailWidgetProps,
} from "@medusajs/framework/types";
import { Button, Container, Heading, Text, toast } from "@medusajs/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { sdk } from "../../lib/sdk";
import { withPermission } from "../../lib/permissions";
import { uploadImage } from "../../lib/upload-image";

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * The picture for a category's tile in the home page's "Shop by wardrobe"
 * section, kept in category metadata (`thumbnail`). Tiles show the direct
 * subcategories of each top-level category; without a picture they use
 * their newest product's photo.
 */
const CategoryThumbnailWidget = ({
  data: category,
}: DetailWidgetProps<AdminProductCategory>) => {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const thumbnail = text(category.metadata?.thumbnail);

  const save = useMutation({
    mutationFn: async (file: File | null) =>
      sdk.admin.productCategory.update(category.id, {
        // The existing metadata goes back with it, so other keys survive
        // whether the update merges or replaces. The storefront treats an
        // empty string as "not set".
        metadata: {
          ...(category.metadata ?? {}),
          thumbnail: file ? await uploadImage(file) : "",
        },
      }),
    onSuccess: (_result, file) => {
      void queryClient.invalidateQueries({ queryKey: ["product_categories"] });
      toast.success(file ? "Picture saved." : "Picture removed.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-y-1 px-6 py-4">
        <Heading level="h2">Home page picture</Heading>
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          Shown on this category's tile under "Shop by wardrobe" when it sits
          directly under a top-level category such as Women. Without one, the
          tile uses its newest product's photo.
        </Text>
      </div>
      <div className="flex flex-col gap-y-3 px-6 py-4">
        {thumbnail && (
          <img
            src={thumbnail}
            alt="Home page picture preview"
            className="aspect-[4/5] w-32 rounded object-cover"
          />
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              save.mutate(file);
            }
            event.target.value = "";
          }}
        />
        <div className="flex gap-2">
          <Button
            size="small"
            variant="secondary"
            disabled={save.isPending}
            isLoading={save.isPending && save.variables !== null}
            onClick={() => inputRef.current?.click()}
          >
            {thumbnail ? "Replace picture" : "Upload picture"}
          </Button>
          {thumbnail && (
            <Button
              size="small"
              variant="transparent"
              disabled={save.isPending}
              onClick={() => save.mutate(null)}
            >
              Remove
            </Button>
          )}
        </div>
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          Portrait (4:5), at least 900 x 1125px.
        </Text>
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "product_category.details.side",
});

export default withPermission(
  CategoryThumbnailWidget,
  "product_category",
  "update",
);
