import { h } from "vue";
import DefaultTheme from "vitepress/theme-without-fonts";
import BrandLogo from "./brand-logo.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      "nav-bar-title-before": () => h(BrandLogo),
    }),
};
