// Scroll animation (for elements with .hidden class)
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    entry.target.classList.toggle("show", entry.isIntersecting);
  });
});

const hiddentElements = document.querySelectorAll(".hidden");
hiddentElements.forEach((el) => observer.observe(el));

(function initBodyTextReveal() {
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const skipClosest =
    ".tool-badge, .soft-skill, .work-card, .company-card, .blog-post, .headline, #introduction, #parallax-container, #contact-modal, .interests-lightbox, header, nav, footer, .contact-form, .contact-button, .nova-talent-link";

  const skipSelf =
    "h1, h2, #hero-img, #hero-bubbles, .chevron, .show-more-icon";

  const layoutShell =
    "section, main, body, html, .g, .container, .project-intro, .blog-header, .two-cols, .two-cols-50-50, .three-cols, .scope-map, .about-identity, .about-band, .about-skills-stack, .tools-row, .projects, .blog-gallery, .interests-collage, .company-card-grid";

  const minChars = 60;

  function isRevealSource(element) {
    if (element.matches(skipSelf) || element.closest(skipClosest)) {
      return false;
    }

    if (element.closest("ul, ol") && !element.matches("ul, ol")) {
      return false;
    }

    if (element.tagName === "P") {
      return element.textContent.trim().length >= minChars;
    }

    return true;
  }

  function getRevealTarget(element) {
    const parent = element.parentElement;

    if (!parent || parent.matches(layoutShell)) {
      return element;
    }

    return parent;
  }

  const targets = [];
  const seen = new Set();

  Array.from(
    document.querySelectorAll(
      "main h3, main h4, main h5, main h6, main p, main img, main blockquote, main ul, main ol"
    )
  )
    .filter(isRevealSource)
    .forEach(function (element) {
      const target = getRevealTarget(element);

      if (!target || seen.has(target)) {
        return;
      }

      seen.add(target);
      target.classList.add("body-reveal");
      targets.push(target);
    });

  if (!targets.length) {
    return;
  }

  if (reducedMotion) {
    targets.forEach(function (target) {
      target.classList.add("is-visible", "is-revealed");
    });
    return;
  }

  let stagger = 0;
  let resetTimer = 0;

  const revealObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }

        const target = entry.target;
        target.style.setProperty("--reveal-i", String(stagger));
        stagger += 1;
        target.classList.add("is-visible");
        target.addEventListener(
          "animationend",
          function (event) {
            if (event.animationName !== "cinematic-reveal") {
              return;
            }

            target.classList.remove("is-visible");
            target.classList.add("is-revealed");
          },
          { once: true }
        );
        revealObserver.unobserve(target);

        window.clearTimeout(resetTimer);
        resetTimer = window.setTimeout(function () {
          stagger = 0;
        }, 180);
      });
    },
    {
      threshold: 0.12,
      rootMargin: "0px 0px -6% 0px",
    }
  );

  targets.forEach(function (target) {
    revealObserver.observe(target);
  });
})();
