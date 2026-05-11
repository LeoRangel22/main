const { chromium } = require("@playwright/test");

async function main() {
  const url = process.argv[2] || "http://127.0.0.1:8765/index.html?qa=1";
  const clickSelector = process.argv[3] || "";
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(url);
  await page.waitForSelector("body");
  if (clickSelector) {
    await page.locator(clickSelector).first().click();
    await page.waitForTimeout(700);
  }

  const report = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    scrollY: window.scrollY,
    items: [...document.querySelectorAll("body *")]
      .map((element) => ({
        tag: element.tagName,
        id: element.id,
        className: String(element.className),
        width: element.scrollWidth,
        client: element.clientWidth,
        left: Math.round(element.getBoundingClientRect().left),
        right: Math.round(element.getBoundingClientRect().right),
        text: (element.textContent || "").trim().slice(0, 100),
      }))
      .filter((item) => item.width > item.client + 4 || item.right > window.innerWidth + 4)
      .slice(0, 60),
  }));

  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
