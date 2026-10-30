// Giriş yapmış öğrenci/öğretmen ana sayfayı gezerken oturumu açık kalır;
// giriş butonları yerine kendi paneline giden bağlantı gösterilir. Oturum yalnızca panelden kapatılır.
(() => {
  const panels = { student: 'ogrenci-paneli.html', teacher: 'ogretmen-paneli.html' };
  fetch('/me', { credentials: 'same-origin' })
    .then(response => response.ok ? response.json() : null)
    .then(data => {
      const panel = data && panels[data.user?.role];
      if (!panel) return;
      document.querySelectorAll('[data-guest-only]').forEach(element => { element.hidden = true; });
      document.querySelectorAll('[data-panel-link]').forEach(element => {
        element.href = panel;
        element.hidden = false;
      });
    })
    .catch(() => {});
})();
