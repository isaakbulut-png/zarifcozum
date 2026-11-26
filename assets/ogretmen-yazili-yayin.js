/* ==========================================================================
   ZarifÇözüm — Öğretmen Paneli: MEB Yazılı Provası Yayınlama Modülü
   POST /api/yazili (MongoDB) + localStorage (zc_teacher_yazili_v1) senkronu
   ========================================================================== */
(function (global) {
  "use strict";

  var TEACHER_LS_KEY = "zc_teacher_yazili_v1";

  function saveLocal(exam) {
    try {
      var list = JSON.parse(localStorage.getItem(TEACHER_LS_KEY) || "[]");
      if (!Array.isArray(list)) list = [];
      list.unshift(exam);
      localStorage.setItem(TEACHER_LS_KEY, JSON.stringify(list.slice(0, 30)));
    } catch (e) {}
  }

  function initTeacherYaziliPublisher() {
    var host = document.querySelector("#sinavlar, #odevler, main.teacher-main, .teacher-content");
    if (!host || document.getElementById("zcTeacherYaziliCard")) return;

    var card = document.createElement("section");
    card.id = "zcTeacherYaziliCard";
    card.style.cssText =
      "margin:24px 0;padding:22px 24px;background:#FFFDF9;border:1.5px solid #D4A359;border-radius:18px;box-shadow:0 10px 26px rgba(59,40,30,0.06);color:#3B281E;";

    card.innerHTML =
      '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px;">' +
        '<div>' +
          '<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:#3B281E;color:#F4D28D;font-size:12px;font-weight:800;margin-bottom:6px;">⭐ ÖĞRENCİ PANELİNE CANLI YAYIN</span>' +
          '<h3 style="margin:0;font-size:1.2rem;font-weight:800;">📝 MEB Açık Uçlu Yazılı Provası Yayınla</h3>' +
        '</div>' +
      '</div>' +
      '<form id="zcTeacherYaziliForm" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">' +
        '<div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px;">Sınıf</label>' +
          '<select id="ztyGrade" style="width:100%;padding:9px 12px;border-radius:10px;border:1px solid #D9CBBF;">' +
            '<option value="5">5. Sınıf</option><option value="6">6. Sınıf</option><option value="7">7. Sınıf</option><option value="8">8. Sınıf</option>' +
            '<option value="9">9. Sınıf</option><option value="10">10. Sınıf</option><option value="11">11. Sınıf</option><option value="12">12. Sınıf</option>' +
          '</select></div>' +
        '<div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px;">Dönem</label>' +
          '<select id="ztyDonem" style="width:100%;padding:9px 12px;border-radius:10px;border:1px solid #D9CBBF;">' +
            '<option value="1_donem_1_yazili">1. Dönem 1. Yazılı</option><option value="1_donem_2_yazili">1. Dönem 2. Yazılı</option>' +
            '<option value="2_donem_1_yazili">2. Dönem 1. Yazılı</option><option value="2_donem_2_yazili">2. Dönem 2. Yazılı</option>' +
          '</select></div>' +
        '<div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px;">Senaryo</label>' +
          '<select id="ztySenaryo" style="width:100%;padding:9px 12px;border-radius:10px;border:1px solid #D9CBBF;">' +
            '<option value="1">Senaryo 1 (Temel)</option><option value="2">Senaryo 2 (Beceri Temelli)</option><option value="3">Senaryo 3 (Karma)</option>' +
          '</select></div>' +
        '<div style="grid-column:1 / -1;"><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px;">Yazılı Başlığı</label>' +
          '<input id="ztyTitle" type="text" required placeholder="Örn: 5. Sınıf 1. Dönem 1. Yazılı Özel Çalışma Provası" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid #D9CBBF;box-sizing:border-box;"></div>' +
        '<div style="grid-column:1 / -1;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">' +
          '<button type="submit" style="padding:10px 20px;border:none;border-radius:10px;background:#3B281E;color:#FFFDF9;font-weight:800;cursor:pointer;">Öğrencilere Yayınla →</button>' +
          '<span id="ztyStatus" style="font-size:13px;font-weight:700;color:#1E7550;"></span>' +
        '</div>' +
      '</form>';

    host.prepend(card);

    document.getElementById("zcTeacherYaziliForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      var grade = Number(document.getElementById("ztyGrade").value);
      var donem = document.getElementById("ztyDonem").value;
      var senaryoNo = Number(document.getElementById("ztySenaryo").value);
      var title = document.getElementById("ztyTitle").value.trim();
      var statusEl = document.getElementById("ztyStatus");
      if (!title) return;

      var sorular = global.ZARIF_YAZILI_HAVUZU
        ? global.ZARIF_YAZILI_HAVUZU.getSorular(grade, donem, senaryoNo)
        : [];

      var payload = {
        id: "t-" + Date.now(),
        title: title,
        grade: grade,
        donem: donem,
        senaryoNo: senaryoNo,
        aciklama: "Öğretmen panelinden yayınlanan özel MEB açık uçlu yazılı provası",
        toplamPuan: 100,
        sorular: sorular,
        published: true
      };

      saveLocal(payload);

      try {
        await fetch("/api/yazili", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload)
        });
      } catch (err) {}

      statusEl.textContent = "✓ Yayınlandı! " + grade + ". sınıf öğrencilerinin Yazılıya Hazırlık ekranında en üstte görünecek.";
      document.getElementById("ztyTitle").value = "";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTeacherYaziliPublisher);
  } else {
    initTeacherYaziliPublisher();
  }
})(window);
