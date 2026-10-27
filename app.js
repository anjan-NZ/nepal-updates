(function () {
  'use strict';

  // 'circ' is not a category: it lists items typed "circular" (IRD सूचना, NRB circulars, any परिपत्र) from every category
  var CATS = [['all', 'All'], ['student', 'Students'], ['tax', 'Tax'], ['circ', 'Circulars'], ['law', 'Law'], ['company', 'Company'], ['bank', 'Banking'], ['audit', 'Audit'], ['case', 'Case law']];
  var COL = { circ: 'var(--gold)', tax: 'var(--tax)', law: 'var(--law)', company: 'var(--company)', bank: 'var(--bank)', audit: 'var(--audit)', student: 'var(--student)', case: 'var(--case)' };
  var CA_RE = /vat|tds|tax|rate|finance act|income tax|excise|companies act|company act|nfrs|nsa|audit|udin|directive|circular|procurement|amendment|ordinance|aml|beneficial|कर|आयकर|मूल्य अभिवृद्धि|आर्थिक ऐन|कम्पनी ऐन|खरिद|संशोधन|अध्यादेश|ऐन|नियमावली|निर्देशन|परिपत्र|निर्देशिका/i;
  var PAGE = 20;

  var items = [], rows = [], cat = 'all', tag = null, q = '', shown = 0, caOnly = true, lastDay = '';
  var lang = 'np', updated = 0;  // Nepali (original) titles by default
  try { if (localStorage.getItem('lang') === 'en') lang = 'en'; } catch (e) { /* storage blocked: default Nepali */ }
  if (/^#students?$/i.test(location.hash)) cat = 'student';  // direct link: …/nepal-updates/#students
  if (/^#circulars?$/i.test(location.hash)) cat = 'circ';  // direct link: …/nepal-updates/#circulars
  function inCat(i, c) { return c === 'circ' ? i.type === 'circular' && i.cat !== 'case' : i.cat === c; }
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
  // AD dates as-is; Bikram Sambat ones (2082/02/10, २०८२।०२।१०) converted to an AD date good to a day or two
  var BS_LEN = [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30];
  function isoTs(p) {
    p = String(p || '').replace(/[०-९]/g, function (d) { return '०१२३४५६७८९'.indexOf(d); });
    var m = /^(\d{4})[-\/.।](\d{1,2})[-\/.।](\d{1,2})/.exec(p);
    if (!m) return 0;
    var y = +m[1], mo = +m[2], d = +m[3], t;
    if (mo < 1 || mo > 12 || d < 1 || d > 32) return 0;
    if (y >= 2060 && y <= 2110) {
      var days = d - 1;
      for (var k = 0; k < mo - 1; k++) days += BS_LEN[k];
      t = Date.UTC(y - 57, 3, 14 + days) / 1000;
    } else if (y >= 1990 && y <= new Date().getFullYear() + 1) t = Date.UTC(y, mo - 1, d) / 1000;
    else return 0;
    return t > Date.now() / 1000 + 86400 ? 0 : t;
  }
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
      var n = p.filter(function (i) { return c[0] === 'all' ? (i.cat !== 'case' && i.cat !== 'student') : inCat(i, c[0]); }).length;
      if (c[0] !== 'all' && c[0] !== 'case' && !n) return;
      var b = el('button', 'tab' + (c[0] === 'student' ? ' stu' : '') + (cat === c[0] ? ' on' : ''), c[1]);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', cat === c[0] ? 'true' : 'false');
      if (COL[c[0]]) b.style.setProperty('--c', COL[c[0]]);
      b.appendChild(el('small', null, String(n)));
      b.addEventListener('click', function () {
        cat = c[0]; tag = null;
        try { history.replaceState(null, '', cat === 'student' ? '#students' : location.pathname + location.search); } catch (e) { /* ignore */ }
        apply();
      });
      t.appendChild(b);
    });
    var g = $('tags'), m = {};
    g.textContent = '';
    p.forEach(function (i) {
      if (cat !== 'all' && !inCat(i, cat)) return;
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
    if (cat !== 'all' && !inCat(i, cat)) return false;
    if (cat === 'all' && ((i.cat === 'case' && !q) || i.cat === 'student')) return false;
    if (tag && (i.tags || []).indexOf(tag) < 0) return false;
    if (!q) return true;
    var h = ((i.title || '') + ' ' + (i.title_en || '') + ' ' + (i.summary || '') + ' ' + (i.tags || []).join(' ') + ' ' + (i.source || '') + ' ' + (i.pub || '') +
      (i.type === 'circular' ? ' circular परिपत्र' : '')).toLowerCase();
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
    if (i.type === 'circular') head.appendChild(el('span', 'badge circ', 'CIRCULAR'));
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
    var ask = el('button', 'btn', 'Ask AI');
    ask.type = 'button';
    ask.addEventListener('click', function () { askPanel(c, i); });
    btns.appendChild(ask);
    foot.appendChild(btns);
    c.appendChild(foot);
    return c;
  }

  // ---- Ask AI: the visitor's own key, sent straight from this browser to the provider they picked ----
  var PROV = {
    gemini: { model: 'gemini-flash-lite-latest', help: 'Free key: aistudio.google.com/apikey (sign in with Google, "Create API key").' },
    groq: { model: 'llama-3.3-70b-versatile', help: 'Key from console.groq.com/keys.' },
    openrouter: { model: 'meta-llama/llama-3.3-70b-instruct:free', help: 'Key from openrouter.ai/keys. Models ending in ":free" cost nothing.' }
  };
  var SYS = 'You answer questions about official Nepali notices (tax, law, company, banking, audit) for an accountant. ' +
    'Use only the notice data given. If the answer is not in it, say so and suggest opening the official source. ' +
    'Do not invent section numbers, rates or dates. Reply in the language of the question (English or Nepali), ' +
    'in short plain sentences. End with: "Check the official source before relying on this."';

  function aiCfg() {
    var raw = null;
    try { raw = sessionStorage.getItem('ai') || localStorage.getItem('ai'); } catch (e) { /* blocked */ }
    try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function aiSave(cfg, remember) {
    try {
      localStorage.removeItem('ai'); sessionStorage.removeItem('ai');
      if (cfg) (remember ? localStorage : sessionStorage).setItem('ai', JSON.stringify(cfg));
    } catch (e) { /* not saved: works until reload */ }
    memCfg = cfg;
    $('aiDot').hidden = !cfg;
  }
  var memCfg = aiCfg();

  function slimItem(i) {
    return { source: i.source, date: i.pub || '', title: i.title, title_en: i.title_en || '', summary: i.summary || '',
      why: i.why || '', tags: i.tags || [], url: i.url, pdf: i.pdf || '' };
  }

  function callAI(question, context) {
    var cfg = memCfg;
    if (!cfg || !cfg.k) return Promise.reject(new Error('nokey'));
    var model = cfg.m || PROV[cfg.p].model;
    var user = 'Notice data (JSON):\n' + JSON.stringify(context) + '\n\nQuestion: ' + question;
    var req;
    if (cfg.p === 'gemini') {
      req = fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
        method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.k },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: SYS }] }, contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 700 } })
      });
    } else {
      req = fetch(cfg.p === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.k },
        body: JSON.stringify({ model: model, temperature: 0.2, max_tokens: 700,
          messages: [{ role: 'system', content: SYS }, { role: 'user', content: user }] })
      });
    }
    return req.then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) {
          var m = r.status === 401 || r.status === 403 ? 'The key was rejected. Check it in Ask AI settings.'
            : r.status === 429 ? 'Rate limit reached for this key. Wait a minute and try again.'
            : r.status === 404 ? 'Model not found. Clear the Model box in Ask AI settings to use the default.'
            : 'The AI service returned an error (' + r.status + ').';
          throw new Error(m);
        }
        var t = cfg.p === 'gemini'
          ? (((d.candidates || [])[0] || {}).content || { parts: [] }).parts.map(function (p) { return p.text || ''; }).join('')
          : (((d.choices || [])[0] || {}).message || {}).content;
        if (!t) throw new Error('The AI returned an empty answer. Try asking differently.');
        return String(t).replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#+\s*/gm, '').trim();
      });
    });
  }

  function runAsk(question, context, out, btn) {
    if (!memCfg) { openDlg(); return; }
    out.hidden = false;
    out.className = 'ans wait';
    out.textContent = 'Thinking…';
    btn.disabled = true;
    callAI(question, context).then(function (t) {
      out.className = 'ans';
      out.textContent = t;
    }, function (e) {
      out.className = 'ans err';
      out.textContent = e.message === 'nokey' ? 'Add your AI key first (Ask AI, top right).' :
        (e instanceof TypeError ? 'Could not reach the AI service. Check your connection.' : e.message);
    }).then(function () { btn.disabled = false; });
  }

  function askPanel(c, i) {
    var open = c.querySelector('.askbox');
    if (open) { open.remove(); return; }
    if (!memCfg) { openDlg(); return; }
    var box = el('form', 'askbox');
    var inp = el('input');
    inp.type = 'text'; inp.maxLength = 400; inp.autocomplete = 'off';
    inp.placeholder = 'Ask about this notice, e.g. who must comply and by when?';
    var b = el('button', 'btn primary', 'Ask');
    b.type = 'submit';
    var row = el('div', 'askrow');
    row.appendChild(inp); row.appendChild(b);
    var out = el('p', 'ans');
    out.hidden = true;
    out.setAttribute('aria-live', 'polite');
    box.appendChild(row); box.appendChild(out);
    box.addEventListener('submit', function (e) {
      e.preventDefault();
      var qq = inp.value.trim();
      if (qq) runAsk(qq, slimItem(i), out, b);
    });
    c.appendChild(box);
    inp.focus();
  }

  var dlg = $('aiDlg');
  function openDlg() {
    var cfg = memCfg || { p: 'gemini', k: '', m: '' };
    $('aiProv').value = PROV[cfg.p] ? cfg.p : 'gemini';
    $('aiKey').value = cfg.k || '';
    $('aiModel').value = cfg.m || '';
    var remembered = false;
    try { remembered = !!localStorage.getItem('ai'); } catch (e) { /* blocked */ }
    $('aiRemember').checked = remembered;
    drawHelp();
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
  function drawHelp() {
    var p = PROV[$('aiProv').value];
    $('aiModel').placeholder = 'Default: ' + p.model;
    $('aiHelp').textContent = p.help;
  }
  $('aiProv').addEventListener('change', drawHelp);
  $('aiBtn').addEventListener('click', openDlg);
  $('aiCancel').addEventListener('click', function () { dlg.close(); });
  $('aiClear').addEventListener('click', function () { aiSave(null); $('aiKey').value = ''; dlg.close(); });
  $('aiForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var k = $('aiKey').value.trim();
    if (!k) { $('aiKey').focus(); return; }
    aiSave({ p: $('aiProv').value, k: k.slice(0, 300), m: $('aiModel').value.trim().slice(0, 100) }, $('aiRemember').checked);
    dlg.close();
  });
  $('aiDot').hidden = !memCfg;

  $('askAllForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var qq = $('askAllQ').value.trim();
    if (!qq) return;
    var ctx = rows.slice(0, 60).map(slimItem);  // the posts currently listed (filters + search applied)
    runAsk(qq, ctx, $('askAllAns'), this.querySelector('button'));
  });

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
    m.textContent = (cat === 'student' ? 'Notices from TU and ICAN for students: exams, results, forms, scholarships · ' : '') +
      rows.length + ' item' + (rows.length === 1 ? '' : 's') + (updated ? ' · checked ' + ago(updated) : '');
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
      var now = Date.now() / 1000, srcs = {};
      items.forEach(function (i) { if (i.cat !== 'case' && i.cat !== 'student' && i.source) srcs[i.source] = 1; });
      $('stNew').textContent = items.filter(function (i) { return i.cat !== 'case' && i.cat !== 'student' && now - i.first_seen < 7 * 86400; }).length;
      $('stKey').textContent = items.filter(function (i) { return i.ca === 3 && now - ts(i) < 7 * 86400; }).length;
      $('stSrc').textContent = Array.isArray(d.health) && d.health.length ? d.health.length : Object.keys(srcs).length;
      $('stChk').textContent = updated ? ago(updated) : '–';
      $('stats').hidden = false;
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
