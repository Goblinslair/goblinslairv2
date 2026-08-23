(function () {
  var form = document.getElementById('admin-blog-form');
  if (!form) return;

  var status = form.querySelector('.form-status');
  var submitBtn = form.querySelector('button[type="submit"]');
  var submitLabel = submitBtn.textContent;
  var mode = form.getAttribute('data-mode');
  var slug = form.getAttribute('data-slug');

  function showStatus(kind, text) {
    status.textContent = text;
    status.classList.remove('is-success', 'is-error');
    status.classList.add(kind === 'success' ? 'is-success' : 'is-error');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var payload = {
      title: form.querySelector('#title').value.trim(),
      date: form.querySelector('#date').value,
      excerpt: form.querySelector('#excerpt').value.trim(),
      body: form.querySelector('#body').value
    };
    if (mode === 'edit') payload.slug = slug;

    submitBtn.disabled = true;
    submitBtn.textContent = mode === 'edit' ? 'Saving…' : 'Publishing…';

    fetch('/api/admin/blog', {
      method: mode === 'edit' ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        if (!result.ok) {
          showStatus('error', result.data.error || 'Something went wrong.');
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
