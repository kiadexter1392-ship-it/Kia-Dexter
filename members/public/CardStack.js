/* ══ CardStack — Pricing Cards Fan ══
   Vanilla JS adaptation. No React hooks in loops.
   Cards fan out on hover with CSS transitions.
*/

(function() {
  'use strict';

  const CARD_W = 160;
  const CARD_H = 220;
  const STACK_OFFSET = 6;
  const FAN_ANGLE = 10;
  const FAN_SPREAD = 200;
  const LIFT = 24;
  const PAD = 30;
  const CONTAINER_W = FAN_SPREAD + CARD_W + PAD * 2;
  const CONTAINER_H = CARD_H + PAD * 2 + 20;
  const PIVOT_Y = CARD_H + 200;

  function createCardStack(container, options) {
    if (!container) return;
    var cards = (options && options.cards) || [];
    var n = Math.min(cards.length, 6);
    if (n < 2) n = 2;

    /* Build stack container */
    var stack = document.createElement('div');
    stack.className = 'stk-cardstack';
    stack.style.cssText =
      'position:relative;' +
      'width:' + CONTAINER_W + 'px;' +
      'height:' + CONTAINER_H + 'px;' +
      'margin:30px auto;';

    var centerX = CONTAINER_W / 2;
    var centerY = CONTAINER_H / 2;

    /* Build each card */
    for (var i = 0; i < n; i++) {
      var card = cards[i] || { discipline: 'پلن ' + (i + 1), price: '—' };
      var el = document.createElement('div');
      el.className = 'stk-cs-card';

      /* Rest position: stacked with slight offset */
      var restOffsetY = -(n - 1 - i) * STACK_OFFSET;
      var restRotate = (i - (n - 1) / 2) * 1.5;

      el.innerHTML =
        '<div class="stk-cs-face">' +
          '<div class="stk-cs-num">' + (i + 1) + '</div>' +
          '<div class="stk-cs-body">' +
            '<div class="stk-cs-disc">' + escapeHtml(card.discipline) + '</div>' +
            '<div class="stk-cs-price">' + escapeHtml(card.price) + '</div>' +
            '<div class="stk-cs-unit">هزار تومان / ماه</div>' +
          '</div>' +
        '</div>';

      /* Position card centered in container with stack offset */
      el.style.cssText =
        'position:absolute;' +
        'left:' + centerX + 'px;' +
        'top:' + (centerY + restOffsetY) + 'px;' +
        'width:' + CARD_W + 'px;' +
        'height:' + CARD_H + 'px;' +
        'transform:translate(-50%,-50%) rotate(' + restRotate + 'deg);' +
        'transform-origin:50% ' + PIVOT_Y + 'px;' +
        'z-index:' + i + ';' +
        'transition:transform 0.5s cubic-bezier(0.4,0,0.2,1);';

      /* Hover: fan out */
      el.addEventListener('mouseenter', (function(idx) {
        return function() {
          var all = stack.querySelectorAll('.stk-cs-card');
          for (var j = 0; j < all.length; j++) {
            var fx = (j - (n - 1) / 2) * (FAN_SPREAD / (n - 1 || 1));
            var fr = (j - (n - 1) / 2) * FAN_ANGLE;
            var liftY = j === idx ? LIFT : 0;
            all[j].style.transform =
              'translate(calc(-50% + ' + fx + 'px), calc(-50% - ' + liftY + 'px)) rotate(' + fr + 'deg)';
            all[j].style.zIndex = j === idx ? 100 : j;
          }
        };
      })(i));

      /* Leave: back to stack */
      el.addEventListener('mouseleave', function() {
        var all = stack.querySelectorAll('.stk-cs-card');
        for (var j = 0; j < all.length; j++) {
          var ro = -(n - 1 - j) * STACK_OFFSET;
          var rr = (j - (n - 1) / 2) * 1.5;
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
})();
