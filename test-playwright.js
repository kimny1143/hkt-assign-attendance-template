const { chromium } = require('@playwright/test');

(async () => {
  console.log('Starting browser...');
  const browser = await chromium.launch({ headless: true });
  console.log('Browser launched');

  const page = await browser.newPage();
  console.log('Page created');

  try {
    console.log('Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { timeout: 5000 });
    console.log('Navigation successful');

    const title = await page.title();
    console.log('Page title:', title);

    const url = page.url();
    console.log('Current URL:', url);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
    console.log('Browser closed');
  }
})();