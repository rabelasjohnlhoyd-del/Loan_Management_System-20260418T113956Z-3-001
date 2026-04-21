/* ================================================================
   loan_detail.js
   ================================================================ */

document.addEventListener('DOMContentLoaded', function () {

  // ── Amortization Schedule Filter ──────────────────────────────

  const filterBtns = document.querySelectorAll('.filter-tab');
  const schedRows  = document.querySelectorAll('.sched-row');

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      // Update active tab
      filterBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');

      var filter = btn.getAttribute('data-filter');

      schedRows.forEach(function (row) {
        var status = row.getAttribute('data-status') || 'upcoming';

        if (filter === 'all') {
          row.classList.remove('hidden');
        } else if (filter === 'upcoming') {
          // Show upcoming and overdue (not yet paid)
          if (status === 'paid') {
            row.classList.add('hidden');
          } else {
            row.classList.remove('hidden');
          }
        } else if (filter === 'paid') {
          if (status === 'paid') {
            row.classList.remove('hidden');
          } else {
            row.classList.add('hidden');
          }
        }
      });
    });
  });


  // ── Animate progress bar on load ──────────────────────────────

  var fills = document.querySelectorAll('.progress-fill');
  fills.forEach(function (fill) {
    var target = fill.style.width;
    fill.style.width = '0%';
    setTimeout(function () {
      fill.style.width = target;
    }, 200);
  });


  // ── Highlight current period row ──────────────────────────────

  // Find the first upcoming row and highlight it
  var firstUpcoming = document.querySelector('.sched-row[data-status="upcoming"]');
  if (firstUpcoming) {
    firstUpcoming.style.background = '#f0fdf9';
    var periodCell = firstUpcoming.querySelector('.td-period');
    if (periodCell) {
      periodCell.style.color = 'var(--mint-dark)';
    }
  }

});