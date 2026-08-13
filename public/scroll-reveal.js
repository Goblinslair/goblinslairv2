(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var els = document.querySelectorAll('[data-reveal]');
  if (!els.length) return;

  // Stagger within each row's own group (reasons, events) rather than
  // globally, so unrelated sections don't fight over the same delay scale.
  var STAGGER_MS = 60;
  ['.reason-row', '.event-row'].forEach(function (selector) {
    document.querySelectorAll(selector).forEach(function (el, i) {
      el.style.transitionDelay = (i * STAGGER_MS) + 'ms';
    });
  });

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-revealed');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.15 });

  els.forEach(function (el) { observer.observe(el); });
})();
