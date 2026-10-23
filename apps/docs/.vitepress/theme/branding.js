export function publicImageUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function publicBrand(value) {
  if (!value || typeof value !== "object") return null;
  return {
    name: typeof value.name === "string" ? value.name.trim().slice(0, 120) : "",
    logo_url: publicImageUrl(value.logo_url),
    favicon_url: publicImageUrl(value.favicon_url),
  };
}
