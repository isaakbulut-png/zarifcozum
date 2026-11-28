/* ==========================================================================
   ZarifÇözüm — Admin Paneli Denetimli Konu Havuzu Yöneticisi (v1)
   - Denetime gönderilen ve onaylanan tüm konuların biriktiği Konu Havuzu
   - Filtreleme, Onaylama, Öğrencilere Yayınlama ve Silme işlemleri
   ========================================================================== */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function loadAdminLessonPool() {
    const tbody = $('adminLessonPoolTbody');
    const summary = $('adminLessonPoolSummary');
    if (!tbody) return;

    const params = new URLSearchParams();
    const grade = $('adminLessonPoolGrade')?.value;
    const status = $('adminLessonPoolStatus')?.value;
    const search = $('adminLessonPoolSearch')?.value?.trim();
    if (grade) params.set('grade', grade);
    if (status) params.set('status', status);
    if (search) params.set('search', search);

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#6a5242;">Konu havuzu yükleniyor…</td></tr>';

    try {
      const res = await fetch('/api/content-library/lesson-pool?' + params.toString(), { credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.mesaj || 'Konu havuzu alınamadı.');
      const items = data.items || [];
      if (summary) summary.textContent = `Havuzda ${items.length} konu anlatımı listelendi. Öğretmenler ve yöneticiler bu havuzdan konu çekebilir.`;

      if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#64748b;">Konu havuzunda henüz eşleşen konu yok. Öğretmen Paneli › Konu Üret üzerinden "🛡️ Denetime Gönder" dediğinizde konular otomatik buraya düşer.</td></tr>';
        return;
      }

      tbody.replaceChildren(...items.map((item) => {
        const tr = document.createElement('tr');
        const scoreColor = item.auditScore >= 80 ? '#059669' : (item.auditScore >= 60 ? '#d97706' : '#dc2626');
        const stLabel = item.status === 'approved' ? '✅ Havuzda Onaylı' : (item.status === 'archived' ? '❌ Reddedildi' : '⏳ Denetimde');
        const stBg = item.status === 'approved' ? '#ecfdf5' : (item.status === 'archived' ? '#fef2f2' : '#fffbeb');
        const stClr = item.status === 'approved' ? '#047857' : (item.status === 'archived' ? '#b91c1c' : '#b45309');

        tr.innerHTML = `
          <td>
            <span style="display:inline-block;padding:3px 9px;border-radius:999px;background:#0f172a;color:#fff;font-size:0.75rem;font-weight:800;">${item.grade}. Sınıf</span>
          </td>
          <td>
            <div style="font-weight:700;color:#0f172a;">${esc(item.title)}</div>
            <div style="font-size:0.76rem;color:#64748b;margin-top:2px;">
              📖 ${item.pageCount} Sayfa · ⚡ ${item.noteCount} Hap Not · 🃏 ${item.flashcardCount} 3D Kart
            </div>
          </td>
          <td style="font-size:0.84rem;color:#334155;">${esc(item.submittedByName)}</td>
          <td>
            <span style="padding:3px 9px;border-radius:999px;background:${scoreColor};color:#fff;font-size:0.75rem;font-weight:800;">%${item.auditScore}</span>
          </td>
          <td>
            <span style="padding:3px 9px;border-radius:999px;background:${stBg};color:${stClr};font-size:0.75rem;font-weight:700;">${stLabel}</span>
          </td>
          <td style="white-space:nowrap;text-align:right;"></td>
        `;

        const tdAct = tr.querySelector('td:last-child');

        if (item.status !== 'approved') {
          const btnOk = document.createElement('button');
          btnOk.type = 'button';
          btnOk.className = 'btn light';
          btnOk.style.cssText = 'font-size:0.75rem;padding:4px 9px;margin-right:4px;color:#047857;';
          btnOk.textContent = '✅ Onayla';
          btnOk.onclick = async () => {
            try {
              const r = await fetch(`/api/content-library/${encodeURIComponent(item.id)}`, {
                method: 'PUT', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'approved' })
              });
              if (!r.ok) throw new Error('Onaylanamadı');
              loadAdminLessonPool();
            } catch (e) { alert('Hata: ' + e.message); }
          };
          tdAct.append(btnOk);
        }

        const btnPub = document.createElement('button');
        btnPub.type = 'button';
        btnPub.className = 'btn light';
        btnPub.style.cssText = 'font-size:0.75rem;padding:4px 9px;margin-right:4px;color:#1d4ed8;';
        btnPub.textContent = '🚀 Yayınla';
        btnPub.title = 'Havuzdaki bu konuyu ilgili sınıfın öğrencilerine yayınla';
        btnPub.onclick = async () => {
          const ok = window.zcConfirm
            ? await window.zcConfirm(`"${item.title}" konusu ${item.grade}. sınıf öğrencilerine yayınlansın mı?`)
            : true;
          if (!ok) return;
          btnPub.disabled = true;
          try {
            const c = item.content || {};
            const r = await fetch('/api/ai/curriculum-content/save', {
              method: 'POST', credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                grade: item.grade,
                subject: 'Matematik',
                themeCode: c.themeCode || '',
                themeTitle: c.themeTitle || c.unit_topic || item.topic,
                subTopicTitle: c.subTopicTitle || c.sub_topic || item.topic,
                unit_topic: c.unit_topic || c.themeTitle || item.topic,
                sub_topic: c.sub_topic || c.subTopicTitle || item.topic,
                outcome_code: c.outcome_code || '',
                short_summary: c.short_summary || '',
                lessonPages: c.lessonPages || [],
                practicalNotes: c.practicalNotes || [],
                flashcards: c.flashcards || [],
                teacherNotes: c.teacherNotes || '',
                status: 'published'
              })
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.mesaj || 'Yayınlanamadı.');
            alert('✅ Konu havuzdan çekilerek öğrencilere başarıyla yayınlandı!');
            if (typeof window.loadAdminPublishedTopics === 'function') window.loadAdminPublishedTopics();
          } catch (e) {
            alert('Yayınlama hatası: ' + e.message);
          } finally {
            btnPub.disabled = false;
          }
        };
        tdAct.append(btnPub);

        const btnDel = document.createElement('button');
        btnDel.type = 'button';
        btnDel.className = 'btn light';
        btnDel.style.cssText = 'font-size:0.75rem;padding:4px 8px;color:#b91c1c;';
        btnDel.textContent = '🗑️';
        btnDel.onclick = async () => {
          const ok = window.zcConfirm
            ? await window.zcConfirm(`"${item.title}" konusunu havuzdan silmek istediğinize emin misiniz?`)
            : true;
          if (!ok) return;
          try {
            const r = await fetch(`/api/content-library/${encodeURIComponent(item.id)}`, {
              method: 'DELETE', credentials: 'same-origin'
            });
            if (!r.ok) throw new Error('Silinemedi.');
            loadAdminLessonPool();
          } catch (e) { alert('Silme hatası: ' + e.message); }
        };
        tdAct.append(btnDel);

        return tr;
      }));
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:#b91c1c;">${esc(err.message)}</td></tr>`;
    }
  }

  function boot() {
    $('adminLessonPoolRefresh')?.addEventListener('click', loadAdminLessonPool);
    $('adminLessonPoolGrade')?.addEventListener('change', loadAdminLessonPool);
    $('adminLessonPoolStatus')?.addEventListener('change', loadAdminLessonPool);
    $('adminLessonPoolSearch')?.addEventListener('input', () => {
      clearTimeout(window._alpTimer);
      window._alpTimer = setTimeout(loadAdminLessonPool, 280);
    });
    window.loadAdminLessonPool = loadAdminLessonPool;
    loadAdminLessonPool();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
