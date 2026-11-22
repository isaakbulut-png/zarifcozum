const { test, expect } = require('@playwright/test');

test.describe('Ana sayfa paket alanı', () => {
  test('paketleri ana sayfanın sonunda gösterir ve eski demo çağrılarını kaldırır', async ({ page }) => {
    await page.goto('/');

    const packages = page.locator('#paketler');
    await expect(packages).toBeVisible();
    await expect(packages.locator('.subscription-plan-card')).toHaveCount(3);
    await expect(packages.getByRole('heading', { name: 'Hedefine ve Sınıfına Göre Paketini Seç' })).toBeVisible();
    await expect(packages.getByRole('link', { name: 'Temel Pakete Geç' })).toHaveAttribute('href', 'Paketler.html#paket-temel');
    await expect(packages.getByRole('link', { name: 'Standart Pakete Geç' })).toHaveAttribute('href', 'Paketler.html#paket-standart');
    await expect(packages.getByRole('link', { name: 'VIP Pakete Geç' })).toHaveAttribute('href', 'Paketler.html#paket-vip');

    const isAfterFaq = await page.locator('#sss').evaluate((faq) => {
      const section = document.querySelector('#paketler');
      return Boolean(section && faq.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(isAfterFaq).toBe(true);
    await expect(page.getByRole('link', { name: 'Öğrenci demosunu aç' })).toHaveCount(0);
    await expect(page.getByText('Gösterilen ücretler ve paket kapsamı', { exact: false })).toHaveCount(0);
  });

  test('kart içeriği sola hizalanır, özellikler divider sonrasında gelir ve mobilde tek sütuna düşer', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 1280, height: 1000 });

    const cards = page.locator('#paketler .subscription-plan-card');
    await expect(cards).toHaveCount(3);
    const desktopLayout = await cards.evaluateAll((items) => items.map((card) => {
      const feature = card.querySelector('.subscription-plan-features li');
      const button = card.querySelector('.subscription-plan-cta');
      const divider = card.querySelector('.subscription-plan-divider');
      const features = card.querySelector('.subscription-plan-features');
      return {
        textAlign: getComputedStyle(card).textAlign,
        featureDisplay: getComputedStyle(feature).display,
        featureAlign: getComputedStyle(feature).alignItems,
        ctaBeforeDivider: Boolean(button.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING),
        dividerBeforeFeatures: Boolean(divider.compareDocumentPosition(features) & Node.DOCUMENT_POSITION_FOLLOWING),
        height: Math.round(card.getBoundingClientRect().height)
      };
    }));
    for (const card of desktopLayout) {
      expect(card.textAlign).toBe('left');
      expect(card.featureDisplay).toBe('flex');
      expect(['flex-start', 'flow-start']).toContain(card.featureAlign);
      expect(card.ctaBeforeDivider).toBe(true);
      expect(card.dividerBeforeFeatures).toBe(true);
    }
    expect(new Set(desktopLayout.map((card) => card.height)).size).toBe(1);

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileColumnCount = await page.locator('#paketler .subscription-pricing-grid').evaluate((grid) =>
      getComputedStyle(grid).gridTemplateColumns.split(' ').length
    );
    expect(mobileColumnCount).toBe(1);

    await page.goto('/');
    await page.locator('#paketler').evaluate((section) => {
      document.documentElement.style.scrollBehavior = 'auto';
      section.scrollIntoView({ block: 'start' });
    });
    const headingTop = await page.locator('#homepage-pricing-title').evaluate((heading) => heading.getBoundingClientRect().top);
    const headerBottom = await page.locator('header.site-header').evaluate((header) => header.getBoundingClientRect().bottom);
    expect(headingTop).toBeGreaterThanOrEqual(headerBottom);
    expect(headingTop).toBeLessThan(await page.evaluate(() => document.documentElement.clientHeight));
  });

  test('paket sayfasında demo tanıtım çağrıları bulunmaz', async ({ page }) => {
    await page.goto('/Paketler.html');

    await expect(page.locator('main > .wrap > .hero')).toHaveCount(0);
    await expect(page.getByText('Demo paket taslağı', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Gösterilen ücretler ve paket kapsamı', { exact: false })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Öğrenci demosunu aç' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Ana sayfaya dön' })).toHaveCount(0);
    await expect(page.locator('header .row a[href="index.html"]')).toHaveCount(0);
    await expect(page.locator('.subscription-plan-card')).toHaveCount(3);
    await expect(page.getByRole('heading', { name: 'Hedefine ve Sınıfına Göre Paketini Seç' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Temel Pakete Geç' })).toHaveAttribute('data-plan', 'temel');
    await expect(page.getByRole('button', { name: 'Standart Pakete Geç' })).toHaveAttribute('data-plan', 'standart');
    await expect(page.getByRole('button', { name: 'VIP Pakete Geç' })).toHaveAttribute('data-plan', 'vip');
  });
});
