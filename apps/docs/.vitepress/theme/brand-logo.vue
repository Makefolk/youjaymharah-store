<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import { withBase } from "vitepress";
import { publicBrand } from "./branding.js";

const name = ref("YouJaymharah");
const logo = ref(null);
let pending;
let lastRefresh = 0;

async function refreshBrand() {
  if (pending || Date.now() - lastRefresh < 60_000) return;
  lastRefresh = Date.now();
  pending = new AbortController();
  const timeout = setTimeout(() => pending?.abort(), 6000);
  try {
    const response = await fetch(withBase("/api/branding"), {
      signal: pending.signal,
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) return;
    const brand = publicBrand((await response.json())?.settings?.brand);
    if (!brand) return;
    name.value = brand.name || "YouJaymharah";
    logo.value = brand.logo_url;
    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon) {
      favicon.href = brand.favicon_url || withBase("/favicon.svg");
      favicon.removeAttribute("type");
    }
  } catch {
    // Keep the last usable branding while the backend is unavailable.
  } finally {
    clearTimeout(timeout);
    pending = undefined;
  }
}

onMounted(() => {
  refreshBrand();
  window.addEventListener("focus", refreshBrand);
});
onUnmounted(() => {
  window.removeEventListener("focus", refreshBrand);
  pending?.abort();
});
</script>

<template>
  <span class="docs-brand">
    <img
      v-if="logo"
      :src="logo"
      :alt="name"
      class="docs-brand-logo"
      referrerpolicy="no-referrer"
      @error="logo = null"
    />
    <span v-else class="docs-brand-name">{{ name }}</span>
    <span class="docs-brand-label">Team handbook</span>
  </span>
</template>
