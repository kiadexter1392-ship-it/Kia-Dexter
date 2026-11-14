/* ══ CardStack — Pricing Cards Fan ══
   Vanilla JS adaptation. No React hooks in loops.
   Cards fan out on hover with CSS transitions.
*/

(function() {
  'use strict';

  const CARD_W = 160;
  const CARD_H = 220;
  const STACK_OFFSET = 6;
  const FAN_ANGLE = 12;
  const FAN_SPREAD = 140;
  const LIFT = 20;

  function createCardStack(container, options) {
    if (!container) return;
    var cards = (options && options.cards) || [];
    var n = Math.min(cards.length, 6);
    if (n < 2) n = 2;

    /* Build stack container */
    var stack = document.createElement('div');
    stack.className = 'stk-cardstack';
    stack.style.cssText = 'position:relative;width:' + (FAN_SPREAD + 40) + 'px;height:' + (CARD_H + 60) + 'px;margin:30px auto;';

    /* Build each card */
    for (var i = 0; i < n; i++) {
      var card = cards[i] || { discipline: 'پلن ' + (i + 1), price: '—' };
      var el = document.createElement('div');
      el.className = 'stk-cs-card';

      /* Rest position: stacked with slight offset */
      var restOffsetY = -(n - 1 - i) * STACK_OFFSET;
      var restRotate = (i - (n - 1) / 2) * 2;

      /* Fan position */
      var fanX = (i - (n - 1) / 2) * (FAN_SPREAD / (n - 1 || 1));
      var fanRotate = (i - (n - 1) / 2) * FAN_ANGLE;

      el.innerHTML =
        '<div class="stk-cs-face">' +
          '<div class="stk-cs-num">' + (i + 1) + '</div>' +
          '<div class="stk-cs-body">' +
            '<div class="stk-cs-disc">' + escapeHtml(card.discipline) + '</div>' +
            '<div class="stk-cs-price">' + escapeHtml(card.price) + '</div>' +
            '<div class="stk-cs-unit">هزار تومان / ماه</div>' +
          '</div>' +
        '</div>';

      /* Set rest transform */
      el.style.cssText =
        'position:absolute;' +
        'left:' + ((FAN_SPREAD + 40 - CARD_W) / 2) + 'px;' +
        'top:' + (30 + CARD_H / 2 + restOffsetY) + 'px;' +
        'width:' + CARD_W + 'px;' +
        'height:' + CARD_H + 'px;' +
        'transform:translate(-50%,-50%) rotate(' + restRotate + 'deg);' +
        'transform-origin:50% ' + (CARD_H / 2 + 300) + 'px;' +
        'z-index:' + i + ';' +
        'transition:transform 0.5s cubic-bezier(0.4,0,0.2,1);';

      /* Hover: fan out */
      el.addEventListener('mouseenter', function() {
        var all = stack.querySelectorAll('.stk-cs-card');
        for (var j = 0; j < all.length; j++) {
          var fx = (j - (n - 1) / 2) * (FAN_SPREAD / (n - 1 || 1));
          var fr = (j - (n - 1) / 2) * FAN_ANGLE;
          var fy = 30 + CARD_H / 2 - (j === i ? LIFT : 0);
          all[j].style.transform =
            'translate(calc(-50% + ' + fx + 'px), calc(-50% - ' + (j === i ? LIFT : 0) + 'px)) rotate(' + fr + 'deg)';
          all[j].style.zIndex = j === i ? 100 : j;
        }
      });

      /* Leave: back to stack */
      el.addEventListener('mouseleave', function() {
        var all = stack.querySelectorAll('.stk-cs-card');
        for (var j = 0; j < all.length; j++) {
          var ro = -(n - 1 - j) * STACK_OFFSET;
          var rr = (j - (n - 1) / 2) * 2;
          all[j].style.transform =
            'translate(-50%, calc(-50% + ' + ro + 'px)) rotate(' + rr + 'deg)';
          all[j].style.zIndex = j;
        }
      });

      stack.appendChild(el);
    }

    container.appendChild(stack);
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Expose */
  window.CardStack = {
    mount: function(container, options) {
      createCardStack(container, options);
    }
  };

  /* Auto-init if element exists */
  if (document.readyState !== 'loading') {
    initIfReady();
  } else {
    document.addEventListener('DOMContentLoaded', initIfReady);
  }

  function initIfReady() {
    var root = document.getElementById('cardStackRoot');
    if (root && window.__cardStackData) {
      createCardStack(root, { cards: window.__cardStackData });
    }
  }
})();
