(function () {
  var btn = document.getElementById('admin-sync-btn');
  var status = document.getElementById('admin-sync-status');
  if (!btn || !status) return;

  function show(message, isError) {
    status.textContent = message;
    status.className = 'form-status ' + (isError ? 'is-error' : 'is-success');
  }

  btn.addEventListener('click', function () {
    btn.disabled = true;
    btn.textContent = 'Syncing...';
    status.className = 'form-status';

    fetch('/api/admin/sync-products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (result) {
        if (!result.ok) {
          show(result.data.error || 'Sync failed. Please try again.', true);
          return;
        }
        show('Done. ' + result.data.synced + ' products are on the website now.', false);
      })
      .catch(function () {
        show('Something went wrong. Please try again.', true);
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = 'Sync Products Now';
      });
  });
})();
