(function () {
  document.addEventListener("DOMContentLoaded", function () {
    const lightbox = document.querySelector("[data-lightbox]");
    const gallery = document.querySelector("[data-lightbox-gallery]");
    if (!lightbox || !gallery) {
      return;
    }

    const imageEl = lightbox.querySelector("[data-lightbox-image]");
    const triggers = Array.from(
      gallery.querySelectorAll("[data-lightbox-trigger]")
    );
    const closeEls = lightbox.querySelectorAll("[data-lightbox-close]");
    const prevButton = lightbox.querySelector("[data-lightbox-prev]");
    const nextButton = lightbox.querySelector("[data-lightbox-next]");

    if (!imageEl || !triggers.length) {
      return;
    }

    const slides = triggers.map(function (trigger) {
      const img = trigger.querySelector("img");
      return {
        src: img ? img.currentSrc || img.src : "",
        alt: img ? img.alt || "" : "",
      };
    });

    let currentIndex = 0;
    let lastFocusedElement = null;

    function getFocusableElements() {
      return Array.from(
        lightbox.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(function (el) {
        return el.offsetParent !== null;
      });
    }

    function showSlide(index) {
      const total = slides.length;
      currentIndex = ((index % total) + total) % total;
      const slide = slides[currentIndex];
      imageEl.src = slide.src;
      imageEl.alt = slide.alt;
    }

    function openLightbox(index) {
      lastFocusedElement = document.activeElement;
      showSlide(index);
      lightbox.hidden = false;
      document.body.classList.add("lightbox-open");
      window.setTimeout(function () {
        const closeButton = lightbox.querySelector(
          "[data-lightbox-close].interests-lightbox-close"
        );
        if (closeButton) {
          closeButton.focus();
        }
      }, 0);
    }

    function closeLightbox() {
      if (lightbox.hidden) {
        return;
      }

      lightbox.hidden = true;
      document.body.classList.remove("lightbox-open");
      imageEl.removeAttribute("src");
      imageEl.alt = "";

      if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
        lastFocusedElement.focus();
      }
    }

    function handleKeyDown(event) {
      if (lightbox.hidden) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeLightbox();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showSlide(currentIndex - 1);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        showSlide(currentIndex + 1);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusableElements();
      if (!focusable.length) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    triggers.forEach(function (trigger, index) {
      trigger.addEventListener("click", function () {
        openLightbox(index);
      });
    });

    closeEls.forEach(function (el) {
      el.addEventListener("click", closeLightbox);
    });

    if (prevButton) {
      prevButton.addEventListener("click", function () {
        showSlide(currentIndex - 1);
      });
    }

    if (nextButton) {
      nextButton.addEventListener("click", function () {
        showSlide(currentIndex + 1);
      });
    }

    document.addEventListener("keydown", handleKeyDown);
  });
})();
