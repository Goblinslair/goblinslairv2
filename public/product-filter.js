(function () {
  var tabs = document.querySelectorAll('.faction-tab');
  var cards = document.querySelectorAll('.product-card');
  var empty = document.querySelector('.product-empty');
  var search = document.getElementById('product-search');
  if (!tabs.length || !cards.length) return;

  var activeFilter = 'all';

  function applyFilters() {
    var query = search ? search.value.trim().toLowerCase() : '';
    var visibleCount = 0;

    cards.forEach(function (card) {
      var matchesCategory = activeFilter === 'all' || card.getAttribute('data-category') === activeFilter;
      var matchesSearch = !query || card.getAttribute('data-name').indexOf(query) !== -1;
      var match = matchesCategory && matchesSearch;
      card.hidden = !match;
      if (match) visibleCount++;
    });

    if (empty) empty.hidden = visibleCount !== 0;
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      activeFilter = tab.getAttribute('data-filter') || 'all';
      tabs.forEach(function (t) { t.classList.remove('is-active'); });
      tab.classList.add('is-active');
      applyFilters();
    });
  });

  if (search) {
    search.addEventListener('input', applyFilters);
  }
})();
