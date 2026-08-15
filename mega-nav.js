(function () {
  var MOBILE_BREAKPOINT = 500;
  var MEGA_CATEGORY_HREFS = {
    work: "index.html#work",
    play: "index.html#play",
    write: "index.html#write",
  };

  function getMegaNavMount() {
    return document.querySelector("[data-mega-nav]");
  }

  function dispatchMegaNavReady() {
    requestAnimationFrame(function () {
      document.dispatchEvent(new CustomEvent("mega-nav:ready"));
    });
  }

  function initMegaNav() {
    var mount = getMegaNavMount();
    if (!mount) {
      return false;
    }

    if (mount.getAttribute("data-mega-nav-ready") === "true") {
      return true;
    }

    var navRoot = mount.querySelector("nav");
    var megaMenuRoot = mount.querySelector(".mega-menu");

    if (!navRoot || !megaMenuRoot) {
      console.error(
        "[mega-nav] Missing required markup: nav and .mega-menu must exist inside [data-mega-nav]"
      );
      return false;
    }

    mount.setAttribute("data-mega-nav-ready", "true");

    var openCategoryId = null;
    var openTrigger = null;
    var desktopBackdrop = null;
    var megaTriggers = [];
    var closePromise = null;
    var lastPointer = { x: 0, y: 0 };

    function isMobileViewport() {
      return window.matchMedia("(max-width: " + MOBILE_BREAKPOINT + "px)").matches;
    }

    function supportsHoverOpen() {
      return !isMobileViewport() && window.matchMedia("(hover: hover)").matches;
    }

    function isPointInRect(x, y, rect) {
      return (
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
      );
    }

    function isPointInPolygon(x, y, points) {
      var inside = false;

      for (var i = 0, j = points.length - 1; i < points.length; j = i++) {
        var xi = points[i].x;
        var yi = points[i].y;
        var xj = points[j].x;
        var yj = points[j].y;
        var intersects =
          yi > y !== yj > y &&
          x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

        if (intersects) {
          inside = !inside;
        }
      }

      return inside;
    }

    function getMegaTriggersRowRect() {
      if (!megaTriggers.length) {
        return null;
      }

      var left = Infinity;
      var right = -Infinity;
      var top = Infinity;
      var bottom = -Infinity;

      megaTriggers.forEach(function (trigger) {
        var rect = trigger.getBoundingClientRect();
        left = Math.min(left, rect.left);
        right = Math.max(right, rect.right);
        top = Math.min(top, rect.top);
        bottom = Math.max(bottom, rect.bottom);
      });

      return { left: left, right: right, top: top, bottom: bottom };
    }

    function isPointerInMenuHoverZone(clientX, clientY) {
      if (!openCategoryId || !openTrigger) {
        return false;
      }

      if (typeof clientX !== "number" || typeof clientY !== "number") {
        return false;
      }

      var panel = getOpenPanel();
      var triggerRect = openTrigger.getBoundingClientRect();
      var megaTriggersRect = getMegaTriggersRowRect();

      if (
        megaTriggersRect &&
        isPointInRect(clientX, clientY, megaTriggersRect)
      ) {
        return true;
      }

      if (!panel || panel.hidden) {
        return false;
      }

      var panelRect = panel.getBoundingClientRect();

      if (isPointInRect(clientX, clientY, panelRect)) {
        return true;
      }

      var bridgeTop = megaTriggersRect
        ? megaTriggersRect.bottom
        : triggerRect.bottom;

      if (panelRect.top <= bridgeTop) {
        return false;
      }

      return isPointInPolygon(clientX, clientY, [
        { x: triggerRect.left, y: triggerRect.bottom },
        { x: triggerRect.right, y: triggerRect.bottom },
        { x: panelRect.right, y: panelRect.top },
        { x: panelRect.left, y: panelRect.top },
      ]);
    }

    function syncDesktopHoverMenuState(clientX, clientY) {
      if (!supportsHoverOpen() || !openCategoryId) {
        return;
      }

      if (isPointerInMenuHoverZone(clientX, clientY)) {
        return;
      }

      closeAllMenus({ immediate: true, restoreFocus: false });
    }

    function handleDesktopPointerMove(event) {
      if (!supportsHoverOpen()) {
        return;
      }

      lastPointer.x = event.clientX;
      lastPointer.y = event.clientY;

      syncMenuInert(event.clientX, event.clientY);
      syncDesktopHoverMenuState(event.clientX, event.clientY);
    }

    function handleDocumentPointerLeave(event) {
      if (!supportsHoverOpen() || !openCategoryId) {
        return;
      }

      if (event.relatedTarget) {
        return;
      }

      closeAllMenus({ immediate: true, restoreFocus: false });
    }

    function getCategoryIdFromHref(href) {
      if (!href) {
        return null;
      }

      for (var categoryId in MEGA_CATEGORY_HREFS) {
        if (MEGA_CATEGORY_HREFS[categoryId] === href) {
          return categoryId;
        }
      }

      return null;
    }

    function getPanel(categoryId) {
      return megaMenuRoot.querySelector("#mega-panel-" + categoryId);
    }

    function normalizePath(pathname) {
      var path = pathname || "";

      if (!path || path === "/") {
        return "index.html";
      }

      path = path.replace(/\/+$/, "");

      if (path.endsWith("/index.html")) {
        path = path.slice(0, -"/index.html".length) + ".html";
      }

      if (path.charAt(0) === "/") {
        path = path.slice(1);
      }

      var portfolioIndex = path.indexOf("portfolio/");
      if (portfolioIndex !== -1) {
        path = path.slice(portfolioIndex + "portfolio/".length);
      }

      return path;
    }

    function findTriggerForCategory(categoryId) {
      var href = MEGA_CATEGORY_HREFS[categoryId];
      return navRoot.querySelector('.nav-segment[href="' + href + '"]');
    }

    function getOpenPanel() {
      return openCategoryId ? getPanel(openCategoryId) : null;
    }

    function isFocusableVisible(element) {
      if (
        element.hidden ||
        element.getAttribute("aria-hidden") === "true" ||
        element.getAttribute("aria-disabled") === "true"
      ) {
        return false;
      }

      var style = window.getComputedStyle(element);

      if (style.display === "none" || style.visibility === "hidden") {
        return false;
      }

      return element.getClientRects().length > 0;
    }

    function getPanelFocusables(panel) {
      if (!panel) {
        return [];
      }

      return Array.from(
        panel.querySelectorAll(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(isFocusableVisible);
    }

    function getNavSegments() {
      return Array.from(navRoot.querySelectorAll(".nav-segment")).filter(
        isFocusableVisible
      );
    }

    function getNextNavSegmentAfter(trigger) {
      var segments = getNavSegments();
      var triggerIndex = segments.indexOf(trigger);

      if (triggerIndex === -1 || triggerIndex >= segments.length - 1) {
        return null;
      }

      return segments[triggerIndex + 1];
    }

    function syncMenuInert(clientX, clientY) {
      if (!("inert" in megaMenuRoot)) {
        return;
      }

      if (!openCategoryId) {
        megaMenuRoot.inert = false;
        return;
      }

      if (supportsHoverOpen()) {
        megaMenuRoot.inert = false;
        return;
      }

      if (isMobileViewport() && openCategoryId) {
        megaMenuRoot.inert = false;
        return;
      }

      var panel = getOpenPanel();
      var active = document.activeElement;

      if ((panel && panel.contains(active)) || active === openTrigger) {
        megaMenuRoot.inert = false;
        return;
      }

      megaMenuRoot.inert = true;
    }

    function leaveMenuAndFocus(target) {
      closeAllMenus({ immediate: true, restoreFocus: false });

      if (target) {
        target.focus();
      }
    }

    function handlePanelTabNavigation(event) {
      var panel = getOpenPanel();

      if (!panel || panel.hidden) {
        return;
      }

      var focusables = getPanelFocusables(panel);

      if (!focusables.length) {
        return;
      }

      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      var active = document.activeElement;

      if (event.shiftKey && active === first && openTrigger) {
        event.preventDefault();
        leaveMenuAndFocus(openTrigger);
        return;
      }

      if (!event.shiftKey && active === openTrigger) {
        event.preventDefault();
        megaMenuRoot.inert = false;
        first.focus();
        syncMenuInert(lastPointer.x, lastPointer.y);
        return;
      }

      if (!event.shiftKey && active === last && openTrigger) {
        event.preventDefault();
        leaveMenuAndFocus(getNextNavSegmentAfter(openTrigger));
      }
    }

    function handleMenuFocusIn(event) {
      if (!openCategoryId) {
        return;
      }

      var panel = getOpenPanel();

      if (!panel) {
        return;
      }

      var target = event.target;

      if (panel.contains(target) || target === openTrigger) {
        syncMenuInert(lastPointer.x, lastPointer.y);
        return;
      }

      closeAllMenus({ immediate: true, restoreFocus: false });
    }

    function applyActiveStates() {
      var currentPath = normalizePath(location.pathname);
      var activeCategoryId = null;
      var nextActiveHref = null;

      navRoot.querySelectorAll(".nav-segment").forEach(function (segment) {
        segment.classList.remove("link-active");
      });

      megaMenuRoot.querySelectorAll(".mega-menu-link").forEach(function (item) {
        if (normalizePath(item.getAttribute("href") || "") !== currentPath) {
          return;
        }

        var panel = item.closest(".mega-menu-panel");

        if (panel) {
          activeCategoryId = panel.id.replace("mega-panel-", "");
        }
      });

      if (activeCategoryId) {
        var activeTrigger = findTriggerForCategory(activeCategoryId);
        if (activeTrigger) {
          activeTrigger.classList.add("link-active");
          nextActiveHref = activeTrigger.getAttribute("href") || "";
        }
      }

      document.dispatchEvent(
        new CustomEvent("mega-nav:active-updated", {
          detail: { activeHref: nextActiveHref },
        })
      );
    }

    function setTriggerExpanded(trigger, expanded) {
      if (!trigger) {
        return;
      }

      trigger.setAttribute("aria-expanded", expanded ? "true" : "false");
    }

    function ensureDesktopBackdrop() {
      if (desktopBackdrop) {
        return desktopBackdrop;
      }

      desktopBackdrop = document.createElement("div");
      desktopBackdrop.className = "mega-menu-backdrop";
      desktopBackdrop.hidden = true;
      desktopBackdrop.addEventListener("click", function () {
        closeAllMenus({ restoreFocus: false });
        requestAnimationFrame(blurPointerFocus);
      });
      document.body.appendChild(desktopBackdrop);
      return desktopBackdrop;
    }

    function prefersReducedMotion() {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }

    function clearPanelAnimation(panel) {
      panel.classList.remove(
        "mega-menu-panel-animate-in",
        "mega-menu-panel-animate-out",
        "mega-menu-panel-enter-preparing"
      );
      panel.style.removeProperty("--mega-origin-x");
      panel.style.removeProperty("--mega-origin-y");
      panel.style.removeProperty("--mega-scale-from");
    }

    function finishClosePanel(panel) {
      clearPanelAnimation(panel);
      panel.hidden = true;
      panel.classList.remove("mega-menu-panel-open");
    }

    function setPanelTransformOrigin(panel, trigger) {
      var triggerRect = trigger.getBoundingClientRect();
      var panelRect = panel.getBoundingClientRect();
      var originX = triggerRect.left + triggerRect.width / 2 - panelRect.left;
      var originY = isMobileViewport()
        ? triggerRect.top - panelRect.top - 8
        : triggerRect.bottom - panelRect.top;
      var scaleFrom = clamp(triggerRect.width / panelRect.width, 0.12, 0.95);

      panel.style.setProperty("--mega-origin-x", originX + "px");
      panel.style.setProperty("--mega-origin-y", originY + "px");
      panel.style.setProperty("--mega-scale-from", String(scaleFrom));
    }

    function startPanelEnterAnimation(panel, trigger) {
      var reducedMotion = prefersReducedMotion();

      setPanelTransformOrigin(panel, trigger);

      if (reducedMotion) {
        panel.classList.remove("mega-menu-panel-enter-preparing");
        return;
      }

      panel.classList.remove("mega-menu-panel-enter-preparing");
      panel.classList.add("mega-menu-panel-animate-in");
    }

    function finalizeClose() {
      megaMenuRoot.querySelectorAll(".mega-menu-panel").forEach(finishClosePanel);

      megaTriggers.forEach(function (trigger) {
        setTriggerExpanded(trigger, false);
      });

      if (desktopBackdrop) {
        desktopBackdrop.hidden = true;
      }

      openCategoryId = null;
      openTrigger = null;
      closePromise = null;
      syncMenuInert();
    }

    function closePanels(options) {
      options = options || {};
      var immediate = options.immediate === true;
      var panel = openCategoryId ? getPanel(openCategoryId) : null;
      var trigger = openTrigger;

      if (!panel || panel.hidden) {
        finalizeClose();
        return Promise.resolve();
      }

      if (immediate || prefersReducedMotion()) {
        finalizeClose();
        return Promise.resolve();
      }

      if (closePromise) {
        return closePromise;
      }

      panel.classList.remove("mega-menu-panel-animate-in");

      if (!panel.style.getPropertyValue("--mega-origin-x") && trigger) {
        setPanelTransformOrigin(panel, trigger);
      }

      setTriggerExpanded(trigger, false);

      if (desktopBackdrop) {
        desktopBackdrop.hidden = true;
      }

      closePromise = new Promise(function (resolve) {
        function onAnimationEnd(event) {
          if (event.target !== panel) {
            return;
          }

          panel.removeEventListener("animationend", onAnimationEnd);
          finalizeClose();
          resolve();
        }

        void panel.offsetWidth;
        panel.classList.add("mega-menu-panel-animate-out");
        panel.addEventListener("animationend", onAnimationEnd);
      });

      return closePromise;
    }

    function closeAllMenus(options) {
      options = options || {};
      var triggerToFocus =
        options.restoreFocus === true ? openTrigger : null;

      return closePanels(options).then(function () {
        if (triggerToFocus) {
          triggerToFocus.focus();
        }
      });
    }

    function blurPointerFocus() {
      var active = document.activeElement;

      if (
        active &&
        active !== document.body &&
        typeof active.blur === "function" &&
        (navRoot.contains(active) || megaMenuRoot.contains(active))
      ) {
        active.blur();
      }
    }

    function positionPanel(panel) {
      var navRect = navRoot.getBoundingClientRect();

      panel.style.setProperty("--mega-panel-left", navRect.left + "px");
      panel.style.setProperty("--mega-panel-width", navRect.width + "px");

      if (isMobileViewport()) {
        panel.style.removeProperty("--mega-panel-top");
        panel.style.setProperty(
          "--mega-panel-bottom",
          window.innerHeight - navRect.top + 8 + "px"
        );
        return;
      }

      panel.style.removeProperty("--mega-panel-bottom");
      panel.style.setProperty("--mega-panel-top", navRect.bottom + 8 + "px");
    }

    function openMenu(categoryId, trigger) {
      var panel = getPanel(categoryId);

      if (
        openCategoryId === categoryId &&
        openTrigger === trigger &&
        panel &&
        !panel.hidden
      ) {
        return;
      }

      closePanels({ immediate: true });

      if (!panel) {
        return;
      }

      openCategoryId = categoryId;
      openTrigger = trigger;
      panel.classList.add("mega-menu-panel-open");

      if (!prefersReducedMotion()) {
        panel.classList.add("mega-menu-panel-enter-preparing");
      }

      setTriggerExpanded(trigger, true);

      positionPanel(panel);
      ensureDesktopBackdrop().hidden = false;

      panel.hidden = false;
      void panel.offsetWidth;
      startPanelEnterAnimation(panel, trigger);
    }

    function toggleMenu(categoryId, trigger) {
      if (openCategoryId === categoryId) {
        return closeAllMenus({ restoreFocus: false });
      }

      openMenu(categoryId, trigger);
      return Promise.resolve();
    }

    function handleTriggerClick(event) {
      var trigger = event.currentTarget;
      var categoryId = getCategoryIdFromHref(trigger.getAttribute("href") || "");

      if (!categoryId) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (isMobileViewport()) {
        toggleMenu(categoryId, trigger).then(blurPointerFocus);
        requestAnimationFrame(blurPointerFocus);
      }
    }

    function handleTriggerKeydown(event) {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();

      var trigger = event.currentTarget;
      var categoryId = getCategoryIdFromHref(trigger.getAttribute("href") || "");

      if (!categoryId) {
        return;
      }

      if (openCategoryId === categoryId) {
        closeAllMenus();
        return;
      }

      openMenu(categoryId, trigger);
    }

    function bindDesktopHoverInteractions() {
      document.addEventListener("pointermove", handleDesktopPointerMove, {
        passive: true,
      });
      document.addEventListener("pointerleave", handleDocumentPointerLeave);

      megaTriggers.forEach(function (trigger) {
        var categoryId = getCategoryIdFromHref(trigger.getAttribute("href") || "");

        trigger.addEventListener("mouseenter", function (event) {
          if (!supportsHoverOpen()) {
            return;
          }

          lastPointer.x = event.clientX;
          lastPointer.y = event.clientY;
          openMenu(categoryId, trigger);
          syncMenuInert(event.clientX, event.clientY);
        });
      });
    }

    function handleDocumentKeydown(event) {
      if (!openCategoryId) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeAllMenus({ restoreFocus: true });
        return;
      }

      if (event.key === "Tab") {
        handlePanelTabNavigation(event);
      }
    }

    function bindNavInteractions() {
      megaTriggers = Object.keys(MEGA_CATEGORY_HREFS)
        .map(findTriggerForCategory)
        .filter(Boolean);

      megaTriggers.forEach(function (trigger) {
        var categoryId = getCategoryIdFromHref(trigger.getAttribute("href") || "");
        trigger.setAttribute("aria-haspopup", "true");
        trigger.setAttribute("aria-expanded", "false");
        trigger.setAttribute("aria-controls", "mega-panel-" + categoryId);
        trigger.addEventListener("click", handleTriggerClick);
        trigger.addEventListener("keydown", handleTriggerKeydown);
      });

      megaMenuRoot.querySelectorAll(".mega-menu-link").forEach(function (link) {
        link.addEventListener("click", function () {
          closeAllMenus({ immediate: true, restoreFocus: false });
          requestAnimationFrame(blurPointerFocus);
        });
      });

      megaMenuRoot.querySelectorAll(".mega-menu-close").forEach(function (button) {
        button.addEventListener("click", function () {
          closeAllMenus({ restoreFocus: false });
          requestAnimationFrame(blurPointerFocus);
        });
      });
    }

    applyActiveStates();
    bindNavInteractions();
    bindDesktopHoverInteractions();

    document.addEventListener("keydown", handleDocumentKeydown);
    document.addEventListener("focusin", handleMenuFocusIn);

    window.addEventListener("resize", function () {
      if (!openCategoryId || !openTrigger) {
        return;
      }

      var panel = getPanel(openCategoryId);
      if (!panel) {
        return;
      }

      positionPanel(panel);
      ensureDesktopBackdrop().hidden = false;
    });

    window.addEventListener(
      "scroll",
      function () {
        if (!openCategoryId) {
          return;
        }

        closeAllMenus({ immediate: true });
      },
      { passive: true }
    );

    dispatchMegaNavReady();
    return true;
  }

  function tryInitMegaNav() {
    if (initMegaNav()) {
      return;
    }

    if (!getMegaNavMount()) {
      return;
    }

    console.warn("[mega-nav] Initialization deferred until nav markup is available");
  }

  document.addEventListener("nav:mounted", function (event) {
    if (event.detail && event.detail.hasMegaNav) {
      tryInitMegaNav();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tryInitMegaNav);
  } else {
    tryInitMegaNav();
  }
})();
