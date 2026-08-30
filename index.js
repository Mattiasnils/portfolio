// Handle parallax scroll behavior
function parallaxScroll() {
  const scrollPosition = Math.floor(window.scrollY);
  const headline = document.querySelector(".headline");
  const intro = document.getElementById("introduction");
  const background = document.getElementById("hero-bubbles");

  if (headline) {
    const newScale = Math.fround(1 - scrollPosition / 8480);
    headline.style.setProperty("scale", newScale);
    headline.style.transform = `translateY(${Math.fround(
      scrollPosition * 0.6
    )}px)`;
    if (intro) {
      intro.style.transform = `translateY(${Math.fround(
        1 - scrollPosition / 10
      )}px)`;
    }
    if (background) {
      const newScale2 = Math.fround(1 - scrollPosition / 3500);
      background.style.setProperty("scale", newScale2);
    }
  }
}

let rafPending = false;

function scrollHandler() {
  if (!rafPending) {
    window.requestAnimationFrame(function () {
      parallaxScroll();
      rafPending = false;
    });
    rafPending = true;
  }
}

window.addEventListener("scroll", scrollHandler, { passive: true });

function hasSeenIntro() {
  return document.documentElement.classList.contains("intro-seen");
}

let introSequenceStart = null;

function getIntroElapsedMs() {
  if (introSequenceStart === null) {
    return 0;
  }

  return performance.now() - introSequenceStart;
}

function markIntroSequenceStart(startTime) {
  if (introSequenceStart !== null) {
    return;
  }

  introSequenceStart = startTime;
  document.dispatchEvent(new CustomEvent("intro:sequence-start"));
}

function ensureIntroSequenceStart() {
  markIntroSequenceStart(performance.now());
}

// Anchor JS intro timing to the CSS #introduction animation clock.
(function initIntroSequenceAnchor() {
  if (!document.body.classList.contains("home") || hasSeenIntro()) {
    ensureIntroSequenceStart();
    return;
  }

  const intro = document.getElementById("introduction");
  if (!intro) {
    ensureIntroSequenceStart();
    return;
  }

  intro.addEventListener(
    "animationstart",
    function (event) {
      if (event.animationName === "intro-float-up") {
        markIntroSequenceStart(performance.now());
      }
    },
    { once: true }
  );

  window.requestAnimationFrame(function () {
    if (introSequenceStart !== null) {
      return;
    }

    const introAnimation = intro
      .getAnimations()
      .find(function (animation) {
        return animation.animationName === "intro-float-up";
      });

    if (introAnimation) {
      markIntroSequenceStart(
        performance.now() - introAnimation.currentTime
      );
    }
  });

  window.setTimeout(function () {
    if (introSequenceStart === null && !hasSeenIntro()) {
      ensureIntroSequenceStart();
    }
  }, 6000);
})();

function parseCssTime(value) {
  const trimmed = (value || "").trim();

  if (!trimmed) {
    return 0;
  }

  if (trimmed.endsWith("ms")) {
    return parseFloat(trimmed);
  }

  return parseFloat(trimmed) * 1000;
}

function getIntroNavTimings() {
  const rootStyle = getComputedStyle(document.documentElement);
  const introDuration = parseCssTime(
    rootStyle.getPropertyValue("--intro-duration")
  );
  const settleStartRatio = parseFloat(
    rootStyle.getPropertyValue("--intro-settle-start-ratio")
  );
  const settleEndRatio = parseFloat(
    rootStyle.getPropertyValue("--intro-settle-end-ratio")
  );

  if (
    !introDuration ||
    Number.isNaN(settleStartRatio) ||
    Number.isNaN(settleEndRatio)
  ) {
    return { delay: 0, duration: 0 };
  }

  return {
    delay: introDuration * settleStartRatio,
    duration: introDuration * (settleEndRatio - settleStartRatio),
  };
}

// Sync nav reveal with the intro text settle spring + bounce (home page only)
(function initNavIntroReveal() {
  if (!document.body.classList.contains("home")) {
    return;
  }

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  let navIntroDelayTimer = 0;
  let navIntroRevealTimer = 0;

  function clearNavIntroTimers() {
    if (navIntroDelayTimer) {
      window.clearTimeout(navIntroDelayTimer);
      navIntroDelayTimer = 0;
    }

    if (navIntroRevealTimer) {
      window.clearTimeout(navIntroRevealTimer);
      navIntroRevealTimer = 0;
    }
  }

  function revealNav(navHeader) {
    navHeader.classList.add("nav-intro-ready");
    document.documentElement.classList.remove("intro-pending");
  }

  function playNavIntro(navHeader) {
    navHeader.classList.remove("nav-intro-playing");
    void navHeader.offsetWidth;
    navHeader.classList.add("nav-intro-playing");
  }

  function showNavImmediately(navHeader) {
    document.documentElement.classList.remove("intro-pending");
    revealNav(navHeader);
    navHeader.classList.add("nav-intro-playing");
    navHeader.style.opacity = "1";
    navHeader.style.visibility = "visible";
    navHeader.style.transform = "none";
  }

  function scheduleNavIntro(navHeader) {
    clearNavIntroTimers();

    if (!navHeader || !navHeader.querySelector("nav")) {
      return;
    }

    if (reducedMotion || hasSeenIntro()) {
      showNavImmediately(navHeader);
      return;
    }

    if (introSequenceStart === null) {
      return;
    }

    const timings = getIntroNavTimings();
    const elapsed = getIntroElapsedMs();
    const settleEnd = timings.delay + timings.duration;
    const remaining = timings.delay - elapsed;

    if (elapsed >= settleEnd) {
      showNavImmediately(navHeader);
      return;
    }

    function startNavIntro() {
      playNavIntro(navHeader);
      navIntroRevealTimer = window.setTimeout(function () {
        revealNav(navHeader);
        navIntroRevealTimer = 0;
      }, timings.duration);
    }

    if (remaining <= 0) {
      startNavIntro();
      return;
    }

    navIntroDelayTimer = window.setTimeout(function () {
      navIntroDelayTimer = 0;
      startNavIntro();
    }, remaining);
  }

  function bindNavIntro(navHeader) {
    if (!navHeader) {
      return;
    }

    scheduleNavIntro(navHeader);
  }

  function tryBindNavIntro() {
    bindNavIntro(document.querySelector("header[data-nav-mount]"));
  }

  document.addEventListener("intro:sequence-start", tryBindNavIntro);
  document.addEventListener("nav:mounted", tryBindNavIntro);
  tryBindNavIntro();
})();

// Animate bubbles — gentle idle float after entrance animation settles
(function initHeroBubbleFloat() {
  const bubbles = document.getElementById("hero-bubbles");
  if (!bubbles) {
    return;
  }

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  const amplitude = 10;
  const floatPeriodMs = 2094;
  const rampDuration = 900;
  let baseTop = parseFloat(getComputedStyle(bubbles).top);
  let floatStart = 0;
  let rampStart = 0;
  let rafId = 0;
  let floating = false;

  function settleBubbleState() {
    bubbles.style.transform = "none";
    parallaxScroll();
    baseTop = parseFloat(getComputedStyle(bubbles).top);
  }

  function tick(timestamp) {
    if (!floating) {
      return;
    }

    if (!floatStart) {
      floatStart = timestamp || performance.now();
      rampStart = floatStart;
    }

    const elapsed = timestamp - floatStart;
    const rampProgress = Math.min(1, (timestamp - rampStart) / rampDuration);
    const easedRamp =
      rampProgress * rampProgress * (3 - 2 * rampProgress);
    const currentAmplitude = amplitude * easedRamp;
    const displacement =
      currentAmplitude *
      Math.sin((2 * Math.PI * elapsed) / floatPeriodMs);

    bubbles.style.top = `${baseTop + displacement}px`;
    rafId = window.requestAnimationFrame(tick);
  }

  function startBubbleFloat() {
    settleBubbleState();
    floating = true;
    floatStart = 0;
    rampStart = 0;
    rafId = window.requestAnimationFrame(tick);
  }

  if (reducedMotion || hasSeenIntro()) {
    startBubbleFloat();
  } else {
    bubbles.addEventListener(
      "animationend",
      function (event) {
        if (event.animationName !== "hero-bubbles-in") {
          return;
        }

        startBubbleFloat();
      },
      { once: true }
    );
  }

  window.addEventListener("pagehide", function () {
    floating = false;

    if (rafId) {
      window.cancelAnimationFrame(rafId);
    }
  });
})();

// Work card description coloring
const workCards = document.querySelectorAll(".work-card");

workCards.forEach((card) => {
  const image = card.querySelector("img");
  const description = card.querySelector(".work-card-description");

  // Create a new Image object and set its source to the image source
  const imageObj = new Image();
  imageObj.src = image.src;

  // When the image is loaded, perform the following actions
  imageObj.onload = function () {
    // Create a new canvas element and get its 2D context
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    // Set the canvas dimensions
    canvas.width = imageObj.width;
    canvas.height = imageObj.height;

    // Draw the image onto the canvas
    context.drawImage(imageObj, 0, 0, canvas.width, canvas.height);

    // Get the image data from the bottom half of the canvas
    const imageData = context.getImageData(
      0,
      canvas.height / 2,
      canvas.width,
      canvas.height / 2
    ).data;

    // Calculate the average RGB values of the bottom half of the image
    let totalR = 0,
      totalG = 0,
      totalB = 0;
    for (let i = 0; i < imageData.length; i += 4) {
      totalR += imageData[i];
      totalG += imageData[i + 1];
      totalB += imageData[i + 2];
    }
    const avgR = Math.round(totalR / (imageData.length / 4));
    const avgG = Math.round(totalG / (imageData.length / 4));
    const avgB = Math.round(totalB / (imageData.length / 4));

    // Apply the average color as the background color of the work card
    description.style.background = `rgba(${avgR}, ${avgG}, ${avgB}, 0.8)`;

    // Calculate and set the contrast color for the text
    const luminance = (0.299 * avgR + 0.587 * avgG + 0.114 * avgB) / 255;
    const textColor = luminance > 0.5 ? "#000" : "#fff";
    description.style.color = textColor;
  };
});

// Handle the "See More" — gallery height + post zoom-in
(function initWriteShowMore() {
  const viewMoreBtn = document.getElementById("show-more-button");
  const gallery = document.querySelector("#write .blog-gallery");
  const hiddenPosts = document.querySelectorAll("#write .blog-post.collapsed");
  const label = viewMoreBtn && viewMoreBtn.querySelector(".show-more-label");

  if (!viewMoreBtn || !gallery || !hiddenPosts.length) {
    return;
  }

  const ANIMATION_MS = 600;
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  let expanded = viewMoreBtn.getAttribute("aria-expanded") === "true";
  let animating = false;

  function setExpandedState(isExpanded) {
    expanded = isExpanded;
    viewMoreBtn.setAttribute("aria-expanded", isExpanded ? "true" : "false");
    if (label) {
      label.textContent = isExpanded ? "Show less" : "Show more";
    }
  }

  function animateGalleryHeight(fromHeight, toHeight, onDone) {
    gallery.classList.add("is-animating");
    gallery.style.height = fromHeight + "px";

    let finished = false;

    function finish() {
      if (finished) {
        return;
      }
      finished = true;
      gallery.removeEventListener("transitionend", onTransitionEnd);
      window.clearTimeout(fallbackTimer);
      gallery.classList.remove("is-animating");
      gallery.style.height = "";
      if (onDone) {
        onDone();
      }
    }

    function onTransitionEnd(event) {
      if (event.target !== gallery || event.propertyName !== "height") {
        return;
      }
      finish();
    }

    gallery.addEventListener("transitionend", onTransitionEnd);
    const fallbackTimer = window.setTimeout(finish, ANIMATION_MS + 80);

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        gallery.style.height = toHeight + "px";
      });
    });
  }

  function expand() {
    setExpandedState(true);

    if (reducedMotion) {
      hiddenPosts.forEach(function (post) {
        post.classList.remove("collapsed", "pending-zoom", "zoom-in");
      });
      animating = false;
      return;
    }

    const startHeight = gallery.offsetHeight;

    hiddenPosts.forEach(function (post) {
      post.classList.remove("zoom-in");
      post.classList.add("pending-zoom");
      post.classList.remove("collapsed");
    });

    const endHeight = gallery.scrollHeight;

    animateGalleryHeight(startHeight, endHeight, function () {
      hiddenPosts.forEach(function (post) {
        post.classList.remove("zoom-in");
      });
      animating = false;
    });

    window.requestAnimationFrame(function () {
      hiddenPosts.forEach(function (post) {
        post.classList.remove("pending-zoom");
        void post.offsetWidth;
        post.classList.add("zoom-in");
      });
    });
  }

  function collapse() {
    setExpandedState(false);

    if (reducedMotion) {
      hiddenPosts.forEach(function (post) {
        post.classList.add("collapsed");
        post.classList.remove("pending-zoom", "zoom-in");
      });
      animating = false;
      return;
    }

    const startHeight = gallery.offsetHeight;

    hiddenPosts.forEach(function (post) {
      post.classList.remove("zoom-in", "pending-zoom");
      post.classList.add("collapsed");
    });

    const endHeight = gallery.scrollHeight;

    animateGalleryHeight(startHeight, endHeight, function () {
      animating = false;
    });
  }

  viewMoreBtn.addEventListener("click", function () {
    this.blur();
    if (animating) {
      return;
    }
    animating = true;
    if (expanded) {
      collapse();
    } else {
      expand();
    }
  });
})();

// Hover over blog-post
const blogPostLinks = document.querySelectorAll(".blog-post");

// Add event listener to each blog post link
blogPostLinks.forEach((blogPost) => {
  // Add event listener for hover
  blogPost.addEventListener("mouseenter", () => {
    const chevron = blogPost.querySelector(".chevron");
    chevron.style.display = "block";
  });

  // Add event listener for focus
  blogPost.addEventListener("focus", () => {
    const chevron = blogPost.querySelector(".chevron");
    chevron.style.display = "block";
  });

  // Add event listener for mouseout (to hide chevron when not hovered)
  blogPost.addEventListener("mouseleave", () => {
    const chevron = blogPost.querySelector(".chevron");
    chevron.style.display = "none";
  });

  // Add event listener for blur (to hide chevron when not focused)
  blogPost.addEventListener("blur", () => {
    const chevron = blogPost.querySelector(".chevron");
    chevron.style.display = "none";
  });
});
