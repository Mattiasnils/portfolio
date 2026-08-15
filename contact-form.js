(function () {
  function getContactApiUrl() {
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
      return "http://localhost:3001";
    }

    const meta = document.querySelector('meta[name="contact-api-url"]');
    const configured = meta && meta.getAttribute("content");

    if (configured && configured.trim()) {
      return configured.trim().replace(/\/$/, "");
    }

    return "https://portfolio-contact-api-hfwe.onrender.com";
  }

  const CONTACT_API_URL = getContactApiUrl();

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  document.addEventListener("DOMContentLoaded", function () {
    const openButton = document.getElementById("contact-email");
    const modal = document.getElementById("contact-modal");
    if (!openButton || !modal) {
      return;
    }

    const formPanel = document.getElementById("contact-form-panel");
    const successPanel = document.getElementById("contact-success-panel");
    const scrim = modal.querySelector(".contact-modal-scrim");
    const closeButtons = modal.querySelectorAll(".interests-lightbox-close");
    const form = document.getElementById("contact-form");
    const statusEl = document.getElementById("contact-form-status");
    const sendButton = form.querySelector('[type="submit"]');
    const successAnimation = modal.querySelector(".contact-success-animation");
    const fields = {
      name: form.querySelector("#contact-name"),
      email: form.querySelector("#contact-email-input"),
      message: form.querySelector("#contact-message"),
    };

    let lastFocusedElement = null;
    let showingSuccess = false;
    let savedScrollX = 0;
    let savedScrollY = 0;

    function clearModalViewportStyles() {
      modal.style.top = "";
      modal.style.left = "";
      modal.style.right = "";
      modal.style.bottom = "";
      modal.style.width = "";
      modal.style.height = "";
      modal.style.minHeight = "";
    }

    function syncModalToVisualViewport() {
      if (modal.hidden || !window.visualViewport) {
        return;
      }

      const viewport = window.visualViewport;
      const keyboardOpen =
        viewport.offsetTop > 0 ||
        viewport.offsetLeft > 0 ||
        window.innerHeight - viewport.height > 40;

      if (keyboardOpen) {
        modal.style.top = viewport.offsetTop + "px";
        modal.style.left = viewport.offsetLeft + "px";
        modal.style.right = "auto";
        modal.style.bottom = "auto";
        modal.style.width = viewport.width + "px";
        modal.style.height = viewport.height + "px";
        modal.style.minHeight = "0px";
      } else {
        clearModalViewportStyles();
      }
    }

    function lockPageScroll() {
      savedScrollX = window.scrollX;
      savedScrollY = window.scrollY;
      document.documentElement.classList.add("contact-modal-open");
      document.body.classList.add("contact-modal-open");
      document.body.style.top = "-" + savedScrollY + "px";
      document.body.style.left = "-" + savedScrollX + "px";
      syncModalToVisualViewport();
    }

    function unlockPageScroll() {
      clearModalViewportStyles();
      document.documentElement.classList.remove("contact-modal-open");
      document.body.classList.remove("contact-modal-open");
      document.body.style.top = "";
      document.body.style.left = "";
      window.scrollTo(savedScrollX, savedScrollY);
    }

    function getFocusableElements() {
      const panel = showingSuccess ? successPanel : formPanel;

      return Array.from(
        panel.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(function (el) {
        return el.offsetParent !== null;
      });
    }

    function setStatus(message, type) {
      statusEl.textContent = message || "";
      statusEl.className = "contact-form-status";
      if (type) {
        statusEl.classList.add("contact-form-status--" + type);
      }
      statusEl.hidden = !message;
    }

    function setSending(isSending) {
      sendButton.disabled = isSending;
      sendButton.setAttribute("aria-busy", isSending ? "true" : "false");
      Object.values(fields).forEach(function (field) {
        field.disabled = isSending;
      });
      closeButtons.forEach(function (button) {
        button.disabled = isSending;
      });
    }

    function validateForm() {
      const name = fields.name.value.trim();
      const email = fields.email.value.trim();
      const message = fields.message.value.trim();

      if (!name) {
        setStatus("Please enter your name.", "error");
        fields.name.focus({ preventScroll: true });
        return null;
      }

      if (!email || !EMAIL_PATTERN.test(email)) {
        setStatus("Please enter a valid email address.", "error");
        fields.email.focus({ preventScroll: true });
        return null;
      }

      if (!message) {
        setStatus("Please enter a message.", "error");
        fields.message.focus({ preventScroll: true });
        return null;
      }

      setStatus("");
      return { name: name, email: email, message: message };
    }

    function showFormView() {
      showingSuccess = false;
      formPanel.hidden = false;
      successPanel.hidden = true;
      modal.classList.remove("contact-modal--success");
      modal.setAttribute("aria-labelledby", "contact-modal-title");
    }

    function restartSuccessAnimation() {
      if (!successAnimation) {
        return;
      }

      const source = successAnimation.getAttribute("src");
      successAnimation.setAttribute("src", "");
      successAnimation.setAttribute("src", source);
    }

    function showSuccessView() {
      showingSuccess = true;
      form.reset();
      setStatus("");
      setSending(false);
      formPanel.hidden = true;
      successPanel.hidden = false;
      modal.classList.add("contact-modal--success");
      modal.setAttribute("aria-labelledby", "contact-success-title");
      restartSuccessAnimation();

      window.setTimeout(function () {
        const successClose = successPanel.querySelector(".interests-lightbox-close");
        if (successClose) {
          successClose.focus({ preventScroll: true });
        }
      }, 0);
    }

    function openModal() {
      lastFocusedElement = document.activeElement;
      showFormView();
      modal.hidden = false;
      lockPageScroll();
      window.setTimeout(function () {
        fields.name.focus({ preventScroll: true });
      }, 0);
    }

    function closeModal() {
      modal.hidden = true;
      unlockPageScroll();
      showFormView();
      setSending(false);
      setStatus("");

      if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
        lastFocusedElement.focus({ preventScroll: true });
      }
    }

    function handleKeyDown(event) {
      if (modal.hidden) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
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
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    }

    async function handleSubmit(event) {
      event.preventDefault();
      const payload = validateForm();
      if (!payload) {
        return;
      }

      setSending(true);
      setStatus("Sending…", "loading");

      try {
        const response = await fetch(CONTACT_API_URL + "/api/contact", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: payload.name,
            email: payload.email,
            message: payload.message,
            pageUrl: location.href,
          }),
        });

        const data = await response.json().catch(function () {
          return {};
        });

        if (!response.ok || !data.ok) {
          throw new Error(data.error || "Something went wrong. Please try again.");
        }

        showSuccessView();
      } catch (error) {
        setSending(false);
        setStatus(
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
          "error"
        );
      }
    }

    function handleTouchMove(event) {
      if (modal.hidden) {
        return;
      }

      const target = event.target;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      const panel = showingSuccess ? successPanel : formPanel;
      if (
        panel &&
        panel.contains(target) &&
        panel.scrollHeight > panel.clientHeight + 1
      ) {
        return;
      }

      event.preventDefault();
    }

    openButton.addEventListener("click", openModal);
    closeButtons.forEach(function (button) {
      button.addEventListener("click", closeModal);
    });
    scrim.addEventListener("click", function () {
      if (showingSuccess) {
        closeModal();
      }
    });
    form.addEventListener("submit", handleSubmit);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("resize", syncModalToVisualViewport);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", syncModalToVisualViewport);
      window.visualViewport.addEventListener("scroll", syncModalToVisualViewport);
    }
  });
})();
