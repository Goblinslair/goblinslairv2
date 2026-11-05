(function () {
  var form = document.querySelector('.contact-form');
  if (!form) return;

  var status = form.querySelector('.form-status');
  var submitBtn = form.querySelector('button[type="submit"]');
  var submitLabel = submitBtn.textContent;

  // Handled by src/pages/api/contact.ts, which emails the shop through Brevo.
  var CONTACT_ENDPOINT = '/api/contact';

  function showStatus(kind, text) {
    status.textContent = text;
    status.classList.remove('is-success', 'is-error');
    status.classList.add(kind === 'success' ? 'is-success' : 'is-error');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var name = form.querySelector('#name');
    var email = form.querySelector('#email');
    var topic = form.querySelector('#topic');
    var message = form.querySelector('#message');
    var website = form.querySelector('#website');

    if (!name.value.trim() || !email.value.trim() || !message.value.trim()) {
      showStatus('error', 'Please fill in your name, email, and message.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    fetch(CONTACT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.value.trim(),
        email: email.value.trim(),
        topic: topic ? topic.value : '',
        message: message.value.trim(),
        website: website ? website.value : ''
      })
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (res.ok) {
            showStatus('success', "Message sent — we'll get back to you soon.");
            form.reset();
          } else if (res.status === 400 || res.status === 429) {
            showStatus('error', data.error || 'Please check the form and try again.');
          } else {
            throw new Error('Contact form endpoint returned ' + res.status);
          }
        });
      })
      .catch(function () {
        showStatus('error', 'Something went wrong sending that. Please email us directly at goblinslairpj@gmail.com instead.');
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = submitLabel;
      });
  });
})();
