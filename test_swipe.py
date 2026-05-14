import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(
            viewport={'width': 375, 'height': 812},
            has_touch=True,
            is_mobile=True
        )

        await page.goto("http://localhost:8000")

        # Add a dummy continue reading card dynamically or set local storage
        await page.evaluate("""
            localStorage.setItem('lastReadSurah', '1');
            localStorage.setItem('lastReadAyah', '1');
            window.location.reload();
        """)

        # Wait for reload and the continue reading card to appear
        await page.wait_for_selector("#continue-reading:not(.hidden)", timeout=15000)

        cr_card = await page.query_selector("#continue-reading")
        print("Continue Reading Card found!")

        # Simulate a swipe left to dismiss
        box = await cr_card.bounding_box()
        start_x = box['x'] + box['width'] / 2
        start_y = box['y'] + box['height'] / 2

        await page.mouse.move(start_x, start_y)
        await page.mouse.down()

        # Drag left to dismiss (-100px difference)
        await page.mouse.move(start_x - 100, start_y, steps=10)
        await page.mouse.up()

        # Wait for the collapsing animation and hidden class
        await page.wait_for_timeout(1000)

        is_hidden = await page.evaluate("document.getElementById('continue-reading').classList.contains('hidden')")
        print(f"Card is hidden after swipe: {is_hidden}")

        # Check local storage to see if lastReadSurah was removed
        last_surah = await page.evaluate("localStorage.getItem('lastReadSurah')")
        print(f"Last Surah in localStorage: {last_surah}")

        await browser.close()

asyncio.run(run())
