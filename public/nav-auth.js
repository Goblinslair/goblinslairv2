(function () {
  var wrappers = document.querySelectorAll('.nav-account');
  if (!wrappers.length) return;

  function closeAll() {
    wrappers.forEach(function (w) {
      w.classList.remove('is-open');
      var trigger = w.querySelector('.nav-auth-link');
      if (trigger && trigger.getAttribute('aria-haspopup')) {
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function setLoggedOut() {
    wrappers.forEach(function (w) {
      var trigger = w.querySelector('.nav-auth-link');
      trigger.textContent = 'Login';
      trigger.href = '/login';
      trigger.removeAttribute('aria-haspopup');
      trigger.removeAttribute('aria-expanded');
      trigger.onclick = null;
    });
  }

  function setLoggedIn(name) {
    wrappers.forEach(function (w) {
      var trigger = w.querySelector('.nav-auth-link');
      var logoutBtn = w.querySelector('.nav-logout-btn');

      trigger.textContent = name;
      trigger.href = '#';
      trigger.setAttribute('aria-haspopup', 'true');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        var isOpen = w.classList.contains('is-open');
        closeAll();
        if (!isOpen) {
          w.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
        }
      };

      if (logoutBtn) {
        logoutBtn.onclick = function () {
          // Wipe the local cart immediately — it's this account's cart, not
          // this browser's, and must not carry over to the next person who
          // logs in on a shared/kiosk computer.
          if (window.GLCart) window.GLCart.clear();
          // Astro's origin-check middleware 403s same-site POSTs that have no
          // Content-Type (or a form-like one) — send JSON like every other
          // fetch call in this codebase to skip that check.
          fetch('/api/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}'
          }).then(function () {
            window.location.href = '/';
          });
        };
      }
    });
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav-account')) closeAll();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAll();
  });

  fetch('/api/me')
    .then(function (res) { return res.json(); })
    .then(function (data) {
      var loggedIn = !!(data && data.name);
      if (loggedIn) setLoggedIn(data.name);
      else setLoggedOut();
      window.dispatchEvent(new CustomEvent('gl:auth', { detail: { loggedIn: loggedIn, email: data && data.email } }));
    })
    .catch(function () {});
})();
