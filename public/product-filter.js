(function () {
  var tabs = document.querySelectorAll('.faction-tab');
  var cards = document.querySelectorAll('.product-card');
  var empty = document.querySelector('.product-empty');
  var search = document.getElementById('product-search');
  var loadMoreBtn = document.getElementById('product-load-more');
  if (!tabs.length || !cards.length) return;

  var BATCH_SIZE = 24;
  var activeFilter = 'all';
  var visibleLimit = BATCH_SIZE;

  function applyFilters() {
    var query = search ? search.value.trim().toLowerCase() : '';
    var matchCount = 0;
    var shownCount = 0;

    cards.forEach(function (card) {
      var matchesCategory = activeFilter === 'all' || card.getAttribute('data-category') === activeFilter;
      var matchesSearch = !query || card.getAttribute('data-name').indexOf(query) !== -1;
      var isMatch = matchesCategory && matchesSearch;

      if (!isMatch) {
        card.hidden = true;
        return;
      }

      matchCount++;
      if (shownCount < visibleLimit) {
        card.hidden = false;
        shownCount++;
      } else {
        card.hidden = true;
      }
    });

    if (empty) empty.hidden = matchCount !== 0;
    if (loadMoreBtn) loadMoreBtn.hidden = matchCount <= visibleLimit;
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      activeFilter = tab.getAttribute('data-filter') || 'all';
      visibleLimit = BATCH_SIZE;
      tabs.forEach(function (t) { t.classList.remove('is-active'); });
      tab.classList.add('is-active');
      applyFilters();
    });
  });

  if (search) {
    search.addEventListener('input', function () {
      visibleLimit = BATCH_SIZE;
      applyFilters();
    });
  }

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', function () {
      visibleLimit += BATCH_SIZE;
      applyFilters();
    });
  }

  applyFilters();
})();
