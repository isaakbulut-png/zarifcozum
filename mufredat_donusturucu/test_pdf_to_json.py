import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import pymupdf


SCRIPT = Path(__file__).with_name("pdf_to_json.py")


class PdfToJsonTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "kaynak"
        self.output = self.root / "cikti"
        self.source.mkdir()

    def pdf_olustur(self, relative_path, text):
        path = self.source / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        with pymupdf.open() as doc:
            page = doc.new_page()
            page.insert_text((50, 50), text)
            doc.save(path)
        return path

    def calistir(self):
        return subprocess.run(
            [sys.executable, "-X", "utf8", str(SCRIPT), str(self.source), str(self.output)],
            capture_output=True,
            text=True,
            encoding="utf-8",
        )

    def test_alt_klasorler_ve_tam_sayfa_metni_korunur(self):
        pdf = self.pdf_olustur(Path("5.SINIF") / "konu.pdf", "Birinci sayfa")
        self.pdf_olustur(Path("6.SINIF") / "konu.PDF", "Ikinci kaynak")
        sonuc = self.calistir()
        self.assertEqual(sonuc.returncode, 0, sonuc.stderr)
        veri = json.loads((self.output / "5.SINIF" / "konu.json").read_text(encoding="utf-8"))
        with pymupdf.open(pdf) as doc:
            self.assertEqual(veri["sayfalar"][0]["icerik"], doc[0].get_text("text", sort=True))
        self.assertEqual(veri["kaynak_dosya"], str(Path("5.SINIF") / "konu.pdf"))
        self.assertEqual(veri["toplam_sayfa"], 1)
        self.assertTrue((self.output / "6.SINIF" / "konu.json").is_file())

    def test_mevcut_cikti_uzerine_yazilmaz(self):
        self.pdf_olustur(Path("konu.pdf"), "Metin")
        self.output.mkdir()
        hedef = self.output / "konu.json"
        hedef.write_text("mevcut", encoding="utf-8")
        sonuc = self.calistir()
        self.assertNotEqual(sonuc.returncode, 0)
        self.assertIn("üzerine yazılmaz", sonuc.stderr)
        self.assertEqual(hedef.read_text(encoding="utf-8"), "mevcut")

    def test_uzun_metin_kesilmez(self):
        pdf = self.source / "uzun.pdf"
        with pymupdf.open() as doc:
            page = doc.new_page()
            for i in range(60):
                page.insert_text((30, 30 + i * 10), f"{i:02} " + "abcdefghij " * 7, fontsize=6)
            doc.save(pdf)
        with pymupdf.open(pdf) as doc:
            beklenen = doc[0].get_text("text", sort=True)
        self.assertGreater(len(beklenen), 3000)
        sonuc = self.calistir()
        self.assertEqual(sonuc.returncode, 0, sonuc.stderr)
        veri = json.loads((self.output / "uzun.json").read_text(encoding="utf-8"))
        self.assertEqual(veri["sayfalar"][0]["icerik"], beklenen)

    def test_bos_sayfa_icin_uyari_verilir(self):
        self.pdf_olustur(Path("bos.pdf"), "")
        sonuc = self.calistir()
        self.assertEqual(sonuc.returncode, 0, sonuc.stderr)
        self.assertIn("OCR", sonuc.stderr)


if __name__ == "__main__":
    unittest.main()
