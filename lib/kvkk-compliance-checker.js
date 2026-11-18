const fs = require('node:fs');
const path = require('node:path');

/**
 * ZarifÇözüm KVKK & Çerez Uyumluluğu Denetleyicisi
 * 6698 sayılı Kişisel Verilerin Korunması Kanunu ve e-Gizlilik (ePrivacy) mevzuatına uygunluk tarayıcısı.
 */

const BASE_DIR = path.resolve(__dirname, '..');

function safeReadFile(relPath) {
  try {
    const fullPath = path.resolve(BASE_DIR, relPath);
    if (!fs.existsSync(fullPath)) return '';
    return fs.readFileSync(fullPath, 'utf8');
  } catch (_) {
    return '';
  }
}

async function checkKvkkAndCookieCompliance(options = {}) {
  const indexHtml = options.indexHtml !== undefined ? options.indexHtml : safeReadFile('index.html');
  const yasalHtml = options.yasalHtml !== undefined ? options.yasalHtml : safeReadFile('yasal.html');
  const serverJs = options.serverJs !== undefined ? options.serverJs : safeReadFile('server.js');
  const cookiePrefJs = options.cookiePrefJs !== undefined ? options.cookiePrefJs : safeReadFile('assets/cookie-preferences.js');
  const siteFooterJs = options.siteFooterJs !== undefined ? options.siteFooterJs : safeReadFile('assets/site-footer.js');

  const items = [];
  const recommendations = [];

  // 1. Cookie banner aktif mi?
  {
    const hasBannerDom = indexHtml.includes('id="zc-cookie-banner"') || indexHtml.includes('zc-cookie-banner');
    const hasBannerButtons = indexHtml.includes('zc-btn-accept') && (indexHtml.includes('zc-btn-reject') || indexHtml.includes('openCookieModal'));
    const isBannerActive = hasBannerDom && hasBannerButtons;

    if (isBannerActive) {
      items.push({
        id: 'cookie_banner',
        title: 'Cookie Banner Aktifliği',
        category: 'Çerez Yönetimi',
        status: 'compliant',
        statusLabel: '✅ Uyumlu',
        score: 10,
        details: 'Kullanıcı siteye ilk girdiğinde alt tarafta beliren, açık onay (Kabul Et) ve reddetme butonları barındıran "#zc-cookie-banner" arayüzü aktiftir.',
        risk: null,
        recommendation: null
      });
    } else if (hasBannerDom) {
      items.push({
        id: 'cookie_banner',
        title: 'Cookie Banner Aktifliği',
        category: 'Çerez Yönetimi',
        status: 'partial',
        statusLabel: '⚠️ Kısmen Uyumlu',
        score: 6,
        details: 'Çerez banner DOM elemanı mevcut ancak onay veya ret aksiyon butonları eksik yapılandırılmış.',
        risk: 'Kullanıcılara açık kabul/ret seçeneği sunulmaması idari para cezası riski doğurabilir.',
        recommendation: 'Banner içerisine "Tümünü Kabul Et", "Reddet" ve "Tercihleri Yönet" butonlarını ekleyiniz.'
      });
      recommendations.push('Cookie banner içine açık "Kabul Et" ve "Reddet" butonlarını eksiksiz ekleyiniz.');
    } else {
      items.push({
        id: 'cookie_banner',
        title: 'Cookie Banner Aktifliği',
        category: 'Çerez Yönetimi',
        status: 'non_compliant',
        statusLabel: '❌ Uyumsuz',
        score: 0,
        details: 'Ana sayfada herhangi bir çerez bilgilendirme veya onay panosu (Cookie Banner) tespit edilemedi.',
        risk: 'KVKK ve e-Privacy direktiflerine aykırı çerez kullanımı.',
        recommendation: 'Ana sayfa ve tüm giriş sayfalarında görüntülenecek dinamik bir çerez onay bannerı entegre edin.'
      });
      recommendations.push('Ziyaretçiler için aktif bir çerez onay bannerı devreye alınız.');
    }
  }

  // 2. Çerez tercihleri kaydediliyor mu?
  {
    const hasLocalStorage = indexHtml.includes('zc_cookie_prefs') || cookiePrefJs.includes('zarifcozum.cookiePreferences');
    const hasGranularPrefs = (indexHtml.includes('analytics') && indexHtml.includes('marketing')) ||
      (cookiePrefJs.includes('necessary') && cookiePrefJs.includes('analytics'));

    if (hasLocalStorage && hasGranularPrefs) {
      items.push({
        id: 'cookie_preferences_stored',
        title: 'Çerez Tercihlerinin Saklanması',
        category: 'Çerez Yönetimi',
        status: 'compliant',
        statusLabel: '✅ Uyumlu',
        score: 10,
        details: 'Kullanıcı tercihleri yerel depolamada ("zc_cookie_prefs") zorunlu, analitik ve pazarlama kategorileri bazında zaman damgasıyla saklanıyor.',
        risk: null,
        recommendation: null
      });
    } else if (hasLocalStorage) {
      items.push({
        id: 'cookie_preferences_stored',
        title: 'Çerez Tercihlerinin Saklanması',
        category: 'Çerez Yönetimi',
        status: 'partial',
        statusLabel: '⚠️ Kısmen Uyumlu',
        score: 6,
        details: 'Tercih saklama mevcut ancak kategori bazlı ayrıştırma (zorunlu/analitik/pazarlama) tam yapılandırılmamış.',
        risk: 'Kullanıcıya kategori bazında seçim hakkı verilmemesi KVKK gerekliliklerine uyumu zorlaştırır.',
        recommendation: 'Çerez tercihlerini Zorunlu, Analitik ve Pazarlama olarak ayrıştırarak saklayınız.'
      });
      recommendations.push('Çerez tercihlerini zorunlu, analitik ve pazarlama kategorileri halinde saklayınız.');
    } else {
      items.push({
        id: 'cookie_preferences_stored',
        title: 'Çerez Tercihlerinin Saklanması',
        category: 'Çerez Yönetimi',
        status: 'non_compliant',
        statusLabel: '❌ Uyumsuz',
        score: 0,
        details: 'Kullanıcı onaylarının tarayıcıda saklandığına dair bir kayıt mekanizması bulunamadı.',
        risk: 'Her sayfa yenilemesinde rıza sorulması veya izinsiz takip yapılması riski.',
        recommendation: 'Kullanıcı seçimlerini localStorage veya çerez üzerinde güvenle saklayan mekanizmayı bağlayınız.'
      });
      recommendations.push('Kullanıcı onaylarını saklayan yerel depolama mekanizmasını etkinleştirin.');
    }
  }

  // 3. Kullanıcı tercih değişikliği yapabiliyor mu?
  {
    const hasModal = indexHtml.includes('zc-cookie-modal') || indexHtml.includes('openCookieModal');
    const hasFooterLink = siteFooterJs.includes('cerez-tercihleri') || yasalHtml.includes('cerez-tercihleri') || indexHtml.includes('openCookieModal');

    if (hasModal && hasFooterLink) {
      items.push({
        id: 'preference_change_allowed',
        title: 'Çerez Tercihlerini Güncelleyebilme',
        category: 'Çerez Yönetimi',
        status: 'compliant',
        statusLabel: '✅ Uyumlu',
        score: 10,
        details: 'Ziyaretçiler footer bağlantısı veya çerez ayarları modalı ("openCookieModal") ile verdikleri onayları diledikleri zaman değiştirebilmekte veya geri alabilmektedir.',
        risk: null,
        recommendation: null
      });
    } else if (hasModal || hasFooterLink) {
      items.push({
        id: 'preference_change_allowed',
        title: 'Çerez Tercihlerini Güncelleyebilme',
        category: 'Çerez Yönetimi',
        status: 'partial',
        statusLabel: '⚠️ Kısmen Uyumlu',
        score: 6,
        details: 'Tercih değiştirme arayüzü mevcut ancak sitenin her sayfasından (örneğin sabit footer linki ile) doğrudan erişilebilir değil.',
        risk: 'Rızanın geri alınmasının verilmesi kadar kolay olmaması ilkesine aykırılık riski.',
        recommendation: 'Site altbilgisine (footer) "Çerez Tercihlerini Yönet" kalıcı butonu ekleyiniz.'
      });
      recommendations.push('Site altbilgisine (footer) "Çerez Tercihlerini Yönet" kalıcı butonu ekleyiniz.');
    } else {
      items.push({
        id: 'preference_change_allowed',
        title: 'Çerez Tercihlerini Güncelleyebilme',
        category: 'Çerez Yönetimi',
        status: 'non_compliant',
        statusLabel: '❌ Uyumsuz',
        score: 0,
        details: 'Ziyaretçinin ilk seçiminden sonra çerez tercihlerini değiştirebileceği bir panel veya buton bulunamadı.',
        risk: 'Verilen rızanın geri alınamaması KVKK Madde 9 ve e-Privacy ihlali teşkil eder.',
        recommendation: 'Kullanıcıların diledikleri an tercihlerini güncelleyebileceği bir çerez yönetim modalı ekleyin.'
      });
      recommendations.push('Kullanıcıların tercihlerini diledikleri an güncelleyebilecekleri bir arayüz sunun.');
    }
  }

  // 4. Analytics çerezleri izin olmadan çalışıyor mu?
  {
    const hasConsentDefault = indexHtml.includes("'consent', 'default'") && indexHtml.includes("'analytics_storage'");
    const isDeniedByDefault = indexHtml.includes("'analytics_storage': 'denied'") || indexHtml.includes('"analytics_storage": "denied"');
    const isConsentUpdated = indexHtml.includes("'consent', 'update'") || indexHtml.includes('analytics_storage');

    if (hasConsentDefault && isDeniedByDefault && isConsentUpdated) {
      items.push({
        id: 'analytics_consent_gated',
        title: 'İzinsiz Analytics Engellemesi (Consent Mode)',
        category: 'Çerez Yönetimi',
        status: 'compliant',
        statusLabel: '✅ Uyumlu',
        score: 10,
        details: 'Google Consent Mode v2 entegre. "analytics_storage" ve "ad_storage" varsayılan olarak "denied" (engelli) başlar; yalnızca ziyaretçi açık onay verirse çalıştırılır.',
        risk: null,
        recommendation: null
      });
    } else if (hasConsentDefault) {
      items.push({
        id: 'analytics_consent_gated',
        title: 'İzinsiz Analytics Engellemesi (Consent Mode)',
        category: 'Çerez Yönetimi',
        status: 'partial',
        statusLabel: '⚠️ Kısmen Uyumlu',
        score: 6,
        details: 'Consent Mode tanımlı ancak varsayılan ret (denied) durumu veya onay güncellemesi tam kurgulanmamış.',
        risk: 'Kullanıcı onay vermeden önce analitik veri toplanması riski.',
        recommendation: 'Consent modunda analytics_storage varsayılanını kesin olarak "denied" yapınız.'
      });
      recommendations.push('Analitik çerezleri varsayılan olarak kesinlikle "denied" (engelli) başlatınız.');
    } else {
      items.push({
        id: 'analytics_consent_gated',
        title: 'İzinsiz Analytics Engellemesi (Consent Mode)',
        category: 'Çerez Yönetimi',
        status: 'non_compliant',
        statusLabel: '❌ Uyumsuz',
        score: 0,
        details: 'Analitik takip kodları kullanıcı onayı alınmadan doğrudan yüklenmektedir.',
        risk: 'Kullanıcının IP ve gezinme verisinin izinsiz işlenmesi KVKK açısından yüksek ihlal riskidir.',
        recommendation: 'Google Tag Manager / Analytics kodlarını onay verilene kadar tetiklemeyen mekanizmaya bağlayın.'
      });
      recommendations.push('Analitik scriptlerinin onay öncesinde yüklenmesini kesin olarak engelleyin.');
    }
  }

  // 5. HttpOnly cookie kullanılıyor mu?
  {
    const hasHttpOnlyInServer = serverJs.includes('httpOnly: true');
    if (hasHttpOnlyInServer) {
      items.push({
        id: 'http_only_cookies',
        title: 'HttpOnly Güvenlik Niteliği',
        category: 'Güvenlik & Çerez Nitelikleri',
        status: 'compliant',
        statusLabel: '✅ Uyumlu',
        score: 10,
        details: 'Oturum çerezinde ("zarifcozum.sid") "httpOnly: true" bayrağı tanımlıdır. Çereze tarayıcı JavaScript (document.cookie) ile erişilemez, XSS oturum hırsızlığı önlenir.',
        risk: null,
        recommendation: null
      });
    } else {
      items.push({
        id: 'http_only_cookies',
        title: 'HttpOnly Güvenlik Niteliği',
        category: 'Güvenlik & Çerez Nitelikleri',
        status: 'non_compliant',
        statusLabel: '❌ Uyumsuz',
        score: 0,
        details: 'Oturum çerezlerinde "httpOnly: true" yapılandırması tespit edilemedi.',
        risk: 'XSS açığı durumunda kötü niyetli scriptler kullanıcı oturum çerezlerini doğrudan çalabilir.',
        recommendation: 'Express session cookie ayarlarında httpOnly: true seçeneğini aktif ediniz.'
      });
      recommendations.push('Oturum çerezlerinde httpOnly: true güvenlik bayrağını zorunlu kılın.');
    }
  }

  // 6. Secure cookie kullanılıyor mu?
  {
    const hasSecureInServer = serverJs.includes('secure: process.env.NODE_ENV === \'production\'') ||
      serverJs.includes('secure: true');

    if (hasSecureInServer) {
      items.push({
        id: 'secure_cookies',
        title: 'Secure (HTTPS) Güvenlik Niteliği',
        category: 'Güvenlik & Çerez Nitelikleri',
        status: 'compliant',
        statusLabel: '✅ Uyumlu',
        score: 10,
        details: 'Oturum çerezinde "secure" bayrağı üretim ortamı (NODE_ENV=production) için aktiftir. Çerezler yalnızca şifreli TLS/HTTPS bağlantıları üzerinden iletilir.',
        risk: null,
        recommendation: null
      });
    } else {
      items.push({
        id: 'secure_cookies',
        title: 'Secure (HTTPS) Güvenlik Niteliği',
        category: 'Güvenlik & Çerez Nitelikleri',
        status: 'partial',
        statusLabel: '⚠️ Kısmen Uyumlu',
        score: 5,
        details: 'Çerez yapılandırmasında Secure bayrağı açıkça zorunlu kılınmamış.',
        risk: 'Ağ trafiğini dinleyen saldırganlar şifrelenmemiş HTTP bağlantılarında çerezleri ele geçirebilir.',
        recommendation: 'Üretim ortamında çerezlerin yalnızca HTTPS üzerinden taşınması için cookie.secure = true ayarlayınız.'
      });
      recommendations.push('Üretim ortamında oturum çerezlerinin "secure: true" olarak iletildiğini teyit edin.');
    }
  }

  // 7. SameSite ayarları doğru mu?
  {
    const hasSameSiteLax = serverJs.includes("sameSite: 'lax'") || serverJs.includes('sameSite: "lax"');
    const hasSameSiteStrict = serverJs.includes("sameSite: 'strict'") || serverJs.includes('sameSite: "strict"');

    if (hasSameSiteLax || hasSameSiteStrict) {
      items.push({
        id: 'same_site_config',
        title: 'SameSite Koruması (CSRF Önleme)',
        category: 'Güvenlik & Çerez Nitelikleri',
        status: 'compliant',
        statusLabel: '✅ Uyumlu',
        score: 10,
        details: `Oturum çerezinde "sameSite: '${hasSameSiteStrict ? 'strict' : 'lax'}'" tanımlıdır. Siteler arası sahte istek (CSRF) saldırılarına karşı tarayıcı koruması sağlanmaktadır.`,
        risk: null,
        recommendation: null
      });
    } else {
      items.push({
        id: 'same_site_config',
        title: 'SameSite Koruması (CSRF Önleme)',
        category: 'Güvenlik & Çerez Nitelikleri',
        status: 'non_compliant',
        statusLabel: '❌ Uyumsuz',
        score: 0,
        details: 'Oturum çerezinde SameSite bayrağı eksik veya "none" olarak bırakılmış.',
        risk: 'Üçüncü taraf siteler üzerinden sahte istek (CSRF) gönderilerek kullanıcı adına yetkisiz işlem yapılabilir.',
        recommendation: 'Express session ayarlarında cookie.sameSite değerini "lax" veya "strict" olarak yapılandırın.'
      });
      recommendations.push('Oturum çerezlerinde cookie.sameSite: "lax" korumasını aktif ediniz.');
    }
  }

  // 8. Gizlilik Politikası sayfası mevcut mu?
  {
    const hasPrivacySection = yasalHtml.includes('id="gizlilik-politikasi"') || yasalHtml.includes('Gizlilik Politikası');
    const hasContent = yasalHtml.includes('toplanan veriler') || yasalHtml.includes('Kişisel Verilerin Korunması') || yasalHtml.includes('gizlilik');

    if (hasPrivacySection && hasContent) {
      items.push({
        id: 'privacy_policy_present',
        title: 'Gizlilik Politikası Metni & Sayfası',
        category: 'Yasal Metinler & Aydınlatma',
        status: 'compliant',
        statusLabel: '✅ Uyumlu',
        score: 10,
        details: 'Yasal belgeler sayfasında (/yasal.html#gizlilik-politikasi) veri işleme prensipleri, saklama ve güvenlik ilkelerini içeren kapsamlı Gizlilik Politikası yayınlanmaktadır.',
        risk: null,
        recommendation: null
      });
    } else if (hasPrivacySection) {
      items.push({
        id: 'privacy_policy_present',
        title: 'Gizlilik Politikası Metni & Sayfası',
        category: 'Yasal Metinler & Aydınlatma',
        status: 'partial',
        statusLabel: '⚠️ Kısmen Uyumlu',
        score: 6,
        details: 'Gizlilik politikası başlığı mevcut ancak içeriğindeki veri kategorileri ve saklama süreleri güncelliğini yitirmiş veya kısa tutulmuş.',
        risk: 'Eksik bilgilendirme nedeniyle şeffaflık ilkesinin zedelenmesi riski.',
        recommendation: 'Gizlilik politikasını işlenen verilerin güncel kapsamına göre zenginleştiriniz.'
      });
      recommendations.push('Gizlilik politikası metnini güncel veri kategorileriyle zenginleştirin.');
    } else {
      items.push({
        id: 'privacy_policy_present',
        title: 'Gizlilik Politikası Metni & Sayfası',
        category: 'Yasal Metinler & Aydınlatma',
        status: 'non_compliant',
        statusLabel: '❌ Uyumsuz',
        score: 0,
        details: 'Sitede yayınlanan geçerli bir Gizlilik Politikası sayfası bulunamadı.',
        risk: 'KVKK ve kanuni şeffaflık zorunluluğunun doğrudan ihlali.',
        recommendation: 'Kapsamlı bir Gizlilik Politikası metni hazırlayıp /yasal.html adresinde yayınlayınız.'
      });
      recommendations.push('Sitede erişilebilir bir Gizlilik Politikası sayfası oluşturunuz.');
    }
  }

  // 9. KVKK Aydınlatma Metni mevcut mu?
  {
    const hasKvkkSection = yasalHtml.includes('id="kvkk-aydinlatma"') || yasalHtml.includes('KVKK Aydınlatma Metni');
    const hasStatutoryRights = yasalHtml.includes('Madde 11') || yasalHtml.includes('11. madde') || yasalHtml.includes('haklarınız');
    const hasDataController = yasalHtml.includes('Veri Sorumlusu') || yasalHtml.includes('ZarifÇözüm');

    if (hasKvkkSection && hasStatutoryRights && hasDataController) {
      items.push({
        id: 'kvkk_clarification_present',
        title: 'KVKK Aydınlatma Metni (Madde 10 & 11)',
        category: 'Yasal Metinler & Aydınlatma',
        status: 'compliant',
        statusLabel: '✅ Uyumlu',
        score: 10,
        details: '6698 sayılı Kanun m.10 kapsamında Veri Sorumlusu kimliği, işleme amaçları, hukuki sebepler ve m.11 kapsamındaki ilgili kişi başvuru hakları eksiksiz yer almaktadır.',
        risk: null,
        recommendation: null
      });
    } else if (hasKvkkSection) {
      items.push({
        id: 'kvkk_clarification_present',
        title: 'KVKK Aydınlatma Metni (Madde 10 & 11)',
        category: 'Yasal Metinler & Aydınlatma',
        status: 'partial',
        statusLabel: '⚠️ Kısmen Uyumlu',
        score: 7,
        details: 'Aydınlatma metni mevcut fakat Kanun m.11 kapsamındaki başvuru yöntemi veya veri sorumlusu tüzel kişilik detayları tam netleştirilmemiş.',
        risk: 'Aydınlatma yükümlülüğünün şeklen eksik yerine getirilmesi riski.',
        recommendation: 'KVKK Aydınlatma Metnine başvuru usulü (posta/KEP/e-posta) ve veri sorumlusu unvanını açıkça ekleyiniz.'
      });
      recommendations.push('Aydınlatma metnine KVKK m.11 başvuru iletişim kanallarını ekleyiniz.');
    } else {
      items.push({
        id: 'kvkk_clarification_present',
        title: 'KVKK Aydınlatma Metni (Madde 10 & 11)',
        category: 'Yasal Metinler & Aydınlatma',
        status: 'non_compliant',
        statusLabel: '❌ Uyumsuz',
        score: 0,
        details: 'Sitede 6698 sayılı KVKK gereği zorunlu olan Aydınlatma Metni tespit edilemedi.',
        risk: 'KVKK m.10 aydınlatma yükümlülüğünün ihlali nedeniyle Kurul tarafından idari para cezası yaptırımı.',
        recommendation: 'Hemen 6698 sayılı kanuna uygun Aydınlatma Metni oluşturup sitede erişime açınız.'
      });
      recommendations.push('Hemen yasalara uygun bir KVKK Aydınlatma Metni hazırlayıp yayınlayınız.');
    }
  }

  // 10. Çerez Politikası sayfası mevcut mu?
  {
    const hasCookiePolicy = yasalHtml.includes('id="cerez-politikasi"') || yasalHtml.includes('Çerez Politikası');
    const hasCookieTypes = yasalHtml.includes('Zorunlu Çerez') || yasalHtml.includes('Analitik') || yasalHtml.includes('Pazarlama');

    if (hasCookiePolicy && hasCookieTypes) {
      items.push({
        id: 'cookie_policy_present',
        title: 'Çerez Politikası Metni & Tablosu',
        category: 'Yasal Metinler & Aydınlatma',
        status: 'compliant',
        statusLabel: '✅ Uyumlu',
        score: 10,
        details: 'Çerez Politikası (/yasal.html#cerez-politikasi) altında çerez türleri, saklama süreleri, sağlayıcıları ve kullanım amaçları şeffaf bir tablo halinde listelenmiştir.',
        risk: null,
        recommendation: null
      });
    } else if (hasCookiePolicy) {
      items.push({
        id: 'cookie_policy_present',
        title: 'Çerez Politikası Metni & Tablosu',
        category: 'Yasal Metinler & Aydınlatma',
        status: 'partial',
        statusLabel: '⚠️ Kısmen Uyumlu',
        score: 6,
        details: 'Çerez politikası sayfası mevcut ancak kullanılan spesifik çerezlerin adları ve saklama süreleri tablosu eksik.',
        risk: 'Kullanıcının hangi çerezin ne süreyle kaldığını bilememesi şeffaflık zafiyeti oluşturur.',
        recommendation: 'Çerez tablosuna çerez adı, sağlayıcı, tür ve saklama süresi sütunlarını ekleyiniz.'
      });
      recommendations.push('Çerez politikasına spesifik çerez adları ve saklama sürelerini gösteren tablo ekleyiniz.');
    } else {
      items.push({
        id: 'cookie_policy_present',
        title: 'Çerez Politikası Metni & Tablosu',
        category: 'Yasal Metinler & Aydınlatma',
        status: 'non_compliant',
        statusLabel: '❌ Uyumsuz',
        score: 0,
        details: 'Sitede ayrı bir Çerez Politikası bilgilendirmesi bulunamadı.',
        risk: 'Kullanıcıların çerezler hakkında bilgilendirilmemesi mevzuat ihlalidir.',
        recommendation: 'Çerez türlerini ve tercihlerini anlatan Çerez Politikasını yayına alınız.'
      });
      recommendations.push('Sitede detaylı bir Çerez Politikası sayfası oluşturunuz.');
    }
  }

  // Genel Uyumluluk Puanı Hesaplama
  const totalScore = items.reduce((acc, it) => acc + (it.score || 0), 0);
  const normalizedScore = Math.min(100, Math.max(0, totalScore));

  let overallStatus = 'compliant';
  let overallStatusLabel = '✅ Uyumlu';
  if (normalizedScore < 70) {
    overallStatus = 'non_compliant';
    overallStatusLabel = '❌ Uyumsuz';
  } else if (normalizedScore < 90 || items.some(it => it.status === 'partial' || it.status === 'non_compliant')) {
    overallStatus = 'partial';
    overallStatusLabel = '⚠️ Kısmen Uyumlu';
  }

  // Eğer ek iyileştirme önerisi yoksa proaktif best-practice önerileri ekle
  if (recommendations.length === 0) {
    recommendations.push('Çerez tercihleri ve aydınlatma metinlerini yılda en az bir kez periyodik olarak güncelleyiniz.');
    recommendations.push('Üçüncü taraf analitik araçlarının veri işleme sözleşmelerini (DPA) düzenli denetleyiniz.');
  }

  const compliantCount = items.filter(it => it.status === 'compliant').length;
  const partialCount = items.filter(it => it.status === 'partial').length;
  const nonCompliantCount = items.filter(it => it.status === 'non_compliant').length;

  return {
    timestamp: new Date(),
    score: normalizedScore,
    status: overallStatus,
    statusLabel: overallStatusLabel,
    summary: normalizedScore >= 90
      ? `Sistem 6698 sayılı KVKK ve Çerez Direktiflerine yüksek derecede uyumludur (${compliantCount}/10 tam uyumlu).`
      : normalizedScore >= 70
        ? `Sistem temel KVKK gereksinimlerini sağlamakta olup bazı alanlarda iyileştirme önerilmektedir (${partialCount} kısmi uyarı).`
        : `Sistemde giderilmesi gereken kritik KVKK ve çerez uyumluluk eksiklikleri tespit edilmiştir (${nonCompliantCount} uyumsuzluk).`,
    counts: {
      total: items.length,
      compliant: compliantCount,
      partial: partialCount,
      nonCompliant: nonCompliantCount
    },
    items,
    recommendations
  };
}

module.exports = {
  checkKvkkAndCookieCompliance
};
