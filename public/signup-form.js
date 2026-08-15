(function () {
  var form = document.getElementById('signup-form');
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

    var name = form.querySelector('#name');
    var email = form.querySelector('#email');
    var password = form.querySelector('#password');
    var confirmPassword = form.querySelector('#confirm-password');

    if (!name.value.trim() || !email.value.trim() || !password.value || !confirmPassword.value) {
      showStatus('error', 'Fill in every field.');
      return;
    }
    if (password.value.length < 8) {
      showStatus('error', 'Password must be at least 8 characters.');
      return;
    }
    if (password.value !== confirmPassword.value) {
      showStatus('error', 'Passwords do not match.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account…';

    fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.value.trim(), email: email.value.trim(), password: password.value })
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        if (!result.ok) {
          showStatus('error', result.data.error || 'Something went wrong creating your account.');
          reset();
          return;
        }
        showStatus('success', 'Account created — redirecting…');
        window.location.href = '/';
      })
      .catch(function () {
        showStatus('error', 'Something went wrong. Please try again.');
        reset();
      });
  });
})();
