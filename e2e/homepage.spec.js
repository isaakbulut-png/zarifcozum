const { test, expect } = require('@playwright/test');

test.describe('Ana Sayfa Testleri', () => {
  test('Ana sayfa doğru başlık ve ana öğelerle yüklenmeli', async ({ page }) => {
    await page.goto('/');

    // Başlık kontrolü
    await expect(page).toHaveTitle(/ZarifÇözüm/);

    // Marka ve logo kontrolü
    const brand = page.locator('header .brand');
    await expect(brand).toBeVisible();
    await expect(brand).toContainText('ZarifÇözüm');

    // Menü bağlantıları
    const nav = page.locator('#site-navigation');
    await expect(nav).toBeAttached();
    await expect(nav.getByRole('link', { name: 'Nasıl çalışır' })).toBeAttached();
    await expect(nav.getByRole('link', { name: 'Sınıflar' })).toBeAttached();
    await expect(nav.getByRole('link', { name: 'Hakkımızda' })).toBeAttached();

    // Giriş ve Kayıt aksiyon butonları
    await expect(page.locator('header a[href*="role=student"]')).toBeVisible();
    await expect(page.locator('header a[href*="role=teacher"]')).toBeVisible();
    await expect(page.locator('header a[href*="role=parent"]')).toBeVisible();
    await expect(page.locator('header a[href*="mode=register"]')).toBeVisible();

    // Hero alanı ve ana başlık
    const hero = page.locator('main .hero');
    await expect(hero).toBeVisible();
    await expect(hero.locator('h1')).toBeVisible();
  });

  test('Kayıt Ol butonuna tıklandığında kayıt sayfasına yönlendirmeli', async ({ page }) => {
    await page.goto('/');

    const registerBtn = page.locator('header a[href*="mode=register"]').first();
    await registerBtn.click();

    await expect(page).toHaveURL(/kayit-giris\.html/);
    await expect(page.locator('#authForm')).toBeVisible();
  });
});
