/* OTP input auto-advance + backspace + paste handler */
(function () {
  'use strict';

  function initOtpInputs(container) {
    const inputs = Array.from(container.querySelectorAll('.kd-otp-input'));
    if (!inputs.length) return;

    inputs.forEach(function (input, idx) {
      input.addEventListener('input', function (e) {
        const val = e.target.value.replace(/\D/g, '').slice(-1);
        e.target.value = val;
        if (val && idx < inputs.length - 1) {
          inputs[idx + 1].focus();
        }
        syncHidden(container, inputs);
      });

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !e.target.value && idx > 0) {
          inputs[idx - 1].focus();
          inputs[idx - 1].value = '';
          syncHidden(container, inputs);
        }
      });
    });

    /* paste: distribute digits across boxes */
    inputs[0].addEventListener('paste', function (e) {
      e.preventDefault();
      const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '');
      digits.split('').slice(0, inputs.length).forEach(function (d, i) {
        inputs[i].value = d;
      });
      const next = Math.min(digits.length, inputs.length - 1);
      inputs[next].focus();
      syncHidden(container, inputs);
    });
  }

  function syncHidden(container, inputs) {
    const hidden = container.querySelector('[data-otp-value]');
    if (hidden) hidden.value = inputs.map(function (i) { return i.value; }).join('');
  }

  /* Init on DOM ready */
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-otp-container]').forEach(initOtpInputs);
  });

  /* Re-init after HTMX swaps new content in */
  document.addEventListener('htmx:afterSwap', function (e) {
    e.detail.target.querySelectorAll('[data-otp-container]').forEach(initOtpInputs);
  });
})();
