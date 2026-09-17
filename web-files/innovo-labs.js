/* ==========================================================================
   INNOVO LABS — Microsite behaviour
   Power Pages · upload as Web File: innovo-labs.js
   Load with <script src="..." defer></script>

   No dependencies. No build step. Nothing inline — so this survives a
   strict Content-Security-Policy, which Power Pages tenants often run.

   Every module is independent and exits quietly if its markup is absent,
   so a page that has no carousel simply skips the carousel.
   ========================================================================== */
(function () {
  'use strict';

  /* -------------------------------------------------------------
     FIRST STATEMENT, deliberately.

     All the scroll-reveal CSS is scoped to `.js`. Setting the class
     here — before anything can throw, and before first paint — means
     a later error, a CSP block or a slow network degrades to "the
     page doesn't animate" rather than "the page is blank".
     ------------------------------------------------------------- */
  document.documentElement.classList.add('js');

  /* -------------------------------------------------------------
     Shared helpers
     ------------------------------------------------------------- */
  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  // Live query — a user can flip the OS setting without reloading the page.
  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  function reduced() { return motionQuery.matches; }

  // expo.out — the same curve as the CSS --ease token and the internal portal
  function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }

  function onReady(fn) {
    if (document.readyState !== 'loading') { fn(); }
    else { document.addEventListener('DOMContentLoaded', fn); }
  }

  /* -------------------------------------------------------------
     1 · SCROLL REVEAL
     Adds .is-visible once, then stops observing. Elements never
     re-animate on scroll-back — replaying reveals is the single
     fastest way to make a page feel cheap.
     ------------------------------------------------------------- */
  function initReveal() {
    var targets = $$('[data-reveal]');
    if (!targets.length) return;

    // No IntersectionObserver (or motion is off) → just show everything.
    if (!('IntersectionObserver' in window) || reduced()) {
      targets.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    // Stagger index within each group, so siblings cascade rather than
    // all firing together.
    $$('[data-reveal-group]').forEach(function (group) {
      $$('[data-reveal]', group).forEach(function (el, i) {
        el.style.setProperty('--i', i);
      });
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
      });
    }, {
      // Fire slightly before the element reaches the fold so the
      // animation is already underway when it becomes visible.
      //
      // threshold is 0, NOT a fraction. With threshold 0.05 and a
      // negative rootMargin, elements taller than the remaining root
      // could never reach the ratio and stayed hidden permanently —
      // whole sections rendered blank. Any intersecting pixel now counts.
      rootMargin: '0px 0px -8% 0px',
      threshold: 0
    });

    function reveal(el) {
      el.classList.add('is-visible');
      io.unobserve(el);
    }

    targets.forEach(function (el) { io.observe(el); });

    /* Backstop.

       The content is the point; the animation is decoration. If the
       observer misses an element for any reason — fast scrolling, a
       resize mid-load, an element taller than the viewport — the reader
       must never be left with an invisible section.

       On each scroll (throttled to one rAF) anything whose top has
       passed the bottom of the viewport is revealed regardless. */
    var ticking = false;
    function sweep() {
      ticking = false;
      var limit = window.innerHeight;
      targets.forEach(function (el) {
        if (el.classList.contains('is-visible')) return;
        if (el.getBoundingClientRect().top < limit) reveal(el);
      });
    }
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(sweep);
    }, { passive: true });
    window.addEventListener('resize', sweep, { passive: true });
    sweep();
  }

  /* -------------------------------------------------------------
     2 · HERO HEADLINE
     Splits the title into words, each masked by its own overflow
     box, then raises them on a stagger. Words are used rather than
     characters so screen readers still announce real words.
     ------------------------------------------------------------- */
  function initHeroTitle() {
    var title = $('[data-split]');
    if (!title) return;

    if (reduced()) { title.classList.add('is-revealed'); return; }

    // Preserve the accessible text before we shred the DOM.
    var plain = title.textContent.trim();
    title.setAttribute('aria-label', plain);

    var built = '';
    var index = 0;

    // Walk top-level nodes so <span class="accent"> survives the split.
    Array.prototype.forEach.call(title.childNodes, function (node) {
      var isEl  = node.nodeType === 1;
      var text  = (node.textContent || '').trim();
      if (!text) return;

      var cls = isEl ? node.className : '';
      text.split(/\s+/).forEach(function (word) {
        built += '<span class="word" aria-hidden="true">' +
                   '<span class="word__i" style="--i:' + index + '"' +
                     (cls ? ' class="' + cls + '"' : '') + '>' +
                     (cls ? '<span class="' + cls + '">' + word + '</span>' : word) +
                   '</span>' +
                 '</span> ';
        index++;
      });
    });

    title.innerHTML = built;

    // Next frame, so the browser paints the "before" state first.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { title.classList.add('is-revealed'); });
    });
  }

  /* -------------------------------------------------------------
     3 · STICKY HEADER
     Glass background only once the hero is behind us. Uses a
     sentinel + IntersectionObserver rather than a scroll listener,
     so nothing runs on the main thread while scrolling.
     ------------------------------------------------------------- */
  function initHeader() {
    var header = $('.site-header');
    if (!header) return;

    /* The 80vh sentinel is measured against the HOME hero, which is tall
       enough that a transparent header reads as deliberate. Every other page
       starts its content immediately below the header, so the same delay left
       the wordmark floating over headings and body text for most of a screen.

       With no hero, go solid almost at once. */
    var hasHero = !!$('.hero');
    var trip = hasHero ? '80vh' : '8px';

    var sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:' + trip + ';pointer-events:none;';
    document.body.prepend(sentinel);

    /* Without a hero the header should already be solid on first paint,
       rather than waiting for the observer's first callback. */
    if (!hasHero) header.classList.add('is-stuck');

    if (!('IntersectionObserver' in window)) { header.classList.add('is-stuck'); return; }

    new IntersectionObserver(function (entries) {
      header.classList.toggle('is-stuck', !entries[0].isIntersecting);
    }, { threshold: 0 }).observe(sentinel);
  }

  /* -------------------------------------------------------------
     4 · MOBILE NAV
     ------------------------------------------------------------- */
  /* ---------- Logo returns you to the hero ----------
     From an inner page the logo must still navigate home, so this only
     intercepts when it points at the page you are already on. There it
     would otherwise reload the whole document to reach content already
     above you — this scrolls instead.

     No behavior is passed to scrollTo: 'auto' defers to the CSS
     scroll-behavior, which is smooth normally and instant under
     prefers-reduced-motion. One rule, honoured in both places. */
  function initLogoHome() {
    var logo = $('.nav__logo');
    if (!logo) return;

    logo.addEventListener('click', function (e) {
      if (logo.pathname !== location.pathname) return;   // inner page → navigate
      e.preventDefault();
      window.scrollTo({ top: 0, left: 0 });

      /* Drop any #section left in the address bar, or a later refresh
         would land back down the page rather than at the hero. */
      if (location.hash && history.replaceState) {
        history.replaceState(null, '', location.pathname + location.search);
      }
    });
  }

  function initNav() {
    var toggle = $('.nav__toggle');
    var links  = $('.nav__links');
    if (!toggle || !links) return;

    function setOpen(open) {
      links.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    }

    toggle.addEventListener('click', function () {
      setOpen(!links.classList.contains('is-open'));
    });

    // Close on navigation, on Escape, and when growing past the breakpoint.
    $$('.nav__link', links).forEach(function (a) {
      a.addEventListener('click', function () { setOpen(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && links.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
    window.matchMedia('(min-width: 901px)').addEventListener('change', function (e) {
      if (e.matches) setOpen(false);
    });
  }

  /* -------------------------------------------------------------
     5 · COUNTERS
     Counts up when the tracker scrolls into view. Formats with
     thousands separators and honours a decimals attribute.
     Under reduced motion the final value is written immediately —
     the number is information, so it must never be withheld.
     ------------------------------------------------------------- */
  function initCounters() {
    var nodes = $$('[data-count]');
    if (!nodes.length) return;

    function format(value, decimals) {
      return value.toLocaleString('en-GB', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    }

    function run(el) {
      var target   = parseFloat(el.getAttribute('data-count')) || 0;
      var decimals = parseInt(el.getAttribute('data-decimals'), 10) || 0;
      var duration = parseInt(el.getAttribute('data-duration'), 10) || 1600;

      if (reduced()) { el.textContent = format(target, decimals); return; }

      var start = null;
      function step(ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / duration, 1);
        el.textContent = format(target * easeOutExpo(p), decimals);
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = format(target, decimals); // land exactly
      }
      requestAnimationFrame(step);
    }

    if (!('IntersectionObserver' in window)) { nodes.forEach(run); return; }

    var started = [];

    function start(el) {
      if (started.indexOf(el) !== -1) return;
      started.push(el);
      run(el);
      io.unobserve(el);
    }

    /* threshold 0, not 0.4. A counter sitting inside a grid taller than
       the viewport could never reach 40% intersection, so it stayed at
       "0" forever — the tracker rendered every figure as zero, which is
       worse than showing nothing at all. */
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) start(entry.target);
      });
    }, { threshold: 0 });

    nodes.forEach(function (el) {
      el.textContent = '0';
      io.observe(el);
    });

    /* Same backstop as the reveal observer: a number the reader can see
       must never be stuck at zero just because the observer missed it. */
    var ticking = false;
    function sweep() {
      ticking = false;
      var limit = window.innerHeight;
      nodes.forEach(function (el) {
        if (started.indexOf(el) !== -1) return;
        if (el.getBoundingClientRect().top < limit) start(el);
      });
    }
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(sweep);
    }, { passive: true });
    sweep();
  }

  /* -------------------------------------------------------------
     6 · CARD TEASER CLIPS
     The clip carries preload="none", so nothing is fetched until
     the pointer has rested for 150ms. Scrolling past a grid of
     twelve cards therefore downloads nothing at all.

     Touch devices have no hover, so there we play the clip when
     the card is well inside the viewport instead.
     ------------------------------------------------------------- */
  function initCardClips() {
    var cards = $$('.card[data-clip]');
    if (!cards.length || reduced()) return;

    var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    function play(card) {
      var video = $('.card__clip', card);
      if (!video) return;
      card.classList.add('is-playing');
      var p = video.play();
      // Autoplay can still be refused; swallow it rather than throwing.
      if (p && p.catch) p.catch(function () { card.classList.remove('is-playing'); });
    }

    function stop(card) {
      var video = $('.card__clip', card);
      if (!video) return;
      card.classList.remove('is-playing');
      video.pause();
      video.currentTime = 0;
    }

    if (canHover) {
      cards.forEach(function (card) {
        var timer = null;
        card.addEventListener('mouseenter', function () {
          timer = setTimeout(function () { play(card); }, 150); // intent delay
        });
        card.addEventListener('mouseleave', function () {
          clearTimeout(timer);
          stop(card);
        });
        // Keyboard users get the same affordance.
        card.addEventListener('focusin',  function () { play(card); });
        card.addEventListener('focusout', function () { stop(card); });
      });
      return;
    }

    if (!('IntersectionObserver' in window)) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) play(entry.target);
        else stop(entry.target);
      });
    }, { threshold: 0.6 });

    cards.forEach(function (card) { io.observe(card); });
  }

  /* -------------------------------------------------------------
     7 · QUOTE CAROUSEL
     Auto-advances, pauses on hover/focus, supports arrow keys and
     swipe. Auto-advance is disabled entirely under reduced motion.
     ------------------------------------------------------------- */
  function initQuotes() {
    var root = $('[data-quotes]');
    if (!root) return;

    var slides = $$('.quote', root);
    var dots   = $$('.quote-dot', root);
    if (slides.length < 2) return;

    var index = 0;
    var timer = null;
    var DELAY = 7000;

    // Portraits live outside .quote so they can cross-fade in their own
    // stacked box; they are advanced in lockstep with the text.
    var portraits = $$('.quotes__portrait', root);

    function show(next) {
      index = (next + slides.length) % slides.length;
      slides.forEach(function (s, i) {
        var on = i === index;
        s.classList.toggle('is-active', on);
        s.setAttribute('aria-hidden', String(!on));
      });
      portraits.forEach(function (p, i) { p.classList.toggle('is-active', i === index); });
      dots.forEach(function (d, i) { d.setAttribute('aria-selected', String(i === index)); });
    }

    function start() {
      if (reduced()) return;
      stop();
      timer = setInterval(function () { show(index + 1); }, DELAY);
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () { show(i); start(); });
    });

    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    root.addEventListener('focusin',  stop);
    root.addEventListener('focusout', start);

    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { show(index + 1); start(); }
      if (e.key === 'ArrowLeft')  { show(index - 1); start(); }
    });

    // Swipe
    var startX = null;
    root.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    root.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 45) show(index + (dx < 0 ? 1 : -1));
      startX = null;
    }, { passive: true });

    show(0);
    start();
  }

  /* -------------------------------------------------------------
     8 · COUNTDOWN
     Reads the deadline from data-countdown (ISO date).
     Campaign closes 30 Nov 2026 per the brief.
     ------------------------------------------------------------- */
  /* ---------- Cursor-following spotlight ----------
     Ported from the internal portal's cardSpotlight so the two properties
     behave identically: --mx / --my carry the cursor position as a
     percentage of the card, and CSS paints a radial highlight there.

     Bound once per element (data-spotlight-on guards re-init, since
     innovoRefresh re-runs this after cards are injected). Reads are
     batched into rAF — mousemove fires far faster than the screen
     refreshes, and setting a custom property each time forces style
     recalculation on every event. */
  function initSpotlight() {
    if (reduced()) return;

    $$('[data-spotlight]').forEach(function (el) {
      if (el.getAttribute('data-spotlight-on')) return;
      el.setAttribute('data-spotlight-on', '1');

      var queued = false, x = 0, y = 0;

      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        x = ((e.clientX - r.left) / r.width) * 100;
        y = ((e.clientY - r.top) / r.height) * 100;
        if (queued) return;
        queued = true;
        requestAnimationFrame(function () {
          el.style.setProperty('--mx', x + '%');
          el.style.setProperty('--my', y + '%');
          queued = false;
        });
      });

      // Reset so the next hover fades in from above rather than from
      // wherever the cursor happened to leave.
      el.addEventListener('mouseleave', function () {
        el.style.removeProperty('--mx');
        el.style.removeProperty('--my');
      });
    });
  }

  function initCountdown() {
    var root = $('[data-countdown]');
    if (!root) return;

    var deadline = new Date(root.getAttribute('data-countdown')).getTime();
    if (isNaN(deadline)) return;

    var out = {
      days:    $('[data-cd="days"]', root),
      hours:   $('[data-cd="hours"]', root),
      minutes: $('[data-cd="minutes"]', root),
      seconds: $('[data-cd="seconds"]', root)
    };
    var closed = $('[data-cd-closed]', root);
    // Anything that must disappear once entries close — the submit button.
    // The admin switch in Site Config is the real control; this only covers
    // the hours between the deadline passing and someone flipping it.
    var hideOnClose = $$('[data-cd-hide]', root);

    function pad(n) { return n < 10 ? '0' + n : String(n); }

    function tick() {
      var diff = deadline - Date.now();

      if (diff <= 0) {
        if (closed) closed.hidden = false;
        hideOnClose.forEach(function (el) { el.hidden = true; });
        Object.keys(out).forEach(function (k) { if (out[k]) out[k].textContent = '00'; });
        clearInterval(iv);
        return;
      }

      var s = Math.floor(diff / 1000);
      if (out.days)    out.days.textContent    = String(Math.floor(s / 86400));
      if (out.hours)   out.hours.textContent   = pad(Math.floor(s / 3600) % 24);
      if (out.minutes) out.minutes.textContent = pad(Math.floor(s / 60) % 60);
      if (out.seconds) out.seconds.textContent = pad(s % 60);
    }

    tick();
    var iv = setInterval(tick, 1000);
  }

  /* -------------------------------------------------------------
     9 · MARQUEE
     Duplicates the track so the -50% keyframe loops seamlessly.
     The clone is hidden from assistive tech to avoid a double read.
     ------------------------------------------------------------- */
  /* Reveals the initiative cards held back past the ninth. The reveal observer
     has already passed over them by the time they unhide, so their transition
     attributes are stripped and the class applied directly — otherwise they
     would sit at opacity 0 waiting for an intersection that never comes. */
  function initMoreInitiatives() {
    $$('[data-init-more]').forEach(function (btn) {
      if (btn.dataset.wired === 'true') return;
      btn.dataset.wired = 'true';
      btn.addEventListener('click', function () {
        var section = btn.closest('section');
        var grid = section && section.querySelector('[data-init-grid]');
        if (!grid) return;
        var hidden = grid.querySelectorAll('.initiative-card.is-more');
        Array.prototype.forEach.call(hidden, function (card) {
          card.classList.remove('is-more');
          /* Dropping the attribute removes the .js [data-reveal] rule that holds
             it at opacity 0 — no class needed, and no wait for an observer that
             has already run past this part of the page. */
          card.removeAttribute('data-reveal');
        });
        var wrap = btn.parentNode;
        if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
      });
    });
  }

  function initMarquee() {
    $$('.marquee').forEach(function (marquee) {
      var track = $('.marquee__track', marquee);
      if (!track || track.dataset.cloned === 'true') return;
      if (reduced()) return;

      var clone = track.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      Array.prototype.forEach.call(clone.querySelectorAll('a'), function (a) {
        a.setAttribute('tabindex', '-1');
      });

      /* Both halves must animate as one unit for the seam to be invisible,
         so they go inside a max-content wrapper.

         That wrapper must NOT be .marquee itself. Setting width:max-content
         on the container made it as wide as its contents — 3000px — which
         defeated its own overflow:hidden and pushed the whole document
         sideways on narrow screens. .marquee stays at its parent's width
         and does the clipping; the inner track scrolls inside it. */
      var inner = document.createElement('div');
      inner.className = 'marquee__inner';
      track.parentNode.insertBefore(inner, track);
      inner.appendChild(track);
      inner.appendChild(clone);
      track.dataset.cloned = 'true';

      /* The animation is declared in CSS on .marquee__inner. Setting it here as
         well is harmless but redundant — left out so there is one place to
         change the duration. */
    });
  }

  /* -------------------------------------------------------------
     10 · HERO VIDEO GUARD
     Autoplay is refused in some corporate policy configurations and
     in Low Power Mode. If the video never starts, fall back to the
     poster rather than leaving a frozen first frame.
     ------------------------------------------------------------- */
  function initHeroVideo() {
    var video = $('.hero__media video');
    if (!video) return;

    if (reduced()) { video.remove(); return; }

    var p = video.play();
    if (p && p.catch) {
      p.catch(function () {
        video.style.display = 'none'; // poster <img> underneath takes over
      });
    }

    // Don't burn battery or decode cycles while the tab is hidden.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) video.pause();
      else { var r = video.play(); if (r && r.catch) r.catch(function () {}); }
    });
  }

  /* -------------------------------------------------------------
     11 · NEWS FILTER + LOAD MORE
     Progressive enhancement over real links. Without JS the filters
     are ordinary hrefs that reload the page with ?category=… and
     "Load more" simply isn't shown. With JS, both work in place.

     Reads the Power Pages Web API, which requires the Site Settings
     entries listed in SETUP.md §6.
     ------------------------------------------------------------- */
  function initNews() {
    var grid = $('[data-news-grid]');
    if (!grid) return;

    var loadBtn = $('[data-load-more]');
    var status  = $('[data-load-status]');
    var filters = $$('[data-filters] .filter');

    var API = '/_api/innovo_newsposts';
    var SELECT = ['innovo_newspostid', 'innovo_title', 'innovo_slug', 'innovo_summary',
                  'innovo_category', 'innovo_publishedon', 'innovo_author',
                  'innovo_readminutes', 'innovo_thumbnailurl',
                  'innovo_thumbnailvideourl', 'innovo_hasvideo'].join(',');

    function esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function fmtDate(iso) {
      if (!iso) return '';
      var d = new Date(iso);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    // Mirrors the markup of the Innovo News Card web template. If that
    // template changes, change this too — they must stay in step.
    function cardHTML(p) {
      var id  = p.innovo_newspostid;
      var img = p.innovo_thumbnailurl ||
                (API + '(' + id + ')/innovo_thumbnail/$value');
      var clip = p.innovo_thumbnailvideourl;

      return '' +
        '<article class="card' + (clip ? '" data-clip="' : '') + '" data-reveal>' +
          '<div class="card__media">' +
            '<img src="' + esc(img) + '" alt="" loading="lazy" decoding="async" width="800" height="450">' +
            (clip
              ? '<video class="card__clip" muted loop playsinline preload="none" aria-hidden="true" tabindex="-1">' +
                  '<source src="' + esc(clip) + '" type="video/mp4"></video>'
              : '') +
            '<span class="card__badge">' + esc(p.innovo_category || 'Update') + '</span>' +
            (p.innovo_hasvideo
              ? '<span class="card__play" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>'
              : '') +
          '</div>' +
          '<div class="card__body">' +
            '<p class="card__meta"><time>' + esc(fmtDate(p.innovo_publishedon)) + '</time>' +
              (p.innovo_author ? '<span class="dot"></span><span>' + esc(p.innovo_author) + '</span>' : '') +
            '</p>' +
            // Must match innovo-news-card.liquid exactly, or cards added by
            // "Load more" would link somewhere different to the first page.
            // Query string because Power Pages rejects a {slug} wildcard in
            // the Partial Url field.
            '<h3 class="card__title"><a class="card__link" href="/news/article?slug=' +
              encodeURIComponent(p.innovo_slug || id) + '">' + esc(p.innovo_title) + '</a></h3>' +
            (p.innovo_summary ? '<p class="card__excerpt">' + esc(p.innovo_summary) + '</p>' : '') +
            '<div class="card__foot">' +
              '<span class="link-arrow">Read <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span>' +
              (p.innovo_readminutes ? '<span>' + esc(p.innovo_readminutes) + ' min read</span>' : '') +
            '</div>' +
          '</div>' +
        '</article>';
    }

    function query(skip, size, category) {
      var filter = "statuscode eq 1";
      if (category) filter += " and innovo_category eq '" + category.replace(/'/g, "''") + "'";
      return API +
        '?$select=' + SELECT +
        '&$filter=' + encodeURIComponent(filter) +
        '&$orderby=innovo_publishedon desc' +
        '&$top=' + size +
        '&$skip=' + skip;
    }

    function append(items) {
      var frag = document.createDocumentFragment();
      var box  = document.createElement('div');
      box.innerHTML = items.map(cardHTML).join('');
      while (box.firstChild) frag.appendChild(box.firstChild);
      grid.appendChild(frag);

      // Newly injected cards need the same observers as the originals.
      initReveal();
      initCardClips();
    }

    function fetchPage(skip, size, category, done) {
      fetch(query(skip, size, category), {
        headers: { 'Accept': 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' }
      })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function (d) { done(null, d.value || []); })
        .catch(function (e) { done(e); });
    }

    /* ---- Load more ---- */
    if (loadBtn) {
      loadBtn.addEventListener('click', function () {
        var skip = parseInt(loadBtn.getAttribute('data-skip'), 10) || 0;
        var size = parseInt(loadBtn.getAttribute('data-size'), 10) || 9;
        var cat  = loadBtn.getAttribute('data-category') || '';

        loadBtn.disabled = true;
        loadBtn.textContent = 'Loading…';

        fetchPage(skip, size, cat, function (err, items) {
          loadBtn.disabled = false;
          loadBtn.textContent = 'Load more';

          if (err) {
            // Never leave the reader stuck — fall back to a full page load.
            window.location.href = '/news' + (cat ? '?category=' + encodeURIComponent(cat) : '');
            return;
          }

          append(items);
          loadBtn.setAttribute('data-skip', skip + items.length);
          if (status) status.textContent = items.length + ' more stories loaded.';

          // Nothing left — retire the button rather than let it no-op.
          if (items.length < size) loadBtn.remove();
        });
      });
    }

    /* ---- Category filter ---- */
    filters.forEach(function (link) {
      link.addEventListener('click', function (e) {
        // Let modified clicks (new tab, etc.) behave normally.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();

        var cat = link.getAttribute('data-cat') || '';
        filters.forEach(function (f) {
          f.setAttribute('aria-pressed', String(f === link));
        });

        grid.style.opacity = '0.4';
        fetchPage(0, 9, cat, function (err, items) {
          grid.style.opacity = '';
          if (err) { window.location.href = link.href; return; }

          grid.innerHTML = '';
          if (items.length) {
            append(items);
          } else {
            grid.innerHTML =
              '<div class="empty" style="grid-column:1/-1">' +
                '<p style="color:var(--text-soft)">Nothing in “' + esc(cat) + '” yet.</p>' +
              '</div>';
          }

          if (loadBtn) {
            loadBtn.setAttribute('data-skip', String(items.length));
            loadBtn.setAttribute('data-category', cat);
            loadBtn.style.display = items.length < 9 ? 'none' : '';
          }
          if (status) status.textContent = items.length + ' stories shown.';

          // Keep the URL shareable and Back working as readers expect.
          history.replaceState({}, '', cat ? '/news?category=' + encodeURIComponent(cat) : '/news');
        });
      });
    });
  }

  /* =============================================================
     EXTENDED MOTION
     Scroll-linked and pointer-driven. Every writer below touches
     only transform / opacity / a custom property, and every scroll
     handler is throttled to one animation frame.
     ============================================================= */

  /* -------------------------------------------------------------
     12 · SCROLL PROGRESS + HERO PARALLAX
     Both are driven from one rAF-throttled scroll listener, so the
     page never runs two competing handlers.
     ------------------------------------------------------------- */
  function initScrollMotion() {
    if (reduced()) return;

    var bar = document.createElement('div');
    bar.className = 'scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);

    var heroContent = $('.hero__content');
    var heroMedia   = $('.hero__media');
    var ticking = false;

    function frame() {
      ticking = false;
      var y      = window.scrollY || window.pageYOffset;
      var max    = document.documentElement.scrollHeight - window.innerHeight;
      var pct    = max > 0 ? Math.min(y / max, 1) : 0;

      bar.style.transform = 'scaleX(' + pct + ')';

      /* Hero drifts up at 30% of scroll speed and dims out. Anchored to
         viewport height so it behaves the same on a laptop and a 4K
         monitor rather than being tuned to one screen. */
      if (heroContent) {
        var vh = window.innerHeight;
        var p  = Math.min(y / vh, 1);
        heroContent.style.transform = 'translate3d(0,' + (y * 0.3) + 'px,0)';
        heroContent.style.opacity   = String(Math.max(1 - p * 1.15, 0));
      }
      if (heroMedia) {
        heroMedia.style.transform = 'translate3d(0,' + (y * 0.12) + 'px,0)';
      }
    }

    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(frame);
    }, { passive: true });

    window.addEventListener('resize', frame, { passive: true });
    frame();
  }

  /* -------------------------------------------------------------
     13 · SECTION TITLES — word reveal
     Same masking as the hero headline, but triggered by the reveal
     observer so each section performs as it arrives.
     ------------------------------------------------------------- */
  function initTitleSplit() {
    if (reduced()) return;

    $$('.section-title').forEach(function (title) {
      if (title.dataset.split === 'done') return;
      // Skip anything containing markup — splitting would destroy it.
      if (title.children.length) return;

      var text = title.textContent.trim();
      if (!text) return;

      title.setAttribute('aria-label', text);
      title.innerHTML = text.split(/\s+/).map(function (w, i) {
        return '<span class="word" aria-hidden="true">' +
                 '<span class="word__i" style="--i:' + i + '">' + w + '</span>' +
               '</span>';
      }).join(' ');
      title.dataset.split = 'done';

      // Titles not inside a [data-reveal] wrapper need their own trigger.
      if (!title.closest('[data-reveal]') && 'IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (e) {
          if (e[0].isIntersecting) { title.classList.add('is-visible'); io.disconnect(); }
        }, { threshold: 0 });
        io.observe(title);
      }
    });
  }

  /* -------------------------------------------------------------
     14 · CARD TILT
     Writes --rx / --ry / --ty / --sc; the CSS composes them into one
     transform. Fine pointers only — on touch this would fire on every
     tap and feel broken.
     ------------------------------------------------------------- */
  function initTilt() {
    if (reduced()) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    var MAX = 4;   // degrees. Beyond ~5 it stops reading as depth and
                   // starts reading as a wobble.

    $$('.card, .person, .pillar').forEach(function (el) {
      var raf = null;

      el.addEventListener('pointermove', function (e) {
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = null;
          var r  = el.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width  - 0.5;
          var py = (e.clientY - r.top)  / r.height - 0.5;
          el.style.setProperty('--ry', (px *  MAX).toFixed(2) + 'deg');
          el.style.setProperty('--rx', (py * -MAX).toFixed(2) + 'deg');
          el.style.setProperty('--ty', '-5px');
          el.style.setProperty('--sc', '1.012');
        });
      });

      el.addEventListener('pointerleave', function () {
        if (raf) { cancelAnimationFrame(raf); raf = null; }
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
        el.style.setProperty('--ty', '0px');
        el.style.setProperty('--sc', '1');
      });
    });
  }

  /* -------------------------------------------------------------
     15 · MAGNETIC BUTTONS
     The control drifts a few pixels toward the cursor. Capped at 6px —
     any further and it starts dodging the pointer, which is worse than
     no effect at all.
     ------------------------------------------------------------- */
  function initMagnetic() {
    if (reduced()) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    var PULL = 6;

    $$('.btn, .page-back').forEach(function (el) {
      /* The idea form ships its own buttons and reuses the class name .btn.
         Magnetising a control someone is filling a 20-question form with
         makes the page feel unstable — the button slides away from the
         pointer on approach. Marketing buttons want the flourish; form
         controls want to stay still. */
      if (el.closest('.ilf')) return;

      var raf = null;

      el.addEventListener('pointermove', function (e) {
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = null;
          var r = el.getBoundingClientRect();
          el.classList.add('is-magnetic');
          el.style.setProperty('--mx', (((e.clientX - r.left) / r.width  - 0.5) * PULL * 2).toFixed(1) + 'px');
          el.style.setProperty('--my', (((e.clientY - r.top)  / r.height - 0.5) * PULL).toFixed(1) + 'px');
        });
      });

      el.addEventListener('pointerleave', function () {
        if (raf) { cancelAnimationFrame(raf); raf = null; }
        el.classList.remove('is-magnetic');
        el.style.setProperty('--mx', '0px');
        el.style.setProperty('--my', '0px');
      });
    });
  }

  /* -------------------------------------------------------------
     Boot
     ------------------------------------------------------------- */
  onReady(function () {
    initHeader();
    initNav();
    initLogoHome();
    initHeroTitle();
    initHeroVideo();
    initTitleSplit();   // before initReveal, so split words are in place
    initReveal();
    initScrollMotion();
    initTilt();
    initMagnetic();
    initCounters();
    initCardClips();
    initQuotes();
    initCountdown();
    initMarquee();
    initMoreInitiatives();
    initNews();
    initSpotlight();

    /* Re-scan for reveal targets and teaser clips. Anything that injects
       cards after load — the Web API "Load more", or a future filter —
       calls this so new nodes get the same observers as the originals. */
    window.innovoRefresh = function () {
      initTitleSplit();
      initReveal();
      initCardClips();
      initTilt();
      initMagnetic();
      initSpotlight();
    };
  });
})();
