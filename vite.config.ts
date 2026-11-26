import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    base: "/hhftd/",
  },
  tanstackStart: {
    server: { entry: "server" },
    prerender: {
      enabled: true,
    },
  },
});
