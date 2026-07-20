import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--no-sandbox', '--disable-setuid-sandbox'])
        page = await browser.new_page()

        # Block external domains to speed up and stabilize
        await page.route("**/*", lambda route: route.abort() if "fonts.googleapis.com" in route.request.url or "alquran.cloud" in route.request.url else route.continue_())

        page.on("console", lambda msg: print(f"Browser console: {msg.type}: {msg.text}"))

        await page.goto("http://localhost:8000")
        await page.wait_for_timeout(2000)

        await page.screenshot(path="screenshot.png")
        await browser.close()

asyncio.run(run())
