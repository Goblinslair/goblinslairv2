(function () {
  var root = document.getElementById('hero-slideshow');
  if (!root) return;

  var slidesWrap = root.querySelector('.hero-slides');
  var slides = root.querySelectorAll('.hero-slide');
  var dots = root.querySelectorAll('.hero-dot');
  var prevBtn = root.querySelector('.hero-arrow-left');
  var nextBtn = root.querySelector('.hero-arrow-right');

  var current = 0;
  var total = slides.length;
  var AUTOPLAY_DELAY = 6000; // ms between auto-advances — adjust to taste
  var timer = null;

  function goTo(index) {
    index = (index + total) % total; // wrap around both directions
    slides[current].classList.remove('is-active');
    dots[current].classList.remove('is-active');
    current = index;
    slides[current].classList.add('is-active');
    dots[current].classList.add('is-active');
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

  function startAutoplay() {
    stopAutoplay();
    timer = setInterval(next, AUTOPLAY_DELAY);
  }
  function stopAutoplay() {
    if (timer) clearInterval(timer);
  }

  // Manual controls reset the timer so it doesn't jump right after a click
  nextBtn.addEventListener('click', function () { next(); startAutoplay(); });
  prevBtn.addEventListener('click', function () { prev(); startAutoplay(); });
  dots.forEach(function (dot, i) {
    dot.addEventListener('click', function () { goTo(i); startAutoplay(); });
  });

  // Pause on hover so people can read the copy without it shifting under them
  root.addEventListener('mouseenter', stopAutoplay);
  root.addEventListener('mouseleave', startAutoplay);

  startAutoplay();
})();
