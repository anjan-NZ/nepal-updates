// Registers the service worker and shows an "Install app" button when the browser offers it.
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* no offline: fine */ }); });
  }
  var ev = null, btn = document.getElementById('installBtn');
  if (!btn) return;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); ev = e; btn.hidden = false; });
  btn.addEventListener('click', function () {
    if (!ev) return;
    ev.prompt();
    ev.userChoice.then(function () { ev = null; btn.hidden = true; });
  });
  window.addEventListener('appinstalled', function () { btn.hidden = true; });
})();
