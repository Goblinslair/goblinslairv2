(function () {
  var input = document.getElementById('admin-image-input');
  var textarea = document.getElementById('body');
  var status = document.getElementById('admin-image-status');
  if (!input || !textarea) return;

  var MAX_ORIGINAL_BYTES = 25 * 1024 * 1024; // sanity guard before we even try to decode it in-browser
  var MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // must match src/pages/api/admin/upload.ts
  var TARGET_WIDTH = 1600; // matches the server-side resize width, so we're not compressing twice for nothing
  var JPEG_QUALITY = 0.82;

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

  // Downscales/recompresses in-browser so a typical 8-15MB phone photo
  // shrinks to a few hundred KB before it ever hits the network — avoids
  // making staff pre-shrink images themselves for a 3MB cap.
  function compress(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var objectUrl = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(objectUrl);
        var scale = Math.min(1, TARGET_WIDTH / img.naturalWidth);
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(function (blob) {
          if (!blob) return reject(new Error('compress failed'));
          resolve(blob);
        }, 'image/jpeg', JPEG_QUALITY);
      };
      img.onerror = function () {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('decode failed'));
      };
      img.src = objectUrl;
    });
  }

  function readAsDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error('read failed')); };
      reader.readAsDataURL(blob);
    });
  }

  input.addEventListener('change', function () {
    var file = input.files && input.files[0];
    if (!file) return;

    if (file.size > MAX_ORIGINAL_BYTES) {
      setStatus('Image is too large to process (25MB max).');
      input.value = '';
      return;
    }

    setStatus('Compressing image…');
    input.disabled = true;

    compress(file)
      .catch(function () {
        // Not a browser-decodable raster image (e.g. an unusual format) —
        // fall back to uploading the original as-is.
        return file;
      })
      .then(function (blob) {
        if (blob.size > MAX_UPLOAD_BYTES) {
          throw new Error('still too large');
        }
        setStatus('Uploading image…');
        return readAsDataUrl(blob);
      })
      .then(function (dataUrl) {
        return fetch('/api/admin/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUrl })
        }).then(function (res) {
          return res.json().then(function (data) { return { ok: res.ok, data: data }; });
        });
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
      .catch(function (err) {
        input.disabled = false;
        input.value = '';
        setStatus(err && err.message === 'still too large'
          ? 'Image is still too large after compression. Try a smaller photo.'
          : 'Upload failed. Please try again.');
      });
  });
})();
