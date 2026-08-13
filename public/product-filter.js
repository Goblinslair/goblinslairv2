(function () {
  var cards = document.querySelectorAll('.product-card');
  var empty = document.querySelector('.product-empty');
  var search = document.getElementById('product-search');
  var loadMoreBtn = document.getElementById('product-load-more');
  if (!cards.length) return;

  var BATCH_SIZE = 24;
  var activeFilter = 'all';
  var activeCategoryMatch = '';
  var activeNamePrefix = '';
  var activeNameContains = '';
  var visibleLimit = BATCH_SIZE;

  function applyFilters() {
    var query = search ? search.value.trim().toLowerCase() : '';
    var matchCount = 0;
    var shownCount = 0;

    cards.forEach(function (card) {
      var cardName = card.getAttribute('data-name');
      var matchesCategory = activeCategoryMatch === '*' || card.getAttribute('data-category') === activeCategoryMatch;
      var matchesNamePrefix = !activeNamePrefix || cardName.indexOf(activeNamePrefix) === 0;
      // nameContains is an OR: it pulls in matches from other categories
      // (e.g. "Spearhead: Blades of Khorne...") without removing them
      // from their own category's filter — it never excludes results.
      var matchesNameContains = !!activeNameContains && cardName.indexOf(activeNameContains) !== -1;
      var matchesFilter = activeFilter === 'all' || (matchesCategory && matchesNamePrefix) || matchesNameContains;
      var matchesSearch = !query || cardName.indexOf(query) !== -1;
      var isMatch = matchesFilter && matchesSearch;

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

  // ---- Filter drawer (grouped, GW-style drill-down) ----
  var drawer = document.getElementById('filter-drawer');
  var openBtn = document.getElementById('filter-drawer-open');
  var closeBtn = document.getElementById('filter-drawer-close');
  var backdrop = document.getElementById('filter-drawer-backdrop');
  var backBtn = document.getElementById('filter-drawer-back');
  var title = document.getElementById('filter-drawer-title');
  var defaultTitle = title ? title.textContent : '';
  var views = drawer ? drawer.querySelectorAll('.filter-drawer-view') : [];
  var leafButtons = drawer ? drawer.querySelectorAll('.filter-drawer-item[data-filter]') : [];
  var groupButtons = drawer ? drawer.querySelectorAll('.filter-drawer-group[data-group]') : [];
  var chip = document.getElementById('active-filter-chip');
  var chipText = document.getElementById('active-filter-chip-text');
  var chipClear = document.getElementById('active-filter-chip-clear');

  if (!drawer || !openBtn) return;

  function showView(name) {
    views.forEach(function (v) {
      v.hidden = v.getAttribute('data-view') !== name;
    });
    var isTop = name === 'top';
    backBtn.hidden = isTop;
    title.textContent = isTop ? defaultTitle : (title.getAttribute('data-current') || defaultTitle);
  }

  function openDrawer() {
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    showView('top');
    document.body.classList.add('menu-open');
    closeBtn.focus();
  }

  function closeDrawer() {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('menu-open');
    openBtn.focus();
  }

  function setActiveFilter(filterValue, label, categoryMatch, namePrefix, nameContains) {
    activeFilter = filterValue;
    activeCategoryMatch = categoryMatch || filterValue;
    activeNamePrefix = namePrefix || '';
    activeNameContains = nameContains || '';
    visibleLimit = BATCH_SIZE;

    leafButtons.forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-filter') === filterValue);
    });

    if (chip && chipText) {
      if (filterValue === 'all') {
        chip.hidden = true;
      } else {
        chipText.textContent = label;
        chip.hidden = false;
      }
    }

    applyFilters();
  }

  openBtn.addEventListener('click', openDrawer);
  closeBtn.addEventListener('click', closeDrawer);
  backdrop.addEventListener('click', closeDrawer);
  backBtn.addEventListener('click', function () { showView('top'); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer();
  });

  groupButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      title.setAttribute('data-current', btn.getAttribute('data-label') || defaultTitle);
      showView(btn.getAttribute('data-group'));
    });
  });

  leafButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      setActiveFilter(
        btn.getAttribute('data-filter'),
        btn.textContent.trim(),
        btn.getAttribute('data-category'),
        btn.getAttribute('data-name-prefix'),
        btn.getAttribute('data-name-contains')
      );
      closeDrawer();
    });
  });

  if (chipClear) {
    chipClear.addEventListener('click', function () {
      setActiveFilter('all', '');
    });
  }
})();
