(function () {
  var form = document.getElementById('login-form');
  if (!form) return;

  var status = form.querySelector('.form-status');
  var submitBtn = form.querySelector('button[type="submit"]');
  var submitLabel = submitBtn.textContent;

  function showStatus(kind, text) {
    status.textContent = text;
    status.classList.remove('is-success', 'is-error');
    status.classList.add(kind === 'success' ? 'is-success' : 'is-error');
  }

  function reset() {
    submitBtn.disabled = false;
    submitBtn.textContent = submitLabel;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var email = form.querySelector('#email');
    var password = form.querySelector('#password');

    if (!email.value.trim() || !password.value) {
      showStatus('error', 'Enter your email and password.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in…';

    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value.trim(), password: password.value })
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        if (!result.ok) {
          showStatus('error', result.data.error || 'Something went wrong logging in.');
          reset();
          return;
        }
        showStatus('success', 'Logged in — redirecting…');
        var redirect = new URLSearchParams(window.location.search).get('redirect');
        // Only follow same-site relative paths — never let the query string
        // send a logged-in session off to an arbitrary external URL.
        window.location.href = redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/';
      })
      .catch(function () {
        showStatus('error', 'Something went wrong. Please try again.');
        reset();
      });
  });
})();
