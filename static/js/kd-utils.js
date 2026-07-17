/* KisanDeals shared JS utilities — loaded on every page via base.ftl */
(function(w){
  'use strict';

  /** Title-case a string (word-boundary uppercase). */
  w.kdToTitle = function(s) {
    if (!s) return '';
    return s.toLowerCase().replace(/\b[a-z]/g, function(c){ return c.toUpperCase(); });
  };

  /** Capitalise first char, lowercase rest. */
  w.kdCap = function(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
  };

  /* ── Amazon affiliate card image fallback ──────────────────────────────
     Every affiliate product image sits inside an <a rel="...sponsored..."> —
     that's the one thing all ~13 templates that render these cards already
     have in common, so this scans for that pattern instead of needing a
     shared class/markup change in each template. Swaps the <img> for an
     orange Amazon-logo badge (.kd-amz-logo-fallback, styled in kisan.css)
     when the source image fails to load or its native resolution is too low
     for the slot it's rendered into (would otherwise look blurry/pixelated
     when the browser upscales it to fill the box). */
  var MIN_DISPLAY_PX = 100; // slots smaller than this always get the logo — even a sharp, high-res
                             // source (most of these are wide promo banners, not square product
                             // shots) becomes an unrecognizable sliver once squeezed into an icon
  var MIN_ABS_PX = 60;      // native resolution floor — catches a genuinely broken/placeholder
                             // image even when it's rendered into a slot ≥100px

  function kdAmzFallback(img) {
    if (!img || !img.parentNode) return;
    var rect = img.getBoundingClientRect();
    var span = document.createElement('span');
    span.className = (img.className ? img.className + ' ' : '') + 'kd-amz-logo-fallback';
    var style = img.getAttribute('style');
    if (style) span.setAttribute('style', style);
    var side = Math.max(12, Math.min((rect.width && rect.height ? Math.min(rect.width, rect.height) : 60) * 0.42, 48));
    span.style.fontSize = side + 'px';
    span.setAttribute('role', 'img');
    span.setAttribute('aria-label', img.alt || 'Amazon');
    span.innerHTML = '<i class="bi bi-amazon" aria-hidden="true"></i>';
    img.replaceWith(span);
  }

  function kdAmzCheck(img) {
    if (!img.naturalWidth || !img.naturalHeight) { kdAmzFallback(img); return; }
    if (img.naturalWidth < MIN_ABS_PX || img.naturalHeight < MIN_ABS_PX) { kdAmzFallback(img); return; }
    var rect = img.getBoundingClientRect();
    var w = rect.width || img.width || 0;
    var h = rect.height || img.height || 0;
    if (w > 0 && h > 0 && (w < MIN_DISPLAY_PX || h < MIN_DISPLAY_PX)) { kdAmzFallback(img); return; }
  }

  // Skips images still waiting on kdInitLazyImages (they carry data-src) —
  // checking now would read the 1x1 placeholder's natural size and fire a
  // false-positive fallback before the real photo ever loads. kdLoadLazyImg
  // calls this again once the real src is swapped in.
  function kdAmzCheckImg(img) {
    if (img.getAttribute('data-kd-amz-checked')) return;
    if (img.hasAttribute('data-src')) return;
    img.setAttribute('data-kd-amz-checked', '1');
    img.addEventListener('error', function() { kdAmzFallback(img); });
    if (img.complete) {
      kdAmzCheck(img);
    } else {
      img.addEventListener('load', function() { kdAmzCheck(img); });
    }
  }

  w.kdInitAmazonCards = function(root) {
    (root || document).querySelectorAll('a[rel~="sponsored"] img').forEach(kdAmzCheckImg);
  };

  /* ── Viewport-lazy images ────────────────────────────────────────────
     Templates emit <img src="{1x1 pixel}" data-src="{real url}"
     class="kd-lazy-img"> for anything below the fold (ad thumbnails,
     gallery/listing photos) instead of downloading every image up front.
     The shimmer background (.kd-lazy-img, kisan.css) stands in until the
     tag scrolls near the viewport, at which point the real URL swaps into
     src. rootMargin gives images a head start so they've finished
     decoding by the time they're actually scrolled into view. */
  function kdLoadLazyImg(img) {
    var real = img.getAttribute('data-src');
    if (!real) return;
    img.removeAttribute('data-src');
    img.addEventListener('load', function() { img.classList.add('kd-loaded'); }, { once: true });
    img.addEventListener('error', function() { img.classList.add('kd-loaded'); }, { once: true });
    img.src = real;
    if (img.closest('a[rel~="sponsored"]')) kdAmzCheckImg(img);
  }

  var kdLazyObserver = w.IntersectionObserver ? new w.IntersectionObserver(function(entries, obs) {
    entries.forEach(function(entry) {
      if (!entry.isIntersecting) return;
      obs.unobserve(entry.target);
      kdLoadLazyImg(entry.target);
    });
  }, { rootMargin: '200px 0px' }) : null;

  w.kdInitLazyImages = function(root) {
    (root || document).querySelectorAll('img[data-src]').forEach(function(img) {
      if (img.getAttribute('data-kd-lazy-observed')) return;
      img.setAttribute('data-kd-lazy-observed', '1');
      if (kdLazyObserver) {
        kdLazyObserver.observe(img);
      } else {
        kdLoadLazyImg(img);
      }
    });
  };

  document.addEventListener('DOMContentLoaded', function() {
    w.kdInitAmazonCards();
    w.kdInitLazyImages();
  });

  // Some pages (e.g. the weather widget) build a sponsored card, or other
  // lazy images, client-side after initial render — watch for those
  // insertions too instead of requiring every such page to remember to
  // call kdInitAmazonCards()/kdInitLazyImages() itself.
  if (w.MutationObserver) {
    new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType !== 1) continue;
          if ((n.matches && n.matches('a[rel~="sponsored"]')) ||
              (n.querySelector && n.querySelector('a[rel~="sponsored"] img'))) {
            w.kdInitAmazonCards(n.parentNode || document);
          }
          if ((n.matches && n.matches('img[data-src]')) ||
              (n.querySelector && n.querySelector('img[data-src]'))) {
            w.kdInitLazyImages(n.parentNode || document);
          }
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

}(window));
