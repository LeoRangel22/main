const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 35_000,
  expect: {
    timeout: 8_000,
  },
  reporter: [
    ["list"],
    ["html", { open: "never" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:8765",
    browserName: "chromium",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: "npm run serve",
    url: "http://127.0.0.1:8765",
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
