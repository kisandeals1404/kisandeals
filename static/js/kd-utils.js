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

  w.kdInitAmazonCards = function(root) {
    (root || document).querySelectorAll('a[rel~="sponsored"] img').forEach(function(img) {
      if (img.getAttribute('data-kd-amz-checked')) return;
      img.setAttribute('data-kd-amz-checked', '1');
      img.addEventListener('error', function() { kdAmzFallback(img); });
      if (img.complete) {
        kdAmzCheck(img);
      } else {
        img.addEventListener('load', function() { kdAmzCheck(img); });
      }
    });
  };

  document.addEventListener('DOMContentLoaded', function() { w.kdInitAmazonCards(); });

  // Some pages (e.g. the weather widget) build a sponsored card client-side after
  // initial render — watch for those insertions too instead of requiring every
  // such page to remember to call kdInitAmazonCards() itself.
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
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

}(window));
