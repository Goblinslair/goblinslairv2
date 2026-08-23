(function () {
  var btn = document.getElementById('admin-delete-btn');
  if (!btn) return;

  var kind = btn.getAttribute('data-kind');
  var slug = btn.getAttribute('data-slug');
  var label = kind === 'blog' ? 'blog post' : 'event';

  btn.addEventListener('click', function () {
    if (!window.confirm('Delete this ' + label + ' permanently? This cannot be undone.')) {
      return;
    }

    btn.disabled = true;

    fetch('/api/admin/' + kind, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: slug })
    })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (result) {
        if (!result.ok) {
          window.alert(result.data.error || 'Something went wrong deleting this.');
          btn.disabled = false;
          return;
        }
        window.location.href = '/admin';
      })
      .catch(function () {
        window.alert('Something went wrong. Please try again.');
        btn.disabled = false;
      });
  });
})();
