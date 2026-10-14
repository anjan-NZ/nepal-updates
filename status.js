(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function ago(t) {
    if (!t) return '—';
    var s = Date.now() / 1000 - t;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    var d = Math.round(s / 86400);
    return d + (d === 1 ? ' day ago' : ' days ago');
  }
  function safeUrl(u) {
    try { var p = new URL(u); return p.protocol === 'https:' || p.protocol === 'http:' ? p.href : ''; } catch (e) { return ''; }
  }
  var LABEL = { ok: 'Working', warn: 'Check', bad: 'Broken' };
  var CAT = { tax: 'Tax', law: 'Law', company: 'Company', bank: 'Banking', audit: 'Audit' };
  var COL = { tax: 'var(--tax)', law: 'var(--law)', company: 'var(--company)', bank: 'var(--bank)', audit: 'var(--audit)' };
  var rows = [], filter = 'all';

  function draw() {
    var box = $('health');
    box.textContent = '';
    var list = filter === 'bad' ? rows.filter(function (x) { return x.state !== 'ok'; }) : rows;
    if (!list.length) {
      var e = el('div', 'empty');
      e.appendChild(el('b', null, filter === 'bad' ? 'Nothing needs attention' : 'No status yet'));
      e.appendChild(document.createTextNode(filter === 'bad' ? 'Every source loaded on its last check.' : 'Status appears after the next check.'));
      box.appendChild(e);
      return;
    }
    list.forEach(function (x) {
      var st = LABEL[x.state] ? x.state : 'warn';
      var row = el('article', 'hrow ' + st);
      if (COL[x.cat]) row.style.setProperty('--c', COL[x.cat]);
      var top = el('div', 'htop');
      var name = el('div', 'hname');
      name.appendChild(el('b', null, String(x.source || '')));
      if (CAT[x.cat]) name.appendChild(el('span', 'hcat', CAT[x.cat]));
      top.appendChild(name);
      top.appendChild(el('span', 'hbadge ' + st, LABEL[st]));
      row.appendChild(top);
      if (st !== 'ok' && x.note) row.appendChild(el('p', 'hnote', String(x.note).replace(/^[A-Z]+:\s*/, '')));
      var g = el('dl', 'hgrid');
      [['Last checked', ago(x.checked)], ['Last new notice', ago(x.last_new)],
        ['On its list now', x.listed == null ? '—' : String(x.listed)],
        [x.new == null ? 'Kept here' : 'New on last check', x.new == null ? (x.kept == null ? '—' : String(x.kept)) : String(x.new)]]
        .forEach(function (p) { var w = el('div'); w.appendChild(el('dt', null, p[0])); w.appendChild(el('dd', null, p[1])); g.appendChild(w); });
      row.appendChild(g);
      var site = safeUrl(x.site);
      if (site) {
        var a = el('a', 'hlink', 'Open official site ↗');
        a.href = site; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow';
        row.appendChild(a);
      }
      box.appendChild(row);
    });
  }

  $('hfilter').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    filter = b.getAttribute('data-f');
    Array.prototype.forEach.call(this.querySelectorAll('button'), function (x) {
      var on = x === b;
      x.classList.toggle('on', on);
      x.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    draw();
  });

  fetch('feed.json', { credentials: 'omit', referrerPolicy: 'no-referrer' })
    .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
    .then(function (d) {
      rows = Array.isArray(d.health) ? d.health : [];
      var rank = { bad: 0, warn: 1, ok: 2 };
      rows.sort(function (a, b) { return (rank[a.state] - rank[b.state]) || String(a.source).localeCompare(b.source); });
      var n = { ok: 0, warn: 0, bad: 0 };
      rows.forEach(function (x) { n[LABEL[x.state] ? x.state : 'warn']++; });
      if (rows.length) {
        $('stOk').textContent = n.ok; $('stWarn').textContent = n.warn; $('stBad').textContent = n.bad;
        $('stChk').textContent = d.updated ? ago(d.updated) : '—';
        $('stats').hidden = false;
        $('hfilter').hidden = false;
        $('sum').textContent = (n.warn + n.bad ? (n.warn + n.bad) + ' of ' + rows.length + ' sources need a look' : 'All ' + rows.length + ' sources working') +
          (d.updated ? ' · updated ' + ago(d.updated) : '');
      }
      draw();
    })
    .catch(function () {
      $('health').textContent = '';
      var e = el('div', 'empty');
      e.appendChild(el('b', null, 'Could not load the status'));
      e.appendChild(document.createTextNode('Try again in a few minutes.'));
      $('health').appendChild(e);
    });
})();
