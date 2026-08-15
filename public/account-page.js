(function () {
  function showStatus(form, kind, text) {
    var status = form.querySelector('.form-status');
    status.textContent = text;
    status.classList.remove('is-success', 'is-error');
    status.classList.add(kind === 'success' ? 'is-success' : 'is-error');
  }

  function postJSON(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().then(function (data) { return { ok: res.ok, data: data }; });
    });
  }

  var nameForm = document.getElementById('name-form');
  if (nameForm) {
    nameForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = nameForm.querySelector('#name').value.trim();
      if (!name) {
        showStatus(nameForm, 'error', 'Name cannot be empty.');
        return;
      }
      postJSON('/api/account/name', { name: name })
        .then(function (result) {
          if (!result.ok) {
            showStatus(nameForm, 'error', result.data.error || 'Something went wrong.');
            return;
          }
          showStatus(nameForm, 'success', 'Name updated.');
          document.querySelectorAll('.nav-auth-link').forEach(function (link) {
            link.textContent = result.data.name;
          });
        })
        .catch(function () {
          showStatus(nameForm, 'error', 'Something went wrong. Please try again.');
        });
    });
  }

  var passwordForm = document.getElementById('password-form');
  if (passwordForm) {
    passwordForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var currentPassword = passwordForm.querySelector('#current-password').value;
      var newPassword = passwordForm.querySelector('#new-password').value;
      var confirmNewPassword = passwordForm.querySelector('#confirm-new-password').value;

      if (newPassword.length < 8) {
        showStatus(passwordForm, 'error', 'New password must be at least 8 characters.');
        return;
      }
      if (newPassword !== confirmNewPassword) {
        showStatus(passwordForm, 'error', 'New passwords do not match.');
        return;
      }

      postJSON('/api/account/password', { currentPassword: currentPassword, newPassword: newPassword })
        .then(function (result) {
          if (!result.ok) {
            showStatus(passwordForm, 'error', result.data.error || 'Something went wrong.');
            return;
          }
          showStatus(passwordForm, 'success', 'Password changed.');
          passwordForm.reset();
        })
        .catch(function () {
          showStatus(passwordForm, 'error', 'Something went wrong. Please try again.');
        });
    });
  }

  var deleteForm = document.getElementById('delete-form');
  if (deleteForm) {
    deleteForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var password = deleteForm.querySelector('#delete-password').value;

      if (!window.confirm('Delete your account permanently? This cannot be undone.')) {
        return;
      }

      postJSON('/api/account/delete', { password: password })
        .then(function (result) {
          if (!result.ok) {
            showStatus(deleteForm, 'error', result.data.error || 'Something went wrong.');
            return;
          }
          window.location.href = '/';
        })
        .catch(function () {
          showStatus(deleteForm, 'error', 'Something went wrong. Please try again.');
        });
    });
  }
})();
