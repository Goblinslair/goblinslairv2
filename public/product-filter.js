(function () {
  var grid = document.querySelector('.product-grid');
  var cards = Array.prototype.slice.call(document.querySelectorAll('.product-card'));
  var empty = document.querySelector('.product-empty');
  var search = document.getElementById('product-search');
  var loadMoreBtn = document.getElementById('product-load-more');
  var sortSelect = document.getElementById('product-sort');
  var hideOosBtn = document.getElementById('hide-out-of-stock');
  if (!cards.length) return;

  var BATCH_SIZE = 24;
  // Each active filter is { key, label, categoryMatch, namePrefix,
  // nameContains, system }. Several can be active at once; a product shows
  // if it matches ANY of them (a product only has one category, so "AND"
  // across factions would always be empty). Search and Hide Out of Stock
  // still narrow the result on top of that.
  var activeFilters = [];
  var visibleLimit = BATCH_SIZE;

  // Sorting has to physically reorder the DOM nodes (not just the order we
  // iterate in below) — the grid lays cards out in DOM order, and Load
  // More's paging also depends on that same order to decide which batch of
  // matches to reveal next. `cards` itself must be reassigned to the sorted
  // order too, not just the DOM — applyFilters() below decides which of the
  // first `visibleLimit` matches to reveal by iterating `cards`, so if it
  // kept walking the original (unsorted) order, a card moved to the front
  // visually could still land past the cutoff and get hidden.
  function applySort() {
    var mode = sortSelect ? sortSelect.value : 'default';
    if (mode === 'default') return;

    cards = cards.slice().sort(function (a, b) {
      var priceA = parseFloat(a.getAttribute('data-price')) || 0;
      var priceB = parseFloat(b.getAttribute('data-price')) || 0;
      return mode === 'price-asc' ? priceA - priceB : priceB - priceA;
    });
    cards.forEach(function (card) { grid.appendChild(card); });
  }

  function cardMatchesFilter(f, card, cardName, cardSystems) {
    // A "system" filter (homepage /products?system=... link, or the
    // drawer's own "All <group>" button) matches the card's whole
    // game-system group. data-system is space-separated (a product can
    // belong to more than one group — see the comment above `systemsFor`
    // in products.astro), so this checks token membership, not equality.
    if (f.system) return cardSystems.indexOf(f.system) !== -1;

    var matchesCategory = f.categoryMatch === '*' || card.getAttribute('data-category') === f.categoryMatch;
    var matchesNamePrefix = !f.namePrefix || cardName.indexOf(f.namePrefix) === 0;
    // nameContains is an OR: it pulls in matches from other categories
    // (e.g. "Spearhead: Blades of Khorne...") without removing them from
    // their own category's filter — it never excludes results.
    var matchesNameContains = !!f.nameContains && cardName.indexOf(f.nameContains) !== -1;
    return (matchesCategory && matchesNamePrefix) || matchesNameContains;
  }

  function applyFilters() {
    var query = search ? search.value.trim().toLowerCase() : '';
    var hideOos = hideOosBtn ? hideOosBtn.getAttribute('aria-pressed') === 'true' : false;
    var matchCount = 0;
    var shownCount = 0;

    cards.forEach(function (card) {
      var cardName = card.getAttribute('data-name');
      var cardSystems = (card.getAttribute('data-system') || '').split(' ');
      var matchesFilter = activeFilters.length === 0 || activeFilters.some(function (f) {
        return cardMatchesFilter(f, card, cardName, cardSystems);
      });
      var matchesSearch = !query || cardName.indexOf(query) !== -1;
      var stock = card.getAttribute('data-stock');
      var isOutOfStock = stock !== '' && Number(stock) <= 0;
      var matchesStock = !hideOos || !isOutOfStock;
      var isMatch = matchesFilter && matchesSearch && matchesStock;

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

  if (sortSelect) {
    sortSelect.addEventListener('change', function () {
      visibleLimit = BATCH_SIZE;
      applySort();
      applyFilters();
    });
  }

  if (hideOosBtn) {
    hideOosBtn.addEventListener('click', function () {
      var pressed = hideOosBtn.getAttribute('aria-pressed') === 'true';
      hideOosBtn.setAttribute('aria-pressed', String(!pressed));
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
  var doneBtn = document.getElementById('filter-drawer-done');
  var backdrop = document.getElementById('filter-drawer-backdrop');
  var backBtn = document.getElementById('filter-drawer-back');
  var title = document.getElementById('filter-drawer-title');
  var defaultTitle = title ? title.textContent : '';
  var views = drawer ? drawer.querySelectorAll('.filter-drawer-view') : [];
  var leafButtons = drawer ? drawer.querySelectorAll('.filter-drawer-item[data-filter]:not([data-filter="all"])') : [];
  var allProductsBtn = drawer ? drawer.querySelector('.filter-drawer-item[data-filter="all"]') : null;
  var groupButtons = drawer ? drawer.querySelectorAll('.filter-drawer-group[data-group]') : [];
  var systemButtons = drawer ? drawer.querySelectorAll('.filter-drawer-item[data-system-filter]') : [];
  var chips = document.getElementById('active-filter-chips');
  var openBtnLabel = openBtn ? openBtn.textContent.trim() : 'Filter';

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

  function indexOfFilter(key) {
    for (var i = 0; i < activeFilters.length; i++) {
      if (activeFilters[i].key === key) return i;
    }
    return -1;
  }

  // Redraws everything that mirrors activeFilters: one removable chip per
  // filter (plus "Clear all" once there's more than one), the drawer's
  // highlighted rows, and the count on the Filter button.
  function render() {
    leafButtons.forEach(function (btn) {
      var on = indexOfFilter(btn.getAttribute('data-filter')) !== -1;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    systemButtons.forEach(function (btn) {
      var on = indexOfFilter('system:' + btn.getAttribute('data-system-filter')) !== -1;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    if (allProductsBtn) allProductsBtn.classList.toggle('is-active', activeFilters.length === 0);

    openBtn.textContent = activeFilters.length ? openBtnLabel + ' (' + activeFilters.length + ')' : openBtnLabel;

    if (!chips) return;
    chips.textContent = '';
    activeFilters.forEach(function (f) {
      var chip = document.createElement('div');
      chip.className = 'active-filter-chip';
      var text = document.createElement('span');
      text.textContent = f.label;
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.setAttribute('aria-label', 'Remove filter: ' + f.label);
      remove.innerHTML = '&times;';
      remove.addEventListener('click', function () { removeFilter(f.key); });
      chip.appendChild(text);
      chip.appendChild(remove);
      chips.appendChild(chip);
    });
    if (activeFilters.length > 1) {
      var clearAll = document.createElement('button');
      clearAll.type = 'button';
      clearAll.className = 'active-filter-clear-all';
      clearAll.textContent = 'Clear all';
      clearAll.addEventListener('click', clearFilters);
      chips.appendChild(clearAll);
    }
    chips.hidden = activeFilters.length === 0;
  }

  function changed() {
    visibleLimit = BATCH_SIZE;
    render();
    applyFilters();
  }

  function addFilter(filter) {
    if (indexOfFilter(filter.key) === -1) activeFilters.push(filter);
    changed();
  }

  function removeFilter(key) {
    var i = indexOfFilter(key);
    if (i !== -1) activeFilters.splice(i, 1);
    changed();
  }

  function toggleFilter(filter) {
    if (indexOfFilter(filter.key) === -1) addFilter(filter);
    else removeFilter(filter.key);
  }

  function clearFilters() {
    activeFilters = [];
    changed();
  }

  function leafFilter(btn) {
    return {
      key: btn.getAttribute('data-filter'),
      label: btn.textContent.trim(),
      categoryMatch: btn.getAttribute('data-category') || btn.getAttribute('data-filter'),
      namePrefix: btn.getAttribute('data-name-prefix') || '',
      nameContains: btn.getAttribute('data-name-contains') || '',
      system: ''
    };
  }

  // A whole game system — via a homepage "Shop 40K/AoS/Hobby" link
  // (/products?system=slug) or the drawer's "All <group>" row.
  function systemFilter(slug, label) {
    return { key: 'system:' + slug, label: label, categoryMatch: '', namePrefix: '', nameContains: '', system: slug };
  }

  openBtn.addEventListener('click', openDrawer);
  closeBtn.addEventListener('click', closeDrawer);
  if (doneBtn) doneBtn.addEventListener('click', closeDrawer);
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

  // Rows toggle on/off and the drawer stays open, so several can be picked
  // in one go; "Show Results" (or the backdrop/×) closes it.
  leafButtons.forEach(function (btn) {
    btn.addEventListener('click', function () { toggleFilter(leafFilter(btn)); });
  });

  systemButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      toggleFilter(systemFilter(btn.getAttribute('data-system-filter'), btn.textContent.trim().replace(/^All /, '')));
    });
  });

  if (allProductsBtn) {
    allProductsBtn.addEventListener('click', function () {
      clearFilters();
      closeDrawer();
    });
  }

  var systemParam = new URLSearchParams(window.location.search).get('system');
  if (systemParam) {
    var groupBtn = drawer.querySelector('.filter-drawer-group[data-group="' + systemParam + '"]');
    addFilter(systemFilter(systemParam, groupBtn ? groupBtn.getAttribute('data-label') : systemParam));
  } else {
    render();
  }
})();
