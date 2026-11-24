// Admin Paneli - İletişim & Destek Talepleri Yönetimi (ZarifStore.contacts)
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const STATUS_META = {
    new: { label: 'Yeni / Okunmadı', bg: '#fef2f2', color: '#b91c1c', dot: '#dc2626' },
    read: { label: 'Okundu', bg: '#fef3c7', color: '#92400e', dot: '#d97706' },
    replied: { label: 'Dönüş Yapıldı', bg: '#ecfdf5', color: '#065f46', dot: '#059669' },
    archived: { label: 'Arşiv', bg: '#f3f4f6', color: '#4b5563', dot: '#6b7280' }
  };

  function updateBadge() {
    const badge = $('contactRequestsBadge');
    if (!badge || !window.ZarifStore) return;
    const count = window.ZarifStore.contacts.unreadCount();
    badge.textContent = String(count);
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('tr-TR', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return '—';
    }
  }

  function renderContacts() {
    updateBadge();
    const tbody = $('adminContactsTbody');
    const summaryEl = $('adminContactsSummary');
    if (!tbody || !window.ZarifStore) return;

    const statusFilter = $('adminContactsStatus')?.value || 'all';
    const search = ($('adminContactsSearch')?.value || '').trim();
    const allItems = window.ZarifStore.contacts.list();
    const items = window.ZarifStore.contacts.list({ status: statusFilter, search });

    if (summaryEl) {
      const unread = allItems.filter(i => i.status === 'new').length;
      const replied = allItems.filter(i => i.status === 'replied').length;
      summaryEl.textContent = `Toplam ${allItems.length} talep (${unread} okunmamış, ${replied} dönüş yapıldı)`;
    }

    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:#6a5242;">
        ${allItems.length ? 'Seçili filtreye uygun iletişim talebi bulunamadı.' : 'Henüz iletişim formundan gelen bir talep yok. Ziyaretçiler <b>iletisim.html</b> üzerinden form gönderdiğinde burada anında listelenir.'}
      </td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(item => {
      const meta = STATUS_META[item.status] || STATUS_META.new;
      const isNew = item.status === 'new';
      return `
        <tr style="${isNew ? 'background:#fffaf5;' : ''}">
          <td style="vertical-align:top;">
            <div style="font-weight:700;color:#2c1a0e;">${esc(item.name)}</div>
            <div style="font-size:12px;color:#6a5242;margin-top:2px;">${esc(item.email || '—')}</div>
            <div style="font-size:12px;color:#8c7361;">${esc(item.phone || '')}</div>
          </td>
          <td style="vertical-align:top;max-width:380px;">
            <span style="display:inline-block;padding:2px 8px;border-radius:6px;background:#fbf1e8;border:1px solid #ead3bd;color:#9a3412;font-size:11.5px;font-weight:700;margin-bottom:5px;">
              ${esc(item.subject || 'Genel Destek')}
            </span>
            <div style="font-size:13px;color:#3a2618;line-height:1.5;white-space:pre-wrap;word-break:break-word;">${esc(item.message)}</div>
          </td>
          <td style="vertical-align:top;white-space:nowrap;">
            <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;font-size:11.5px;font-weight:700;background:${meta.bg};color:${meta.color};">
              <span style="width:7px;height:7px;border-radius:50%;background:${meta.dot};"></span>
              ${meta.label}
            </span>
          </td>
          <td style="vertical-align:top;font-size:12px;color:#6a5242;white-space:nowrap;">${formatDate(item.createdAt)}</td>
          <td style="vertical-align:top;white-space:nowrap;">
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              ${item.status !== 'read' ? `<button type="button" data-contact-status="${esc(item.id)}" data-next="read" style="padding:5px 9px;border-radius:7px;border:1px solid #d97706;background:#fffbeb;color:#92400e;font-size:12px;font-weight:600;cursor:pointer;">👁 Okundu</button>` : ''}
              ${item.status !== 'replied' ? `<button type="button" data-contact-status="${esc(item.id)}" data-next="replied" style="padding:5px 9px;border-radius:7px;border:1px solid #059669;background:#ecfdf5;color:#065f46;font-size:12px;font-weight:600;cursor:pointer;">✓ Dönüş Yapıldı</button>` : ''}
              <button type="button" data-contact-delete="${esc(item.id)}" style="padding:5px 9px;border-radius:7px;border:1px solid #dc2626;background:#dc2626;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">🗑 Sil</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-contact-status]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.ZarifStore.contacts.updateStatus(btn.dataset.contactStatus, btn.dataset.next);
        renderContacts();
      });
    });

    tbody.querySelectorAll('[data-contact-delete]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Bu iletişim talebi kalıcı olarak silinecek. Emin misiniz?')) return;
        window.ZarifStore.contacts.remove(btn.dataset.contactDelete);
        renderContacts();
      });
    });
  }

  function init() {
    updateBadge();
    const navBtn = document.querySelector('[data-view="contact-requests"]');
    if (navBtn) {
      navBtn.addEventListener('click', () => setTimeout(renderContacts, 30));
    }
    $('adminContactsRefresh')?.addEventListener('click', renderContacts);
    $('adminContactsStatus')?.addEventListener('change', renderContacts);
    $('adminContactsSearch')?.addEventListener('input', renderContacts);

    if (window.ZarifStore && window.ZarifStore.events) {
      window.ZarifStore.events.subscribe('contacts', renderContacts);
    }
    renderContacts();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
