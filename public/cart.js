(function () {
  var STORAGE_KEY = 'gl-cart';
  var OWNER_KEY = 'gl-cart-owner';

  // The cart belongs to the account, not the browser — a shared/kiosk
  // computer must not hand one customer's cart to the next person who logs
  // in. localStorage is only ever a guest scratchpad (pre-login) or a fast
  // local mirror of the account's server-side cart; it's wiped on logout
  // and re-synced from the server on every login (see gl:auth below).
  var loggedIn = false;
  var pushTimer = null;

  function readCart() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function pushToServer(items) {
    if (!loggedIn) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      fetch('/api/cart', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items })
      }).catch(function () {});
    }, 400);
  }

  function writeCart(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    var count = items.reduce(function (sum, item) { return sum + item.qty; }, 0);
    window.dispatchEvent(new CustomEvent('cart:change', { detail: { items: items, count: count } }));
    pushToServer(items);
  }

  function clear() {
    localStorage.removeItem(OWNER_KEY);
    writeCart([]);
  }

  // stock is the POS stock count at add time (null = not tracked, no cap).
  function maxFor(stock) {
    return stock === null || stock === undefined ? Infinity : stock;
  }

  function addItem(product, qty) {
    qty = qty || 1;
    var items = readCart();
    var max = maxFor(product.stock);
    var existing = items.find(function (i) { return i.slug === product.slug; });
    if (existing) {
      existing.stock = product.stock === undefined ? existing.stock : product.stock;
      existing.variantId = product.variantId === undefined ? existing.variantId : product.variantId;
      existing.qty = Math.min(existing.qty + qty, maxFor(existing.stock));
    } else {
      items.push({ slug: product.slug, name: product.name, price: product.price, image: product.image || null, stock: product.stock === undefined ? null : product.stock, variantId: product.variantId || null, qty: Math.min(qty, max) });
    }
    writeCart(items);
  }

  function updateQty(slug, qty) {
    var items = readCart();
    var item = items.find(function (i) { return i.slug === slug; });
    if (!item) return;
    qty = Math.min(qty, maxFor(item.stock));
    if (qty <= 0) {
      items = items.filter(function (i) { return i.slug !== slug; });
    } else {
      item.qty = qty;
    }
    writeCart(items);
  }

  function removeItem(slug) {
    writeCart(readCart().filter(function (i) { return i.slug !== slug; }));
  }

  function getCount() {
    return readCart().reduce(function (sum, item) { return sum + item.qty; }, 0);
  }

  function updateBadges() {
    var count = getCount();
    document.querySelectorAll('.cart-badge').forEach(function (badge) {
      badge.textContent = String(count);
      badge.hidden = count === 0;
    });
  }

  // Brings the account's server-side cart down to this device. Items that
  // exist server-side win as-is (so repeat syncs on later page loads are a
  // no-op, not a re-sum); local-only items are guest additions made just
  // before logging in, and get folded in once, capped to their own stock.
  function mergeItems(serverItems, localItems) {
    var merged = serverItems.map(function (i) { return Object.assign({}, i); });
    localItems.forEach(function (local) {
      var alreadyOnServer = merged.some(function (i) { return i.slug === local.slug; });
      if (alreadyOnServer) return;
      var stock = local.stock === undefined ? null : local.stock;
      merged.push({
        slug: local.slug, name: local.name, price: local.price, image: local.image || null,
        stock: stock, variantId: local.variantId || null, qty: Math.min(local.qty, maxFor(stock)),
      });
    });
    return merged;
  }

  function syncWithAccount(email) {
    // The local cart may belong to a different account than the one now
    // logging in — e.g. signing up for a new account while still signed in
    // as someone else, which swaps the session cookie without ever going
    // through logout. Only fold local items in as "guest additions" when
    // they're actually unowned (true guest cart) or already this account's;
    // anything left over from a different account gets dropped, not merged.
    var owner = localStorage.getItem(OWNER_KEY);
    var guestItems = (owner && owner !== email) ? [] : readCart();
    localStorage.setItem(OWNER_KEY, email);

    fetch('/api/cart', { headers: { 'Accept': 'application/json' } })
      .then(function (res) { return res.ok ? res.json() : { items: [] }; })
      .then(function (data) {
        writeCart(mergeItems((data && data.items) || [], guestItems));
      })
      .catch(function () {});
  }

  window.GLCart = {
    readCart: readCart,
    addItem: addItem,
    updateQty: updateQty,
    removeItem: removeItem,
    getCount: getCount,
    clear: clear,
  };

  window.addEventListener('cart:change', updateBadges);
  // Keeps the nav badge in sync if the cart changes in another tab.
  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY) updateBadges();
  });

  // Dispatched by nav-auth.js once it knows the session state (every page
  // load). Logging in pulls the account cart down and merges in any guest
  // additions. The explicit logout button also calls GLCart.clear()
  // directly for instant feedback, but this is the real safety net: it
  // catches any path that ends a session without going through that button
  // (session expiry, or signing into a different account which silently
  // swaps the session cookie) by dropping a cart left owned by someone else.
  window.addEventListener('gl:auth', function (e) {
    loggedIn = !!(e.detail && e.detail.loggedIn);
    if (loggedIn) {
      syncWithAccount(e.detail.email);
    } else if (localStorage.getItem(OWNER_KEY)) {
      clear();
    }
  });

  updateBadges();
})();
