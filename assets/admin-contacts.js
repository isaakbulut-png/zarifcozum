// Admin Paneli - İletişim & Destek Talepleri Yönetimi (ZarifStore.contacts)
// Event Delegation + Mesaj Detay Modalı
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

  let activeModalId = null;
  let delegationBound = false;

  function updateBadge() {
    const badge = $('contactRequestsBadge');
    if (!badge || !window.ZarifStore || !window.ZarifStore.contacts) return;
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

  function findContactById(id) {
    if (!id || !window.ZarifStore || !window.ZarifStore.contacts) return null;
    return window.ZarifStore.contacts.list().find(i => i.id === id) || null;
  }

  function ensureModal() {
    let modal = $('adminContactDetailModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'adminContactDetailModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'contactModalTitle');
    modal.style.cssText = [
      'display:none',
      'position:fixed',
      'inset:0',
      'z-index:99999',
      'background:rgba(44,26,14,0.58)',
      'backdrop-filter:blur(3px)',
      'align-items:center',
      'justify-content:center',
      'padding:18px'
    ].join(';');
    modal.innerHTML = `
      <div id="adminContactDetailCard" style="background:#fffaf5;border:1px solid #e2cbb2;border-radius:16px;max-width:620px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 24px 60px rgba(44,26,14,0.28);color:#2c1a0e;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;background:#2c1a0e;color:#fbf1e8;border-radius:15px 15px 0 0;">
          <h3 id="contactModalTitle" style="margin:0;font-size:1.05rem;font-weight:700;">✉️ İletişim Talebi Detayı</h3>
          <button type="button" data-contact-modal-close="true" aria-label="Kapat" style="background:rgba(255,255,255,0.14);border:none;color:#fff;width:32px;height:32px;border-radius:8px;font-size:18px;line-height:1;cursor:pointer;">×</button>
        </div>
        <div id="adminContactDetailBody" style="padding:20px;"></div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function closeModal() {
    const modal = $('adminContactDetailModal');
    if (modal) modal.style.display = 'none';
    activeModalId = null;
  }

  function renderModalContent(item) {
    const body = $('adminContactDetailBody');
    if (!body || !item) return;
    const meta = STATUS_META[item.status] || STATUS_META.new;
    body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px;">
        <span style="display:inline-block;padding:4px 10px;border-radius:8px;background:#fbf1e8;border:1px solid #ead3bd;color:#c2570c;font-size:12px;font-weight:700;">
          ${esc(item.subject || 'Genel Destek')}
        </span>
        <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 11px;border-radius:999px;font-size:12px;font-weight:700;background:${meta.bg};color:${meta.color};">
          <span style="width:7px;height:7px;border-radius:50%;background:${meta.dot};"></span>
          ${meta.label}
        </span>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;padding:12px 14px;background:#fff;border:1px solid #ead8c5;border-radius:12px;margin-bottom:14px;font-size:13px;">
        <div>
          <div style="font-size:11px;color:#8c7361;font-weight:600;text-transform:uppercase;">Gönderen</div>
          <div style="font-weight:700;color:#2c1a0e;margin-top:2px;">${esc(item.name || 'İsimsiz')}</div>
        </div>
        <div>
          <div style="font-size:11px;color:#8c7361;font-weight:600;text-transform:uppercase;">Tarih</div>
          <div style="color:#3a2618;margin-top:2px;">${formatDate(item.createdAt)}</div>
        </div>
        <div>
          <div style="font-size:11px;color:#8c7361;font-weight:600;text-transform:uppercase;">E-posta</div>
          <div style="margin-top:2px;">${item.email ? `<a href="mailto:${esc(item.email)}" style="color:#c2570c;font-weight:600;text-decoration:none;">${esc(item.email)}</a>` : '—'}</div>
        </div>
        <div>
          <div style="font-size:11px;color:#8c7361;font-weight:600;text-transform:uppercase;">Telefon</div>
          <div style="margin-top:2px;">${item.phone ? `<a href="tel:${esc(item.phone)}" style="color:#2c1a0e;font-weight:600;text-decoration:none;">${esc(item.phone)}</a>` : '—'}</div>
        </div>
      </div>

      <div style="margin-bottom:18px;">
        <div style="font-size:12px;font-weight:700;color:#6a5242;margin-bottom:6px;">Mesaj İçeriği</div>
        <div style="padding:14px 16px;background:#fff;border:1px solid #ead8c5;border-left:4px solid #c2570c;border-radius:10px;font-size:14px;line-height:1.65;color:#2c1a0e;white-space:pre-wrap;word-break:break-word;">${esc(item.message || '(Mesaj metni boş)')}</div>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding-top:12px;border-top:1px solid #ead8c5;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${item.status !== 'replied' ? `<button type="button" data-contact-action="replied" data-contact-id="${esc(item.id)}" style="padding:8px 14px;border-radius:8px;border:1px solid #059669;background:#059669;color:#fff;font-size:13px;font-weight:700;cursor:pointer;">✓ Dönüş Yapıldı İşaretle</button>` : ''}
          ${item.status !== 'read' ? `<button type="button" data-contact-action="read" data-contact-id="${esc(item.id)}" style="padding:8px 14px;border-radius:8px;border:1px solid #d97706;background:#fffbeb;color:#92400e;font-size:13px;font-weight:700;cursor:pointer;">👁 Okundu</button>` : ''}
          <button type="button" data-contact-action="delete" data-contact-id="${esc(item.id)}" style="padding:8px 14px;border-radius:8px;border:1px solid #dc2626;background:#fef2f2;color:#b91c1c;font-size:13px;font-weight:700;cursor:pointer;">🗑 Sil</button>
        </div>
        <button type="button" data-contact-modal-close="true" style="padding:8px 16px;border-radius:8px;border:1px solid #dccab8;background:#f5ebe0;color:#2c1a0e;font-size:13px;font-weight:700;cursor:pointer;">Kapat</button>
      </div>
    `;
  }

  function openDetailModal(id) {
    let item = findContactById(id);
    if (!item) return;

    // Mesaj yeni/okunmamış ise açıldığı anda otomatik olarak 'read' (Okundu) yap
    if (item.status === 'new' && window.ZarifStore && window.ZarifStore.contacts) {
      const updated = window.ZarifStore.contacts.updateStatus(id, 'read');
      if (updated) item = updated;
      renderContacts();
    }

    const modal = ensureModal();
    activeModalId = item.id;
    renderModalContent(item);
    modal.style.display = 'flex';
  }

  function handleAction(action, id) {
    if (!id || !window.ZarifStore || !window.ZarifStore.contacts) return;

    if (action === 'open') {
      openDetailModal(id);
      return;
    }

    if (action === 'read' || action === 'replied') {
      const updated = window.ZarifStore.contacts.updateStatus(id, action);
      renderContacts();
      if (activeModalId === id && updated) {
        renderModalContent(updated);
      }
      return;
    }

    if (action === 'delete') {
      if (!confirm('Bu iletişim talebi kalıcı olarak silinecek. Emin misiniz?')) return;
      window.ZarifStore.contacts.remove(id);
      if (activeModalId === id) closeModal();
      renderContacts();
    }
  }

  function renderContacts() {
    updateBadge();
    const tbody = $('adminContactsTbody');
    const summaryEl = $('adminContactsSummary');
    if (!tbody || !window.ZarifStore || !window.ZarifStore.contacts) return;

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
      const preview = String(item.message || '');
      const shortPreview = preview.length > 120 ? preview.slice(0, 120) + '…' : preview;
      return `
        <tr data-contact-row="${esc(item.id)}" style="cursor:pointer;${isNew ? 'background:#fffaf5;' : ''}">
          <td style="vertical-align:top;">
            <div style="font-weight:700;color:#2c1a0e;">${esc(item.name)}</div>
            <div style="font-size:12px;color:#6a5242;margin-top:2px;">${esc(item.email || '—')}</div>
            <div style="font-size:12px;color:#8c7361;">${esc(item.phone || '')}</div>
          </td>
          <td style="vertical-align:top;max-width:360px;">
            <span style="display:inline-block;padding:2px 8px;border-radius:6px;background:#fbf1e8;border:1px solid #ead3bd;color:#9a3412;font-size:11.5px;font-weight:700;margin-bottom:5px;">
              ${esc(item.subject || 'Genel Destek')}
            </span>
            <div style="font-size:13px;color:#3a2618;line-height:1.45;word-break:break-word;">${esc(shortPreview)}</div>
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
              <button type="button" data-contact-action="open" data-contact-id="${esc(item.id)}" style="padding:5px 9px;border-radius:7px;border:1px solid #2c1a0e;background:#2c1a0e;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">📄 Oku / Detay</button>
              ${item.status !== 'read' ? `<button type="button" data-contact-action="read" data-contact-id="${esc(item.id)}" style="padding:5px 9px;border-radius:7px;border:1px solid #d97706;background:#fffbeb;color:#92400e;font-size:12px;font-weight:600;cursor:pointer;">👁 Okundu</button>` : ''}
              ${item.status !== 'replied' ? `<button type="button" data-contact-action="replied" data-contact-id="${esc(item.id)}" style="padding:5px 9px;border-radius:7px;border:1px solid #059669;background:#ecfdf5;color:#065f46;font-size:12px;font-weight:600;cursor:pointer;">✓ Dönüş Yapıldı</button>` : ''}
              <button type="button" data-contact-action="delete" data-contact-id="${esc(item.id)}" style="padding:5px 9px;border-radius:7px;border:1px solid #dc2626;background:#dc2626;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">🗑 Sil</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function bindEventDelegation() {
    if (delegationBound) return;
    delegationBound = true;

    document.addEventListener('click', event => {
      const target = event.target;
      if (!target || typeof target.closest !== 'function') return;

      const actionBtn = target.closest('[data-contact-action]');
      if (actionBtn) {
        event.preventDefault();
        event.stopPropagation();
        handleAction(actionBtn.getAttribute('data-contact-action'), actionBtn.getAttribute('data-contact-id'));
        return;
      }

      const closeBtn = target.closest('[data-contact-modal-close]');
      if (closeBtn) {
        event.preventDefault();
        closeModal();
        return;
      }

      if (target.id === 'adminContactDetailModal') {
        closeModal();
        return;
      }

      const row = target.closest('tr[data-contact-row]');
      if (row) {
        const id = row.getAttribute('data-contact-row');
        if (id) openDetailModal(id);
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && activeModalId) {
        closeModal();
      }
    });
  }

  function init() {
    bindEventDelegation();
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
