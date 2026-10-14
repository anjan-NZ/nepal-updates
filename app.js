(function () {
  'use strict';

  var CATS = [['all', 'All'], ['tax', 'Tax'], ['law', 'Law'], ['company', 'Company'], ['bank', 'Banking'], ['audit', 'Audit'], ['case', 'Case law']];
  var COL = { tax: 'var(--tax)', law: 'var(--law)', company: 'var(--company)', bank: 'var(--bank)', audit: 'var(--audit)', case: 'var(--case)' };
  var CA_RE = /vat|tds|tax|rate|finance act|income tax|excise|companies act|company act|nfrs|nsa|audit|udin|directive|circular|procurement|amendment|ordinance|aml|beneficial|कर|आयकर|मूल्य अभिवृद्धि|आर्थिक ऐन|कम्पनी ऐन|खरिद|संशोधन|अध्यादेश|ऐन|नियमावली|निर्देशन|परिपत्र|निर्देशिका/i;
  var PAGE = 20;

  var items = [], rows = [], cat = 'all', tag = null, q = '', shown = 0, caOnly = true, lastDay = '';
  var lang = 'np', updated = 0;  // Nepali (original) titles by default
  try { if (localStorage.getItem('lang') === 'en') lang = 'en'; } catch (e) { /* storage blocked: default Nepali */ }
  var $ = function (id) { return document.getElementById(id); };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function safeUrl(u) {
    try { var p = new URL(u); return (p.protocol === 'https:' || p.protocol === 'http:') ? p.href : ''; } catch (e) { return ''; }
  }
  function caScore(i) { return typeof i.ca === 'number' ? i.ca : (CA_RE.test(i.title + ' ' + (i.summary || '')) ? 2 : 1); }
  function isoTs(p) { var m = /^(20\d\d)-(\d\d)-(\d\d)/.exec(p || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 1000 : 0; }
  function ts(i) { return isoTs(i.pub) || i.first_seen; }
  function ago(t) {
    var s = Date.now() / 1000 - t;
    if (s < 90) return 'just now';
    if (s < 3600) return Math.round(s / 60) + 'm ago';
    if (s < 86400) return Math.round(s / 3600) + 'h ago';
    var d = Math.round(s / 86400);
    return d < 45 ? d + 'd ago' : Math.round(d / 30) + 'mo ago';
  }
  function dayLabel(t) {
    var d = new Date(t * 1000), n = new Date(), y = new Date(Date.now() - 864e5);
    if (d.toDateString() === n.toDateString()) return 'Today';
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function hi(node, text) {
    var words = q ? q.split(/\s+/).filter(Boolean) : [];
    if (!words.length) { node.textContent = text; return; }
    var re = new RegExp('(' + words.map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'gi');
    text.split(re).forEach(function (p, k) {
      if (k % 2) node.appendChild(el('mark', null, p));
      else if (p) node.appendChild(document.createTextNode(p));
    });
  }
  function link(cls, href, label) {
    var a = el('a', cls, label);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer nofollow';
    return a;
  }

  function pool() { return caOnly ? items.filter(function (i) { return caScore(i) >= 2; }) : items; }

  function drawTabs() {
    var t = $('tabs'), p = pool();
    t.textContent = '';
    CATS.forEach(function (c) {
      var n = p.filter(function (i) { return c[0] === 'all' ? i.cat !== 'case' : i.cat === c[0]; }).length;
      if (c[0] !== 'all' && c[0] !== 'case' && !n) return;
      var b = el('button', 'tab' + (cat === c[0] ? ' on' : ''), c[1]);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', cat === c[0] ? 'true' : 'false');
      if (COL[c[0]]) b.style.setProperty('--c', COL[c[0]]);
      b.appendChild(el('small', null, String(n)));
      b.addEventListener('click', function () { cat = c[0]; tag = null; apply(); });
      t.appendChild(b);
    });
    var g = $('tags'), m = {};
    g.textContent = '';
    p.forEach(function (i) {
      if (cat !== 'all' && i.cat !== cat) return;
      (i.tags || []).forEach(function (v) { if (v) m[v] = (m[v] || 0) + 1; });
    });
    Object.keys(m).sort(function (a, b) { return m[b] - m[a]; }).slice(0, 14).forEach(function (v) {
      var b = el('button', 'chip' + (tag === v ? ' on' : ''), v);
      b.type = 'button';
      b.addEventListener('click', function () { tag = tag === v ? null : v; apply(); });
      g.appendChild(b);
    });
  }

  function ok(i) {
    if (caOnly && caScore(i) < 2) return false;
    if (cat !== 'all' && i.cat !== cat) return false;
    if (cat === 'all' && i.cat === 'case' && !q) return false;
    if (tag && (i.tags || []).indexOf(tag) < 0) return false;
    if (!q) return true;
    var h = ((i.title || '') + ' ' + (i.title_en || '') + ' ' + (i.summary || '') + ' ' + (i.tags || []).join(' ') + ' ' + (i.source || '') + ' ' + (i.pub || '')).toLowerCase();
    return q.toLowerCase().split(/\s+/).every(function (w) { return h.indexOf(w) >= 0; });
  }

  function card(i) {
    var c = el('article', 'card');
    c.style.setProperty('--c', COL[i.cat] || 'var(--accent)');
    var head = el('div', 'head');
    head.appendChild(el('b', null, i.source));
    head.appendChild(el('span', null, i.cat === 'case'
      ? [i.kind, i.pub && 'decided ' + i.pub, i.case_no].filter(Boolean).join(' · ')
      : (i.pub ? i.pub + ' · ' : '') + ago(ts(i))));
    if (i.ca === 3) head.appendChild(el('span', 'badge key', 'KEY'));
    c.appendChild(head);

    var href = safeUrl(i.url);
    // main title in the chosen language; the other one underneath, small, when it says something different
    var en = i.title_en && i.title_en !== i.title ? i.title_en : '';
    var main = lang === 'en' && en ? en : i.title, other = en ? (main === en ? i.title : en) : '';
    var title = href ? link('title', href, '') : el('span', 'title');
    if (main === i.title) title.lang = 'ne';
    hi(title, main);
    c.appendChild(title);
    if (other) {
      var o = el('p', 'orig');
      if (other === i.title) o.lang = 'ne';
      hi(o, other);
      c.appendChild(o);
    }

    if (i.summary) { var s = el('p', 'sum'); hi(s, i.summary); c.appendChild(s); }
    if (i.acts && i.acts.length) c.appendChild(el('p', 'acts', '⚖ ' + i.acts.join(' · ')));
    if (i.why && i.cat !== 'case' && caScore(i) >= 2) {
      var w = el('div', 'why');
      w.appendChild(el('b', null, 'Why it matters: '));
      w.appendChild(document.createTextNode(i.why));
      c.appendChild(w);
    }

    var foot = el('div', 'foot-row');
    (i.tags || []).forEach(function (x) {
      var t = el('button', 't', '#' + x);
      t.type = 'button';
      t.addEventListener('click', function () { tag = x; apply(); window.scrollTo(0, 0); });
      foot.appendChild(t);
    });
    var btns = el('div', 'btns');
    if (href) btns.appendChild(link('btn', href, 'Open source'));
    var pdf = safeUrl(i.pdf);
    if (pdf && pdf !== href) btns.appendChild(link('btn', pdf, 'PDF'));
    foot.appendChild(btns);
    c.appendChild(foot);
    return c;
  }

  function more() {
    var list = $('list'), end = Math.min(rows.length, shown + PAGE);
    for (; shown < end; shown++) {
      var i = rows[shown], dl = i.cat === 'case' ? (i.volume || 'Case law') : dayLabel(ts(i));
      if (dl !== lastDay) { list.appendChild(el('div', 'day', dl)); lastDay = dl; }
      list.appendChild(card(i));
    }
    $('more').hidden = shown >= rows.length;
  }

  function apply() {
    drawTabs();
    rows = items.filter(ok);
    shown = 0; lastDay = '';
    $('list').textContent = '';
    $('more').hidden = true;
    var m = $('meta');
    m.textContent = rows.length + ' item' + (rows.length === 1 ? '' : 's') + (updated ? ' · checked ' + ago(updated) : '');
    if (!rows.length) {
      var e = el('div', 'empty');
      e.appendChild(el('b', null, q ? 'No matches' : 'Nothing here yet'));
      e.appendChild(document.createTextNode(q ? 'Try fewer or different words.' : caOnly ? 'Nothing CA-relevant here. Switch off "For CAs" to see everything.' : 'New items appear after the next check.'));
      $('list').appendChild(e);
      return;
    }
    more();
  }

  var timer;
  $('q').addEventListener('input', function (e) {
    clearTimeout(timer);
    var v = e.target.value.trim().slice(0, 80);
    timer = setTimeout(function () { q = v; apply(); }, 150);
  });
  $('ca').addEventListener('click', function () {
    caOnly = !caOnly;
    this.classList.toggle('on', caOnly);
    this.setAttribute('aria-pressed', caOnly ? 'true' : 'false');
    apply();
  });
  $('more').addEventListener('click', more);
  function drawLang() {
    Array.prototype.forEach.call($('lang').querySelectorAll('button'), function (b) {
      var on = b.getAttribute('data-l') === lang;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  $('lang').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b || b.getAttribute('data-l') === lang) return;
    lang = b.getAttribute('data-l');
    try { localStorage.setItem('lang', lang); } catch (x) { /* not saved: fine */ }
    drawLang();
    if (items.length) apply();
  });
  drawLang();

  // theme: auto (device) / light / dark; theme.js already applied the saved one before paint
  var theme = document.documentElement.getAttribute('data-theme') || 'auto';
  function drawTheme() {
    Array.prototype.forEach.call($('theme').querySelectorAll('button'), function (b) {
      var on = b.getAttribute('data-t') === theme;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  $('theme').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    theme = b.getAttribute('data-t');
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch (x) { /* not saved: fine */ }
    drawTheme();
  });
  drawTheme();

  fetch('feed.json', { credentials: 'omit', referrerPolicy: 'no-referrer' })
    .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
    .then(function (d) {
      items = Array.isArray(d.items) ? d.items : [];
      items.sort(function (a, b) { return ts(b) - ts(a); });
      updated = typeof d.updated === 'number' ? d.updated : 0;
      apply();
    })
    .catch(function () {
      $('list').textContent = '';
      var e = el('div', 'empty');
      e.appendChild(el('b', null, 'Could not load updates'));
      e.appendChild(document.createTextNode('Please try again in a few minutes.'));
      $('list').appendChild(e);
    });
})();
