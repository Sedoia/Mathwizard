(function () {
  const API_URL = '/.netlify/functions/paymongo-topup';
  const REVIEW_DRAFT_KEY = 'mw_topup_checkout_draft';

  const state = {
    busy: false,
    draft: null
  };

  function formatPeso(value) {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0
    }).format(Number(value || 0));
  }

  function formatCredits(value) {
    return `${new Intl.NumberFormat('en-US').format(Number(value || 0))} Aether`;
  }

  function getDraft() {
    const raw = sessionStorage.getItem(REVIEW_DRAFT_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function setMessage(message, isError) {
    const el = document.getElementById('review-message');
    if (!el) {
      return;
    }

    el.textContent = message;
    el.className = `text-xs min-h-[1.25rem] mt-4 ${isError ? 'text-red-300' : 'text-gray-300'}`;
  }

  function renderDraft(draft) {
    document.getElementById('review-username').textContent = draft.username || '-';
    document.getElementById('review-userid').textContent = draft.userId || '-';
    document.getElementById('review-offer').textContent = formatCredits(draft.offer?.credits || 0);
    document.getElementById('review-amount').textContent = formatPeso(draft.offer?.amountPhp || 0);
    document.getElementById('review-method').textContent = draft.paymentMethod === 'paymaya' ? 'PayMaya' : 'GCash';
  }

  function validateDraft(draft) {
    if (!draft) {
      return false;
    }

    return Boolean(
      draft.username
      && draft.userId
      && draft.offerId
      && draft.paymentMethod
      && draft.offer
      && Number(draft.offer.amountPhp) > 0
    );
  }

  async function startCheckout() {
    if (!state.draft || state.busy) {
      return;
    }

    const button = document.getElementById('review-checkout-btn');

    try {
      state.busy = true;
      button.disabled = true;
      setMessage('Preparing secure checkout...', false);

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          username: state.draft.username,
          userId: state.draft.userId,
          offerId: state.draft.offerId,
          paymentMethod: state.draft.paymentMethod
        })
      });

      const payload = await response.json();
      if (!response.ok || !payload.ok || !payload.checkoutUrl) {
        throw new Error(payload.error || payload.message || 'Could not start checkout.');
      }

      window.location.href = payload.checkoutUrl;
    } catch (error) {
      state.busy = false;
      button.disabled = false;
      setMessage(String(error.message || 'Checkout failed. Please try again.'), true);
    }
  }

  function init() {
    const draft = getDraft();
    const isValid = validateDraft(draft);

    const checkoutButton = document.getElementById('review-checkout-btn');
    const backButton = document.getElementById('review-back-btn');

    backButton.addEventListener('click', () => {
      window.location.href = 'top-up.html';
    });

    if (!isValid) {
      checkoutButton.disabled = true;
      setMessage('No valid order draft found. Return to Top-Up and set your order first.', true);
      return;
    }

    state.draft = draft;
    renderDraft(draft);
    checkoutButton.addEventListener('click', startCheckout);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
