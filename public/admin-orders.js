(function () {
  function wire(selector, action, confirmMessage, successMessage) {
    document.querySelectorAll(selector).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (confirmMessage && !window.confirm(confirmMessage)) return;
        btn.disabled = true;

        fetch('/api/admin/orders', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: parseInt(btn.dataset.orderId, 10), action: action })
        })
          .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
          .then(function (result) {
            if (!result.ok) {
              window.alert(result.data.error || 'Something went wrong.');
              btn.disabled = false;
              return;
            }
            if (successMessage && result.data.message) window.alert(result.data.message);
            window.location.reload();
          })
          .catch(function () {
            window.alert('Something went wrong. Please try again.');
            btn.disabled = false;
          });
      });
    });
  }

  wire('.admin-fulfill-btn', 'fulfill', 'Mark this order as picked up?', false);
  wire('.admin-retry-receipt-btn', 'retry-receipt', null, false);
  wire('.admin-reconcile-btn', 'reconcile', null, true);
})();
