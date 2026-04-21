/* my_applications.js */
/* Active nav item highlight */
(function () {
  var path = window.location.pathname;
  document.querySelectorAll('.nav-item').forEach(function (el) {
    var href = el.getAttribute('href');
    if (href && href !== '#' && path.startsWith(href)) {
      el.classList.add('active');
    }
  });
})();

/* Mobile sidebar toggle */
(function () {
  var toggle = document.getElementById('sidebar-toggle');
  var sidebar = document.querySelector('.sidebar');
  if (!toggle || !sidebar) return;
  toggle.addEventListener('click', function () {
    sidebar.classList.toggle('mobile-open');
  });
  document.addEventListener('click', function (e) {
    if (!sidebar.contains(e.target) && e.target !== toggle) {
      sidebar.classList.remove('mobile-open');
    }
  });
})();