/* Reset focus on page reload */
window.addEventListener("DOMContentLoaded", function () {
  var hashLinks = document.querySelectorAll('a[href^="#"]');
  hashLinks.forEach(function (link) {
    link.addEventListener("click", function () {
      document.activeElement.blur();
    });
  });

  applyThemeToSvgIcons();
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", applyThemeToSvgIcons);
}

let nav = document.querySelector("[data-nav-mount] nav") || document.querySelector("nav");
let navSegments = document.querySelector("[data-nav-mount] .nav-segments");
let navSegmentLinks = [];
const pageSections = Array.from(document.querySelectorAll("section[id]"));
const MEGA_CATEGORY_HREFS = ["index.html#work", "index.html#play", "index.html#write"];
const MAX_PILL_RETRIES = 10;
const BACKDROP_LIGHT_THRESHOLD = 0.52;
const BACKDROP_DARK_THRESHOLD = 0.38;
const SAMPLE_X_FRACTIONS = [0.25, 0.5, 0.75];
const SAMPLE_EDGE_OFFSET = 4;

let currentNavBackdropMode = "light";
let backdropRafScheduled = false;

function srgbToLinear(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r, g, b) {
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

function parseColor(colorStr) {
  if (!colorStr || colorStr === "transparent") {
    return null;
  }

  const rgbaMatch = colorStr.match(
    /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/
  );

  if (!rgbaMatch) {
    return null;
  }

  const r = parseFloat(rgbaMatch[1]);
  const g = parseFloat(rgbaMatch[2]);
  const b = parseFloat(rgbaMatch[3]);
  let a = 1;

  if (rgbaMatch[4] !== undefined) {
    a = rgbaMatch[4].includes("%")
      ? parseFloat(rgbaMatch[4]) / 100
      : parseFloat(rgbaMatch[4]);
  }

  if (a <= 0) {
    return null;
  }

  return { r: r, g: g, b: b, a: a };
}

function parseGradientFirstColor(bgImage) {
  if (!bgImage || bgImage === "none") {
    return null;
  }

  const colorMatch = bgImage.match(/(?:rgba?|hsla?)\([^)]+\)/);
  return colorMatch ? parseColor(colorMatch[0]) : null;
}

function resolveLuminanceFromElement(startEl) {
  let el = startEl;

  while (el && el !== document.documentElement) {
    const style = window.getComputedStyle(el);
    const bgColor = parseColor(style.backgroundColor);

    if (bgColor && bgColor.a > 0.01) {
      return relativeLuminance(bgColor.r, bgColor.g, bgColor.b);
    }

    const gradientColor = parseGradientFirstColor(style.backgroundImage);
    if (gradientColor && gradientColor.a > 0.01) {
      return relativeLuminance(gradientColor.r, gradientColor.g, gradientColor.b);
    }

    el = el.parentElement;
  }

  const bodyStyle = window.getComputedStyle(document.body);
  const htmlStyle = window.getComputedStyle(document.documentElement);
  const fallback =
    parseColor(bodyStyle.backgroundColor) ||
    parseColor(htmlStyle.backgroundColor);

  if (fallback && fallback.a > 0.01) {
    return relativeLuminance(fallback.r, fallback.g, fallback.b);
  }

  return null;
}

function getLuminanceAtPoint(x, y, excludedContainers) {
  if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
    return null;
  }

  const el = document.elementFromPoint(x, y);
  if (!el) {
    return null;
  }

  if (
    excludedContainers &&
    excludedContainers.some(function (container) {
      return container && container.contains(el);
    })
  ) {
    return null;
  }

  return resolveLuminanceFromElement(el);
}

function buildSamplePoints(rect) {
  const points = [];

  SAMPLE_X_FRACTIONS.forEach(function (fraction) {
    const x = rect.left + rect.width * fraction;
    points.push({ x: x, y: rect.top + rect.height * 0.5 });
    points.push({ x: x, y: rect.bottom + SAMPLE_EDGE_OFFSET });
    points.push({ x: x, y: Math.max(0, rect.top - SAMPLE_EDGE_OFFSET) });
  });

  return points;
}

function sampleAverageLuminance(rect, excludedContainers) {
  const samplePoints = buildSamplePoints(rect);
  const luminances = [];

  samplePoints.forEach(function (point) {
    const lum = getLuminanceAtPoint(point.x, point.y, excludedContainers);
    if (lum !== null && !Number.isNaN(lum)) {
      luminances.push(lum);
    }
  });

  if (!luminances.length) {
    return null;
  }

  return (
    luminances.reduce(function (sum, value) {
      return sum + value;
    }, 0) / luminances.length
  );
}

function classifyBackdrop(averageLuminance, currentMode, forceReclassify) {
  if (forceReclassify) {
    return averageLuminance >= (BACKDROP_LIGHT_THRESHOLD + BACKDROP_DARK_THRESHOLD) / 2
      ? "light"
      : "dark";
  }

  if (averageLuminance >= BACKDROP_LIGHT_THRESHOLD) {
    return "light";
  }

  if (averageLuminance <= BACKDROP_DARK_THRESHOLD) {
    return "dark";
  }

  return currentMode || "light";
}

function setTemporaryPointerEvents(elements, disabled) {
  const savedStates = new Map();

  elements.forEach(function (el) {
    if (!el) {
      return;
    }

    savedStates.set(el, el.style.pointerEvents);

    if (disabled) {
      el.style.pointerEvents = "none";
    } else {
      el.style.pointerEvents = savedStates.get(el);
    }
  });

  return savedStates;
}

function restorePointerEvents(savedStates) {
  savedStates.forEach(function (value, el) {
    el.style.pointerEvents = value;
  });
}

function syncNavBackdropModeFromHeader(headerMount) {
  if (!headerMount) {
    return;
  }

  const existingMode = headerMount.getAttribute("data-nav-backdrop");
  if (existingMode === "light" || existingMode === "dark") {
    currentNavBackdropMode = existingMode;
  }
}

function updateNavBackdropTheme(forceReclassify) {
  const headerMount = document.querySelector("[data-nav-mount]");
  const navEl = headerMount && headerMount.querySelector("nav");

  if (!headerMount || !navEl) {
    return;
  }

  syncNavBackdropModeFromHeader(headerMount);

  const navRect = navEl.getBoundingClientRect();
  if (!navRect.width || !navRect.height) {
    return;
  }

  const savedPointerEvents = setTemporaryPointerEvents([headerMount], true);

  let average = null;

  try {
    average = sampleAverageLuminance(navRect, [headerMount]);
  } finally {
    restorePointerEvents(savedPointerEvents);
  }

  if (average === null) {
    return;
  }

  const nextMode = classifyBackdrop(
    average,
    currentNavBackdropMode,
    forceReclassify
  );

  if (nextMode === currentNavBackdropMode) {
    return;
  }

  currentNavBackdropMode = nextMode;
  headerMount.setAttribute("data-nav-backdrop", nextMode);
}

function updateToolBadgeBackdropThemes(forceReclassify) {
  const toolBadges = document.querySelectorAll(".tool-badge");
  if (!toolBadges.length) {
    return;
  }

  const headerMount = document.querySelector("[data-nav-mount]");
  const pointerTargets = Array.from(toolBadges);
  if (headerMount) {
    pointerTargets.push(headerMount);
  }

  toolBadges.forEach(function (toolBadge) {
    const iconRect = toolBadge.getBoundingClientRect();
    if (!iconRect.width || !iconRect.height) {
      return;
    }

    let average = null;
    const isInViewport =
      iconRect.bottom > 0 &&
      iconRect.top < window.innerHeight &&
      iconRect.right > 0 &&
      iconRect.left < window.innerWidth;

    if (isInViewport) {
      const savedPointerEvents = setTemporaryPointerEvents(pointerTargets, true);

      try {
        average = sampleAverageLuminance(iconRect, pointerTargets);
      } finally {
        restorePointerEvents(savedPointerEvents);
      }
    }

    if (average === null) {
      average = toolBadge.parentElement
        ? resolveLuminanceFromElement(toolBadge.parentElement)
        : resolveLuminanceFromElement(document.body);
    }

    if (average === null) {
      return;
    }

    const currentMode = toolBadge.getAttribute("data-tool-backdrop") || "light";
    const nextMode = classifyBackdrop(average, currentMode, forceReclassify);

    if (nextMode === currentMode) {
      return;
    }

    toolBadge.setAttribute("data-tool-backdrop", nextMode);
  });
}

function updateBackdropThemes(forceReclassify) {
  backdropRafScheduled = false;
  updateNavBackdropTheme(forceReclassify);
  updateToolBadgeBackdropThemes(forceReclassify);
}

function scheduleBackdropThemeUpdate(forceReclassify) {
  if (backdropRafScheduled) {
    return;
  }

  backdropRafScheduled = true;
  requestAnimationFrame(function () {
    updateBackdropThemes(forceReclassify);
  });
}

function bindColorSchemeBackdropSync() {
  if (!window.matchMedia) {
    return;
  }

  const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function onColorSchemeChange() {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        updateBackdropThemes(true);
        applyThemeToSvgIcons();
      });
    });
  }

  if (typeof colorSchemeQuery.addEventListener === "function") {
    colorSchemeQuery.addEventListener("change", onColorSchemeChange);
  } else if (typeof colorSchemeQuery.addListener === "function") {
    colorSchemeQuery.addListener(onColorSchemeChange);
  }
}

bindColorSchemeBackdropSync();

function scheduleNavBackdropThemeUpdate() {
  scheduleBackdropThemeUpdate();
}

function isMegaNavPage() {
  return Boolean(document.querySelector("[data-mega-nav]"));
}

function getSegmentHash(href) {
  if (!href) {
    return "";
  }

  const hashIndex = href.indexOf("#");
  if (hashIndex === -1) {
    return "";
  }

  return href.slice(hashIndex);
}

function getActiveNavSegmentFromHash() {
  const hash = location.hash;

  if (!hash || hash === "#" || !navSegmentLinks.length) {
    return null;
  }

  const sectionId = hash.substring(1);
  if (!sectionId) {
    return null;
  }

  return (
    navSegmentLinks.find(function (link) {
      const href = link.getAttribute("href") || "";
      return getSegmentHash(href).substring(1) === sectionId;
    }) || null
  );
}

function resolveInitialNavSegmentLink() {
  return (
    getActiveNavSegmentFromHash() ||
    navSegmentLinks.find(function (link) {
      return link.classList.contains("link-active");
    }) ||
    navSegmentLinks[0]
  );
}

function isMegaCategoryHref(href) {
  return MEGA_CATEGORY_HREFS.indexOf(href) !== -1;
}

function isMegaCategoryLink(link) {
  return isMegaNavPage() && isMegaCategoryHref(link.getAttribute("href") || "");
}

let navSelectionPill = null;
let activeSegmentHref = "";
let megaNavPillHref = "";
let megaNavResizeObserver = null;
let clickNavigationTargetHref = "";
let clickNavigationLockUntil = 0;
let fontsReadyScheduled = false;
const supportsSvgMaskRendering =
  typeof CSS !== "undefined" &&
  (CSS.supports("-webkit-mask-image", 'url("")') ||
    CSS.supports("mask-image", 'url("")'));

function syncSvgMaskSize(iconImage, iconMask) {
  const iconRect = iconImage.getBoundingClientRect();
  let iconWidth = iconRect.width || iconImage.width || 0;
  let iconHeight = iconRect.height || iconImage.height || 0;

  if (!iconWidth || !iconHeight) {
    const computedIconStyle = window.getComputedStyle(iconImage);
    iconWidth = parseFloat(computedIconStyle.width) || iconWidth;
    iconHeight = parseFloat(computedIconStyle.height) || iconHeight;
  }

  if (!iconWidth) {
    iconWidth = 16;
  }

  if (!iconHeight) {
    iconHeight = 16;
  }

  iconMask.style.setProperty("--svg-icon-width", `${iconWidth}px`);
  iconMask.style.setProperty("--svg-icon-height", `${iconHeight}px`);
}

function syncSvgMaskClasses(iconImage, iconMask) {
  iconMask.className = "svg-icon-mask";

  iconImage.classList.forEach(function (className) {
    if (className !== "svg-icon-image-fallback") {
      iconMask.classList.add(className);
    }
  });
}

const themedSvgIconSelector =
  'img[src*="/icons/"][src$=".svg"], img[src*="/icons/"][src*=".svg?"], ' +
  'img[src*="blog-thumbnails/"][src$=".svg"], img[src*="blog-thumbnails/"][src*=".svg?"]';

function applyThemeToSvgIcons() {
  if (!supportsSvgMaskRendering) {
    return;
  }

  const svgImages = document.querySelectorAll(themedSvgIconSelector);

  svgImages.forEach(function (iconImage) {
    const existingMask =
      iconImage.previousElementSibling &&
      iconImage.previousElementSibling.classList.contains("svg-icon-mask")
        ? iconImage.previousElementSibling
        : null;

    const iconSource = iconImage.getAttribute("src");
    if (!iconSource) {
      return;
    }

    if (iconImage.dataset.themeIconReady === "true" && existingMask) {
      syncSvgMaskClasses(iconImage, existingMask);
      syncSvgMaskSize(iconImage, existingMask);
      return;
    }

    const iconMask = document.createElement("span");
    iconMask.className = "svg-icon-mask";
    iconMask.setAttribute("aria-hidden", "true");
    iconMask.style.setProperty("--svg-icon-src", `url("${iconSource}")`);
    syncSvgMaskClasses(iconImage, iconMask);
    syncSvgMaskSize(iconImage, iconMask);

    iconImage.classList.add("svg-icon-image-fallback");
    iconImage.setAttribute("aria-hidden", "true");
    iconImage.style.display = "none";
    iconImage.dataset.themeIconReady = "true";

    if (!iconImage.parentNode) {
      return;
    }

    iconImage.parentNode.insertBefore(iconMask, iconImage);
  });
}

window.addEventListener("load", function () {
  applyThemeToSvgIcons();
});

window.addEventListener("resize", function () {
  applyThemeToSvgIcons();
});

function ensureNavSelectionPill() {
  if (!navSegments) {
    return;
  }

  navSelectionPill = navSegments.querySelector(".nav-selection-pill");

  if (navSelectionPill && navSelectionPill.tagName === "SPAN") {
    const replacement = document.createElement("div");
    replacement.className = "nav-selection-pill";
    replacement.setAttribute("aria-hidden", "true");
    navSelectionPill.replaceWith(replacement);
    navSelectionPill = replacement;
  }

  if (!navSelectionPill) {
    navSelectionPill = document.createElement("div");
    navSelectionPill.className = "nav-selection-pill";
    navSelectionPill.setAttribute("aria-hidden", "true");
    navSegments.prepend(navSelectionPill);
  }
}

function positionNavSelectionPill(immediate) {
  if (!navSegments || !navSelectionPill || !navSegmentLinks.length) {
    return false;
  }

  const segmentItems = navSegmentLinks
    .map(function (link) {
      return link.closest("li");
    })
    .filter(Boolean);

  if (!segmentItems.length) {
    return false;
  }

  const activeLinkIndex = navSegmentLinks.findIndex(function (link) {
    return link.classList.contains("link-active");
  });
  const resolvedIndex = activeLinkIndex >= 0 ? activeLinkIndex : 0;
  const activeLink = navSegmentLinks[resolvedIndex] || navSegmentLinks[0];
  const activeItem = activeLink.closest("li");

  if (!activeItem) {
    return false;
  }

  const pillWidth = activeItem.offsetWidth;
  const pillX = activeItem.offsetLeft;

  if (!pillWidth || pillWidth < 1) {
    return false;
  }

  if (immediate) {
    navSegments.classList.add("no-pill-transition");
  }

  navSegments.style.setProperty("--nav-pill-width", `${pillWidth}px`);
  navSegments.style.setProperty("--nav-pill-x", `${pillX}px`);
  navSelectionPill.style.setProperty("--nav-pill-width", `${pillWidth}px`);
  navSelectionPill.style.setProperty("--nav-pill-x", `${pillX}px`);
  navSegments.classList.add("pill-ready");

  if (immediate) {
    requestAnimationFrame(function () {
      navSegments.classList.remove("no-pill-transition");
    });
  }

  return true;
}

function positionNavSelectionPillWhenReady(immediate, attempt) {
  const retryAttempt = attempt || 0;

  if (positionNavSelectionPill(immediate)) {
    return;
  }

  if (retryAttempt >= MAX_PILL_RETRIES) {
    return;
  }

  requestAnimationFrame(function () {
    positionNavSelectionPillWhenReady(immediate, retryAttempt + 1);
  });
}

function setActiveNavSegment(link, immediate) {
  if (!link || !navSegmentLinks.length) {
    return;
  }

  navSegmentLinks.forEach(function (segmentLink) {
    segmentLink.classList.toggle("link-active", segmentLink === link);
  });

  activeSegmentHref = link.getAttribute("href") || "";
  positionNavSelectionPillWhenReady(Boolean(immediate), 0);
}

function lockScrollSyncForClickNavigation(targetHref) {
  clickNavigationTargetHref = targetHref || "";
  clickNavigationLockUntil = performance.now() + 2200;
}

function clearClickNavigationLock() {
  clickNavigationTargetHref = "";
  clickNavigationLockUntil = 0;
}

function hasReachedClickNavigationTarget() {
  if (!clickNavigationTargetHref) {
    return true;
  }

  if (clickNavigationTargetHref === "#" || clickNavigationTargetHref === "index.html") {
    return window.scrollY <= 8;
  }

  const targetHash = getSegmentHash(clickNavigationTargetHref);
  if (!targetHash || targetHash === "#") {
    return window.scrollY <= 8;
  }

  const targetId = targetHash.substring(1);
  if (!targetId) {
    return window.scrollY <= 8;
  }

  const targetSectionExists = Boolean(document.getElementById(targetId));
  if (!targetSectionExists) {
    return true;
  }

  return getCurrentSectionId() === targetId;
}

function shouldDeferScrollSyncAfterClick() {
  if (!clickNavigationTargetHref) {
    return false;
  }

  if (performance.now() > clickNavigationLockUntil || hasReachedClickNavigationTarget()) {
    clearClickNavigationLock();
    return false;
  }

  return true;
}

function getCurrentSectionId() {
  let currentSection = "";

  pageSections.forEach(function (section) {
    const sectionTop = section.offsetTop;
    const sectionHeight = section.clientHeight;

    if (window.scrollY >= sectionTop - sectionHeight / 3) {
      currentSection = section.getAttribute("id") || "";
    }
  });

  return currentSection;
}

function updateActiveSegmentFromScroll() {
  if (!navSegmentLinks.length || !pageSections.length) {
    return;
  }

  if (shouldDeferScrollSyncAfterClick()) {
    return;
  }

  const currentSectionId = getCurrentSectionId();
  const hashLink = getActiveNavSegmentFromHash();

  let nextActiveLink = navSegmentLinks.find(function (link) {
    const href = link.getAttribute("href") || "";
    return getSegmentHash(href).substring(1) === currentSectionId;
  });

  if (!nextActiveLink && hashLink && !currentSectionId) {
    nextActiveLink = hashLink;
  }

  const resolvedLink = nextActiveLink || navSegmentLinks[0];
  const nextHref = resolvedLink.getAttribute("href") || "";

  if (nextHref !== activeSegmentHref) {
    setActiveNavSegment(resolvedLink, false);
  }
}

function refreshNavReferences() {
  nav = document.querySelector("[data-nav-mount] nav") || document.querySelector("nav");
  navSegments =
    document.querySelector("[data-nav-mount] .nav-segments") ||
    document.querySelector(".nav-segments");
  navSegmentLinks = navSegments
    ? Array.from(navSegments.querySelectorAll(".nav-segment"))
    : [];
}

function scheduleNavSelectionPillUpdate(immediate) {
  requestAnimationFrame(function () {
    positionNavSelectionPillWhenReady(immediate, 0);
    requestAnimationFrame(function () {
      positionNavSelectionPillWhenReady(immediate, 0);
    });
  });
}

function bindMegaNavPillResizeSync() {
  if (!isMegaNavPage()) {
    return;
  }

  refreshNavReferences();

  const mountEl = document.querySelector("[data-mega-nav]");
  const list = mountEl && mountEl.querySelector(".nav-segments ul");

  if (!list) {
    return;
  }

  if (megaNavResizeObserver) {
    megaNavResizeObserver.disconnect();
  }

  megaNavResizeObserver = new ResizeObserver(function () {
    scheduleNavSelectionPillUpdate(false);
  });

  list.querySelectorAll("li").forEach(function (item) {
    megaNavResizeObserver.observe(item);
  });
}

function bindNavSegmentInteractions() {
  const mountEl = document.querySelector("[data-nav-mount]");
  if (!mountEl || mountEl.dataset.navSegmentListenersBound === "true") {
    return;
  }

  mountEl.addEventListener("click", function (event) {
    const link = event.target.closest(".nav-segment");
    if (!link || !mountEl.contains(link)) {
      return;
    }

    if (isMegaCategoryLink(link)) {
      return;
    }

    lockScrollSyncForClickNavigation(link.getAttribute("href") || "");
    setActiveNavSegment(link, false);
  });

  mountEl.dataset.navSegmentListenersBound = "true";
}

function scheduleFontsReadyPillUpdate() {
  if (fontsReadyScheduled || !document.fonts || !document.fonts.ready) {
    return;
  }

  fontsReadyScheduled = true;
  document.fonts.ready.then(function () {
    scheduleNavSelectionPillUpdate(true);
  });
}

function initNavSegments() {
  refreshNavReferences();

  if (!navSegmentLinks.length) {
    return false;
  }

  ensureNavSelectionPill();
  bindNavSegmentInteractions();

  const initialActiveLink = resolveInitialNavSegmentLink();

  if (isMegaNavPage()) {
    scheduleNavSelectionPillUpdate(true);
    bindMegaNavPillResizeSync();
  } else {
    setActiveNavSegment(initialActiveLink, true);
  }

  scheduleFontsReadyPillUpdate();
  return true;
}

function handleNavLifecycle() {
  try {
    if (!initNavSegments()) {
      return;
    }

    applyThemeToSvgIcons();
    scheduleNavBackdropThemeUpdate();
  } catch (error) {
    console.error("[nav]", error);
  }
}

function bootstrapNavIfReady() {
  if (document.querySelector("[data-nav-mount] .nav-segments")) {
    handleNavLifecycle();
  }
}

window.initPortfolioNav = handleNavLifecycle;

document.addEventListener("nav:mounted", handleNavLifecycle);

document.addEventListener("mega-nav:ready", function () {
  handleNavLifecycle();
});

document.addEventListener("mega-nav:active-updated", function (event) {
  const nextHref =
    event.detail && event.detail.activeHref !== undefined
      ? event.detail.activeHref
      : "";

  if (nextHref === megaNavPillHref) {
    return;
  }

  megaNavPillHref = nextHref;
  scheduleNavSelectionPillUpdate(true);
});

bootstrapNavIfReady();

window.addEventListener("resize", function () {
  scheduleNavSelectionPillUpdate(true);
  scheduleNavBackdropThemeUpdate();
});

window.addEventListener("load", function () {
  if (!isMegaNavPage()) {
    const hashLink = getActiveNavSegmentFromHash();
    if (hashLink) {
      setActiveNavSegment(hashLink, true);
    } else {
      updateActiveSegmentFromScroll();
    }
  }
  handleNavLifecycle();
  scheduleNavSelectionPillUpdate(true);
  scheduleNavBackdropThemeUpdate();
});

window.addEventListener("hashchange", function () {
  if (isMegaNavPage()) {
    return;
  }

  const hashLink = getActiveNavSegmentFromHash();
  if (hashLink) {
    setActiveNavSegment(hashLink, true);
  } else {
    updateActiveSegmentFromScroll();
  }
});

/* Highlight link when section is in view */
window.addEventListener(
  "scroll",
  function () {
    if (!isMegaNavPage()) {
      updateActiveSegmentFromScroll();
    }
    scheduleNavBackdropThemeUpdate();
  },
  { passive: true }
);

/* Hide and show nav based on scroll direction */
let previousScrollPosition =
  window.scrollY || document.documentElement.scrollTop;

window.addEventListener(
  "scroll",
  function () {
    if (!nav) {
      return;
    }

    const currentScrollPosition =
      window.scrollY || document.documentElement.scrollTop;

    if (currentScrollPosition > 40) {
      if (
        currentScrollPosition > previousScrollPosition &&
        !document.body.classList.contains("mega-menu-open")
      ) {
        // Scrolling down
        nav.classList.add("minimize");
      } else if (currentScrollPosition < previousScrollPosition) {
        // Scrolling up
        nav.classList.remove("minimize");
      }
    }

    previousScrollPosition = currentScrollPosition;
  },
  { passive: true }
);
