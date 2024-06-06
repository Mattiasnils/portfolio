// Scroll animation (for elements with .hidden class)
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    entry.target.classList.toggle("show", entry.isIntersecting);
  });
});

const hiddentElements = document.querySelectorAll(".hidden");
hiddentElements.forEach((el) => observer.observe(el));
