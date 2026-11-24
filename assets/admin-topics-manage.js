// Admin Paneli - Yayınlanan Konu Anlatımları Yönetimi (/api/topics/manage)
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function apiJson(url, options = {}) {
    const res = await fetch(url, {
      credentials: 'include',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.mesaj || `Sunucu hatası (${res.status})`);
    return data;
  }

  async function loadAdminTopics() {
    const tbody = $('adminTopicsTbody');
    const summaryEl = $('adminTopicsSummary');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#6a5242;">Yayınlanan konular yükleniyor…</td></tr>';

    const params = new URLSearchParams();
    const g = $('adminTopicsGrade')?.value || '';
    const st = $('adminTopicsStatus')?.value || '';
    const q = ($('adminTopicsSearch')?.value || '').trim();
    if (g) params.set('grade', g);
    if (st) params.set('status', st);
    if (q) params.set('q', q);

    try {
      const res = await apiJson('/api/topics/manage' + (params.toString() ? '?' + params.toString() : ''));
      const items = res.items || [];
      if (summaryEl) {
        const pubCount = items.filter(i => i.status === 'published').length;
        summaryEl.textContent = `Toplam ${items.length} konu (${pubCount} yayında, ${items.length - pubCount} taslak)`;
      }

      if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:28px;color:#6a5242;">Seçili filtrelere uygun konu anlatımı bulunamadı.</td></tr>';
        return;
      }

      tbody.innerHTML = items.map(it => {
        const isPub = it.status === 'published';
        const dateStr = it.updatedAt ? new Date(it.updatedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
        return `
          <tr>
            <td>
              <span style="display:inline-block;padding:3px 8px;border-radius:6px;background:#2c1a0e;color:#fed7aa;font-weight:700;font-size:11.5px;">${it.grade}. Sınıf</span>
              <div style="font-size:11px;color:#9a3412;font-weight:700;margin-top:3px;">${esc(it.themeCode)}</div>
            </td>
            <td>
              <div style="font-weight:700;color:#2c1a0e;">${esc(it.title)}</div>
              <div style="font-size:12px;color:#6a5242;margin-top:2px;">${esc(it.themeTitle)} › ${esc(it.subTopicTitle)}</div>
            </td>
            <td style="font-size:13px;color:#2c1a0e;">${esc(it.createdByName || 'Öğretmen')}</td>
            <td>
              <span style="display:inline-block;padding:3px 9px;border-radius:999px;font-size:11.5px;font-weight:700;background:${isPub ? '#ecfdf5' : '#fef3c7'};color:${isPub ? '#065f46' : '#92400e'};">
                ${isPub ? '● Yayında' : '○ Taslak'}
              </span>
            </td>
            <td style="font-size:12.5px;color:#6a5242;white-space:nowrap;">${dateStr}</td>
            <td style="white-space:nowrap;">
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button type="button" data-admin-toggle-topic="${esc(it.id)}" data-next-status="${isPub ? 'draft' : 'published'}" style="padding:6px 10px;border-radius:7px;border:1px solid ${isPub ? '#d97706' : '#059669'};background:${isPub ? '#fffbeb' : '#ecfdf5'};color:${isPub ? '#92400e' : '#065f46'};font-size:12px;font-weight:600;cursor:pointer;">
                  ${isPub ? '⏸️ Yayından Kaldır' : '🚀 Yayınla'}
                </button>
                <button type="button" data-admin-del-topic="${esc(it.id)}" style="padding:6px 10px;border-radius:7px;border:1px solid #dc2626;background:#dc2626;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">
                  🗑️ Sil
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('[data-admin-toggle-topic]').forEach(btn => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            await apiJson('/api/topics/' + encodeURIComponent(btn.dataset.adminToggleTopic) + '/status', {
              method: 'PATCH',
              body: JSON.stringify({ status: btn.dataset.nextStatus })
            });
            await loadAdminTopics();
          } catch (err) {
            alert('Durum değiştirilemedi: ' + err.message);
            btn.disabled = false;
          }
        });
      });

      tbody.querySelectorAll('[data-admin-del-topic]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Bu konu anlatımı ve bağlı öğrenci ilerleme kayıtları kalıcı olarak silinecek. Emin misiniz?')) return;
          btn.disabled = true;
          try {
            await apiJson('/api/topics/' + encodeURIComponent(btn.dataset.adminDelTopic), { method: 'DELETE' });
            await loadAdminTopics();
          } catch (err) {
            alert('Silinemedi: ' + err.message);
            btn.disabled = false;
          }
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:#991b1b;">Yükleme hatası: ${esc(err.message)}</td></tr>`;
    }
  }

  function init() {
    const navBtn = document.querySelector('[data-view="published-topics"]');
    if (navBtn) {
      navBtn.addEventListener('click', () => {
        setTimeout(loadAdminTopics, 40);
      });
    }
    $('adminTopicsGrade')?.addEventListener('change', loadAdminTopics);
    $('adminTopicsStatus')?.addEventListener('change', loadAdminTopics);
    $('adminTopicsRefresh')?.addEventListener('click', loadAdminTopics);
    let timer = null;
    $('adminTopicsSearch')?.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(loadAdminTopics, 250);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
