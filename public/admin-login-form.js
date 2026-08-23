(function () {
  var form = document.getElementById('admin-login-form');
  if (!form) return;

  var status = form.querySelector('.form-status');
  var submitBtn = form.querySelector('button[type="submit"]');
  var submitLabel = submitBtn.textContent;

  function showStatus(kind, text) {
    status.textContent = text;
    status.classList.remove('is-success', 'is-error');
    status.classList.add(kind === 'success' ? 'is-success' : 'is-error');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var password = form.querySelector('#password');
    if (!password.value) {
      showStatus('error', 'Enter the admin password.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in…';

    fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value })
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        if (!result.ok) {
          showStatus('error', result.data.error || 'Something went wrong logging in.');
          submitBtn.disabled = false;
          submitBtn.textContent = submitLabel;
          return;
        }
        window.location.href = '/admin';
      })
      .catch(function () {
        showStatus('error', 'Something went wrong. Please try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = submitLabel;
      });
  });
})();
