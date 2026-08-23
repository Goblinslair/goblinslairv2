(function () {
  var input = document.getElementById('admin-image-input');
  var textarea = document.getElementById('body');
  var status = document.getElementById('admin-image-status');
  if (!input || !textarea) return;

  var MAX_BYTES = 3 * 1024 * 1024;

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

    if (file.size > MAX_BYTES) {
      setStatus('Image is too large (3MB max).');
      input.value = '';
      return;
    }

    setStatus('Uploading image…');
    input.disabled = true;

    var reader = new FileReader();
    reader.onload = function () {
      fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: reader.result })
      })
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
    };
    reader.onerror = function () {
      input.disabled = false;
      input.value = '';
      setStatus('Could not read that file. Please try again.');
    };
    reader.readAsDataURL(file);
  });
})();
