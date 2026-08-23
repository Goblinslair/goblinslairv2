(function () {
  var input = document.getElementById('admin-image-input');
  var textarea = document.getElementById('body');
  var status = document.getElementById('admin-image-status');
  if (!input || !textarea) return;

  function setStatus(text) {
    if (status) status.textContent = text;
  }

  function insertAtCursor(text) {
    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var before = textarea.value.slice(0, start);
    var after = textarea.value.slice(end);
    textarea.value = before + text + after;
    var cursor = start + text.length;
    textarea.focus();
    textarea.setSelectionRange(cursor, cursor);
  }

  input.addEventListener('change', function () {
    var file = input.files && input.files[0];
    if (!file) return;

    var formData = new FormData();
    formData.append('image', file);

    setStatus('Uploading image…');
    input.disabled = true;

    fetch('/api/admin/upload', { method: 'POST', body: formData })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        input.disabled = false;
        input.value = '';
        if (!result.ok) {
          setStatus(result.data.error || 'Upload failed.');
          return;
        }
        insertAtCursor('\n\n![](' + result.data.url + ')\n\n');
        setStatus('Image added to the post below.');
      })
      .catch(function () {
        input.disabled = false;
        input.value = '';
        setStatus('Upload failed. Please try again.');
      });
  });
})();
