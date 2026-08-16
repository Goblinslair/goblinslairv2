(function () {
  var itemsEl = document.getElementById('cart-items');
  var emptyEl = document.getElementById('cart-empty');
  var summaryEl = document.getElementById('cart-summary');
  var subtotalEl = document.getElementById('cart-subtotal-value');
  if (!itemsEl || !window.GLCart) return;

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function render() {
    var items = window.GLCart.readCart();
    itemsEl.innerHTML = '';

    if (!items.length) {
      emptyEl.hidden = false;
      summaryEl.hidden = true;
      return;
    }
    emptyEl.hidden = true;
    summaryEl.hidden = false;

    var subtotal = 0;
    items.forEach(function (item) {
      subtotal += item.price * item.qty;

      var row = document.createElement('div');
      row.className = 'cart-row';
      row.innerHTML =
        '<div class="cart-row-img" style="' + (item.image ? 'background-image:url(' + item.image + ');background-size:contain;background-repeat:no-repeat;background-position:center;' : '') + '"></div>' +
        '<div class="cart-row-body"><h3>' + escapeHtml(item.name) + '</h3><span class="price">RM' + item.price.toFixed(2) + '</span></div>' +
        '<div class="qty-stepper"><button type="button" class="qty-btn" data-decrease aria-label="Decrease quantity">&minus;</button>' +
        '<input type="number" class="qty-input" value="' + item.qty + '" min="1"' + (item.stock !== null && item.stock !== undefined ? ' max="' + item.stock + '"' : '') + ' aria-label="Quantity">' +
        '<button type="button" class="qty-btn" data-increase aria-label="Increase quantity">&plus;</button></div>' +
        '<span class="cart-row-total">RM' + (item.price * item.qty).toFixed(2) + '</span>' +
        '<button type="button" class="cart-row-remove" aria-label="Remove ' + escapeHtml(item.name) + '">&times;</button>';

      var qtyInput = row.querySelector('.qty-input');
      row.querySelector('[data-decrease]').addEventListener('click', function () {
        window.GLCart.updateQty(item.slug, item.qty - 1);
      });
      row.querySelector('[data-increase]').addEventListener('click', function () {
        window.GLCart.updateQty(item.slug, item.qty + 1);
      });
      qtyInput.addEventListener('change', function () {
        var val = parseInt(qtyInput.value, 10);
        window.GLCart.updateQty(item.slug, isNaN(val) ? 0 : val);
      });
      row.querySelector('.cart-row-remove').addEventListener('click', function () {
        window.GLCart.removeItem(item.slug);
      });

      itemsEl.appendChild(row);
    });

    subtotalEl.textContent = 'RM' + subtotal.toFixed(2);
  }

  window.addEventListener('cart:change', render);
  render();
})();
