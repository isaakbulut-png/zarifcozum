import argparse
import json
import os
import sys
from pathlib import Path

import pymupdf


def donustur(pdf_yolu, kaynak, cikti_yolu):
    with pymupdf.open(pdf_yolu) as belge:
        sayfalar = []
        bos_sayfalar = []
        for numara, sayfa in enumerate(belge, start=1):
            metin = sayfa.get_text("text", sort=True)
            sayfalar.append({"sayfa": numara, "icerik": metin})
            if not metin.strip():
                bos_sayfalar.append(numara)

        veri = {
            "kaynak_dosya": str(pdf_yolu.relative_to(kaynak)),
            "toplam_sayfa": len(belge),
            "yer_imleri": belge.get_toc(),
            "sayfalar": sayfalar,
        }

    cikti_yolu.parent.mkdir(parents=True, exist_ok=True)
    with cikti_yolu.open("x", encoding="utf-8") as dosya:
        json.dump(veri, dosya, ensure_ascii=False, indent=2)
    if bos_sayfalar:
        print(
            f"Uyarı: {pdf_yolu} metin çıkarılamayan sayfalar: "
            f"{', '.join(map(str, bos_sayfalar))}. OCR veya görsel inceleme gerekebilir.",
            file=sys.stderr,
        )


def main():
    parser = argparse.ArgumentParser(
        description="Bir klasörün altındaki PDF dosyalarını sayfa bazında JSON'a dönüştürür."
    )
    parser.add_argument("kaynak", type=Path, help="PDF dosyalarını içeren ana klasör")
    parser.add_argument("cikti", type=Path, help="JSON dosyalarının kaydedileceği klasör")
    args = parser.parse_args()
    kaynak = args.kaynak.resolve()
    cikti = args.cikti.resolve()

    if not kaynak.is_dir():
        parser.error(f"Kaynak klasör bulunamadı: {kaynak}")
    pdfler = sorted(p for p in kaynak.rglob("*") if p.is_file() and p.suffix.lower() == ".pdf")
    if not pdfler:
        parser.error(f"Kaynak klasörde PDF bulunamadı: {kaynak}")

    hedefler = [(pdf, cikti / pdf.relative_to(kaynak).with_suffix(".json")) for pdf in pdfler]
    anahtarlar = [os.path.normcase(str(hedef)) for _, hedef in hedefler]
    if len(set(anahtarlar)) != len(anahtarlar):
        parser.error("Birden fazla PDF aynı JSON dosyasına karşılık geliyor.")
    mevcut = [hedef for _, hedef in hedefler if hedef.exists()]
    if mevcut:
        parser.error(f"Mevcut JSON dosyaları üzerine yazılmaz. İlk mevcut dosya: {mevcut[0]}")

    for pdf, hedef in hedefler:
        try:
            donustur(pdf, kaynak, hedef)
        except (OSError, RuntimeError, ValueError) as hata:
            print(f"Hata: {pdf} dönüştürülemedi: {hata}", file=sys.stderr)
            return 1
        print(f"Dönüştürüldü: {hedef}")

    print(f"Tamamlandı: {len(hedefler)} PDF dönüştürüldü.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
