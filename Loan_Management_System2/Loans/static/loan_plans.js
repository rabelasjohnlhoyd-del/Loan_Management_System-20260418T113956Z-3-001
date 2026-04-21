/* ================================================================
   LOAN_PLANS.JS
   ================================================================ */

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

/* User dropdown toggle */
(function () {
  var toggle = document.getElementById('userDropdownToggle');
  var dropdown = document.getElementById('userDropdown');
  if (!toggle || !dropdown) return;
  toggle.addEventListener('click', function (e) {
    e.stopPropagation();
    dropdown.classList.toggle('open');
    toggle.classList.toggle('open');
  });
  document.addEventListener('click', function (e) {
    if (!toggle.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
      toggle.classList.remove('open');
    }
  });
})();

/* Mobile sidebar toggle */
(function () {
  var menuBtn = document.getElementById('menuBtn');
  var sidebar = document.querySelector('.sidebar');
  if (!menuBtn || !sidebar) return;
  menuBtn.addEventListener('click', function () {
    sidebar.classList.toggle('mobile-open');
  });
  document.addEventListener('click', function (e) {
    if (!sidebar.contains(e.target) && e.target !== menuBtn) {
      sidebar.classList.remove('mobile-open');
    }
  });
})();