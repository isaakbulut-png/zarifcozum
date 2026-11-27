const zlib = require('zlib');

// CRC32 table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function calculateCrc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function createZipArchive(entries) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const entry of entries) {
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8');
    const compressed = zlib.deflateRawSync(data);
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const crc = calculateCrc32(data);

    const lh = Buffer.alloc(30 + nameBuf.length);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(0, 10);
    lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(compressed.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    nameBuf.copy(lh, 30);

    localHeaders.push(lh, compressed);

    const cd = Buffer.alloc(46 + nameBuf.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(compressed.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    nameBuf.copy(cd, 46);

    centralHeaders.push(cd);
    offset += lh.length + compressed.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const cd of centralHeaders) centralDirSize += cd.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

function sanitizeTextForPdf(str) {
  if (!str) return '';
  return String(str)
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/ö/g, 'o').replace(/Ö/g, 'O')
    .replace(/ç/g, 'c').replace(/Ç/g, 'C')
    .replace(/[()\\]/g, '\\$&')
    .replace(/[\r\n]+/g, ' ');
}

function generateStandardPdf(title, subtitle, lines = []) {
  const contentStream = [
    'BT',
    '/F2 16 Tf',
    '50 800 Td',
    `(${sanitizeTextForPdf('ZarifCozum - Maarif Modeli Icerik Havuzu')}) Tj`,
    '/F1 14 Tf',
    '0 -24 Td',
    `(${sanitizeTextForPdf(title)}) Tj`,
    '/F1 10 Tf',
    '0 -18 Td',
    `(${sanitizeTextForPdf(subtitle || new Date().toLocaleDateString('tr-TR'))}) Tj`,
    '0 -20 Td'
  ];

  let currentY = 738;
  const pageObjects = [];
  let currentPageStream = [...contentStream];

  for (const line of lines) {
    if (currentY < 60) {
      // Yeni sayfa başlat
      currentPageStream.push('ET');
      pageObjects.push(currentPageStream.join('\n'));
      currentPageStream = [
        'BT',
        '/F2 12 Tf',
        '50 800 Td',
        `(${sanitizeTextForPdf(title)} - Devam) Tj`,
        '/F1 10 Tf',
        '0 -20 Td'
      ];
      currentY = 780;
    }

    const isHeader = line.startsWith('###') || line.startsWith('Soru ');
    const font = isHeader ? '/F2 11 Tf' : '/F1 10 Tf';
    currentPageStream.push(font);
    currentPageStream.push(`(${sanitizeTextForPdf(line)}) Tj`);
    currentPageStream.push('0 -15 Td');
    currentY -= 15;
  }

  currentPageStream.push('ET');
  pageObjects.push(currentPageStream.join('\n'));

  // PDF objeleri oluştur
  const objects = [];
  const kids = [];

  // 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');

  let objIdx = 3;
  const pageIndices = [];
  const contentIndices = [];

  for (let i = 0; i < pageObjects.length; i++) {
    const pageObjId = objIdx++;
    const contentObjId = objIdx++;
    pageIndices.push(pageObjId);
    contentIndices.push(contentObjId);
    kids.push(`${pageObjId} 0 R`);
  }

  const fontObjId1 = objIdx++;
  const fontObjId2 = objIdx++;

  // 2: Pages
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pageObjects.length} >>\nendobj`);

  for (let i = 0; i < pageObjects.length; i++) {
    const pageId = pageIndices[i];
    const contentId = contentIndices[i];
    const streamData = pageObjects[i];

    objects.push(`${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontObjId1} 0 R /F2 ${fontObjId2} 0 R >> >> >>\nendobj`);
    objects.push(`${contentId} 0 obj\n<< /Length ${Buffer.byteLength(streamData)} >>\nstream\n${streamData}\nendstream\nendobj`);
  }

  objects.push(`${fontObjId1} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);
  objects.push(`${fontObjId2} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj`);

  // Xref ve Trailer
  let offset = 0;
  const header = '%PDF-1.4\n';
  offset += Buffer.byteLength(header);

  const xref = [`xref\n0 ${objects.length + 1}\n0000000000 65535 f `];
  const body = [];

  for (const obj of objects) {
    xref.push(String(offset).padStart(10, '0') + ' 00000 n ');
    body.push(obj);
    offset += Buffer.byteLength(obj) + 1;
  }

  const xrefOffset = offset;
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(header + body.join('\n') + '\n' + xref.join('\n') + '\n' + trailer);
}

function xmlEscape(str) {
  if (!str) return '';
  return String(str).replace(/[<>&'"]/g, c => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;'
  }[c]));
}

function generateStandardDocx(title, subtitle, paragraphs = []) {
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const pXmls = paragraphs.map(p => {
    const isHeading = p.startsWith('###') || p.startsWith('Soru ');
    const cleanText = p.replace(/^###\s*/, '');
    return `
    <w:p>
      <w:pPr>
        ${isHeading ? '<w:pStyle w:val="Heading2"/><w:spacing w:before="240" w:after="120"/>' : '<w:spacing w:after="80"/>'}
      </w:pPr>
      <w:r>
        <w:rPr>
          ${isHeading ? '<w:b/><w:sz w:val="26"/><w:color w:val="1E293B"/>' : '<w:sz w:val="22"/><w:color w:val="334155"/>'}
        </w:rPr>
        <w:t xml:space="preserve">${xmlEscape(cleanText)}</w:t>
      </w:r>
    </w:p>`;
  }).join('');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="100"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="20"/><w:color w:val="64748B"/></w:rPr><w:t>ZarifÇözüm — Türkiye Yüzyılı Maarif Modeli</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="160"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="34"/><w:color w:val="0F172A"/></w:rPr><w:t>${xmlEscape(title)}</w:t></w:r>
    </w:p>
    ${subtitle ? `
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="280"/></w:pPr>
      <w:r><w:rPr><w:i/><w:sz w:val="22"/><w:color w:val="475569"/></w:rPr><w:t>${xmlEscape(subtitle)}</w:t></w:r>
    </w:p>` : ''}
    ${pXmls}
  </w:body>
</w:document>`;

  return createZipArchive([
    { name: '[Content_Types].xml', data: contentTypesXml },
    { name: '_rels/.rels', data: relsXml },
    { name: 'word/document.xml', data: documentXml }
  ]);
}

function latexToUnicode(str) {
  if (!str || typeof str !== 'string') return '';
  let s = str;

  // 1. Dolar işaretlerini kaldır ($ ... $ veya $$ ... $$)
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, '$1');
  s = s.replace(/\$([^$]+)\$/g, '$1');

  // 2. Geometrik ve mantıksal semboller
  s = s.replace(/\\perp\b/g, '⊥');
  s = s.replace(/\\parallel\b/g, '∥');
  s = s.replace(/\\angle\b/g, '∠');
  s = s.replace(/\\widehat\{([^}]+)\}/g, '$1̂');
  s = s.replace(/\\overline\{([^}]+)\}/g, '$1̅');
  s = s.replace(/\\circ\b|\\degree\b|\^\\circ\b/g, '°');
  s = s.replace(/\^\{\\circ\}/g, '°');
  s = s.replace(/\\cdot\b/g, '·');
  s = s.replace(/\\times\b/g, '×');
  s = s.replace(/\\div\b/g, '÷');
  s = s.replace(/\\leq\b|\\le\b/g, '≤');
  s = s.replace(/\\geq\b|\\ge\b/g, '≥');
  s = s.replace(/\\neq\b/g, '≠');
  s = s.replace(/\\approx\b/g, '≈');
  s = s.replace(/\\pm\b/g, '±');
  s = s.replace(/\\mp\b/g, '∓');
  s = s.replace(/\\infty\b/g, '∞');
  s = s.replace(/\\in\b/g, '∈');
  s = s.replace(/\\subset\b/g, '⊂');
  s = s.replace(/\\cup\b/g, '∪');
  s = s.replace(/\\cap\b/g, '∩');

  // 3. Kesir ve Kök
  s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1/$2)');
  s = s.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');
  s = s.replace(/\\sqrt\s*([0-9a-zA-Z]+)/g, '√$1');

  // 4. Yunan Harfleri
  s = s.replace(/\\alpha\b/g, 'α');
  s = s.replace(/\\beta\b/g, 'β');
  s = s.replace(/\\theta\b/g, 'θ');
  s = s.replace(/\\pi\b/g, 'π');
  s = s.replace(/\\delta\b/g, 'δ');
  s = s.replace(/\\Delta\b/g, 'Δ');
  s = s.replace(/\\sigma\b/g, 'σ');
  s = s.replace(/\\lambda\b/g, 'λ');

  // 5. Üslü İfadeler (Unicode)
  const supMap = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
    'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ',
    'n': 'ⁿ', 'x': 'ˣ', 'y': 'ʸ', 'k': 'ᵏ'
  };
  s = s.replace(/\^\{([^}]+)\}/g, (_, exp) => {
    return exp.split('').map(c => supMap[c] || c).join('');
  });
  s = s.replace(/\^([0-9a-zA-Z+-])/g, (_, c) => supMap[c] || `^${c}`);

  // 6. Alt İndisler (Unicode)
  const subMap = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
    'a': 'ₐ', 'e': 'ₑ', 'i': 'ᵢ', 'j': 'ⱼ', 'k': 'ₖ',
    'n': 'ₙ', 'm': 'ₘ', 'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ',
    't': 'ₜ', 'u': 'ᵤ', 'v': 'ᵥ', 'x': 'ₓ', 'K': 'ₖ',
    'A': 'ₐ', 'B': 'ᵦ'
  };
  s = s.replace(/_\{([^}]+)\}/g, (_, sub) => {
    return sub.split('').map(c => subMap[c] || c).join('');
  });
  s = s.replace(/_([0-9a-zA-Z])/g, (_, c) => subMap[c] || `_${c}`);

  // 7. Artakalan tekil ters eğik çizgileri temizle
  s = s.replace(/\\([a-zA-Z]+)/g, '$1');

  return s;
}

function exportQuestions(questions = [], options = {}) {
  const title = options.title || 'Soru Kitapçığı ve Çalışma Kağıdı';
  const subtitle = `${options.grade ? options.grade + '. Sınıf ' : ''}${options.topic || ''} ${options.difficulty ? '(' + options.difficulty + ')' : ''}`;

  const lines = [];
  const answerKey = [];

  questions.forEach((q, idx) => {
    const qNum = idx + 1;
    lines.push(`Soru ${qNum}: ${latexToUnicode(q.text || '')}`);

    if (q.options) {
      if (Array.isArray(q.options)) {
        q.options.forEach(opt => {
          lines.push(`  ${opt.label || opt.key || ''}) ${latexToUnicode(opt.text || opt.value || opt)}`);
        });
      } else if (typeof q.options === 'object') {
        ['A', 'B', 'C', 'D'].forEach(letter => {
          if (q.options[letter] !== undefined) {
            lines.push(`  ${letter}) ${latexToUnicode(q.options[letter])}`);
          }
        });
      }
    }

    if (q.answer) answerKey.push(`Soru ${qNum}: ${latexToUnicode(q.answer)}`);
    lines.push(''); // boşluk
  });

  if (answerKey.length > 0) {
    lines.push('### CEVAP ANAHTARI');
    lines.push(answerKey.join('  |  '));
  }

  const format = String(options.format || 'pdf').toLowerCase();
  if (format === 'docx') {
    return generateStandardDocx(title, subtitle, lines);
  }
  return generateStandardPdf(title, subtitle, lines);
}

function exportContentItems(items = [], options = {}) {
  const title = options.title || 'Merkezi İçerik Havuzu Dokümanı';
  const subtitle = `Dışa Aktarma Tarihi: ${new Date().toLocaleDateString('tr-TR')}`;

  const lines = [];
  items.forEach((item, idx) => {
    lines.push(`### ${idx + 1}. ${latexToUnicode(item.title || 'İçerik Başlığı')}`);
    lines.push(`Tür: ${item.type || item.contentType || 'Belge'} | Sınıf: ${item.grade || '-'}. Sınıf | Konu: ${latexToUnicode(item.topic || '-')}`);

    if (typeof item.content === 'string') {
      lines.push(latexToUnicode(item.content));
    } else if (item.content && Array.isArray(item.content.questions)) {
      item.content.questions.forEach((q, qIdx) => {
        lines.push(`  Soru ${qIdx + 1}: ${latexToUnicode(q.text || '')}`);
        if (q.options) {
          if (Array.isArray(q.options)) {
            q.options.forEach(o => lines.push(`    ${o.label || o.key || ''}) ${latexToUnicode(o.text || o.value || o)}`));
          } else if (typeof q.options === 'object') {
            ['A', 'B', 'C', 'D'].forEach(letter => {
              if (q.options[letter] !== undefined) {
                lines.push(`    ${letter}) ${latexToUnicode(q.options[letter])}`);
              }
            });
          }
        }
        if (q.answer) lines.push(`    Doğru Cevap: ${latexToUnicode(q.answer)}`);
        if (q.explanation) lines.push(`    Açıklama: ${latexToUnicode(q.explanation)}`);
      });
    } else if (item.content && typeof item.content === 'object') {
      if (item.content.text) {
        lines.push(`  Soru: ${latexToUnicode(item.content.text)}`);
        if (item.content.options) {
          if (Array.isArray(item.content.options)) {
            item.content.options.forEach(o => lines.push(`    ${o.label || o.key || ''}) ${latexToUnicode(o.text || o.value || o)}`));
          } else if (typeof item.content.options === 'object') {
            ['A', 'B', 'C', 'D', 'E'].forEach(letter => {
              if (item.content.options[letter] !== undefined) {
                lines.push(`    ${letter}) ${latexToUnicode(item.content.options[letter])}`);
              }
            });
          }
        }
        if (item.content.answer) lines.push(`    Doğru Cevap: ${latexToUnicode(item.content.answer)}`);
        if (item.content.explanation) lines.push(`    Açıklama: ${latexToUnicode(item.content.explanation)}`);
      } else if (item.content.description) {
        lines.push(latexToUnicode(item.content.description));
      } else {
        lines.push(latexToUnicode(JSON.stringify(item.content)));
      }
    }
    lines.push('');
  });

  const format = String(options.format || 'pdf').toLowerCase();
  if (format === 'docx') {
    return generateStandardDocx(title, subtitle, lines);
  }
  return generateStandardPdf(title, subtitle, lines);
}

module.exports = {
  generateStandardPdf,
  generateStandardDocx,
  exportQuestions,
  exportContentItems,
  createZipArchive,
  latexToUnicode
};
