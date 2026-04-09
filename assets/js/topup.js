(function () {
  const API_URL = '/.netlify/functions/paymongo-topup';

  const state = {
    identified: false,
    username: '',
    userId: '',
    offers: [],
    selectedOfferId: '',
    busy: false
  };

  function sanitizeText(value, maxLength) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, maxLength);
  }

  function isValidUsername(value) {
    return /^[A-Za-z0-9_.\- ]{3,32}$/.test(value);
  }

  function isValidUserId(value) {
    return /^[A-Za-z0-9_\-]{3,40}$/.test(value);
  }

  function getPaymentMethod() {
    const selected = document.querySelector('input[name="paymentMethod"]:checked');
    return selected ? selected.value : '';
  }

  function formatPeso(value) {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0
    }).format(Number(value || 0));
  }

  function formatWholeNumber(value) {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0
    }).format(Math.max(0, Number(value || 0)));
  }

  function formatCredits(value) {
    return `${formatWholeNumber(value)} Credits`;
  }

  function getStoredUser() {
    const raw = localStorage.getItem('mathwizard_current_user');
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function getSessionUser() {
    return window.authService?.getCurrentUser?.() || getStoredUser() || null;
  }

  function extractBalance(user) {
    if (!user || typeof user !== 'object') {
      return {
        gold: 0
      };
    }

    const currency = user.currency && typeof user.currency === 'object' ? user.currency : {};

    const gold = Number(
      user.gold
      ?? currency.gold
      ?? 0
    );

    return {
      gold: Number.isFinite(gold) ? gold : 0
    };
  }

  function renderCurrentBalance() {
    const goldEl = document.getElementById('balance-gold');
    const messageEl = document.getElementById('balance-message');

    if (!goldEl || !messageEl) {
      return;
    }

    const user = getStoredUser();
    if (!user) {
      goldEl.textContent = '0';
      messageEl.textContent = 'Sign in to load your account balance.';
      messageEl.className = 'text-xs min-h-[1.25rem] mt-3 text-gray-300';
      return;
    }

    const balance = extractBalance(user);
    goldEl.textContent = formatWholeNumber(balance.gold);
    messageEl.textContent = 'Loaded from your current account session.';
    messageEl.className = 'text-xs min-h-[1.25rem] mt-3 text-ncst-neon';
  }

  function readDisplayedGold() {
    const goldEl = document.getElementById('balance-gold');
    return Number(String(goldEl?.textContent || '0').replace(/,/g, '')) || 0;
  }

  function updateStoredUserGold(nextGold) {
    const stored = getStoredUser();
    if (!stored) {
      return;
    }

    stored.gold = nextGold;
    if (stored.currency && typeof stored.currency === 'object') {
      stored.currency.gold = nextGold;
    }

    localStorage.setItem('mathwizard_current_user', JSON.stringify(stored));
  }

  function updateCachedPlayerGold(userId, nextGold) {
    const key = `player_${userId}`;
    const raw = sessionStorage.getItem(key);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      parsed.currency = parsed.currency || {};
      parsed.currency.gold = nextGold;
      sessionStorage.setItem(key, JSON.stringify(parsed));
    } catch (error) {
      // Ignore invalid session cache payloads.
    }
  }

  async function refreshBalanceFromFirestore() {
    const messageEl = document.getElementById('balance-message');
    const goldEl = document.getElementById('balance-gold');

    if (!messageEl || !goldEl) {
      return false;
    }

    const user = getSessionUser();
    const userId = sanitizeText(user?.id || '', 40);
    if (!userId) {
      messageEl.textContent = 'No active account session found.';
      messageEl.className = 'text-xs min-h-[1.25rem] mt-3 text-red-300';
      return false;
    }

    try {
      const db = window.firebaseDb;
      if (!db) {
        messageEl.textContent = 'Firebase is not ready yet. Please retry.';
        messageEl.className = 'text-xs min-h-[1.25rem] mt-3 text-red-300';
        return false;
      }

      const [playerDoc, userDoc] = await Promise.all([
        db.collection('players').doc(userId).get(),
        db.collection('users').doc(userId).get()
      ]);

      const playerGold = playerDoc.exists ? Number(playerDoc.data()?.currency?.gold) : NaN;
      const userGold = userDoc.exists ? Number(userDoc.data()?.gold) : NaN;

      const gold = Number.isFinite(playerGold)
        ? playerGold
        : Number.isFinite(userGold)
          ? userGold
          : Number(user?.gold ?? 0);

      const safeGold = Number.isFinite(gold) ? Math.max(0, gold) : 0;

      goldEl.textContent = formatWholeNumber(safeGold);
      updateStoredUserGold(safeGold);
      updateCachedPlayerGold(userId, safeGold);

      messageEl.textContent = 'Synced from live account data.';
      messageEl.className = 'text-xs min-h-[1.25rem] mt-3 text-ncst-neon';
      return true;
    } catch (error) {
      console.error('Balance refresh failed:', error);
      messageEl.textContent = 'Unable to sync live balance right now.';
      messageEl.className = 'text-xs min-h-[1.25rem] mt-3 text-red-300';
      return false;
    }
  }

  function wireBalanceRefreshButton() {
    const button = document.getElementById('refresh-balance-btn');
    if (!button) {
      return;
    }

    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Refreshing...';

      const ok = await refreshBalanceFromFirestore();

      button.disabled = false;
      button.textContent = 'Refresh Balance';

      if (ok) {
        showStatus('Balance refreshed from server.', 'success');
      }
    });
  }

  function getStatusFromQueryString() {
    const params = new URLSearchParams(window.location.search);
    return params.get('status') || '';
  }

  async function refreshAfterSuccessfulCheckout() {
    if (getStatusFromQueryString() !== 'success') {
      return;
    }

    const previousGold = readDisplayedGold();
    const maxAttempts = 6;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await refreshBalanceFromFirestore();
      const currentGold = readDisplayedGold();

      if (currentGold > previousGold) {
        showStatus('Payment confirmed and balance updated.', 'success');
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  function showStatus(message, type) {
    const banner = document.getElementById('status-banner');
    if (!banner) {
      return;
    }

    banner.textContent = message;
    banner.classList.remove('hidden', 'border-ncst-neon', 'border-ncst-accent', 'border-red-500', 'text-ncst-neon', 'text-ncst-accent', 'text-red-300');

    if (type === 'success') {
      banner.classList.add('border-ncst-neon', 'text-ncst-neon');
    } else if (type === 'error') {
      banner.classList.add('border-red-500', 'text-red-300');
    } else {
      banner.classList.add('border-ncst-accent', 'text-ncst-accent');
    }
  }

  function getSelectedOffer() {
    return state.offers.find((offer) => offer.id === state.selectedOfferId) || null;
  }

  function updateSummary() {
    const summaryEmpty = document.getElementById('summary-empty');
    const summaryFilled = document.getElementById('summary-filled');
    const checkoutButton = document.getElementById('checkout-btn');
    const summaryOffer = document.getElementById('summary-offer');
    const summaryAmount = document.getElementById('summary-amount');
    const summaryMethod = document.getElementById('summary-method');

    const offer = getSelectedOffer();
    const method = getPaymentMethod();

    if (!offer) {
      summaryEmpty.classList.remove('hidden');
      summaryFilled.classList.add('hidden');
      checkoutButton.disabled = true;
      return;
    }

    summaryEmpty.classList.add('hidden');
    summaryFilled.classList.remove('hidden');
    summaryOffer.textContent = formatCredits(offer.credits);
    summaryAmount.textContent = formatPeso(offer.amountPhp);
    summaryMethod.textContent = method === 'paymaya' ? 'PayMaya' : 'GCash';
    checkoutButton.disabled = !state.identified || state.busy;
  }

  function renderOffers() {
    const offersGrid = document.getElementById('offers-grid');
    const offerCount = document.getElementById('offer-count');

    offersGrid.innerHTML = '';
    offerCount.textContent = `${state.offers.length} packages available`;

    state.offers.forEach((offer) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.offerId = offer.id;
      button.className = 'offer-card text-left parchment-panel p-4 border border-ncst-gold/30 hover:border-ncst-gold transition-all';
      button.innerHTML = `
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="font-heading text-white text-lg">${formatCredits(offer.credits)}</p>
            <p class="text-xs text-gray-300">Instantly delivered after confirmation</p>
          </div>
          <img src="../assets/img/currency-icon.png" alt="Currency icon" class="w-10 h-10 object-contain">
        </div>
        <div class="mt-4 flex items-center justify-between">
          <p class="text-ncst-gold font-bold text-xl">${formatPeso(offer.amountPhp)}</p>
          <span class="text-[0.65rem] uppercase tracking-[0.18em] text-ncst-neon border border-ncst-neon/30 px-2 py-1 bg-ncst-dark/40">Select</span>
        </div>
      `;

      button.addEventListener('click', () => {
        state.selectedOfferId = offer.id;
        document.querySelectorAll('.offer-card').forEach((item) => {
          item.classList.remove('ring-2', 'ring-ncst-gold', 'border-ncst-gold');
        });
        button.classList.add('ring-2', 'ring-ncst-gold', 'border-ncst-gold');
        updateSummary();
      });

      offersGrid.appendChild(button);
    });
  }

  function updatePaymentMethodStyles() {
    const options = document.querySelectorAll('.payment-method-option');
    options.forEach((option) => {
      const input = option.querySelector('input[name="paymentMethod"]');
      const active = Boolean(input?.checked);

      option.classList.toggle('border-ncst-gold', active);
      option.classList.toggle('bg-ncst-gold/10', active);
      option.classList.toggle('shadow-[0_0_16px_rgba(201,168,76,0.15)]', active);
      option.classList.toggle('border-ncst-neon/30', !active);
      option.classList.toggle('bg-ncst-dark/30', !active);
    });
  }

  async function loadOffers() {
    const response = await fetch(API_URL, { method: 'GET' });
    const payload = await response.json();

    if (!response.ok || !payload.ok || !Array.isArray(payload.offers)) {
      throw new Error(payload.error || 'Unable to load offers.');
    }

    state.offers = payload.offers;
    renderOffers();
  }

  function preloadIdentityFromSession() {
    const user = getSessionUser();
    if (!user) {
      return;
    }

    const username = sanitizeText(user?.username || user?.name || '', 32);
    const userId = sanitizeText(user?.id || '', 40);

    if (username) {
      document.getElementById('username').value = username;
    }
    if (userId) {
      const userIdInput = document.getElementById('user-id');
      userIdInput.value = userId;
      userIdInput.readOnly = true;
      userIdInput.classList.add('opacity-80', 'cursor-not-allowed');
    }
  }

  function wireIdentityForm() {
    const form = document.getElementById('identity-form');
    const message = document.getElementById('identity-message');

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const username = sanitizeText(document.getElementById('username').value, 32);
      const typedUserId = sanitizeText(document.getElementById('user-id').value, 40);
      const trustedUserId = sanitizeText(getSessionUser()?.id || '', 40);
      const userId = trustedUserId || typedUserId;

      if (!username || !userId) {
        state.identified = false;
        message.textContent = 'Username and User ID are required.';
        message.className = 'text-xs min-h-[1.25rem] text-red-300';
        updateSummary();
        return;
      }

      if (!isValidUsername(username)) {
        state.identified = false;
        message.textContent = 'Username must be 3-32 chars and only use letters, numbers, spaces, dot, underscore, or dash.';
        message.className = 'text-xs min-h-[1.25rem] text-red-300';
        updateSummary();
        return;
      }

      if (!isValidUserId(userId)) {
        state.identified = false;
        message.textContent = 'User ID must be 3-40 chars and only use letters, numbers, underscore, or dash.';
        message.className = 'text-xs min-h-[1.25rem] text-red-300';
        updateSummary();
        return;
      }

      state.identified = true;
      state.username = username;
      state.userId = userId;
      message.textContent = 'Identity validated. Select an offer and proceed to checkout.';
      message.className = 'text-xs min-h-[1.25rem] text-ncst-neon';
      updateSummary();
    });
  }

  function wirePaymentMethods() {
    document.querySelectorAll('input[name="paymentMethod"]').forEach((input) => {
      input.addEventListener('change', () => {
        updatePaymentMethodStyles();
        updateSummary();
      });
    });

    updatePaymentMethodStyles();
  }

  async function startCheckout() {
    const checkoutMessage = document.getElementById('checkout-message');
    const checkoutButton = document.getElementById('checkout-btn');

    const selectedOffer = getSelectedOffer();
    const paymentMethod = getPaymentMethod();

    if (!state.identified) {
      checkoutMessage.textContent = 'Confirm your Username and User ID first.';
      checkoutMessage.className = 'text-xs min-h-[1.25rem] mt-2 text-red-300';
      return;
    }

    if (!selectedOffer) {
      checkoutMessage.textContent = 'Please select a credit offer.';
      checkoutMessage.className = 'text-xs min-h-[1.25rem] mt-2 text-red-300';
      return;
    }

    if (!paymentMethod) {
      checkoutMessage.textContent = 'Please select a payment method.';
      checkoutMessage.className = 'text-xs min-h-[1.25rem] mt-2 text-red-300';
      return;
    }

    try {
      state.busy = true;
      checkoutButton.disabled = true;
      checkoutMessage.textContent = 'Preparing secure checkout...';
      checkoutMessage.className = 'text-xs min-h-[1.25rem] mt-2 text-ncst-neon';

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          username: state.username,
          userId: state.userId,
          offerId: selectedOffer.id,
          paymentMethod
        })
      });

      const payload = await response.json();
      if (!response.ok || !payload.ok || !payload.checkoutUrl) {
        throw new Error(payload.error || payload.message || 'Could not start checkout.');
      }

      window.location.href = payload.checkoutUrl;
    } catch (error) {
      checkoutMessage.textContent = String(error.message || 'Checkout failed. Please try again.');
      checkoutMessage.className = 'text-xs min-h-[1.25rem] mt-2 text-red-300';
      state.busy = false;
      updateSummary();
    }
  }

  function wireCheckoutButton() {
    const checkoutButton = document.getElementById('checkout-btn');
    checkoutButton.addEventListener('click', startCheckout);
  }

  function showStatusFromQueryString() {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');

    if (status === 'success') {
      showStatus('Checkout completed. Waiting for payment confirmation and balance update.', 'success');
    } else if (status === 'cancelled') {
      showStatus('Checkout was cancelled. You may select an offer again anytime.', 'info');
    }
  }

  async function init() {
    renderCurrentBalance();
    preloadIdentityFromSession();
    wireIdentityForm();
    wirePaymentMethods();
    wireCheckoutButton();
    wireBalanceRefreshButton();
    showStatusFromQueryString();
    await refreshBalanceFromFirestore();
    await refreshAfterSuccessfulCheckout();

    try {
      await loadOffers();
      updateSummary();
    } catch (error) {
      showStatus(String(error.message || 'Unable to load top-up offers.'), 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
