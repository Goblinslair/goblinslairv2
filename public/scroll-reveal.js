(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-revealed');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.15 });

  // Exposed so content added after load (the homepage events section is a
  // server island, see src/components/HomeEvents.astro) can opt in too.
  // Safe to call twice on the same element.
  window.glScrollReveal = function (root) {
    // Stagger within each row's own group (reasons, events) rather than
    // globally, so unrelated sections don't fight over the same delay scale.
    var STAGGER_MS = 60;
    ['.reason-row', '.event-row'].forEach(function (selector) {
      root.querySelectorAll(selector).forEach(function (el, i) {
        el.style.transitionDelay = (i * STAGGER_MS) + 'ms';
      });
    });

    root.querySelectorAll('[data-reveal]').forEach(function (el) {
      if (el.hasAttribute('data-reveal-bound')) return;
      el.setAttribute('data-reveal-bound', '');
      observer.observe(el);
    });
  };

  window.glScrollReveal(document);
})();
