/* ارسلان دوجو — افکت‌های تعاملی */
(function (root) {
  'use strict';
  var Dojo3D = {};

  Dojo3D.init = function () {
    // اسکرول نرم
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var href = a.getAttribute('href');
        if (href && href.length > 1) {
          var target = document.querySelector(href);
          if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            var links = document.getElementById('dojoLinks');
            if (links) links.classList.remove('open');
          }
        }
      });
    });

    // ناوبری
    var nav = document.getElementById('dojoNav');
    if (nav) {
      window.addEventListener('scroll', function () {
        if (window.pageYOffset > 80) {
          nav.style.background = 'rgba(8,8,12,0.92)';
        } else {
          nav.style.background = '';
        }
      }, { passive: true });
    }

    // پارالاکس مکعب
    var cube = document.getElementById('heroCube');
    if (cube) {
      window.addEventListener('scroll', function () {
        var s = window.pageYOffset;
        if (s < window.innerHeight) {
          cube.parentElement.style.transform = 'translate(-50%,-50%) scale(' + (1 - s * 0.0004) + ')';
          cube.parentElement.style.opacity = String(1 - s * 0.001);
        }
      }, { passive: true });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { Dojo3D.init(); });
  }

  root.Dojo3D = Dojo3D;
}(window));
