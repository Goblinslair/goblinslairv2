(function () {
  var controls = document.querySelector('.cart-controls');
  if (!controls || !window.GLCart) return;

  var stockRaw = controls.dataset.stock;
  var stock = stockRaw === '' ? null : parseInt(stockRaw, 10);

  var product = {
    slug: controls.dataset.slug,
    name: controls.dataset.name,
    price: parseFloat(controls.dataset.price),
    image: controls.dataset.image || null,
    stock: stock,
  };

  var qtyInput = controls.querySelector('.qty-input');
  var addBtn = controls.querySelector('.add-to-cart-btn');
  var goToCartBtn = controls.querySelector('.go-to-cart-btn');

  // Remaining is stock minus whatever's already sitting in the cart for
  // this product, so the stepper never lets a customer add more than the
  // POS actually has.
  function remaining() {
    if (stock === null) return Infinity;
    var existing = window.GLCart.readCart().find(function (i) { return i.slug === product.slug; });
    return Math.max(0, stock - (existing ? existing.qty : 0));
  }

  function refresh() {
    goToCartBtn.hidden = window.GLCart.getCount() === 0;

    var left = remaining();
    if (left <= 0) {
      qtyInput.value = '0';
      qtyInput.disabled = true;
      addBtn.disabled = true;
      addBtn.textContent = 'Max in Cart';
    } else {
      qtyInput.disabled = false;
      addBtn.disabled = false;
      if (stock !== null) qtyInput.setAttribute('max', String(left));
      if (parseInt(qtyInput.value, 10) > left || !qtyInput.value) qtyInput.value = String(Math.min(1, left));
    }
  }

  controls.querySelector('[data-qty-decrease]').addEventListener('click', function () {
    qtyInput.value = String(Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1));
  });
  controls.querySelector('[data-qty-increase]').addEventListener('click', function () {
    qtyInput.value = String(Math.min(remaining(), (parseInt(qtyInput.value, 10) || 1) + 1));
  });
  qtyInput.addEventListener('change', function () {
    var val = parseInt(qtyInput.value, 10) || 1;
    qtyInput.value = String(Math.max(1, Math.min(val, remaining())));
  });

  addBtn.addEventListener('click', function () {
    var qty = Math.max(1, Math.min(parseInt(qtyInput.value, 10) || 1, remaining()));
    window.GLCart.addItem(product, qty);
    addBtn.textContent = 'Added!';
    setTimeout(function () { addBtn.textContent = 'Add to Cart'; refresh(); }, 1200);
  });

  window.addEventListener('cart:change', refresh);
  refresh();
})();
