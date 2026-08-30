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
  const CONTACT_EXIT_URL = "index.html#about";
  const MODAL_ANIMATION_MS = 450;
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const mobileDeviceQuery = window.matchMedia(
    "(hover: none) and (pointer: coarse)"
  );
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  function isMobileDevice() {
    return mobileDeviceQuery.matches;
  }

  function bindContactForm(root) {
    const formPanel = root.querySelector("#contact-form-panel");
    const successPanel = root.querySelector("#contact-success-panel");
    const form = root.querySelector("#contact-form");
    const statusEl = root.querySelector("#contact-form-status");
    const sendButton = form && form.querySelector('[type="submit"]');
    const successAnimation = root.querySelector(".contact-success-animation");
    const closeButtons = root.querySelectorAll(".interests-lightbox-close");

    if (!formPanel || !successPanel || !form || !statusEl || !sendButton) {
      return null;
    }

    const fields = {
      name: form.querySelector("#contact-name"),
      email: form.querySelector("#contact-email-input"),
      message: form.querySelector("#contact-message"),
    };

    let showingSuccess = false;

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
      root.classList.remove("contact-modal--success");
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
      root.classList.add("contact-modal--success");
      restartSuccessAnimation();

      window.setTimeout(function () {
        const successClose = successPanel.querySelector(".interests-lightbox-close");
        if (successClose) {
          successClose.focus({ preventScroll: true });
        }
      }, 0);
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

    form.addEventListener("submit", handleSubmit);

    return {
      fields: fields,
      closeButtons: closeButtons,
      showFormView: showFormView,
      setSending: setSending,
      setStatus: setStatus,
      isShowingSuccess: function () {
        return showingSuccess;
      },
    };
  }

  function canGoBackToSite() {
    if (history.length <= 1 || !document.referrer) {
      return false;
    }

    try {
      return new URL(document.referrer).origin === location.origin;
    } catch (error) {
      return false;
    }
  }

  function leaveContactPage(event) {
    if (event) {
      event.preventDefault();
    }

    sessionStorage.setItem("skip-home-intro", "1");

    if (canGoBackToSite()) {
      history.back();
      return;
    }

    location.assign(CONTACT_EXIT_URL);
  }

  function initContactPage() {
    const formApi = bindContactForm(document);
    if (!formApi) {
      return;
    }

    const pageMain = document.querySelector(".contact-page-main");
    if (pageMain) {
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          pageMain.classList.add("contact-page-main--visible");
        });
      });
    }

    formApi.closeButtons.forEach(function (button) {
      button.addEventListener("click", leaveContactPage);
    });
  }

  function initContactModal() {
    const openButton = document.getElementById("contact-email");
    const modal = document.getElementById("contact-modal");
    if (!openButton || !modal) {
      return;
    }

    const formApi = bindContactForm(modal);
    if (!formApi) {
      return;
    }

    const scrim = modal.querySelector(".contact-modal-scrim");
    let lastFocusedElement = null;
    let savedScrollX = 0;
    let savedScrollY = 0;
    let closeAnimationTimer = 0;

    function clearCloseAnimationTimer() {
      if (closeAnimationTimer) {
        window.clearTimeout(closeAnimationTimer);
        closeAnimationTimer = 0;
      }
    }

    function setModalVisible(isVisible) {
      modal.classList.toggle("contact-modal--visible", isVisible);
      if (isVisible) {
        modal.classList.remove("contact-modal--closing");
      }
    }

    function lockPageScroll() {
      savedScrollX = window.scrollX;
      savedScrollY = window.scrollY;
      document.documentElement.classList.add("contact-modal-open");
      document.body.classList.add("contact-modal-open");
      document.body.style.top = "-" + savedScrollY + "px";
      document.body.style.left = "-" + savedScrollX + "px";
    }

    function unlockPageScroll() {
      const scrollX = savedScrollX;
      const scrollY = savedScrollY;

      document.documentElement.classList.remove("contact-modal-open");
      document.body.classList.remove("contact-modal-open");
      document.body.style.top = "";
      document.body.style.left = "";

      const root = document.documentElement;
      const previousScrollBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      window.scrollTo(scrollX, scrollY);
      root.style.scrollBehavior = previousScrollBehavior;

      window.requestAnimationFrame(function () {
        if (typeof parallaxScroll === "function") {
          parallaxScroll();
        }
      });
    }

    function finishCloseModal(focusTarget) {
      clearCloseAnimationTimer();
      modal.classList.remove("contact-modal--closing", "contact-modal--visible");
      modal.hidden = true;
      unlockPageScroll();
      formApi.showFormView();
      formApi.setSending(false);
      formApi.setStatus("");

      window.requestAnimationFrame(function () {
        if (focusTarget && typeof focusTarget.focus === "function") {
          focusTarget.focus({ preventScroll: true });
        }
      });
    }

    function getFocusableElements() {
      const panel = formApi.isShowingSuccess()
        ? document.getElementById("contact-success-panel")
        : document.getElementById("contact-form-panel");

      return Array.from(
        panel.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(function (el) {
        return el.offsetParent !== null;
      });
    }

    function openModal() {
      if (!modal.hidden && modal.classList.contains("contact-modal--visible")) {
        return;
      }

      clearCloseAnimationTimer();
      lastFocusedElement = document.activeElement;
      formApi.showFormView();
      modal.hidden = false;
      modal.classList.remove("contact-modal--closing");
      lockPageScroll();

      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          setModalVisible(true);
          formApi.fields.name.focus({ preventScroll: true });
        });
      });
    }

    function closeModal() {
      if (modal.hidden || modal.classList.contains("contact-modal--closing")) {
        return;
      }

      const focusTarget = lastFocusedElement;
      setModalVisible(false);
      modal.classList.add("contact-modal--closing");

      if (prefersReducedMotion) {
        finishCloseModal(focusTarget);
        return;
      }

      clearCloseAnimationTimer();
      closeAnimationTimer = window.setTimeout(function () {
        finishCloseModal(focusTarget);
      }, MODAL_ANIMATION_MS);
    }

    function handleKeyDown(event) {
      if (modal.hidden || modal.classList.contains("contact-modal--closing")) {
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

    openButton.addEventListener("click", function (event) {
      if (isMobileDevice()) {
        sessionStorage.setItem("skip-home-intro", "1");
        return;
      }

      event.preventDefault();
      openModal();
    });

    formApi.closeButtons.forEach(function (button) {
      button.addEventListener("click", closeModal);
    });

    if (scrim) {
      scrim.addEventListener("click", function () {
        if (formApi.isShowingSuccess()) {
          closeModal();
        }
      });
    }

    document.addEventListener("keydown", handleKeyDown);
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (document.body.classList.contains("contact-page")) {
      initContactPage();
      return;
    }

    initContactModal();
  });
})();
