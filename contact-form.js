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

    return "https://portfolio-contact-api.onrender.com";
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
        fields.name.focus();
        return null;
      }

      if (!email || !EMAIL_PATTERN.test(email)) {
        setStatus("Please enter a valid email address.", "error");
        fields.email.focus();
        return null;
      }

      if (!message) {
        setStatus("Please enter a message.", "error");
        fields.message.focus();
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
          successClose.focus();
        }
      }, 0);
    }

    function openModal() {
      lastFocusedElement = document.activeElement;
      showFormView();
      modal.hidden = false;
      document.body.classList.add("contact-modal-open");
      window.setTimeout(function () {
        fields.name.focus();
      }, 0);
    }

    function closeModal() {
      modal.hidden = true;
      document.body.classList.remove("contact-modal-open");
      showFormView();
      setSending(false);
      setStatus("");

      if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
        lastFocusedElement.focus();
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
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
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
  });
})();
