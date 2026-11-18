const fs = require('node:fs');
const path = require('node:path');

/**
 * ZarifÇözüm Yasal Metinler ve Sözleşmeler Denetim Motoru
 * Sistemde bulunan 9 temel yasal metni denetler:
 * 1. Üyelik Sözleşmesi
 * 2. Kullanım Şartları
 * 3. Gizlilik Politikası
 * 4. KVKK Aydınlatma Metni
 * 5. Çerez Politikası
 * 6. Açık Rıza Metni
 * 7. Ön Bilgilendirme Formu
 * 8. Mesafeli Satış Sözleşmesi
 * 9. İptal ve İade Politikası
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

function extractSectionContent(html, sectionId) {
  if (!html) return '';
  const regex = new RegExp(`<div[^>]*id=["']${sectionId}["'][^>]*>([\\s\\S]*?)(?:<div[^>]*class=["']legal-doc-section["']|<\\/div>\\s*<\\/div>\\s*<\\/div>\\s*<\\/main>)`, 'i');
  const match = html.match(regex);
  return match ? match[1] : '';
}

function auditSingleDocument(docConfig, sectionHtml, rawHtml = '') {
  const text = sectionHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const lowerText = text.toLowerCase();

  const missingFields = [];
  const placeholders = [];
  const companyInfoRequired = [];
  const kvkkIssues = [];
  const contradictions = [];
  const recommendations = [];

  let score = 100;

  // 1. Placeholder Kontrolleri
  const placeholderPatterns = [
    /\[.*?\]/g,
    /\b(şirket unvanı|mersis no|vergi dairesi|vergi no|ticaret sicil no|fiziki adres|tebligat adresi)\b/gi,
    /_{3,}/g,
    /\.{4,}/g
  ];

  for (const pat of docConfig.specificPlaceholders || []) {
    if (pat.test(sectionHtml)) {
      placeholders.push(pat.label || pat.toString());
      score -= 5;
    }
  }

  // Genel placeholder taraması
  const bracketMatches = sectionHtml.match(/\[(şirket|adres|tarih|unvan|telefon|mersis|vergi)[^\]]*\]/gi);
  if (bracketMatches) {
    bracketMatches.forEach(m => {
      if (!placeholders.includes(m)) placeholders.push(m);
      score -= 4;
    });
  }

  // 2. Şirket Bilgisi Gerektiren Bölümler
  const hasFullLegalTitle = /zarifçözüm\s+(eğitim\s+teknolojileri\s+)?(anonim\s+şirketi|limited\s+şirketi|a\.ş\.|ltd\.\s*şti\.)/i.test(sectionHtml) ||
    /zarifçözüm\s+eğitim\s+teknolojileri/i.test(sectionHtml);
  const hasMersis = /mersis/i.test(sectionHtml) || /mersis/i.test(rawHtml);
  const hasTaxNumber = /(vergi\s+dairesi|vkn|vergi\s+no)/i.test(sectionHtml) || /(vergi\s+dairesi|vkn|vergi\s+no)/i.test(rawHtml);
  const hasPhysicalAddress = /(merkez\s+adresi|tebligat\s+adresi|adres:)/i.test(sectionHtml) || /(barbaros|ataşehir|istanbul|posta\s+kodu)/i.test(rawHtml);
  const hasEmail = /(destek@zarifcozum\.com|yasal@zarifcozum\.com|kvkk@zarifcozum\.com)/i.test(sectionHtml);

  docConfig.companyChecks?.forEach(c => {
    if (c.id === 'legal_title' && !hasFullLegalTitle) {
      companyInfoRequired.push('Resmî Ticaret Sicil Unvanı (Ltd. Şti. / A.Ş. ibaresi ile tam unvan)');
      score -= 6;
    }
    if (c.id === 'mersis' && !hasMersis) {
      companyInfoRequired.push('MERSİS (Merkezi Sicil Kayıt Sistemi) Numarası');
      score -= 5;
    }
    if (c.id === 'tax' && !hasTaxNumber) {
      companyInfoRequired.push('Vergi Dairesi ve Vergi Kimlik Numarası (VKN)');
      score -= 4;
    }
    if (c.id === 'address' && !hasPhysicalAddress) {
      companyInfoRequired.push('Fiziksel Tebligat ve İdare Merkezi Adresi');
      score -= 6;
    }
    if (c.id === 'email' && !hasEmail) {
      companyInfoRequired.push('Resmî Müşteri İletişim ve Destek E-posta Adresi');
      score -= 4;
    }
  });

  // 3. Eksik Alanlar (Belgeye Özel)
  docConfig.requiredItems?.forEach(item => {
    const present = item.check(sectionHtml, text, rawHtml);
    if (!present) {
      missingFields.push(item.label);
      score -= (item.weight || 8);
    }
  });

  // 4. KVKK Uyumluluğu Açısından Eksik Maddeler
  docConfig.kvkkChecks?.forEach(kvkk => {
    const passed = kvkk.check(sectionHtml, text, rawHtml);
    if (!passed) {
      kvkkIssues.push(kvkk.label);
      score -= (kvkk.weight || 6);
    }
  });

  // 5. Hatalı veya Çelişkili İfadeler
  docConfig.contradictionChecks?.forEach(ct => {
    const issue = ct.check(sectionHtml, text, rawHtml);
    if (issue) {
      contradictions.push(issue);
      score -= 8;
    }
  });

  // 6. Öneriler
  docConfig.recommendationRules?.forEach(rec => {
    const suggestion = rec.check(sectionHtml, text, rawHtml, { missingFields, placeholders, companyInfoRequired, kvkkIssues });
    if (suggestion) {
      recommendations.push(suggestion);
    }
  });

  // Puan sınırlandırma (0 - 100)
  score = Math.max(25, Math.min(100, Math.round(score)));

  let status = 'compliant';
  let statusLabel = '✅ Uyumlu';
  if (score < 70) {
    status = 'non_compliant';
    statusLabel = '❌ Riskli / Eksik';
  } else if (score < 85 || missingFields.length > 0 || placeholders.length > 0 || companyInfoRequired.length > 0) {
    status = 'partial';
    statusLabel = '⚠️ Kısmen Uyumlu';
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return {
    id: docConfig.id,
    name: docConfig.title,
    title: docConfig.title,
    sectionId: docConfig.id,
    lawReference: docConfig.lawReference,
    score,
    status,
    statusLabel,
    articleCount: (sectionHtml.match(/<article/gi) || []).length,
    characterCount: text.length,
    missingFields,
    placeholders,
    companyInfoRequired,
    companyInfoNeeded: companyInfoRequired,
    kvkkIssues,
    contradictions,
    recommendations,
    stats: {
      wordCount,
      charCount: text.length,
      missingCount: missingFields.length,
      placeholderCount: placeholders.length,
      companyCount: companyInfoRequired.length,
      kvkkCount: kvkkIssues.length,
      contradictionCount: contradictions.length
    }
  };
}

const DOCUMENT_DEFINITIONS = [
  // 1. ÜYELİK SÖZLEŞMESİ
  {
    id: 'uyelik-sozlesmesi',
    title: 'Üyelik Sözleşmesi',
    lawReference: '6098 sayılı TBK m.20-25 & 6502 sayılı TKHK',
    companyChecks: [{ id: 'legal_title' }, { id: 'address' }, { id: 'email' }, { id: 'mersis' }],
    requiredItems: [
      {
        label: 'Reşit Olmayanlar İçin Veli Onay Mekanizması',
        weight: 8,
        check: (html) => html.includes('veli onayı') || html.includes('18 yaş')
      },
      {
        label: 'Hesap Devir ve Eşzamanlı Kullanım Yasağı',
        weight: 6,
        check: (html) => html.includes('devredilemez') || html.includes('ortak kullanım')
      },
      {
        label: 'Sözleşme Revizyonu ve Yürürlük Bildirim Süresi',
        weight: 6,
        check: (html) => /gün\s+önce/i.test(html) || html.includes('revizyon') || html.includes('değişiklik')
      },
      {
        label: 'Tüketici Hakem Heyeti ve Parasal Sınır Yetkisi',
        weight: 6,
        check: (html) => html.includes('Tüketici Hakem Heyetleri') || html.includes('Tüketici Mahkemeleri')
      }
    ],
    kvkkChecks: [
      {
        label: 'Hesap Kapatma ve Veri Anonimleştirme / Silme Talebi Usulü',
        weight: 6,
        check: (html) => html.includes('anonimleştir') || html.includes('hesabının kapatılmasını') || html.includes('silinmesini')
      }
    ],
    contradictionChecks: [
      {
        check: (html) => {
          if (html.includes('bağlayıcı bir satış taahhüdü teşkil etmez') && html.includes('vergiler dâhil satış fiyatları')) {
            return 'Demo içeriklerin bağlayıcı olmaması hükmü ile ücretli paket satış bedellerinin ayrımı daha net vurgulanmalıdır.';
          }
          return null;
        }
      }
    ],
    recommendationRules: [
      {
        check: (html, txt, raw, { companyInfoRequired }) => {
          if (companyInfoRequired.length > 0) {
            return '1. maddede yalnızca marka adı yerine şirketin Ticaret Sicil Gazetesi\'ndeki tam tüzel unvanı, MERSİS no ve tescilli adresi yazılmalıdır.';
          }
          return null;
        }
      },
      {
        check: (html) => 'Öğrencinin 18 yaş altı olması halinde veli telefonuna gönderilen SMS onay kodu ile üyeliğin kesinleştiği sözleşmede açıkça belirtilmelidir.'
      }
    ]
  },

  // 2. KULLANIM ŞARTLARI
  {
    id: 'kullanim-kosullari',
    title: 'Kullanım Şartları',
    lawReference: '5651 sayılı İnternet Ortamında Yapılan Yayınlar Kanunu',
    companyChecks: [{ id: 'legal_title' }],
    requiredItems: [
      {
        label: 'Yapay Zekâ Sokratik Asistan Kullanım Sınırları ve Pedagojik Sorumluluk Reddi',
        weight: 8,
        check: (html) => html.includes('Sokratik') || html.includes('Asistan')
      },
      {
        label: 'Sistem Güvenliğini Bozma ve Bot/Tersine Mühendislik Yasağı',
        weight: 8,
        check: (html) => html.includes('kaynaklarını aşırı') || html.includes('tersine mühendislik') || html.includes('performansını')
      },
      {
        label: 'Fikri Hak İhlalinde Hukuki & Cezai Başvuru Şartı',
        weight: 6,
        check: (html, txt, raw) => html.includes('Fikir ve Sanat Eserleri') || raw.includes('Fikir ve Sanat Eserleri') || html.includes('fikri')
      }
    ],
    kvkkChecks: [
      {
        label: 'Asistan Sorgularında Özel Nitelikli Kişisel Veri Paylaşım Yasağı',
        weight: 6,
        check: (html) => html.includes('zararlı sorgular') || html.includes('özel veri') || html.includes('pedagojik amaç')
      }
    ],
    contradictionChecks: [
      {
        check: (html) => {
          if (html.includes('sorumlu tutulamaz') && !html.includes('azami özeni gösterir')) {
            return 'Sorumsuzluk kaydı orantısız tutulmuş; TKHK m.5 gereği Sağlayıcı makul teknik altyapıyı sağlama taahhüdü eklemelidir.';
          }
          return null;
        }
      }
    ],
    recommendationRules: [
      {
        check: () => 'Kullanım şartları 3 maddeden ibarettir; hesap güvenliği, üçüncü şahıs bağlantıları ve içerik moderasyon kuralları ile genişletilmelidir.'
      }
    ]
  },

  // 3. GİZLİLİK POLİTİKASI
  {
    id: 'gizlilik-politikasi',
    title: 'Gizlilik Politikası',
    lawReference: '6698 sayılı KVKK m.4 & ISO 27001 Bilgi Güvenliği',
    companyChecks: [{ id: 'legal_title' }, { id: 'email' }],
    requiredItems: [
      {
        label: 'İşlenen Kişisel Veri Kategorilerinin Detaylı Dökümü',
        weight: 8,
        check: (html) => html.includes('ad, soyad, e-posta') || html.includes('Toplanan Veriler')
      },
      {
        label: 'Veri Güvenliği, Şifreleme ve Altyapı Standartları (TLS/Bcrypt)',
        weight: 8,
        check: (html) => html.includes('bcrypt') || html.includes('TLS') || html.includes('şifrelen')
      },
      {
        label: 'Veri Saklama Süreleri ve Periyodik İmha Politikası',
        weight: 8,
        check: (html) => html.includes('saklama süresi') || html.includes('imha') || html.includes('mevzuata uygun')
      }
    ],
    kvkkChecks: [
      {
        label: 'Yurtdışı Bulut ve Altyapı Barındırma Aktarım Beyanı (Cloudflare, R2, Gemini vb.)',
        weight: 8,
        check: (html) => html.includes('bulut') || html.includes('yurtdışı') || html.includes('aktarılmaz')
      },
      {
        label: 'Öğrenci Performans Verilerinin Yalnız Yetkili Veli ve Öğretmenle Paylaşımı',
        weight: 6,
        check: (html) => html.includes('öğretmeninde') && html.includes('velisinde')
      }
    ],
    contradictionChecks: [
      {
        check: (html) => {
          if (html.includes('Üçüncü şahıslara veya reklam verenlere ticari amaçla aktarılmaz') && !html.includes('teknik altyapı')) {
            return '"Ticari amaçla aktarılmaz" ifadesine barındırma/altyapı sağlayıcıları (Cloudflare, MongoDB) için veri işleyen istisnası açıklığı getirilmelidir.';
          }
          return null;
        }
      }
    ],
    recommendationRules: [
      {
        check: () => 'Cloudflare, Cloudinary, AWS S3/R2 ve Gemini API kullanımı nedeniyle Gizlilik Politikası\'nda yurtdışı teknik hizmet sağlayıcıları açıkça sayılmalıdır.'
      },
      {
        check: () => 'Log kayıtlarının 5651 sayılı kanun gereğince 2 yıl saklandığına dair yasal süre bilgisi politikaya eklenmelidir.'
      }
    ]
  },

  // 4. KVKK AYDINLATMA METNİ
  {
    id: 'kvkk-aydinlatma',
    title: 'KVKK Aydınlatma Metni',
    lawReference: '6698 sayılı KVKK m.10 & Aydınlatma Yükümlülüğü Tebliği',
    companyChecks: [{ id: 'legal_title' }, { id: 'email' }, { id: 'address' }, { id: 'mersis' }, { id: 'tax' }],
    requiredItems: [
      {
        label: 'Veri Sorumlusu Tüzel Kişilik ve İrtibat Bilgileri',
        weight: 8,
        check: (html) => html.includes('Veri Sorumlusu') && html.includes('ZarifÇözüm')
      },
      {
        label: 'Kişisel Verilerin İşlenme Hukuki Sebepleri (m.5/2-c, ç, f)',
        weight: 8,
        check: (html) => html.includes('hukuki sebep') || html.includes('kanun') || html.includes('meşru menfaat') || html.includes('sözleşmenin kurulması')
      },
      {
        label: 'Verilerin Hangi Amaçlarla Kimlere Aktarılabileceği (m.10/c)',
        weight: 6,
        check: (html) => html.includes('aktarıl') || html.includes('üçüncü kişi') || html.includes('resmi makam')
      },
      {
        label: 'KVKK m.11 İlgili Kişi Hakları Listesi (Eksiksiz 8 Fıkra)',
        weight: 8,
        check: (html) => html.includes('Madde 11') || html.includes('11. madde')
      },
      {
        label: 'Veri Sorumlusuna Başvuru Usul ve Esasları (Yazılı / KEP / E-posta)',
        weight: 8,
        check: (html) => html.includes('başvuru') && (html.includes('kep') || html.includes('yazılı') || html.includes('e-posta'))
      }
    ],
    kvkkChecks: [
      {
        label: 'Başvuruya 30 Gün İçinde Ücretsiz Cevap Verilme Yükümlülüğü',
        weight: 6,
        check: (html) => html.includes('30 gün') || html.includes('otuz gün')
      },
      {
        label: 'VERBİS Kayıt Yükümlülüğü / İstisna Durumu Bilgilendirmesi',
        weight: 4,
        check: (html) => html.includes('verbis') || html.includes('sicil')
      }
    ],
    contradictionChecks: [
      {
        check: (html) => {
          if (!html.includes('otomatik sistemler vasıtasıyla') && html.includes('11. maddesi')) {
            return 'Madde 11 hakları dökümünde "münhasıran otomatik sistemler vasıtasıyla analiz edilmesine itiraz" ve "zararın tazmini" hakları metinde eksiktir.';
          }
          return null;
        }
      }
    ],
    recommendationRules: [
      {
        check: () => 'Aydınlatma metnine Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ gereğince KEP adresi veya güvenli elektronik imzalı başvuru kanalları eklenmelidir.'
      },
      {
        check: () => 'Kişisel veri toplama yöntemi (web sitesi formları, çerezler, log kayıtları) ve m.5 hukuki sebepleri fıkra fıkra eşleştirilmelidir.'
      }
    ]
  },

  // 5. ÇEREZ POLİTİKASI
  {
    id: 'cerez-politikasi',
    title: 'Çerez Politikası ve Tercihleri',
    lawReference: '6698 sayılı KVKK Çerez Rehberi & 2002/58/EC e-Privacy',
    companyChecks: [{ id: 'legal_title' }, { id: 'email' }],
    requiredItems: [
      {
        label: 'Zorunlu Oturum Çerezi (zarifcozum.sid, HttpOnly, SameSite) Tanımı',
        weight: 8,
        check: (html) => html.includes('zarifcozum.sid') && html.includes('HttpOnly')
      },
      {
        label: 'Çerez Türleri Tablosu (Ad, Sağlayıcı, Tür, Saklama Süresi)',
        weight: 8,
        check: (html) => html.includes('Zorunlu Çerezler') && html.includes('Analitik')
      },
      {
        label: 'İnteraktif Çerez Tercihleri Formu ve Ret Butonu',
        weight: 8,
        check: (html) => html.includes('data-cookie-preferences') && html.includes('data-cookie-reject')
      }
    ],
    kvkkChecks: [
      {
        label: 'Analitik ve Pazarlama Çerezlerinin Açık Rızaya Dayandırılması',
        weight: 6,
        check: (html) => html.includes('isteğe bağlı') || html.includes('Tercihleri')
      }
    ],
    contradictionChecks: [],
    recommendationRules: [
      {
        check: () => 'Sitede kullanılan spesifik analitik çerezlerin (_ga, _gid vb.) saklama ömürlerini gösteren sabit bir HTML tablosu eklenmelidir.'
      }
    ]
  },

  // 6. AÇIK RIZA METNİ
  {
    id: 'acik-riza',
    title: 'Açık Rıza Metni',
    lawReference: '6698 sayılı KVKK m.3/1-a & m.5/1 (Belirli konu, bilgilendirme, özgür irade)',
    companyChecks: [{ id: 'legal_title' }, { id: 'email' }],
    requiredItems: [
      {
        label: 'Hizmet Şartı Olmama İlkesi (Hizmetin Açık Rızaya Bağlanmaması)',
        weight: 10,
        check: (html) => html.includes('ön şart değildir') || html.includes('özgür irade')
      },
      {
        label: 'Rızanın Konusu Olan İletişim Kanalları (SMS, E-posta, Bildirim)',
        weight: 8,
        check: (html) => html.includes('hatırlatma') || html.includes('duyuru') || html.includes('bülten')
      },
      {
        label: 'Açık Rızayı Her Zaman Kolayca Geri Alma Hakkı Usulü',
        weight: 8,
        check: (html) => html.includes('geri alınabilir') || html.includes('iptal')
      }
    ],
    kvkkChecks: [
      {
        label: 'Torba Rıza Yasağı Uyarınca Ticari İleti ve Yurtdışı Aktarım Rızalarının Ayrılması',
        weight: 8,
        check: (html) => html.includes('canlı ders') || html.includes('bülten')
      }
    ],
    contradictionChecks: [],
    recommendationRules: [
      {
        check: () => 'Ticari elektronik ileti onayı ile yurtdışı bulut aktarım açık rızası tek metinde birleştirilmemeli; iki ayrı onay kutucuğu halinde sunulmalıdır.'
      },
      {
        check: () => 'Elektronik Ticaret Kanunu gereği İleti Yönetim Sistemi (İYS) onay/ret mekanizmasına atıf yapılmalıdır.'
      }
    ]
  },

  // 7. ÖN BİLGİLENDİRME FORMU
  {
    id: 'on-bilgilendirme',
    title: 'Ön Bilgilendirme Formu',
    lawReference: '6502 sayılı TKHK & Mesafeli Sözleşmeler Yönetmeliği m.5-7',
    companyChecks: [{ id: 'legal_title' }, { id: 'address' }, { id: 'email' }, { id: 'mersis' }],
    requiredItems: [
      {
        label: 'Hizmetin Temel Nitelikleri ve Dijital İfa Şekli',
        weight: 8,
        check: (html) => html.includes('anında ifa') || html.includes('dijital')
      },
      {
        label: 'Paket Bedeli, Vergiler (KDV) ve Ek Masraflar Bilgisi',
        weight: 8,
        check: (html) => html.includes('KDV') || html.includes('Toplam Bedel')
      },
      {
        label: 'Cayma Hakkı ve Dijital İçeriklerde İstisna Açıklaması',
        weight: 8,
        check: (html) => html.includes('cayma hakkı') || html.includes('istisna')
      },
      {
        label: 'Şikayet ve İtirazların İletileceği Merci / Müşteri Hizmetleri',
        weight: 6,
        check: (html, txt, raw) => html.includes('destek@zarifcozum.com') || raw.includes('destek@zarifcozum.com')
      }
    ],
    kvkkChecks: [],
    contradictionChecks: [
      {
        check: (html) => {
          if (!html.includes('15. madde') && !html.includes('Mesafeli')) {
            return 'Mesafeli Sözleşmeler Yönetmeliği m.15/ğ istisnası Ön Bilgilendirme Formu\'nda kanuni madde atfıyla yer almalıdır.';
          }
          return null;
        }
      }
    ],
    recommendationRules: [
      {
        check: () => 'Ön Bilgilendirme Formu Mesafeli Sözleşmeler Yönetmeliği m.5 uyarınca Satıcının MERSİS no, tescilli adresi ve telefonunu zorunlu olarak içermelidir.'
      }
    ]
  },

  // 8. MESAFELİ SATIŞ SÖZLEŞMESİ
  {
    id: 'mesafeli-satis',
    title: 'Mesafeli Satış Sözleşmesi',
    lawReference: '6502 sayılı TKHK m.48 & Mesafeli Sözleşmeler Yönetmeliği',
    companyChecks: [{ id: 'legal_title' }, { id: 'address' }, { id: 'email' }, { id: 'mersis' }, { id: 'tax' }],
    requiredItems: [
      {
        label: 'Taraflar: Satıcı (Sağlayıcı) ve Alıcı (Tüketici) Bilgileri',
        weight: 8,
        check: (html) => html.includes('Satıcı') && html.includes('Alıcı')
      },
      {
        label: 'Sözleşmenin Konusu, Kapsamı ve Dijital Teslimat Esası',
        weight: 8,
        check: (html) => html.includes('Sözleşmenin Konusu') || html.includes('Teslimat')
      },
      {
        label: 'Ödeme Şekli, Güvenlik ve Anında İfa Koşulu',
        weight: 8,
        check: (html) => html.includes('Ödeme tamamlandığı anda') || html.includes('hesabına tanımlanır')
      },
      {
        label: 'Uyuşmazlık Çözümü: Tüketici Hakem Heyetleri ve Tüketici Mahkemeleri',
        weight: 6,
        check: (html, txt, raw) => html.includes('Tüketici Hakem Heyetleri') || raw.includes('Tüketici Hakem Heyetleri')
      }
    ],
    kvkkChecks: [],
    contradictionChecks: [
      {
        check: (html) => {
          if ((html.match(/<article/gi) || []).length <= 1) {
            return 'Mesafeli Satış Sözleşmesi yalnızca 1 maddeden oluşmaktadır; 6502 sayılı Kanun asgari sözleşme şartlarını karşılayacak şekilde maddeler ayrıştırılmalıdır.';
          }
          return null;
        }
      }
    ],
    recommendationRules: [
      {
        check: () => 'Mesafeli Satış Sözleşmesine Alıcı Ad/Soyad, TCKN, adres ve fatura bilgisi placeholder/şablon parametreleri entegre edilmelidir.'
      },
      {
        check: () => 'Temerrüt hali, ifanın imkansızlaşması ve mücbir sebep hükümleri sözleşmeye eklenmelidir.'
      }
    ]
  },

  // 9. İPTAL VE İADE POLİTİKASI
  {
    id: 'iptal-iade',
    title: 'İptal ve İade Politikası',
    lawReference: 'Mesafeli Sözleşmeler Yönetmeliği m.15/ğ (Cayma Hakkı İstisnası)',
    companyChecks: [{ id: 'legal_title' }, { id: 'email' }],
    requiredItems: [
      {
        label: 'Elektronik Ortamda Anında İfa Edilen Hizmetlerde Cayma Hakkı İstisnası (m.15/ğ)',
        weight: 10,
        check: (html) => html.includes('15. maddesinin (ğ) bendi') || html.includes('cayma hakkını kullanamaz')
      },
      {
        label: 'Müşteri Memnuniyeti Kapsamında 48 Saatlik İstisnai İade Şartları',
        weight: 8,
        check: (html) => html.includes('48 saat') && html.includes('istisnai iade')
      },
      {
        label: 'İade Başvuru Prosedürü ve Geri Ödeme Süresi (İş Günü)',
        weight: 6,
        check: (html, txt, raw) => html.includes('destek@zarifcozum.com') || raw.includes('destek@zarifcozum.com') || html.includes('gün')
      }
    ],
    kvkkChecks: [],
    contradictionChecks: [],
    recommendationRules: [
      {
        check: () => 'Onaylanan iadelerin kredi kartı / banka hesabına kaç iş günü içinde (azami 14 gün) yansıyacağı net olarak belirtilmelidir.'
      }
    ]
  }
];

async function runLegalDocumentsAudit(customHtml = null) {
  const html = customHtml !== null ? customHtml : safeReadFile('yasal.html');
  const contactSectionHtml = extractSectionContent(html, 'iletisim');

  const documents = DOCUMENT_DEFINITIONS.map(def => {
    const sectionHtml = extractSectionContent(html, def.id);
    return auditSingleDocument(def, sectionHtml, html);
  });

  const totalScore = documents.reduce((sum, d) => sum + d.score, 0);
  const averageScore = Math.round(totalScore / documents.length);

  const totalMissing = documents.reduce((sum, d) => sum + d.missingFields.length, 0);
  const totalPlaceholders = documents.reduce((sum, d) => sum + d.placeholders.length, 0);
  const totalCompanyNeeded = documents.reduce((sum, d) => sum + d.companyInfoRequired.length, 0);
  const totalKvkkIssues = documents.reduce((sum, d) => sum + d.kvkkIssues.length, 0);
  const totalContradictions = documents.reduce((sum, d) => sum + d.contradictions.length, 0);

  let overallStatus = 'compliant';
  let overallStatusLabel = '✅ Uyumlu';
  if (averageScore < 70) {
    overallStatus = 'non_compliant';
    overallStatusLabel = '❌ Riskli / Eksik';
  } else if (averageScore < 85 || totalMissing > 0 || totalPlaceholders > 0 || totalCompanyNeeded > 0) {
    overallStatus = 'partial';
    overallStatusLabel = '⚠️ Kısmen Uyumlu';
  }

  // Konsolide Öncelikli Tavsiyeler
  const prioritizedRecommendations = [
    'Şirket Künyesi: Yasal belgelerdeki "ZarifÇözüm Eğitim Teknolojileri" marka ibaresi yanına tam ticaret sicil unvanı, MERSİS no ve Vergi Kimlik No eklenmelidir.',
    'Mesafeli Satış Sözleşmesi: 1 maddeden oluşan metin, 6502 sayılı Kanun ve Yönetmelik uyarınca en az 6-8 maddelik tam sözleşme formatına genişletilmelidir.',
    'KVKK m.10 & m.11: Kişisel verilerin işlenme hukuki sebepleri (m.5/2) fıkra bazında listelenmeli, KEP veya noter yoluyla başvuru usulü Aydınlatma Metnine eklenmelidir.',
    'Çerez Tablosu: Sitede kullanılan çerezlerin sağlayıcıları ve saklama ömürlerini içeren detaylı tablo Çerez Politikası metnine yerleştirilmelidir.',
    'Açık Rıza: Ticari elektronik ileti (SMS/E-posta) onayı ile yurtdışı bulut aktarım açık rızası iki ayrı onay kutusu ile birbirinden ayrılmalıdır.'
  ];

  return {
    timestamp: new Date(),
    score: averageScore,
    status: overallStatus,
    statusLabel: overallStatusLabel,
    summary: averageScore >= 85
      ? 'Yasal metinler ve sözleşmeler mevzuat standartlarını yüksek oranda karşılamaktadır.'
      : averageScore >= 70
        ? `Yasal metinlerde giderilmesi gereken ${totalMissing} eksik alan, ${totalCompanyNeeded} şirket bilgisi ve ${totalPlaceholders} placeholder tespit edildi.`
        : 'Sözleşme ve aydınlatma metinlerinde tüketici ve KVKK mevzuatı açısından acil düzeltme gerektiren eksiklikler bulunmaktadır.',
    stats: {
      totalDocuments: documents.length,
      averageScore,
      totalMissing,
      totalPlaceholders,
      totalCompanyNeeded,
      totalKvkkIssues,
      totalContradictions
    },
    documents,
    recommendations: prioritizedRecommendations
  };
}

module.exports = {
  DOCUMENT_DEFINITIONS,
  runLegalDocumentsAudit
};
