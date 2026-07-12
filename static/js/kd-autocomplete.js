/* KisanDeals autocomplete + dropdown data engine
   Usage: add data-kd-ac="commodity" on any <input>
   Optional: data-kd-ac-min="2" (min chars), data-kd-ac-limit="10" (max results)

   JSON shape (served from the CDN only — window.KD_CDN_URL + /autocomplete/{locale}.json):
     c   – [[value, display], …]          commodities with locale label

   State and APMC dropdown data is deliberately NOT part of this bundle — mandi
   price pages already do a full page reload on commodity/state selection, so
   those are populated on demand from /api/mandi/states and /api/mandi/apmcs
   instead of shipping every commodity×state×APMC combination to every browser.

   Public API (all async via callback):
     window.kdAcLoad(cb)                          – cb(data) once loaded
     window.kdAcGetStates(commodity, cb)          – cb([{value,display}, …])
     window.kdAcGetApmcsByState(comm, state, cb)  – cb([{value,display}, …])
     window.kdAcGetApmcs(commodity, cb)           – cb([{value,display}, …])
     window.kdAcGetAllApmcs(cb)                   – cb([{value,display}, …])
     window.kdAcRefresh()                         – clear cache, force reload
*/
(function(){
'use strict';

var LS_VERSION  = 6;
var LS_TTL_MS   = 7 * 24 * 60 * 60 * 1000; // 7 days
var _locale     = (document.documentElement.getAttribute('lang')||'en').replace(/-.*$/,'');
var _lsKey      = 'kd_ac_' + _locale;

var _cache      = null;   // parsed data object (live)
var _pending    = [];
var _loading    = false;

// ── localStorage helpers ────────────────────────────────────────────────────

function lsGet() {
  try {
    var raw = localStorage.getItem(_lsKey);
    if (!raw) return null;
    var wrap = JSON.parse(raw);
    if (wrap.v !== LS_VERSION) return null;
    if (Date.now() - wrap.ts > LS_TTL_MS) return null;
    // Invalidate if server rebuilt autocomplete since this was cached
    var serverVer = window.KD_AC_VERSION || 0;
    if (serverVer && wrap.sv !== serverVer) return null;
    return wrap.data;
  } catch(e) { return null; }
}

function lsSet(data) {
  try {
    localStorage.setItem(_lsKey, JSON.stringify({
      v: LS_VERSION, ts: Date.now(),
      sv: window.KD_AC_VERSION || 0,
      data: data
    }));
  } catch(e) { /* quota exceeded — silently ignore */ }
}

function lsClear() {
  try { localStorage.removeItem(_lsKey); } catch(e) {}
}

// ── Core load ───────────────────────────────────────────────────────────────

function load(cb) {
  if (_cache) { cb(_cache); return; }
  _pending.push(cb);
  if (_loading) return;
  _loading = true;

  // Try localStorage first (warm cache)
  var stored = lsGet();
  if (stored) {
    _cache   = stored;
    _loading = false;
    _pending.forEach(function(fn){ fn(stored); });
    _pending = [];
    return;
  }

  // Bots never use the autocomplete widget — skip the network fetch so
  // crawler traffic doesn't burn bandwidth/crawl budget on this JSON.
  if (window.KD_IS_BOT) {
    var empty = {c:[]};
    _cache   = empty;
    _loading = false;
    _pending.forEach(function(fn){ fn(empty); });
    _pending = [];
    return;
  }

  // Fetch — from jsDelivr ONLY (window.KD_CDN_URL, set in base.ftl). Deliberately
  // never falls back to our own /autocomplete endpoint — EC2 must not serve this
  // traffic. If no CDN is configured or the CDN fetch fails, autocomplete simply
  // has no data (see .catch below) rather than hitting EC2.
  // ?v= must match the preload link in head.ftl exactly (both derive from acVersion) —
  // otherwise the browser can't reuse the preloaded response and fetches twice. It also
  // forces the CDN to fetch fresh from origin whenever the admin rebuilds the autocomplete
  // data, instead of the version bump only being visible client-side while the CDN keeps
  // serving the old JSON body under an unchanged URL.
  var _cdnBase = window.KD_CDN_URL || '';
  var _fetchP = _cdnBase
    ? fetch(_cdnBase + '/autocomplete/' + _locale + '.json?v=' + (window.KD_AC_VERSION || 0))
        .then(function(r){ if (!r.ok) throw new Error('cdn fetch failed'); return r.json(); })
    : Promise.reject(new Error('no CDN configured'));

  _fetchP
    .then(function(data){
      _cache   = data;
      _loading = false;
      lsSet(data);
      _pending.forEach(function(fn){ fn(data); });
      _pending = [];
    })
    .catch(function(){
      var empty = {c:[]};
      _cache   = empty;
      _loading = false;
      _pending.forEach(function(fn){ fn(empty); });
      _pending = [];
    });
}

// ── Search (for commodity autocomplete inputs) ──────────────────────────────

function search(q, type, limit) {
  if (!_cache || !q || q.length < 1) return [];
  q = q.toLowerCase().trim();
  var items = _cache.c || [];
  var out = [];
  limit = limit || 10;
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var v  = it[0].toLowerCase();
    var l  = (it[1]||it[0]).toLowerCase();
    var score = 0;
    if (v===q||l===q)             score = 100;
    else if (v.startsWith(q))     score = 90;
    else if (l.startsWith(q))     score = 85;
    else if (v.indexOf(q) !== -1) score = 60;
    else if (l.indexOf(q) !== -1) score = 55;
    if (score > 0) out.push({v: it[0], l: it[1]||it[0], s: '', score: score});
  }
  out.sort(function(a, b){ return b.score - a.score; });
  return out.slice(0, limit);
}

// ── Dropdown DOM ─────────────────────────────────────────────────────────────

var _drop = null, _inp = null, _idx = -1;

function getDrop() {
  if (!_drop) {
    _drop = document.createElement('ul');
    _drop.id = 'kd-ac-drop';
    _drop.setAttribute('role', 'listbox');
    _drop.style.cssText =
      'position:fixed;z-index:1070;background:#fff;'
      + 'border:1.5px solid #C8E6C9;border-radius:10px;'
      + 'box-shadow:0 6px 24px rgba(0,0,0,.13);'
      + 'list-style:none;margin:0;padding:4px 0;'
      + 'max-height:240px;overflow-y:auto;min-width:180px;'
      + 'transition:opacity .12s;font-family:inherit;';
    document.body.appendChild(_drop);
  }
  return _drop;
}

function posit(input) {
  var r = input.getBoundingClientRect();
  var d = getDrop();
  d.style.top   = (r.bottom + 3) + 'px';
  d.style.left  = r.left + 'px';
  d.style.width = r.width + 'px';
}

function show(results, input) {
  var d = getDrop();
  d.innerHTML = '';
  _idx = -1;
  if (!results.length) { hide(); return; }
  results.forEach(function(r, i) {
    var li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.style.cssText =
      'padding:8px 13px;cursor:pointer;font-size:.84rem;'
      + 'line-height:1.35;border-radius:7px;margin:2px 4px;'
      + 'transition:background .1s;';
    var primary = r.l !== r.v
      ? '<span style="font-weight:600;color:#1a1a1a">' + esc(r.l) + '</span>'
        + '<span style="color:#777;font-size:.75rem"> &mdash; ' + esc(r.v) + '</span>'
      : '<span style="font-weight:600;color:#1a1a1a">' + esc(r.v) + '</span>';
    li.innerHTML = primary;
    li.dataset.v = r.v;
    li.dataset.l = r.l;
    li.addEventListener('mouseenter', function(){ hilite(i); });
    li.addEventListener('mousedown', function(e){ e.preventDefault(); pick(r, input); });
    li.addEventListener('touchstart', function(e){ e.preventDefault(); pick(r, input); }, {passive: false});
    d.appendChild(li);
  });
  posit(input);
  d.style.opacity = '1';
  d.style.display = 'block';
}

function hilite(idx) {
  if (!_drop) return;
  var items = _drop.querySelectorAll('li');
  items.forEach(function(li, i){
    li.style.background = i === idx ? '#E8F5E9' : '';
    li.style.color      = i === idx ? '#1B5E20' : '';
  });
  _idx = idx;
}

function hide() {
  if (_drop) { _drop.style.display = 'none'; _drop.innerHTML = ''; }
  _idx = -1;
}

function pick(r, input) {
  input.value = r.v;
  var did = input.dataset.kdAcDisplay;
  if (did) { var el = document.getElementById(did); if (el) el.value = r.l; }
  input.dispatchEvent(new Event('change', {bubbles: true}));
  input.dispatchEvent(new CustomEvent('kdAcSelect', {bubbles: true, detail: r}));
  hide();
  if (input.dataset.kdAcAutosubmit) {
    var form = input.form || input.closest('form');
    if (form) form.submit();
  }
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Attach to input ──────────────────────────────────────────────────────────

function attach(input) {
  if (input._kdAc) return;
  input._kdAc = true;
  var type  = input.dataset.kdAc;
  var min   = parseInt(input.dataset.kdAcMin)   || 2;
  var limit = parseInt(input.dataset.kdAcLimit) || 10;

  input.setAttribute('autocomplete', 'off');

  input.addEventListener('focus', function(){ load(function(){}); });

  input.addEventListener('input', function(){
    var q = input.value.trim();
    if (q.length < min) { hide(); return; }
    load(function(){ var r = search(q, type, limit); _inp = input; show(r, input); });
  });

  input.addEventListener('keydown', function(e){
    if (!_drop || _drop.style.display === 'none') return;
    var items = _drop.querySelectorAll('li');
    if (!items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); hilite(Math.min(_idx+1, items.length-1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); hilite(Math.max(_idx-1, 0)); }
    else if ((e.key === 'Enter' || e.key === 'Tab') && _idx >= 0) {
      e.preventDefault();
      var li = items[_idx];
      if (li) pick({v: li.dataset.v, l: li.dataset.l, s: ''}, input);
    }
    else if (e.key === 'Escape') { hide(); }
  });

  input.addEventListener('blur', function(){ setTimeout(hide, 180); });
}

function attachAll(root) {
  (root||document).querySelectorAll('[data-kd-ac]').forEach(attach);
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

function _processCommQ(data) {
  (window._kdCommQ || []).forEach(function(fn){ try { fn(data); } catch(e){ console.warn('kdCommQ error:',e); } });
  window._kdCommQ = [];
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function(){ attachAll(); load(_processCommQ); });
} else {
  attachAll();
  load(_processCommQ);
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Call cb(data) once the JSON is loaded (localStorage or server). */
window.kdAcLoad = function(cb){ load(function(data){ cb(data); }); };

/**
 * Get available states for a commodity, from the server — pages using this
 * already do a full reload on selection, so there's no bundled combination
 * map to check first; this just calls /api/mandi/states directly.
 * cb receives [{value, display}, …] (display is locale-translated server-side).
 */
window.kdAcGetStates = function(commodity, cb) {
  var url = (!commodity || commodity === 'ALL')
    ? '/api/mandi/states?commodity=ALL'
    : '/api/mandi/states?commodity=' + encodeURIComponent(commodity);
  fetch(url)
    .then(function(r){ return r.json(); })
    .then(function(st){ cb(st); })
    .catch(function(){ cb([]); });
};

/**
 * Get APMCs for a commodity + state combination (or state-only, or
 * commodity-only) — always from /api/mandi/apmcs.
 * cb receives [{value, display}, …]
 */
window.kdAcGetApmcsByState = function(commodity, state, cb) {
  if (!state || state === 'ALL') { cb([]); return; }
  var url = '/api/mandi/apmcs?commodity=' + encodeURIComponent(commodity || 'ALL')
          + '&state=' + encodeURIComponent(state);
  fetch(url)
    .then(function(r){ return r.json(); })
    .then(function(apmcs){ cb(apmcs); })
    .catch(function(){ cb([]); });
};

/**
 * Get all APMCs for a commodity (across all states), from the server.
 * cb receives [{value, display}, …]
 */
window.kdAcGetApmcs = function(commodity, cb) {
  if (!commodity) { cb([]); return; }
  fetch('/api/mandi/apmcs?commodity=' + encodeURIComponent(commodity))
    .then(function(r){ return r.json(); })
    .then(function(apmcs){ cb(apmcs); })
    .catch(function(){ cb([]); });
};

/**
 * Get all APMCs across all commodities and states, from the server.
 * cb receives [{value, display}, …]
 */
window.kdAcGetAllApmcs = function(cb) {
  fetch('/api/mandi/apmcs?commodity=ALL')
    .then(function(r){ return r.json(); })
    .then(function(apmcs){ cb(apmcs); })
    .catch(function(){ cb([]); });
};

/** Force re-fetch from server (clears localStorage + in-memory cache). */
window.kdAcRefresh = function() {
  lsClear();
  _cache   = null;
  _loading = false;
  _pending = [];
  load(function(){});
};

// ── Window events ─────────────────────────────────────────────────────────────

window.addEventListener('scroll', function(){
  if (_inp && _drop && _drop.style.display !== 'none') hide();
}, {passive: true});

window.addEventListener('resize', function(){
  if (_inp && _drop && _drop.style.display !== 'none') posit(_inp);
});

document.addEventListener('click', function(e){
  if (_drop && _inp && !_drop.contains(e.target) && e.target !== _inp) hide();
});

window._kdAC = {attach: attach, attachAll: attachAll, load: load, search: search};

})();
