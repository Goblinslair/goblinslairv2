(function () {
  var STORAGE_KEY = 'gl-cart';

  function readCart() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function writeCart(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    var count = items.reduce(function (sum, item) { return sum + item.qty; }, 0);
    window.dispatchEvent(new CustomEvent('cart:change', { detail: { items: items, count: count } }));
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
      existing.qty = Math.min(existing.qty + qty, maxFor(existing.stock));
    } else {
      items.push({ slug: product.slug, name: product.name, price: product.price, image: product.image || null, stock: product.stock === undefined ? null : product.stock, qty: Math.min(qty, max) });
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

  window.GLCart = {
    readCart: readCart,
    addItem: addItem,
    updateQty: updateQty,
    removeItem: removeItem,
    getCount: getCount,
  };

  window.addEventListener('cart:change', updateBadges);
  // Keeps the nav badge in sync if the cart changes in another tab.
  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY) updateBadges();
  });

  updateBadges();
})();
