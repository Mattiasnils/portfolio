(function () {
  document.addEventListener(
    "click",
    function (event) {
      var link = event.target.closest("a[href]");
      if (!link) {
        return;
      }

      var href = link.getAttribute("href") || "";
      var isLandingLink = link.getAttribute("aria-label") === "Landing page";
      var goesHome =
        isLandingLink ||
        href === "index.html" ||
        href.indexOf("index.html") === 0;

      if (goesHome) {
        sessionStorage.setItem("skip-home-intro", "1");
        return;
      }

      if (href.indexOf("projects/") !== -1 || href.indexOf("blog/") !== -1) {
        sessionStorage.setItem("skip-home-intro", "1");
      }
    },
    true
  );

  var FALLBACK_NAV_HTML =
    '<nav><div class="nav-segments" role="toolbar" aria-label="Site sections">' +
    '<ul role="none">' +
    '<li role="none"><a class="nav-segment" href="index.html" aria-label="Landing page">👋</a></li>' +
    '<li role="none"><a class="nav-segment" href="index.html#work">Work</a></li>' +
    '<li role="none"><a class="nav-segment" href="index.html#play">Play</a></li>' +
    '<li role="none"><a class="nav-segment" href="index.html#write">Write</a></li>' +
    '<li role="none"><a class="nav-segment" href="index.html#about">About</a></li>' +
    "</ul></div></nav>";

  function getPortfolioRoot() {
    var path = location.pathname;
    var marker = "/portfolio/";

    if (path.indexOf(marker) !== -1) {
      return path.slice(0, path.indexOf(marker) + marker.length);
    }

    var nestedMatch = path.match(/^(.*)\/(projects|blog)\//);
    if (nestedMatch) {
      return nestedMatch[1] + "/";
    }

    return "/";
  }

  function getAbsolutePortfolioRoot() {
    var root = getPortfolioRoot();
    if (root.charAt(0) !== "/") {
      root = "/" + root;
    }
    return location.origin + root;
  }

  function dispatchNavMounted(hasMegaNav, usedFallback) {
    document.dispatchEvent(
      new CustomEvent("nav:mounted", {
        detail: {
          hasMegaNav: Boolean(hasMegaNav),
          usedFallback: Boolean(usedFallback),
        },
      })
    );
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = src;
      script.onload = function () {
        resolve();
      };
      script.onerror = function () {
        reject(new Error("Failed to load navigation script: " + src));
      };
      document.head.appendChild(script);
    });
  }

  function injectMegaMenuStyles(root) {
    var file = "mega-menu.css";
    if (!document.querySelector('link[href$="' + file + '"]')) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = root + file;
      document.head.appendChild(link);
    }
  }

  var MEGA_MENU_TRIGGER_HREFS = [
    "index.html#work",
    "index.html#play",
    "index.html#write",
  ];

  function normalizeMegaNavTriggerLabels(mountPoint) {
    MEGA_MENU_TRIGGER_HREFS.forEach(function (href) {
      var segment = mountPoint.querySelector('.nav-segment[href="' + href + '"]');

      if (!segment) {
        return;
      }

      var label = segment.querySelector(".nav-segment-label");

      if (!label) {
        return;
      }

      var labelText = "";

      label.childNodes.forEach(function (node) {
        if (node.nodeType === Node.TEXT_NODE) {
          labelText += node.textContent;
        } else if (
          node.nodeType === Node.ELEMENT_NODE &&
          !node.classList.contains("nav-segment-chevron") &&
          !node.classList.contains("svg-icon-mask")
        ) {
          labelText += node.textContent;
        }
      });

      segment.textContent = labelText.trim() || label.textContent.trim();
    });
  }

  function patchMegaNavLinks(mountPoint) {
    var landingLink = mountPoint.querySelector(
      '.nav-segment[aria-label="Landing page"]'
    );
    if (landingLink && landingLink.getAttribute("href") === "#") {
      landingLink.setAttribute("href", "index.html");
    }

    normalizeMegaNavTriggerLabels(mountPoint);
  }

  function injectFallbackNav(mountPoints) {
    mountPoints.forEach(function (mountPoint) {
      if (!mountPoint.innerHTML.trim()) {
        mountPoint.innerHTML = FALLBACK_NAV_HTML;
      }
    });
  }

  function loadNavHtml(root, mountPoints) {
    if (!mountPoints.length) {
      return Promise.resolve(false);
    }

    var hasMegaNav = Array.prototype.some.call(mountPoints, function (mountPoint) {
      return mountPoint.hasAttribute("data-mega-nav");
    });

    var fetches = [fetch(root + "nav-bar.html")];
    if (hasMegaNav) {
      fetches.push(fetch(root + "mega-menu.html"));
    }

    return Promise.all(fetches)
      .then(function (responses) {
        if (responses.some(function (response) {
          return !response.ok;
        })) {
          throw new Error("Failed to load navigation components");
        }
        return Promise.all(
          responses.map(function (response) {
            return response.text();
          })
        );
      })
      .then(function (htmlParts) {
        var barHtml = htmlParts[0];
        var menuHtml = htmlParts[1] || "";

        mountPoints.forEach(function (mountPoint) {
          if (!mountPoint.innerHTML.trim()) {
            mountPoint.innerHTML =
              barHtml +
              (mountPoint.hasAttribute("data-mega-nav") ? menuHtml : "");
          }

          if (mountPoint.hasAttribute("data-mega-nav")) {
            patchMegaNavLinks(mountPoint);
          }
        });

        return hasMegaNav;
      });
  }

  function loadNavScripts() {
    var root = getAbsolutePortfolioRoot();
    var mountPoints = document.querySelectorAll("[data-nav-mount]");

    if (!mountPoints.length) {
      return;
    }

    loadNavHtml(root, mountPoints)
      .then(function (hasMegaNav) {
        if (hasMegaNav) {
          injectMegaMenuStyles(root);
        }

        var scriptChain;
        if (hasMegaNav) {
          scriptChain = loadScript(root + "mega-nav.js").then(function () {
            return loadScript(root + "nav.js");
          });
        } else {
          scriptChain = loadScript(root + "nav.js");
        }

        return scriptChain.then(function () {
          dispatchNavMounted(hasMegaNav, false);
          if (typeof window.initPortfolioNav === "function") {
            window.initPortfolioNav();
          }
        });
      })
      .catch(function (error) {
        console.error("[nav-boot]", error.message || error);
        var hasMegaNavFallback = Array.prototype.some.call(
          mountPoints,
          function (mountPoint) {
            return mountPoint.hasAttribute("data-mega-nav");
          }
        );

        injectFallbackNav(mountPoints);

        if (hasMegaNavFallback) {
          mountPoints.forEach(function (mountPoint) {
            if (mountPoint.hasAttribute("data-mega-nav")) {
              patchMegaNavLinks(mountPoint);
            }
          });
        }

        loadScript(root + "nav.js")
          .then(function () {
            dispatchNavMounted(false, true);
            if (typeof window.initPortfolioNav === "function") {
              window.initPortfolioNav();
            }
          })
          .catch(function (scriptError) {
            console.error("[nav-boot]", scriptError.message || scriptError);
            dispatchNavMounted(false, true);
          });
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadNavScripts);
  } else {
    loadNavScripts();
  }
})();
