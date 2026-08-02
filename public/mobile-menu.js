(function () {
  var toggle = document.querySelector('.hamburger');
  var menu = document.getElementById('mobile-menu');
  if (!toggle || !menu) return;

  var menuLinks = menu.querySelectorAll('a');

  function openMenu() {
    menu.classList.add('is-open');
    toggle.classList.add('is-active');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
    document.body.classList.add('menu-open');
  }

  function closeMenu() {
    menu.classList.remove('is-open');
    toggle.classList.remove('is-active');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    document.body.classList.remove('menu-open');
  }

  toggle.addEventListener('click', function () {
    if (menu.classList.contains('is-open')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // Tapping a link should navigate AND close the menu behind it
  menuLinks.forEach(function (link) {
    link.addEventListener('click', closeMenu);
  });

  // Escape key closes it too
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });

  // If the viewport is resized past the mobile breakpoint while open
  // (e.g. rotating a tablet), reset so the desktop nav isn't hidden behind it
  window.addEventListener('resize', function () {
    if (window.innerWidth > 800) closeMenu();
  });
})();
