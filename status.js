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
  var LABEL = { ok: 'Working', warn: 'Check', bad: 'Broken' };

  fetch('feed.json', { credentials: 'omit', referrerPolicy: 'no-referrer' })
    .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
    .then(function (d) {
      var h = Array.isArray(d.health) ? d.health : [], box = $('health');
      box.textContent = '';
      if (!h.length) {
        box.appendChild(el('p', 'empty', 'Status appears after the next check.'));
        return;
      }
      var bad = h.filter(function (x) { return x.state !== 'ok'; }).length;
      $('sum').textContent = (bad ? bad + ' of ' + h.length + ' sources need a look' : 'All ' + h.length + ' sources working') +
        (d.updated ? ' · updated ' + ago(d.updated) : '');
      h.sort(function (a, b) { return (a.state === 'ok') - (b.state === 'ok') || String(a.source).localeCompare(b.source); });
      h.forEach(function (x) {
        var st = LABEL[x.state] ? x.state : 'warn';
        var row = el('article', 'hrow ' + st);
        var top = el('div', 'htop');
        top.appendChild(el('b', null, String(x.source || '')));
        top.appendChild(el('span', 'hbadge ' + st, LABEL[st]));
        row.appendChild(top);
        if (st !== 'ok' && x.note) row.appendChild(el('p', 'hnote', String(x.note)));
        var g = el('dl', 'hgrid');
        [['Last checked', ago(x.checked)], ['Last new notice', ago(x.last_new)],
          ['On its list now', x.listed == null ? '—' : String(x.listed)], ['Kept here', x.kept == null ? '—' : String(x.kept)]]
          .forEach(function (p) { var w = el('div'); w.appendChild(el('dt', null, p[0])); w.appendChild(el('dd', null, p[1])); g.appendChild(w); });
        row.appendChild(g);
        box.appendChild(row);
      });
    })
    .catch(function () {
      $('health').textContent = '';
      $('health').appendChild(el('p', 'empty', 'Could not load the status. Try again in a few minutes.'));
    });
})();
