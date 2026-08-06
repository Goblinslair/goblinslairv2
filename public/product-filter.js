(function () {
  var tabs = document.querySelectorAll('.faction-tab');
  var cards = document.querySelectorAll('.product-card');
  var empty = document.querySelector('.product-empty');
  if (!tabs.length || !cards.length) return;

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var filter = tab.getAttribute('data-filter') || 'all';

      tabs.forEach(function (t) { t.classList.remove('is-active'); });
      tab.classList.add('is-active');

      var visibleCount = 0;
      cards.forEach(function (card) {
        var match = filter === 'all' || card.getAttribute('data-category') === filter;
        card.hidden = !match;
        if (match) visibleCount++;
      });

      if (empty) empty.hidden = visibleCount !== 0;
    });
  });
})();
