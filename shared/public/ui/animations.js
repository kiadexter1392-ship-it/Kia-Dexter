/**
 * باشگاه آنلاین ارسلان دوجو — انیمیشن‌ها و افکت‌های پیشرفته
 * 
 * کتابخانه‌های استفاده‌شده:
 * 1. Lenis      → اسکرول نرم
 * 2. GSAP       → انیمیشن‌های پیشرفته
 * 3. Muuri      → المان‌های قابل جابجایی
 * 4. Barba.js   → ترنزیشن بین صفحات
 */

(function () {
  'use strict';

  /* ============================================================
     1. Lenis — Smooth Scrolling
     ============================================================ */
  window.initLenis = function initLenis() {
    if (typeof Lenis === 'undefined') return;
    
    const lenis = new Lenis({
      duration: 1.2,
      easing: function(t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smooth: true,
      smoothTouch: false,
      touchMultiplier: 2,
    });

    // Sync Lenis with GSAP ScrollTrigger
    if (typeof gsap !== 'undefined') {
      gsap.ticker.add(function(time) {
        lenis.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(function(link) {
      link.addEventListener('click', function (e) {
        const target = this.getAttribute('href');
        if (target === '#') return;
        const el = document.querySelector(target);
        if (el) {
          e.preventDefault();
          lenis.scrollTo(el, { offset: -80 });
        }
      });
    });

    window.lenis = lenis;
    console.log('[Dojo] Lenis initialized ✓');
  };

  /* ============================================================
     2. GSAP — Advanced Animations
     ============================================================ */
  window.initGSAP = function initGSAP() {
    if (typeof gsap === 'undefined') return;

    // Register plugins if available
    if (typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);
    }

    // Hero entrance animation
    animateHero();

    // Scroll-triggered section animations
    animateSections();

    // 3D cube animation
    animateCube();

    // Button hover effects
    animateButtons();

    console.log('[Dojo] GSAP animations initialized ✓');
  };

  function animateHero() {
    const hero = document.querySelector('.dojo-hero');
    if (!hero) return;

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.from('.dojo-brand', { y: -30, opacity: 0, duration: 0.8 }, 0)
      .from('.dojo-links a', { y: -20, opacity: 0, stagger: 0.1, duration: 0.6 }, 0.2)
      .from('.dojo-title', { y: 50, opacity: 0, duration: 1 }, 0.4)
      .from('.dojo-subtitle', { y: 30, opacity: 0, duration: 0.8 }, 0.7)
      .from('.dojo-cta .dojo-btn', { y: 20, opacity: 0, stagger: 0.15, duration: 0.6 }, 1)
      .from('.dojo-cube', { rotation: 180, opacity: 0, duration: 1.2, ease: 'power2.out' }, 0.3)
      .from('.dojo-3d-panel', { y: 60, opacity: 0, stagger: 0.2, duration: 0.9 }, 0.6);
  }

  function animateSections() {
    if (typeof ScrollTrigger === 'undefined') return;

    const sections = document.querySelectorAll('.dojo-section, .dojo-auth-section');
    sections.forEach(section => {
      gsap.from(section, {
        scrollTrigger: {
          trigger: section,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
        y: 50,
        opacity: 0,
        duration: 1,
        ease: 'power2.out',
      });
    });

    // Animate pricing cards
    const priceCards = document.querySelectorAll('.dojo-price-card');
    if (priceCards.length > 0) {
      gsap.from(priceCards, {
        scrollTrigger: {
          trigger: priceCards[0],
          start: 'top 90%',
        },
        y: 40,
        opacity: 0,
        stagger: 0.15,
        duration: 0.8,
        ease: 'back.out(1.2)',
      });
    }

    // Animate FAQ items
    const faqItems = document.querySelectorAll('.dojo-faq-item');
    if (faqItems.length > 0) {
      gsap.from(faqItems, {
        scrollTrigger: {
          trigger: faqItems[0],
          start: 'top 90%',
        },
        x: -30,
        opacity: 0,
        stagger: 0.1,
        duration: 0.6,
        ease: 'power2.out',
      });
    }

    // Animate support cards
    const supportCards = document.querySelectorAll('.dojo-support-card');
    if (supportCards.length > 0) {
      gsap.from(supportCards, {
        scrollTrigger: {
          trigger: supportCards[0],
          start: 'top 90%',
        },
        scale: 0.9,
        opacity: 0,
        stagger: 0.2,
        duration: 0.7,
        ease: 'back.out(1.4)',
      });
    }

    // Animate bank cards
    const bankCards = document.querySelectorAll('.dojo-bank-card');
    if (bankCards.length > 0) {
      gsap.from(bankCards, {
        scrollTrigger: {
          trigger: bankCards[0],
          start: 'top 90%',
        },
        rotationY: 90,
        opacity: 0,
        stagger: 0.2,
        duration: 0.9,
        ease: 'power2.out',
      });
    }
  }

  function animateCube() {
    const cube = document.getElementById('heroCube');
    if (!cube || typeof gsap === 'undefined') return;

    // Continuous floating animation
    gsap.to(cube, {
      y: -15,
      duration: 2.5,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });

    // Slow rotation
    gsap.to(cube, {
      rotationY: 360,
      duration: 20,
      ease: 'none',
      repeat: -1,
    });

    // Mouse interaction
    const scene = cube.closest('.dojo-scene');
    if (scene) {
      scene.addEventListener('mousemove', (e) => {
        const rect = scene.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) / 20;
        const y = (e.clientY - rect.top - rect.height / 2) / 20;
        
        gsap.to(cube, {
          rotationX: y,
          rotationY: x,
          duration: 0.5,
          ease: 'power2.out',
        });
      });

      scene.addEventListener('mouseleave', () => {
        gsap.to(cube, {
          rotationX: 0,
          rotationY: 0,
          duration: 0.8,
          ease: 'power2.out',
        });
      });
    }
  }

  function animateButtons() {
    const buttons = document.querySelectorAll('.dojo-btn');
    buttons.forEach(btn => {
      // Don't add GSAP hover to form submit buttons (causes click issues)
      if (btn.type === 'submit' || btn.closest('form')) return;
      btn.addEventListener('mouseenter', function () {
        gsap.to(this, { scale: 1.05, duration: 0.3, ease: 'power2.out' });
      });
      btn.addEventListener('mouseleave', function () {
        gsap.to(this, { scale: 1, duration: 0.3, ease: 'power2.out' });
      });
    });
  }

  /* ============================================================
     3. Muuri — Draggable/Reorderable Elements
     ============================================================ */
  window.initMuuri = function initMuuri() {
    if (typeof Muuri === 'undefined') return;

    // Make 3D panels draggable
    const panelsContainer = document.querySelector('.dojo-3d-scene');
    if (panelsContainer && panelsContainer.children.length > 0) {
      setupDraggablePanels(panelsContainer);
    }

    // Note: Pricing grid uses CSS grid (Muuri disabled to avoid click interference)

    console.log('[Dojo] Muuri drag initialized ✓');
  }

  function setupDraggableGrid(container) {
    const grid = new Muuri(container, {
      items: '.dojo-price-card',
      layout: { fillGaps: false, horizontal: false, alignRight: false, alignBottom: false },
      dragEnabled: true,
      dragContainer: document.body,
      dragStartPredicate: { distance: 5, delay: 100 },
      dragRelease: { duration: 300, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' },
    });

    // Add visual feedback
    grid.on('dragStart', function (item) {
      gsap.to(item.getElement(), { scale: 1.08, boxShadow: '0 20px 40px rgba(212,168,83,0.3)', duration: 0.3 });
    });

    grid.on('dragEnd', function (item) {
      gsap.to(item.getElement(), { scale: 1, boxShadow: 'none', duration: 0.3 });
    });

    container._muuri = grid;
  }

  function setupDraggablePanels(container) {
    const panels = container.querySelectorAll('.dojo-3d-panel');
    if (panels.length === 0) return;

    panels.forEach(panel => {
      let isDragging = false;
      let startX, startY, currentX = 0, currentY = 0;

      panel.addEventListener('mousedown', dragStart);
      panel.addEventListener('touchstart', dragStart, { passive: false });

      function dragStart(e) {
        isDragging = true;
        const point = e.touches ? e.touches[0] : e;
        startX = point.clientX - currentX;
        startY = point.clientY - currentY;
        panel.style.cursor = 'grabbing';
        gsap.to(panel, { scale: 1.1, duration: 0.2 });
        
        document.addEventListener('mousemove', dragMove);
        document.addEventListener('mouseup', dragEnd);
        document.addEventListener('touchmove', dragMove, { passive: false });
        document.addEventListener('touchend', dragEnd);
      }

      function dragMove(e) {
        if (!isDragging) return;
        e.preventDefault();
        const point = e.touches ? e.touches[0] : e;
        currentX = point.clientX - startX;
        currentY = point.clientY - startY;
        gsap.to(panel, { x: currentX, y: currentY, duration: 0.1 });
      }

      function dragEnd() {
        isDragging = false;
        panel.style.cursor = 'grab';
        gsap.to(panel, { scale: 1, x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)' });
        
        document.removeEventListener('mousemove', dragMove);
        document.removeEventListener('mouseup', dragEnd);
        document.removeEventListener('touchmove', dragMove);
        document.removeEventListener('touchend', dragEnd);
      }
    });
  }

  /* ============================================================
     4. Barba.js — Page Transitions
     ============================================================ */
  window.initBarba = function initBarba() {
    if (typeof barba === 'undefined') return;

    barba.init({
      transitions: [{
        name: 'fade-transition',
        leave(data) {
          return gsap.to(data.current.container, {
            opacity: 0,
            duration: 0.4,
            ease: 'power2.inOut',
          });
        },
        enter(data) {
          gsap.from(data.next.container, {
            opacity: 0,
            y: 30,
            duration: 0.6,
            ease: 'power2.out',
          });
        },
      }],
    });

    console.log('[Dojo] Barba.js transitions initialized ✓');
  }

  /* ============================================================
     Additional: Parallax on Scroll
     ============================================================ */
  function initParallax() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    // Hero background parallax
    const heroBg = document.querySelector('.dojo-hero-bg');
    if (heroBg) {
      gsap.to(heroBg, {
        scrollTrigger: {
          trigger: '.dojo-hero',
          start: 'top top',
          end: 'bottom top',
          scrub: 1,
        },
        y: 100,
        opacity: 0.5,
      });
    }

    // Depth layers parallax
    const depthLayers = document.querySelectorAll('.dojo-depth-layer');
    depthLayers.forEach((layer, i) => {
      const speed = (i + 1) * 30;
      gsap.to(layer, {
        scrollTrigger: {
          trigger: '.dojo-hero',
          start: 'top top',
          end: 'bottom top',
          scrub: 1,
        },
        y: speed,
      });
    });
  }

  /* ============================================================
     Additional: Magnetic Cursor Effect on Buttons
     ============================================================ */
  function initMagneticCursor() {
    const magneticElements = document.querySelectorAll('.dojo-btn-primary, .dojo-btn-gold');
    magneticElements.forEach(el => {
      // Skip form submit buttons
      if (el.type === 'submit' || el.closest('form')) return;
      el.addEventListener('mousemove', function (e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        gsap.to(this, { x: x * 0.3, y: y * 0.3, duration: 0.3, ease: 'power2.out' });
      });
      el.addEventListener('mouseleave', function () {
        gsap.to(this, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
      });
    });
  }

  /* ============================================================
     Additional: Scroll Progress Indicator
     ============================================================ */
  window.initScrollProgress = function initScrollProgress() {
    const bar = document.getElementById('scrollProgress');
    if (!bar) return;

    function update() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      bar.style.width = progress + '%';
    }

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

})();
