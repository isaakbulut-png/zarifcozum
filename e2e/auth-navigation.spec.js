const { test, expect } = require('@playwright/test');

test.describe('Kayıt ve Giriş Ekranı Testleri', () => {
  test('Giriş ekranı varsayılan olarak doğru form elemanlarıyla açılmalı', async ({ page }) => {
    await page.goto('/kayit-giris.html');

    // Sayfa başlığı
    await expect(page).toHaveTitle(/Giriş \/ Kayıt/);

    // Form öğeleri
    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');
    const submitBtn = page.locator('#submitBtn');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    // Giriş modunda ad-soyad alanı gizli olmalı
    const nameField = page.locator('#nameField');
    await expect(nameField).toBeHidden();
  });

  test('Giriş ve Kayıt modları arasında geçiş yapılabilmeli', async ({ page }) => {
    await page.goto('/kayit-giris.html');

    const registerTab = page.locator('#registerMode');
    const loginTab = page.locator('#loginMode');
    const nameField = page.locator('#nameField');
    const submitBtn = page.locator('#submitBtn');

    // Kayıt ol sekmesine tıkla
    await registerTab.click();
    await expect(registerTab).toHaveAttribute('aria-pressed', 'true');
    await expect(loginTab).toHaveAttribute('aria-pressed', 'false');
    await expect(nameField).toBeVisible();
    await expect(submitBtn).toHaveText(/Kayıt Ol/i);

    // Giriş yap sekmesine geri dön
    await loginTab.click();
    await expect(loginTab).toHaveAttribute('aria-pressed', 'true');
    await expect(nameField).toBeHidden();
    await expect(submitBtn).toHaveText(/Giriş Yap/i);
  });

  test('URL parametresi (?mode=register) ile açıldığında doğrudan kayıt modunda başlamalı', async ({ page }) => {
    await page.goto('/kayit-giris.html?mode=register');

    const registerTab = page.locator('#registerMode');
    const nameField = page.locator('#nameField');

    await expect(registerTab).toHaveAttribute('aria-pressed', 'true');
    await expect(nameField).toBeVisible();
  });
});
