import argparse
import json
import sys
from pathlib import Path

import pymupdf


def sayfalari_gorsele_cevir(pdf_yolu, cikti_klasoru, baslangic=1, bitis=None, dpi=150):
    with pymupdf.open(pdf_yolu) as belge:
        toplam = len(belge)
        bas = max(1, baslangic)
        son = min(toplam, bitis if bitis is not None else toplam)
        if bas > son:
            raise ValueError(f"Geçersiz sayfa aralığı: {bas}-{son} (toplam {toplam})")

        cikti_klasoru.mkdir(parents=True, exist_ok=True)
        sayfalar = []
        matris = pymupdf.Matrix(dpi / 72, dpi / 72)

        for sayfa_no in range(bas, son + 1):
            sayfa = belge[sayfa_no - 1]
            pix = sayfa.get_pixmap(matrix=matris, alpha=False)
            hedef = cikti_klasoru / f"sayfa-{sayfa_no:04d}.png"
            pix.save(str(hedef))
            sayfalar.append({"page": sayfa_no, "image_path": str(hedef)})

        return {"total_pages": toplam, "pages": sayfalar}


def main():
    parser = argparse.ArgumentParser(description="Ders kitabı PDF sayfalarını PNG görseline çevirir.")
    parser.add_argument("pdf", type=Path, help="PDF dosya yolu")
    parser.add_argument("cikti", type=Path, help="PNG çıktı klasörü")
    parser.add_argument("--baslangic", type=int, default=1, help="Başlangıç sayfa numarası (1 tabanlı)")
    parser.add_argument("--bitis", type=int, default=None, help="Bitiş sayfa numarası")
    parser.add_argument("--dpi", type=int, default=150, help="Çözünürlük (varsayılan 150 DPI)")
    args = parser.parse_args()

    if not args.pdf.is_file():
        print(f"PDF bulunamadı: {args.pdf}", file=sys.stderr)
        return 1

    sonuc = sayfalari_gorsele_cevir(args.pdf, args.cikti, args.baslangic, args.bitis, args.dpi)
    print(json.dumps(sonuc, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
