(function () {
  if (!window.GLCart) return;

  function remaining(slug, stock) {
    if (stock === null) return Infinity;
    var existing = window.GLCart.readCart().find(function (i) { return i.slug === slug; });
    return Math.max(0, stock - (existing ? existing.qty : 0));
  }

  function refreshButton(btn) {
    if (!btn.dataset.slug) return; // out-of-stock buttons render disabled, no data to refresh
    var stockRaw = btn.dataset.stock;
    var stock = stockRaw === '' ? null : parseInt(stockRaw, 10);
    var left = remaining(btn.dataset.slug, stock);
    var wrap = btn.closest('.quick-add-wrap');
    var qtyInput = wrap ? wrap.querySelector('.qty-input') : null;

    if (left <= 0) {
      btn.disabled = true;
      btn.textContent = 'Max in Cart';
      if (qtyInput) qtyInput.disabled = true;
    } else {
      btn.disabled = false;
      btn.textContent = 'Add to Cart';
      if (qtyInput) {
        qtyInput.disabled = false;
        if (stock !== null) qtyInput.setAttribute('max', String(left));
        if (parseInt(qtyInput.value, 10) > left || !qtyInput.value) qtyInput.value = '1';
      }
    }
  }

  function refreshAll() {
    document.querySelectorAll('.quick-add-btn').forEach(refreshButton);
  }

  // Delegated so it keeps working with product-filter.js's show/hide and
  // load-more, which don't re-render the grid markup.
  document.addEventListener('click', function (e) {
    var decBtn = e.target.closest('.quick-add-wrap [data-qty-decrease]');
    var incBtn = e.target.closest('.quick-add-wrap [data-qty-increase]');
    var addBtn = e.target.closest('.quick-add-btn');

    if (decBtn || incBtn) {
      e.preventDefault();
      e.stopPropagation();
      var wrap = (decBtn || incBtn).closest('.quick-add-wrap');
      var qtyInput = wrap.querySelector('.qty-input');
      var max = qtyInput.getAttribute('max');
      var val = parseInt(qtyInput.value, 10) || 1;
      val = decBtn ? Math.max(1, val - 1) : val + 1;
      if (max !== null) val = Math.min(val, parseInt(max, 10));
      qtyInput.value = String(val);
      return;
    }

    if (!addBtn) return;
    e.preventDefault();
    e.stopPropagation();
    if (addBtn.disabled) return;

    var stockRaw = addBtn.dataset.stock;
    var product = {
      slug: addBtn.dataset.slug,
      name: addBtn.dataset.name,
      price: parseFloat(addBtn.dataset.price),
      image: addBtn.dataset.image || null,
      stock: stockRaw === '' ? null : parseInt(stockRaw, 10),
      variantId: addBtn.dataset.variantId || null,
    };

    var wrapForAdd = addBtn.closest('.quick-add-wrap');
    var qtyForAdd = wrapForAdd ? wrapForAdd.querySelector('.qty-input') : null;
    var qty = qtyForAdd ? Math.max(1, parseInt(qtyForAdd.value, 10) || 1) : 1;

    window.GLCart.addItem(product, qty);
    addBtn.textContent = 'Added!';
    setTimeout(function () { refreshButton(addBtn); }, 1000);
  });

  document.addEventListener('change', function (e) {
    var qtyInput = e.target.closest('.quick-add-wrap .qty-input');
    if (!qtyInput) return;
    var max = qtyInput.getAttribute('max');
    var val = parseInt(qtyInput.value, 10) || 1;
    if (max !== null) val = Math.min(val, parseInt(max, 10));
    qtyInput.value = String(Math.max(1, val));
  });

  window.addEventListener('cart:change', refreshAll);
  refreshAll();
})();
