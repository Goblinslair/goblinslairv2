(function () {
  if (!window.GLCart) return;

  function remaining(slug, stock) {
    if (stock === null) return Infinity;
    var existing = window.GLCart.readCart().find(function (i) { return i.slug === slug; });
    return Math.max(0, stock - (existing ? existing.qty : 0));
  }

  function refreshButton(btn) {
    var stockRaw = btn.dataset.stock;
    var stock = stockRaw === '' ? null : parseInt(stockRaw, 10);
    var left = remaining(btn.dataset.slug, stock);
    if (left <= 0) {
      btn.disabled = true;
      btn.textContent = 'Max in Cart';
    } else {
      btn.disabled = false;
      btn.textContent = 'Add to Cart';
    }
  }

  function refreshAll() {
    document.querySelectorAll('.quick-add-btn').forEach(refreshButton);
  }

  // Delegated so it keeps working with product-filter.js's show/hide and
  // load-more, which don't re-render the grid markup.
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.quick-add-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    if (btn.disabled) return;

    var stockRaw = btn.dataset.stock;
    var product = {
      slug: btn.dataset.slug,
      name: btn.dataset.name,
      price: parseFloat(btn.dataset.price),
      image: btn.dataset.image || null,
      stock: stockRaw === '' ? null : parseInt(stockRaw, 10),
    };

    window.GLCart.addItem(product, 1);
    btn.textContent = 'Added!';
    setTimeout(function () { refreshButton(btn); }, 1000);
  });

  window.addEventListener('cart:change', refreshAll);
  refreshAll();
})();
