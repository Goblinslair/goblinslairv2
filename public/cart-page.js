(function () {
  var itemsEl = document.getElementById('cart-items');
  var emptyEl = document.getElementById('cart-empty');
  var summaryEl = document.getElementById('cart-summary');
  var subtotalEl = document.getElementById('cart-subtotal-value');
  var discountRow = document.getElementById('cart-discount-row');
  var discountLabelEl = document.getElementById('cart-discount-label');
  var discountValueEl = document.getElementById('cart-discount-value');
  var totalEl = document.getElementById('cart-total-value');
  var discountPercent = parseFloat(summaryEl && summaryEl.dataset.discountPercent) || 0;
  var shippingRow = document.getElementById('cart-shipping-row');
  var shippingValueEl = document.getElementById('cart-shipping-value');
  var deliveryFields = document.getElementById('delivery-fields');
  var fulfillmentNote = document.getElementById('fulfillment-note');
  var stateSelect = document.getElementById('ship-state');
  // Flat rate by region — mirrors src/lib/shipping.ts's RATES (that module
  // is server-only; this tiny duplicate is cheaper than a build step for
  // an is:inline script, and the state->region mapping itself still comes
  // from the server via each <option>'s data-region attribute, so only
  // this 2-entry rate table is duplicated, not the state list).
  var SHIPPING_RATES = { west: 10, east: 15 };

  function currentShippingCost() {
    if (!stateSelect || !isDelivery()) return 0;
    var opt = stateSelect.options[stateSelect.selectedIndex];
    var region = opt && opt.dataset.region;
    return region ? (SHIPPING_RATES[region] || 0) : 0;
  }

  function isDelivery() {
    var deliveryRadio = document.getElementById('fulfillment-delivery');
    return !!(deliveryRadio && deliveryRadio.checked);
  }

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
        '<div class="cart-row-img"></div>' +
        '<div class="cart-row-body"><h3>' + escapeHtml(item.name) + '</h3><span class="price">RM' + item.price.toFixed(2) + '</span></div>' +
        '<div class="qty-stepper"><button type="button" class="qty-btn" data-decrease aria-label="Decrease quantity">&minus;</button>' +
        '<input type="number" class="qty-input" value="' + item.qty + '" min="1"' + (item.stock !== null && item.stock !== undefined ? ' max="' + item.stock + '"' : '') + ' aria-label="Quantity">' +
        '<button type="button" class="qty-btn" data-increase aria-label="Increase quantity">&plus;</button></div>' +
        '<span class="cart-row-total">RM' + (item.price * item.qty).toFixed(2) + '</span>' +
        '<button type="button" class="cart-row-remove" aria-label="Remove ' + escapeHtml(item.name) + '">&times;</button>';

      // Set via the style property (parsed as CSS, not HTML) rather than
      // string-building it into the innerHTML above — a raw value there
      // could break out of the attribute and inject markup.
      if (item.image) {
        var imgEl = row.querySelector('.cart-row-img');
        imgEl.style.backgroundImage = 'url(' + item.image + ')';
        imgEl.style.backgroundSize = 'contain';
        imgEl.style.backgroundRepeat = 'no-repeat';
        imgEl.style.backgroundPosition = 'center';
      }

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

    var discountAmount = discountPercent > 0 ? subtotal * discountPercent / 100 : 0;
    if (discountPercent > 0) {
      discountRow.hidden = false;
      discountLabelEl.textContent = 'Member Discount (' + discountPercent + '%)';
      discountValueEl.textContent = '-RM' + discountAmount.toFixed(2);
    } else {
      discountRow.hidden = true;
    }

    // Shipping is never discounted — matches the server-side total math in
    // src/pages/api/checkout.ts (this is display-only; the server
    // recomputes the authoritative cost at checkout time either way).
    var shippingCost = currentShippingCost();
    if (shippingRow && shippingValueEl) {
      shippingRow.hidden = shippingCost <= 0;
      shippingValueEl.textContent = 'RM' + shippingCost.toFixed(2);
    }

    totalEl.textContent = 'RM' + (subtotal - discountAmount + shippingCost).toFixed(2);
  }

  if (deliveryFields) {
    document.querySelectorAll('input[name="fulfillment-method"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        deliveryFields.hidden = !isDelivery();
        if (fulfillmentNote) {
          fulfillmentNote.textContent = isDelivery()
            ? 'Pay online now, we’ll ship it to you.'
            : 'Pay online now, pick up in-store — no shipping.';
        }
        render();
      });
    });
  }
  if (stateSelect) stateSelect.addEventListener('change', render);

  window.addEventListener('cart:change', render);
  render();

  // Checkout button is a real <button> only for signed-in customers — the
  // signed-out state renders it as an <a href="/login?..."> instead (see
  // cart.astro), so this only wires up when there's something to click.
  var checkoutBtn = document.getElementById('cart-checkout-btn');
  if (checkoutBtn && checkoutBtn.tagName === 'BUTTON') {
    checkoutBtn.addEventListener('click', function () {
      var payload = { fulfillmentMethod: isDelivery() ? 'delivery' : 'pickup', shippingAddress: null };

      if (isDelivery()) {
        var line1 = document.getElementById('ship-line1').value.trim();
        var city = document.getElementById('ship-city').value.trim();
        var postcode = document.getElementById('ship-postcode').value.trim();
        var state = stateSelect.value;
        var phone = document.getElementById('ship-phone').value.trim();

        // Client-side check for a fast/clear error — the server repeats
        // this validation authoritatively either way (see checkout.ts).
        if (!line1 || !city || !postcode || !state || !phone) {
          window.alert('Please fill in your full delivery address.');
          return;
        }
        if (!/^\d{5}$/.test(postcode)) {
          window.alert('Postcode must be 5 digits.');
          return;
        }

        payload.shippingAddress = {
          line1: line1,
          line2: document.getElementById('ship-line2').value.trim(),
          city: city,
          postcode: postcode,
          state: state,
          phone: phone,
        };
      }

      checkoutBtn.disabled = true;
      checkoutBtn.textContent = 'Redirecting…';

      fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (result) {
          if (!result.ok) {
            window.alert(result.data.error || 'Something went wrong starting checkout.');
            checkoutBtn.disabled = false;
            checkoutBtn.textContent = 'Checkout';
            return;
          }
          // FIUU's hosted page needs a signed form POST, not a simple GET
          // redirect — build and auto-submit a hidden form.
          var form = document.createElement('form');
          form.method = 'POST';
          form.action = result.data.url;
          form.style.display = 'none';
          Object.keys(result.data.fields || {}).forEach(function (key) {
            var input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = result.data.fields[key];
            form.appendChild(input);
          });
          document.body.appendChild(form);
          form.submit();
        })
        .catch(function () {
          window.alert('Something went wrong. Please try again.');
          checkoutBtn.disabled = false;
          checkoutBtn.textContent = 'Checkout';
        });
    });
  }
})();
