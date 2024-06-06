/* Reset focus on page reload */
window.addEventListener("DOMContentLoaded", function () {
  /* window.scrollTo(0, 0);
  window.location.hash = "#"; */
  var links = document.querySelectorAll('a[href^="#"]');
  links.forEach(function (link) {
    link.addEventListener("click", function () {
      document.activeElement.blur();
    });
  });
});

/* Highlight link when section is in view */
window.addEventListener("scroll", function () {
  const sections = document.querySelectorAll("section");
  const navLinks = document.querySelectorAll("a");

  let currentSection = "";

  sections.forEach(function (section) {
    const sectionTop = section.offsetTop;
    const sectionHeight = section.clientHeight;

    if (window.scrollY >= sectionTop - sectionHeight / 3) {
      currentSection = section.getAttribute("id");
    }
  });

  navLinks.forEach(function (link) {
    link.classList.remove("link-active");
    if (link.getAttribute("href").substring(1) === currentSection) {
      link.classList.add("link-active");
    }
  });
});

/* Hide and show nav based on scroll direction */
const nav = document.querySelector("nav");
let previousScrollPosition =
  window.scrollY || document.documentElement.scrollTop;

window.addEventListener("scroll", function () {
  const currentScrollPosition =
    window.scrollY || document.documentElement.scrollTop;
  if (currentScrollPosition > 40) {
    if (
      currentScrollPosition > previousScrollPosition &&
      !nav.classList.contains("open")
    ) {
      // Scrolling down
      nav.classList.add("minimize");
    } else if (currentScrollPosition < previousScrollPosition) {
      // Scrolling up
      nav.classList.remove("minimize");
    }
  }

  previousScrollPosition = currentScrollPosition;
});

/* Hamburger Menu behavior */
const hamburgerMenu = document.querySelector(".menu-icon");
const checkbox = document.querySelector(".menu-icon__cheeckbox");
const navLinks = document.querySelector("nav ul");
var hamburgerItem = document.querySelectorAll("nav a");

// Hamburger menu reacts to click and keydown
hamburgerMenu.addEventListener("click", function () {
  toggleMenu();
});

hamburgerMenu.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    checkbox.checked = !checkbox.checked;
    toggleMenu();
  }
});

// Hamburger menu closes when an item is clicked
hamburgerItem.forEach(function (item) {
  item.addEventListener("click", function () {
    if (nav.classList.contains("open")) {
      checkbox.checked = !checkbox.checked;
      toggleMenu();
    }
  });
});

// Toggle Hamburger menu open/closed
function toggleMenu() {
  document.body.classList.toggle("nav-open");
  nav.classList.toggle("open");
  navLinks.classList.toggle("show");
}

// Focus Hamburger menu when tabbed
checkbox.addEventListener("focus", function () {
  nav.classList.add("tab-selection");
});

checkbox.addEventListener("blur", function () {
  nav.classList.remove("tab-selection");
});

checkbox.addEventListener("mousedown", function (event) {
  event.preventDefault();
});
