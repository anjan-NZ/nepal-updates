// Runs in <head> before paint: apply the saved theme so the page never flashes the wrong colours.
// "auto" (default) leaves data-theme unset and the CSS follows the device setting.
(function () {
  var t = 'auto';
  try { t = localStorage.getItem('theme') || 'auto'; } catch (e) { /* storage blocked */ }
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
})();
