(function () {
  // Respect the person's reduced-motion preference — skip entirely.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var els = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
  if (!els.length) return;

  var ticking = false;

  function update() {
    var viewportCenter = window.innerHeight / 2;

    els.forEach(function (el) {
      var speed = parseFloat(el.getAttribute('data-parallax')) || 0.1;
      var rect = el.getBoundingClientRect();
      var elCenter = rect.top + rect.height / 2;
      // Offset grows as the element moves away from viewport center in either
      // direction — this is bounded to the element's own scroll-through range,
      // unlike a raw scrollY-based calculation which only works near the top
      // of the page.
      var offset = (viewportCenter - elCenter) * speed;
      el.style.setProperty('--parallax-y', offset.toFixed(1) + 'px');
    });

    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });

  window.addEventListener('resize', update);
  update();
})();
