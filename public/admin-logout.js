(function () {
  var btn = document.getElementById('admin-logout-btn');
  if (!btn) return;

  btn.addEventListener('click', function () {
    fetch('/api/admin/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    }).then(function () {
      window.location.href = '/admin/login';
    });
  });
})();
