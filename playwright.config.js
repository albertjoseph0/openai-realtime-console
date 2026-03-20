import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  projects: [
    {
      name: "desktop",
      use: { browserName: "chromium" },
    },
    {
      name: "iphone15pro",
      use: { ...devices["iPhone 15 Pro"] },
    },
  ],
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
  },
  webServer: {
    command: "node server.js",
    port: 3000,
    reuseExistingServer: true,
    timeout: 15000,
  },
});
