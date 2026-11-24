// Öğrenci Paneli - ZarifStore Köprüsü (Öğretmen "Çalışma Ata" Görevleri & Test Sonuçları)
(() => {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  let activeFilter = 'all';

  function renderStoreAssignments() {
    const mount = document.getElementById('storeAssignedTasksMount');
    if (!mount || !window.ZarifStore || !window.ZarifStore.assignments) return;

    const all = window.ZarifStore.assignments.list();
    const filtered = all.filter(item => {
      if (activeFilter === 'pending') return item.status !== 'completed';
      if (activeFilter === 'completed') return item.status === 'completed';
      return true;
    });

    const recentTests = window.ZarifStore.tests ? window.ZarifStore.tests.list().slice(0, 4) : [];

    if (!all.length && !recentTests.length) {
      mount.innerHTML = '';
      return;
    }

    let html = '';

    if (all.length) {
      html += `
        <article class="feed-card" style="background:linear-gradient(145deg,#fffaf5,#fbf1e8);border:1px solid #e4cbb2;border-left:4px solid #c2570c;border-radius:14px;padding:16px 18px;margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
            <div>
              <h3 style="margin:0;color:#2c1a0e;font-size:1.05rem;">🎯 Öğretmenin Atadığı Hedefli Çalışmalar (${all.length})</h3>
              <p style="margin:3px 0 0;font-size:0.84rem;color:#6a5242;">Başarı analizine göre öğretmeninin sana özel atadığı konu tekrarı görevleri</p>
            </div>
            <span style="padding:3px 10px;border-radius:999px;background:#fff4eb;border:1px solid #f0c9a8;color:#c2570c;font-size:12px;font-weight:700;">
              ${all.filter(a => a.status !== 'completed').length} Bekleyen
            </span>
          </div>
          ${filtered.length ? `<div style="display:grid;gap:10px;">
            ${filtered.map(item => {
              const done = item.status === 'completed';
              const due = item.dueDate ? new Date(item.dueDate).toLocaleDateString('tr-TR') : 'Belirtilmedi';
              return `
                <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 14px;border-radius:12px;background:#fff;border:1px solid ${done ? '#bbf7d0' : '#ead8c5'};">
                  <div style="min-width:220px;flex:1;">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                      <strong style="color:#2c1a0e;font-size:0.95rem;${done ? 'text-decoration:line-through;opacity:0.75;' : ''}">${esc(item.topicTitle)}</strong>
                      <span style="padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:#2c1a0e;color:#fed7aa;">${item.grade}. Sınıf</span>
                      <span style="padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:${done ? '#ecfdf5' : '#fef3c7'};color:${done ? '#065f46' : '#92400e'};">
                        ${done ? '✓ Tamamlandı' : '⏳ Bekliyor'}
                      </span>
                    </div>
                    <p style="margin:5px 0 4px;font-size:0.84rem;color:#5a422d;">${esc(item.note)}</p>
                    <div style="font-size:0.76rem;color:#806b5c;">
                      Öğretmen: <strong>${esc(item.teacherName)}</strong> · Son tarih: <strong>${due}</strong>
                    </div>
                  </div>
                  <div style="display:flex;gap:8px;align-items:center;">
                    <button type="button" data-store-toggle-asg="${esc(item.id)}" style="padding:7px 12px;border-radius:9px;border:1px solid ${done ? '#d97706' : '#059669'};background:${done ? '#fffbeb' : '#059669'};color:${done ? '#92400e' : '#fff'};font-size:12.5px;font-weight:700;cursor:pointer;">
                      ${done ? '↺ Bekleyene Al' : '✓ Tamamladım'}
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>` : '<p style="margin:6px 0 0;font-size:0.86rem;color:#6a5242;">Bu filtrede hedefli çalışma görevi bulunmuyor.</p>'}
        </article>
      `;
    }

    if (recentTests.length) {
      html += `
        <article class="feed-card" style="background:#fffaf5;border:1px solid #ead8c5;border-radius:14px;padding:14px 18px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
            <h3 style="margin:0;color:#2c1a0e;font-size:0.98rem;">📊 Son Çözülen Mini Test &amp; Pratik Sonuçların</h3>
            <a href="/basari-odakli-sistem.html" style="font-size:0.82rem;font-weight:700;color:#c2570c;text-decoration:none;">Başarı Analizini Gör →</a>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;">
            ${recentTests.map(t => {
              const color = t.score >= 80 ? '#2f6f4e' : (t.score >= 60 ? '#b88a28' : '#c2570c');
              return `
                <div style="padding:10px 12px;border-radius:10px;background:#fff;border:1px solid #ead8c5;">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
                    <strong style="font-size:0.86rem;color:#2c1a0e;">${esc(t.topicTitle)}</strong>
                    <span style="font-weight:800;font-size:0.88rem;color:${color};">%${t.score}</span>
                  </div>
                  <div style="font-size:0.76rem;color:#6a5242;margin-top:3px;">${t.correct}/${t.total} doğru · ${t.grade}. Sınıf</div>
                </div>
              `;
            }).join('')}
          </div>
        </article>
      `;
    }

    mount.innerHTML = html;

    mount.querySelectorAll('[data-store-toggle-asg]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.ZarifStore.assignments.toggleComplete(btn.dataset.storeToggleAsg);
        renderStoreAssignments();
      });
    });
  }

  function init() {
    document.querySelectorAll('#taskFilterBar [data-task-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.taskFilter || 'all';
        renderStoreAssignments();
      });
    });

    if (window.ZarifStore && window.ZarifStore.events) {
      window.ZarifStore.events.subscribe('assignments', renderStoreAssignments);
      window.ZarifStore.events.subscribe('tests', renderStoreAssignments);
    }

    renderStoreAssignments();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
