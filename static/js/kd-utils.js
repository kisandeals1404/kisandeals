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

}(window));
