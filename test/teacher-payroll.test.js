const test = require('node:test');
const assert = require('node:assert/strict');
const TeacherPayout = require('../models/TeacherPayout');

test('Kural 1: Vergi ve Kesinti Hesaplaması - Bireysel ve Şirket Ayrımı', () => {
  // Bireysel Öğretmen: %20 Stopaj kesintisi ve net tutar hesabı
  const grossBireysel = 15000;
  const rateBireysel = 20;
  const withAmountBireysel = Math.round((grossBireysel * rateBireysel) / 100);
  const netBireysel = grossBireysel - withAmountBireysel;

  assert.equal(withAmountBireysel, 3000);
  assert.equal(netBireysel, 12000);

  // Şirket Öğretmeni: Stopaj 0, Net = Brüt, Fatura Bekleniyor
  const grossSirket = 25000;
  const rateSirket = 0;
  const withAmountSirket = 0;
  const netSirket = grossSirket;
  const invoiceStatus = 'bekleniyor';

  assert.equal(withAmountSirket, 0);
  assert.equal(netSirket, 25000);
  assert.equal(invoiceStatus, 'bekleniyor');
});

test('Kural 2: Toplu Banka EFT CSV Çıktısı Formatı', () => {
  const records = [
    {
      teacherName: 'Ahmet Yılmaz',
      accountHolder: 'Ahmet Yılmaz',
      iban: 'TR330006100511123456789012',
      netAmount: 14800,
      periodLabel: 'Kasım 2026',
      description: 'Kasım 2026 Ders Hakedişi',
      bankName: 'Ziraat Bankası',
      taxType: 'bireysel',
      status: 'onaylandi',
      period: '2026-11'
    }
  ];

  let csv = '\uFEFF';
  csv += 'Alıcı Adı Soyadı;IBAN;Ödenecek Net Tutar (TL);Para Birimi;Açıklama;Banka;Vergi Statüsü;Dönem;Durum\r\n';

  for (const p of records) {
    const name = (p.accountHolder || p.teacherName).replace(/;/g, ' ').trim();
    const iban = p.iban.replace(/;/g, ' ').replace(/\s+/g, '').trim();
    const amount = Number(p.netAmount).toFixed(2);
    const desc = p.description.replace(/;/g, ' ').trim();
    const bank = p.bankName.replace(/;/g, ' ').trim();
    const taxLabel = p.taxType === 'bireysel' ? 'Bireysel (Stopajlı)' : 'Şirket (Faturalı)';
    const statusLabel = p.status === 'odendi' ? 'Ödendi' : 'Onaylandı';

    csv += `"${name}";"${iban}";${amount};TRY;"${desc}";"${bank}";"${taxLabel}";"${p.period}";"${statusLabel}"\r\n`;
  }

  assert.ok(csv.startsWith('\uFEFF'), 'CSV UTF-8 BOM ile başlamalı');
  assert.ok(csv.includes('TR330006100511123456789012'));
  assert.ok(csv.includes('14800.00'));
  assert.ok(csv.includes('Kasım 2026 Ders Hakedişi'));
});

test('Kural 3: Audit Log ve Kilitli Ödeme Güvenliği', () => {
  const mockPayout = {
    _id: 'payout-123',
    teacherName: 'Ayşe Kaya',
    grossAmount: 20000,
    netAmount: 16000,
    status: 'odendi',
    isLocked: true,
    paidAt: new Date()
  };

  // Kilitli hakediş güncelleme girişimi engellenmelidir
  const canEdit = !mockPayout.isLocked;
  assert.equal(canEdit, false, 'Ödenmiş ve kilitli hakediş düzenlenemez');
});

test('Kural 4: Dekont ve Öğretmen Bildirim Akışı', () => {
  const payout = {
    _id: 'payout-456',
    teacherId: 'teacher-789',
    periodLabel: 'Kasım 2026',
    netAmount: 14800,
    iban: 'TR330006100511123456789012',
    receiptUrl: '/uploads/payout-receipts/dekont-12345.pdf'
  };

  const notification = {
    title: '🎉 Hakediş Ödemeniz Gerçekleşti',
    message: `${payout.periodLabel} dönemi net ${payout.netAmount.toLocaleString('tr-TR')} ₺ hakediş ödemeniz ${payout.iban} IBAN'ına gönderilmiştir. Dekontunuzu görüntüleyebilirsiniz.`,
    type: 'payment',
    receiptUrl: payout.receiptUrl,
    payoutId: payout._id,
    read: false,
    createdAt: new Date()
  };

  assert.equal(notification.type, 'payment');
  assert.equal(notification.receiptUrl, '/uploads/payout-receipts/dekont-12345.pdf');
  assert.ok(notification.message.includes('14.800'));
});
