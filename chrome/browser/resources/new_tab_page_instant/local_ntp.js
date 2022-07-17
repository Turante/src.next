// Copyright 2021 Geometry OU (Kiwi Browser)
// Copyright 2015 The Chromium Authors. All rights reserved.

/* Easter egg (ASCII art) */
var __easter_egg =
  "IF8uXyAgICAgXywtJyIiYC0uXyAgICAgICAgICAgICBfXyBfCigsLS5gLl8sJyggICAgICAgfFxgLS98ICAgICAgICAvICAgKCAnID4tCiAgICBgLS4tJyBcICktYCggLCBvIG8pICAgICAgICBcX18vCiAgICAgICAgICBgLSAgICBcYF9gIictICAgICAgICAgTCBcXwo=";
window.setTimeout(function () {
  console.log(window.atob(__easter_egg));
}, 1000);

/**
 * @fileoverview The local InstantExtended NTP.
 */

/**
 * Whether the most visited tiles have finished loading, i.e. we've received the
 * 'loaded' postMessage from the iframe. Used by tests to detect that loading
 * has completed.
 * @type {boolean}
 */
var tilesAreLoaded = false;

var numDdllogResponsesReceived = 0;
var lastDdllogResponse = "";

var onDdllogResponse = null;

/**
 * Controls rendering the new tab page for InstantExtended.
 * @return {Object} A limited interface for testing the local NTP.
 */
function LocalNTP() {
  "use strict";

  /**
   * Alias for document.getElementById.
   * @param {string} id The ID of the element to find.
   * @return {HTMLElement} The found element or null if not found.
   */
  function $(id) {
    // eslint-disable-next-line no-restricted-properties
    return document.getElementById(id);
  }

  /**
   * Specifications for an NTP design (not comprehensive).
   *
   * numTitleLines: Number of lines to display in titles.
   * titleColor: The 4-component color of title text.
   * titleColorAgainstDark: The 4-component color of title text against a dark
   *   theme.
   *
   * @type {{
   *   numTitleLines: number,
   *   titleColor: string,
   *   titleColorAgainstDark: string,
   * }}
   */
  var NTP_DESIGN = {
    numTitleLines: 1,
    titleColor: [50, 50, 50, 255],
    titleColorAgainstDark: [210, 210, 210, 255],
  };

  /**
   * Enum for classnames.
   * @enum {string}
   * @const
   */
  var CLASSES = {
    ALTERNATE_LOGO: "alternate-logo", // Shows white logo if required by theme
    DARK: "dark",
    DEFAULT_THEME: "default-theme",
    DELAYED_HIDE_NOTIFICATION: "mv-notice-delayed-hide",
    FADE: "fade", // Enables opacity transition on logo and doodle.
    FAKEBOX_FOCUS: "fakebox-focused", // Applies focus styles to the fakebox
    // Applies float animations to the Most Visited notification
    FLOAT_UP: "float-up",
    // Applies ripple animation to the element on click
    RIPPLE: "ripple",
    RIPPLE_CONTAINER: "ripple-container",
    RIPPLE_EFFECT: "ripple-effect",
    // Applies drag focus style to the fakebox
    FAKEBOX_DRAG_FOCUS: "fakebox-drag-focused",
    HIDE_FAKEBOX_AND_LOGO: "hide-fakebox-logo",
    HIDE_NOTIFICATION: "mv-notice-hide",
    INITED: "inited", // Reveals the <body> once init() is done.
    LEFT_ALIGN_ATTRIBUTION: "left-align-attribution",
    MATERIAL_DESIGN: "md", // Applies Material Design styles to the page
    MATERIAL_DESIGN_ICONS: "md-icons", // Applies Material Design styles to Most Visited.
    // Vertically centers the most visited section for a non-Google provided
    // page.
    NON_GOOGLE_PAGE: "non-google-page",
    NON_WHITE_BG: "non-white-bg",
    RTL: "rtl", // Right-to-left language text.
    SHOW_LOGO: "show-logo", // Marks logo/doodle that should be shown.
  };

  /**
   * Enum for HTML element ids.
   * @enum {string}
   * @const
   */
  var IDS = {
    ATTRIBUTION: "attribution",
    ATTRIBUTION_TEXT: "attribution-text",
    FAKEBOX: "fakebox",
    FAKEBOX_INPUT: "fakebox-input",
    FAKEBOX_TEXT: "fakebox-text",
    FAKEBOX_MICROPHONE: "fakebox-microphone",
    LOGO: "logo",
    LOGO_DEFAULT: "logo-default",
    LOGO_DOODLE: "logo-doodle",
    LOGO_DOODLE_IMAGE: "logo-doodle-image",
    LOGO_DOODLE_IFRAME: "logo-doodle-iframe",
    LOGO_DOODLE_BUTTON: "logo-doodle-button",
    LOGO_DOODLE_NOTIFIER: "logo-doodle-notifier",
    MOST_VISITED: "most-visited",
    NOTIFICATION: "mv-notice",
    NOTIFICATION_CONTAINER: "mv-notice-container",
    NOTIFICATION_CLOSE_BUTTON: "mv-notice-x",
    NOTIFICATION_MESSAGE: "mv-msg",
    NTP_CONTENTS: "ntp-contents",
    RESTORE_ALL_LINK: "mv-restore",
    TILES: "mv-tiles",
    TILES_IFRAME: "mv-single",
    UNDO_LINK: "mv-undo",
  };

  /**
   * Counterpart of search_provider_logos::LogoType.
   * @enum {string}
   * @const
   */
  var LOGO_TYPE = {
    SIMPLE: "SIMPLE",
    ANIMATED: "ANIMATED",
    INTERACTIVE: "INTERACTIVE",
  };

  /**
   * The different types of events that are logged from the NTP. This enum is
   * used to transfer information from the NTP JavaScript to the renderer and is
   * not used as a UMA enum histogram's logged value.
   * Note: Keep in sync with common/ntp_logging_events.h
   * @enum {number}
   * @const
   */
  var LOG_TYPE = {
    // A static Doodle was shown, coming from cache.
    NTP_STATIC_LOGO_SHOWN_FROM_CACHE: 30,
    // A static Doodle was shown, coming from the network.
    NTP_STATIC_LOGO_SHOWN_FRESH: 31,
    // A call-to-action Doodle image was shown, coming from cache.
    NTP_CTA_LOGO_SHOWN_FROM_CACHE: 32,
    // A call-to-action Doodle image was shown, coming from the network.
    NTP_CTA_LOGO_SHOWN_FRESH: 33,

    // A static Doodle was clicked.
    NTP_STATIC_LOGO_CLICKED: 34,
    // A call-to-action Doodle was clicked.
    NTP_CTA_LOGO_CLICKED: 35,
    // An animated Doodle was clicked.
    NTP_ANIMATED_LOGO_CLICKED: 36,

    // The One Google Bar was shown.
    NTP_ONE_GOOGLE_BAR_SHOWN: 37,
  };

  /**
   * Background colors considered "white". Used to determine if it is possible
   * to display a Google Doodle, or if the notifier should be used instead.
   * @type {Array<string>}
   * @const
   */
  var WHITE_BACKGROUND_COLORS = ["rgba(255,255,255,1)", "rgba(0,0,0,0)"];

  const CUSTOM_BACKGROUND_OVERLAY =
    "linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.2))";

  /**
   * Enum for keycodes.
   * @enum {number}
   * @const
   */
  var KEYCODE = { ENTER: 13, SPACE: 32 };

  /**
   * The period of time (ms) before the Most Visited notification is hidden.
   * @type {number}
   */
  const NOTIFICATION_TIMEOUT = 10000;

  /**
   * The duration of the ripple animation.
   * @type {number}
   */
  const RIPPLE_DURATION_MS = 800;

  /**
   * The max size of the ripple animation.
   * @type {number}
   */
  const RIPPLE_MAX_RADIUS_PX = 300;

  /**
   * The last blacklisted tile rid if any, which by definition should not be
   * filler.
   * @type {?number}
   */
  var lastBlacklistedTile = null;

  /**
   * The timeout id for automatically hiding the Most Visited notification.
   * Invalid ids will silently do nothing.
   * @type {number}
   */
  let delayedHideNotification = -1;

  /**
   * The browser embeddedSearch.newTabPage object.
   * @type {Object}
   */
  var ntpApiHandle;

  /** @type {number} @const */
  var MAX_NUM_TILES_TO_SHOW = 8;

  /**
   * Returns theme background info, first checking for history.state.notheme. If
   * the page has notheme set, returns a fallback light-colored theme.
   */
  function getThemeBackgroundInfo() {
    if (history.state && history.state.notheme) {
      return {
        alternateLogo: false,
        backgroundColorRgba: [255, 255, 255, 255],
        colorRgba: [255, 255, 255, 255],
        headerColorRgba: [150, 150, 150, 255],
        linkColorRgba: [6, 55, 116, 255],
        sectionBorderColorRgba: [150, 150, 150, 255],
        textColorLightRgba: [102, 102, 102, 255],
        textColorRgba: [0, 0, 0, 255],
        usingDefaultTheme: true,
      };
    }
    return ntpApiHandle.themeBackgroundInfo;
  }

  /**
   * Heuristic to determine whether a theme should be considered to be dark, so
   * the colors of various UI elements can be adjusted.
   * @param {ThemeBackgroundInfo|undefined} info Theme background information.
   * @return {boolean} Whether the theme is dark.
   * @private
   */
  function getIsThemeDark() {
    var info = getThemeBackgroundInfo();
    if (!info) return false;
    // Heuristic: light text implies dark theme.
    var rgba = info.textColorRgba;
    var luminance = 0.3 * rgba[0] + 0.59 * rgba[1] + 0.11 * rgba[2];
    return luminance >= 128;
  }

  /**
   * Updates the NTP based on the current theme.
   * @private
   */
  function renderTheme() {
    $(IDS.NTP_CONTENTS).classList.toggle(CLASSES.DARK, getIsThemeDark());

    var info = getThemeBackgroundInfo();
    if (!info) return;

    var background = [
      convertToRGBAColor(info.backgroundColorRgba),
      info.imageUrl,
      info.imageTiling,
      info.imageHorizontalAlignment,
      info.imageVerticalAlignment,
    ]
      .join(" ")
      .trim();

    document.body.style.background = background;
    document.body.classList.toggle(CLASSES.ALTERNATE_LOGO, info.alternateLogo);
    var isNonWhiteBackground = !WHITE_BACKGROUND_COLORS.includes(background);
    document.body.classList.toggle(CLASSES.NON_WHITE_BG, isNonWhiteBackground);
    updateThemeAttribution(info.attributionUrl, info.imageHorizontalAlignment);
    setCustomThemeStyle(info);

    if (info.customBackgroundConfigured) {
      var imageWithOverlay = [CUSTOM_BACKGROUND_OVERLAY, info.imageUrl]
        .join(",")
        .trim();
      document.body.style.setProperty("background-image", imageWithOverlay);
    }
    $(customBackgrounds.IDS.RESTORE_DEFAULT).hidden =
      !info.customBackgroundConfigured;

    if (configData.isGooglePage) {
      $("edit-bg").hidden =
        !configData.isCustomBackgroundsEnabled || !info.usingDefaultTheme;
    }
  }

  /**
   * Sends the current theme info to the most visited iframe.
   * @private
   */
  function sendThemeInfoToMostVisitedIframe() {
    var info = getThemeBackgroundInfo();
    if (!info) return;

    var isThemeDark = getIsThemeDark();

    var message = { cmd: "updateTheme" };
    message.isThemeDark = isThemeDark;

    var titleColor = NTP_DESIGN.titleColor;
    if (!info.usingDefaultTheme && info.textColorRgba) {
      titleColor = info.textColorRgba;
    } else if (isThemeDark) {
      titleColor = NTP_DESIGN.titleColorAgainstDark;
    }
    message.tileTitleColor = convertToRGBAColor(titleColor);

    $(IDS.TILES_IFRAME).contentWindow.postMessage(message, "*");
  }

  /**
   * Updates the OneGoogleBar (if it is loaded) based on the current theme.
   * @private
   */
  function renderOneGoogleBarTheme() {
    if (!window.gbar) {
      return;
    }
    try {
      var oneGoogleBarApi = window.gbar.a;
      var oneGoogleBarPromise = oneGoogleBarApi.bf();
      oneGoogleBarPromise.then(function (oneGoogleBar) {
        var isThemeDark = getIsThemeDark();
        var setForegroundStyle = oneGoogleBar.pc.bind(oneGoogleBar);
        setForegroundStyle(isThemeDark ? 1 : 0);
      });
    } catch (err) {
      console.log("Failed setting OneGoogleBar theme:\n" + err);
    }
  }

  /**
   * Callback for embeddedSearch.newTabPage.onthemechange.
   * @private
   */
  function onThemeChange() {
    renderTheme();
    renderOneGoogleBarTheme();
    sendThemeInfoToMostVisitedIframe();
  }

  /**
   * Updates the NTP style according to theme.
   * @param {Object} themeInfo The information about the theme.
   * @private
   */
  function setCustomThemeStyle(themeInfo) {
    var textColor = null;
    var textColorLight = null;
    var mvxFilter = null;
    if (!themeInfo.usingDefaultTheme) {
      textColor = convertToRGBAColor(themeInfo.textColorRgba);
      textColorLight = convertToRGBAColor(themeInfo.textColorLightRgba);
      mvxFilter = "drop-shadow(0 0 0 " + textColor + ")";
    }

    $(IDS.NTP_CONTENTS).classList.toggle(
      CLASSES.DEFAULT_THEME,
      themeInfo.usingDefaultTheme
    );

    document.body.style.setProperty("--text-color", textColor);
    document.body.style.setProperty("--text-color-light", textColorLight);
    // Themes reuse the "light" text color for links too.
    document.body.style.setProperty("--text-color-link", textColorLight);
    $(IDS.NOTIFICATION_CLOSE_BUTTON).style.setProperty(
      "--theme-filter",
      mvxFilter
    );
  }

  /**
   * Renders the attribution if the URL is present, otherwise hides it.
   * @param {string} url The URL of the attribution image, if any.
   * @param {string} themeBackgroundAlignment The alignment of the theme
   *  background image. This is used to compute the attribution's alignment.
   * @private
   */
  function updateThemeAttribution(url, themeBackgroundAlignment) {
    if (!url) {
      setAttributionVisibility_(false);
      return;
    }

    var attribution = $(IDS.ATTRIBUTION);
    var attributionImage = attribution.querySelector("img");
    if (!attributionImage) {
      attributionImage = new Image();
      attribution.appendChild(attributionImage);
    }
    attributionImage.style.content = url;

    // To avoid conflicts, place the attribution on the left for themes that
    // right align their background images.
    attribution.classList.toggle(
      CLASSES.LEFT_ALIGN_ATTRIBUTION,
      themeBackgroundAlignment == "right"
    );
    setAttributionVisibility_(true);
  }

  /**
   * Sets the visibility of the theme attribution.
   * @param {boolean} show True to show the attribution.
   * @private
   */
  function setAttributionVisibility_(show) {
    $(IDS.ATTRIBUTION).style.display = show ? "" : "none";
  }

  /**
   * Converts an Array of color components into RGBA format "rgba(R,G,B,A)".
   * @param {Array<number>} color Array of rgba color components.
   * @return {string} CSS color in RGBA format.
   * @private
   */
  function convertToRGBAColor(color) {
    return (
      "rgba(" +
      color[0] +
      "," +
      color[1] +
      "," +
      color[2] +
      "," +
      color[3] / 255 +
      ")"
    );
  }

  /**
   * @param {!Element} element The element to register the handler for.
   * @param {number} keycode The keycode of the key to register.
   * @param {!Function} handler The key handler to register.
   */
  function registerKeyHandler(element, keycode, handler) {
    element.addEventListener("keydown", function (event) {
      if (event.keyCode == keycode) handler(event);
    });
  }

  function enableMD() {
    document.body.classList.add(CLASSES.MATERIAL_DESIGN);
    enableMDIcons();
  }

  /**
   * Enables Material Design styles for the Most Visited section.
   */
  function enableMDIcons() {
    $(IDS.MOST_VISITED).classList.add(CLASSES.MATERIAL_DESIGN_ICONS);
    $(IDS.TILES).classList.add(CLASSES.MATERIAL_DESIGN_ICONS);
    addRippleAnimations();
  }

  /**
   * Enables ripple animations for elements with CLASSES.RIPPLE.
   * TODO(kristipark): Remove after migrating to WebUI.
   */
  function addRippleAnimations() {
    let ripple = (event) => {
      let target = event.target;
      const rect = target.getBoundingClientRect();
      const x = Math.round(event.clientX - rect.left);
      const y = Math.round(event.clientY - rect.top);

      // Calculate radius
      const corners = [
        { x: 0, y: 0 },
        { x: rect.width, y: 0 },
        { x: 0, y: rect.height },
        { x: rect.width, y: rect.height },
      ];
      let distance = (x1, y1, x2, y2) => {
        var xDelta = x1 - x2;
        var yDelta = y1 - y2;
        return Math.sqrt(xDelta * xDelta + yDelta * yDelta);
      };
      let cornerDistances = corners.map(function (corner) {
        return Math.round(distance(x, y, corner.x, corner.y));
      });
      const radius = Math.min(
        RIPPLE_MAX_RADIUS_PX,
        Math.max.apply(Math, cornerDistances)
      );

      let ripple = document.createElement("div");
      let rippleContainer = document.createElement("div");
      ripple.classList.add(CLASSES.RIPPLE_EFFECT);
      rippleContainer.classList.add(CLASSES.RIPPLE_CONTAINER);
      rippleContainer.appendChild(ripple);
      target.appendChild(rippleContainer);
      // Ripple start location
      ripple.style.marginLeft = x + "px";
      ripple.style.marginTop = y + "px";

      rippleContainer.style.left = rect.left + "px";
      rippleContainer.style.width = target.offsetWidth + "px";
      rippleContainer.style.height = target.offsetHeight + "px";
      rippleContainer.style.borderRadius =
        window.getComputedStyle(target).borderRadius;

      // Start transition/ripple
      ripple.style.width = radius * 2 + "px";
      ripple.style.height = radius * 2 + "px";
      ripple.style.marginLeft = x - radius + "px";
      ripple.style.marginTop = y - radius + "px";
      ripple.style.backgroundColor = "rgba(0, 0, 0, 0)";

      window.setTimeout(function () {
        ripple.remove();
        rippleContainer.remove();
      }, RIPPLE_DURATION_MS);
    };

    let rippleElements = document.querySelectorAll("." + CLASSES.RIPPLE);
    for (let i = 0; i < rippleElements.length; i++) {
      rippleElements[i].addEventListener("mousedown", ripple);
    }
  }

  /**
   * Prepares the New Tab Page by adding listeners, the most visited pages
   * section, and Google-specific elements for a Google-provided page.
   */
  function init() {}

  /**
   * Injects the One Google Bar into the page. Called asynchronously, so that it
   * doesn't block the main page load.
   */
  function injectOneGoogleBar(ogb) {
    var inHeadStyle = document.createElement("style");
    inHeadStyle.type = "text/css";
    inHeadStyle.appendChild(document.createTextNode(ogb.inHeadStyle));
    document.head.appendChild(inHeadStyle);

    var inHeadScript = document.createElement("script");
    inHeadScript.type = "text/javascript";
    inHeadScript.appendChild(document.createTextNode(ogb.inHeadScript));
    document.head.appendChild(inHeadScript);

    renderOneGoogleBarTheme();

    var ogElem = $("one-google");
    ogElem.innerHTML = ogb.barHtml;
    ogElem.classList.remove("hidden");

    var afterBarScript = document.createElement("script");
    afterBarScript.type = "text/javascript";
    afterBarScript.appendChild(document.createTextNode(ogb.afterBarScript));
    ogElem.parentNode.insertBefore(afterBarScript, ogElem.nextSibling);

    $("one-google-end-of-body").innerHTML = ogb.endOfBodyHtml;

    var endOfBodyScript = document.createElement("script");
    endOfBodyScript.type = "text/javascript";
    endOfBodyScript.appendChild(document.createTextNode(ogb.endOfBodyScript));
    document.body.appendChild(endOfBodyScript);

    ntpApiHandle.logEvent(LOG_TYPE.NTP_ONE_GOOGLE_BAR_SHOWN);
  }

  /**
   * Loads the Doodle. On success, the loaded script declares a global variable
   * ddl, which onload() receives as its single argument. On failure, onload()
   * is called with null as the argument. If v is null, then the call requests a
   * cached logo. If non-null, it must be the ddl.v of a previous request for a
   * cached logo, and the corresponding fresh logo is returned.
   * @param {?number} v
   * @param {function(?{v, usable, image, metadata})} onload
   */
  var loadDoodle = function (v, onload) {
    var ddlScript = document.createElement("script");
    ddlScript.src = "chrome-search://local-ntp/doodle.js";
    if (v !== null) ddlScript.src += "?v=" + v;
    ddlScript.onload = function () {
      onload(ddl);
    };
    ddlScript.onerror = function () {
      onload(null);
    };
    // TODO(treib,sfiera): Add a timeout in case something goes wrong?
    document.body.appendChild(ddlScript);
  };

  /**
   * Handles the response of a doodle impression ping, i.e. stores the
   * appropriate interactionLogUrl or onClickUrlExtraParams.
   *
   * @param {!Object} ddllog Response object from the ddllog ping.
   * @param {!boolean} isAnimated
   */
  var handleDdllogResponse = function (ddllog, isAnimated) {
    if (ddllog && ddllog.interaction_log_url) {
      let interactionLogUrl = new URL(
        ddllog.interaction_log_url,
        configData.googleBaseUrl
      );
      if (isAnimated) {
        targetDoodle.animatedInteractionLogUrl = interactionLogUrl;
      } else {
        targetDoodle.staticInteractionLogUrl = interactionLogUrl;
      }
      lastDdllogResponse = "interaction_log_url " + ddllog.interaction_log_url;
    } else if (ddllog && ddllog.target_url_params) {
      targetDoodle.onClickUrlExtraParams = new URLSearchParams(
        ddllog.target_url_params
      );
      lastDdllogResponse = "target_url_params " + ddllog.target_url_params;
    } else {
      console.log("Invalid or missing ddllog response:");
      console.log(ddllog);
    }
  };

  /**
   * Logs a doodle impression at the given logUrl, and handles the response via
   * handleDdllogResponse.
   *
   * @param {!string} logUrl
   * @param {!boolean} isAnimated
   */
  var logDoodleImpression = function (logUrl, isAnimated) {
    lastDdllogResponse = "";
    fetch(logUrl, { credentials: "omit" })
      .then(function (response) {
        return response.text();
      })
      .then(function (text) {
        // Remove the optional XSS preamble.
        const preamble = ")]}'";
        if (text.startsWith(preamble)) {
          text = text.substr(preamble.length);
        }
        try {
          var json = JSON.parse(text);
        } catch (error) {
          console.log("Failed to parse doodle impression response as JSON:");
          console.log(error);
          return;
        }
        handleDdllogResponse(json.ddllog, isAnimated);
      })
      .catch(function (error) {
        console.log('Error logging doodle impression to "' + logUrl + '":');
        console.log(error);
      })
      .finally(function () {
        ++numDdllogResponsesReceived;
        if (onDdllogResponse !== null) {
          onDdllogResponse();
        }
      });
  };

  /**
   * Returns true if the target doodle is currently visible. If |image| is
   * null, returns true when the default logo is visible; if non-null, checks
   * that it matches the doodle that is currently visible. Here, "visible" means
   * fully-visible or fading in.
   *
   * @returns {boolean}
   */
  var isDoodleCurrentlyVisible = function () {
    var haveDoodle = $(IDS.LOGO_DOODLE).classList.contains(CLASSES.SHOW_LOGO);
    var wantDoodle =
      targetDoodle.image !== null && targetDoodle.metadata !== null;
    if (!haveDoodle || !wantDoodle) {
      return haveDoodle === wantDoodle;
    }

    // Have a visible doodle and a target doodle. Test that they match.
    if (targetDoodle.metadata.type === LOGO_TYPE.INTERACTIVE) {
      var logoDoodleIframe = $(IDS.LOGO_DOODLE_IFRAME);
      return (
        logoDoodleIframe.classList.contains(CLASSES.SHOW_LOGO) &&
        logoDoodleIframe.src === targetDoodle.metadata.fullPageUrl
      );
    } else {
      var logoDoodleImage = $(IDS.LOGO_DOODLE_IMAGE);
      var logoDoodleButton = $(IDS.LOGO_DOODLE_BUTTON);
      return (
        logoDoodleButton.classList.contains(CLASSES.SHOW_LOGO) &&
        (logoDoodleImage.src === targetDoodle.image ||
          logoDoodleImage.src === targetDoodle.metadata.animatedUrl)
      );
    }
  };

  /**
   * The image and metadata that should be shown, according to the latest
   * fetch. After a logo fades out, onDoodleFadeOutComplete fades in a logo
   * according to targetDoodle.
   */
  var targetDoodle = {
    image: null,
    metadata: null,
    // The log URLs and params may be filled with the response from the
    // corresponding impression log URL.
    staticInteractionLogUrl: null,
    animatedInteractionLogUrl: null,
    onClickUrlExtraParams: null,
  };

  var getDoodleTargetUrl = function () {
    let url = new URL(targetDoodle.metadata.onClickUrl);
    if (targetDoodle.onClickUrlExtraParams) {
      for (var param of targetDoodle.onClickUrlExtraParams) {
        url.searchParams.append(param[0], param[1]);
      }
    }
    return url;
  };

  var showLogoOrDoodle = function (fromCache) {
    if (targetDoodle.metadata !== null) {
      applyDoodleMetadata();
      if (targetDoodle.metadata.type === LOGO_TYPE.INTERACTIVE) {
        $(IDS.LOGO_DOODLE_BUTTON).classList.remove(CLASSES.SHOW_LOGO);
        $(IDS.LOGO_DOODLE_IFRAME).classList.add(CLASSES.SHOW_LOGO);
      } else {
        $(IDS.LOGO_DOODLE_IMAGE).src = targetDoodle.image;
        $(IDS.LOGO_DOODLE_BUTTON).classList.add(CLASSES.SHOW_LOGO);
        $(IDS.LOGO_DOODLE_IFRAME).classList.remove(CLASSES.SHOW_LOGO);

        // Log the impression in Chrome metrics.
        var isCta = !!targetDoodle.metadata.animatedUrl;
        var eventType = isCta
          ? fromCache
            ? LOG_TYPE.NTP_CTA_LOGO_SHOWN_FROM_CACHE
            : LOG_TYPE.NTP_CTA_LOGO_SHOWN_FRESH
          : fromCache
          ? LOG_TYPE.NTP_STATIC_LOGO_SHOWN_FROM_CACHE
          : LOG_TYPE.NTP_STATIC_LOGO_SHOWN_FRESH;
        ntpApiHandle.logEvent(eventType);

        // Ping the proper impression logging URL if it exists.
        var logUrl = isCta
          ? targetDoodle.metadata.ctaLogUrl
          : targetDoodle.metadata.logUrl;
        if (logUrl) {
          logDoodleImpression(logUrl, /*isAnimated=*/ false);
        }
      }
      $(IDS.LOGO_DOODLE).classList.add(CLASSES.SHOW_LOGO);
    } else {
      // No doodle. Just show the default logo.
      $(IDS.LOGO_DEFAULT).classList.add(CLASSES.SHOW_LOGO);
    }
  };

  /**
   * Starts fading out the given element, which should be either the default
   * logo or the doodle.
   *
   * @param {HTMLElement} element
   */
  var startFadeOut = function (element) {
    if (!element.classList.contains(CLASSES.SHOW_LOGO)) {
      return;
    }

    // Compute style now, to ensure that the transition from 1 -> 0 is properly
    // recognized. Otherwise, if a 0 -> 1 -> 0 transition is too fast, the
    // element might stay invisible instead of appearing then fading out.
    window.getComputedStyle(element).opacity;

    element.classList.add(CLASSES.FADE);
    element.classList.remove(CLASSES.SHOW_LOGO);
    element.addEventListener("transitionend", onDoodleFadeOutComplete);
  };

  /**
   * Integrates a fresh doodle into the page as appropriate. If the correct logo
   * or doodle is already shown, just updates the metadata. Otherwise, initiates
   * a fade from the currently-shown logo/doodle to the new one.
   */
  var fadeToLogoOrDoodle = function () {
    // If the image is already visible, there's no need to start a fade-out.
    // However, metadata may have changed, so update the doodle's alt text and
    // href, if applicable.
    if (isDoodleCurrentlyVisible()) {
      if (targetDoodle.metadata !== null) {
        applyDoodleMetadata();
      }
      return;
    }

    // It's not the same doodle. Clear any loging URLs/params we might have.
    targetDoodle.staticInteractionLogUrl = null;
    targetDoodle.animatedInteractionLogUrl = null;
    targetDoodle.onClickUrlExtraParams = null;

    // Start fading out the current logo or doodle. onDoodleFadeOutComplete will
    // apply the change when the fade-out finishes.
    startFadeOut($(IDS.LOGO_DEFAULT));
    startFadeOut($(IDS.LOGO_DOODLE));
  };

  var onDoodleFadeOutComplete = function (e) {
    // Fade-out finished. Start fading in the appropriate logo.
    $(IDS.LOGO_DOODLE).classList.add(CLASSES.FADE);
    $(IDS.LOGO_DEFAULT).classList.add(CLASSES.FADE);
    showLogoOrDoodle(/*fromCache=*/ false);

    this.removeEventListener("transitionend", onDoodleFadeOutComplete);
  };

  var applyDoodleMetadata = function () {
    var logoDoodleButton = $(IDS.LOGO_DOODLE_BUTTON);
    var logoDoodleImage = $(IDS.LOGO_DOODLE_IMAGE);
    var logoDoodleIframe = $(IDS.LOGO_DOODLE_IFRAME);

    switch (targetDoodle.metadata.type) {
      case LOGO_TYPE.SIMPLE:
        logoDoodleImage.title = targetDoodle.metadata.altText;

        // On click, navigate to the target URL.
        logoDoodleButton.onclick = function () {
          // Log the click in Chrome metrics.
          ntpApiHandle.logEvent(LOG_TYPE.NTP_STATIC_LOGO_CLICKED);

          // Ping the static interaction_log_url if there is one.
          if (targetDoodle.staticInteractionLogUrl) {
            navigator.sendBeacon(targetDoodle.staticInteractionLogUrl);
            targetDoodle.staticInteractionLogUrl = null;
          }

          window.location = getDoodleTargetUrl();
        };
        break;

      case LOGO_TYPE.ANIMATED:
        logoDoodleImage.title = targetDoodle.metadata.altText;
        // The CTA image is currently shown; on click, show the animated one.
        logoDoodleButton.onclick = function (e) {
          e.preventDefault();

          // Log the click in Chrome metrics.
          ntpApiHandle.logEvent(LOG_TYPE.NTP_CTA_LOGO_CLICKED);

          // Ping the static interaction_log_url if there is one.
          if (targetDoodle.staticInteractionLogUrl) {
            navigator.sendBeacon(targetDoodle.staticInteractionLogUrl);
            targetDoodle.staticInteractionLogUrl = null;
          }

          // Once the animated image loads, ping the impression log URL.
          if (targetDoodle.metadata.logUrl) {
            logoDoodleImage.onload = function () {
              logDoodleImpression(
                targetDoodle.metadata.logUrl,
                /*isAnimated=*/ true
              );
            };
          }
          logoDoodleImage.src = targetDoodle.metadata.animatedUrl;

          // When the animated image is clicked, navigate to the target URL.
          logoDoodleButton.onclick = function () {
            // Log the click in Chrome metrics.
            ntpApiHandle.logEvent(LOG_TYPE.NTP_ANIMATED_LOGO_CLICKED);

            // Ping the animated interaction_log_url if there is one.
            if (targetDoodle.animatedInteractionLogUrl) {
              navigator.sendBeacon(targetDoodle.animatedInteractionLogUrl);
              targetDoodle.animatedInteractionLogUrl = null;
            }

            window.location = getDoodleTargetUrl();
          };
        };
        break;

      case LOGO_TYPE.INTERACTIVE:
        logoDoodleIframe.title = targetDoodle.metadata.altText;
        logoDoodleIframe.src = targetDoodle.metadata.fullPageUrl;
        document.body.style.setProperty(
          "--logo-iframe-width",
          targetDoodle.metadata.iframeWidthPx + "px"
        );
        document.body.style.setProperty(
          "--logo-iframe-height",
          targetDoodle.metadata.iframeHeightPx + "px"
        );
        document.body.style.setProperty(
          "--logo-iframe-initial-height",
          targetDoodle.metadata.iframeHeightPx + "px"
        );
        break;
    }
  };

  return {
    init: init, // Exposed for testing.
    listen: listen,
  };
}

// Gridifier
!(function (a, b) {
  "function" == typeof define && define.amd
    ? define([], b)
    : "object" == typeof exports && exports
    ? (module.exports = b())
    : (a.Gridifier = b());
})(this, function () {
  var a = function (a, b) {
    var c = function (a, b) {
        for (var c in b) a.prototype[c] = b[c];
      },
      d = function (a, b) {
        for (var c in b)
          !(function (a, c) {
            Wa[a] = function () {
              return b[a].apply(c, arguments);
            };
          })(c, a);
      },
      e = function (a) {
        throw new Error(G.ERR + a);
      },
      f = function () {
        return function () {};
      },
      g = function (a, b) {
        return function () {
          return b[a].apply(b, arguments);
        };
      },
      h = f(),
      i = f(),
      j = function () {
        return {
          isScheduled: function () {
            return !1;
          },
        };
      },
      k = f(),
      l = f(),
      m = f(),
      n = f(),
      o = f(),
      p = f(),
      q = (f(), f()),
      r = f(),
      s = f(),
      t = f(),
      u = f(),
      v = f(),
      w = f(),
      x = f(),
      y = f(),
      z = f(),
      A = function () {
        return { getCoordsChanger: f() };
      },
      B = f(),
      C = f(),
      D = f(),
      E = f(),
      F = f(),
      G = {
        DATA: "data-gridifier",
        OWCACHED: "-cached-per-ow",
        OHCACHED: "-cached-per-oh",
        ERR: "Gridifier error: ",
        NOT_NATIVE: "is not jQuery/Native DOM object.",
        IS_ACTIVE: "-toggle-is-active",
      },
      H = {
        SRM: {
          CACHED_PER_OW_ITEM_GUID_DATA: G.DATA + G.OWCACHED + "-guid",
          CACHED_PER_OH_ITEM_GUID_DATA: G.DATA + G.OHCACHED + "-guid",
          CACHED_PER_OW_DATA: G.DATA + G.OWCACHED,
          CACHED_PER_OH_DATA: G.DATA + G.OHCACHED,
          EMPTY_DATA: "e",
        },
        COLL: {
          SORT_INDEX_DATA: G.DATA + "-orig-sort-index",
          NOT_COLLECTABLE_DATA: G.DATA + "-not-collectable",
        },
        ITEM: { IS_CONNECTED_DATA: G.DATA + "-connected" },
        REND: {
          CN_RENDERED_DATA: G.DATA + "-cn-rendered",
          SCH_TO_HIDE_DATA: G.DATA + "-sch-to-hide",
          SILENT_DATA: G.DATA + "-sch-for-silentr",
        },
        DRAGIFIER_REPOS_DELAY: 20,
        DRAGIFIER_DISCR_REPOS_DELAY: 100,
        IS_DRAGGABLE_DATA: G.DATA + "-is-draggable",
        GUID_DATA: G.DATA + "-guid",
        RANGE_SIZE: 500,
        REFLOW_FIX_DELAY: 0,
        UPDATE_Z_DELAY: 100,
        INSERT_QUEUE_DELAY: 100,
        INSERT_BATCH_DELAY: 100,
        RENDER_QUEUE_DELAY: 20,
        RENDER_DEF_DELAY: 40,
        DISC_TYPES: { SOFT: 0, HARD: 1 },
        DISC_BATCH: 12,
        DISC_DELAY: 60,
        RSORT_REPOS_DELAY: 20,
        MAX_Z: "16777271",
      },
      I = {
        IS_ACTIVE: G.DATA + G.IS_ACTIVE,
        IS_ACTIVE_WITH_CC: G.DATA + G.IS_ACTIVE + "-with-cc",
        SYNCER_DATA: G.DATA + "-toggle-syncer-id",
      },
      J = {
        MATRICES: {
          X: "1, 0, 0, ",
          Y: "0, 1, 0, ",
          Z: "0, 0, 1, ",
          XY: "1, 1, 0, ",
          XZ: "1, 0, 1, ",
          YZ: "0, 1, 1, ",
          XYZ: "1, 1, 1, ",
        },
        FNS: { X: "rotateX", Y: "rotateY", Z: "rotateZ" },
        FADES: { NONE: 0, FULL: 1, ON_HIDE_MIDDLE: 2 },
        GUID_DATA: G.DATA + "rotate-guid",
        SCENE_CLASS_PREFIX: "gridifierRotateSceneId",
      },
      K = {
        INITIAL_GUID: -1,
        SHIFTED: 8,
        APPEND: { DEF: 0, REV: 1 },
        PREPEND: { DEF: 2, REV: 3 },
        LEFT: { TOP: 0, BOTTOM: 1 },
        BOTTOM: { RIGHT: 2, LEFT: 3 },
        RIGHT: { TOP: 4, BOTTOM: 5 },
        TOP: { LEFT: 6, RIGHT: 7 },
        CLEANERS: { INSIDE: 0, INSIDE_OR_BEFORE: 1 },
      },
      L = {
        PREPEND: 0,
        REV_PREPEND: 1,
        APPEND: 2,
        REV_APPEND: 3,
        MIR_PREPEND: 4,
        INS_BEFORE: 5,
        INS_AFTER: 6,
        SIL_APPEND: 7,
      },
      M = { SHOW: 0, HIDE: 1, RENDER: 2, DEL_RENDER: 3 },
      N = {
        FILTER: "filter",
        SORT: "sort",
        TOGGLE: "toggle",
        DRAG: "drag",
        RSORT: "rsort",
        COORDSCHANGER: "coordsChanger",
      },
      O = {
        NOT_NATIVE: "one of items " + G.NOT_NATIVE,
        GRID_NOT_NATIVE: "grid " + G.NOT_NATIVE,
        NO_CNS: "no inserted items",
        CANT_FIND_CN: "can't find conn. by item",
        WRONG_IBA_ITEM: "wrong insertBefore/After targetItem",
        TOO_BIG_ITEM: "too wide(ver.grid)/too tall(hor.grid) item",
      },
      P = {
        SHOW: "Show",
        HIDE: "Hide",
        GRID_RESIZE: "GridResize",
        CSS_CHANGE: "CssChange",
        REPOSITION_END: "RepositionEnd",
        REPOSITION: "Reposition",
        DISCONNECT: "Disconnect",
        INSERT: "Insert",
        DRAG_END: "DragEnd",
      },
      Q = {
        REPOSITION_END_FOR_DRAG: "RepositionEndForDrag",
        BEFORE_SHOW_FOR_RSORT: "BeforeShowForRsort",
        SET_SETTING_FOR_NZER: "SetSettingForNzer",
        RSORT_CHANGE: "RsortChange",
      },
      R = function () {
        for (
          var a = function () {
              return function (a) {
                return a;
              };
            },
            b = function () {
              return function (a) {
                return Math.round(a);
              };
            },
            c = function () {
              return function (a, b, c, d) {
                d.css.set(a, {
                  left: Math.round(parseFloat(b)) + "px",
                  top: Math.round(parseFloat(c)) + "px",
                });
              };
            },
            d = [
              ["default", new n()],
              ["position", new o()],
              ["translate", new p(a(), a(), f(), !1)],
              ["translateInt", new p(b(), b(), c(), !1)],
              ["translate3d", new p(a(), a(), f(), !0)],
              ["translate3dInt", new p(b(), b(), c(), !0)],
            ],
            e = 0;
          e < d.length;
          e++
        )
          _a.addApi("coordsChanger", d[e][0], d[e][1]);
      };
    (n = function () {
      return function (a, b, c, d, e, f, g, h, i) {
        var i = i || !1;
        i ||
          (b != a.style.left && f.css.set(a, { left: b }),
          c != a.style.top && f.css.set(a, { top: c }));
      };
    }),
      (o = function () {
        return function (a, b, c, d, e, f, g, h, i) {
          if (!f.hasTransitions())
            return void h("coordsChanger")["default"].apply(this, arguments);
          (b = parseFloat(b) + "px"), (c = parseFloat(c) + "px");
          var i = i || !1;
          return i
            ? void f.css3.transform(a, "scale3d(1,1,1)")
            : (b != a.style.left &&
                (f.css3.transitionProperty(a, "left " + d + "ms " + e),
                f.css.set(a, { left: b })),
              void (
                c != a.style.top &&
                (f.css3.transitionProperty(a, "top " + d + "ms " + e),
                f.css.set(a, { top: c }))
              ));
        };
      }),
      (p = function (a, b, c, d) {
        var e = d ? "translate3d" : "translate",
          f = d ? "(0px,0px,0px)" : "(0px,0px)";
        return function (g, h, i, j, k, l, m, n, o) {
          if (!l.hasTransitions())
            return void n("coordsChanger")["default"].apply(this, arguments);
          var o = o || !1;
          if (o)
            return (
              c(g, h, i, l), void l.css3.transform(g, "scale3d(1,1,1) " + e + f)
            );
          var h = parseFloat(h),
            i = parseFloat(i),
            p = parseFloat(g.style.left),
            q = parseFloat(g.style.top),
            r = function (a, b) {
              return a > b ? a - b : b > a ? -1 * (b - a) : 0;
            },
            s = r(h, p),
            t = r(i, q),
            u = d ? /.*translate3d\((.*)\).*/ : /.*translate\((.*)\).*/,
            v = u.exec(g.style[m.get("transform")]);
          if (null == v || "undefined" == typeof v[1] || null == v[1])
            var w = !0;
          else {
            var x = v[1].split(","),
              y = x[0].gridifierTrim(),
              z = x[1].gridifierTrim();
            if (y == s + "px" && z == t + "px") var w = !1;
            else var w = !0;
          }
          if (w) {
            l.css3.transitionProperty(
              g,
              m.getForCss("transform", g) + " " + j + "ms " + k
            ),
              (s = a(s)),
              (t = b(t)),
              d &&
                (l.css3.perspective(g, "1000"),
                l.css3.backfaceVisibility(g, "hidden"));
            var A = d ? ",0px" : "";
            l.css3.transformProperty(g, e, s + "px," + t + "px" + A);
          }
        };
      }),
      (A = function () {
        this._selectToggler = null;
      }),
      c(A, {
        getCoordsChanger: function () {
          return function (a, b, c, d) {
            var b = parseFloat(b),
              c = parseFloat(c);
            if (!d.hasTransitions())
              return void d.css.set(a, { left: b + "px", top: c + "px" });
            var e = parseFloat(a.style.left),
              f = parseFloat(a.style.top),
              g = function (a, b) {
                return a > b ? a - b : b > a ? -1 * (b - a) : 0;
              },
              h = g(b, e),
              i = g(c, f);
            d.css3.transitionProperty(a, "none"),
              d.css3.perspective(a, "1000"),
              d.css3.backfaceVisibility(a, "hidden"),
              d.css3.transformProperty(
                a,
                "translate3d",
                h + "px," + i + "px,0px"
              );
          };
        },
        getPointerStyler: function () {
          return function (a, b) {
            b.css.addClass(a, "gridifier-drag-pointer"),
              (a.style.backgroundColor = "#efefef");
          };
        },
        getSelectToggler: function () {
          return null != this._selectToggler
            ? this._selectToggler
            : ((this._selectToggler = {
                _target: document.body,
                _props: [
                  "webkitTouchCallout",
                  "webkit",
                  "khtml",
                  "moz",
                  "ms",
                  "userSelect",
                ],
                _origProps: {},
                _hasProp: function (a) {
                  return "undefined" != typeof this._target.style[a];
                },
                disableSelect: function () {
                  for (var a = 0; a < this._props.length; a++) {
                    var b =
                      0 == a || 5 == a
                        ? this._props[a]
                        : this._props[a] + "UserSelect";
                    this._hasProp(b) &&
                      ((this._origProps[b] = this._target.style[b]),
                      (this._target.style[b] = "none"));
                  }
                },
                enableSelect: function () {
                  for (var a in this._origProps)
                    this._target.style[a] = this._origProps[a];
                  this._origProps = {};
                },
              }),
              this._selectToggler);
        },
      });
    var S = function () {
      this._settings = {
        grid: "vertical",
        prepend: "mirrored",
        append: "default",
        intersections: !0,
        align: "top",
        sortDispersion: !1,
        class: "grid-item",
        data: !1,
        query: !1,
        loadImages: !1,
        dragifier: !1,
        dragifierMode: "i",
        gridResize: "fit",
        gridResizeDelay: 100,
        toggleTime: 500,
        toggleTiming: "ease",
        coordsChangeTime: 300,
        coordsChangeTiming: "ease",
        rotatePerspective: "200px",
        rotateBackface: !0,
        rotateAngles: [0, -180, 180, 0],
        widthPtAs: 0,
        widthPxAs: 0,
        heightPtAs: 0,
        heightPxAs: 0,
        repackSize: null,
        filter: {
          selected: "all",
          all: function (a) {
            return !0;
          },
        },
        sort: {
          selected: "default",
          default: function (a, b, c, d) {
            var e = "data-gridifier-orig-sort-index";
            return d["int"](d.get(a, e)) - d["int"](d.get(b, e));
          },
        },
        toggle: { selected: "scale" },
        drag: {
          selected: "cloneCss",
          cloneCss: function (a, b, c) {
            c.copyComputedStyle(b, a);
          },
        },
        rsort: {
          selected: "default",
          default: function (a) {
            return a;
          },
        },
        coordsChanger: { selected: "translate3dInt" },
        insertRange: 3e3,
        vpResizeDelay: null,
        queueSize: 12,
        queueDelay: 25,
        disableQueueOnDrags: !0,
      };
      var a = "undefined" != typeof b ? b : {};
      this._parse(a);
    };
    c(S, {
      _parse: function (a) {
        this._parseCoreSettings(a),
          this._adjustCoreSettings(a),
          this._parseApiSettings(a);
      },
      _parseCoreSettings: function (a) {
        Y.hasAnyProp(a, ["class", "data", "query"]) &&
          this.set([
            ["class", !1],
            ["data", !1],
            ["query", !1],
          ]);
        for (var b in a) {
          var c = a[b],
            d = /^on(.*)$/;
          Y.hasOwnProp(this._settings, b) && !this._isApiSetting(b)
            ? this.set(b, c)
            : d.test(b) && Wa[b](c);
        }
      },
      _adjustCoreSettings: function (a) {
        this.eq("grid", "horizontal") &&
          !Y.hasOwnProp(a, "align") &&
          this.set("align", "left"),
          Y.hasOwnProp(a, "align") && this.set("intersections", !1),
          this.eq("dragifierMode", "d") &&
            (this.set("intersections", !0),
            this.set("sortDispersion", !0),
            Y.hasOwnProp(a, "disableQueueOnDrags") ||
              this.set("disableQueueOnDrags", !1));
      },
      _parseApiSettings: function (a) {
        for (var b in a) {
          var c = a[b];
          this._isApiSetting(b) && this._parseApiSetting(b, c);
        }
      },
      _isApiSetting: function (a) {
        for (var b in N) if (N[b] == a) return !0;
        return !1;
      },
      _parseApiSetting: function (a, b) {
        if (
          "string" == typeof b ||
          b instanceof String ||
          (a == N.FILTER && Y.isArray(b))
        )
          this._settings[a].selected = b;
        else if ("function" == typeof b)
          (this._settings[a].userfn = b),
            (this._settings[a].selected = "userfn");
        else if ("object" == typeof b) {
          for (var c in b)
            if ("selected" != c) {
              var d = b[c];
              this._settings[a][c] = d;
            }
          Y.hasOwnProp(b, "selected") &&
            (this._settings[a].selected = b.selected);
        }
      },
      get: function (a) {
        return this._check(a, "get"), this._settings[a];
      },
      set: function (a, b) {
        if (!Y.isArray(a))
          return (
            this._check(a, "set"),
            (this._settings[a] = b),
            void $a.emitInternal(Q.SET_SETTING_FOR_NZER, a)
          );
        for (var c = 0; c < a.length; c++) this.set(a[c][0], a[c][1]);
      },
      getApi: function (a) {
        this._check(a, "getApi");
        var b = this.get(a),
          c = function (b) {
            e("getApi('" + a + "') -> " + b + " fn not found");
          };
        if (a != N.FILTER)
          return Y.hasOwnProp(b, b.selected) || c(b.selected), b[b.selected];
        var d = b.selected;
        Y.isArray(d) || (d = [d]);
        for (var f = [], g = 0; g < d.length; g++)
          Y.hasOwnProp(b, d[g]) || c(d[g]), f.push(b[d[g]]);
        return f;
      },
      setApi: function (a, b) {
        this._check(a, "setApi"),
          (this.get(a).selected = b),
          a == N.RSORT && $a.emitInternal(Q.RSORT_CHANGE);
      },
      addApi: function (a, b, c) {
        this._check(a, "addApi"), (this.get(a)[b] = c);
      },
      eq: function (a, b) {
        return this._check(a, "eq"), this._settings[a] == b;
      },
      notEq: function (a, b) {
        return !this.eq(a, b);
      },
      _check: function (a, b) {
        Y.hasOwnProp(this._settings, a) || e("No setting '" + a + "' to " + b);
      },
    });
    var T = function () {
      (this._created = !1), (this._repositionTimeout = null);
      var a = this;
      $a.onRsortChange(function () {
        a._update.call(a);
      }),
        this._update();
    };
    c(T, {
      _update: function () {
        var a = this,
          b = _a.get("rsort").selected;
        "default" == b || this._created || ((this._created = !0), new i(_a)),
          a._change(b);
      },
      _change: function (a) {
        var b = this;
        "default" == a
          ? $a.onBeforeShowForRsort(null)
          : $a.onBeforeShowForRsort(function () {
              clearTimeout(b._repositionTimeout),
                (b._repositionTimeout = setTimeout(function () {
                  b._reposition();
                }, H.RESORT_REPOS_DELAY));
            });
      },
      _reposition: function () {
        if (null == _a.get("repackSize")) return void Jb.all();
        var a = _a.get("repackSize"),
          b = Wa.all();
        return b.length < a
          ? void Jb.all()
          : void Jb.fromFirstSortedCn([b[b.length - a]]);
      },
    }),
      (i = function (a) {
        this._createBySizesRsorts(a);
      }),
      c(i, {
        _createBySizesRsorts: function (a) {
          var b = 1e5,
            c = g("addApi", a),
            d = function (a) {
              for (var b = 0; b < a.length; b++) {
                var c = Math.abs(a[b].x2 - a[b].x1) + 1,
                  d = Math.abs(a[b].y2 - a[b].y1) + 1;
                (a[b].area = Math.round(c * d)), (a[b].isLandscape = c >= d);
              }
            },
            e = function (a) {
              for (var b = [], c = 0; c < a.length; c++) {
                for (var d = !0, e = 0; e < b.length; e++)
                  if (b[e].area == a[c].area) {
                    b[e].cns.push(a[c]), (d = !1);
                    break;
                  }
                d && b.push({ area: a[c].area, cns: [a[c]] });
              }
              return b;
            },
            f = function (a) {
              for (
                var b = [
                    { area: "landscape", cns: [] },
                    { area: "portrait", cns: [] },
                  ],
                  c = 0;
                c < a.length;
                c++
              ) {
                var d = a[c].isLandscape ? 0 : 1;
                b[d].cns.push(a[c]);
              }
              return b;
            },
            h = function (a, b, c) {
              var c = c || !1;
              if (c) var d = f(a);
              else {
                var d = e(a);
                d.sort(function (a, b) {
                  return parseFloat(b.area) - parseFloat(a.area);
                });
              }
              for (var g = [], h = !1; !h; ) {
                for (var i = !0, j = 0; j < d.length; j++)
                  if (0 != d[j].cns.length) {
                    if (0 == j)
                      for (var k = 0; b > k; k++)
                        0 != d[j].cns.length && g.push(d[j].cns.shift());
                    else g.push(d[j].cns.shift());
                    i = !1;
                  }
                i && (h = !0);
              }
              return g;
            },
            i = function (a) {
              for (var b = 0, c = 0; c < a.length; c++) a[c].rsortPos = ++b;
            },
            j = function (a, b) {
              for (var c = [], d = [], e = 0; e < a.length; e++)
                d.push(a[e]), (e + 1) % b == 0 && (c.push(d), (d = []));
              return 0 != d.length && c.push(d), c;
            },
            k = function (a, b) {
              a.splice(0, a.length);
              for (var c = 0; c < b.length; c++)
                for (var d = 0; d < b[c].length; d++) a.push(b[c][d]);
              return a;
            },
            l = function (a, b) {
              return function (c) {
                d(c), i(c);
                for (var e = j(c, a), f = 0; f < e.length; f++)
                  e[f] = h(e[f], b);
                return k(c, e);
              };
            };
          c("rsort", "areaEvenly", l(b, 1));
          for (var m = [2, 3, 4, 5], n = [], o = 0; o < m.length; o++)
            n.push(["areaEvenlyAll-" + m[o], b, m[o]]);
          for (var p = [1, 2, 3, 4], o = 5; 50 >= o; o += 5) p.push(o);
          for (var o = 0; o < p.length; o++)
            for (var q = 1; 5 >= q; q++)
              n.push(["areaEvenly" + p[o] + "-" + q, p[o], q]);
          for (var o = 0; o < n.length; o++) {
            var r = n[o];
            c("rsort", r[0], l(r[1], r[2]));
          }
          var s = function (a) {
            var c = a ? -1 : 1;
            return function (a) {
              d(a), i(a);
              for (var e = j(a, b), f = 0; f < e.length; f++)
                e[f].sort(function (a, b) {
                  return a.area > b.area
                    ? -1 * c
                    : a.area < b.area
                    ? 1 * c
                    : a.rsortPos - b.rsortPos;
                });
              return k(a, e);
            };
          };
          c("rsort", "areaDesc", s(!1)),
            c("rsort", "areaAsc", s(!0)),
            c("rsort", "orientationEvenly", function (a) {
              d(a), i(a);
              for (var c = j(a, b), e = 0; e < c.length; e++)
                c[e] = h(c[e], 1, !0);
              return k(a, c);
            });
        },
      }),
      (h = function () {
        var a = this;
        this._applyReplacers = function (a, b) {
          for (var c = 0; c < b.length; c++) a = a.replace(b[c][0], b[c][1]);
          return a;
        };
        var b = {
            byOriginalPos: function (a, b) {
              return (
                Y["int"](Y.get(a, H.COLL.SORT_INDEX_DATA)) -
                Y["int"](Y.get(b, H.COLL.SORT_INDEX_DATA))
              );
            },
            byComparator: function (a, b, c) {
              var d = c ? -1 : 1;
              return a > b ? 1 * d : b > a ? -1 * d : 0;
            },
            byMultipleComparators: function (a, b, c) {
              for (var d = 0; d < c.length; d++) {
                var e = this.byComparator(
                  c[d].forFirst,
                  c[d].forSecond,
                  c[d].reverseOrder
                );
                {
                  if (0 != e) return e;
                  if (d == c.length - 1) return this.byOriginalPos(a, b);
                }
              }
            },
            buildComparators: function (a, b, c, d, f, g) {
              if (
                ("undefined" == typeof d && e("No sort comp param."),
                Y.isArray(d))
              )
                for (var h = [], i = 0; i < d.length; i++) {
                  var g = !1;
                  -1 !== d[i].indexOf("|desc") &&
                    ((g = !0), (d[i] = d[i].replace("|desc", ""))),
                    h.push([d[i], g]);
                }
              else var h = [[d, g]];
              for (var j = [], i = 0; i < h.length; i++)
                j.push({
                  forFirst: c(a, h[i][0], f),
                  forSecond: c(b, h[i][0], f),
                  reverseOrder: h[i][1],
                });
              return j;
            },
            sortBy: function (a, b, c, d, e, f) {
              return this.byMultipleComparators(
                a,
                b,
                this.buildComparators(a, b, c, d, f || !1, e || !1)
              );
            },
          },
          c = {
            Data: function (a, b) {
              return Y.get(a, b);
            },
            Content: function (a) {
              return a.innerHTML;
            },
            Query: function (a, b) {
              return Y.find.byQuery(a, b)[0].innerHTML;
            },
          },
          d = function (a, b, c) {
            return c(b ? this._applyReplacers(a, b) : a);
          },
          f = {
            Def: function (a) {
              return a;
            },
            Int: function (a) {
              return Y["int"](a);
            },
            Float: function (a) {
              return parseFloat(a);
            },
          },
          g = function (b, c) {
            return function (e, f, g) {
              return d.call(a, b(e, f), g, c);
            };
          },
          h = function (a, b) {
            return b
              ? function (b, c, d, e) {
                  return this.sortBy(b, c, a, null, d, e);
                }
              : function (b, c, d, e, f) {
                  return this.sortBy(b, c, a, d, e, f);
                };
          },
          i = {};
        for (var j in c)
          for (var k in f) {
            var l = "by" + j + ("Def" == k ? "" : k);
            (i[l] = g(c[j], f[k])), (b[l] = h(i[l], "Content" == j));
          }
        return (b.comparatorFns = i), b;
      }),
      (w = function (a) {
        (this._settings = a), (this._rotate = new x()), this.create();
      }),
      c(w, {
        create: function () {
          for (
            var a = ["", "WithFade", "WithFadeOut"],
              b = [J.FADES.NONE, J.FADES.FULL, J.FADES.ON_HIDE_MIDDLE],
              c = 0;
            c < a.length;
            c++
          ) {
            for (var d in J.MATRICES) {
              var e = J.MATRICES[d];
              this._create("rotate3d" + d + a[c], "show3d", "hide3d", e, b[c]);
            }
            for (var d in J.FNS) {
              var f = J.FNS[d];
              this._create("rotate" + d + a[c], "show", "hide", f, b[c]);
            }
          }
        },
        _create: function (a, b, c, d, e) {
          var f = this;
          f._settings.addApi("toggle", a, {
            show: function (a, c, g, h, i, j, k, l, m, n) {
              return (
                k.flush(a),
                l.hasTransitions()
                  ? (f._rotate.setFadeType(e),
                    f._rotate.setParams(h, i, j, k, l, m, n),
                    void f._rotate[b](a, d))
                  : (l.show(a), void j.emit(m.EVENT.SHOW, a))
              );
            },
            hide: function (a, b, g, h, i, j, k, l, m, n) {
              return (
                k.flush(a),
                l.hasTransitions()
                  ? (f._rotate.setFadeType(e),
                    f._rotate.setParams(h, i, j, k, l, m, n),
                    void f._rotate[c](a, d))
                  : (l.hide(a), void j.emit(m.EVENT.HIDE, a))
              );
            },
          });
        },
      }),
      (r = function (a) {
        var a = a || !1,
          b = function (a, b) {
            return function (c, d, e, f, g) {
              if (b) {
                var h = g.prefix.getForCss("opacity", c);
                f.css3.transitionProperty(c, h + " " + d + "ms " + e);
              }
              f.css3.opacity(c, a);
            };
          };
        return a
          ? new s(b("0", !1), b("1", !0), b("0", !0), b("1", !1))
          : new s(f(), f(), f(), f());
      }),
      (u = function (a) {
        this._create(a), this._createPairs(a), this._createCustom(a);
      }),
      c(u, {
        _create: function (a) {
          var b = [
              "Left",
              "LeftTop",
              "LeftBottom",
              "Right",
              "RightTop",
              "RightBottom",
              "Top",
              "TopLeft",
              "TopRight",
              "Bottom",
              "BottomLeft",
              "BottomRight",
            ],
            c = [
              [!1, !1, !1],
              [!0, !1, !1],
              [!1, !0, !1],
              [!1, !1, !0],
              [!0, !1, !0],
              [!1, !0, !0],
            ],
            d = function (b, d) {
              for (var e = new v(), f = "toggle", g = 0; 5 >= g; g++) {
                var h = c[g];
                a.addApi(f, "slide" + b[g], e.create(!1, h[0], h[1], h[2], d));
              }
              for (var g = 0; 5 >= g; g++) {
                var h = c[g];
                a.addApi(
                  f,
                  "slide" + b[g + 6],
                  e.create(!0, h[0], h[1], h[2], d)
                );
              }
            };
          d(b, !1);
          for (var e = 0; e < b.length; e++) b[e] += "WithFade";
          d(b, !0);
        },
        _createPairs: function (a) {
          for (
            var b = new v(),
              c = [
                ["LeftThenRight", "Left", "Right"],
                ["TopThenBottom", "Top", "Bottom"],
                ["LeftTopThenRightTop", "LeftTop", "RightTop"],
                ["TopLeftThenBottomLeft", "TopLeft", "BottomLeft"],
                ["LeftBottomThenRightBottom", "LeftBottom", "RightBottom"],
                ["TopRightThenBottomRight", "TopRight", "BottomRight"],
              ],
              d = 0;
            d < c.length;
            d++
          ) {
            var e = "slide",
              f = "WithFade";
            a.addApi(
              "toggle",
              e + c[d][0],
              b.createCycled([
                a.get("toggle")[e + c[d][1]],
                a.get("toggle")[e + c[d][2]],
              ])
            ),
              a.addApi(
                "toggle",
                e + c[d][0] + f,
                b.createCycled([
                  a.get("toggle")[e + c[d][1] + f],
                  a.get("toggle")[e + c[d][2] + f],
                ])
              );
          }
        },
        _createCustom: function (a) {
          for (
            var b = new v(),
              c = "slide",
              d = "WithFade",
              e = [
                ["ClockwiseFromCenters", "Left", "Top", "Right", "Bottom"],
                ["ClockwiseFromSides", "Left", "Top", "Right", "Bottom"],
                [
                  "ClockwiseFromCorners",
                  "LeftTop",
                  "RightTop",
                  "RightBottom",
                  "LeftBottom",
                ],
              ],
              f = 0;
            f < e.length;
            f++
          )
            a.addApi(
              "toggle",
              c + e[f][0],
              b.createCycled([
                a.get("toggle")[c + e[f][1]],
                a.get("toggle")[c + e[f][2]],
                a.get("toggle")[c + e[f][3]],
                a.get("toggle")[c + e[f][4]],
              ])
            ),
              a.addApi(
                "toggle",
                c + e[f][0] + d,
                b.createCycled([
                  a.get("toggle")[c + e[f][1] + d],
                  a.get("toggle")[c + e[f][2] + d],
                  a.get("toggle")[c + e[f][3] + d],
                  a.get("toggle")[c + e[f][4] + d],
                ])
              );
        },
      });
    var U = function () {
      _a.addApi("toggle", "scale", new r()),
        _a.addApi("toggle", "scaleWithFade", new r(!0)),
        _a.addApi("toggle", "fade", new t()),
        _a.addApi("toggle", "visibility", new q());
      new u(_a), new w(_a);
    };
    c(U, {
      hasTranslateTransform: function (a, b) {
        var c = /.*translate\((.*)\).*/,
          d = /.*translate3d\((.*)\).*/;
        return c.test(a.style[b.get("transform", a)]) ||
          d.test(a.style[b.get("transform", a)])
          ? !0
          : !1;
      },
      updateTransformOrigin: function (a, b, c, d, e, f) {
        var g = parseFloat(b),
          h = parseFloat(c),
          i = parseFloat(a.style.left),
          j = parseFloat(a.style.top),
          k = function (a, b) {
            return a > b ? a - b : b > a ? -1 * (b - a) : 0;
          },
          l = k(g, i),
          m = k(h, j);
        f.css3.transformOrigin(a, l + d / 2 + "px " + (m + e / 2) + "px");
      },
      resetTransformOrigin: function (a, b) {
        b.css3.transformOrigin(a, "50% 50%");
      },
    });
    var V = function () {
      (this._syncTimeouts = {}), (this._nextSyncId = 0);
    };
    c(V, {
      markAsSynced: function (a) {
        Y.set(a, I.SYNCER_DATA, ++this._nextSyncId);
      },
      isSynced: function (a) {
        return Y.has(a, I.SYNCER_DATA);
      },
      _getSyncId: function (a) {
        return this.isSynced(a)
          ? Y.get(a, I.SYNCER_DATA)
          : (this.markAsSynced(a), Y.get(a, I.SYNCER_DATA));
      },
      add: function (a, b) {
        var c = this._getSyncId(a);
        Y.hasOwnProp(this._syncTimeouts, c) || (this._syncTimeouts[c] = []),
          this._syncTimeouts[c].push(b);
      },
      flush: function (a) {
        var b = this._getSyncId(a);
        if (Y.hasOwnProp(this._syncTimeouts, b)) {
          for (var c = 0; c < this._syncTimeouts[b].length; c++)
            clearTimeout(this._syncTimeouts[b][c]);
          this._syncTimeouts[b] = [];
        }
      },
    }),
      (t = function () {
        return {
          show: function (a, b, c, d, e, f, g, h, i) {
            return (
              g.flush(a),
              h.hasTransitions()
                ? (h.has(a, i.TOGGLE.IS_ACTIVE) ||
                    (h.css3.transition(a, "none"),
                    h.css3.opacity(a, "0"),
                    h.set(a, i.TOGGLE.IS_ACTIVE, "y")),
                  g.add(
                    a,
                    setTimeout(function () {
                      var b = i.prefix.getForCss("opacity", a);
                      h.show(a),
                        h.css3.transition(a, b + " " + d + "ms " + e),
                        h.css3.opacity(a, 1);
                    }, 40)
                  ),
                  void g.add(
                    a,
                    setTimeout(function () {
                      h.rm(a, i.TOGGLE.IS_ACTIVE), f.emit(i.EVENT.SHOW, a);
                    }, d + 60)
                  ))
                : (h.show(a), void f.emit(i.EVENT.SHOW, a))
            );
          },
          hide: function (a, b, c, d, e, f, g, h, i) {
            if ((g.flush(a), !h.hasTransitions()))
              return h.hide(a), void f.emit(i.EVENT.HIDE, a);
            var j = i.prefix.getForCss("opacity", a);
            h.css3.transition(a, j + " " + d + "ms " + e),
              h.set(a, i.TOGGLE.IS_ACTIVE, "y"),
              h.css3.opacity(a, "0"),
              g.add(
                a,
                setTimeout(function () {
                  h.rm(a, i.TOGGLE.IS_ACTIVE),
                    h.hide(a),
                    h.css3.transition(a, "none"),
                    h.css3.opacity(a, "1"),
                    h.css3.transition(a, ""),
                    f.emit(i.EVENT.HIDE, a);
                }, d + 20)
              );
          },
        };
      }),
      (x = function () {
        (this._fadeType = null), (this._nextRotateGUID = 0);
      }),
      c(x, {
        setParams: function (a, b, c, d, e, f, g) {
          (this._time = a),
            (this._timing = b),
            (this._ev = c),
            (this._sync = d),
            (this._dom = e),
            (this._api = f),
            (this._cn = g);
        },
        setFadeType: function (a) {
          this._fadeType = a;
        },
        show3d: function (a, b) {
          this._rotate(a, "rotate3d", b, !1);
        },
        hide3d: function (a, b) {
          this._rotate(a, "rotate3d", b, !0);
        },
        show: function (a, b) {
          this._rotate(a, b, "", !1);
        },
        hide: function (a, b) {
          this._rotate(a, b, "", !0);
        },
        _rotate: function (a, b, c, d) {
          var e = this._dom,
            f = this._api,
            g = this._ev,
            h = this._cn.x1,
            i = this._cn.y1,
            j = !d;
          if (e.has(a, f.ROTATE.GUID_DATA)) {
            var k = !1,
              l = e.get(a, f.ROTATE.GUID_DATA),
              m = e.find.byClass(f.grid, f.ROTATE.SCENE_CLASS_PREFIX + l)[0],
              n = m.childNodes[0],
              o = n.childNodes[0],
              p = n.childNodes[1],
              q = p.childNodes[0],
              r = f.getS("coordsChangeTime"),
              s = f.getS("coordsChangeTiming");
            f.cc(m, h, i, r, s, e, f.prefix, f.getS);
          } else {
            var k = !0;
            e.set(a, f.ROTATE.GUID_DATA, ++this._nextRotateGUID);
            var m = this._createScene(a, h, i),
              n = this._createFrames(m),
              q = this._createClone(a);
            e.css.addClass(
              m,
              f.ROTATE.SCENE_CLASS_PREFIX + this._nextRotateGUID
            ),
              e.set(a, f.TOGGLE.IS_ACTIVE, "y");
            var o = this._createFrame(!0, n, b, c, j, 2),
              p = this._createFrame(!1, n, b, c, j, 1);
            p.appendChild(q), e.hide(a);
          }
          var t = f.prefix.getForCss("transform", o),
            u = f.prefix.getForCss("transform", p);
          e.css3.transitionProperty(
            o,
            t + " " + this._time + "ms " + this._timing
          ),
            e.css3.transitionProperty(
              p,
              u + " " + this._time + "ms " + this._timing
            ),
            this._sync.add(
              a,
              setTimeout(function () {
                var a = f.getS("rotateAngles"),
                  d = a[j ? 2 : 0],
                  g = a[j ? 3 : 1];
                e.css3.transformProperty(o, b, c + d + "deg"),
                  e.css3.transformProperty(p, b, c + g + "deg");
              }, 40)
            ),
            k ? this._initFade(m, j, a) : this._syncFade(m, j),
            this._sync.add(
              a,
              setTimeout(function () {
                m.parentNode.removeChild(m),
                  e.rm(a, f.TOGGLE.IS_ACTIVE),
                  e.rm(a, f.ROTATE.GUID_DATA),
                  j
                    ? (e.show(a), g.emit(f.EVENT.SHOW, a))
                    : (e.hide(a), g.emit(f.EVENT.HIDE, a));
              }, this._time + 40)
            );
        },
        _createScene: function (a, b, c) {
          var d = this._api,
            e = this._dom,
            f = e.div(),
            g = d.sr.getUncomputedCSS(a);
          e.css.set(f, {
            position: "absolute",
            left: b,
            top: c,
            width: d.srManager.outerWidth(a) + "px",
            height: d.srManager.outerHeight(a) + "px",
          }),
            e.css.set4(f, "margin", g),
            e.css3.perspective(f, d.getS("rotatePerspective")),
            d.grid.appendChild(f);
          var h = d.getS("coordsChangeTime"),
            i = d.getS("coordsChangeTiming");
          return (
            d.cc(f, b, c, h, i, e, d.prefix, d.getS, !0),
            d.cc(f, b, c, h, i, e, d.prefix, d.getS),
            f
          );
        },
        _createFrames: function (a) {
          var b = this._dom,
            c = b.div();
          return (
            b.css.set(c, {
              width: "100%",
              height: "100%",
              position: "absolute",
            }),
            b.css3.transformStyle(c, "preserve-3d"),
            b.css3.perspective(c, this._api.getS("rotatePerspective")),
            a.appendChild(c),
            c
          );
        },
        _createClone: function (a) {
          var b = this._dom,
            c = this._api,
            d = a.cloneNode(!0);
          c.collect.markAsNotCollectable(d);
          var e = c.sr.getUncomputedCSS(a),
            f = b["int"](e.height);
          return (
            b.css.set(d, {
              left: "0px",
              top: "0px",
              visibility: "visible",
              width: c.srManager.outerWidth(a) + "px",
              height: c.srManager.outerHeight(a) + "px",
            }),
            b.css.set4(d, "margin", 0),
            b.css3.transition(d, ""),
            b.css3.transform(d, ""),
            0 == f && b.css.set4(d, "padding", 0),
            d
          );
        },
        _createFrame: function (a, b, c, d, e, f) {
          var g = this._dom,
            h = this._api,
            i = g.div();
          g.css.set(i, {
            display: "xblock",
            position: "absolute",
            width: "100%",
            height: "100%",
            zIndex: f,
          }),
            h.getS("rotateBackface") || g.css3.backfaceVisibility(i, "hidden"),
            b.appendChild(i);
          var j = h.prefix.getForCss("transform", i);
          g.css3.transitionProperty(i, j + " 0ms " + this._timing);
          var k = h.getS("rotateAngles");
          if (a) var l = e ? 0 : 2;
          if (!a) var l = e ? 1 : 3;
          return g.css3.transformProperty(i, c, d + k[l] + "deg"), i;
        },
        _initFade: function (a, b, c) {
          var d = this._dom,
            e = this._api,
            f = this._time,
            g = this._timing,
            h = e.prefix.getForCss("opacity", a),
            i = function () {
              return (
                d.css3.transition(a, "none"),
                d.css3.opacity(a, b ? 0 : 1),
                b ? 1 : 0
              );
            };
          if (this._fadeType != e.ROTATE.FADES.NONE)
            if (this._fadeType == e.ROTATE.FADES.FULL) {
              var j = i();
              this._sync.add(
                c,
                setTimeout(function () {
                  d.css3.transition(a, h + " " + f + "ms " + g),
                    d.css3.opacity(a, j);
                }, 40)
              );
            } else {
              if ((d.css3.transition(a, h + " " + f / 2 + "ms " + g), b))
                return;
              this._sync.add(
                c,
                setTimeout(function () {
                  d.css3.opacity(a, 0);
                }, f / 2)
              );
            }
        },
        _syncFade: function (a, b) {
          this._fadeType != this._api.ROTATE.FADES.NONE &&
            this._dom.css3.opacity(a, b ? 1 : 0);
        },
      }),
      (s = function (a, b, c, d) {
        return {
          show: function (c, d, e, f, g, h, i, j, k, l) {
            if ((i.flush(c), !j.hasTransitions()))
              return j.show(c), void h.emit(k.EVENT.SHOW, c);
            if (k.toggle.hasTranslateTransform(c, k.prefix)) {
              var m = k.srManager;
              k.toggle.updateTransformOrigin(
                c,
                l.x1,
                l.y1,
                m.outerWidth(c, !0),
                m.outerHeight(c, !0),
                j
              );
            }
            j.has(c, k.TOGGLE.IS_ACTIVE) ||
              (j.css3.transition(c, "none"),
              a(c, f, g, j, k),
              j.css3.transformProperty(c, "scale3d", "0,0,0"),
              j.set(c, k.TOGGLE.IS_ACTIVE, "y")),
              i.add(
                c,
                setTimeout(function () {
                  var a = k.prefix.getForCss("transform", c);
                  j.show(c),
                    j.css3.transition(c, a + " " + f + "ms " + g),
                    j.css3.transformProperty(c, "scale3d", "1,1,1"),
                    b(c, f, g, j, k);
                }, 40)
              ),
              i.add(
                c,
                setTimeout(function () {
                  k.toggle.resetTransformOrigin(c, j),
                    j.rm(c, k.TOGGLE.IS_ACTIVE),
                    h.emit(k.EVENT.SHOW, c);
                }, f + 60)
              );
          },
          hide: function (a, b, e, f, g, h, i, j, k, l) {
            if ((i.flush(a), !j.hasTransitions()))
              return j.hide(a), void h.emit(k.EVENT.HIDE, a);
            if (k.toggle.hasTranslateTransform(a, k.prefix)) {
              var m = k.srManager;
              k.toggle.updateTransformOrigin(
                a,
                l.x1,
                l.y1,
                m.outerWidth(a, !0),
                m.outerHeight(a, !0),
                j
              );
            }
            var n = k.prefix.getForCss("transform", a);
            j.css3.transition(a, n + " " + f + "ms " + g),
              j.set(a, k.TOGGLE.IS_ACTIVE, "y"),
              j.css3.transformProperty(a, "scale3d", "0,0,0"),
              c(a, f, g, j, k);
            var o = f > 200 ? f - 100 : f - 50;
            0 > o && (o = 0),
              i.add(
                a,
                setTimeout(function () {
                  j.hide(a);
                }, o)
              ),
              i.add(
                a,
                setTimeout(function () {
                  j.hide(a),
                    j.css3.transition(a, "none"),
                    j.css3.transformProperty(a, "scale3d", "1,1,1"),
                    d(a, f, g, j, k),
                    j.css3.transition(a, ""),
                    k.toggle.resetTransformOrigin(a, j),
                    j.rm(a, k.TOGGLE.IS_ACTIVE),
                    h.emit(k.EVENT.HIDE, a);
                }, f + 20)
              );
          },
        };
      }),
      (v = function () {}),
      c(v, {
        create: function (a, b, c, d, e) {
          var e = e || !1,
            a = a || !1;
          if (a)
            var f = "Height",
              g = "Width",
              h = "left";
          else
            var f = "Width",
              g = "Height",
              h = "top";
          var b = b || !1,
            c = c || !1,
            i = !d,
            j = d,
            k = function (a, b) {
              if (i) return -1 * b.srManager["outer" + f](a, !0);
              if (j) {
                var c = b.srManager["outer" + f](b.grid),
                  d = b.srManager["outer" + f](a, !0);
                return c + d;
              }
            },
            l = function (a, d) {
              if (b) return 0;
              if (c) {
                var e = d.srManager["outer" + g](d.grid),
                  f = d.srManager["outer" + g](a, !0);
                return e + f;
              }
              return a.style[h];
            },
            m = function (b, c) {
              var d = {};
              if (((d.x = k(b, c) + "px"), (d.y = l(b, c) + "px"), a)) {
                var e = d.y;
                (d.y = d.x), (d.x = e);
              }
              return d;
            };
          return {
            show: function (a, b, c, d, f, g, h, i, j, k) {
              if ((h.flush(a), !i.hasTransitions()))
                return i.show(a), void g.emit(j.EVENT.SHOW, a);
              var l = m(a, j);
              h.add(
                a,
                setTimeout(function () {
                  i.set(a, j.TOGGLE.IS_ACTIVE_WITH_CC, "y"),
                    i.has(a, j.TOGGLE.IS_ACTIVE) ||
                      (e &&
                        (i.css3.transition(a, "none"),
                        i.css3.opacity(a, 0),
                        i.css3.transition(a, "")),
                      j.cc(a, l.x, l.y, 0, f, i, j.prefix, j.getS),
                      i.set(a, j.TOGGLE.IS_ACTIVE, "y"));
                }, 0)
              ),
                h.add(
                  a,
                  setTimeout(function () {
                    if ((i.show(a), e)) {
                      var b = j.prefix.getForCss("opacity", a);
                      i.css3.transitionProperty(a, b + " " + d + "ms " + f),
                        i.css3.opacity(a, 1);
                    }
                    j.cc(a, k.x1, k.y1, d, f, i, j.prefix, j.getS);
                  }, 40)
                ),
                h.add(
                  a,
                  setTimeout(function () {
                    i.rm(a, j.TOGGLE.IS_ACTIVE_WITH_CC),
                      i.rm(a, j.TOGGLE.IS_ACTIVE),
                      g.emit(j.EVENT.SHOW, a);
                  }, d + 60)
                );
            },
            hide: function (a, b, c, d, f, g, h, i, j, k) {
              if ((h.flush(a), !i.hasTransitions()))
                return i.hide(a), void g.emit(j.EVENT.HIDE, a);
              var l = m(a, j);
              if (
                (i.set(a, j.TOGGLE.IS_ACTIVE, "y"),
                i.set(a, j.TOGGLE.IS_ACTIVE_WITH_CC, "y"),
                e)
              ) {
                var n = j.prefix.getForCss("opacity", a);
                i.css3.transition(a, n + " " + d + "ms " + f),
                  i.css3.opacity(a, 0);
              }
              j.cc(a, l.x, l.y, d, f, i, j.prefix, j.getS),
                h.add(
                  a,
                  setTimeout(function () {
                    i.hide(a);
                  }, d)
                ),
                h.add(
                  a,
                  setTimeout(function () {
                    if (e) {
                      var b = j.prefix.getForCss("opacity", a);
                      i.css3.transitionProperty(a, b + " 0ms " + f),
                        i.css3.opacity(a, 1);
                    }
                    i.rm(a, j.TOGGLE.IS_ACTIVE_WITH_CC),
                      i.hide(a),
                      i.rm(a, j.TOGGLE.IS_ACTIVE),
                      g.emit(j.EVENT.HIDE, a);
                  }, d + 20)
                );
            },
          };
        },
        createCycled: function (a) {
          var b = 1;
          return {
            show: function () {
              b++;
              var c = b % a.length,
                d = a[c];
              d.show.apply(this, arguments);
            },
            hide: function () {
              b++;
              var c = b % a.length,
                d = a[c];
              d.hide.apply(this, arguments);
            },
          };
        },
      }),
      (q = function () {
        return {
          show: function (a, b, c, d, e, f, g, h, i) {
            g.flush(a), h.show(a), f.emit(i.EVENT.SHOW, a);
          },
          hide: function (a, b, c, d, e, f, g, h, i) {
            g.flush(a), h.hide(a), f.emit(i.EVENT.HIDE, a);
          },
        };
      });
    var W = (function () {
        function a(a) {
          if (((a = a || window.event), a.isFixed)) return a;
          if (
            ((a.isFixed = !0),
            (a.preventDefault =
              a.preventDefault ||
              function () {
                this.returnValue = !1;
              }),
            (a.stopPropagation =
              a.stopPropagation ||
              function () {
                this.cancelBubble = !0;
              }),
            a.target || (a.target = a.srcElement),
            !a.relatedTarget &&
              a.fromElement &&
              (a.relatedTarget =
                a.fromElement == a.target ? a.toElement : a.fromElement),
            null == a.pageX && null != a.clientX)
          ) {
            var b = document.documentElement,
              c = document.body;
            (a.pageX =
              a.clientX +
              ((b && b.scrollLeft) || (c && c.scrollLeft) || 0) -
              (b.clientLeft || 0)),
              (a.pageY =
                a.clientY +
                ((b && b.scrollTop) || (c && c.scrollTop) || 0) -
                (b.clientTop || 0));
          }
          return (
            !a.which &&
              a.button &&
              (a.which =
                1 & a.button ? 1 : 2 & a.button ? 3 : 4 & a.button ? 2 : 0),
            a
          );
        }
        function b(b) {
          b = a(b);
          var d = this[c][b.type];
          for (var e in d) {
            var f = d[e].call(this, b);
            if (
              (f === !1
                ? (b.preventDefault(), b.stopPropagation())
                : void 0 !== f && (b.result = f),
              b.stopNow)
            )
              break;
          }
        }
        var c = "gridifierEvents",
          d = "gridifierHandle",
          e = function () {
            var a = new Date().getTime();
            return "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(
              /[xy]/g,
              function (b) {
                var c = (a + 16 * Math.random()) % 16 | 0;
                return (
                  (a = Math.floor(a / 16)),
                  ("x" == b ? c : (3 & c) | 8).toString(16)
                );
              }
            );
          };
        return {
          add: function (a, f, g) {
            a.setInterval && a != window && !a.frameElement && (a = window),
              g.guid || (g.guid = e()),
              a[c] ||
                ((a[c] = {}),
                (a[d] = function (c) {
                  return "undefined" != typeof W ? b.call(a, c) : void 0;
                })),
              a[c][f] ||
                ((a[c][f] = {}),
                a.addEventListener
                  ? a.addEventListener(f, a[d], !1)
                  : a.attachEvent && a.attachEvent("on" + f, a[d])),
              (a[c][f][g.guid] = g);
          },
          rm: function (a, b, e) {
            var f = a[c] && a[c][b];
            if (f)
              if (e) {
                delete f[e.guid];
                for (var g in f) return;
                a.removeEventListener
                  ? a.removeEventListener(b, a[d], !1)
                  : a.detachEvent && a.detachEvent("on" + b, a[d]),
                  delete a[c][b];
                for (var g in a[c]) return;
                try {
                  delete a[d], delete a[c];
                } catch (h) {
                  a.removeAttribute(d), a.removeAttribute(c);
                }
              } else for (var i in f) delete a[c][b][i];
          },
        };
      })(),
      X = {
        _prefixes: ["Moz", "Webkit", "ms", "Ms", "Khtml", "O"],
        _getter: function (a, b, c) {
          b = b || document.documentElement;
          var d = b.style;
          if ("string" == typeof d[a]) return a;
          for (
            var e = a, a = a.charAt(0).toUpperCase() + a.slice(1), f = 0;
            f < this._prefixes.length;
            f++
          ) {
            var g = this._prefixes[f] + a;
            if ("string" == typeof d[g]) return c(g, e, f);
          }
        },
        get: function (a, b) {
          return this._getter(a, b, function (a) {
            return a;
          });
        },
        getForCss: function (a, b) {
          var c = this;
          return this._getter(a, b, function (a, b, d) {
            return "-" + c._prefixes[d].toLowerCase() + "-" + b;
          });
        },
      },
      Y = {
        init: function () {
          this._createTrimFunction(),
            this._createHasOwnPropFn(),
            this._checkIfHasTransitions(Y.div()),
            this.browsers.init(),
            this.css3.init();
        },
        _createTrimFunction: function () {
          "function" != typeof String.prototype.gridifierTrim &&
            (String.prototype.gridifierTrim = function () {
              return this.replace(/^\s+|\s+$/g, "");
            });
        },
        _createHasOwnPropFn: function () {
          var a = Y.div(),
            b = document.body || document.documentElement;
          b.appendChild(a),
            Object.prototype.hasOwnProperty.call(a, "innerHTML")
              ? (this._hasOwnPropFn = function (a, b) {
                  return Object.prototype.hasOwnProperty.call(a, b);
                })
              : (this._hasOwnPropFn = function (a, b) {
                  for (var c in a) if (c == b) return !0;
                  return !1;
                }),
            b.removeChild(a);
        },
        _checkIfHasTransitions: function (a) {
          var b = [
            "WebkitTransition",
            "MozTransition",
            "OTransition",
            "msTransition",
            "MsTransition",
            "transition",
          ];
          this._hasTransitions = !1;
          for (var c = 0; c < b.length; c++)
            void 0 !== a.style[b[c]] && (this._hasTransitions = !0);
        },
        get: function (a, b) {
          return a.getAttribute(b);
        },
        set: function (a, b, c) {
          if (this.isArray(b))
            for (var d = 0; d < b.length; d++) a.setAttribute(b[d][0], b[d][1]);
          else a.setAttribute(b, c);
        },
        rm: function (a, b) {
          a.removeAttribute(b);
        },
        rmIfHas: function (a, b) {
          if (this.isArray(b))
            for (var c in b) this.has(a, b[c]) && this.rm(a, b[c]);
          else this.has(a, b) && this.rm(a, b);
        },
        has: function (a, b) {
          return null === a.getAttribute(b) || "" === a.getAttribute(b)
            ? !1
            : !0;
        },
        int: function (a) {
          return parseInt(a, 10);
        },
        isJquery: function (a) {
          return "undefined" == typeof jQuery ? !1 : a && a instanceof jQuery;
        },
        isNative: function (a) {
          return "undefined" != typeof a &&
            "undefined" != typeof a.tagName &&
            "undefined" != typeof a.nodeName &&
            "undefined" != typeof a.ownerDocument &&
            "undefined" != typeof a.removeAttribute
            ? !0
            : !1;
        },
        isArray: function (a) {
          return "[object Array]" == Object.prototype.toString.call(a);
        },
        isObj: function (a) {
          return "object" == typeof a && null !== a;
        },
        isChildOf: function (a, b) {
          if (a == b) return !1;
          for (var c = a.parentNode; void 0 != c; ) {
            if (c == b) return !0;
            if (c == document.body) break;
            c = c.parentNode;
          }
          return !1;
        },
        hasTransitions: function () {
          return this._hasTransitions;
        },
        hasVal: function (a, b) {
          for (var c in a) if (a[c] == b) return !0;
          return !1;
        },
        hasOwnProp: function (a, b) {
          return this._hasOwnPropFn(a, b);
        },
        hasAnyProp: function (a, b) {
          for (var c = 0; c < b.length; c++)
            if (this._hasOwnPropFn(a, b[c])) return !0;
          return !1;
        },
        toFixed: function (a, b) {
          return parseFloat(
            +(Math.round(+(a.toString() + "e" + b)).toString() + "e" + -b)
          );
        },
        areRoundedOrFlooredEq: function (a, b) {
          return (
            Math.round(a) == Math.round(b) || Math.floor(a) == Math.floor(b)
          );
        },
        areRoundedOrCeiledEq: function (a, b) {
          return Math.round(a) == Math.round(b) || Math.ceil(a) == Math.ceil(b);
        },
        filter: function (a, b, c) {
          for (var c = c || window, d = [], e = 0; e < a.length; e++)
            b.call(c, a[e]) && d.push(a[e]);
          return d;
        },
        show: function (a) {
          a.style.visibility = "visible";
        },
        hide: function (a) {
          a.style.visibility = "hidden";
        },
        div: function () {
          return document.createElement("div");
        },
        browsers: {
          _navigator: null,
          init: function () {
            this._navigator =
              "undefined" != typeof navigator ? navigator.userAgent : "";
          },
          isAndroid: function () {
            return /android/i.test(this._navigator);
          },
          isAndroidFirefox: function () {
            return this.isAndroid()
              ? /firefox|iceweasel/i.test(this._navigator)
              : !1;
          },
          isAndroidUC: function () {
            return this.isAndroid() ? /UCBrowser/i.test(this._navigator) : !1;
          },
        },
        css: {
          set: function (a, b) {
            Y.isNative(a) || e("Error: not DOM.");
            for (var c in b) a.style[c] = b[c];
          },
          set4: function (a, b, c) {
            for (
              var d = ["Left", "Right", "Top", "Bottom"], e = 0;
              e < d.length;
              e++
            )
              a.style[b + d[e]] = Y.isObj(c) ? c[b + d[e]] : c;
          },
          hasClass: function (a, b) {
            var c = a.getAttribute("class");
            if (null == c || 0 == c.length) return !1;
            c = c.split(" ");
            for (var d = 0; d < c.length; d++)
              if (((c[d] = c[d].gridifierTrim()), c[d] == b)) return !0;
            return !1;
          },
          addClass: function (a, b) {
            var c = a.getAttribute("class");
            if (null == c || 0 == c.length) var d = b;
            else var d = c + " " + b;
            Y.set(a, "class", d);
          },
          removeClass: function (a, b) {
            for (
              var c = a.getAttribute("class").split(" "), d = "", e = 0;
              e < c.length;
              e++
            )
              c[e].gridifierTrim() != b && (d += c[e] + " ");
            (d = d.substring(0, d.length - 1)), Y.set(a, "class", d);
          },
        },
        css3: {
          _opacityProps: ["opacity"],
          _perspectiveProps: ["perspective"],
          _transformStyleProps: ["transformStyle"],
          _backfaceVisibilityProps: ["backfaceVisibility"],
          _transformOriginProps: ["transformOrigin"],
          init: function () {
            for (
              var a = [
                  ["Webkit", "Moz"],
                  ["webkit", "moz", "o", "ms"],
                ],
                b = 0;
              b < a[0].length;
              b++
            ) {
              var c = a[0][b];
              this._opacityProps.push(c + "Opacity"),
                this._perspectiveProps.push(c + "Perspective"),
                this._transformStyleProps.push(c + "TransformStyle"),
                this._backfaceVisibilityProps.push(c + "BackfaceVisibility");
            }
            for (var b = 0; b < a[1].length; b++)
              this._transformOriginProps.push(a[1][b] + "TransformOrigin");
          },
          transition: function (a, b) {
            a.style[X.get("transition", a)] = b;
          },
          transitionProperty: function (a, b) {
            var c = a.style[X.get("transition", a)];
            if (0 == c.length)
              return void (a.style[X.get("transition", a)] = b);
            var d = function (a) {
                return a.replace(/cubic-bezier\([^\)]+/g, function (a) {
                  return a.replace(/,/g, ";");
                });
              },
              e = function (a) {
                return a.replace(/cubic-bezier\([^\)]+/g, function (a) {
                  return a.replace(/;/g, ",");
                });
              },
              f = d(b);
            c = d(c);
            for (var g = c.split(","), h = 0; h < g.length; h++) {
              var i = g[h].gridifierTrim();
              if (0 != i.length) {
                var j = i.split(" "),
                  k = j[0];
                -1 === f.search(k) && (f += ", " + i);
              }
            }
            a.style[X.get("transition", a)] = e(f).gridifierTrim();
          },
          transform: function (a, b) {
            a.style[X.get("transform", a)] = b;
          },
          transformProperty: function (a, b, c) {
            var d = a.style[X.get("transform", a)];
            if (0 == d.length)
              return void (a.style[X.get("transform", a)] = b + "(" + c + ")");
            for (
              var e = "", f = d.split(/\)/), g = !1, h = 0;
              h < f.length;
              h++
            ) {
              var i = f[h].gridifierTrim();
              0 != i.length &&
                (-1 !== i.search(b)
                  ? ((e += " " + b + "(" + c + ")"), (g = !0))
                  : (e += " " + i + ")"));
            }
            g || (e += " " + b + "(" + c + ")"),
              (a.style[X.get("transform", a)] = e.gridifierTrim());
          },
          style: function (a, b, c) {
            for (var d = 0; d < b.length; d++) a.style[b[d]] = c;
          },
          opacity: function (a, b) {
            this.style(a, this._opacityProps, b);
          },
          perspective: function (a, b) {
            this.style(a, this._perspectiveProps, b);
          },
          transformStyle: function (a, b) {
            this.style(a, this._transformStyleProps, b);
          },
          backfaceVisibility: function (a, b) {
            this.style(a, this._backfaceVisibilityProps, b);
          },
          transformOrigin: function (a, b) {
            for (var c = 0; c < this._transformOriginProps.length; c++)
              "undefined" != typeof a.style[this._transformOriginProps[c]] &&
                (a.style[this._transformOriginProps[c]] = b);
          },
        },
        find: {
          byId: function (a) {
            return document.getElementById(a);
          },
          byClass: function (a, b) {
            return a.querySelectorAll("." + b);
          },
          byQuery: function (a, b) {
            var c = b.gridifierTrim()[0];
            if (">" == c) {
              for (
                var d = b.substr(2, b.length - 1),
                  e = a.querySelectorAll(d),
                  f = [],
                  g = 0;
                g < e.length;
                g++
              )
                e[g].parentNode == a && f.push(e[g]);
              return f;
            }
            return a.querySelectorAll(b);
          },
        },
        remove: {
          byQuery: function (a, b) {
            for (var c = Y.find.byQuery(a, b), d = 0; d < c.length; d++) {
              var e = c[d];
              e.parentNode.removeChild(e);
            }
          },
        },
      },
      Z = {
        getComputedCSS: null,
        _getProps: {
          forOw: [
            "paddingLeft",
            "paddingRight",
            "marginLeft",
            "marginRight",
            "borderLeftWidth",
            "borderRightWidth",
          ],
          forOh: [
            "paddingTop",
            "paddingBottom",
            "marginTop",
            "marginBottom",
            "borderTopWidth",
            "borderBottomWidth",
          ],
          forPosLeft: ["marginLeft"],
          forPosTop: ["marginTop"],
        },
        _prefixedProps: { boxSizing: null },
        _borderBoxType: null,
        _borderBoxTypes: { OUTER: 0, INNER: 1 },
        _ptValsCalcType: null,
        _ptValsCalcTypes: { BROWSER: 0, RECALC: 1 },
        recalcPtWidthFn: function (a, b, c, d) {
          return this.outerWidth(a, b, c, d);
        },
        recalcPtHeightFn: function (a, b, c, d) {
          return this.outerHeight(a, b, c, d);
        },
        _lastRawWidth: null,
        _lastRawHeight: null,
        _lastBorderWidth: null,
        _lastBorderHeight: null,
        _hasLastBorderBox: !1,
        init: function () {
          (this.getComputedCSS = this._getComputedCSSFn()),
            this._findPrefixedProps(),
            this._findBorderBoxType(Y.div()),
            this._findPtValsCalcType(Y.div(), Y.div());
        },
        clearRecursiveSubcallsData: function () {
          (this._lastRawWidth = null),
            (this._lastRawHeight = null),
            (this._lastBorderWidth = null),
            (this._lastBorderHeight = null),
            (this._hasLastBorderBox = !1);
        },
        _areBrowserPtVals: function () {
          return this._ptValsCalcType == this._ptValsCalcTypes.BROWSER;
        },
        _areRecalcPtVals: function () {
          return this._ptValsCalcType == this._ptValsCalcTypes.RECALC;
        },
        getUncomputedCSS: function (a) {
          var b = a.parentNode.cloneNode(),
            c = a.cloneNode();
          b.appendChild(c), (b.style.display = "none");
          var d =
            "HTML" == a.parentNode.nodeName
              ? a.parentNode
              : a.parentNode.parentNode;
          d.appendChild(b);
          for (
            var e = this.getComputedCSS(c),
              f = {},
              g = [
                "paddingLeft",
                "paddingRight",
                "paddingTop",
                "paddingBottom",
                "marginLeft",
                "marginRight",
                "marginTop",
                "marginBottom",
                "width",
                "height",
              ],
              h = 0;
            h < g.length;
            h++
          )
            f[g[h]] = e[g[h]];
          return d.removeChild(b), f;
        },
        _ensureHasParentNode: function (a) {
          (null != a.parentNode && Y.hasOwnProp(a.parentNode, "innerHTML")) ||
            e("no parentNode");
        },
        _ensureHasComputedProp: function (a, b) {
          b in a || e("no prop " + b);
        },
        _hasPtCSSVal: function (a, b, c) {
          var d = function (a, b, c) {
            this._ensureHasParentNode(b),
              (c = c || this.getUncomputedCSS(b)),
              this._ensureHasComputedProp(c, a);
            var d = new RegExp("(.*\\d)%$");
            return d.test(c[a]);
          };
          if (Y.isArray(a)) {
            for (var e = 0; e < a.length; e++)
              if (d.call(this, a[e], b, c)) return !0;
            return !1;
          }
          return d.call(this, a, b, c);
        },
        _getPtCSSVal: function (a, b, c) {
          return (
            this._ensureHasParentNode(b),
            (c = c || this.getUncomputedCSS(b)),
            this._ensureHasComputedProp(c, a),
            c[a]
          );
        },
        _recalcPtVal: function (a, b, c, d) {
          var e = parseFloat(this._getPtCSSVal(d, a, c));
          return (b / 100) * e;
        },
        _recalcTwoSidePropPtVals: function (a, b, c, d, e, f) {
          var g = e + (f ? "Top" : "Left"),
            h = e + (f ? "Bottom" : "Right"),
            i = c[g],
            j = c[h];
          return (
            this._hasPtCSSVal(g, a, d) && (i = this._recalcPtVal(a, b, d, g)),
            this._hasPtCSSVal(h, a, d) && (j = this._recalcPtVal(a, b, d, h)),
            i + j
          );
        },
        _isDefBoxSizing: function (a) {
          var b = this._prefixedProps.boxSizing;
          return b && a[b] && "border-box" === a[b] ? !0 : !1;
        },
        _isOuterBoxSizing: function () {
          return this._borderBoxType === this._borderBoxTypes.OUTER;
        },
        _isCascadedCSSVal: function (a) {
          return window.getComputedStyle || -1 !== a.indexOf("px") ? !1 : !0;
        },
        _cascadedToComputed: function (a, b, c) {
          var d = new RegExp("(?=.*\\d)");
          if (!d.test(b)) return b;
          var e = a.style,
            f = a.runtimeStyle,
            g = e.left,
            h = f && f.left;
          return (
            h && (f.left = c.left),
            (e.left = b),
            (b = e.pixelLeft),
            (e.left = g),
            h && (f.left = h),
            b
          );
        },
        _normalizeComputedCSS: function (a) {
          var b = parseFloat(a),
            c = -1 === a.indexOf("%") && !isNaN(b);
          return c ? b : !1;
        },
        _getComputedProps: function (a, b, c) {
          for (var d = {}, e = 0; e < this._getProps[a].length; e++) {
            var f = this._getProps[a][e],
              g = b[f];
            this._isCascadedCSSVal(g) &&
              (g = this._cascadedToComputed(c, g, b)),
              (g = parseFloat(g)),
              (g = isNaN(g) ? 0 : g),
              (d[f] = g);
          }
          return d;
        },
        positionLeft: function (a) {
          var b = this.getComputedCSS(a);
          if ("none" == b.display) return 0;
          var c = this._getComputedProps("forPosLeft", b, a);
          return a.offsetLeft - c.marginLeft;
        },
        positionTop: function (a) {
          var b = this.getComputedCSS(a);
          if ("none" == b.display) return 0;
          var c = this._getComputedProps("forPosTop", b, a);
          return a.offsetTop - c.marginTop;
        },
        offsetLeft: function (a) {
          var b = a.getBoundingClientRect(),
            c = window.pageXOffset || document.documentElement.scrollLeft;
          return b.left + c;
        },
        offsetTop: function (a) {
          var b = a.getBoundingClientRect(),
            c = window.pageYOffset || document.documentElement.scrollTop;
          return b.top + c;
        },
        cloneComputedStyle: function (a, b) {
          var c = function (a) {
              return a.replace(/-+(.)?/g, function (a, b) {
                return b ? b.toUpperCase() : "";
              });
            },
            d = this.getComputedCSS(a);
          for (var e in d)
            if ("cssText" != e) {
              var f = c(e);
              b.style[f] != d[f] && (b.style[f] = d[f]);
            }
          this._reclone(d, b);
        },
        _reclone: function (a, b) {
          for (
            var c = ["font", "fontSize", "fontWeight", "lineHeight"],
              d = ["Width", "Color", "Style"],
              e = ["Left", "Right", "Top", "Bottom"],
              f = 0;
            f < d.length;
            f++
          )
            for (var g = 0; g < e.length; g++) c.push("border" + e[g] + d[f]);
          for (var f = 0; f < c.length; f++) {
            var h = c[f];
            "undefined" != typeof a[h] &&
              b.style[h] != a[h] &&
              (b.style[h] = a[h]);
          }
        },
      };
    (Z._getComputedCSSFn = function () {
      return window.getComputedStyle
        ? function (a) {
            return window.getComputedStyle(a, null);
          }
        : function (a) {
            return a.currentStyle;
          };
    }),
      (Z._findPrefixedProps = function () {
        this._prefixedProps.boxSizing = X.get("boxSizing");
      }),
      (Z._findBorderBoxType = function (a) {
        Y.css.set(a, {
          width: "100px",
          padding: "10px 20px",
          borderWidth: "10px 20px",
          borderStyle: "solid",
        });
        var b = this._prefixedProps.boxSizing;
        a.style[b] = "border-box";
        var c = document.body || document.documentElement;
        c.appendChild(a);
        var d = this.getComputedCSS(a);
        100 === this._normalizeComputedCSS(d.width)
          ? (this._borderBoxType = this._borderBoxTypes.OUTER)
          : (this._borderBoxType = this._borderBoxTypes.INNER),
          c.removeChild(a);
      }),
      (Z._findPtValsCalcType = function (a, b, c) {
        Y.css.set(a, {
          width: "1178px",
          height: "300px",
          position: "absolute",
          left: "-9000px",
          top: "0px",
          visibility: "hidden",
        });
        var d = document.body || document.documentElement;
        d.appendChild(a),
          Y.css.set(b, { width: "10%", height: "200px" }),
          a.appendChild(b);
        var e = (117.796875).toFixed(1),
          f = parseFloat(this.outerWidth(b, !0, !0)).toFixed(1);
        (this._ptValsCalcType =
          e == f
            ? this._ptValsCalcTypes.BROWSER
            : this._ptValsCalcTypes.RECALC),
          d.removeChild(a);
      }),
      (Z.outerWidth = function (a, b, c, d) {
        var b = b || !1,
          c = c || !1,
          d = d || !1,
          e = this.getComputedCSS(a);
        if (c || this._areBrowserPtVals()) var f = !1;
        else if (this._areRecalcPtVals()) {
          this._ensureHasParentNode(a);
          var f = this._hasPtCSSVal("width", a);
        }
        if ("none" === e.display) return 0;
        var g = this._getComputedProps("forOw", e, a),
          h = g.paddingLeft + g.paddingRight,
          i = g.marginLeft + g.marginRight,
          j = g.borderLeftWidth + g.borderRightWidth,
          k = 0,
          l = this._normalizeComputedCSS(e.width);
        l !== !1 && (k = l);
        var m = null,
          n = null;
        return (
          f &&
            ((m = this.getUncomputedCSS(a)),
            (n = this.recalcPtWidthFn.call(
              this,
              a.parentNode,
              !1,
              "HTML" == a.parentNode.nodeName,
              !0
            )),
            this._hasLastBorderBox &&
              this._hasPtCSSVal("width", a, m) &&
              (n -= this._lastBorderWidth)),
          f &&
            this._hasPtCSSVal(["paddingLeft", "paddingRight"], a, m) &&
            (h = this._recalcTwoSidePropPtVals(a, n, g, m, "padding")),
          f &&
            this._hasPtCSSVal("width", a, m) &&
            (k = this._recalcPtVal(a, n, m, "width")),
          !this._isDefBoxSizing(e) ||
          (this._isDefBoxSizing(e) && !this._isOuterBoxSizing())
            ? ((this._lastRawWidth = k),
              (k += h),
              d || (k += j),
              (this._hasLastBorderBox = !1))
            : ((this._hasLastBorderBox = !0),
              (this._lastRawWidth = k),
              (this._lastBorderWidth = j)),
          b &&
            (f &&
              this._hasPtCSSVal(["marginLeft", "marginRight"], a, m) &&
              (i = this._recalcTwoSidePropPtVals(a, n, g, m, "margin")),
            (k += i)),
          k
        );
      }),
      (Z.outerHeight = function (a, b, c, d) {
        var b = b || !1,
          c = c || !1,
          d = d || !1,
          e = this.getComputedCSS(a);
        if (c || this._areBrowserPtVals()) var f = !1;
        else if (this._areRecalcPtVals()) {
          this._ensureHasParentNode(a);
          var f = this._hasPtCSSVal("height", a);
        }
        if ("none" === e.display) return 0;
        var g = this._getComputedProps("forOh", e, a),
          h = g.paddingTop + g.paddingBottom,
          i = g.marginTop + g.marginBottom,
          j = g.borderTopWidth + g.borderBottomWidth,
          k = 0,
          l = this._normalizeComputedCSS(e.height);
        l !== !1 && (k = l);
        var m = null,
          n = null,
          o = null;
        return (
          f &&
            ((m = this.getUncomputedCSS(a)),
            (n = this.recalcPtWidthFn.call(
              this,
              a.parentNode,
              !1,
              "HTML" == a.parentNode.nodeName,
              !0
            )),
            this._hasLastBorderBox && (n -= this._lastBorderWidth),
            (o = this.recalcPtHeightFn.call(
              this,
              a.parentNode,
              !1,
              "HTML" == a.parentNode.nodeName,
              !0
            )),
            this._hasLastBorderBox &&
              this._hasPtCSSVal("height", a, m) &&
              (o -= this._lastBorderHeight)),
          f &&
            this._hasPtCSSVal(["paddingTop", "paddingBottom"], a, m) &&
            (h = this._recalcTwoSidePropPtVals(a, n, g, m, "padding", !0)),
          f &&
            this._hasPtCSSVal("height", a, m) &&
            (k = this._recalcPtVal(a, o, m, "height")),
          !this._isDefBoxSizing(e) ||
          (this._isDefBoxSizing(e) && !this._isOuterBoxSizing())
            ? ((this._lastRawHeight = k),
              (k += h),
              d || (k += j),
              (this._hasLastBorderBox = !1))
            : ((this._hasLastBorderBox = !0),
              (this._lastRawHeight = k),
              (this._lastBorderHeight = j)),
          b &&
            (f &&
              this._hasPtCSSVal(["marginTop", "marginBottom"], a, m) &&
              (i = this._recalcTwoSidePropPtVals(a, n, g, m, "margin", !0)),
            (k += i)),
          k
        );
      });
    var $ = function () {};
    c($, {
      find: function (a, b) {
        var b = b || !1,
          c = rb.get();
        b || 0 != c.length || e(O.NO_CNS);
        for (var d = db.get(a), f = null, g = 0; g < c.length; g++)
          if (d == c[g].itemGUID) {
            f = c[g];
            break;
          }
        if (null == f && !Kb.isEmpty())
          for (var h = Kb.getQueued(), g = 0; g < h.length; g++)
            if (d == h[g].cn.itemGUID) {
              f = h[g].cn;
              break;
            }
        return b || null != f || e(O.CANT_FIND_CN), f;
      },
      create: function (a, b) {
        for (var c = ["x1", "x2", "y1", "y2"], d = 0; d < c.length; d++) {
          var e = c[d],
            f = b[e];
          (b[e] = Y.toFixed(b[e], 2)), isNaN(b[e]) && (b[e] = f);
        }
        return (
          (b.item = a),
          (b.itemGUID = db.get(a)),
          (b.hOffset = Y.hasOwnProp(b, "hOffset") ? b.hOffset : 0),
          (b.vOffset = Y.hasOwnProp(b, "vOffset") ? b.vOffset : 0),
          (b.restrictCollect = Y.hasOwnProp(b, "restrictCollect")
            ? b.restrictCollect
            : !1),
          Ya.isConnected(a) || Ya.markAsConnected(a),
          b
        );
      },
      rm: function (a, b) {
        for (var c = 0; c < a.length; c++)
          if (db.get(b.item) == db.get(a[c].item)) return void a.splice(c, 1);
      },
      _remapGUIDS: function (a) {
        for (var b = 0; b < a.length; b++)
          a[b].itemGUID = db.markForAppend(a[b].item);
      },
      remapAllGUIDS: function () {
        db.reinit(), this._remapGUIDS(vb.sortForReappend(rb.get()));
      },
      remapGUIDSIn: function (a) {
        this._remapGUIDS(a);
      },
      getByGUIDS: function (a) {
        for (var b = rb.get(), c = [], d = 0; d < b.length; d++)
          for (var e = 0; e < a.length; e++)
            if (b[d].itemGUID == a[e]) {
              c.push(b[d]);
              break;
            }
        return c;
      },
      syncParams: function (a) {
        for (
          var b = rb.get(),
            c = [
              "x1",
              "x2",
              "y1",
              "y2",
              "hOffset",
              "vOffset",
              "restrictCollect",
            ],
            d = 0;
          d < a.length;
          d++
        )
          for (var e = 0; e < b.length; e++)
            if (a[d].itemGUID == b[e].itemGUID) {
              for (var f = 0; f < c.length; f++) b[e][c[f]] = a[d][c[f]];
              break;
            }
      },
      _getMinSize: function (a, b, c, d) {
        var e = rb.get();
        if (0 == e.length) return 0;
        for (
          var f = function (f) {
              return e[f][a] >= e[f][b] || e[f][a] < 0 || e[f][b] > c
                ? Xa["outer" + d](e[f].item, !0)
                : e[f][b] - e[f][a] + 1;
            },
            g = f(0),
            h = 1;
          h < e.length;
          h++
        ) {
          var i = f(h);
          g > i && (g = i);
        }
        return g;
      },
      getMinWidth: function () {
        return this._getMinSize("x1", "x2", Za.x2(), "Width");
      },
      getMinHeight: function () {
        return this._getMinSize("y1", "y2", Za.y2(), "Height");
      },
      _compareGUIDS: function (a, b, c) {
        for (var d = db.get(b), e = 0; e < a.length; e++)
          if (c(db.get(a[e].item), d)) return !0;
        return !1;
      },
      isAnyGUIDSmallerThan: function (a, b) {
        return this._compareGUIDS(a, b, function (a, b) {
          return b > a;
        });
      },
      isAnyGUIDBiggerThan: function (a, b) {
        return this._compareGUIDS(a, b, function (a, b) {
          return a > b;
        });
      },
      getMaxY: function () {
        for (var a = rb.get(), b = 0, c = 0; c < a.length; c++)
          a[c].y2 > b && (b = a[c].y2);
        return b;
      },
      restoreOnSortDispersion: function (a, b, c) {
        var d = vb.sortForReappend(rb.get()),
          e = d[d.length - 1],
          f = function (a, b, c) {
            (a.x1 = b), (a.x2 = b), (a.y1 = c), (a.y2 = c);
          };
        _a.eq("append", "default") ? b(a, e, f) : c(a, e, f);
      },
      getAllBACoord: function (a, b) {
        for (var c = rb.get(), d = [], e = 0; e < c.length; e++)
          _a.eq("sortDispersion", !1) && b(c[e], a) && d.push(c[e]);
        return d;
      },
      fixAllXYPosAfterPrepend: function (a, b, c, d, e) {
        if (a[d] >= 0) return !1;
        var f = Math.round(Math.abs(a[d]));
        (a[e] = Math.abs(a[d] - a[e])), (a[d] = 0);
        for (var g = rb.get(), h = 0; h < g.length; h++)
          a.itemGUID != g[h].itemGUID && ((g[h][d] += f), (g[h][e] += f));
        for (var h = 0; h < b.length; h++) b[h][c] += f;
        return ub.incAllBy(f, d, e), ub.createPrepended(a[d], a[e], d, e), !0;
      },
    });
    var _ = function () {};
    c(_, {
      isIntersectingAny: function (a, b) {
        for (var c = 0; c < a.length; c++) {
          var d = a[c],
            e = b.y1 < d.y1 && b.y2 < d.y1,
            f = b.y1 > d.y2 && b.y2 > d.y2,
            g = b.x1 < d.x1 && b.x2 < d.x1,
            h = b.x1 > d.x2 && b.x2 > d.x2;
          if (!(e || f || g || h)) return !0;
        }
        return !1;
      },
      getAllWithIntersectedCenter: function (a) {
        for (var b = rb.get(), c = [], d = 0; d < b.length; d++) {
          var e = b[d].x2 - b[d].x1 + 1,
            f = b[d].y2 - b[d].y1 + 1,
            g = b[d].x1 + e / 2,
            h = b[d].y1 + f / 2,
            i = { x1: g, x2: g, y1: h, y2: h };
          this.isIntersectingAny([i], a) && c.push(b[d]);
        }
        return c;
      },
      _findAllMaybeIntCns: function (a, b) {
        for (var c = rb.get(), d = [], e = 0; e < c.length; e++)
          b(a, c[e]) || d.push(c[e]);
        return d;
      },
      findAllMaybeIntOnVgAppend: function (a) {
        return this._findAllMaybeIntCns(a, function (a, b) {
          return a.y > b.y2;
        });
      },
      findAllMaybeIntOnVgPrepend: function (a) {
        return this._findAllMaybeIntCns(a, function (a, b) {
          return a.y < b.y1;
        });
      },
      findAllMaybeIntOnHgAppend: function (a) {
        return this._findAllMaybeIntCns(a, function (a, b) {
          return a.x > b.x2;
        });
      },
      findAllMaybeIntOnHgPrepend: function (a) {
        return this._findAllMaybeIntCns(a, function (a, b) {
          return a.x < b.x1;
        });
      },
    });
    var aa = function () {
      (this._ranges = null),
        _a.eq("grid", "vertical")
          ? this.init("y1", "y2")
          : this.init("x1", "x2");
    };
    c(aa, {
      init: function (a, b) {
        var c = { cnIndexes: [] };
        (c[a] = -1),
          (c[b] = H.RANGE_SIZE - 1),
          (this._ranges = [c]),
          this._attachAllCns(a, b);
      },
      incAllBy: function (a, b, c) {
        for (var d = 0; d < this._ranges.length; d++)
          (this._ranges[d][b] += a), (this._ranges[d][c] += a);
      },
      createPrepended: function (a, b, c, d) {
        var e = { cnIndexes: [] };
        (e[c] = -1), (e[d] = b), this._ranges.unshift(e);
      },
      _createNext: function (a, b) {
        var c = this._ranges[this._ranges.length - 1][b] + 1,
          d = { cnIndexes: [] };
        (d[a] = c), (d[b] = c + H.RANGE_SIZE - 1), this._ranges.push(d);
      },
      attachCn: function (a, b, c, d) {
        for (; a[d] + 1 > this._ranges[this._ranges.length - 1][d]; )
          this._createNext(c, d);
        for (var f = !1, g = 0; g < this._ranges.length; g++) {
          var h = a[d] < this._ranges[g][c],
            i = a[c] > this._ranges[g][d];
          h || i || (this._ranges[g].cnIndexes.push(b), (f = !0));
        }
        f || e("Range for cn NF");
      },
      _attachAllCns: function (a, b) {
        for (var c = rb.get(), d = 0; d < c.length; d++)
          this.attachCn(c[d], d, a, b);
      },
      mapAllIntAndSideCns: function (a, b, c, d, e, f, g, h) {
        for (var i = this._ranges, j = e(i), k = [], l = 0; l < a.length; l++) {
          for (var m = !1, n = j != e(i); !m; ) {
            if (j > f(i) || 0 > j) {
              j = e(i);
              break;
            }
            a[l][b] >= i[j][c] && a[l][b] <= i[j][d]
              ? (m = !0)
              : ((j = h(j)), (n = !1));
          }
          n || (k = g(j, i)), (a[l].cnIndexes = k);
        }
        return a;
      },
      firstRngIndexFn: function () {
        return function (a) {
          return 0;
        };
      },
      lastRngIndexFn: function () {
        return function (a) {
          return a.length - 1;
        };
      },
      lowerCrCnIndexesFn: function () {
        return function (a, b) {
          for (var c = [], d = a; d >= 0; d--) c.push(b[d].cnIndexes);
          return c;
        };
      },
      upperCrCnIndexesFn: function () {
        return function (a, b) {
          for (var c = [], d = a; d < b.length; d++) c.push(b[d].cnIndexes);
          return c;
        };
      },
      incFn: function () {
        return function (a) {
          return ++a;
        };
      },
      decFn: function () {
        return function (a) {
          return --a;
        };
      },
      getAllCnsFromIntRange: function (a, b, c) {
        for (var d = this._ranges, e = 0; e < d.length; e++)
          if (a >= d[e][b] && a <= d[e][c]) return d[e].cnIndexes;
        for (
          var f = function (a, b) {
              for (var c = 0; c < a.length; c++) if (a[c] == b) return !0;
              return !1;
            },
            g = [],
            e = 0;
          e < d.length;
          e++
        )
          for (var h = 0; h < d[e].cnIndexes.length; h++)
            f(g, d[e].cnIndexes[h]) || g.push(d[e].cnIndexes[h]);
        return g;
      },
      getAllCnsFromIntAndTLSideRgs: function (a, b, c) {
        for (
          var d = this._ranges, e = [], f = null, g = d.length - 1;
          g >= 0;
          g--
        )
          if (a >= d[g][b] && a <= d[g][c]) {
            f = g;
            break;
          }
        null == f && (f = d.length - 1);
        for (var g = f; g >= 0; g--) e.push(d[g].cnIndexes);
        return e;
      },
      getAllCnsFromIntAndRBSideRgs: function (a, b, c) {
        for (var d = this._ranges, e = [], f = null, g = 0; g < d.length; g++)
          if (a >= d[g][b] && a <= d[g][c]) {
            f = g;
            break;
          }
        null == f && (f = 0);
        for (var g = f; g < d.length; g++) e.push(d[g].cnIndexes);
        return e;
      },
    });
    var ba = function () {};
    c(ba, {
      _sortForReappend: function (a, b, c, d) {
        if (_a.eq("sortDispersion", !1))
          a.sort(function (a, b) {
            return db.get(a.item) > db.get(b.item) ? 1 : -1;
          });
        else {
          _a.eq("append", "default")
            ? a.sort(function (a, d) {
                return Y.areRoundedOrFlooredEq(a[b], d[b])
                  ? a[c] < d[c]
                    ? -1
                    : 1
                  : a[b] < d[b]
                  ? -1
                  : 1;
              })
            : a.sort(function (a, c) {
                return Y.areRoundedOrFlooredEq(a[b], c[b])
                  ? a[d] > c[d]
                    ? -1
                    : 1
                  : a[b] < c[b]
                  ? -1
                  : 1;
              });
          var e = _a.getApi("rsort");
          a = e(a);
        }
        return a;
      },
      sortForReappend: function (a) {
        return _a.eq("grid", "vertical")
          ? this._sortForReappend(a, "y1", "x1", "x2")
          : this._sortForReappend(a, "x1", "y2", "y1");
      },
    });
    var ca = function () {
      this._lastXYExpandedCns = [];
    };
    c(ca, {
      _isBefore: function (a, b, c, d) {
        return a[c] < b[c] && a[d] < b[c];
      },
      _isAfter: function (a, b, c, d) {
        return a[c] > b[d] && a[d] > b[d];
      },
      getLastXYExpandedCns: function () {
        return this._lastXYExpandedCns;
      },
      isIntMoreThanOneCnXY: function (a, b, c) {
        for (
          var d = this,
            e = rb.get(),
            f = [],
            g = function (a) {
              if (0 == f.length) return !1;
              for (var g = 0; g < f.length; g++) {
                var h = e[f[g]],
                  i = h[b],
                  j = h[c];
                (h[b] = Math.ceil(h[b])), (h[c] = Math.floor(h[c]));
                var k = d._isBefore(a, h, b, c),
                  l = d._isAfter(a, h, b, c);
                if (((h[b] = i), (h[c] = j), !k && !l)) return !0;
              }
              return !1;
            },
            h = 0,
            i = 0;
          i < e.length;
          i++
        )
          d._isBefore(a, e[i], b, c) ||
            d._isAfter(a, e[i], b, c) ||
            g(e[i]) ||
            (f.push(i), h++);
        return h > 1;
      },
      getMostBigFromAllXYIntCns: function (a, b, c) {
        for (var d = rb.get(), e = null, f = 0; f < d.length; f++)
          if (!this._isBefore(a, d[f], b, c) && !this._isAfter(a, d[f], b, c))
            if (null == e) e = d[f];
            else {
              var g = Math.abs(d[f][c] - d[f][b]),
                h = Math.abs(e[c] - e[b]);
              g > h && (e = d[f]);
            }
        return e;
      },
      getAllXYIntCns: function (a, b, c) {
        for (var d = rb.get(), e = [], f = 0; f < d.length; f++)
          this._isBefore(a, d[f], b, c) ||
            this._isAfter(a, d[f], b, c) ||
            e.push(d[f]);
        return e;
      },
      expandXYAllCnsToMostBig: function (a, b, c, d, e) {
        var f = g("eq", _a),
          h = this.getMostBigFromAllXYIntCns(a, b, c);
        if (null != h) {
          for (
            var i = this.getAllXYIntCns(a, b, c), j = [], k = 0;
            k < i.length;
            k++
          )
            if (
              ((i[k][b] = h[b]),
              (i[k][c] = h[c]),
              f("align", "left") || f("align", "top"))
            )
              0 != i[k][d] && j.push(i[k]), (i[k][d] = 0);
            else {
              var l = Xa["outer" + e](i[k].item, !0);
              if (f("align", "center"))
                var m = Math.abs(i[k][c] - i[k][b] + 1) / 2 - l / 2;
              else var m = Math.abs(i[k][c] - i[k][b] + 1) - l;
              i[k][d] != m && ((i[k][d] = m), j.push(i[k]));
            }
          this._lastXYExpandedCns = j;
        }
      },
    });
    var da = function () {
      (this._crs = []), (this._nextFlushCb = null);
    };
    c(da, {
      eq: function (a, b) {
        return a.side == b;
      },
      isInitial: function (a) {
        return a.itemGUID == K.INITIAL_GUID;
      },
      create: function (a, b, c, d, e) {
        this._crs.push({
          type: a,
          side: b,
          x: Y.toFixed(c, 2),
          y: Y.toFixed(d, 2),
          itemGUID: "undefined" == typeof e ? K.INITIAL_GUID : e,
        });
      },
      count: function () {
        return this._crs.length;
      },
      get: function () {
        return this._crs;
      },
      set: function (a) {
        this._crs = a;
      },
      setNextFlushCb: function (a) {
        this._nextFlushCb = a;
      },
      flush: function () {
        (this._crs = []),
          "function" == typeof this._nextFlushCb &&
            (this._nextFlushCb(), (this._nextFlushCb = null));
      },
      getClone: function () {
        for (
          var a = [], b = ["type", "side", "x", "y", "itemGUID"], c = 0;
          c < this._crs.length;
          c++
        ) {
          for (var d = {}, e = 0; e < b.length; e++)
            d[b[e]] = this._crs[c][b[e]];
          (d.crIndex = c), a.push(d);
        }
        return a;
      },
    });
    var ea = function () {
      this._cleaner = null;
    };
    c(ea, {
      _updateCleaner: function () {
        var a = K.CLEANERS;
        this._cleaner = _a.eq("sortDispersion", !1)
          ? a.INSIDE_OR_BEFORE
          : a.INSIDE;
      },
      _isInsideCleaner: function () {
        return this._updateCleaner(), this._cleaner == K.CLEANERS.INSIDE;
      },
      _isMappedCrIntAnySideCn: function (a, b, c, d, e) {
        for (var f = rb.get(), g = 0; g < a.cnIndexes.length; g++)
          for (var h = 0; h < a.cnIndexes[g].length; h++) {
            var i = f[a.cnIndexes[g][h]];
            if (
              (mb.roundCnPerCr(i, a),
              a[b] >= i[c] && a[b] <= i[d] && e.call(this, a, i))
            )
              return mb.unroundCnPerCr(i, a), !0;
            mb.unroundCnPerCr(i, a);
          }
        return !1;
      },
      _isMappedCrIntAnyTopCn: function (a) {
        return this._isMappedCrIntAnySideCn(
          a,
          "x",
          "x1",
          "x2",
          function (a, b) {
            return this._isInsideCleaner()
              ? a.y >= b.y1 && a.y <= b.y2
              : a.y >= b.y1;
          }
        );
      },
      _isMappedCrIntAnyBottomCn: function (a) {
        return this._isMappedCrIntAnySideCn(
          a,
          "x",
          "x1",
          "x2",
          function (a, b) {
            return this._isInsideCleaner()
              ? a.y <= b.y2 && a.y >= b.y1
              : a.y <= b.y2;
          }
        );
      },
      _isMappedCrIntAnyLeftCn: function (a) {
        return this._isMappedCrIntAnySideCn(
          a,
          "y",
          "y1",
          "y2",
          function (a, b) {
            return this._isInsideCleaner()
              ? a.x >= b.x1 && a.x <= b.x2
              : a.x >= b.x1;
          }
        );
      },
      _isMappedCrIntAnyRightCn: function (a) {
        return this._isMappedCrIntAnySideCn(
          a,
          "y",
          "y1",
          "y2",
          function (a, b) {
            return this._isInsideCleaner()
              ? a.x <= b.x2 && a.x >= b.x1
              : a.x <= b.x2;
          }
        );
      },
      _rmIntFrom: function (a, b, c) {
        var d = ib.get(),
          e = ib.getClone();
        e.sort(function (a, d) {
          return a[b] == d[b] ? 0 : c(a[b], d[b]) ? -1 : 1;
        }),
          (e = rb["mapAllIntAnd" + a + "Cns"](e));
        for (var f = 0; f < e.length; f++) {
          var g = "_isMappedCrIntAny" + a + "Cn";
          d[e[f].crIndex].isInt = this[g](e[f]);
        }
        for (var f = 0; f < d.length; f++) d[f].isInt && (d.splice(f, 1), f--);
      },
      rmIntFromTop: function () {
        this._rmIntFrom("Top", "y", function (a, b) {
          return a.y > b.y;
        });
      },
      rmIntFromBottom: function () {
        this._rmIntFrom("Bottom", "y", function (a, b) {
          return a.y < b.y;
        });
      },
      rmIntFromLeft: function () {
        this._rmIntFrom("Left", "x", function (a, b) {
          return a.x > b.x;
        });
      },
      rmIntFromRight: function () {
        this._rmIntFrom("Right", "x", function (a, b) {
          return a.x < b.x;
        });
      },
      _rmAllTooFar: function (a, b) {
        var c = ib.get();
        if (0 != c.length) {
          for (var d = c[0], e = 1; e < c.length; e++) a(c[e], d) && (d = c[e]);
          for (var e = 0; e < c.length; e++)
            b(c[e], d, Y["int"](_a.get("insertRange"))) &&
              (c.splice(e, 1), e--);
        }
      },
      _crSmCr: function (a) {
        return function (b, c) {
          return b[a] < c[a];
        };
      },
      _crBgCr: function (a) {
        return function (b, c) {
          return b[a] > c[a];
        };
      },
      _crSmValidC: function (a, b) {
        return function (c, d, e) {
          return c[a] < d[a] + e * b;
        };
      },
      _crBgValidC: function (a, b) {
        return function (c, d, e) {
          return c[a] > d[a] + e * b;
        };
      },
      rmAllTooBottomFromMostTop: function () {
        this._rmAllTooFar(this._crSmCr("y"), this._crBgValidC("y", 1));
      },
      rmAllTooTopFromMostBottom: function () {
        this._rmAllTooFar(this._crBgCr("y"), this._crSmValidC("y", -1));
      },
      rmAllTooRightFromMostLeft: function () {
        this._rmAllTooFar(this._crSmCr("x"), this._crBgValidC("x", 1));
      },
      rmAllTooLeftFromMostRight: function () {
        this._rmAllTooFar(this._crBgCr("x"), this._crSmValidC("x", -1));
      },
    });
    var fa = function () {};
    c(fa, {
      _mostYClose: function (a, b, c, d, e, f) {
        for (
          var g = rb.get(),
            h = null,
            i = _a.eq("grid", "vertical") ? e(a) : f(a),
            j = 0;
          j < i.length;
          j++
        )
          for (var k = 0; k < i[j].length; k++) {
            var l = g[i[j][k]];
            ((a.x >= l.x1 && a.x <= l.x2) || b(a, l)) &&
              c(a, l) &&
              (null == h ? (h = l) : d(l, h) && (h = l));
          }
        return h;
      },
      _crXBgCnX2: function (a, b) {
        return a.x > b.x2;
      },
      _crXSmCnX1: function (a, b) {
        return a.x < b.x1;
      },
      _crYBgCnY2: function (a, b) {
        return a.y > b.y2;
      },
      _crYSmCnY1: function (a, b) {
        return a.y < b.y1;
      },
      _cnX1BgCnX2: function (a, b) {
        return a.x1 > b.x2;
      },
      _cnX1SmCnX1: function (a, b) {
        return a.x1 < b.x1;
      },
      _cnY2BgCnY2: function (a, b) {
        return a.y2 > b.y2;
      },
      _cnY1SmCnY1: function (a, b) {
        return a.y1 < b.y1;
      },
      _intXCns: function (a) {
        return rb.getAllIntXCns(a);
      },
      _intXAndUpperCns: function (a) {
        return rb.getAllIntXAndTopCns(a);
      },
      _intXAndLowerCns: function (a) {
        return rb.getAllIntXAndBottomCns(a);
      },
      _intYAndLeftCns: function (a) {
        return rb.getAllIntYAndLeftCns(a);
      },
      _intYAndRightCns: function (a) {
        return rb.getAllIntYAndRightCns(a);
      },
      mostBottomFromTopOrTopLeft: function (a) {
        var b = this;
        return this._mostYClose(
          a,
          b._crXBgCnX2,
          b._crYBgCnY2,
          b._cnY2BgCnY2,
          b._intXAndUpperCns,
          b._intYAndLeftCns
        );
      },
      mostBottomFromTopOrTopRight: function (a) {
        var b = this;
        return this._mostYClose(
          a,
          b._crXSmCnX1,
          b._crYBgCnY2,
          b._cnY2BgCnY2,
          b._intXAndUpperCns,
          b._intYAndRightCns
        );
      },
      mostTopFromBottomOrBottomLeft: function (a) {
        var b = this;
        return this._mostYClose(
          a,
          b._crXBgCnX2,
          b._crYSmCnY1,
          b._cnY1SmCnY1,
          b._intXAndLowerCns,
          b._intYAndLeftCns
        );
      },
      mostTopFromBottomOrBottomRight: function (a) {
        var b = this;
        return this._mostYClose(
          a,
          b._crXSmCnX1,
          b._crYSmCnY1,
          b._cnY1SmCnY1,
          b._intXAndLowerCns,
          b._intYAndRightCns
        );
      },
      _mostXClose: function (a, b, c, d, e) {
        var f = rb.get(),
          g = null,
          h = function (d) {
            a.y >= d.y1 &&
              a.y <= d.y2 &&
              b(a, d) &&
              (null == g ? (g = d) : c(d, g) && (g = d));
          };
        if (_a.eq("grid", "vertical"))
          for (var i = d(a), j = 0; j < i.length; j++) h(f[i[j]]);
        else
          for (var i = e(a), j = 0; j < i.length; j++)
            for (var k = 0; k < i[j].length; k++) h(f[i[j][k]]);
        return g;
      },
      mostLeftFromRight: function (a) {
        var b = this;
        return this._mostXClose(
          a,
          b._crXSmCnX1,
          b._cnX1SmCnX1,
          b._intXCns,
          b._intYAndRightCns
        );
      },
      mostRightFromLeft: function (a) {
        var b = this;
        return this._mostXClose(
          a,
          b._crXBgCnX2,
          b._cnX1BgCnX2,
          b._intXCns,
          b._intYAndLeftCns
        );
      },
    });
    var ga = function () {};
    c(ga, {
      recreateForFirst: function (a, b) {
        _a.eq("append", "reversed")
          ? (gb.setLast(L.REV_APPEND), this._recreate(a, b, Eb, "Rev"))
          : (gb.setLast(L.APPEND), this._recreate(a, b, Cb, "Def"));
      },
      _recreate: function (a, b, c, d) {
        rb.reinitRanges(),
          g("recreateCrs", c)(),
          _a.eq("grid", "vertical")
            ? jb.rmIntFromBottom()
            : jb.rmIntFromRight();
      },
    });
    var ha = function () {};
    c(ha, {
      roundCnPerCr: function (a, b) {
        (a.origX1 = a.x1),
          (a.origX2 = a.x2),
          (a.origY1 = a.y1),
          (a.origY2 = a.y2);
        var c = function (a) {
          return ib.eq(b, a);
        };
        c(K.BOTTOM.LEFT) || c(K.RIGHT.TOP)
          ? ((a.x1 = Math.floor(a.x1)), (a.y1 = Math.floor(a.y1)))
          : c(K.LEFT.TOP) || c(K.BOTTOM.RIGHT)
          ? ((a.x2 = Math.ceil(a.x2)), (a.y1 = Math.floor(a.y1)))
          : c(K.LEFT.BOTTOM) || c(K.TOP.RIGHT)
          ? ((a.x2 = Math.ceil(a.x2)), (a.y2 = Math.ceil(a.y2)))
          : (c(K.TOP.LEFT) || c(K.RIGHT.BOTTOM)) &&
            ((a.x1 = Math.floor(a.x1)), (a.y2 = Math.ceil(a.y2)));
      },
      unroundCnPerCr: function (a, b) {
        (a.x1 = a.origX1),
          (a.y1 = a.origY1),
          (a.x2 = a.origX2),
          (a.y2 = a.origY2);
      },
    });
    var ia = function () {
      this._crs = null;
    };
    c(ia, {
      attach: function (a) {
        this._crs = a;
      },
      getSelected: function () {
        return this._crs;
      },
      _selectOnlyMostSideCr: function (a, b, c) {
        for (var d = null, e = null, f = this._crs.length; f--; )
          this._crs[f].side == a &&
            (null == d || c(this._crs[f][b], e)) &&
            ((d = this._crs[f].itemGUID), (e = this._crs[f][b]));
        if (null != d)
          for (var f = this._crs.length; f--; )
            this._crs[f].side == a &&
              this._crs[f].itemGUID != d &&
              this._crs.splice(f, 1);
      },
      _bgCond: function (a, b) {
        return a > b;
      },
      _smCond: function (a, b) {
        return b > a;
      },
      selectOnlyMostBottom: function (a) {
        this._selectOnlyMostSideCr(a, "y", this._bgCond);
      },
      selectOnlyMostTop: function (a) {
        this._selectOnlyMostSideCr(a, "y", this._smCond);
      },
      selectOnlyMostRight: function (a) {
        this._selectOnlyMostSideCr(a, "x", this._bgCond);
      },
      selectOnlyMostLeft: function (a) {
        this._selectOnlyMostSideCr(a, "x", this._smCond);
      },
      _selectOnly: function (a, b) {
        for (var c = 0; c < this._crs.length; c++)
          !ib.isInitial(this._crs[c]) &&
            b(this._crs[c].itemGUID) &&
            a != this._crs[c].side &&
            (this._crs.splice(c, 1), c--);
      },
      selectOnlyFromAppended: function (a) {
        this._selectOnly(a, function (a) {
          return !db.wasPrepended(a);
        });
      },
      selectOnlyFromPrepended: function (a) {
        this._selectOnly(a, function (a) {
          return db.wasPrepended(a);
        });
      },
    });
    var ja = function () {
      (this._crs = null), (this._newCrs = null);
    };
    c(ja, {
      attach: function (a) {
        (this._crs = a), (this._newCrs = []);
      },
      getNew: function () {
        return this._newCrs;
      },
      _createShifted: function (a, b, c) {
        this._newCrs.push({
          type: c.type,
          side: K.SHIFTED,
          x: parseFloat(a),
          y: parseFloat(b),
          itemGUID: Y["int"](c.itemGUID),
        });
      },
      shiftAll: function () {
        for (
          var a = [
              [K.LEFT.TOP, "LeftTop"],
              [K.LEFT.BOTTOM, "LeftBottom"],
              [K.BOTTOM.RIGHT, "BottomRight"],
              [K.BOTTOM.LEFT, "TopLeft"],
              [K.TOP.LEFT, "TopLeft"],
              [K.TOP.RIGHT, "BottomRight"],
              [K.RIGHT.BOTTOM, "RightBottom"],
              [K.RIGHT.TOP, "RightTop"],
            ],
            b = 0;
          b < this._crs.length;
          b++
        ) {
          this._newCrs.push(this._crs[b]);
          for (var c = 0; c < a.length; c++)
            if (ib.eq(this._crs[b], a[c][0])) {
              this["_shift" + a[c][1]](this._crs[b]);
              break;
            }
        }
      },
      _shiftLeftTop: function (a) {
        var b = kb.mostBottomFromTopOrTopLeft(a);
        null != b
          ? b.y2 + 1 != a.y && this._createShifted(a.x, b.y2 + 1, a)
          : 0 != a.y && this._createShifted(a.x, 0, a);
      },
      _shiftLeftBottom: function (a) {
        var b = kb.mostTopFromBottomOrBottomLeft(a);
        if (null != b) b.y1 - 1 != a.y && this._createShifted(a.x, b.y1 - 1, a);
        else {
          var c = sb.getMaxY();
          0 != c && c - 1 != a.y && this._createShifted(a.x, c - 1, a);
        }
      },
      _shiftBottomRight: function (a) {
        var b = kb.mostLeftFromRight(a);
        if (null != b) b.x1 - 1 != a.x && this._createShifted(b.x1 - 1, a.y, a);
        else {
          if (_a.eq("grid", "horizontal") && a.type == K.PREPEND.DEF) return;
          a.x != Za.x2() && this._createShifted(Za.x2(), a.y, a);
        }
      },
      _shiftTopLeft: function (a) {
        var b = kb.mostRightFromLeft(a);
        null != b
          ? b.x2 + 1 != a.x && this._createShifted(b.x2 + 1, a.y, a)
          : 0 != a.x && this._createShifted(0, a.y, a);
      },
      _shiftRightBottom: function (a) {
        var b = kb.mostTopFromBottomOrBottomRight(a);
        if (null != b) b.y1 - 1 != a.y && this._createShifted(a.x, b.y1 - 1, a);
        else {
          var c = sb.getMaxY();
          0 != c && c - 1 != a.y && this._createShifted(a.x, c - 1, a);
        }
      },
      _shiftRightTop: function (a) {
        var b = kb.mostBottomFromTopOrTopRight(a);
        null != b
          ? b.y2 + 1 != a.y && this._createShifted(a.x, b.y2 + 1, a)
          : 0 != a.y && this._createShifted(a.x, 0, a);
      },
      _shiftAllTo: function (a, b, c) {
        this._newCrs = this._crs;
        for (var d = 0; d < this._newCrs.length; d++)
          this._newCrs[d].side == a && (this._newCrs[d][b] = c);
      },
      shiftAllToRight: function (a) {
        this._shiftAllTo(a, "x", Za.x2());
      },
      shiftAllToLeft: function (a) {
        this._shiftAllTo(a, "x", 0);
      },
      shiftAllToTop: function (a) {
        this._shiftAllTo(a, "y", 0);
      },
      shiftAllToBottom: function (a) {
        this._shiftAllTo(a, "y", Za.y2());
      },
    });
    var ka = function () {
      this._crs = null;
    };
    c(ka, {
      attach: function (a) {
        this._crs = a;
      },
      getSorted: function () {
        return this._crs;
      },
      _sortForVG: function (a, b) {
        this._crs.sort(function (c, d) {
          return Y.areRoundedOrCeiledEq(c.y, d.y)
            ? a
              ? b
                ? c.x > d.x
                  ? 1
                  : -1
                : c.x < d.x
                ? 1
                : -1
              : b
              ? c.x > d.x
                ? 1
                : -1
              : c.x < d.x
              ? 1
              : -1
            : a
            ? c.y < d.y
              ? 1
              : -1
            : c.y < d.y
            ? -1
            : 1;
        });
      },
      _sortForHG: function (a, b) {
        this._crs.sort(function (c, d) {
          return Y.areRoundedOrCeiledEq(c.x, d.x)
            ? a
              ? b
                ? c.y < d.y
                  ? 1
                  : -1
                : c.y > d.y
                ? 1
                : -1
              : b
              ? c.y < d.y
                ? -1
                : 1
              : c.y > d.y
              ? -1
              : 1
            : a
            ? c.x < d.x
              ? 1
              : -1
            : c.x < d.x
            ? -1
            : 1;
        });
      },
      sortForPrepend: function () {
        var a = "default" == _a.get("prepend");
        _a.eq("grid", "vertical")
          ? this._sortForVG(!0, a)
          : this._sortForHG(!0, a);
      },
      sortForAppend: function () {
        var a = "default" == _a.get("append");
        _a.eq("grid", "vertical")
          ? this._sortForVG(!1, a)
          : this._sortForHG(!1, a);
      },
    });
    var la = function () {
      (this._collectFn = null),
        this._createCollectFn(),
        d(this, {
          collect: this.collect,
          collectNew: this.collectDisconnected,
          collectConnected: this.collectConnected,
        });
    };
    c(la, {
      _createCollectFn: function () {
        var a = this;
        this._collectFn = function (b) {
          if (_a.notEq("class", !1)) var c = "." + _a.get("class");
          else if (_a.notEq("data", !1)) var c = "[" + _a.get("data") + "]";
          else var c = _a.get("query");
          return a.filterCollectable(Y.find.byQuery(b, c));
        };
      },
      filterCollectable: function (a) {
        return Y.filter(
          a,
          function (a) {
            return !this.isNotCollectable(a);
          },
          this
        );
      },
      markAsNotCollectable: function (a) {
        Y.set(a, H.COLL.NOT_COLLECTABLE_DATA, "r");
      },
      unmarkAsNotCollectable: function (a) {
        Y.rmIfHas(a, H.COLL.NOT_COLLECTABLE_DATA);
      },
      isNotCollectable: function (a) {
        return Y.has(a, H.COLL.NOT_COLLECTABLE_DATA);
      },
      collect: function () {
        return this._collectFn(Za.get());
      },
      collectByQuery: function (a) {
        return this.filterCollectable(Y.find.byQuery(Za.get(), a));
      },
      collectConnected: function () {
        return Ya.filterConnected(this._collectFn(Za.get()));
      },
      collectDisconnected: function () {
        return Ya.filterNotConnected(this._collectFn(Za.get()));
      },
      filter: function (a) {
        for (var b = _a.getApi("filter"), c = 0; c < b.length; c++) {
          for (var d = [], e = 0; e < a.length; e++) b[c](a[e]) && d.push(a[e]);
          a = d;
        }
        return a;
      },
      sort: function (a) {
        return (
          this.saveOriginalOrder(a),
          a.sort(function (a, b) {
            return _a.getApi("sort")(a, b, Qb, Y);
          }),
          this.flushOriginalOrder(a),
          a
        );
      },
      saveOriginalOrder: function (a) {
        for (var b = 0; b < a.length; b++)
          Y.set(a[b], H.COLL.SORT_INDEX_DATA, b + 1);
      },
      flushOriginalOrder: function (a) {
        for (var b = 0; b < a.length; b++) Y.rm(a[b], H.COLL.SORT_INDEX_DATA);
      },
    });
    var ma = function () {
      (this._max = 9999), (this._min = 1e4), (this._firstPrepended = null);
    };
    c(ma, {
      reinit: function () {
        (this._max = 9999), (this._min = 1e4);
      },
      reinitMax: function (a) {
        this._max = "undefined" == typeof a || null == a ? 9999 : a;
      },
      get: function (a) {
        return Y["int"](Y.get(a, H.GUID_DATA));
      },
      set: function (a, b) {
        Y.set(a, H.GUID_DATA, b);
      },
      rm: function (a) {
        Y.rm(a, H.GUID_DATA);
      },
      markForAppend: function (a) {
        return Y.set(a, H.GUID_DATA, ++this._max), this._max;
      },
      markForPrepend: function (a) {
        return Y.set(a, H.GUID_DATA, --this._min), this._min;
      },
      markIfFirstPrepended: function (a) {
        null == this._firstPrepended &&
          (this._firstPrepended = Y["int"](Y.get(a, H.GUID_DATA)));
      },
      unmarkFirstPrepended: function () {
        this._firstPrepended = null;
      },
      wasPrepended: function (a) {
        return null == this._firstPrepended
          ? !1
          : Y["int"](a) <= this._firstPrepended;
      },
    });
    var na = function () {};
    c(na, {
      markAsConnected: function (a) {
        Y.set(a, H.ITEM.IS_CONNECTED_DATA, "y");
      },
      unmarkAsConnected: function (a) {
        Y.rm(a, H.ITEM.IS_CONNECTED_DATA);
      },
      isConnected: function (a) {
        return Y.has(a, H.ITEM.IS_CONNECTED_DATA);
      },
      filterConnected: function (a) {
        return Y.filter(
          a,
          function (a) {
            return this.isConnected(a);
          },
          this
        );
      },
      filterNotConnected: function (a) {
        return Y.filter(
          a,
          function (a) {
            return !this.isConnected(a);
          },
          this
        );
      },
      toNative: function (a) {
        var b = [];
        if (Y.isJquery(a)) for (var c = 0; c < a.length; c++) b.push(a.get(c));
        else if (Y.isNative(a)) b.push(a);
        else if (Y.isArray(a))
          for (var c = 0; c < a.length; c++)
            b.push(Y.isJquery(a[c]) ? a[c].get(0) : a[c]),
              Y.isNative(b[b.length - 1]) || e(O.NOT_NATIVE);
        else e(O.NOT_NATIVE);
        return b;
      },
    });
    var oa = function () {
      this._eventsData = [];
      var a = function (a) {
        return function (b, c) {
          var d = this.changeCss(a, b, c);
          return eb.updateAs(), Jb.fromFirstSortedCn(d), Wa;
        };
      };
      d(this, { toggleCss: a("toggle"), addCss: a("add"), rmCss: a("rm") });
    };
    c(oa, {
      changeCss: function (a, b, c) {
        for (
          var b = Ya.filterConnected(Ya.toNative(b)),
            c = Y.isArray(c) ? c : [c],
            d = 0;
          d < b.length;
          d++
        ) {
          for (
            var e = [],
              f = [],
              g = function (a, b) {
                e.push(b), Y.css.hasClass(a, b) || Y.css.addClass(a, b);
              },
              h = function (a, b) {
                f.push(b), Y.css.hasClass(a, b) && Y.css.removeClass(a, b);
              },
              i = 0;
            i < c.length;
            i++
          )
            "toggle" == a
              ? Y.css.hasClass(b[d], c[i])
                ? h(b[d], c[i])
                : g(b[d], c[i])
              : "add" == a
              ? g(b[d], c[i])
              : "rm" == a && h(b[d], c[i]);
          this._saveEventData(b[d], e, f);
        }
        return b;
      },
      _saveEventData: function (a, b, c) {
        for (
          var d = db.get(a), e = null, f = 0;
          f < this._eventsData.length;
          f++
        )
          if (this._eventsData[f].itemGUID == d) {
            e = this._eventsData[f];
            break;
          }
        null == e && ((e = {}), this._eventsData.push(e)),
          (e.itemGUID = d),
          (e.added = b),
          (e.removed = c);
      },
      emitEvents: function (a) {
        if (0 != this._eventsData.length)
          for (var b = 0; b < a.length; b++)
            for (var c = 0; c < this._eventsData.length; c++)
              if (Y["int"](a[b].itemGUID) == this._eventsData[c].itemGUID) {
                var d = this._eventsData[c];
                !(function (a, b, c) {
                  setTimeout(function () {
                    $a.emit(P.CSS_CHANGE, a, b, c);
                  }, _a.get("coordsChangeTime"));
                })(a[b].item, d.added, d.removed),
                  this._eventsData.splice(c, 1);
                break;
              }
      },
    });
    var pa = function () {
      (this._owCache = []),
        (this._ohCache = []),
        (this._nextOwGUID = 0),
        (this._nextOhGUID = 0),
        (this._isActive = !1),
        (this._owAntialias = 0),
        (this._ohAntialias = 0);
    };
    c(pa, {
      setOuterWidthAntialiasValue: function (a) {
        this._owAntialias = a;
      },
      setOuterHeightAntialiasValue: function (a) {
        this._ohAntialias = a;
      },
      _markAsCachedPerOw: function (a, b) {
        Y.set(a, [
          [H.SRM.CACHED_PER_OW_DATA, H.SRM.EMPTY_DATA],
          [H.SRM.CACHED_PER_OW_ITEM_GUID_DATA, b],
        ]);
      },
      _markAsCachedPerOh: function (a, b) {
        Y.set(a, [
          [H.SRM.CACHED_PER_OH_DATA, H.SRM.EMPTY_DATA],
          [H.SRM.CACHED_PER_OH_ITEM_GUID_DATA, b],
        ]);
      },
      unmarkAsCached: function (a) {
        Y.rmIfHas(a, [
          H.SRM.CACHED_PER_OW_DATA,
          H.SRM.CACHED_PER_OW_ITEM_GUID_DATA,
          H.SRM.CACHED_PER_OH_DATA,
          H.SRM.CACHED_PER_OH_ITEM_GUID_DATA,
        ]);
      },
      _getCachedItemEntry: function (a, b, c) {
        for (var d = 0; d < b.length; d++)
          if (parseInt(b[d].GUID) == parseInt(c)) return b[d];
      },
      _getOwCachedItemEntry: function (a) {
        return this._getCachedItemEntry(
          a,
          this._owCache,
          Y.get(a, H.SRM.CACHED_PER_OW_ITEM_GUID_DATA)
        );
      },
      _getOhCachedItemEntry: function (a) {
        return this._getCachedItemEntry(
          a,
          this._ohCache,
          Y.get(a, H.SRM.CACHED_PER_OH_ITEM_GUID_DATA)
        );
      },
      _isCallCached: function (a, b, c, d) {
        if (!Y.has(a, c)) return !1;
        var e = d(a);
        return b
          ? null != e.cachedCalls.withMargins
          : null != e.cachedCalls.withoutMargins;
      },
      _isOwCallCached: function (a, b) {
        var c = this;
        return this._isCallCached(a, b, H.SRM.CACHED_PER_OW_DATA, function (a) {
          return c._getOwCachedItemEntry(a);
        });
      },
      _isOhCallCached: function (a, b) {
        var c = this;
        return this._isCallCached(a, b, H.SRM.CACHED_PER_OH_DATA, function (a) {
          return c._getOhCachedItemEntry(a);
        });
      },
      startCachingTransaction: function () {
        this._isActive = !0;
      },
      stopCachingTransaction: function () {
        this._isActive = !1;
        for (var a = 0; a < this._owCache.length; a++)
          this.unmarkAsCached(this._owCache[a].item);
        for (var a = 0; a < this._ohCache.length; a++)
          this.unmarkAsCached(this._ohCache[a].item);
        (this._owCache = []),
          (this._ohCache = []),
          (this._nextOwGUID = 0),
          (this._nextOhGUID = 0);
      },
      _callRealOuter: function (a, b, c, d, e, f, g) {
        var h = this,
          g = g || !1,
          i = Z.recalcPtWidthFn,
          j = Z.recalcPtHeightFn,
          k = function (a) {
            return function (b, c, d, e) {
              return h[a](b, c, !0, d, e, !0);
            };
          };
        (Z.recalcPtWidthFn = k("outerWidth")),
          (Z.recalcPtHeightFn = k("outerHeight")),
          f || Z.clearRecursiveSubcallsData();
        var l = g ? "outerHeight" : "outerWidth",
          m = Z[l](a, b, d, e);
        return (
          c || (m -= g ? this._ohAntialias : this._owAntialias),
          (Z.recalcPtWidthFn = i),
          (Z.recalcPtHeightFn = j),
          m
        );
      },
      _callRealOw: function (a, b, c, d, e, f) {
        return this._callRealOuter(a, b, c, d, e, f);
      },
      _callRealOh: function (a, b, c, d, e, f) {
        return this._callRealOuter(a, b, c, d, e, f, !0);
      },
      _outer: function (a, b, c, d, e, f, g) {
        var h = arguments,
          g = g || !1;
        if (((h[2] = h[2] || !1), (h[5] = h[5] || !1), !this._isActive))
          return g
            ? this._callRealOh.apply(this, h)
            : this._callRealOw.apply(this, h);
        var i = null;
        if (
          (!g && this._isOwCallCached(a, b)
            ? (i = this._getOwCachedItemEntry(a))
            : g &&
              this._isOhCallCached(a, b) &&
              (i = this._getOhCachedItemEntry(a)),
          null != i)
        ) {
          var j = i.cachedCalls;
          return b ? j.withMargins : j.withoutMargins;
        }
        var k = g
          ? this._callRealOh.apply(this, h)
          : this._callRealOw.apply(this, h);
        if (
          (!g && Y.has(a, H.SRM.CACHED_PER_OW_DATA)) ||
          (g && Y.has(a, H.SRM.CACHED_PER_OH_DATA))
        ) {
          var i = g
            ? this._getOhCachedItemEntry(a)
            : this._getOwCachedItemEntry(a);
          b
            ? (i.cachedCalls.withMargins = k)
            : (i.cachedCalls.withoutMargins = k);
        } else {
          g
            ? this._markAsCachedPerOh(a, ++this._nextOhGUID)
            : this._markAsCachedPerOw(a, ++this._nextOwGUID);
          var l = { withMargins: b ? k : null, withoutMargins: b ? null : k },
            m = g ? this._ohCache : this._owCache;
          m.push({
            GUID: g ? this._nextOhGUID : this._nextOwGUID,
            item: a,
            cachedCalls: l,
          });
        }
        return k;
      },
      outerWidth: function (a, b, c, d, e, f) {
        return this._outer(a, b, c, d, e, f);
      },
      outerHeight: function (a, b, c, d, e, f) {
        return this._outer(a, b, c, d, e, f, !0);
      },
      positionTop: function (a) {
        return Z.positionTop(a);
      },
      positionLeft: function (a) {
        return Z.positionLeft(a);
      },
      _offset: function (a, b, c, d) {
        var b = b || !1;
        if (b)
          var e = this[c](a),
            f = this[c](a, !0),
            g = f - e,
            h = g / 2,
            i = Z[d](a) - h;
        else var i = Z[d](a);
        return i;
      },
      offsetLeft: function (a, b) {
        return this._offset(a, b, "outerWidth", "offsetLeft");
      },
      offsetTop: function (a, b) {
        return this._offset(a, b, "outerHeight", "offsetTop");
      },
      viewportWidth: function () {
        return document.documentElement.clientWidth;
      },
      viewportHeight: function () {
        return document.documentElement.clientHeight;
      },
      viewportScrollLeft: function () {
        return window.pageXOffset || document.documentElement.scrollLeft;
      },
      viewportScrollTop: function () {
        return window.pageYOffset || document.documentElement.scrollTop;
      },
      viewportDocumentCoords: function () {
        return {
          x1: this.viewportScrollLeft(),
          x2: this.viewportScrollLeft() + this.viewportWidth() - 1,
          y1: this.viewportScrollTop(),
          y2: this.viewportScrollTop() + this.viewportHeight() - 1,
        };
      },
      itemSizes: function (a) {
        return {
          width: this.outerWidth(a, !0),
          height: this.outerHeight(a, !0),
        };
      },
      copyComputedStyle: function (a, b) {
        var c = this,
          d = function (a, b) {
            Z.cloneComputedStyle(a, b);
            for (var e = 0; e < a.childNodes.length; e++)
              if (1 == a.childNodes[e].nodeType) {
                d(a.childNodes[e], b.childNodes[e]);
                var f = Z.getComputedCSS(a.childNodes[e]);
                /.*px.*/.test(f.left) &&
                  (b.childNodes[e].style.left =
                    c.positionLeft(a.childNodes[e]) + "px"),
                  /.*px.*/.test(f.top) &&
                    (b.childNodes[e].style.top =
                      c.positionTop(a.childNodes[e]) + "px");
                var g = Z.getUncomputedCSS(a.childNodes[e]);
                (b.childNodes[e].style.width =
                  c.outerWidth(a.childNodes[e]) + "px"),
                  0 != Y["int"](g.height) &&
                    (b.childNodes[e].style.height =
                      c.outerHeight(a.childNodes[e]) + "px");
              }
          };
        d(a, b);
      },
    });
    var qa = function () {
      d(this, {
        disconnect: function (a) {
          var b = this;
          return (
            (a = Ya.filterConnected(Ya.toNative(a))),
            setTimeout(function () {
              Jb.sync(), b.disconnect(a, H.DISC_TYPES.HARD), Jb.all();
            }, H.REFLOW_FIX_DELAY),
            Wa
          );
        },
        pop: function () {
          var a = Wa.first();
          return null != a && Wa.disconnect(a), a;
        },
        shift: function () {
          var a = Wa.last();
          return null != a && Wa.disconnect(a), a;
        },
      });
    };
    c(qa, {
      disconnect: function (a, b) {
        var b = b || H.DISC_TYPES.SOFT,
          a = Ya.filterConnected(Ya.toNative(a));
        if (b == H.DISC_TYPES.HARD)
          for (var c = 0; c < a.length; c++) cb.markAsNotCollectable(a[c]);
        for (var d = this._findCnsToDisc(a), c = 0; c < d.length; c++)
          rb.rm(d[c]), db.rm(d[c].item);
        0 == rb.count() && this._recreateCrs();
        for (var c = 0; c < d.length; c++) Ya.unmarkAsConnected(d[c].item);
        rb.reinitRanges(), this._scheduleRender(d);
      },
      _findCnsToDisc: function (a) {
        for (var b = [], c = 0; c < a.length; c++) b.push(sb.find(a[c]));
        return vb.sortForReappend(b);
      },
      _recreateCrs: function () {
        ib.flush(),
          _a.eq("append", "default")
            ? Cb.createInitialCr()
            : Eb.createInitialCr();
      },
      _scheduleRender: function (a) {
        var b = Mb.itemsToBatches(a, H.DISC_BATCH, !0);
        yb.markAsSchToHide(a);
        for (var c = 0; c < b.length; c++)
          !(function (a, b) {
            setTimeout(function () {
              yb.hide(a);
            }, H.DISC_DELAY * b);
          })(b[c], c);
      },
    });
    var ra = function () {};
    c(ra, {
      filter: function () {
        var a = cb.collect(),
          b = cb.collectConnected(),
          c = cb.sort(cb.filter(a)),
          d = this._findConnItemsToHide(b);
        Hb.disconnect(d), this._recreateGUIDS(c), this._recreateCns(c);
      },
      _findConnItemsToHide: function (a) {
        return Y.filter(
          a,
          function (a) {
            return 0 == cb.filter([a]).length;
          },
          this
        );
      },
      _recreateGUIDS: function (a) {
        db.reinit();
        for (var b = 0; b < a.length; b++) db.markForAppend(a[b]);
      },
      _recreateCns: function (a) {
        var b = rb.get();
        if ((b.splice(0, b.length), _a.eq("grid", "vertical")))
          var c = { c1: "y", c2: "x" };
        else var c = { c1: "x", c2: "y" };
        for (var d = 0, e = 0; e < a.length; e++) {
          var f = {};
          (f[c.c1 + "1"] = d),
            (f[c.c1 + "2"] = d),
            (f[c.c2 + "1"] = 0),
            (f[c.c2 + "2"] = 0),
            rb.add(a[e], f),
            d++;
        }
      },
    });
    var sa = function () {};
    c(sa, {
      resort: function () {
        var a = cb.sort(cb.collectConnected());
        _a.eq("sortDispersion", !0) && this._resortOnSD(a), db.reinit();
        for (var b = 0; b < a.length; b++) db.markForAppend(a[b]);
      },
      _resortOnSD: function (a) {
        if (_a.eq("grid", "vertical")) var b = { c1: "y", c2: "x" };
        else var b = { c1: "x", c2: "y" };
        for (var c = 0, d = 0; d < a.length; d++) {
          var e = sb.find(a[d]);
          (e[b.c1 + "1"] = c),
            (e[b.c1 + "2"] = c),
            (e[b.c2 + "1"] = 0),
            (e[b.c2 + "2"] = 0),
            c++;
        }
      },
    }),
      (k = function () {
        (this._shouldUpdateZ = !1),
          (this._disableZUpdates = !1),
          (this._updateZTimeout = null);
        var a = this;
        Wa.onReposition(function () {
          a._shouldUpdateZ &&
            !a._disableZUpdates &&
            (clearTimeout(a._updateZTimeout),
            (a._updateZTimeout = setTimeout(function () {
              a._updateZ.call(a);
            }, H.UPDATE_Z_DELAY)));
        }),
          $a.onSetSettingForNzer(function (b) {
            for (
              var c = ["widthPx", "heightPx", "widthPt", "heightPt"],
                d = !1,
                e = 0;
              e < c.length;
              e++
            )
              b == c[e] + "As" && (d = !0);
            d && a.updateAs();
          }),
          d(this, {
            disableZUpdates: function () {
              return (a._disableZUpdates = !0), Wa;
            },
          }),
          this.updateAs();
      }),
      c(k, {
        updateAs: function () {
          var a = this._updateAs("x", "width", "Width"),
            b = this._updateAs("y", "height", "Height");
          this._shouldUpdateZ = a || b;
        },
        _updateAs: function (a, b, c) {
          var d = parseFloat(_a.get(b + "PxAs")),
            e = parseFloat(_a.get(b + "PtAs"));
          if (0 == d && 0 == e)
            return Xa["setOuter" + c + "AntialiasValue"](0), !1;
          if (0 != e) var f = (Za[a + "2"]() + 1) * (e / 100);
          else var f = d;
          return Xa["setOuter" + c + "AntialiasValue"](f), !0;
        },
        _updateZ: function () {
          var a = function (a) {
              for (var b = 0; b < a.length; b++) {
                var c = Math.abs(a[b].x2 - a[b].x1) + 1,
                  d = Math.abs(a[b].y2 - a[b].y1) + 1;
                a[b].normArea = Math.round(c * d);
              }
            },
            b = function (a, b) {
              return a.normArea > b.normArea
                ? 1
                : a.normArea < b.normArea
                ? -1
                : 0;
            },
            c = function (a) {
              for (var b = {}, c = 0; c < a.length; c++)
                "undefined" == typeof b[a[c].normArea] &&
                  (b[a[c].normArea] = []),
                  b[a[c].normArea].push(a[c]);
              return b;
            },
            d = rb.get();
          a(d), d.sort(b);
          var e = c(d),
            f = [];
          for (var g in e)
            (e[g] = vb.sortForReappend(e[g])), f.push(Y["int"](g));
          f.sort(function (a, b) {
            return a > b ? 1 : b > a ? -1 : 0;
          });
          for (var h = 1, i = 0; i < f.length; i++)
            for (var j = 0; j < e[f[i]].length; j++)
              (e[f[i]][j].item.style.zIndex = h), h++;
        },
      });
    var ta = function () {
      (this._onResize = null),
        this._bindEvents(),
        d(this, {
          destroy: function () {
            return this._unbindEvents(), Wa;
          },
          set: function (a, b) {
            return _a.set(a, b), Wa;
          },
          setApi: function (a, b) {
            return _a.setApi(a, b), Wa;
          },
          addApi: function (a, b, c) {
            return _a.addApi(a, b, c), Wa;
          },
          get: function (a) {
            return _a.get(a);
          },
          toggle: function (a) {
            return Wa.setApi("toggle", a);
          },
          sort: function (a) {
            return Wa.setApi("sort", a);
          },
          coordsChanger: function (a) {
            return Wa.setApi("coordsChanger", a);
          },
          drag: function (a) {
            return Wa.setApi("drag", a);
          },
          rsort: function (a) {
            return Wa.setApi("rsort", a), Jb.all(), Wa;
          },
          resort: function () {
            return Jb.sync(), Gb.resort(), Jb.all(), Wa;
          },
          filter: function (a) {
            return Jb.sync(), Wa.setApi("filter", a), Ib.filter(), Jb.all(), Wa;
          },
          reposition: function () {
            return eb.updateAs(), Jb.all(), Wa;
          },
          prepend: function (a, b, c) {
            var d = g("eq", _a);
            if (d("loadImages", !0)) {
              var e = d("prepend", "mirrored") ? L.INS_BEFORE : L.PREPEND;
              hb.schedule(Ya.toNative(a), e, {
                batchSize: b,
                batchDelay: c,
                beforeItem: null,
              });
            } else
              d("prepend", "mirrored")
                ? Wa.insertBefore(a, null, b, c)
                : this.exec(L.PREPEND, a, b, c);
            return Wa;
          },
          append: function (a, b, c) {
            return (
              _a.eq("loadImages", !0)
                ? hb.schedule(Ya.toNative(a), L.APPEND, {
                    batchSize: b,
                    batchDelay: c,
                  })
                : this.exec(L.APPEND, a, b, c),
              Wa
            );
          },
          silentAppend: function (a, b, c) {
            return (
              _a.eq("loadImages", !0)
                ? hb.schedule(Ya.toNative(a), L.SIL_APPEND, {
                    batchSize: b,
                    batchDelay: c,
                  })
                : this.execSilentAppend(a, b, c),
              Wa
            );
          },
          silentRender: function (a, b, c) {
            return Bb.exec(a, b, c), Wa;
          },
          getSilent: function (a) {
            return Bb.getScheduled(a);
          },
          insertBefore: function (a, b, c, d) {
            return (
              _a.eq("loadImages", !0)
                ? hb.schedule(Ya.toNative(a), L.INS_BEFORE, {
                    batchSize: c,
                    batchDelay: d,
                    beforeItem: b,
                  })
                : this.exec(L.INS_BEFORE, a, c, d, b),
              Wa
            );
          },
          insertAfter: function (a, b, c, d) {
            return (
              _a.eq("loadImages", !0)
                ? hb.schedule(Ya.toNative(a), L.INS_AFTER, {
                    batchSize: c,
                    batchDelay: d,
                    afterItem: b,
                  })
                : this.exec(L.INS_AFTER, a, c, d, b),
              Wa
            );
          },
          appendNew: function (a, b) {
            return Wa.append(Wa.collectNew(), a, b), Wa;
          },
          prependNew: function (a, b) {
            return Wa.prepend(Wa.collectNew(), a, b), Wa;
          },
          rotate: function (a, b, c, d) {
            Wa.toggle(b);
            var a = Ya.toNative(a);
            return "undefined" == typeof c
              ? (yb.rotate(a), Wa)
              : (Mb.scheduleFnExec(a, c, d, function (a) {
                  yb.rotate(a);
                }),
                Wa);
          },
        });
    };
    c(ta, {
      _bindEvents: function () {
        var a = g("get", _a),
          b = null;
        (this._onResize = function () {
          return null == a("vpResizeDelay")
            ? void Wa.reposition()
            : (clearTimeout(b),
              void (b = setTimeout(function () {
                Wa.reposition();
              }, a("vpResizeDelay"))));
        }),
          W.add(window, "resize", this._onResize);
      },
      _unbindEvents: function () {
        W.rm(window, "resize", this._onResize),
          Wa.isDragifierOn() && Wa.dragifierOff();
      },
      exec: function (a, b, c, d, e) {
        setTimeout(function () {
          Mb.schedule(a, b, c, d, e);
        }, H.REFLOW_FIX_DELAY);
      },
      execSilentAppend: function (a, b, c) {
        Bb.schedule(Ya.toNative(a)), this.exec(L.APPEND, a, b, c);
      },
    });
    var ua = function () {
      (this._callbacks = {}), (this._insertEvTimeout = null), this._init();
    };
    c(ua, {
      _init: function () {
        var a = this,
          b = function (b, c, d) {
            for (var e in b) {
              var f = b[e];
              (this._callbacks[f] = c ? null : []),
                (function (b) {
                  d["on" + b] = function (d) {
                    c ? (a._callbacks[b] = d) : a._callbacks[b].push(d);
                  };
                })(f);
            }
          };
        b.call(a, P, !1, Wa), b.call(a, Q, !0, a);
      },
      _getArgs: function (a, b, c) {
        Y.hasVal(a, b) || e("no " + b + " to emit");
        var d = [];
        return Array.prototype.push.apply(d, c), d.shift(), d;
      },
      emit: function (a) {
        var b = this._getArgs(P, a, arguments),
          c = this;
        if (a == P.INSERT) return void this._emitInsertEvent(b[0]);
        for (var d = 0; d < this._callbacks[a].length; d++)
          a == P.REPOSITION || a == P.REPOSITION_END
            ? !(function (a, b) {
                setTimeout(function () {
                  a.apply(c, b);
                }, 0);
              })(this._callbacks[a][d], b)
            : this._callbacks[a][d].apply(this, b);
        if (a == P.HIDE && cb.isNotCollectable(b[0]))
          for (var d = 0; d < this._callbacks[P.DISCONNECT].length; d++)
            this._callbacks[P.DISCONNECT][d](b[0]);
      },
      _emitInsertEvent: function (a) {
        var b = function (a) {
          for (var b = 0; b < this._callbacks[P.INSERT].length; b++)
            this._callbacks[P.INSERT][b](a);
        };
        null != this._insertEvTimeout &&
          (clearTimeout(this._insertEvTimeout),
          (this._insertEvTimeout = null),
          (a = a.concat(this._insertEvItems)));
        var c = this;
        (this._insertEvItems = a),
          (this._insertEvTimeout = setTimeout(function () {
            (c._insertEvTimeout = null), b.call(c, a);
          }, 20));
      },
      emitInternal: function (a) {
        var b = this._getArgs(Q, a, arguments);
        null != this._callbacks[a] &&
          (this._callbacks[a].apply(this, b),
          a == Q.REPOSITION_END_FOR_DRAG && (this._callbacks[a] = null));
      },
      rmInternal: function (a) {
        this._getArgs(Q, a, arguments), (this._callbacks[a] = null);
      },
    });
    var va = function () {
      var a = this;
      d(this, {
        first: function () {
          return a.get("first");
        },
        last: function () {
          return a.get("last");
        },
        next: function (b) {
          return a.get("next", b);
        },
        prev: function (b) {
          return a.get("prev", b);
        },
        all: function () {
          return a.get("all");
        },
      });
    };
    c(va, {
      get: function (a, b) {
        var c = rb.get();
        if (0 == c.length) return "all" == a ? [] : null;
        if (((c = vb.sortForReappend(c)), "first" == a)) return c[0].item;
        if ("last" == a) return c[c.length - 1].item;
        var d = function (a, b) {
          return db.get(a) == db.get(Ya.toNative(b)[0]);
        };
        if ("next" == a) {
          for (var e = 0; e < c.length; e++)
            if (d(c[e].item, b))
              return e + 1 > c.length - 1 ? null : c[e + 1].item;
        } else if ("prev" == a) {
          for (var e = c.length - 1; e >= 0; e--)
            if (d(c[e].item, b)) return 0 > e - 1 ? null : c[e - 1].item;
        } else if ("all" == a) {
          for (var f = [], e = 0; e < c.length; e++) f.push(c[e].item);
          return f;
        }
        return null;
      },
    });
    var wa = function () {
      this._last = null;
    };
    c(wa, {
      isInitial: function (a) {
        return null == this._last ? ((this._last = a), !0) : !1;
      },
      isSameAsPrev: function (a) {
        return this._last != a ? ((this._last = a), !1) : !0;
      },
      setLast: function (a) {
        this._last = a;
      },
    });
    var xa = function (a, b, c, d, e) {
      (this._op = b),
        (this._crInitialCr = c),
        (this._addItemCrs = d),
        (this._cantFitCond = e);
      (a.recreateCrs = g("_recreateCrs", this)),
        (a.createInitialCr = g("_createInitialCr", this));
    };
    c(xa, {
      initCrs: function (a, b, c) {
        return gb.isInitial(this._op)
          ? void this._createInitialCr()
          : void (
              gb.isSameAsPrev(this._op) ||
              (this._recreateCrs(),
              jb["rmIntFrom" + a](),
              jb["rmAllToo" + b + "FromMost" + c]())
            );
      },
      _createInitialCr: function () {
        this._crInitialCr(ib, Za);
      },
      _recreateCrs: function (a) {
        var a = a || !1;
        a || ib.flush();
        for (var b = rb.get(), c = 0; c < b.length; c++)
          this._addItemCrs.call(this, b[c], b[c].itemGUID);
        0 == ib.count() && this._createInitialCr();
      },
      cleanCrs: function (a, b, c) {
        jb["rmAllToo" + b + "FromMost" + c](), jb["rmIntFrom" + a]();
      },
      filterCrs: function (a, b, c, d, e) {
        var f = ib.getClone();
        return (
          nb.attach(f),
          nb["selectOnlyFrom" + a](b),
          (f = nb.getSelected()),
          _a.eq("intersections", !0)
            ? (ob.attach(f), ob.shiftAll(), (f = ob.getNew()))
            : (nb.attach(f),
              nb["selectOnlyMost" + c](b),
              (f = nb.getSelected()),
              ob.attach(f),
              ob["shiftAllTo" + d](b),
              (f = ob.getNew())),
          pb.attach(f),
          pb["sortFor" + e](),
          pb.getSorted()
        );
      },
      findCnCoords: function (a, b, c, d, f, g, h) {
        for (var i = null, j = 0; j < b.length; j++) {
          var k = qb.find(this._op, a, b[j]);
          if (!this._cantFitCond.call(this, k)) {
            var l = tb["findAllMaybeIntOn" + c](b[j]);
            if (!tb.isIntersectingAny(l, k)) {
              i = k;
              var m = rb["getAll" + d](k[f]);
              if (
                !sb["isAnyGUID" + g + "Than"](m, a) &&
                (_a.eq("intersections", !1) &&
                  rb["isIntMoreThanOneCn" + h](i) &&
                  (i = null),
                null != i)
              )
                break;
            }
          }
        }
        return null == i && e(O.TOO_BIG_ITEM), i;
      },
      createCn: function (a, b, c) {
        var d = rb.add(a, b);
        return (
          _a.eq("intersections", !1) &&
            (_a.eq("grid", "vertical")
              ? rb.expandYAllRowCnsToMostTall(d)
              : rb.expandXAllColCnsToMostWide(d)),
          this._addItemCrs.call(this, d, db.get(a)),
          d
        );
      },
      render: function (a, b) {
        if (_a.eq("intersections", !0)) yb.show(b);
        else {
          if (_a.eq("grid", "vertical")) var c = rb.getLastRowYExpandedCns();
          else var c = rb.getLastColXExpandedCns();
          for (var d = 0; d < c.length; d++)
            c[d].itemGUID == b.itemGUID && (c.splice(d, 1), d--);
          yb.renderAfterDelay(c), yb.show(b);
        }
      },
      fixAllXYPosAfterPrepend: function (a, b) {
        if (_a.eq("grid", "vertical")) var c = rb.fixAllYPosAfterPrepend(a, b);
        else var c = rb.fixAllXPosAfterPrepend(a, b);
        return c;
      },
      renderAfterPrependFix: function (a) {
        yb.render(rb.get(), [a]);
      },
    });
    var ya = function () {
      this._fixRoundingVal = 1;
    };
    c(ya, {
      fixLowRounding: function (a) {
        return a - this._fixRoundingVal;
      },
      fixHighRounding: function (a) {
        return a + this._fixRoundingVal;
      },
    }),
      (y = function () {
        this._cells = [];
      }),
      c(y, {
        cells: function () {
          return this._cells;
        },
        discretize: function () {
          var a = sb.getMinWidth(),
            b = sb.getMinHeight(),
            c = _a.eq("append", "default") ? "Def" : "Rev";
          this._cells = Ub["discretizeOn" + c + "Append"](a, b);
        },
        intCellsToCoords: function (a) {
          for (
            var b = {
                x1: a[0].x1,
                x2: a[0].x2,
                y1: a[0].y1,
                y2: a[0].y2,
              },
              c = 1;
            c < a.length;
            c++
          )
            a[c].x1 < b.x1 && (b.x1 = a[c].x1),
              a[c].x2 > b.x2 && (b.x2 = a[c].x2),
              a[c].y1 < b.y1 && (b.y1 = a[c].y1),
              a[c].y2 > b.y2 && (b.y2 = a[c].y2);
          return b;
        },
        markIntCellsBy: function (a) {
          for (var b = 0; b < this._cells.length; b++)
            for (var c = 0; c < this._cells[b].length; c++) {
              var d = this._cells[b][c],
                e = {
                  x1: d.centerX,
                  x2: d.centerX,
                  y1: d.centerY,
                  y2: d.centerY,
                };
              this._cells[b][c].isInt = tb.isIntersectingAny([e], a);
            }
        },
        getAllCellsWithIntCenter: function (a) {
          for (
            var b = [],
              c = [],
              d = { rows: 0, cols: 0 },
              e = function (a) {
                for (var b = 0; b < c.length; b++) if (c[b] == a) return !0;
                return !1;
              },
              f = 0;
            f < this._cells.length;
            f++
          ) {
            for (var g = !1, h = [], i = 0; i < this._cells[f].length; i++) {
              var j = this._cells[f][i],
                k = {
                  x1: j.centerX,
                  x2: j.centerX,
                  y1: j.centerY,
                  y2: j.centerY,
                };
              tb.isIntersectingAny([k], a) &&
                (h.push(j),
                g || (d.rows++, (g = !0)),
                e(i) || (d.cols++, c.push(i)));
            }
            h.length > 0 && b.push(h);
          }
          return { intCells: b, int: d };
        },
      }),
      (z = function () {}),
      c(z, {
        _rev: function (a) {
          for (var b = [], c = 0, d = 0; d < a.length; d++)
            a[d].length > c && (c = a[d].length);
          for (var e = 0, f = 0; c > f; f++) {
            for (var g = [], h = 0; h < a.length; h++)
              "undefined" != typeof a[h][e] && g.push(a[h][e]);
            b.push(g), e++;
          }
          return b;
        },
        _coords: function (a) {
          return (
            (a.isInt = !1),
            (a.centerX = a.x1 + (a.x2 - a.x1 + 1) / 2),
            (a.centerY = a.y1 + (a.y2 - a.y1 + 1) / 2),
            a
          );
        },
        _onDefAppend: function (a, b, c, d, e) {
          for (var f = [], g = -1, h = !0; h; ) {
            for (var i = [], j = -1, k = !0; k; )
              (j += b), j > d ? (k = !1) : i.push(this._coords(e(g, j, a, b)));
            f.push(i), (g += a), g + a > c && (h = !1);
          }
          return f;
        },
        _onRevAppend: function (a, b, c, d, e) {
          for (var f = [], g = -1, h = !0; h; ) {
            for (var i = [], j = c + 1, k = !0; k; )
              (j -= b),
                0 > j ? (k = !1) : i.unshift(this._coords(e(g, j, a, b)));
            f.push(i), (g += a), g + a > d && (h = !1);
          }
          return f;
        },
        discretizeOnDefAppend: function (a, b) {
          var c = {
            vg: function (a, b, c, d) {
              return { x1: b - d + 1, x2: b, y1: a + 1, y2: a + c };
            },
            hg: function (a, b, c, d) {
              return { x1: a + 1, x2: a + c, y1: b - d + 1, y2: b };
            },
          };
          return _a.eq("grid", "vertical")
            ? this._onDefAppend(b, a, Za.y2(), Za.x2(), c.vg)
            : this._rev(this._onDefAppend(a, b, Za.x2(), Za.y2(), c.hg));
        },
        discretizeOnRevAppend: function (a, b) {
          var c = {
            vg: function (a, b, c, d) {
              return { x1: b, x2: b + d - 1, y1: a + 1, y2: a + c };
            },
            hg: function (a, b, c, d) {
              return { x1: a + 1, x2: a + c, y1: b, y2: b + d - 1 };
            },
          };
          return _a.eq("grid", "vertical")
            ? this._onRevAppend(b, a, Za.x2(), Za.y2(), c.vg)
            : this._rev(this._onRevAppend(a, b, Za.y2(), Za.x2(), c.hg));
        },
        _normalizeCnXYCoords: function (a, b, c, d, e, f, g) {
          var h = b[e] - b[d] + 1,
            i = Xa["outer" + c](a, !0);
          return (
            (i > h || h > i) &&
              (g && _a.eq("append", "default")
                ? (b[d] = b[e] - i + 1)
                : (b[e] = b[d] + i - 1)),
            b[d] < 0 && ((b[d] = 0), (b[e] = i - 1)),
            b[e] > f && ((b[e] = f), (b[d] = b[e] - i + 1)),
            b
          );
        },
        normalizeCnXCoords: function (a, b) {
          var c = [a, b, "Width", "x1", "x2", Za.x2()];
          return (
            c.push(_a.eq("grid", "vertical")),
            this._normalizeCnXYCoords.apply(this, c)
          );
        },
        normalizeCnYCoords: function (a, b) {
          var c = [a, b, "Height", "y1", "y2", Za.y2()];
          return (
            c.push(!_a.eq("grid", "vertical")),
            this._normalizeCnXYCoords.apply(this, c)
          );
        },
      }),
      (B = function () {
        (this._items = []),
          (this._isDragging = !1),
          (this._areEventsBinded = !1),
          (this._origReposQueueSize = null),
          (this._coordsChanger = Tb.getCoordsChanger()),
          this._createEvents(),
          _a.eq("dragifier", !1) || this._bindEvents(),
          d(this, {
            dragifierOn: function () {
              this._bindEvents();
            },
            dragifierOff: function () {
              this._unbindEvents();
            },
            isDragifierOn: function () {
              return this._areEventsBinded;
            },
          });
      }),
      c(B, {
        _createEvents: function () {
          var a = this;
          (this._touch = {
            start: function (b) {
              console.log("Entering touchStart");
              console.log(b);
              console.log("touchStart dumped");
              if (b.target.id == "closeImg") return;
              a._touchStart.call(a, b);
            },
            end: function (b) {
              console.log("Entering touchEnd");
              console.log(b);
              console.log("touchEnd dumped");
              if (b.target.id == "closeImg") return;
              a._isDragging &&
                (b.preventDefault(),
                setTimeout(function () {
                  a._touchEnd.call(a, b);
                }, 0));
            },
            move: function (b) {
              console.log(b);
              a._isDragging &&
                (b.preventDefault(),
                setTimeout(function () {
                  a._touchMove.call(a, b);
                }, 0));
            },
          }),
            (this._mouse = {
              down: function (b) {
                a._mouseDown.call(a, b);
              },
              up: function (b) {
                setTimeout(function () {
                  a._mouseUp.call(a, b);
                }, 0);
              },
              move: function (b) {
                setTimeout(function () {
                  a._mouseMove.call(a, b);
                }, 0);
              },
            });
        },
        _touchStart: function (a) {
          var b = this,
            c = a.changedTouches[0],
            d = b._findClosestConnected(a.target);
          return null != d
            ? (b._initDrag.call(b, a),
              b._isAlreadyDraggable(d)
                ? void b._findAlreadyDraggable(d).addDragId(c.identifier)
                : void b._initDraggableItem.call(b, d, c, !0))
            : void 0;
        },
        _touchEnd: function (a) {
          var b = this;
          if (b._isDragging) {
            for (var c = a.changedTouches, d = 0; d < c.length; d++) {
              var e = b._findDraggableById(c[d].identifier, !0);
              null != e.item &&
                (e.item.rmDragId(c[d].identifier),
                0 == e.item.getDragIdsCount() &&
                  (e.item.unbind(), b._items.splice(e.itemIndex, 1)));
            }
            0 == b._items.length && b._endDrag();
          }
        },
        _touchMove: function (a) {
          var b = this;
          if (b._isDragging) {
            b._reposQueueSync();
            for (var c = a.changedTouches, d = 0; d < c.length; d++) {
              var e = b._findDraggableById(c[d].identifier);
              null != e && e.dragMove(c[d].pageX, c[d].pageY);
            }
          }
        },
        _mouseDown: function (a) {
          var b = this,
            c = b._findClosestConnected(a.target);
          null == c ||
            Y.browsers.isAndroidUC() ||
            (b._initDrag.call(b, a), b._initDraggableItem.call(b, c, a, !1));
        },
        _mouseUp: function (a) {
          var b = this;
          b._isDragging &&
            !Y.browsers.isAndroidUC() &&
            (b._endDrag(), b._items[0].unbind(), b._items.splice(0, 1));
        },
        _mouseMove: function (a) {
          var b = this;
          b._isDragging &&
            !Y.browsers.isAndroidUC() &&
            (b._reposQueueSync(), b._items[0].dragMove(a.pageX, a.pageY));
        },
        _initDrag: function (a) {
          a.preventDefault(),
            this._reposQueueOff(),
            Tb.getSelectToggler().disableSelect(),
            Xa.startCachingTransaction(),
            (this._isDragging = !0);
        },
        _endDrag: function () {
          this._reposQueueOn(),
            Tb.getSelectToggler().enableSelect(),
            Xa.stopCachingTransaction(),
            (this._isDragging = !1);
        },
        _initDraggableItem: function (a, b, c) {
          var d = this._createDraggableItem();
          d.bind(a, b.pageX, b.pageY),
            c && d.addDragId(b.identifier),
            this._items.push(d);
        },
        _toggleEvents: function (a) {
          W[a](Za.get(), "mousedown", this._mouse.down),
            W[a](document.body, "mouseup", this._mouse.up),
            W[a](document.body, "mousemove", this._mouse.move),
            W[a](Za.get(), "touchstart", this._touch.start),
            W[a](document.body, "touchend", this._touch.end),
            W[a](document.body, "touchmove", this._touch.move);
        },
        _bindEvents: function () {
          this._areEventsBinded ||
            ((this._areEventsBinded = !0), this._toggleEvents("add"));
        },
        _unbindEvents: function () {
          this._areEventsBinded &&
            ((this._areEventsBinded = !1), this._toggleEvents("rm"));
        },
        _reposQueueOff: function () {
          _a.eq("disableQueueOnDrags", !1) ||
            ((this._origReposQueueSize = _a.get("queueSize")),
            this._reposQueueSync());
        },
        _reposQueueOn: function () {
          _a.eq("disableQueueOnDrags", !1) ||
            _a.set("queueSize", this._origReposQueueSize);
        },
        _reposQueueSync: function () {
          _a.eq("disableQueueOnDrags", !1) ||
            _a.set("queueSize", Wa.all().length);
        },
        _findClosestConnected: function (a) {
          if (a == Za.get()) return null;
          for (
            var b = _a.get("dragifier"),
              c = "string" == typeof b || b instanceof String,
              d = null,
              e = null,
              f = !1;
            null == d && e != Za.get();

          )
            (e = null == e ? a : e.parentNode),
              c && Y.css.hasClass(e, b) && (f = !0),
              Ya.isConnected(e) && (d = e);
          return null == d || (c && !f) ? null : d;
        },
        _createDraggableItem: function () {
          return _a.eq("dragifierMode", "i") ? new D() : new F();
        },
        _isAlreadyDraggable: function (a) {
          for (var b = 0; b < this._items.length; b++)
            if (db.get(this._items[b].get()) == db.get(a)) return !0;
          return !1;
        },
        _findAlreadyDraggable: function (a) {
          for (var b = 0; b < this._items.length; b++)
            if (db.get(this._items[b].get()) == db.get(a))
              return this._items[b];
          e("Drag.item NF.");
        },
        _findDraggableById: function (a, b) {
          for (var b = b || !1, c = 0; c < this._items.length; c++)
            if (this._items[c].hasDragId(a))
              return b
                ? { item: this._items[c], itemIndex: c }
                : this._items[c];
        },
        render: function (a, b, c) {
          this._coordsChanger(a, b, c, Y);
        },
      }),
      (C = function () {
        (this._itemCenterCursorOffset = { x: null, y: null }),
          (this._gridOffset = { left: null, top: null }),
          (this._repositionTimeout = null);
      }),
      c(C, {
        calcGridOffsets: function () {
          (this._gridOffset.left = Xa.offsetLeft(Za.get())),
            (this._gridOffset.top = Xa.offsetTop(Za.get()));
        },
        _getOffset: function (a, b, c, d, e, f, g) {
          var b = b || !1,
            h = sb.find(a);
          if (_a.eq("intersections", !1) && _a.eq("grid", c))
            var i = h[d + "Offset"];
          else var i = 0;
          if (!b) return this._gridOffset[e] + h[g] + i;
          var j = Xa["outer" + f](a),
            k = Xa["outer" + f](a, !0),
            l = k - j,
            m = l / 2;
          return this._gridOffset[e] + h[g] - m + i;
        },
        _getOffsetLeft: function (a, b) {
          return this._getOffset(
            a,
            b,
            "horizontal",
            "h",
            "left",
            "Width",
            "x1"
          );
        },
        _getOffsetTop: function (a, b) {
          return this._getOffset(a, b, "vertical", "v", "top", "Height", "y1");
        },
        findItemCenterCursorOffsets: function (a, b, c) {
          var d = this._getOffsetLeft(a) + Xa.outerWidth(a, !0) / 2,
            e = this._getOffsetTop(a) + Xa.outerHeight(a, !0) / 2;
          this._itemCenterCursorOffset = { x: d - b, y: e - c };
        },
        createClone: function (a) {
          var b = a.cloneNode(!0),
            c = {
              left: this._getOffsetLeft(a),
              top: this._getOffsetTop(a),
            };
          return (
            cb.markAsNotCollectable(b),
            _a.getApi("drag")(b, a, Xa),
            Y.hasTransitions() &&
              (Y.css3.transform(b, ""), Y.css3.transition(b, "none")),
            Y.css.set(b, {
              width: Xa.outerWidth(a) + "px",
              height: Xa.outerHeight(a) + "px",
              zIndex: H.MAX_Z,
              left: c.left + "px",
              top: c.top + "px",
            }),
            Y.css.set4(b, "margin", Z.getComputedCSS(a)),
            document.body.appendChild(b),
            Xb.render(b, c.left, c.top),
            b
          );
        },
        createPointer: function (a) {
          var b = {
              left: this._getOffsetLeft(a, !0),
              top: this._getOffsetTop(a, !0),
            },
            c = Y.div();
          Y.css.set(c, {
            width: Xa.outerWidth(a, !0) + "px",
            height: Xa.outerHeight(a, !0) + "px",
            position: "absolute",
            left: b.left - this._gridOffset.left + "px",
            top: b.top - this._gridOffset.top + "px",
          });
          var d = Z.getComputedCSS(a);
          Za.get().appendChild(c), Tb.getPointerStyler()(c, Y);
          var e = parseFloat(d.marginLeft),
            f = parseFloat(d.marginTop);
          return (
            Xb.render(
              c,
              b.left - this._gridOffset.left + (isNaN(e) ? 0 : e),
              b.top - this._gridOffset.top + (isNaN(f) ? 0 : f)
            ),
            c
          );
        },
        calcCloneNewDocPosition: function (a, b, c) {
          return {
            x:
              b -
              Xa.outerWidth(a, !0) / 2 -
              -1 * this._itemCenterCursorOffset.x,
            y:
              c -
              Xa.outerHeight(a, !0) / 2 -
              -1 * this._itemCenterCursorOffset.y,
          };
        },
        calcCloneNewGridPosition: function (a, b) {
          return {
            x1: b.x - this._gridOffset.left,
            x2: b.x + Xa.outerWidth(a, !0) - 1 - this._gridOffset.left,
            y1: b.y - this._gridOffset.top,
            y2: b.y + Xa.outerHeight(a, !0) - 1 - this._gridOffset.top,
          };
        },
        hasDragId: function (a, b) {
          for (var c = 0; c < b.length; c++) if (b[c] == a) return !0;
          return !1;
        },
        rmDragId: function (a, b) {
          for (var c = 0; c < b.length; c++)
            if (b[c] == a) {
              b.splice(c, 1);
              break;
            }
        },
        initItem: function (a) {
          Y.hasTransitions() &&
            Y.css3.transitionProperty(a, "Visibility 0ms ease");
        },
        hideItem: function (a) {
          (a.style.visibility = "hidden"), Y.set(a, H.IS_DRAGGABLE_DATA, "y");
        },
        showItem: function (a) {
          (a.style.visibility = "visible"), Y.rm(a, H.IS_DRAGGABLE_DATA);
        },
        repositionItems: function () {
          if (_a.eq("append", "default"))
            var a = function () {
              Cb.createInitialCr();
            };
          else
            var a = function () {
              Eb.createInitialCr();
            };
          ib.setNextFlushCb(a),
            $a.onRepositionEndForDrag(function () {
              for (
                var a = vb.sortForReappend(rb.get()), b = [], c = 0;
                c < a.length;
                c++
              )
                b.push(a[c].item);
              $a.emit(P.DRAG_END, b);
            }),
            this._reposition();
        },
        _reposition: function () {
          return Y.browsers.isAndroidFirefox() || Y.browsers.isAndroidUC()
            ? (clearTimeout(this._repositionTimeout),
              void (this._repositionTimeout = setTimeout(function () {
                Jb.all();
              }, H.DRAGIFIER_REPOS_DELAY)))
            : void Jb.all();
        },
      }),
      (D = function () {
        (this._dragIds = []), (this._item = null), (this._clone = null);
      }),
      c(D, {
        get: function () {
          return this._item;
        },
        addDragId: function (a) {
          this._dragIds.push(a);
        },
        hasDragId: function (a) {
          return Vb.hasDragId(a, this._dragIds);
        },
        rmDragId: function (a) {
          Vb.rmDragId(a, this._dragIds);
        },
        getDragIdsCount: function () {
          return this._dragIds.length;
        },
        bind: function (a, b, c) {
          (this._item = a),
            Vb.initItem(a),
            Vb.calcGridOffsets(),
            Vb.findItemCenterCursorOffsets(a, b, c),
            (this._clone = Vb.createClone(a)),
            Vb.hideItem(a);
        },
        unbind: function () {
          document.body.removeChild(this._clone),
            Vb.showItem(this._item),
            (this._item = null);
        },
        dragMove: function (a, b) {
          var c = Vb.calcCloneNewDocPosition(this._item, a, b),
            d = Vb.calcCloneNewGridPosition(this._item, c);
          Xb.render(this._clone, c.x, c.y);
          var e = this._getNewIntCns(d);
          0 != e.length &&
            (_a.eq("sortDispersion", !1)
              ? (this._swapGUIDS(e), Vb.repositionItems())
              : this._swapPositions(e) && Vb.repositionItems());
        },
        _getNewIntCns: function (a) {
          for (
            var b = db.get(this._item),
              c = tb.getAllWithIntersectedCenter(a),
              d = [],
              e = 0;
            e < c.length;
            e++
          )
            c[e].itemGUID != b && d.push(c[e]);
          return d;
        },
        _swapGUIDS: function (a) {
          for (var b = db.get(this._item), c = a[0], d = 0; d < a.length; d++)
            a[d].itemGUID < c.itemGUID && (c = a[d]);
          db.set(this._item, c.itemGUID),
            db.set(this._clone, c.itemGUID),
            db.set(c.item, b);
        },
        _swapPositions: function (a) {
          var b = sb.find(this._item, !0);
          if (null == b) return !1;
          a = vb.sortForReappend(a);
          var c = a[0],
            d = db.get(c.item),
            e = db.get(this._item);
          return (
            db.set(this._item, d),
            db.set(c.item, e),
            this._swapCnData(b, c, d),
            !0
          );
        },
        _swapCnData: function (a, b, c) {
          var d = a.item;
          (a.item = b.item), (b.item = d);
          var e = a.itemGUID;
          (a.itemGUID = c), (b.itemGUID = e);
        },
      }),
      (E = function () {}),
      c(E, {
        getIntCellsData: function (a) {
          return (
            0 == a["int"].cols &&
              0 == a["int"].rows &&
              ((a["int"].cols = 1), (a["int"].rows = 1)),
            a
          );
        },
        isAnyIntCellEmpty: function (a) {
          for (var b = a.intCells, c = !1, d = 0; d < b.length; d++)
            for (var e = 0; e < b[d].length; e++) b[d][e].isInt || (c = !0);
          return c;
        },
        isIntEnoughRowsAndCols: function (a, b) {
          return b["int"].rows < a["int"].rows || b["int"].cols < a["int"].cols
            ? !1
            : !0;
        },
        normalizeOverflowedCells: function (a, b, c) {
          if (c["int"].rows > b["int"].rows)
            for (var d = c["int"].rows - b["int"].rows, e = 0; d > e; e++)
              a.pop();
          if (c["int"].cols > b["int"].cols)
            for (
              var f = c["int"].cols - b["int"].cols, g = 0;
              g < a.length;
              g++
            )
              for (var e = 0; f > e; e++) a[g].pop();
          for (var h = [], g = 0; g < a.length; g++)
            for (var i = 0; i < a[g].length; i++) h.push(a[g][i]);
          return h;
        },
      }),
      (F = function () {
        (this._dragIds = []),
          (this._item = null),
          (this._itemCn = null),
          (this._clone = null),
          (this._pointer = null),
          (this._discretizer = new y());
      }),
      c(F, {
        get: function () {
          return this._item;
        },
        addDragId: function (a) {
          this._dragIds.push(a);
        },
        hasDragId: function (a) {
          return Vb.hasDragId(a, this._dragIds);
        },
        rmDragId: function (a) {
          Vb.rmDragId(a, this._dragIds);
        },
        getDragIdsCount: function () {
          return this._dragIds.length;
        },
        bind: function (a, b, c) {
          (this._item = a),
            Vb.initItem(a),
            this._initCn(),
            Vb.calcGridOffsets(),
            Vb.findItemCenterCursorOffsets(a, b, c),
            (this._clone = Vb.createClone(a)),
            (this._pointer = Vb.createPointer(a)),
            this._discretizer.discretize(),
            this._discretizer.markIntCellsBy(this._itemCn),
            Vb.hideItem(a);
        },
        _initCn: function () {
          (this._itemCn = sb.find(this._item)),
            (this._itemCn.restrictCollect = !0);
        },
        unbind: function () {
          document.body.removeChild(this._clone),
            Za.get().removeChild(this._pointer),
            Vb.showItem(this._item),
            (this._item = null),
            (this._itemCn.restrictCollect = !1);
        },
        dragMove: function (a, b) {
          var c = Vb.calcCloneNewDocPosition(this._item, a, b),
            d = Vb.calcCloneNewGridPosition(this._item, c);
          Xb.render(this._clone, c.x, c.y);
          var e = Wb.getIntCellsData(
              this._discretizer.getAllCellsWithIntCenter(this._itemCn)
            ),
            f = this._discretizer.getAllCellsWithIntCenter(d);
          Wb.isAnyIntCellEmpty(f) &&
            Wb.isIntEnoughRowsAndCols(e, f) &&
            this._repositionGrid(Wb.normalizeOverflowedCells(f.intCells, e, f));
        },
        _repositionGrid: function (a) {
          var b = this._discretizer.intCellsToCoords(a);
          (b = Ub.normalizeCnXCoords(this._item, b)),
            (b = Ub.normalizeCnYCoords(this._item, b)),
            this._adjustPosition(b),
            this._discretizer.markIntCellsBy(b),
            setTimeout(function () {
              Vb.repositionItems();
            }, H.DRAGIFIER_DISCR_REPOS_DELAY);
        },
        _adjustPosition: function (a) {
          for (var b = ["x1", "x2", "y1", "y2"], c = 0; c < b.length; c++)
            this._itemCn[b[c]] = a[b[c]];
          var d = g("get", _a);
          _a.getApi("coordsChanger")(
            this._item,
            a.x1 + "px",
            a.y1 + "px",
            d("coordsChangeTime"),
            d("coordsChangeTiming"),
            Y,
            X,
            d
          ),
            Xb.render(this._pointer, a.x1, a.y1);
        },
      });
    var za = function () {
      this._position = new xa(
        this,
        L.APPEND,
        function (a) {
          a.create(K.APPEND.DEF, K.RIGHT.TOP, 0, 0);
        },
        function (a, b) {
          a.y2 + 1 <= Za.y2() &&
            ib.create(
              K.APPEND.DEF,
              K.BOTTOM.LEFT,
              parseFloat(a.x1),
              parseFloat(a.y2 + 1),
              Y["int"](b)
            ),
            ib.create(
              K.APPEND.DEF,
              K.RIGHT.TOP,
              parseFloat(a.x2 + 1),
              parseFloat(a.y1),
              Y["int"](b)
            );
        },
        function (a) {
          return a.y2 > fb.fixHighRounding(Za.y2());
        }
      );
    };
    c(za, {
      position: function (a) {
        var b = this._position;
        b.initCrs("Right", "Left", "Right");
        var c = b.filterCrs("Prepended", K.RIGHT.TOP, "Right", "Top", "Append"),
          d = b.createCn(
            a,
            b.findCnCoords(a, c, "HgAppend", "BehindX", "x2", "Smaller", "X"),
            c
          );
        rb.attachToRanges(d),
          b.cleanCrs("Right", "Left", "Right"),
          b.render(a, d);
      },
    });
    var Aa = function () {
      this._cns = [];
    };
    c(Aa, {
      reinitRanges: function () {
        ub.init("x1", "x2");
      },
      attachToRanges: function (a) {
        ub.attachCn(a, rb.get().length - 1, "x1", "x2");
      },
      mapAllIntAndLeftCns: function (a) {
        var b = ub;
        return ub.mapAllIntAndSideCns(
          a,
          "x",
          "x1",
          "x2",
          b.lastRngIndexFn(),
          b.lastRngIndexFn(),
          b.lowerCrCnIndexesFn(),
          b.decFn()
        );
      },
      mapAllIntAndRightCns: function (a) {
        var b = ub;
        return ub.mapAllIntAndSideCns(
          a,
          "x",
          "x1",
          "x2",
          b.firstRngIndexFn(),
          b.lastRngIndexFn(),
          b.upperCrCnIndexesFn(),
          b.incFn()
        );
      },
      getAllIntYCns: function (a) {
        return ub.getAllCnsFromIntRange(a.x, "x1", "x2");
      },
      getAllIntYAndLeftCns: function (a) {
        return ub.getAllCnsFromIntAndTLSideRgs(a.x, "x1", "x2");
      },
      getAllIntYAndRightCns: function (a) {
        return ub.getAllCnsFromIntAndRBSideRgs(a.x, "x1", "x2");
      },
      getLastColXExpandedCns: function () {
        return wb.getLastXYExpandedCns();
      },
      isIntMoreThanOneCnX: function (a) {
        return wb.isIntMoreThanOneCnXY(a, "x1", "x2");
      },
      getMostWideFromAllXIntCns: function (a) {
        return wb.getMostBigFromAllXYIntCns(a, "x1", "x2");
      },
      getAllXIntCns: function (a) {
        return wb.getAllXYIntCns(a, "x1", "x2");
      },
      expandXAllColCnsToMostWide: function (a) {
        return wb.expandXYAllCnsToMostBig(a, "x1", "x2", "hOffset", "Width");
      },
      get: function () {
        return this._cns;
      },
      count: function () {
        return this._cns.length;
      },
      restore: function (a) {
        this._cns = this._cns.concat(a);
      },
      add: function (a, b) {
        var c = sb.create(a, b);
        return this._cns.push(c), $a.emit(P.REPOSITION, c.item, c, this), c;
      },
      rm: function (a) {
        sb.rm(this._cns, a);
      },
      restoreOnSortDispersion: function (a) {
        sb.restoreOnSortDispersion(
          a,
          function (a, b, c) {
            for (var d = b.y2 + 1, e = 0; e < a.length; e++) c(a[e], b.x1, d++);
          },
          function (a, b, c) {
            for (var d = b.y1 - 1, e = 0; e < a.length; e++) c(a[e], b.x1, d--);
          }
        ),
          this.restore(a);
      },
      getAllBehindX: function (a) {
        return sb.getAllBACoord(a, function (a, b) {
          return a.x1 > b;
        });
      },
      getAllBeforeX: function (a) {
        return sb.getAllBACoord(a, function (a, b) {
          return a.x2 < b;
        });
      },
      fixAllXPosAfterPrepend: function (a, b) {
        return sb.fixAllXYPosAfterPrepend(a, b, "x", "x1", "x2");
      },
    });
    var Ba = function () {};
    c(Ba, {
      find: function (a, b, c) {
        var d = Xa.itemSizes(b),
          e = parseFloat;
        return a == L.APPEND
          ? {
              x1: e(c.x),
              x2: e(c.x + d.width - 1),
              y1: e(c.y),
              y2: e(c.y + d.height - 1),
            }
          : a == L.REV_APPEND
          ? {
              x1: e(c.x),
              x2: e(c.x + d.width - 1),
              y1: e(c.y - d.height + 1),
              y2: e(c.y),
            }
          : a == L.PREPEND
          ? {
              x1: e(c.x - d.width + 1),
              x2: e(c.x),
              y1: e(c.y - d.height + 1),
              y2: e(c.y),
            }
          : a == L.REV_PREPEND
          ? {
              x1: e(c.x - d.width + 1),
              x2: e(c.x),
              y1: e(c.y),
              y2: e(c.y + d.height - 1),
            }
          : void 0;
      },
    });
    var Ca = function () {
      this._position = new xa(
        this,
        L.PREPEND,
        function (a, b) {
          a.create(K.PREPEND.DEF, K.TOP.RIGHT, 0, b.y2());
        },
        function (a, b) {
          a.y1 - 1 >= 0 &&
            ib.create(
              K.PREPEND.DEF,
              K.TOP.RIGHT,
              parseFloat(a.x2),
              parseFloat(a.y1 - 1),
              Y["int"](b)
            ),
            ib.create(
              K.PREPEND.DEF,
              K.LEFT.BOTTOM,
              parseFloat(a.x1 - 1),
              parseFloat(a.y2),
              Y["int"](b)
            );
        },
        function (a) {
          return a.y1 < fb.fixLowRounding(0);
        }
      );
    };
    c(Ca, {
      position: function (a) {
        var b = this._position;
        b.initCrs("Left", "Right", "Left");
        var c = b.filterCrs(
            "Appended",
            K.LEFT.BOTTOM,
            "Left",
            "Bottom",
            "Prepend"
          ),
          d = b.createCn(
            a,
            b.findCnCoords(a, c, "HgPrepend", "BeforeX", "x1", "Bigger", "X"),
            c
          );
        db.markIfFirstPrepended(a);
        var e = b.fixAllXYPosAfterPrepend(d, ib.get());
        rb.attachToRanges(d),
          b.cleanCrs("Left", "Right", "Left"),
          e && b.renderAfterPrependFix(d),
          b.render(a, d);
      },
    });
    var Da = function () {
      this._position = new xa(
        this,
        L.REV_APPEND,
        function (a, b) {
          a.create(K.APPEND.REV, K.TOP.LEFT, 0, parseFloat(b.y2()));
        },
        function (a, b) {
          a.y1 - 1 >= 0 &&
            ib.create(
              K.APPEND.REV,
              K.TOP.LEFT,
              parseFloat(a.x1),
              parseFloat(a.y1 - 1),
              Y["int"](b)
            ),
            ib.create(
              K.APPEND.REV,
              K.RIGHT.BOTTOM,
              parseFloat(a.x2 + 1),
              parseFloat(a.y2),
              Y["int"](b)
            );
        },
        function (a) {
          return a.y1 < fb.fixLowRounding(0);
        }
      );
    };
    c(Da, {
      position: function (a) {
        var b = this._position;
        b.initCrs("Right", "Left", "Right");
        var c = b.filterCrs(
            "Prepended",
            K.RIGHT.BOTTOM,
            "Right",
            "Bottom",
            "Append"
          ),
          d = b.createCn(
            a,
            b.findCnCoords(a, c, "HgAppend", "BehindX", "x2", "Smaller", "X"),
            c
          );
        rb.attachToRanges(d),
          b.cleanCrs("Right", "Left", "Right"),
          b.render(a, d);
      },
    });
    var Ea = function () {
      this._position = new xa(
        this,
        L.REV_PREPEND,
        function (a, b) {
          a.create(K.PREPEND.REV, K.LEFT.TOP, 0, 0);
        },
        function (a, b) {
          a.y2 + 1 <= Za.y2() &&
            ib.create(
              K.PREPEND.REV,
              K.BOTTOM.RIGHT,
              parseFloat(a.x2),
              parseFloat(a.y2 + 1),
              Y["int"](b)
            ),
            ib.create(
              K.PREPEND.REV,
              K.LEFT.TOP,
              parseFloat(a.x1 - 1),
              parseFloat(a.y1),
              Y["int"](b)
            );
        },
        function (a) {
          return a.y2 > fb.fixHighRounding(Za.y2());
        }
      );
    };
    c(Ea, {
      position: function (a) {
        var b = this._position;
        b.initCrs("Left", "Right", "Left");
        var c = b.filterCrs("Appended", K.LEFT.TOP, "Left", "Top", "Prepend"),
          d = b.createCn(
            a,
            b.findCnCoords(a, c, "HgPrepend", "BeforeX", "x1", "Bigger", "X"),
            c
          );
        db.markIfFirstPrepended(a);
        var e = b.fixAllXYPosAfterPrepend(d, ib.get());
        rb.attachToRanges(d),
          b.cleanCrs("Left", "Right", "Left"),
          e && b.renderAfterPrependFix(d),
          b.render(a, d);
      },
    });
    var Fa = function () {
      this._position = new xa(
        this,
        L.APPEND,
        function (a) {
          a.create(K.APPEND.DEF, K.RIGHT.TOP, 0, 0);
        },
        function (a, b) {
          a.x2 + 1 <= Za.x2() &&
            ib.create(
              K.APPEND.DEF,
              K.RIGHT.TOP,
              parseFloat(a.x2 + 1),
              parseFloat(a.y1),
              Y["int"](b)
            ),
            ib.create(
              K.APPEND.DEF,
              K.BOTTOM.LEFT,
              parseFloat(a.x1),
              parseFloat(a.y2 + 1),
              Y["int"](b)
            );
        },
        function (a) {
          return a.x2 > fb.fixHighRounding(Za.x2());
        }
      );
    };
    c(Fa, {
      position: function (a) {
        var b = this._position;
        b.initCrs("Bottom", "Top", "Bottom");
        var c = b.filterCrs(
            "Prepended",
            K.BOTTOM.LEFT,
            "Bottom",
            "Left",
            "Append"
          ),
          d = b.createCn(
            a,
            b.findCnCoords(a, c, "VgAppend", "BelowY", "y2", "Smaller", "Y"),
            c
          );
        rb.attachToRanges(d),
          b.cleanCrs("Bottom", "Top", "Bottom"),
          b.render(a, d);
      },
    });
    var Ga = function () {
      this._cns = [];
    };
    c(Ga, {
      reinitRanges: function () {
        ub.init("y1", "y2");
      },
      attachToRanges: function (a) {
        ub.attachCn(a, rb.get().length - 1, "y1", "y2");
      },
      mapAllIntAndTopCns: function (a) {
        var b = ub;
        return ub.mapAllIntAndSideCns(
          a,
          "y",
          "y1",
          "y2",
          b.lastRngIndexFn(),
          b.lastRngIndexFn(),
          b.lowerCrCnIndexesFn(),
          b.decFn()
        );
      },
      mapAllIntAndBottomCns: function (a) {
        var b = ub;
        return ub.mapAllIntAndSideCns(
          a,
          "y",
          "y1",
          "y2",
          b.firstRngIndexFn(),
          b.lastRngIndexFn(),
          b.upperCrCnIndexesFn(),
          b.incFn()
        );
      },
      getAllIntXCns: function (a) {
        return ub.getAllCnsFromIntRange(a.y, "y1", "y2");
      },
      getAllIntXAndTopCns: function (a) {
        return ub.getAllCnsFromIntAndTLSideRgs(a.y, "y1", "y2");
      },
      getAllIntXAndBottomCns: function (a) {
        return ub.getAllCnsFromIntAndRBSideRgs(a.y, "y1", "y2");
      },
      getLastRowYExpandedCns: function () {
        return wb.getLastXYExpandedCns();
      },
      isIntMoreThanOneCnY: function (a) {
        return wb.isIntMoreThanOneCnXY(a, "y1", "y2");
      },
      getMostTallFromAllYIntCns: function (a) {
        return wb.getMostBigFromAllXYIntCns(a, "y1", "y2");
      },
      getAllYIntCns: function (a) {
        return wb.getAllXYIntCns(a, "y1", "y2");
      },
      expandYAllRowCnsToMostTall: function (a) {
        return wb.expandXYAllCnsToMostBig(a, "y1", "y2", "vOffset", "Height");
      },
      get: function () {
        return this._cns;
      },
      count: function () {
        return this._cns.length;
      },
      restore: function (a) {
        this._cns = this._cns.concat(a);
      },
      add: function (a, b) {
        var c = sb.create(a, b);
        return this._cns.push(c), $a.emit(P.REPOSITION, c.item, c, this), c;
      },
      rm: function (a) {
        sb.rm(this._cns, a);
      },
      restoreOnSortDispersion: function (a) {
        sb.restoreOnSortDispersion(
          a,
          function (a, b, c) {
            for (var d = b.x2 + 1, e = 0; e < a.length; e++) c(a[e], d++, b.y1);
          },
          function (a, b, c) {
            for (var d = b.x1 - 1, e = 0; e < a.length; e++) c(a[e], d--, b.y1);
          }
        ),
          this.restore(a);
      },
      getAllBelowY: function (a) {
        return sb.getAllBACoord(a, function (a, b) {
          return a.y1 > b;
        });
      },
      getAllAboveY: function (a) {
        return sb.getAllBACoord(a, function (a, b) {
          return a.y2 < b;
        });
      },
      fixAllYPosAfterPrepend: function (a, b) {
        return sb.fixAllXYPosAfterPrepend(a, b, "y", "y1", "y2");
      },
    });
    var Ha = function () {};
    c(Ha, {
      find: function (a, b, c) {
        var d = Xa.itemSizes(b),
          e = parseFloat;
        return a == L.APPEND
          ? {
              x1: e(c.x),
              x2: e(c.x + d.width - 1),
              y1: e(c.y),
              y2: e(c.y + d.height - 1),
            }
          : a == L.REV_APPEND
          ? {
              x1: e(c.x - d.width + 1),
              x2: e(c.x),
              y1: e(c.y),
              y2: e(c.y + d.height - 1),
            }
          : a == L.PREPEND
          ? {
              x1: e(c.x),
              x2: e(c.x + d.width - 1),
              y1: e(c.y - d.height + 1),
              y2: e(c.y),
            }
          : a == L.REV_PREPEND
          ? {
              x1: e(c.x - d.width + 1),
              x2: e(c.x),
              y1: e(c.y - d.height + 1),
              y2: e(c.y),
            }
          : void 0;
      },
    });
    var Ia = function () {
      this._position = new xa(
        this,
        L.PREPEND,
        function (a) {
          a.create(K.PREPEND.DEF, K.RIGHT.BOTTOM, 0, 0);
        },
        function (a, b) {
          a.x2 + 1 <= Za.x2() &&
            ib.create(
              K.PREPEND.DEF,
              K.RIGHT.BOTTOM,
              parseFloat(a.x2 + 1),
              parseFloat(a.y2),
              Y["int"](b)
            ),
            ib.create(
              K.PREPEND.DEF,
              K.TOP.LEFT,
              parseFloat(a.x1),
              parseFloat(a.y1 - 1),
              Y["int"](b)
            );
        },
        function (a) {
          return a.x2 > fb.fixHighRounding(Za.x2());
        }
      );
    };
    c(Ia, {
      position: function (a) {
        var b = this._position;
        b.initCrs("Top", "Bottom", "Top");
        var c = b.filterCrs("Appended", K.TOP.LEFT, "Top", "Left", "Prepend"),
          d = b.createCn(
            a,
            b.findCnCoords(a, c, "VgPrepend", "AboveY", "y1", "Bigger", "Y"),
            c
          );
        db.markIfFirstPrepended(a);
        var e = b.fixAllXYPosAfterPrepend(d, ib.get());
        rb.attachToRanges(d),
          b.cleanCrs("Top", "Bottom", "Top"),
          e && b.renderAfterPrependFix(d),
          b.render(a, d);
      },
    });
    var Ja = function () {
      this._position = new xa(
        this,
        L.REV_APPEND,
        function (a, b) {
          a.create(K.APPEND.REV, K.LEFT.TOP, parseFloat(b.x2()), 0);
        },
        function (a, b) {
          a.x1 - 1 >= 0 &&
            ib.create(
              K.APPEND.REV,
              K.LEFT.TOP,
              parseFloat(a.x1 - 1),
              parseFloat(a.y1),
              Y["int"](b)
            ),
            ib.create(
              K.APPEND.REV,
              K.BOTTOM.RIGHT,
              parseFloat(a.x2),
              parseFloat(a.y2 + 1),
              Y["int"](b)
            );
        },
        function (a) {
          return a.x1 < fb.fixLowRounding(0);
        }
      );
    };
    c(Ja, {
      position: function (a) {
        var b = this._position;
        b.initCrs("Bottom", "Top", "Bottom");
        var c = b.filterCrs(
            "Prepended",
            K.BOTTOM.RIGHT,
            "Bottom",
            "Right",
            "Append"
          ),
          d = b.createCn(
            a,
            b.findCnCoords(a, c, "VgAppend", "BelowY", "y2", "Smaller", "Y"),
            c
          );
        rb.attachToRanges(d),
          b.cleanCrs("Bottom", "Top", "Bottom"),
          b.render(a, d);
      },
    });
    var Ka = function () {
      this._position = new xa(
        this,
        L.REV_PREPEND,
        function (a, b) {
          a.create(K.PREPEND.REV, K.LEFT.BOTTOM, b.x2(), 0);
        },
        function (a, b) {
          a.x1 - 1 >= 0 &&
            ib.create(
              K.PREPEND.REV,
              K.LEFT.BOTTOM,
              parseFloat(a.x1 - 1),
              parseFloat(a.y2),
              Y["int"](b)
            ),
            ib.create(
              K.PREPEND.REV,
              K.TOP.RIGHT,
              parseFloat(a.x2),
              parseFloat(a.y1 - 1),
              Y["int"](b)
            );
        },
        function (a) {
          return a.x1 < fb.fixLowRounding(0);
        }
      );
    };
    c(Ka, {
      position: function (a) {
        var b = this._position;
        b.initCrs("Top", "Bottom", "Top");
        var c = b.filterCrs("Appended", K.TOP.RIGHT, "Top", "Right", "Prepend"),
          d = b.createCn(
            a,
            b.findCnCoords(a, c, "VgPrepend", "AboveY", "y1", "Bigger", "Y"),
            c
          );
        db.markIfFirstPrepended(a);
        var e = b.fixAllXYPosAfterPrepend(d, ib.get());
        rb.attachToRanges(d),
          b.cleanCrs("Top", "Bottom", "Top"),
          e && b.renderAfterPrependFix(d),
          b.render(a, d);
      },
    });
    var La = function () {
      (this._grid = null),
        (this._markingFn = null),
        (this._resizeTimeout = null),
        this._createMarkingFn(),
        this._toNative(a),
        this._adjustCSS(),
        d(this, {
          grid: this.get,
          gridWidth: this.width,
          gridHeight: this.height,
        });
    };
    c(La, {
      _createMarkingFn: function () {
        this._markingFn = function (a) {
          _a.notEq("class", !1)
            ? Y.css.hasClass(a, _a.get("class")) ||
              Y.css.addClass(a, _a.get("class"))
            : _a.notEq("data", !1) && Y.set(a, _a.get("data"), "gi");
        };
      },
      _toNative: function (a) {
        Y.isJquery(a)
          ? (this._grid = a.get(0))
          : Y.isNative(a)
          ? (this._grid = a)
          : Y.isArray(a) && Y.isNative(a[0])
          ? (this._grid = a[0])
          : e(O.GRID_NOT_NATIVE);
      },
      _adjustCSS: function () {
        var a = Z.getComputedCSS(this._grid);
        "relative" != a.position &&
          "absolute" != a.position &&
          Y.css.set(this._grid, { position: "relative" });
      },
      get: function () {
        return this._grid;
      },
      x2: function () {
        return Xa.outerWidth(this._grid, !1, !0) - 1;
      },
      y2: function () {
        return Xa.outerHeight(this._grid, !1, !0) - 1;
      },
      width: function () {
        return Math.round(this.x2() + 1);
      },
      height: function () {
        return Math.round(this.y2() + 1);
      },
      mark: function (a) {
        for (var a = Ya.toNative(a), b = 0; b < a.length; b++)
          this._markingFn(a[b]);
        return a;
      },
      add: function (a) {
        for (var a = this.mark(a), b = 0; b < a.length; b++)
          Y.isChildOf(a[b], this._grid) || this._grid.appendChild(a[b]);
      },
      ensureCanFit: function (a) {
        for (
          var b = this,
            c = function (a, c) {
              var d = Math.round(Xa["outer" + c](a, !0)),
                f = Math.round(Xa["outer" + c](b._grid, !1, !0));
              d > f &&
                e("Item " + c + "(" + d + "px) > Grid " + c + "(" + f + "px).");
            },
            d = 0;
          d < a.length;
          d++
        )
          c(a[d], _a.eq("grid", "vertical") ? "Width" : "Height");
      },
      scheduleResize: function () {
        var a = this;
        clearTimeout(this._resizeTimeout),
          (this._resizeTimeout = setTimeout(function () {
            return Kb.isEmpty()
              ? void (_a.eq("grid", "vertical")
                  ? a._resize.call(a, "y2", "height", function () {
                      return a.y2();
                    })
                  : a._resize.call(a, "x2", "width", function () {
                      return a.x2();
                    }))
              : void a.scheduleResize();
          }, _a.get("gridResizeDelay")));
      },
      _resize: function (a, b, c) {
        var d = rb.get();
        if (0 != d.length) {
          for (var e = d[0][a], f = 1; f < d.length; f++)
            d[f][a] > e && (e = d[f][a]);
          var g = {};
          (g[b] = e + 1 + "px"),
            (_a.eq("gridResize", "fit") ||
              (_a.eq("gridResize", "expand") && c() < e)) &&
              Y.css.set(this._grid, g),
            $a.emit(P.GRID_RESIZE, this._grid);
        }
      },
    }),
      (l = function () {
        (this._batches = []), (this._loaded = []);
      }),
      c(l, {
        schedule: function (a, b, c) {
          if (0 == a.length)
            return (
              this._batches.push({ items: a, images: [], op: b, data: c }),
              void this._checkLoad()
            );
          var d = this._findImages(a);
          if (
            (this._batches.push({ items: a, images: d, op: b, data: c }),
            0 == d.length)
          )
            return void this._checkLoad();
          for (var e = 0; e < d.length; e++) d[e].scheduleLoad();
        },
        _findImages: function (a) {
          for (var b = [], c = 0; c < a.length; c++)
            if ("IMG" != a[c].nodeName) {
              if (this._isValidNode(a[c]))
                for (
                  var d = a[c].querySelectorAll("img"), e = 0;
                  e < d.length;
                  e++
                )
                  this._isAlreadyLoaded(d[e]) || b.push(new m(d[e]));
            } else this._isAlreadyLoaded(a[c]) || b.push(new m(a[c]));
          return b;
        },
        _isAlreadyLoaded: function (a) {
          for (var b = 0; b < this._loaded.length; b++)
            if (this._loaded[b] === a.src) return !0;
          return 0 == a.src.length;
        },
        _isValidNode: function (a) {
          return (
            a.nodeType &&
            (1 == a.nodeType || 9 == a.nodeType || 11 == a.nodeType)
          );
        },
        onLoad: function (a) {
          this._loaded.push(a.src), this._checkLoad();
        },
        _checkLoad: function () {
          for (var a = 0; a < this._batches.length; a++) {
            for (
              var b = !0, c = this._batches[a].images, d = 0;
              d < c.length;
              d++
            )
              if (!c[d].isLoaded()) {
                b = !1;
                break;
              }
            if (!b) break;
            for (var d = 0; d < c.length; d++) c[d].destroy();
            (this._batches[a].images = []),
              this._callOp(
                this._batches[a].items,
                this._batches[a].op,
                this._batches[a].data
              ),
              this._batches.splice(a, 1),
              a--;
          }
        },
        _callOp: function (a, b, c) {
          var d = c.batchSize,
            f = c.batchDelay;
          b == L.APPEND || b == L.PREPEND
            ? ab.exec(b, a, d, f)
            : b == L.SIL_APPEND
            ? ab.execSilentAppend(a, d, f)
            : b == L.INS_BEFORE
            ? ab.exec(b, a, d, f, c.beforeItem)
            : b == L.INS_AFTER
            ? ab.exec(b, a, d, f, c.afterItem)
            : e("Wrong op.");
        },
      }),
      (m = function (a) {
        (this._image = a),
          (this._loadedImage = null),
          (this._isLoaded = !1),
          (this._onLoad = null),
          (this._onError = null);
      }),
      c(m, {
        _bindEvents: function () {
          var a = this;
          (a._onLoad = function () {
            a._load.call(a);
          }),
            (a._onError = function () {
              a._error.call(a);
            }),
            W.add(a._loadedImage, "load", a._onLoad),
            W.add(a._loadedImage, "error", a._onError);
        },
        _unbindEvents: function () {
          var a = this;
          null != a._onLoad && W.rm(a._loadedImage, "load", a._onLoad),
            null != a._onError && W.rm(a._loadedImage, "error", a._onError);
        },
        destroy: function () {
          this._unbindEvents();
        },
        scheduleLoad: function () {
          return this._isAlreadyLoaded()
            ? ((this._isLoaded = !0), void hb.onLoad(this._image))
            : ((this._loadedImage = this._loader()),
              this._bindEvents(),
              void (this._loadedImage.src = this._image.src));
        },
        _loader: function () {
          return new Image();
        },
        isLoaded: function () {
          return this._isLoaded;
        },
        _isAlreadyLoaded: function () {
          return (
            this._image.complete &&
            void 0 !== this._image.naturalWidth &&
            0 !== this._image.naturalWidth
          );
        },
        _load: function () {
          (this._isLoaded = !0), hb.onLoad(this._image);
        },
        _error: function () {
          (this._isLoaded = !0), hb.onLoad(this._image);
        },
      });
    var Ma = function () {};
    c(Ma, {
      exec: function (a) {
        var b = this;
        Pb.exec(a, function (a) {
          b._append.call(b, a);
        });
      },
      _append: function (a) {
        db.markForAppend(a),
          _a.eq("append", "default") ? Cb.position(a) : Eb.position(a);
      },
      execInsBefore: function (a, b) {
        var c = this;
        Pb.execInsertBA(
          a,
          b,
          function (a) {
            c.exec.call(c, a);
          },
          function () {
            return 0;
          },
          function (a, b) {
            return a.splice(b, a.length - b);
          },
          -1,
          function (a) {
            Jb.from(a[0]);
          }
        );
      },
      execInsAfter: function (a, b) {
        var c = this;
        Pb.execInsertBA(
          a,
          b,
          function (a) {
            c.exec.call(c, a);
          },
          function (a) {
            return a.length - 1;
          },
          function (a, b) {
            return a.splice(b + 1, a.length - b - 1);
          },
          1,
          function (a) {
            a.length > 0 && Jb.from(a[0]);
          }
        );
      },
    });
    var Na = function () {};
    c(Na, {
      exec: function (a) {
        var b = this;
        Pb.exec(a, function (a) {
          b._prepend.call(b, a);
        });
      },
      _prepend: function (a) {
        db.markForPrepend(a),
          _a.eq("prepend", "default") ? Db.position(a) : Fb.position(a);
      },
    });
    var Oa = function () {
      (this._queue = []), (this._isWaitingForRpsQueue = !1);
    };
    c(Oa, {
      itemsToBatches: function (a, b, c) {
        for (
          var c = c || !1,
            a = c ? a : Ya.toNative(a),
            d = [],
            e = 0,
            f = [],
            g = !1,
            h = 0;
          h < a.length;
          h++
        )
          f.push(a[h]),
            (g = !1),
            e++,
            e == b && (d.push(f), (f = []), (g = !0), (e = 0));
        return g || d.push(f), d;
      },
      schedule: function (a, b, c, d, e) {
        this._schedule(b, e, c, d, a, this._exec);
      },
      scheduleFnExec: function (a, b, c, d) {
        for (
          var c = c || H.INSERT_BATCH_DELAY,
            e = this.itemsToBatches(a, b),
            f = 0;
          f < e.length;
          f++
        )
          !(function (a, b) {
            setTimeout(function () {
              d(a);
            }, c * b);
          })(e[f], f);
      },
      _schedule: function (a, b, c, d, e, f) {
        var g = this,
          h = function (a) {
            setTimeout(function () {
              g._execSchedule.call(g, a, b, e, f);
            }, 0);
          };
        return "undefined" == typeof c
          ? void h(a)
          : void this.scheduleFnExec(a, c, d, function (a) {
              h(a);
            });
      },
      _execSchedule: function (a, b, c, d) {
        var e = this;
        if (Kb.isEmpty()) d(a, b, c);
        else {
          if (
            (e._queue.push({ op: c, items: a, targetItem: b }),
            e._isWaitingForRpsQueue)
          )
            return;
          setTimeout(function () {
            (e._isWaitingForRpsQueue = !0), e._process.call(e);
          }, H.INSERT_QUEUE_DELAY);
        }
      },
      _process: function () {
        for (var a = this, b = !0, c = 0; c < this._queue.length; c++) {
          if (!Kb.isEmpty()) {
            setTimeout(function () {
              a._process.call(a);
            }, H.INSERT_QUEUE_DELAY),
              (b = !1);
            break;
          }
          var d = this._queue[c];
          this._exec(d.items, d.targetItem, d.op), this._queue.shift(), c--;
        }
        b && (this._isWaitingForRpsQueue = !1);
      },
      _exec: function (a, b, c) {
        c == L.PREPEND
          ? Ob.exec(a)
          : c == L.APPEND
          ? Nb.exec(a)
          : c == L.INS_BEFORE
          ? Nb.execInsBefore(a, b)
          : c == L.INS_AFTER
          ? Nb.execInsAfter(a, b)
          : e("wrong op");
      },
    });
    var Pa = function () {};
    c(Pa, {
      exec: function (a, b) {
        var a = Ya.filterNotConnected(Ya.toNative(a));
        if (0 != a.length) {
          Xa.startCachingTransaction(),
            Za.ensureCanFit(a),
            (a = cb.sort(cb.filter(a)));
          for (var c = 0; c < a.length; c++)
            cb.unmarkAsNotCollectable(a[c]), Za.add(a[c]), b(a[c]);
          Xa.stopCachingTransaction(),
            Za.scheduleResize(),
            $a.emit(P.INSERT, a);
        }
      },
      execInsertBA: function (a, b, c, d, f, g, h) {
        var a = Ya.filterNotConnected(Ya.toNative(a));
        if (0 != a.length) {
          var i = rb.get();
          if (0 == i.length) return void c(a);
          i = vb.sortForReappend(i);
          var j = [],
            b = this._getTargetItem(b, i, d),
            k = this._getTargetItemGuid(b, f, i, j);
          null == k && e(O.WRONG_IBA_ITEM), this._reposition(j, a, k, c, g, h);
        }
      },
      _getTargetItem: function (a, b, c) {
        if ("undefined" == typeof a || null == a) var a = b[c(b)].item;
        else {
          var a = Ya.toNative(a)[0];
          ("undefined" == typeof a || null == a) && (a = b[c(b)].item);
        }
        return a;
      },
      _getTargetItemGuid: function (a, b, c, d) {
        for (var e = null, f = 0; f < c.length; f++)
          if (db.get(c[f].item) == db.get(a)) {
            (e = c[f].itemGUID), Array.prototype.push.apply(d, b(c, f));
            break;
          }
        return e;
      },
      _reposition: function (a, b, c, d, e, f) {
        rb.reinitRanges(), db.reinitMax(c + 1 * e);
        var g = _a.eq("append", "default") ? Cb : Eb;
        g.recreateCrs(),
          d(b),
          _a.eq("sortDispersion", !1)
            ? (rb.restore(a), sb.remapGUIDSIn(a))
            : (rb.restoreOnSortDispersion(a), sb.remapAllGUIDS()),
          f(a);
      },
    });
    var Qa = function () {};
    c(Qa, {
      show: function (a) {
        var b = zb;
        if (!Y.isArray(a)) var a = [a];
        for (var c = 0; c < a.length; c++) {
          var d = a[c];
          this.unmarkAsSchToHide(d.item),
            b.isRendered(d) ||
              (b.markAsRendered(d),
              Ab.schedule(M.SHOW, d, b.left(d), b.top(d)));
        }
      },
      hide: function (a) {
        var b = zb;
        if (!Y.isArray(a)) var a = [a];
        for (var c = 0; c < a.length; c++) {
          var d = a[c];
          this.wasSchToHide(d.item) &&
            (b.unmarkAsRendered(d),
            Ab.schedule(M.HIDE, d, b.left(d), b.top(d)));
        }
      },
      renderRepositioned: function (a) {
        this.render(a, !1);
      },
      render: function (a, b) {
        for (var c = zb, b = b || !1, d = 0; d < a.length; d++) {
          var e = a[d];
          if (b !== !1) {
            for (var f = !1, g = 0; g < b.length; g++)
              if (a[d].itemGUID == b[g].itemGUID) {
                f = !0;
                break;
              }
            if (f) continue;
          }
          Ab.schedule(M.RENDER, e, c.left(e), c.top(e));
        }
      },
      renderAfterDelay: function (a, b) {
        for (var b = b || H.RENDER_DEF_DELAY, c = 0; c < a.length; c++)
          Ab.schedule(M.DEL_RENDER, a[c], null, null, b);
      },
      rotate: function (a) {
        for (var b = [], c = 0; c < a.length; c++) {
          var d = sb.find(a[c]);
          zb.unmarkAsRendered(d), b.push(d);
        }
        this.show(b);
      },
      markAsSchToHide: function (a) {
        for (var b = 0; b < a.length; b++)
          Y.set(a[b].item, H.REND.SCH_TO_HIDE_DATA, "y");
      },
      unmarkAsSchToHide: function (a) {
        Y.rm(a, H.REND.SCH_TO_HIDE_DATA);
      },
      wasSchToHide: function (a) {
        return Y.has(a, H.REND.SCH_TO_HIDE_DATA);
      },
    });
    var Ra = function () {};
    c(Ra, {
      isRendered: function (a) {
        return Y.has(a.item, H.REND.CN_RENDERED_DATA);
      },
      markAsRendered: function (a) {
        Y.set(a.item, H.REND.CN_RENDERED_DATA, "y");
      },
      unmarkAsRendered: function (a) {
        Y.rm(a.item, H.REND.CN_RENDERED_DATA);
      },
      left: function (a) {
        var b = g("eq", _a);
        if (b("grid", "vertical")) var c = a.x1;
        else var c = b("intersections", !0) ? a.x1 : a.x1 + a.hOffset;
        return c + "px";
      },
      top: function (a) {
        var b = g("eq", _a);
        if (b("grid", "vertical"))
          var c = b("intersections", !0) ? a.y1 : a.y1 + a.vOffset;
        else var c = a.y1;
        return c + "px";
      },
    });
    var Sa = function () {
      (this._queue = null), (this._queueTimeout = null);
    };
    c(Sa, {
      _reinit: function () {
        null == this._queue
          ? (this._queue = [])
          : clearTimeout(this._queueTimeout);
      },
      schedule: function (a, b, c, d, e) {
        if ((this._reinit(), a != M.SHOW || !Bb.isScheduled(b.item))) {
          var f = this;
          this._queue.push({ op: a, cn: b, left: c, top: d, delay: e }),
            (this._queueTimeout = setTimeout(function () {
              f._process.call(f);
            }, H.RENDER_QUEUE_DELAY));
        }
      },
      _getApi: function () {
        return {
          toggle: Rb,
          cc: _a.getApi("coordsChanger"),
          grid: Za.get(),
          sr: Z,
          srManager: Xa,
          collect: cb,
          prefix: X,
          dom: Y,
          getS: g("get", _a),
          EVENT: P,
          TOGGLE: I,
          ROTATE: J,
        };
      },
      _process: function () {
        for (var a = 0; a < this._queue.length; a++) {
          var b = this._queue[a];
          if (!Bb.isScheduled(b.cn.item)) {
            if (b.op == M.SHOW) {
              if (!Ya.isConnected(b.cn.item)) continue;
              var c = "show";
            } else var c = b.op == M.HIDE ? "hide" : "render";
            this["_" + c](b.cn, b.left, b.top, this._getApi(), b.op, b.delay);
          }
        }
        Za.scheduleResize(), (this._queue = null);
      },
      _show: function (a, b, c, d) {
        var e = g("get", _a);
        d.dom.css.set(a.item, { position: "absolute", left: b, top: c }),
          _a.getApi("coordsChanger")(
            a.item,
            b,
            c,
            e("coordsChangeTime"),
            e("coordsChangeTiming"),
            d.dom,
            d.prefix,
            e,
            !0
          ),
          $a.emitInternal(Q.BEFORE_SHOW_FOR_RSORT),
          _a
            .getApi("toggle")
            .show(
              a.item,
              b,
              c,
              e("toggleTime"),
              e("toggleTiming"),
              $a,
              Sb,
              d.dom,
              d,
              { x1: b, y1: c }
            );
      },
      _hide: function (a, b, c, d) {
        var e = g("get", _a);
        yb.unmarkAsSchToHide(a.item),
          _a
            .getApi("toggle")
            .hide(
              a.item,
              b,
              c,
              e("toggleTime"),
              e("toggleTiming"),
              $a,
              Sb,
              d.dom,
              d,
              { x1: b, y1: c }
            );
      },
      _render: function (a, b, c, d, e, f) {
        var g = this;
        e == M.RENDER
          ? this._execRender(a.item, b, c, d)
          : setTimeout(function () {
              var b = sb.find(a.item, !0);
              null != b && g._execRender(b.item, zb.left(b), zb.top(b), d);
            }, f);
      },
      _execRender: function (a, b, c, d) {
        var e = g("get", _a);
        if (Y.has(a, I.IS_ACTIVE_WITH_CC))
          var f = e("toggleTime"),
            h = e("toggleTiming");
        else
          var f = e("coordsChangeTime"),
            h = e("coordsChangeTiming");
        _a.getApi("coordsChanger")(a, b, c, f, h, d.dom, d.prefix, e);
      },
    }),
      (j = function () {}),
      c(j, {
        schedule: function (a) {
          for (var b = 0; b < a.length; b++)
            Y.set(a[b], H.REND.SILENT_DATA, "y");
        },
        unschedule: function (a, b) {
          for (var c = 0; c < a.length; c++)
            Y.rm(a[c], H.REND.SILENT_DATA), zb.unmarkAsRendered(b[c]);
        },
        isScheduled: function (a) {
          return Y.has(a, H.REND.SILENT_DATA);
        },
        _preUnschedule: function (a) {
          for (var b = 0; b < a.length; b++) Y.rm(a[b], H.REND.SILENT_DATA);
        },
        getScheduled: function (a) {
          var a = a || !1,
            b = cb.collectByQuery("[" + H.REND.SILENT_DATA + "]");
          if (0 == b.length) return [];
          if (!a) return b;
          for (
            var c = {
                left: Xa.offsetLeft(Za.get()),
                top: Xa.offsetTop(Za.get()),
              },
              d = Xa.viewportDocumentCoords(),
              e = [],
              f = 0;
            f < b.length;
            f++
          ) {
            var g = sb.find(b[f], !0);
            if (null != g) {
              var h = {
                x1: c.left + g.x1,
                x2: c.left + g.x2,
                y1: c.top + g.y1,
                y2: c.top + g.y2,
              };
              tb.isIntersectingAny([d], h) && e.push(b[f]);
            }
          }
          return e;
        },
        exec: function (a, b, c) {
          if ("undefined" != typeof a && null != a && a) {
            a = Ya.toNative(a);
            for (var d = [], e = 0; e < a.length; e++)
              this.isScheduled(a[e]) && d.push(a[e]);
            this._preUnschedule(d), (a = d);
          }
          var f = this;
          setTimeout(function () {
            f._exec.call(f, a, b, c);
          }, H.REFLOW_FIX_DELAY);
        },
        _exec: function (a, b, c) {
          if ("undefined" != typeof a && null != a && a) var d = a;
          else var d = this.getScheduled();
          if (0 != d.length) {
            this._preUnschedule(d);
            for (var e = [], f = [], g = 0; g < d.length; g++) {
              var h = sb.find(d[g], !0);
              null != h && e.push(h);
            }
            e = vb.sortForReappend(e);
            for (var g = 0; g < e.length; g++) f.push(e[g].item);
            return "undefined" == typeof b
              ? void this._render.call(this, f, e)
              : void this._execByBatches(f, e, b, c);
          }
        },
        _execByBatches: function (a, b, c, d) {
          if ("undefined" == typeof d) var d = H.INSERT_BATCH_DELAY;
          for (
            var e = Mb.itemsToBatches(a, c),
              f = Mb.itemsToBatches(b, c, !0),
              g = 0;
            g < e.length;
            g++
          )
            this._execBatch(e[g], f[g], g * d);
        },
        _execBatch: function (a, b, c) {
          var d = this;
          setTimeout(function () {
            d._render.call(d, a, b);
          }, c);
        },
        _render: function (a, b) {
          this.unschedule(a, b), yb.show(b);
        },
      });
    var Ta = function () {};
    c(Ta, {
      all: function () {
        Xa.startCachingTransaction(), this._all(), Xa.stopCachingTransaction();
      },
      fromFirstSortedCn: function (a) {
        Xa.startCachingTransaction(),
          this._fromFirstSortedCn(a),
          Xa.stopCachingTransaction();
      },
      from: function (a) {
        this._from(a);
      },
      sync: function () {
        var a = rb.get();
        if (!Kb.isEmpty()) {
          for (var b = Kb.stop(), c = [], d = 0; d < b.queueData.length; d++)
            c.push(b.queueData[d].cn);
          sb.syncParams(c);
          for (var d = 0; d < b.queue.length; d++) a.push(b.queue[d].cn);
        }
      },
      _stop: function () {
        var a = [];
        if (!Kb.isEmpty())
          for (var b = Kb.stop(), c = 0; c < b.queue.length; c++)
            b.queue[c].cn.restrictCollect || a.push(b.queue[c].cn);
        return a;
      },
      _all: function () {
        this.sync();
        var a = rb.get();
        0 != a.length &&
          ((a = vb.sortForReappend(a)),
          db.unmarkFirstPrepended(),
          this._start(Lb.getForRepositionAll(a)));
      },
      _from: function (a) {
        var b = this._stop();
        db.unmarkFirstPrepended(), this._start(Lb.get(b, a));
      },
      _fromFirstSortedCn: function (a) {
        for (
          var b = this._stop(), c = rb.get(), d = [], e = 0;
          e < a.length;
          e++
        ) {
          for (var f = 0; f < c.length; f++)
            db.get(c[f].item) != db.get(a[e]) || d.push(c[f]);
          for (var f = 0; f < b.length; f++)
            db.get(b[f].item) != db.get(a[e]) || d.push(b[f]);
        }
        var g = vb.sortForReappend(d);
        db.unmarkFirstPrepended(), this._start(Lb.get(b, g[0]));
      },
      _start: function (a) {
        lb.recreateForFirst(a.firstCn.item, a.firstCn),
          Kb.init(a.items, a.cns),
          Kb.start();
      },
    });
    var Ua = function () {};
    c(Ua, {
      get: function (a, b) {
        for (var c = rb.get(), d = g("eq", _a), e = 0; e < c.length; e++)
          if (!c[e].restrictCollect)
            if (d("sortDispersion", !1) && d("intersections", !0))
              c[e].itemGUID >= b.itemGUID &&
                (a.push(c[e]), c.splice(e, 1), e--);
            else if (d("intersections", !1)) {
              if (d("grid", "vertical")) var f = c[e].y2 >= b.y1;
              else var f = c[e].x2 >= b.x1;
              f && (a.push(c[e]), c.splice(e, 1), e--);
            } else
              d("sortDispersion", !0) &&
                this._getSDCond(c[e], b) &&
                (a.push(c[e]), c.splice(e, 1), e--);
        for (var h = vb.sortForReappend(a), i = [], e = 0; e < h.length; e++)
          i.push(h[e].item);
        return { items: i, cns: a, firstCn: h[0] };
      },
      _getSDCond: function (a, b) {
        var c = g("eq", _a);
        if (c("grid", "vertical"))
          if (c("append", "default"))
            var d = a.y1 > b.y1 || (a.y1 == b.y1 && a.x1 >= b.x1);
          else var d = a.y1 > b.y1 || (a.y1 == b.y1 && a.x1 <= b.x2);
        else if (c("append", "default"))
          var d = a.x1 > b.x1 || (a.x1 == b.x1 && a.y1 >= b.y1);
        else var d = a.x1 > b.x1 || (a.x1 == b.x1 && a.y1 <= b.y2);
        return d;
      },
      getForRepositionAll: function (a) {
        var b = [],
          c = [],
          d = [];
        this._findCns(a, b, c, d);
        var e = this._findFirstCnToRps(a, c);
        return { items: b, cns: d, firstCn: e };
      },
      _findCns: function (a, b, c, d) {
        for (var e = 0; e < a.length; e++)
          a[e].restrictCollect
            ? c.push(a[e])
            : (b.push(a[e].item), d.push(a[e]));
      },
      _findFirstCnToRps: function (a, b) {
        var c = null;
        if (0 == b.length) (c = a[0]), a.splice(0, a.length);
        else {
          for (var d = 0; d < a.length; d++) {
            for (var e = !0, f = 0; f < b.length; f++)
              if (b[f].itemGUID == a[d].itemGUID) {
                e = !1;
                break;
              }
            if (e) {
              c = a[d];
              break;
            }
          }
          a.splice(0, a.length);
          for (var d = 0; d < b.length; d++) a.push(b[d]);
        }
        return c;
      },
    });
    var Va = function () {
      (this._queue = null),
        (this._nextBatchTimeout = null),
        (this._queueData = null),
        (this._repositionStart = {
          gridX2: 0,
          gridY2: 0,
          vpWidth: null,
          vpHeight: null,
        });
    };
    c(Va, {
      isEmpty: function () {
        return null == this._nextBatchTimeout;
      },
      init: function (a, b) {
        (this._queue = []), (this._queueData = []);
        for (var c = 0; c < b.length; c++)
          this._queue.push({ item: a[c], cn: b[c] });
      },
      stop: function () {
        return (
          clearTimeout(this._nextBatchTimeout),
          (this._nextBatchTimeout = null),
          {
            queue: this._queue,
            queueData: this._queueData,
          }
        );
      },
      start: function () {
        (this._repositionStart = {
          gridX2: Za.x2(),
          gridY2: Za.y2(),
          vpWidth: Xa.viewportWidth(),
          vpHeight: Xa.viewportHeight(),
        }),
          this._repositionNextBatch();
      },
      getQueued: function () {
        return this._queue;
      },
      _isSameRepositionProcess: function () {
        var a = !0;
        return (
          _a.eq("grid", "vertical")
            ? (this._repositionStart.gridX2 != Za.x2() && (a = !1),
              this._repositionStart.vpWidth != Xa.viewportWidth() && (a = !1))
            : (this._repositionStart.gridY2 != Za.y2() && (a = !1),
              this._repositionStart.vpHeight != Xa.viewportHeight() &&
                (a = !1)),
          a
        );
      },
      _repositionNextBatch: function (a) {
        var b = _a.get("queueSize");
        b > this._queue.length && (b = this._queue.length),
          Xa.startCachingTransaction();
        var c = a || !1;
        return c && !this._isSameRepositionProcess()
          ? void Xa.stopCachingTransaction()
          : (this._execNextBatchReposition(b), void this._processQueue(b));
      },
      _execNextBatchReposition: function (a) {
        for (var b = [], c = 0; a > c; c++)
          this._repositionItem(this._queue[c].item),
            jb[
              "rmIntFrom" + (_a.eq("grid", "vertical") ? "Bottom" : "Right")
            ](),
            b.push(db.get(this._queue[c].item));
        Xa.stopCachingTransaction();
        var d = sb.getByGUIDS(b);
        xb.emitEvents(d), yb.renderRepositioned(d);
      },
      _processQueue: function (a) {
        return (
          (this._queueData = this._queueData.concat(this._queue.splice(0, a))),
          0 == this._queue.length
            ? ($a.emitInternal(Q.REPOSITION_END_FOR_DRAG),
              $a.emit(P.REPOSITION_END),
              void (this._nextBatchTimeout = null))
            : void this._scheduleNextBatchReposition()
        );
      },
      _scheduleNextBatchReposition: function () {
        var a = this;
        this._nextBatchTimeout = setTimeout(function () {
          a._repositionNextBatch.call(a, !0);
        }, _a.get("queueDelay"));
      },
      _repositionItem: function (a) {
        _a.eq("append", "reversed") ? Eb.position(a) : Cb.position(a);
      },
    }),
      Y.init(),
      Z.init();
    var Wa = this,
      Xa = new pa(),
      Ya = new na(),
      Za = new La(),
      $a = new ua(),
      _a = new S(),
      ab = new ta(),
      bb = g("eq", _a),
      cb = new la(),
      db = new ma(),
      eb = new k(),
      fb = new ya(),
      gb = new wa(),
      hb = new l(),
      ib = new da(),
      jb = new ea(),
      kb = new fa(),
      lb = new ga(),
      mb = new ha(),
      nb = new ia(),
      ob = new ja(),
      pb = new ka(),
      qb = bb("grid", "vertical") ? new Ha() : new Ba(),
      rb = bb("grid", "vertical") ? new Ga() : new Aa(),
      sb = new $(),
      tb = new _(),
      ub = new aa(),
      vb = new ba(),
      wb = new ca(),
      xb = new oa(),
      yb = (new va(), new Qa()),
      zb = new Ra(),
      Ab = new Sa(),
      Bb = new j(),
      Cb = bb("grid", "vertical") ? new Fa() : new za(),
      Db = bb("grid", "vertical") ? new Ia() : new Ca(),
      Eb = bb("grid", "vertical") ? new Ja() : new Da(),
      Fb = bb("grid", "vertical") ? new Ka() : new Ea(),
      Gb = new sa(),
      Hb = new qa(),
      Ib = new ra(),
      Jb = new Ta(),
      Kb = new Va(),
      Lb = new Ua(),
      Mb = new Oa(),
      Nb = new Ma(),
      Ob = new Na(),
      Pb = new Pa(),
      Qb = (new R(), new T(), new h()),
      Rb = new U(),
      Sb = new V(),
      Tb = new A(),
      Ub = new z(),
      Vb = new C(),
      Wb = new E(),
      Xb = new B();
    return this;
  };
  return a;
});

// Jdenticon 2.1.0 | jdenticon.com | MIT licensed | (c) 2014-2018 Daniel Mester
// Pirttijärvi
(function (q, y, z) {
  var t = z(q, q.jQuery);
  "undefined" !== typeof module && "exports" in module
    ? (module.exports = t)
    : "function" === typeof define && define.amd
    ? define([], function () {
        return t;
      })
    : (q[y] = t);
})(this, "jdenticon", function (q, y) {
  function z(a, b, c) {
    for (
      var d = document.createElementNS("http://www.w3.org/2000/svg", b), f = 2;
      f + 1 < arguments.length;
      f += 2
    )
      d.setAttribute(arguments[f], arguments[f + 1]);
    a.appendChild(d);
  }
  function t(a) {
    this.b = Math.min(
      Number(a.getAttribute("width")) || 100,
      Number(a.getAttribute("height")) || 100
    );
    for (this.a = a; a.firstChild; ) a.removeChild(a.firstChild);
    a.setAttribute("viewBox", "0 0 " + this.b + " " + this.b);
    a.setAttribute("preserveAspectRatio", "xMidYMid meet");
  }
  function K(a) {
    this.b = a;
    this.a =
      '\x3csvg xmlns\x3d"http://www.w3.org/2000/svg" width\x3d"' +
      a +
      '" height\x3d"' +
      a +
      '" viewBox\x3d"0 0 ' +
      a +
      " " +
      a +
      '" preserveAspectRatio\x3d"xMidYMid meet"\x3e';
  }
  function N(a) {
    return (function (a) {
      for (var b = [], d = 0; d < a.length; d++)
        for (var f = a[d], e = 28; 0 <= e; e -= 4)
          b.push(((f >>> e) & 15).toString(16));
      return b.join("");
    })(
      (function (a) {
        for (
          var b = 1732584193,
            d = 4023233417,
            f = 2562383102,
            e = 271733878,
            h = 3285377520,
            k = [b, d, f, e, h],
            g = 0;
          g < a.length;
          g++
        ) {
          for (var u = a[g], l = 16; 80 > l; l++) {
            var A = u[l - 3] ^ u[l - 8] ^ u[l - 14] ^ u[l - 16];
            u[l] = (A << 1) | (A >>> 31);
          }
          for (l = 0; 80 > l; l++)
            (A =
              ((b << 5) | (b >>> 27)) +
              (20 > l
                ? ((d & f) ^ (~d & e)) + 1518500249
                : 40 > l
                ? (d ^ f ^ e) + 1859775393
                : 60 > l
                ? ((d & f) ^ (d & e) ^ (f & e)) + 2400959708
                : (d ^ f ^ e) + 3395469782) +
              h +
              u[l]),
              (h = e),
              (e = f),
              (f = (d << 30) | (d >>> 2)),
              (d = b),
              (b = A | 0);
          k[0] = b = (k[0] + b) | 0;
          k[1] = d = (k[1] + d) | 0;
          k[2] = f = (k[2] + f) | 0;
          k[3] = e = (k[3] + e) | 0;
          k[4] = h = (k[4] + h) | 0;
        }
        return k;
      })(
        (function (a) {
          function b(a, b) {
            for (var c = [], d = -1, e = 0; e < b; e++)
              (d = (e / 4) | 0),
                (c[d] = (c[d] || 0) + (f[a + e] << (8 * (3 - (e & 3)))));
            for (; 16 > ++d; ) c[d] = 0;
            return c;
          }
          var d = encodeURI(a),
            f = [];
          a = 0;
          var e,
            h = [];
          for (e = 0; e < d.length; e++) {
            if ("%" == d[e]) {
              var k = r(d, e + 1, 2);
              e += 2;
            } else k = d.charCodeAt(e);
            f[a++] = k;
          }
          f[a++] = 128;
          for (e = 0; e + 64 <= a; e += 64) h.push(b(e, 64));
          d = a - e;
          e = b(e, d);
          64 < d + 8 && (h.push(e), (e = b(0, 0)));
          e[15] = 8 * a - 8;
          h.push(e);
          return h;
        })(a)
      )
    );
  }
  function E(a, b) {
    var c = a.canvas.width,
      d = a.canvas.height;
    a.save();
    this.b = a;
    b
      ? (this.a = b)
      : ((this.a = Math.min(c, d)),
        a.translate(((c - this.a) / 2) | 0, ((d - this.a) / 2) | 0));
    a.clearRect(0, 0, this.a, this.a);
  }
  function v(a) {
    a |= 0;
    return 0 > a
      ? "00"
      : 16 > a
      ? "0" + a.toString(16)
      : 256 > a
      ? a.toString(16)
      : "ff";
  }
  function F(a, b, c) {
    c = 0 > c ? c + 6 : 6 < c ? c - 6 : c;
    return v(
      255 *
        (1 > c
          ? a + (b - a) * c
          : 3 > c
          ? b
          : 4 > c
          ? a + (b - a) * (4 - c)
          : a)
    );
  }
  function O(a) {
    "undefined" != typeof MutationObserver &&
      new MutationObserver(function (b) {
        for (var c = 0; c < b.length; c++) {
          for (var d = b[c], f = d.addedNodes, e = 0; f && e < f.length; e++) {
            var h = f[e];
            if (1 == h.nodeType)
              if (g.w(h)) a(h);
              else {
                h = h.querySelectorAll(g.A);
                for (var k = 0; k < h.length; k++) a(h[k]);
              }
          }
          "attributes" == d.type && g.w(d.target) && a(d.target);
        }
      }).observe(document.body, {
        childList: !0,
        attributes: !0,
        attributeFilter: [g.o, g.s, "width", "height"],
        subtree: !0,
      });
  }
  function r(a, b, c) {
    return parseInt(a.substr(b, c), 16);
  }
  function p(a) {
    return ((10 * a + 0.5) | 0) / 10;
  }
  function L() {
    this.j = "";
  }
  function G(a) {
    this.b = {};
    this.h = a;
    this.a = a.b;
  }
  function M(a) {
    this.h = a;
    this.c = w.a;
  }
  function P(a, b) {
    a = b.O(a);
    return [
      m.i(a, b.H, b.G(0)),
      m.i(a, b.v, b.u(0.5)),
      m.i(a, b.H, b.G(1)),
      m.i(a, b.v, b.u(1)),
      m.i(a, b.v, b.u(0)),
    ];
  }
  function B(a, b) {
    this.x = a;
    this.y = b;
  }
  function w(a, b, c, d) {
    this.b = a;
    this.c = b;
    this.h = c;
    this.a = d;
  }
  function H(a, b, c, d, f, e, h) {
    function k(e, f, k, h, g) {
      h = h ? r(b, h, 1) : 0;
      f = f[r(b, k, 1) % f.length];
      a.D(p[n[e]]);
      for (e = 0; e < g.length; e++)
        (m.c = new w(c + g[e][0] * l, d + g[e][1] * l, l, h++ % 4)), f(m, l, e);
      a.F();
    }
    function g(a) {
      if (0 <= a.indexOf(q))
        for (var b = 0; b < a.length; b++) if (0 <= n.indexOf(a[b])) return !0;
    }
    h.C && a.m(h.C);
    e = (0.5 + f * (void 0 === e ? 0.08 : e)) | 0;
    f -= 2 * e;
    var m = new M(a),
      l = 0 | (f / 4);
    c += 0 | (e + f / 2 - 2 * l);
    d += 0 | (e + f / 2 - 2 * l);
    var p = P(r(b, -7) / 268435455, h),
      n = [];
    for (f = 0; 3 > f; f++) {
      var q = r(b, 8 + f, 1) % p.length;
      if (g([0, 4]) || g([2, 3])) q = 1;
      n.push(q);
    }
    k(0, I.I, 2, 3, [
      [1, 0],
      [2, 0],
      [2, 3],
      [1, 3],
      [0, 1],
      [3, 1],
      [3, 2],
      [0, 2],
    ]);
    k(1, I.I, 4, 5, [
      [0, 0],
      [3, 0],
      [3, 3],
      [0, 3],
    ]);
    k(2, I.M, 1, null, [
      [1, 1],
      [2, 1],
      [2, 2],
      [1, 2],
    ]);
    a.finish();
  }
  function J() {
    function a(a, b) {
      var d = c[a];
      (d && 1 < d.length) || (d = b);
      return function (a) {
        a = d[0] + a * (d[1] - d[0]);
        return 0 > a ? 0 : 1 < a ? 1 : a;
      };
    }
    var b = n.config || q.jdenticon_config || {},
      c = b.lightness || {},
      d = b.saturation || {},
      f = "color" in d ? d.color : d;
    d = d.grayscale;
    return {
      O: function (a) {
        var c = b.hues,
          d;
        c && 0 < c.length && (d = c[0 | (0.999 * a * c.length)]);
        return "number" == typeof d ? (((d / 360) % 1) + 1) % 1 : a;
      },
      v: "number" == typeof f ? f : 0.5,
      H: "number" == typeof d ? d : 0,
      u: a("color", [0.4, 0.8]),
      G: a("grayscale", [0.3, 0.9]),
      C: m.parse(b.backColor),
    };
  }
  function C(a) {
    return /^[0-9a-f]{11,}$/i.test(a) && a;
  }
  function D(a) {
    return N(null == a ? "" : "" + a);
  }
  function x(a, b, c) {
    if ("string" === typeof a) {
      if (g.J) {
        a = document.querySelectorAll(a);
        for (var d = 0; d < a.length; d++) x(a[d], b, c);
      }
    } else if ((d = g.w(a))) if ((b = C(b) || (null != b && D(b)) || C(a.getAttribute(g.s)) || (a.hasAttribute(g.o) && D(a.getAttribute(g.o))))) (a = d == g.B ? new G(new t(a)) : new E(a.getContext("2d"))), H(a, b, 0, 0, a.a, c, J());
  }
  function n() {
    g.J && x(g.A);
  }
  function Q() {
    var a = (n.config || q.jdenticon_config || {}).replaceMode;
    "never" != a && (n(), "observe" == a && O(x));
  }
  t.prototype = {
    m: function (a, b) {
      b &&
        z(
          this.a,
          "rect",
          "width",
          "100%",
          "height",
          "100%",
          "fill",
          a,
          "opacity",
          b
        );
    },
    c: function (a, b) {
      z(this.a, "path", "fill", a, "d", b);
    },
  };
  K.prototype = {
    m: function (a, b) {
      b &&
        (this.a +=
          '\x3crect width\x3d"100%" height\x3d"100%" fill\x3d"' +
          a +
          '" opacity\x3d"' +
          b.toFixed(2) +
          '"/\x3e');
    },
    c: function (a, b) {
      this.a += '\x3cpath fill\x3d"' + a + '" d\x3d"' + b + '"/\x3e';
    },
    toString: function () {
      return this.a + "\x3c/svg\x3e";
    },
  };
  var g = {
    B: 1,
    L: 2,
    s: "data-jdenticon-hash",
    o: "data-jdenticon-value",
    J: "undefined" !== typeof document && "querySelectorAll" in document,
    w: function (a) {
      if (a) {
        var b = a.tagName;
        if (/svg/i.test(b)) return g.B;
        if (/canvas/i.test(b) && "getContext" in a) return g.L;
      }
    },
  };
  g.A = "[" + g.s + "],[" + g.o + "]";
  E.prototype = {
    m: function (a) {
      var b = this.b,
        c = this.a;
      b.fillStyle = m.K(a);
      b.fillRect(0, 0, c, c);
    },
    D: function (a) {
      this.b.fillStyle = m.K(a);
      this.b.beginPath();
    },
    F: function () {
      this.b.fill();
    },
    f: function (a) {
      var b = this.b,
        c;
      b.moveTo(a[0].x, a[0].y);
      for (c = 1; c < a.length; c++) b.lineTo(a[c].x, a[c].y);
      b.closePath();
    },
    g: function (a, b, c) {
      var d = this.b;
      b /= 2;
      d.moveTo(a.x + b, a.y + b);
      d.arc(a.x + b, a.y + b, b, 0, 2 * Math.PI, c);
      d.closePath();
    },
    finish: function () {
      this.b.restore();
    },
  };
  var m = {
      P: function (a, b, c) {
        return "#" + v(a) + v(b) + v(c);
      },
      parse: function (a) {
        if (/^#[0-9a-f]{3,8}$/i.test(a)) {
          if (6 > a.length) {
            var b = a[1],
              c = a[2],
              d = a[3];
            a = a[4] || "";
            return "#" + b + b + c + c + d + d + a + a;
          }
          if (7 == a.length || 8 < a.length) return a;
        }
      },
      K: function (a) {
        var b = r(a, 7, 2);
        return isNaN(b)
          ? a
          : "rgba(" +
              r(a, 1, 2) +
              "," +
              r(a, 3, 2) +
              "," +
              r(a, 5, 2) +
              "," +
              (b / 255).toFixed(2) +
              ")";
      },
      N: function (a, b, c) {
        if (0 == b) return (a = v(255 * c)), "#" + a + a + a;
        b = 0.5 >= c ? c * (b + 1) : c + b - c * b;
        c = 2 * c - b;
        return "#" + F(c, b, 6 * a + 2) + F(c, b, 6 * a) + F(c, b, 6 * a - 2);
      },
      i: function (a, b, c) {
        var d = [0.55, 0.5, 0.5, 0.46, 0.6, 0.55, 0.55][(6 * a + 0.5) | 0];
        return m.N(a, b, 0.5 > c ? c * d * 2 : d + (c - 0.5) * (1 - d) * 2);
      },
    },
    I = {
      M: [
        function (a, b) {
          var c = 0.42 * b;
          a.f([0, 0, b, 0, b, b - 2 * c, b - c, b, 0, b]);
        },
        function (a, b) {
          var c = 0 | (0.5 * b);
          a.b(b - c, 0, c, 0 | (0.8 * b), 2);
        },
        function (a, b) {
          var c = 0 | (b / 3);
          a.a(c, c, b - c, b - c);
        },
        function (a, b) {
          var c = 0.1 * b,
            d = 6 > b ? 1 : 8 > b ? 2 : 0 | (0.25 * b);
          c = 1 < c ? 0 | c : 0.5 < c ? 1 : c;
          a.a(d, d, b - c - d, b - c - d);
        },
        function (a, b) {
          var c = 0 | (0.15 * b),
            d = 0 | (0.5 * b);
          a.g(b - d - c, b - d - c, d);
        },
        function (a, b) {
          var c = 0.1 * b,
            d = 4 * c;
          3 < d && (d |= 0);
          a.a(0, 0, b, b);
          a.f([d, d, b - c, d, d + (b - d - c) / 2, b - c], !0);
        },
        function (a, b) {
          a.f([0, 0, b, 0, b, 0.7 * b, 0.4 * b, 0.4 * b, 0.7 * b, b, 0, b]);
        },
        function (a, b) {
          a.b(b / 2, b / 2, b / 2, b / 2, 3);
        },
        function (a, b) {
          a.a(0, 0, b, b / 2);
          a.a(0, b / 2, b / 2, b / 2);
          a.b(b / 2, b / 2, b / 2, b / 2, 1);
        },
        function (a, b) {
          var c = 0.14 * b,
            d = 4 > b ? 1 : 6 > b ? 2 : 0 | (0.35 * b);
          c = 8 > b ? c : 0 | c;
          a.a(0, 0, b, b);
          a.a(d, d, b - d - c, b - d - c, !0);
        },
        function (a, b) {
          var c = 0.12 * b,
            d = 3 * c;
          a.a(0, 0, b, b);
          a.g(d, d, b - c - d, !0);
        },
        function (a, b) {
          a.b(b / 2, b / 2, b / 2, b / 2, 3);
        },
        function (a, b) {
          var c = 0.25 * b;
          a.a(0, 0, b, b);
          a.l(c, c, b - c, b - c, !0);
        },
        function (a, b, c) {
          var d = 0.4 * b;
          c || a.g(d, d, 1.2 * b);
        },
      ],
      I: [
        function (a, b) {
          a.b(0, 0, b, b, 0);
        },
        function (a, b) {
          a.b(0, b / 2, b, b / 2, 0);
        },
        function (a, b) {
          a.l(0, 0, b, b);
        },
        function (a, b) {
          var c = b / 6;
          a.g(c, c, b - 2 * c);
        },
      ],
    };
  L.prototype = {
    f: function (a) {
      for (var b = "M" + p(a[0].x) + " " + p(a[0].y), c = 1; c < a.length; c++)
        b += "L" + p(a[c].x) + " " + p(a[c].y);
      this.j += b + "Z";
    },
    g: function (a, b, c) {
      c = c ? 0 : 1;
      var d = p(b / 2),
        f = p(b);
      this.j +=
        "M" +
        p(a.x) +
        " " +
        p(a.y + b / 2) +
        "a" +
        d +
        "," +
        d +
        " 0 1," +
        c +
        " " +
        f +
        ",0a" +
        d +
        "," +
        d +
        " 0 1," +
        c +
        " " +
        -f +
        ",0";
    },
  };
  G.prototype = {
    m: function (a) {
      a = /^(#......)(..)?/.exec(a);
      this.h.m(a[1], a[2] ? r(a[2], 0) / 255 : 1);
    },
    D: function (a) {
      this.c = this.b[a] || (this.b[a] = new L());
    },
    F: function () {},
    f: function (a) {
      this.c.f(a);
    },
    g: function (a, b, c) {
      this.c.g(a, b, c);
    },
    finish: function () {
      for (var a in this.b) this.h.c(a, this.b[a].j);
    },
  };
  M.prototype = {
    f: function (a, b) {
      var c = b ? -2 : 2,
        d = this.c,
        f = [];
      for (b = b ? a.length - 2 : 0; b < a.length && 0 <= b; b += c)
        f.push(d.l(a[b], a[b + 1]));
      this.h.f(f);
    },
    g: function (a, b, c, d) {
      this.h.g(this.c.l(a, b, c, c), c, d);
    },
    a: function (a, b, c, d, f) {
      this.f([a, b, a + c, b, a + c, b + d, a, b + d], f);
    },
    b: function (a, b, c, d, f, e) {
      a = [a + c, b, a + c, b + d, a, b + d, a, b];
      a.splice(((f || 0) % 4) * 2, 2);
      this.f(a, e);
    },
    l: function (a, b, c, d, f) {
      this.f(
        [a + c / 2, b, a + c, b + d / 2, a + c / 2, b + d, a, b + d / 2],
        f
      );
    },
  };
  w.prototype = {
    l: function (a, b, c, d) {
      var f = this.b + this.h,
        e = this.c + this.h;
      return 1 === this.a
        ? new B(f - b - (d || 0), this.c + a)
        : 2 === this.a
        ? new B(f - a - (c || 0), e - b - (d || 0))
        : 3 === this.a
        ? new B(this.b + b, e - a - (c || 0))
        : new B(this.b + a, this.c + b);
    },
  };
  w.a = new w(0, 0, 0, 0);
  n.drawIcon = function (a, b, c, d) {
    if (!a) throw Error("No canvas specified.");
    a = new E(a, c);
    H(a, C(b) || D(b), 0, 0, c, d || 0, J());
  };
  n.toSvg = function (a, b, c) {
    var d = new K(b);
    H(new G(d), C(a) || D(a), 0, 0, b, c, J());
    return d.toString();
  };
  n.update = x;
  n.version = "2.1.0";
  y &&
    (y.fn.jdenticon = function (a, b) {
      this.each(function (c, d) {
        x(d, a, b);
      });
      return this;
    });
  "function" === typeof setTimeout && setTimeout(Q, 0);
  return n;
});

// psl.min.js
!(function (a) {
  if ("object" == typeof exports && "undefined" != typeof module)
    module.exports = a();
  else if ("function" == typeof define && define.amd) define([], a);
  else {
    ("undefined" != typeof window
      ? window
      : "undefined" != typeof global
      ? global
      : "undefined" != typeof self
      ? self
      : this
    ).psl = a();
  }
})(function () {
  return (function s(m, t, u) {
    function r(o, a) {
      if (!t[o]) {
        if (!m[o]) {
          var i = "function" == typeof require && require;
          if (!a && i) return i(o, !0);
          if (p) return p(o, !0);
          var e = new Error("Cannot find module '" + o + "'");
          throw ((e.code = "MODULE_NOT_FOUND"), e);
        }
        var n = (t[o] = { exports: {} });
        m[o][0].call(
          n.exports,
          function (a) {
            return r(m[o][1][a] || a);
          },
          n,
          n.exports,
          s,
          m,
          t,
          u
        );
      }
      return t[o].exports;
    }
    for (
      var p = "function" == typeof require && require, a = 0;
      a < u.length;
      a++
    )
      r(u[a]);
    return r;
  })(
    {
      1: [
        function (a, o, i) {
          o.exports = [
            "ac",
            "com.ac",
            "edu.ac",
            "gov.ac",
            "net.ac",
            "mil.ac",
            "org.ac",
            "ad",
            "nom.ad",
            "ae",
            "co.ae",
            "net.ae",
            "org.ae",
            "sch.ae",
            "ac.ae",
            "gov.ae",
            "mil.ae",
            "aero",
            "accident-investigation.aero",
            "accident-prevention.aero",
            "aerobatic.aero",
            "aeroclub.aero",
            "aerodrome.aero",
            "agents.aero",
            "aircraft.aero",
            "airline.aero",
            "airport.aero",
            "air-surveillance.aero",
            "airtraffic.aero",
            "air-traffic-control.aero",
            "ambulance.aero",
            "amusement.aero",
            "association.aero",
            "author.aero",
            "ballooning.aero",
            "broker.aero",
            "caa.aero",
            "cargo.aero",
            "catering.aero",
            "certification.aero",
            "championship.aero",
            "charter.aero",
            "civilaviation.aero",
            "club.aero",
            "conference.aero",
            "consultant.aero",
            "consulting.aero",
            "control.aero",
            "council.aero",
            "crew.aero",
            "design.aero",
            "dgca.aero",
            "educator.aero",
            "emergency.aero",
            "engine.aero",
            "engineer.aero",
            "entertainment.aero",
            "equipment.aero",
            "exchange.aero",
            "express.aero",
            "federation.aero",
            "flight.aero",
            "freight.aero",
            "fuel.aero",
            "gliding.aero",
            "government.aero",
            "groundhandling.aero",
            "group.aero",
            "hanggliding.aero",
            "homebuilt.aero",
            "insurance.aero",
            "journal.aero",
            "journalist.aero",
            "leasing.aero",
            "logistics.aero",
            "magazine.aero",
            "maintenance.aero",
            "media.aero",
            "microlight.aero",
            "modelling.aero",
            "navigation.aero",
            "parachuting.aero",
            "paragliding.aero",
            "passenger-association.aero",
            "pilot.aero",
            "press.aero",
            "production.aero",
            "recreation.aero",
            "repbody.aero",
            "res.aero",
            "research.aero",
            "rotorcraft.aero",
            "safety.aero",
            "scientist.aero",
            "services.aero",
            "show.aero",
            "skydiving.aero",
            "software.aero",
            "student.aero",
            "trader.aero",
            "trading.aero",
            "trainer.aero",
            "union.aero",
            "workinggroup.aero",
            "works.aero",
            "af",
            "gov.af",
            "com.af",
            "org.af",
            "net.af",
            "edu.af",
            "ag",
            "com.ag",
            "org.ag",
            "net.ag",
            "co.ag",
            "nom.ag",
            "ai",
            "off.ai",
            "com.ai",
            "net.ai",
            "org.ai",
            "al",
            "com.al",
            "edu.al",
            "gov.al",
            "mil.al",
            "net.al",
            "org.al",
            "am",
            "ao",
            "ed.ao",
            "gv.ao",
            "og.ao",
            "co.ao",
            "pb.ao",
            "it.ao",
            "aq",
            "ar",
            "com.ar",
            "edu.ar",
            "gob.ar",
            "gov.ar",
            "int.ar",
            "mil.ar",
            "musica.ar",
            "net.ar",
            "org.ar",
            "tur.ar",
            "arpa",
            "e164.arpa",
            "in-addr.arpa",
            "ip6.arpa",
            "iris.arpa",
            "uri.arpa",
            "urn.arpa",
            "as",
            "gov.as",
            "asia",
            "at",
            "ac.at",
            "co.at",
            "gv.at",
            "or.at",
            "au",
            "com.au",
            "net.au",
            "org.au",
            "edu.au",
            "gov.au",
            "asn.au",
            "id.au",
            "info.au",
            "conf.au",
            "oz.au",
            "act.au",
            "nsw.au",
            "nt.au",
            "qld.au",
            "sa.au",
            "tas.au",
            "vic.au",
            "wa.au",
            "act.edu.au",
            "nsw.edu.au",
            "nt.edu.au",
            "qld.edu.au",
            "sa.edu.au",
            "tas.edu.au",
            "vic.edu.au",
            "wa.edu.au",
            "qld.gov.au",
            "sa.gov.au",
            "tas.gov.au",
            "vic.gov.au",
            "wa.gov.au",
            "aw",
            "com.aw",
            "ax",
            "az",
            "com.az",
            "net.az",
            "int.az",
            "gov.az",
            "org.az",
            "edu.az",
            "info.az",
            "pp.az",
            "mil.az",
            "name.az",
            "pro.az",
            "biz.az",
            "ba",
            "com.ba",
            "edu.ba",
            "gov.ba",
            "mil.ba",
            "net.ba",
            "org.ba",
            "bb",
            "biz.bb",
            "co.bb",
            "com.bb",
            "edu.bb",
            "gov.bb",
            "info.bb",
            "net.bb",
            "org.bb",
            "store.bb",
            "tv.bb",
            "*.bd",
            "be",
            "ac.be",
            "bf",
            "gov.bf",
            "bg",
            "a.bg",
            "b.bg",
            "c.bg",
            "d.bg",
            "e.bg",
            "f.bg",
            "g.bg",
            "h.bg",
            "i.bg",
            "j.bg",
            "k.bg",
            "l.bg",
            "m.bg",
            "n.bg",
            "o.bg",
            "p.bg",
            "q.bg",
            "r.bg",
            "s.bg",
            "t.bg",
            "u.bg",
            "v.bg",
            "w.bg",
            "x.bg",
            "y.bg",
            "z.bg",
            "0.bg",
            "1.bg",
            "2.bg",
            "3.bg",
            "4.bg",
            "5.bg",
            "6.bg",
            "7.bg",
            "8.bg",
            "9.bg",
            "bh",
            "com.bh",
            "edu.bh",
            "net.bh",
            "org.bh",
            "gov.bh",
            "bi",
            "co.bi",
            "com.bi",
            "edu.bi",
            "or.bi",
            "org.bi",
            "biz",
            "bj",
            "asso.bj",
            "barreau.bj",
            "gouv.bj",
            "bm",
            "com.bm",
            "edu.bm",
            "gov.bm",
            "net.bm",
            "org.bm",
            "*.bn",
            "bo",
            "com.bo",
            "edu.bo",
            "gob.bo",
            "int.bo",
            "org.bo",
            "net.bo",
            "mil.bo",
            "tv.bo",
            "web.bo",
            "academia.bo",
            "agro.bo",
            "arte.bo",
            "blog.bo",
            "bolivia.bo",
            "ciencia.bo",
            "cooperativa.bo",
            "democracia.bo",
            "deporte.bo",
            "ecologia.bo",
            "economia.bo",
            "empresa.bo",
            "indigena.bo",
            "industria.bo",
            "info.bo",
            "medicina.bo",
            "movimiento.bo",
            "musica.bo",
            "natural.bo",
            "nombre.bo",
            "noticias.bo",
            "patria.bo",
            "politica.bo",
            "profesional.bo",
            "plurinacional.bo",
            "pueblo.bo",
            "revista.bo",
            "salud.bo",
            "tecnologia.bo",
            "tksat.bo",
            "transporte.bo",
            "wiki.bo",
            "br",
            "9guacu.br",
            "abc.br",
            "adm.br",
            "adv.br",
            "agr.br",
            "aju.br",
            "am.br",
            "anani.br",
            "aparecida.br",
            "arq.br",
            "art.br",
            "ato.br",
            "b.br",
            "barueri.br",
            "belem.br",
            "bhz.br",
            "bio.br",
            "blog.br",
            "bmd.br",
            "boavista.br",
            "bsb.br",
            "campinagrande.br",
            "campinas.br",
            "caxias.br",
            "cim.br",
            "cng.br",
            "cnt.br",
            "com.br",
            "contagem.br",
            "coop.br",
            "cri.br",
            "cuiaba.br",
            "curitiba.br",
            "def.br",
            "ecn.br",
            "eco.br",
            "edu.br",
            "emp.br",
            "eng.br",
            "esp.br",
            "etc.br",
            "eti.br",
            "far.br",
            "feira.br",
            "flog.br",
            "floripa.br",
            "fm.br",
            "fnd.br",
            "fortal.br",
            "fot.br",
            "foz.br",
            "fst.br",
            "g12.br",
            "ggf.br",
            "goiania.br",
            "gov.br",
            "ac.gov.br",
            "al.gov.br",
            "am.gov.br",
            "ap.gov.br",
            "ba.gov.br",
            "ce.gov.br",
            "df.gov.br",
            "es.gov.br",
            "go.gov.br",
            "ma.gov.br",
            "mg.gov.br",
            "ms.gov.br",
            "mt.gov.br",
            "pa.gov.br",
            "pb.gov.br",
            "pe.gov.br",
            "pi.gov.br",
            "pr.gov.br",
            "rj.gov.br",
            "rn.gov.br",
            "ro.gov.br",
            "rr.gov.br",
            "rs.gov.br",
            "sc.gov.br",
            "se.gov.br",
            "sp.gov.br",
            "to.gov.br",
            "gru.br",
            "imb.br",
            "ind.br",
            "inf.br",
            "jab.br",
            "jampa.br",
            "jdf.br",
            "joinville.br",
            "jor.br",
            "jus.br",
            "leg.br",
            "lel.br",
            "londrina.br",
            "macapa.br",
            "maceio.br",
            "manaus.br",
            "maringa.br",
            "mat.br",
            "med.br",
            "mil.br",
            "morena.br",
            "mp.br",
            "mus.br",
            "natal.br",
            "net.br",
            "niteroi.br",
            "*.nom.br",
            "not.br",
            "ntr.br",
            "odo.br",
            "org.br",
            "osasco.br",
            "palmas.br",
            "poa.br",
            "ppg.br",
            "pro.br",
            "psc.br",
            "psi.br",
            "pvh.br",
            "qsl.br",
            "radio.br",
            "rec.br",
            "recife.br",
            "ribeirao.br",
            "rio.br",
            "riobranco.br",
            "riopreto.br",
            "salvador.br",
            "sampa.br",
            "santamaria.br",
            "santoandre.br",
            "saobernardo.br",
            "saogonca.br",
            "sjc.br",
            "slg.br",
            "slz.br",
            "sorocaba.br",
            "srv.br",
            "taxi.br",
            "teo.br",
            "the.br",
            "tmp.br",
            "trd.br",
            "tur.br",
            "tv.br",
            "udi.br",
            "vet.br",
            "vix.br",
            "vlog.br",
            "wiki.br",
            "zlg.br",
            "bs",
            "com.bs",
            "net.bs",
            "org.bs",
            "edu.bs",
            "gov.bs",
            "bt",
            "com.bt",
            "edu.bt",
            "gov.bt",
            "net.bt",
            "org.bt",
            "bv",
            "bw",
            "co.bw",
            "org.bw",
            "by",
            "gov.by",
            "mil.by",
            "com.by",
            "of.by",
            "bz",
            "com.bz",
            "net.bz",
            "org.bz",
            "edu.bz",
            "gov.bz",
            "ca",
            "ab.ca",
            "bc.ca",
            "mb.ca",
            "nb.ca",
            "nf.ca",
            "nl.ca",
            "ns.ca",
            "nt.ca",
            "nu.ca",
            "on.ca",
            "pe.ca",
            "qc.ca",
            "sk.ca",
            "yk.ca",
            "gc.ca",
            "cat",
            "cc",
            "cd",
            "gov.cd",
            "cf",
            "cg",
            "ch",
            "ci",
            "org.ci",
            "or.ci",
            "com.ci",
            "co.ci",
            "edu.ci",
            "ed.ci",
            "ac.ci",
            "net.ci",
            "go.ci",
            "asso.ci",
            "aéroport.ci",
            "int.ci",
            "presse.ci",
            "md.ci",
            "gouv.ci",
            "*.ck",
            "!www.ck",
            "cl",
            "gov.cl",
            "gob.cl",
            "co.cl",
            "mil.cl",
            "cm",
            "co.cm",
            "com.cm",
            "gov.cm",
            "net.cm",
            "cn",
            "ac.cn",
            "com.cn",
            "edu.cn",
            "gov.cn",
            "net.cn",
            "org.cn",
            "mil.cn",
            "公司.cn",
            "网络.cn",
            "網絡.cn",
            "ah.cn",
            "bj.cn",
            "cq.cn",
            "fj.cn",
            "gd.cn",
            "gs.cn",
            "gz.cn",
            "gx.cn",
            "ha.cn",
            "hb.cn",
            "he.cn",
            "hi.cn",
            "hl.cn",
            "hn.cn",
            "jl.cn",
            "js.cn",
            "jx.cn",
            "ln.cn",
            "nm.cn",
            "nx.cn",
            "qh.cn",
            "sc.cn",
            "sd.cn",
            "sh.cn",
            "sn.cn",
            "sx.cn",
            "tj.cn",
            "xj.cn",
            "xz.cn",
            "yn.cn",
            "zj.cn",
            "hk.cn",
            "mo.cn",
            "tw.cn",
            "co",
            "arts.co",
            "com.co",
            "edu.co",
            "firm.co",
            "gov.co",
            "info.co",
            "int.co",
            "mil.co",
            "net.co",
            "nom.co",
            "org.co",
            "rec.co",
            "web.co",
            "com",
            "coop",
            "cr",
            "ac.cr",
            "co.cr",
            "ed.cr",
            "fi.cr",
            "go.cr",
            "or.cr",
            "sa.cr",
            "cu",
            "com.cu",
            "edu.cu",
            "org.cu",
            "net.cu",
            "gov.cu",
            "inf.cu",
            "cv",
            "cw",
            "com.cw",
            "edu.cw",
            "net.cw",
            "org.cw",
            "cx",
            "gov.cx",
            "cy",
            "ac.cy",
            "biz.cy",
            "com.cy",
            "ekloges.cy",
            "gov.cy",
            "ltd.cy",
            "name.cy",
            "net.cy",
            "org.cy",
            "parliament.cy",
            "press.cy",
            "pro.cy",
            "tm.cy",
            "cz",
            "de",
            "dj",
            "dk",
            "dm",
            "com.dm",
            "net.dm",
            "org.dm",
            "edu.dm",
            "gov.dm",
            "do",
            "art.do",
            "com.do",
            "edu.do",
            "gob.do",
            "gov.do",
            "mil.do",
            "net.do",
            "org.do",
            "sld.do",
            "web.do",
            "dz",
            "com.dz",
            "org.dz",
            "net.dz",
            "gov.dz",
            "edu.dz",
            "asso.dz",
            "pol.dz",
            "art.dz",
            "ec",
            "com.ec",
            "info.ec",
            "net.ec",
            "fin.ec",
            "k12.ec",
            "med.ec",
            "pro.ec",
            "org.ec",
            "edu.ec",
            "gov.ec",
            "gob.ec",
            "mil.ec",
            "edu",
            "ee",
            "edu.ee",
            "gov.ee",
            "riik.ee",
            "lib.ee",
            "med.ee",
            "com.ee",
            "pri.ee",
            "aip.ee",
            "org.ee",
            "fie.ee",
            "eg",
            "com.eg",
            "edu.eg",
            "eun.eg",
            "gov.eg",
            "mil.eg",
            "name.eg",
            "net.eg",
            "org.eg",
            "sci.eg",
            "*.er",
            "es",
            "com.es",
            "nom.es",
            "org.es",
            "gob.es",
            "edu.es",
            "et",
            "com.et",
            "gov.et",
            "org.et",
            "edu.et",
            "biz.et",
            "name.et",
            "info.et",
            "net.et",
            "eu",
            "fi",
            "aland.fi",
            "*.fj",
            "*.fk",
            "fm",
            "fo",
            "fr",
            "com.fr",
            "asso.fr",
            "nom.fr",
            "prd.fr",
            "presse.fr",
            "tm.fr",
            "aeroport.fr",
            "assedic.fr",
            "avocat.fr",
            "avoues.fr",
            "cci.fr",
            "chambagri.fr",
            "chirurgiens-dentistes.fr",
            "experts-comptables.fr",
            "geometre-expert.fr",
            "gouv.fr",
            "greta.fr",
            "huissier-justice.fr",
            "medecin.fr",
            "notaires.fr",
            "pharmacien.fr",
            "port.fr",
            "veterinaire.fr",
            "ga",
            "gb",
            "gd",
            "ge",
            "com.ge",
            "edu.ge",
            "gov.ge",
            "org.ge",
            "mil.ge",
            "net.ge",
            "pvt.ge",
            "gf",
            "gg",
            "co.gg",
            "net.gg",
            "org.gg",
            "gh",
            "com.gh",
            "edu.gh",
            "gov.gh",
            "org.gh",
            "mil.gh",
            "gi",
            "com.gi",
            "ltd.gi",
            "gov.gi",
            "mod.gi",
            "edu.gi",
            "org.gi",
            "gl",
            "co.gl",
            "com.gl",
            "edu.gl",
            "net.gl",
            "org.gl",
            "gm",
            "gn",
            "ac.gn",
            "com.gn",
            "edu.gn",
            "gov.gn",
            "org.gn",
            "net.gn",
            "gov",
            "gp",
            "com.gp",
            "net.gp",
            "mobi.gp",
            "edu.gp",
            "org.gp",
            "asso.gp",
            "gq",
            "gr",
            "com.gr",
            "edu.gr",
            "net.gr",
            "org.gr",
            "gov.gr",
            "gs",
            "gt",
            "com.gt",
            "edu.gt",
            "gob.gt",
            "ind.gt",
            "mil.gt",
            "net.gt",
            "org.gt",
            "gu",
            "com.gu",
            "edu.gu",
            "gov.gu",
            "guam.gu",
            "info.gu",
            "net.gu",
            "org.gu",
            "web.gu",
            "gw",
            "gy",
            "co.gy",
            "com.gy",
            "edu.gy",
            "gov.gy",
            "net.gy",
            "org.gy",
            "hk",
            "com.hk",
            "edu.hk",
            "gov.hk",
            "idv.hk",
            "net.hk",
            "org.hk",
            "公司.hk",
            "教育.hk",
            "敎育.hk",
            "政府.hk",
            "個人.hk",
            "个人.hk",
            "箇人.hk",
            "網络.hk",
            "网络.hk",
            "组織.hk",
            "網絡.hk",
            "网絡.hk",
            "组织.hk",
            "組織.hk",
            "組织.hk",
            "hm",
            "hn",
            "com.hn",
            "edu.hn",
            "org.hn",
            "net.hn",
            "mil.hn",
            "gob.hn",
            "hr",
            "iz.hr",
            "from.hr",
            "name.hr",
            "com.hr",
            "ht",
            "com.ht",
            "shop.ht",
            "firm.ht",
            "info.ht",
            "adult.ht",
            "net.ht",
            "pro.ht",
            "org.ht",
            "med.ht",
            "art.ht",
            "coop.ht",
            "pol.ht",
            "asso.ht",
            "edu.ht",
            "rel.ht",
            "gouv.ht",
            "perso.ht",
            "hu",
            "co.hu",
            "info.hu",
            "org.hu",
            "priv.hu",
            "sport.hu",
            "tm.hu",
            "2000.hu",
            "agrar.hu",
            "bolt.hu",
            "casino.hu",
            "city.hu",
            "erotica.hu",
            "erotika.hu",
            "film.hu",
            "forum.hu",
            "games.hu",
            "hotel.hu",
            "ingatlan.hu",
            "jogasz.hu",
            "konyvelo.hu",
            "lakas.hu",
            "media.hu",
            "news.hu",
            "reklam.hu",
            "sex.hu",
            "shop.hu",
            "suli.hu",
            "szex.hu",
            "tozsde.hu",
            "utazas.hu",
            "video.hu",
            "id",
            "ac.id",
            "biz.id",
            "co.id",
            "desa.id",
            "go.id",
            "mil.id",
            "my.id",
            "net.id",
            "or.id",
            "sch.id",
            "web.id",
            "ie",
            "gov.ie",
            "il",
            "ac.il",
            "co.il",
            "gov.il",
            "idf.il",
            "k12.il",
            "muni.il",
            "net.il",
            "org.il",
            "im",
            "ac.im",
            "co.im",
            "com.im",
            "ltd.co.im",
            "net.im",
            "org.im",
            "plc.co.im",
            "tt.im",
            "tv.im",
            "in",
            "co.in",
            "firm.in",
            "net.in",
            "org.in",
            "gen.in",
            "ind.in",
            "nic.in",
            "ac.in",
            "edu.in",
            "res.in",
            "gov.in",
            "mil.in",
            "info",
            "int",
            "eu.int",
            "io",
            "com.io",
            "iq",
            "gov.iq",
            "edu.iq",
            "mil.iq",
            "com.iq",
            "org.iq",
            "net.iq",
            "ir",
            "ac.ir",
            "co.ir",
            "gov.ir",
            "id.ir",
            "net.ir",
            "org.ir",
            "sch.ir",
            "ایران.ir",
            "ايران.ir",
            "is",
            "net.is",
            "com.is",
            "edu.is",
            "gov.is",
            "org.is",
            "int.is",
            "it",
            "gov.it",
            "edu.it",
            "abr.it",
            "abruzzo.it",
            "aosta-valley.it",
            "aostavalley.it",
            "bas.it",
            "basilicata.it",
            "cal.it",
            "calabria.it",
            "cam.it",
            "campania.it",
            "emilia-romagna.it",
            "emiliaromagna.it",
            "emr.it",
            "friuli-v-giulia.it",
            "friuli-ve-giulia.it",
            "friuli-vegiulia.it",
            "friuli-venezia-giulia.it",
            "friuli-veneziagiulia.it",
            "friuli-vgiulia.it",
            "friuliv-giulia.it",
            "friulive-giulia.it",
            "friulivegiulia.it",
            "friulivenezia-giulia.it",
            "friuliveneziagiulia.it",
            "friulivgiulia.it",
            "fvg.it",
            "laz.it",
            "lazio.it",
            "lig.it",
            "liguria.it",
            "lom.it",
            "lombardia.it",
            "lombardy.it",
            "lucania.it",
            "mar.it",
            "marche.it",
            "mol.it",
            "molise.it",
            "piedmont.it",
            "piemonte.it",
            "pmn.it",
            "pug.it",
            "puglia.it",
            "sar.it",
            "sardegna.it",
            "sardinia.it",
            "sic.it",
            "sicilia.it",
            "sicily.it",
            "taa.it",
            "tos.it",
            "toscana.it",
            "trentin-sud-tirol.it",
            "trentin-süd-tirol.it",
            "trentin-sudtirol.it",
            "trentin-südtirol.it",
            "trentin-sued-tirol.it",
            "trentin-suedtirol.it",
            "trentino-a-adige.it",
            "trentino-aadige.it",
            "trentino-alto-adige.it",
            "trentino-altoadige.it",
            "trentino-s-tirol.it",
            "trentino-stirol.it",
            "trentino-sud-tirol.it",
            "trentino-süd-tirol.it",
            "trentino-sudtirol.it",
            "trentino-südtirol.it",
            "trentino-sued-tirol.it",
            "trentino-suedtirol.it",
            "trentino.it",
            "trentinoa-adige.it",
            "trentinoaadige.it",
            "trentinoalto-adige.it",
            "trentinoaltoadige.it",
            "trentinos-tirol.it",
            "trentinostirol.it",
            "trentinosud-tirol.it",
            "trentinosüd-tirol.it",
            "trentinosudtirol.it",
            "trentinosüdtirol.it",
            "trentinosued-tirol.it",
            "trentinosuedtirol.it",
            "trentinsud-tirol.it",
            "trentinsüd-tirol.it",
            "trentinsudtirol.it",
            "trentinsüdtirol.it",
            "trentinsued-tirol.it",
            "trentinsuedtirol.it",
            "tuscany.it",
            "umb.it",
            "umbria.it",
            "val-d-aosta.it",
            "val-daosta.it",
            "vald-aosta.it",
            "valdaosta.it",
            "valle-aosta.it",
            "valle-d-aosta.it",
            "valle-daosta.it",
            "valleaosta.it",
            "valled-aosta.it",
            "valledaosta.it",
            "vallee-aoste.it",
            "vallée-aoste.it",
            "vallee-d-aoste.it",
            "vallée-d-aoste.it",
            "valleeaoste.it",
            "valléeaoste.it",
            "valleedaoste.it",
            "valléedaoste.it",
            "vao.it",
            "vda.it",
            "ven.it",
            "veneto.it",
            "ag.it",
            "agrigento.it",
            "al.it",
            "alessandria.it",
            "alto-adige.it",
            "altoadige.it",
            "an.it",
            "ancona.it",
            "andria-barletta-trani.it",
            "andria-trani-barletta.it",
            "andriabarlettatrani.it",
            "andriatranibarletta.it",
            "ao.it",
            "aosta.it",
            "aoste.it",
            "ap.it",
            "aq.it",
            "aquila.it",
            "ar.it",
            "arezzo.it",
            "ascoli-piceno.it",
            "ascolipiceno.it",
            "asti.it",
            "at.it",
            "av.it",
            "avellino.it",
            "ba.it",
            "balsan-sudtirol.it",
            "balsan-südtirol.it",
            "balsan-suedtirol.it",
            "balsan.it",
            "bari.it",
            "barletta-trani-andria.it",
            "barlettatraniandria.it",
            "belluno.it",
            "benevento.it",
            "bergamo.it",
            "bg.it",
            "bi.it",
            "biella.it",
            "bl.it",
            "bn.it",
            "bo.it",
            "bologna.it",
            "bolzano-altoadige.it",
            "bolzano.it",
            "bozen-sudtirol.it",
            "bozen-südtirol.it",
            "bozen-suedtirol.it",
            "bozen.it",
            "br.it",
            "brescia.it",
            "brindisi.it",
            "bs.it",
            "bt.it",
            "bulsan-sudtirol.it",
            "bulsan-südtirol.it",
            "bulsan-suedtirol.it",
            "bulsan.it",
            "bz.it",
            "ca.it",
            "cagliari.it",
            "caltanissetta.it",
            "campidano-medio.it",
            "campidanomedio.it",
            "campobasso.it",
            "carbonia-iglesias.it",
            "carboniaiglesias.it",
            "carrara-massa.it",
            "carraramassa.it",
            "caserta.it",
            "catania.it",
            "catanzaro.it",
            "cb.it",
            "ce.it",
            "cesena-forli.it",
            "cesena-forlì.it",
            "cesenaforli.it",
            "cesenaforlì.it",
            "ch.it",
            "chieti.it",
            "ci.it",
            "cl.it",
            "cn.it",
            "co.it",
            "como.it",
            "cosenza.it",
            "cr.it",
            "cremona.it",
            "crotone.it",
            "cs.it",
            "ct.it",
            "cuneo.it",
            "cz.it",
            "dell-ogliastra.it",
            "dellogliastra.it",
            "en.it",
            "enna.it",
            "fc.it",
            "fe.it",
            "fermo.it",
            "ferrara.it",
            "fg.it",
            "fi.it",
            "firenze.it",
            "florence.it",
            "fm.it",
            "foggia.it",
            "forli-cesena.it",
            "forlì-cesena.it",
            "forlicesena.it",
            "forlìcesena.it",
            "fr.it",
            "frosinone.it",
            "ge.it",
            "genoa.it",
            "genova.it",
            "go.it",
            "gorizia.it",
            "gr.it",
            "grosseto.it",
            "iglesias-carbonia.it",
            "iglesiascarbonia.it",
            "im.it",
            "imperia.it",
            "is.it",
            "isernia.it",
            "kr.it",
            "la-spezia.it",
            "laquila.it",
            "laspezia.it",
            "latina.it",
            "lc.it",
            "le.it",
            "lecce.it",
            "lecco.it",
            "li.it",
            "livorno.it",
            "lo.it",
            "lodi.it",
            "lt.it",
            "lu.it",
            "lucca.it",
            "macerata.it",
            "mantova.it",
            "massa-carrara.it",
            "massacarrara.it",
            "matera.it",
            "mb.it",
            "mc.it",
            "me.it",
            "medio-campidano.it",
            "mediocampidano.it",
            "messina.it",
            "mi.it",
            "milan.it",
            "milano.it",
            "mn.it",
            "mo.it",
            "modena.it",
            "monza-brianza.it",
            "monza-e-della-brianza.it",
            "monza.it",
            "monzabrianza.it",
            "monzaebrianza.it",
            "monzaedellabrianza.it",
            "ms.it",
            "mt.it",
            "na.it",
            "naples.it",
            "napoli.it",
            "no.it",
            "novara.it",
            "nu.it",
            "nuoro.it",
            "og.it",
            "ogliastra.it",
            "olbia-tempio.it",
            "olbiatempio.it",
            "or.it",
            "oristano.it",
            "ot.it",
            "pa.it",
            "padova.it",
            "padua.it",
            "palermo.it",
            "parma.it",
            "pavia.it",
            "pc.it",
            "pd.it",
            "pe.it",
            "perugia.it",
            "pesaro-urbino.it",
            "pesarourbino.it",
            "pescara.it",
            "pg.it",
            "pi.it",
            "piacenza.it",
            "pisa.it",
            "pistoia.it",
            "pn.it",
            "po.it",
            "pordenone.it",
            "potenza.it",
            "pr.it",
            "prato.it",
            "pt.it",
            "pu.it",
            "pv.it",
            "pz.it",
            "ra.it",
            "ragusa.it",
            "ravenna.it",
            "rc.it",
            "re.it",
            "reggio-calabria.it",
            "reggio-emilia.it",
            "reggiocalabria.it",
            "reggioemilia.it",
            "rg.it",
            "ri.it",
            "rieti.it",
            "rimini.it",
            "rm.it",
            "rn.it",
            "ro.it",
            "roma.it",
            "rome.it",
            "rovigo.it",
            "sa.it",
            "salerno.it",
            "sassari.it",
            "savona.it",
            "si.it",
            "siena.it",
            "siracusa.it",
            "so.it",
            "sondrio.it",
            "sp.it",
            "sr.it",
            "ss.it",
            "suedtirol.it",
            "südtirol.it",
            "sv.it",
            "ta.it",
            "taranto.it",
            "te.it",
            "tempio-olbia.it",
            "tempioolbia.it",
            "teramo.it",
            "terni.it",
            "tn.it",
            "to.it",
            "torino.it",
            "tp.it",
            "tr.it",
            "trani-andria-barletta.it",
            "trani-barletta-andria.it",
            "traniandriabarletta.it",
            "tranibarlettaandria.it",
            "trapani.it",
            "trento.it",
            "treviso.it",
            "trieste.it",
            "ts.it",
            "turin.it",
            "tv.it",
            "ud.it",
            "udine.it",
            "urbino-pesaro.it",
            "urbinopesaro.it",
            "va.it",
            "varese.it",
            "vb.it",
            "vc.it",
            "ve.it",
            "venezia.it",
            "venice.it",
            "verbania.it",
            "vercelli.it",
            "verona.it",
            "vi.it",
            "vibo-valentia.it",
            "vibovalentia.it",
            "vicenza.it",
            "viterbo.it",
            "vr.it",
            "vs.it",
            "vt.it",
            "vv.it",
            "je",
            "co.je",
            "net.je",
            "org.je",
            "*.jm",
            "jo",
            "com.jo",
            "org.jo",
            "net.jo",
            "edu.jo",
            "sch.jo",
            "gov.jo",
            "mil.jo",
            "name.jo",
            "jobs",
            "jp",
            "ac.jp",
            "ad.jp",
            "co.jp",
            "ed.jp",
            "go.jp",
            "gr.jp",
            "lg.jp",
            "ne.jp",
            "or.jp",
            "aichi.jp",
            "akita.jp",
            "aomori.jp",
            "chiba.jp",
            "ehime.jp",
            "fukui.jp",
            "fukuoka.jp",
            "fukushima.jp",
            "gifu.jp",
            "gunma.jp",
            "hiroshima.jp",
            "hokkaido.jp",
            "hyogo.jp",
            "ibaraki.jp",
            "ishikawa.jp",
            "iwate.jp",
            "kagawa.jp",
            "kagoshima.jp",
            "kanagawa.jp",
            "kochi.jp",
            "kumamoto.jp",
            "kyoto.jp",
            "mie.jp",
            "miyagi.jp",
            "miyazaki.jp",
            "nagano.jp",
            "nagasaki.jp",
            "nara.jp",
            "niigata.jp",
            "oita.jp",
            "okayama.jp",
            "okinawa.jp",
            "osaka.jp",
            "saga.jp",
            "saitama.jp",
            "shiga.jp",
            "shimane.jp",
            "shizuoka.jp",
            "tochigi.jp",
            "tokushima.jp",
            "tokyo.jp",
            "tottori.jp",
            "toyama.jp",
            "wakayama.jp",
            "yamagata.jp",
            "yamaguchi.jp",
            "yamanashi.jp",
            "栃木.jp",
            "愛知.jp",
            "愛媛.jp",
            "兵庫.jp",
            "熊本.jp",
            "茨城.jp",
            "北海道.jp",
            "千葉.jp",
            "和歌山.jp",
            "長崎.jp",
            "長野.jp",
            "新潟.jp",
            "青森.jp",
            "静岡.jp",
            "東京.jp",
            "石川.jp",
            "埼玉.jp",
            "三重.jp",
            "京都.jp",
            "佐賀.jp",
            "大分.jp",
            "大阪.jp",
            "奈良.jp",
            "宮城.jp",
            "宮崎.jp",
            "富山.jp",
            "山口.jp",
            "山形.jp",
            "山梨.jp",
            "岩手.jp",
            "岐阜.jp",
            "岡山.jp",
            "島根.jp",
            "広島.jp",
            "徳島.jp",
            "沖縄.jp",
            "滋賀.jp",
            "神奈川.jp",
            "福井.jp",
            "福岡.jp",
            "福島.jp",
            "秋田.jp",
            "群馬.jp",
            "香川.jp",
            "高知.jp",
            "鳥取.jp",
            "鹿児島.jp",
            "*.kawasaki.jp",
            "*.kitakyushu.jp",
            "*.kobe.jp",
            "*.nagoya.jp",
            "*.sapporo.jp",
            "*.sendai.jp",
            "*.yokohama.jp",
            "!city.kawasaki.jp",
            "!city.kitakyushu.jp",
            "!city.kobe.jp",
            "!city.nagoya.jp",
            "!city.sapporo.jp",
            "!city.sendai.jp",
            "!city.yokohama.jp",
            "aisai.aichi.jp",
            "ama.aichi.jp",
            "anjo.aichi.jp",
            "asuke.aichi.jp",
            "chiryu.aichi.jp",
            "chita.aichi.jp",
            "fuso.aichi.jp",
            "gamagori.aichi.jp",
            "handa.aichi.jp",
            "hazu.aichi.jp",
            "hekinan.aichi.jp",
            "higashiura.aichi.jp",
            "ichinomiya.aichi.jp",
            "inazawa.aichi.jp",
            "inuyama.aichi.jp",
            "isshiki.aichi.jp",
            "iwakura.aichi.jp",
            "kanie.aichi.jp",
            "kariya.aichi.jp",
            "kasugai.aichi.jp",
            "kira.aichi.jp",
            "kiyosu.aichi.jp",
            "komaki.aichi.jp",
            "konan.aichi.jp",
            "kota.aichi.jp",
            "mihama.aichi.jp",
            "miyoshi.aichi.jp",
            "nishio.aichi.jp",
            "nisshin.aichi.jp",
            "obu.aichi.jp",
            "oguchi.aichi.jp",
            "oharu.aichi.jp",
            "okazaki.aichi.jp",
            "owariasahi.aichi.jp",
            "seto.aichi.jp",
            "shikatsu.aichi.jp",
            "shinshiro.aichi.jp",
            "shitara.aichi.jp",
            "tahara.aichi.jp",
            "takahama.aichi.jp",
            "tobishima.aichi.jp",
            "toei.aichi.jp",
            "togo.aichi.jp",
            "tokai.aichi.jp",
            "tokoname.aichi.jp",
            "toyoake.aichi.jp",
            "toyohashi.aichi.jp",
            "toyokawa.aichi.jp",
            "toyone.aichi.jp",
            "toyota.aichi.jp",
            "tsushima.aichi.jp",
            "yatomi.aichi.jp",
            "akita.akita.jp",
            "daisen.akita.jp",
            "fujisato.akita.jp",
            "gojome.akita.jp",
            "hachirogata.akita.jp",
            "happou.akita.jp",
            "higashinaruse.akita.jp",
            "honjo.akita.jp",
            "honjyo.akita.jp",
            "ikawa.akita.jp",
            "kamikoani.akita.jp",
            "kamioka.akita.jp",
            "katagami.akita.jp",
            "kazuno.akita.jp",
            "kitaakita.akita.jp",
            "kosaka.akita.jp",
            "kyowa.akita.jp",
            "misato.akita.jp",
            "mitane.akita.jp",
            "moriyoshi.akita.jp",
            "nikaho.akita.jp",
            "noshiro.akita.jp",
            "odate.akita.jp",
            "oga.akita.jp",
            "ogata.akita.jp",
            "semboku.akita.jp",
            "yokote.akita.jp",
            "yurihonjo.akita.jp",
            "aomori.aomori.jp",
            "gonohe.aomori.jp",
            "hachinohe.aomori.jp",
            "hashikami.aomori.jp",
            "hiranai.aomori.jp",
            "hirosaki.aomori.jp",
            "itayanagi.aomori.jp",
            "kuroishi.aomori.jp",
            "misawa.aomori.jp",
            "mutsu.aomori.jp",
            "nakadomari.aomori.jp",
            "noheji.aomori.jp",
            "oirase.aomori.jp",
            "owani.aomori.jp",
            "rokunohe.aomori.jp",
            "sannohe.aomori.jp",
            "shichinohe.aomori.jp",
            "shingo.aomori.jp",
            "takko.aomori.jp",
            "towada.aomori.jp",
            "tsugaru.aomori.jp",
            "tsuruta.aomori.jp",
            "abiko.chiba.jp",
            "asahi.chiba.jp",
            "chonan.chiba.jp",
            "chosei.chiba.jp",
            "choshi.chiba.jp",
            "chuo.chiba.jp",
            "funabashi.chiba.jp",
            "futtsu.chiba.jp",
            "hanamigawa.chiba.jp",
            "ichihara.chiba.jp",
            "ichikawa.chiba.jp",
            "ichinomiya.chiba.jp",
            "inzai.chiba.jp",
            "isumi.chiba.jp",
            "kamagaya.chiba.jp",
            "kamogawa.chiba.jp",
            "kashiwa.chiba.jp",
            "katori.chiba.jp",
            "katsuura.chiba.jp",
            "kimitsu.chiba.jp",
            "kisarazu.chiba.jp",
            "kozaki.chiba.jp",
            "kujukuri.chiba.jp",
            "kyonan.chiba.jp",
            "matsudo.chiba.jp",
            "midori.chiba.jp",
            "mihama.chiba.jp",
            "minamiboso.chiba.jp",
            "mobara.chiba.jp",
            "mutsuzawa.chiba.jp",
            "nagara.chiba.jp",
            "nagareyama.chiba.jp",
            "narashino.chiba.jp",
            "narita.chiba.jp",
            "noda.chiba.jp",
            "oamishirasato.chiba.jp",
            "omigawa.chiba.jp",
            "onjuku.chiba.jp",
            "otaki.chiba.jp",
            "sakae.chiba.jp",
            "sakura.chiba.jp",
            "shimofusa.chiba.jp",
            "shirako.chiba.jp",
            "shiroi.chiba.jp",
            "shisui.chiba.jp",
            "sodegaura.chiba.jp",
            "sosa.chiba.jp",
            "tako.chiba.jp",
            "tateyama.chiba.jp",
            "togane.chiba.jp",
            "tohnosho.chiba.jp",
            "tomisato.chiba.jp",
            "urayasu.chiba.jp",
            "yachimata.chiba.jp",
            "yachiyo.chiba.jp",
            "yokaichiba.chiba.jp",
            "yokoshibahikari.chiba.jp",
            "yotsukaido.chiba.jp",
            "ainan.ehime.jp",
            "honai.ehime.jp",
            "ikata.ehime.jp",
            "imabari.ehime.jp",
            "iyo.ehime.jp",
            "kamijima.ehime.jp",
            "kihoku.ehime.jp",
            "kumakogen.ehime.jp",
            "masaki.ehime.jp",
            "matsuno.ehime.jp",
            "matsuyama.ehime.jp",
            "namikata.ehime.jp",
            "niihama.ehime.jp",
            "ozu.ehime.jp",
            "saijo.ehime.jp",
            "seiyo.ehime.jp",
            "shikokuchuo.ehime.jp",
            "tobe.ehime.jp",
            "toon.ehime.jp",
            "uchiko.ehime.jp",
            "uwajima.ehime.jp",
            "yawatahama.ehime.jp",
            "echizen.fukui.jp",
            "eiheiji.fukui.jp",
            "fukui.fukui.jp",
            "ikeda.fukui.jp",
            "katsuyama.fukui.jp",
            "mihama.fukui.jp",
            "minamiechizen.fukui.jp",
            "obama.fukui.jp",
            "ohi.fukui.jp",
            "ono.fukui.jp",
            "sabae.fukui.jp",
            "sakai.fukui.jp",
            "takahama.fukui.jp",
            "tsuruga.fukui.jp",
            "wakasa.fukui.jp",
            "ashiya.fukuoka.jp",
            "buzen.fukuoka.jp",
            "chikugo.fukuoka.jp",
            "chikuho.fukuoka.jp",
            "chikujo.fukuoka.jp",
            "chikushino.fukuoka.jp",
            "chikuzen.fukuoka.jp",
            "chuo.fukuoka.jp",
            "dazaifu.fukuoka.jp",
            "fukuchi.fukuoka.jp",
            "hakata.fukuoka.jp",
            "higashi.fukuoka.jp",
            "hirokawa.fukuoka.jp",
            "hisayama.fukuoka.jp",
            "iizuka.fukuoka.jp",
            "inatsuki.fukuoka.jp",
            "kaho.fukuoka.jp",
            "kasuga.fukuoka.jp",
            "kasuya.fukuoka.jp",
            "kawara.fukuoka.jp",
            "keisen.fukuoka.jp",
            "koga.fukuoka.jp",
            "kurate.fukuoka.jp",
            "kurogi.fukuoka.jp",
            "kurume.fukuoka.jp",
            "minami.fukuoka.jp",
            "miyako.fukuoka.jp",
            "miyama.fukuoka.jp",
            "miyawaka.fukuoka.jp",
            "mizumaki.fukuoka.jp",
            "munakata.fukuoka.jp",
            "nakagawa.fukuoka.jp",
            "nakama.fukuoka.jp",
            "nishi.fukuoka.jp",
            "nogata.fukuoka.jp",
            "ogori.fukuoka.jp",
            "okagaki.fukuoka.jp",
            "okawa.fukuoka.jp",
            "oki.fukuoka.jp",
            "omuta.fukuoka.jp",
            "onga.fukuoka.jp",
            "onojo.fukuoka.jp",
            "oto.fukuoka.jp",
            "saigawa.fukuoka.jp",
            "sasaguri.fukuoka.jp",
            "shingu.fukuoka.jp",
            "shinyoshitomi.fukuoka.jp",
            "shonai.fukuoka.jp",
            "soeda.fukuoka.jp",
            "sue.fukuoka.jp",
            "tachiarai.fukuoka.jp",
            "tagawa.fukuoka.jp",
            "takata.fukuoka.jp",
            "toho.fukuoka.jp",
            "toyotsu.fukuoka.jp",
            "tsuiki.fukuoka.jp",
            "ukiha.fukuoka.jp",
            "umi.fukuoka.jp",
            "usui.fukuoka.jp",
            "yamada.fukuoka.jp",
            "yame.fukuoka.jp",
            "yanagawa.fukuoka.jp",
            "yukuhashi.fukuoka.jp",
            "aizubange.fukushima.jp",
            "aizumisato.fukushima.jp",
            "aizuwakamatsu.fukushima.jp",
            "asakawa.fukushima.jp",
            "bandai.fukushima.jp",
            "date.fukushima.jp",
            "fukushima.fukushima.jp",
            "furudono.fukushima.jp",
            "futaba.fukushima.jp",
            "hanawa.fukushima.jp",
            "higashi.fukushima.jp",
            "hirata.fukushima.jp",
            "hirono.fukushima.jp",
            "iitate.fukushima.jp",
            "inawashiro.fukushima.jp",
            "ishikawa.fukushima.jp",
            "iwaki.fukushima.jp",
            "izumizaki.fukushima.jp",
            "kagamiishi.fukushima.jp",
            "kaneyama.fukushima.jp",
            "kawamata.fukushima.jp",
            "kitakata.fukushima.jp",
            "kitashiobara.fukushima.jp",
            "koori.fukushima.jp",
            "koriyama.fukushima.jp",
            "kunimi.fukushima.jp",
            "miharu.fukushima.jp",
            "mishima.fukushima.jp",
            "namie.fukushima.jp",
            "nango.fukushima.jp",
            "nishiaizu.fukushima.jp",
            "nishigo.fukushima.jp",
            "okuma.fukushima.jp",
            "omotego.fukushima.jp",
            "ono.fukushima.jp",
            "otama.fukushima.jp",
            "samegawa.fukushima.jp",
            "shimogo.fukushima.jp",
            "shirakawa.fukushima.jp",
            "showa.fukushima.jp",
            "soma.fukushima.jp",
            "sukagawa.fukushima.jp",
            "taishin.fukushima.jp",
            "tamakawa.fukushima.jp",
            "tanagura.fukushima.jp",
            "tenei.fukushima.jp",
            "yabuki.fukushima.jp",
            "yamato.fukushima.jp",
            "yamatsuri.fukushima.jp",
            "yanaizu.fukushima.jp",
            "yugawa.fukushima.jp",
            "anpachi.gifu.jp",
            "ena.gifu.jp",
            "gifu.gifu.jp",
            "ginan.gifu.jp",
            "godo.gifu.jp",
            "gujo.gifu.jp",
            "hashima.gifu.jp",
            "hichiso.gifu.jp",
            "hida.gifu.jp",
            "higashishirakawa.gifu.jp",
            "ibigawa.gifu.jp",
            "ikeda.gifu.jp",
            "kakamigahara.gifu.jp",
            "kani.gifu.jp",
            "kasahara.gifu.jp",
            "kasamatsu.gifu.jp",
            "kawaue.gifu.jp",
            "kitagata.gifu.jp",
            "mino.gifu.jp",
            "minokamo.gifu.jp",
            "mitake.gifu.jp",
            "mizunami.gifu.jp",
            "motosu.gifu.jp",
            "nakatsugawa.gifu.jp",
            "ogaki.gifu.jp",
            "sakahogi.gifu.jp",
            "seki.gifu.jp",
            "sekigahara.gifu.jp",
            "shirakawa.gifu.jp",
            "tajimi.gifu.jp",
            "takayama.gifu.jp",
            "tarui.gifu.jp",
            "toki.gifu.jp",
            "tomika.gifu.jp",
            "wanouchi.gifu.jp",
            "yamagata.gifu.jp",
            "yaotsu.gifu.jp",
            "yoro.gifu.jp",
            "annaka.gunma.jp",
            "chiyoda.gunma.jp",
            "fujioka.gunma.jp",
            "higashiagatsuma.gunma.jp",
            "isesaki.gunma.jp",
            "itakura.gunma.jp",
            "kanna.gunma.jp",
            "kanra.gunma.jp",
            "katashina.gunma.jp",
            "kawaba.gunma.jp",
            "kiryu.gunma.jp",
            "kusatsu.gunma.jp",
            "maebashi.gunma.jp",
            "meiwa.gunma.jp",
            "midori.gunma.jp",
            "minakami.gunma.jp",
            "naganohara.gunma.jp",
            "nakanojo.gunma.jp",
            "nanmoku.gunma.jp",
            "numata.gunma.jp",
            "oizumi.gunma.jp",
            "ora.gunma.jp",
            "ota.gunma.jp",
            "shibukawa.gunma.jp",
            "shimonita.gunma.jp",
            "shinto.gunma.jp",
            "showa.gunma.jp",
            "takasaki.gunma.jp",
            "takayama.gunma.jp",
            "tamamura.gunma.jp",
            "tatebayashi.gunma.jp",
            "tomioka.gunma.jp",
            "tsukiyono.gunma.jp",
            "tsumagoi.gunma.jp",
            "ueno.gunma.jp",
            "yoshioka.gunma.jp",
            "asaminami.hiroshima.jp",
            "daiwa.hiroshima.jp",
            "etajima.hiroshima.jp",
            "fuchu.hiroshima.jp",
            "fukuyama.hiroshima.jp",
            "hatsukaichi.hiroshima.jp",
            "higashihiroshima.hiroshima.jp",
            "hongo.hiroshima.jp",
            "jinsekikogen.hiroshima.jp",
            "kaita.hiroshima.jp",
            "kui.hiroshima.jp",
            "kumano.hiroshima.jp",
            "kure.hiroshima.jp",
            "mihara.hiroshima.jp",
            "miyoshi.hiroshima.jp",
            "naka.hiroshima.jp",
            "onomichi.hiroshima.jp",
            "osakikamijima.hiroshima.jp",
            "otake.hiroshima.jp",
            "saka.hiroshima.jp",
            "sera.hiroshima.jp",
            "seranishi.hiroshima.jp",
            "shinichi.hiroshima.jp",
            "shobara.hiroshima.jp",
            "takehara.hiroshima.jp",
            "abashiri.hokkaido.jp",
            "abira.hokkaido.jp",
            "aibetsu.hokkaido.jp",
            "akabira.hokkaido.jp",
            "akkeshi.hokkaido.jp",
            "asahikawa.hokkaido.jp",
            "ashibetsu.hokkaido.jp",
            "ashoro.hokkaido.jp",
            "assabu.hokkaido.jp",
            "atsuma.hokkaido.jp",
            "bibai.hokkaido.jp",
            "biei.hokkaido.jp",
            "bifuka.hokkaido.jp",
            "bihoro.hokkaido.jp",
            "biratori.hokkaido.jp",
            "chippubetsu.hokkaido.jp",
            "chitose.hokkaido.jp",
            "date.hokkaido.jp",
            "ebetsu.hokkaido.jp",
            "embetsu.hokkaido.jp",
            "eniwa.hokkaido.jp",
            "erimo.hokkaido.jp",
            "esan.hokkaido.jp",
            "esashi.hokkaido.jp",
            "fukagawa.hokkaido.jp",
            "fukushima.hokkaido.jp",
            "furano.hokkaido.jp",
            "furubira.hokkaido.jp",
            "haboro.hokkaido.jp",
            "hakodate.hokkaido.jp",
            "hamatonbetsu.hokkaido.jp",
            "hidaka.hokkaido.jp",
            "higashikagura.hokkaido.jp",
            "higashikawa.hokkaido.jp",
            "hiroo.hokkaido.jp",
            "hokuryu.hokkaido.jp",
            "hokuto.hokkaido.jp",
            "honbetsu.hokkaido.jp",
            "horokanai.hokkaido.jp",
            "horonobe.hokkaido.jp",
            "ikeda.hokkaido.jp",
            "imakane.hokkaido.jp",
            "ishikari.hokkaido.jp",
            "iwamizawa.hokkaido.jp",
            "iwanai.hokkaido.jp",
            "kamifurano.hokkaido.jp",
            "kamikawa.hokkaido.jp",
            "kamishihoro.hokkaido.jp",
            "kamisunagawa.hokkaido.jp",
            "kamoenai.hokkaido.jp",
            "kayabe.hokkaido.jp",
            "kembuchi.hokkaido.jp",
            "kikonai.hokkaido.jp",
            "kimobetsu.hokkaido.jp",
            "kitahiroshima.hokkaido.jp",
            "kitami.hokkaido.jp",
            "kiyosato.hokkaido.jp",
            "koshimizu.hokkaido.jp",
            "kunneppu.hokkaido.jp",
            "kuriyama.hokkaido.jp",
            "kuromatsunai.hokkaido.jp",
            "kushiro.hokkaido.jp",
            "kutchan.hokkaido.jp",
            "kyowa.hokkaido.jp",
            "mashike.hokkaido.jp",
            "matsumae.hokkaido.jp",
            "mikasa.hokkaido.jp",
            "minamifurano.hokkaido.jp",
            "mombetsu.hokkaido.jp",
            "moseushi.hokkaido.jp",
            "mukawa.hokkaido.jp",
            "muroran.hokkaido.jp",
            "naie.hokkaido.jp",
            "nakagawa.hokkaido.jp",
            "nakasatsunai.hokkaido.jp",
            "nakatombetsu.hokkaido.jp",
            "nanae.hokkaido.jp",
            "nanporo.hokkaido.jp",
            "nayoro.hokkaido.jp",
            "nemuro.hokkaido.jp",
            "niikappu.hokkaido.jp",
            "niki.hokkaido.jp",
            "nishiokoppe.hokkaido.jp",
            "noboribetsu.hokkaido.jp",
            "numata.hokkaido.jp",
            "obihiro.hokkaido.jp",
            "obira.hokkaido.jp",
            "oketo.hokkaido.jp",
            "okoppe.hokkaido.jp",
            "otaru.hokkaido.jp",
            "otobe.hokkaido.jp",
            "otofuke.hokkaido.jp",
            "otoineppu.hokkaido.jp",
            "oumu.hokkaido.jp",
            "ozora.hokkaido.jp",
            "pippu.hokkaido.jp",
            "rankoshi.hokkaido.jp",
            "rebun.hokkaido.jp",
            "rikubetsu.hokkaido.jp",
            "rishiri.hokkaido.jp",
            "rishirifuji.hokkaido.jp",
            "saroma.hokkaido.jp",
            "sarufutsu.hokkaido.jp",
            "shakotan.hokkaido.jp",
            "shari.hokkaido.jp",
            "shibecha.hokkaido.jp",
            "shibetsu.hokkaido.jp",
            "shikabe.hokkaido.jp",
            "shikaoi.hokkaido.jp",
            "shimamaki.hokkaido.jp",
            "shimizu.hokkaido.jp",
            "shimokawa.hokkaido.jp",
            "shinshinotsu.hokkaido.jp",
            "shintoku.hokkaido.jp",
            "shiranuka.hokkaido.jp",
            "shiraoi.hokkaido.jp",
            "shiriuchi.hokkaido.jp",
            "sobetsu.hokkaido.jp",
            "sunagawa.hokkaido.jp",
            "taiki.hokkaido.jp",
            "takasu.hokkaido.jp",
            "takikawa.hokkaido.jp",
            "takinoue.hokkaido.jp",
            "teshikaga.hokkaido.jp",
            "tobetsu.hokkaido.jp",
            "tohma.hokkaido.jp",
            "tomakomai.hokkaido.jp",
            "tomari.hokkaido.jp",
            "toya.hokkaido.jp",
            "toyako.hokkaido.jp",
            "toyotomi.hokkaido.jp",
            "toyoura.hokkaido.jp",
            "tsubetsu.hokkaido.jp",
            "tsukigata.hokkaido.jp",
            "urakawa.hokkaido.jp",
            "urausu.hokkaido.jp",
            "uryu.hokkaido.jp",
            "utashinai.hokkaido.jp",
            "wakkanai.hokkaido.jp",
            "wassamu.hokkaido.jp",
            "yakumo.hokkaido.jp",
            "yoichi.hokkaido.jp",
            "aioi.hyogo.jp",
            "akashi.hyogo.jp",
            "ako.hyogo.jp",
            "amagasaki.hyogo.jp",
            "aogaki.hyogo.jp",
            "asago.hyogo.jp",
            "ashiya.hyogo.jp",
            "awaji.hyogo.jp",
            "fukusaki.hyogo.jp",
            "goshiki.hyogo.jp",
            "harima.hyogo.jp",
            "himeji.hyogo.jp",
            "ichikawa.hyogo.jp",
            "inagawa.hyogo.jp",
            "itami.hyogo.jp",
            "kakogawa.hyogo.jp",
            "kamigori.hyogo.jp",
            "kamikawa.hyogo.jp",
            "kasai.hyogo.jp",
            "kasuga.hyogo.jp",
            "kawanishi.hyogo.jp",
            "miki.hyogo.jp",
            "minamiawaji.hyogo.jp",
            "nishinomiya.hyogo.jp",
            "nishiwaki.hyogo.jp",
            "ono.hyogo.jp",
            "sanda.hyogo.jp",
            "sannan.hyogo.jp",
            "sasayama.hyogo.jp",
            "sayo.hyogo.jp",
            "shingu.hyogo.jp",
            "shinonsen.hyogo.jp",
            "shiso.hyogo.jp",
            "sumoto.hyogo.jp",
            "taishi.hyogo.jp",
            "taka.hyogo.jp",
            "takarazuka.hyogo.jp",
            "takasago.hyogo.jp",
            "takino.hyogo.jp",
            "tamba.hyogo.jp",
            "tatsuno.hyogo.jp",
            "toyooka.hyogo.jp",
            "yabu.hyogo.jp",
            "yashiro.hyogo.jp",
            "yoka.hyogo.jp",
            "yokawa.hyogo.jp",
            "ami.ibaraki.jp",
            "asahi.ibaraki.jp",
            "bando.ibaraki.jp",
            "chikusei.ibaraki.jp",
            "daigo.ibaraki.jp",
            "fujishiro.ibaraki.jp",
            "hitachi.ibaraki.jp",
            "hitachinaka.ibaraki.jp",
            "hitachiomiya.ibaraki.jp",
            "hitachiota.ibaraki.jp",
            "ibaraki.ibaraki.jp",
            "ina.ibaraki.jp",
            "inashiki.ibaraki.jp",
            "itako.ibaraki.jp",
            "iwama.ibaraki.jp",
            "joso.ibaraki.jp",
            "kamisu.ibaraki.jp",
            "kasama.ibaraki.jp",
            "kashima.ibaraki.jp",
            "kasumigaura.ibaraki.jp",
            "koga.ibaraki.jp",
            "miho.ibaraki.jp",
            "mito.ibaraki.jp",
            "moriya.ibaraki.jp",
            "naka.ibaraki.jp",
            "namegata.ibaraki.jp",
            "oarai.ibaraki.jp",
            "ogawa.ibaraki.jp",
            "omitama.ibaraki.jp",
            "ryugasaki.ibaraki.jp",
            "sakai.ibaraki.jp",
            "sakuragawa.ibaraki.jp",
            "shimodate.ibaraki.jp",
            "shimotsuma.ibaraki.jp",
            "shirosato.ibaraki.jp",
            "sowa.ibaraki.jp",
            "suifu.ibaraki.jp",
            "takahagi.ibaraki.jp",
            "tamatsukuri.ibaraki.jp",
            "tokai.ibaraki.jp",
            "tomobe.ibaraki.jp",
            "tone.ibaraki.jp",
            "toride.ibaraki.jp",
            "tsuchiura.ibaraki.jp",
            "tsukuba.ibaraki.jp",
            "uchihara.ibaraki.jp",
            "ushiku.ibaraki.jp",
            "yachiyo.ibaraki.jp",
            "yamagata.ibaraki.jp",
            "yawara.ibaraki.jp",
            "yuki.ibaraki.jp",
            "anamizu.ishikawa.jp",
            "hakui.ishikawa.jp",
            "hakusan.ishikawa.jp",
            "kaga.ishikawa.jp",
            "kahoku.ishikawa.jp",
            "kanazawa.ishikawa.jp",
            "kawakita.ishikawa.jp",
            "komatsu.ishikawa.jp",
            "nakanoto.ishikawa.jp",
            "nanao.ishikawa.jp",
            "nomi.ishikawa.jp",
            "nonoichi.ishikawa.jp",
            "noto.ishikawa.jp",
            "shika.ishikawa.jp",
            "suzu.ishikawa.jp",
            "tsubata.ishikawa.jp",
            "tsurugi.ishikawa.jp",
            "uchinada.ishikawa.jp",
            "wajima.ishikawa.jp",
            "fudai.iwate.jp",
            "fujisawa.iwate.jp",
            "hanamaki.iwate.jp",
            "hiraizumi.iwate.jp",
            "hirono.iwate.jp",
            "ichinohe.iwate.jp",
            "ichinoseki.iwate.jp",
            "iwaizumi.iwate.jp",
            "iwate.iwate.jp",
            "joboji.iwate.jp",
            "kamaishi.iwate.jp",
            "kanegasaki.iwate.jp",
            "karumai.iwate.jp",
            "kawai.iwate.jp",
            "kitakami.iwate.jp",
            "kuji.iwate.jp",
            "kunohe.iwate.jp",
            "kuzumaki.iwate.jp",
            "miyako.iwate.jp",
            "mizusawa.iwate.jp",
            "morioka.iwate.jp",
            "ninohe.iwate.jp",
            "noda.iwate.jp",
            "ofunato.iwate.jp",
            "oshu.iwate.jp",
            "otsuchi.iwate.jp",
            "rikuzentakata.iwate.jp",
            "shiwa.iwate.jp",
            "shizukuishi.iwate.jp",
            "sumita.iwate.jp",
            "tanohata.iwate.jp",
            "tono.iwate.jp",
            "yahaba.iwate.jp",
            "yamada.iwate.jp",
            "ayagawa.kagawa.jp",
            "higashikagawa.kagawa.jp",
            "kanonji.kagawa.jp",
            "kotohira.kagawa.jp",
            "manno.kagawa.jp",
            "marugame.kagawa.jp",
            "mitoyo.kagawa.jp",
            "naoshima.kagawa.jp",
            "sanuki.kagawa.jp",
            "tadotsu.kagawa.jp",
            "takamatsu.kagawa.jp",
            "tonosho.kagawa.jp",
            "uchinomi.kagawa.jp",
            "utazu.kagawa.jp",
            "zentsuji.kagawa.jp",
            "akune.kagoshima.jp",
            "amami.kagoshima.jp",
            "hioki.kagoshima.jp",
            "isa.kagoshima.jp",
            "isen.kagoshima.jp",
            "izumi.kagoshima.jp",
            "kagoshima.kagoshima.jp",
            "kanoya.kagoshima.jp",
            "kawanabe.kagoshima.jp",
            "kinko.kagoshima.jp",
            "kouyama.kagoshima.jp",
            "makurazaki.kagoshima.jp",
            "matsumoto.kagoshima.jp",
            "minamitane.kagoshima.jp",
            "nakatane.kagoshima.jp",
            "nishinoomote.kagoshima.jp",
            "satsumasendai.kagoshima.jp",
            "soo.kagoshima.jp",
            "tarumizu.kagoshima.jp",
            "yusui.kagoshima.jp",
            "aikawa.kanagawa.jp",
            "atsugi.kanagawa.jp",
            "ayase.kanagawa.jp",
            "chigasaki.kanagawa.jp",
            "ebina.kanagawa.jp",
            "fujisawa.kanagawa.jp",
            "hadano.kanagawa.jp",
            "hakone.kanagawa.jp",
            "hiratsuka.kanagawa.jp",
            "isehara.kanagawa.jp",
            "kaisei.kanagawa.jp",
            "kamakura.kanagawa.jp",
            "kiyokawa.kanagawa.jp",
            "matsuda.kanagawa.jp",
            "minamiashigara.kanagawa.jp",
            "miura.kanagawa.jp",
            "nakai.kanagawa.jp",
            "ninomiya.kanagawa.jp",
            "odawara.kanagawa.jp",
            "oi.kanagawa.jp",
            "oiso.kanagawa.jp",
            "sagamihara.kanagawa.jp",
            "samukawa.kanagawa.jp",
            "tsukui.kanagawa.jp",
            "yamakita.kanagawa.jp",
            "yamato.kanagawa.jp",
            "yokosuka.kanagawa.jp",
            "yugawara.kanagawa.jp",
            "zama.kanagawa.jp",
            "zushi.kanagawa.jp",
            "aki.kochi.jp",
            "geisei.kochi.jp",
            "hidaka.kochi.jp",
            "higashitsuno.kochi.jp",
            "ino.kochi.jp",
            "kagami.kochi.jp",
            "kami.kochi.jp",
            "kitagawa.kochi.jp",
            "kochi.kochi.jp",
            "mihara.kochi.jp",
            "motoyama.kochi.jp",
            "muroto.kochi.jp",
            "nahari.kochi.jp",
            "nakamura.kochi.jp",
            "nankoku.kochi.jp",
            "nishitosa.kochi.jp",
            "niyodogawa.kochi.jp",
            "ochi.kochi.jp",
            "okawa.kochi.jp",
            "otoyo.kochi.jp",
            "otsuki.kochi.jp",
            "sakawa.kochi.jp",
            "sukumo.kochi.jp",
            "susaki.kochi.jp",
            "tosa.kochi.jp",
            "tosashimizu.kochi.jp",
            "toyo.kochi.jp",
            "tsuno.kochi.jp",
            "umaji.kochi.jp",
            "yasuda.kochi.jp",
            "yusuhara.kochi.jp",
            "amakusa.kumamoto.jp",
            "arao.kumamoto.jp",
            "aso.kumamoto.jp",
            "choyo.kumamoto.jp",
            "gyokuto.kumamoto.jp",
            "kamiamakusa.kumamoto.jp",
            "kikuchi.kumamoto.jp",
            "kumamoto.kumamoto.jp",
            "mashiki.kumamoto.jp",
            "mifune.kumamoto.jp",
            "minamata.kumamoto.jp",
            "minamioguni.kumamoto.jp",
            "nagasu.kumamoto.jp",
            "nishihara.kumamoto.jp",
            "oguni.kumamoto.jp",
            "ozu.kumamoto.jp",
            "sumoto.kumamoto.jp",
            "takamori.kumamoto.jp",
            "uki.kumamoto.jp",
            "uto.kumamoto.jp",
            "yamaga.kumamoto.jp",
            "yamato.kumamoto.jp",
            "yatsushiro.kumamoto.jp",
            "ayabe.kyoto.jp",
            "fukuchiyama.kyoto.jp",
            "higashiyama.kyoto.jp",
            "ide.kyoto.jp",
            "ine.kyoto.jp",
            "joyo.kyoto.jp",
            "kameoka.kyoto.jp",
            "kamo.kyoto.jp",
            "kita.kyoto.jp",
            "kizu.kyoto.jp",
            "kumiyama.kyoto.jp",
            "kyotamba.kyoto.jp",
            "kyotanabe.kyoto.jp",
            "kyotango.kyoto.jp",
            "maizuru.kyoto.jp",
            "minami.kyoto.jp",
            "minamiyamashiro.kyoto.jp",
            "miyazu.kyoto.jp",
            "muko.kyoto.jp",
            "nagaokakyo.kyoto.jp",
            "nakagyo.kyoto.jp",
            "nantan.kyoto.jp",
            "oyamazaki.kyoto.jp",
            "sakyo.kyoto.jp",
            "seika.kyoto.jp",
            "tanabe.kyoto.jp",
            "uji.kyoto.jp",
            "ujitawara.kyoto.jp",
            "wazuka.kyoto.jp",
            "yamashina.kyoto.jp",
            "yawata.kyoto.jp",
            "asahi.mie.jp",
            "inabe.mie.jp",
            "ise.mie.jp",
            "kameyama.mie.jp",
            "kawagoe.mie.jp",
            "kiho.mie.jp",
            "kisosaki.mie.jp",
            "kiwa.mie.jp",
            "komono.mie.jp",
            "kumano.mie.jp",
            "kuwana.mie.jp",
            "matsusaka.mie.jp",
            "meiwa.mie.jp",
            "mihama.mie.jp",
            "minamiise.mie.jp",
            "misugi.mie.jp",
            "miyama.mie.jp",
            "nabari.mie.jp",
            "shima.mie.jp",
            "suzuka.mie.jp",
            "tado.mie.jp",
            "taiki.mie.jp",
            "taki.mie.jp",
            "tamaki.mie.jp",
            "toba.mie.jp",
            "tsu.mie.jp",
            "udono.mie.jp",
            "ureshino.mie.jp",
            "watarai.mie.jp",
            "yokkaichi.mie.jp",
            "furukawa.miyagi.jp",
            "higashimatsushima.miyagi.jp",
            "ishinomaki.miyagi.jp",
            "iwanuma.miyagi.jp",
            "kakuda.miyagi.jp",
            "kami.miyagi.jp",
            "kawasaki.miyagi.jp",
            "marumori.miyagi.jp",
            "matsushima.miyagi.jp",
            "minamisanriku.miyagi.jp",
            "misato.miyagi.jp",
            "murata.miyagi.jp",
            "natori.miyagi.jp",
            "ogawara.miyagi.jp",
            "ohira.miyagi.jp",
            "onagawa.miyagi.jp",
            "osaki.miyagi.jp",
            "rifu.miyagi.jp",
            "semine.miyagi.jp",
            "shibata.miyagi.jp",
            "shichikashuku.miyagi.jp",
            "shikama.miyagi.jp",
            "shiogama.miyagi.jp",
            "shiroishi.miyagi.jp",
            "tagajo.miyagi.jp",
            "taiwa.miyagi.jp",
            "tome.miyagi.jp",
            "tomiya.miyagi.jp",
            "wakuya.miyagi.jp",
            "watari.miyagi.jp",
            "yamamoto.miyagi.jp",
            "zao.miyagi.jp",
            "aya.miyazaki.jp",
            "ebino.miyazaki.jp",
            "gokase.miyazaki.jp",
            "hyuga.miyazaki.jp",
            "kadogawa.miyazaki.jp",
            "kawaminami.miyazaki.jp",
            "kijo.miyazaki.jp",
            "kitagawa.miyazaki.jp",
            "kitakata.miyazaki.jp",
            "kitaura.miyazaki.jp",
            "kobayashi.miyazaki.jp",
            "kunitomi.miyazaki.jp",
            "kushima.miyazaki.jp",
            "mimata.miyazaki.jp",
            "miyakonojo.miyazaki.jp",
            "miyazaki.miyazaki.jp",
            "morotsuka.miyazaki.jp",
            "nichinan.miyazaki.jp",
            "nishimera.miyazaki.jp",
            "nobeoka.miyazaki.jp",
            "saito.miyazaki.jp",
            "shiiba.miyazaki.jp",
            "shintomi.miyazaki.jp",
            "takaharu.miyazaki.jp",
            "takanabe.miyazaki.jp",
            "takazaki.miyazaki.jp",
            "tsuno.miyazaki.jp",
            "achi.nagano.jp",
            "agematsu.nagano.jp",
            "anan.nagano.jp",
            "aoki.nagano.jp",
            "asahi.nagano.jp",
            "azumino.nagano.jp",
            "chikuhoku.nagano.jp",
            "chikuma.nagano.jp",
            "chino.nagano.jp",
            "fujimi.nagano.jp",
            "hakuba.nagano.jp",
            "hara.nagano.jp",
            "hiraya.nagano.jp",
            "iida.nagano.jp",
            "iijima.nagano.jp",
            "iiyama.nagano.jp",
            "iizuna.nagano.jp",
            "ikeda.nagano.jp",
            "ikusaka.nagano.jp",
            "ina.nagano.jp",
            "karuizawa.nagano.jp",
            "kawakami.nagano.jp",
            "kiso.nagano.jp",
            "kisofukushima.nagano.jp",
            "kitaaiki.nagano.jp",
            "komagane.nagano.jp",
            "komoro.nagano.jp",
            "matsukawa.nagano.jp",
            "matsumoto.nagano.jp",
            "miasa.nagano.jp",
            "minamiaiki.nagano.jp",
            "minamimaki.nagano.jp",
            "minamiminowa.nagano.jp",
            "minowa.nagano.jp",
            "miyada.nagano.jp",
            "miyota.nagano.jp",
            "mochizuki.nagano.jp",
            "nagano.nagano.jp",
            "nagawa.nagano.jp",
            "nagiso.nagano.jp",
            "nakagawa.nagano.jp",
            "nakano.nagano.jp",
            "nozawaonsen.nagano.jp",
            "obuse.nagano.jp",
            "ogawa.nagano.jp",
            "okaya.nagano.jp",
            "omachi.nagano.jp",
            "omi.nagano.jp",
            "ookuwa.nagano.jp",
            "ooshika.nagano.jp",
            "otaki.nagano.jp",
            "otari.nagano.jp",
            "sakae.nagano.jp",
            "sakaki.nagano.jp",
            "saku.nagano.jp",
            "sakuho.nagano.jp",
            "shimosuwa.nagano.jp",
            "shinanomachi.nagano.jp",
            "shiojiri.nagano.jp",
            "suwa.nagano.jp",
            "suzaka.nagano.jp",
            "takagi.nagano.jp",
            "takamori.nagano.jp",
            "takayama.nagano.jp",
            "tateshina.nagano.jp",
            "tatsuno.nagano.jp",
            "togakushi.nagano.jp",
            "togura.nagano.jp",
            "tomi.nagano.jp",
            "ueda.nagano.jp",
            "wada.nagano.jp",
            "yamagata.nagano.jp",
            "yamanouchi.nagano.jp",
            "yasaka.nagano.jp",
            "yasuoka.nagano.jp",
            "chijiwa.nagasaki.jp",
            "futsu.nagasaki.jp",
            "goto.nagasaki.jp",
            "hasami.nagasaki.jp",
            "hirado.nagasaki.jp",
            "iki.nagasaki.jp",
            "isahaya.nagasaki.jp",
            "kawatana.nagasaki.jp",
            "kuchinotsu.nagasaki.jp",
            "matsuura.nagasaki.jp",
            "nagasaki.nagasaki.jp",
            "obama.nagasaki.jp",
            "omura.nagasaki.jp",
            "oseto.nagasaki.jp",
            "saikai.nagasaki.jp",
            "sasebo.nagasaki.jp",
            "seihi.nagasaki.jp",
            "shimabara.nagasaki.jp",
            "shinkamigoto.nagasaki.jp",
            "togitsu.nagasaki.jp",
            "tsushima.nagasaki.jp",
            "unzen.nagasaki.jp",
            "ando.nara.jp",
            "gose.nara.jp",
            "heguri.nara.jp",
            "higashiyoshino.nara.jp",
            "ikaruga.nara.jp",
            "ikoma.nara.jp",
            "kamikitayama.nara.jp",
            "kanmaki.nara.jp",
            "kashiba.nara.jp",
            "kashihara.nara.jp",
            "katsuragi.nara.jp",
            "kawai.nara.jp",
            "kawakami.nara.jp",
            "kawanishi.nara.jp",
            "koryo.nara.jp",
            "kurotaki.nara.jp",
            "mitsue.nara.jp",
            "miyake.nara.jp",
            "nara.nara.jp",
            "nosegawa.nara.jp",
            "oji.nara.jp",
            "ouda.nara.jp",
            "oyodo.nara.jp",
            "sakurai.nara.jp",
            "sango.nara.jp",
            "shimoichi.nara.jp",
            "shimokitayama.nara.jp",
            "shinjo.nara.jp",
            "soni.nara.jp",
            "takatori.nara.jp",
            "tawaramoto.nara.jp",
            "tenkawa.nara.jp",
            "tenri.nara.jp",
            "uda.nara.jp",
            "yamatokoriyama.nara.jp",
            "yamatotakada.nara.jp",
            "yamazoe.nara.jp",
            "yoshino.nara.jp",
            "aga.niigata.jp",
            "agano.niigata.jp",
            "gosen.niigata.jp",
            "itoigawa.niigata.jp",
            "izumozaki.niigata.jp",
            "joetsu.niigata.jp",
            "kamo.niigata.jp",
            "kariwa.niigata.jp",
            "kashiwazaki.niigata.jp",
            "minamiuonuma.niigata.jp",
            "mitsuke.niigata.jp",
            "muika.niigata.jp",
            "murakami.niigata.jp",
            "myoko.niigata.jp",
            "nagaoka.niigata.jp",
            "niigata.niigata.jp",
            "ojiya.niigata.jp",
            "omi.niigata.jp",
            "sado.niigata.jp",
            "sanjo.niigata.jp",
            "seiro.niigata.jp",
            "seirou.niigata.jp",
            "sekikawa.niigata.jp",
            "shibata.niigata.jp",
            "tagami.niigata.jp",
            "tainai.niigata.jp",
            "tochio.niigata.jp",
            "tokamachi.niigata.jp",
            "tsubame.niigata.jp",
            "tsunan.niigata.jp",
            "uonuma.niigata.jp",
            "yahiko.niigata.jp",
            "yoita.niigata.jp",
            "yuzawa.niigata.jp",
            "beppu.oita.jp",
            "bungoono.oita.jp",
            "bungotakada.oita.jp",
            "hasama.oita.jp",
            "hiji.oita.jp",
            "himeshima.oita.jp",
            "hita.oita.jp",
            "kamitsue.oita.jp",
            "kokonoe.oita.jp",
            "kuju.oita.jp",
            "kunisaki.oita.jp",
            "kusu.oita.jp",
            "oita.oita.jp",
            "saiki.oita.jp",
            "taketa.oita.jp",
            "tsukumi.oita.jp",
            "usa.oita.jp",
            "usuki.oita.jp",
            "yufu.oita.jp",
            "akaiwa.okayama.jp",
            "asakuchi.okayama.jp",
            "bizen.okayama.jp",
            "hayashima.okayama.jp",
            "ibara.okayama.jp",
            "kagamino.okayama.jp",
            "kasaoka.okayama.jp",
            "kibichuo.okayama.jp",
            "kumenan.okayama.jp",
            "kurashiki.okayama.jp",
            "maniwa.okayama.jp",
            "misaki.okayama.jp",
            "nagi.okayama.jp",
            "niimi.okayama.jp",
            "nishiawakura.okayama.jp",
            "okayama.okayama.jp",
            "satosho.okayama.jp",
            "setouchi.okayama.jp",
            "shinjo.okayama.jp",
            "shoo.okayama.jp",
            "soja.okayama.jp",
            "takahashi.okayama.jp",
            "tamano.okayama.jp",
            "tsuyama.okayama.jp",
            "wake.okayama.jp",
            "yakage.okayama.jp",
            "aguni.okinawa.jp",
            "ginowan.okinawa.jp",
            "ginoza.okinawa.jp",
            "gushikami.okinawa.jp",
            "haebaru.okinawa.jp",
            "higashi.okinawa.jp",
            "hirara.okinawa.jp",
            "iheya.okinawa.jp",
            "ishigaki.okinawa.jp",
            "ishikawa.okinawa.jp",
            "itoman.okinawa.jp",
            "izena.okinawa.jp",
            "kadena.okinawa.jp",
            "kin.okinawa.jp",
            "kitadaito.okinawa.jp",
            "kitanakagusuku.okinawa.jp",
            "kumejima.okinawa.jp",
            "kunigami.okinawa.jp",
            "minamidaito.okinawa.jp",
            "motobu.okinawa.jp",
            "nago.okinawa.jp",
            "naha.okinawa.jp",
            "nakagusuku.okinawa.jp",
            "nakijin.okinawa.jp",
            "nanjo.okinawa.jp",
            "nishihara.okinawa.jp",
            "ogimi.okinawa.jp",
            "okinawa.okinawa.jp",
            "onna.okinawa.jp",
            "shimoji.okinawa.jp",
            "taketomi.okinawa.jp",
            "tarama.okinawa.jp",
            "tokashiki.okinawa.jp",
            "tomigusuku.okinawa.jp",
            "tonaki.okinawa.jp",
            "urasoe.okinawa.jp",
            "uruma.okinawa.jp",
            "yaese.okinawa.jp",
            "yomitan.okinawa.jp",
            "yonabaru.okinawa.jp",
            "yonaguni.okinawa.jp",
            "zamami.okinawa.jp",
            "abeno.osaka.jp",
            "chihayaakasaka.osaka.jp",
            "chuo.osaka.jp",
            "daito.osaka.jp",
            "fujiidera.osaka.jp",
            "habikino.osaka.jp",
            "hannan.osaka.jp",
            "higashiosaka.osaka.jp",
            "higashisumiyoshi.osaka.jp",
            "higashiyodogawa.osaka.jp",
            "hirakata.osaka.jp",
            "ibaraki.osaka.jp",
            "ikeda.osaka.jp",
            "izumi.osaka.jp",
            "izumiotsu.osaka.jp",
            "izumisano.osaka.jp",
            "kadoma.osaka.jp",
            "kaizuka.osaka.jp",
            "kanan.osaka.jp",
            "kashiwara.osaka.jp",
            "katano.osaka.jp",
            "kawachinagano.osaka.jp",
            "kishiwada.osaka.jp",
            "kita.osaka.jp",
            "kumatori.osaka.jp",
            "matsubara.osaka.jp",
            "minato.osaka.jp",
            "minoh.osaka.jp",
            "misaki.osaka.jp",
            "moriguchi.osaka.jp",
            "neyagawa.osaka.jp",
            "nishi.osaka.jp",
            "nose.osaka.jp",
            "osakasayama.osaka.jp",
            "sakai.osaka.jp",
            "sayama.osaka.jp",
            "sennan.osaka.jp",
            "settsu.osaka.jp",
            "shijonawate.osaka.jp",
            "shimamoto.osaka.jp",
            "suita.osaka.jp",
            "tadaoka.osaka.jp",
            "taishi.osaka.jp",
            "tajiri.osaka.jp",
            "takaishi.osaka.jp",
            "takatsuki.osaka.jp",
            "tondabayashi.osaka.jp",
            "toyonaka.osaka.jp",
            "toyono.osaka.jp",
            "yao.osaka.jp",
            "ariake.saga.jp",
            "arita.saga.jp",
            "fukudomi.saga.jp",
            "genkai.saga.jp",
            "hamatama.saga.jp",
            "hizen.saga.jp",
            "imari.saga.jp",
            "kamimine.saga.jp",
            "kanzaki.saga.jp",
            "karatsu.saga.jp",
            "kashima.saga.jp",
            "kitagata.saga.jp",
            "kitahata.saga.jp",
            "kiyama.saga.jp",
            "kouhoku.saga.jp",
            "kyuragi.saga.jp",
            "nishiarita.saga.jp",
            "ogi.saga.jp",
            "omachi.saga.jp",
            "ouchi.saga.jp",
            "saga.saga.jp",
            "shiroishi.saga.jp",
            "taku.saga.jp",
            "tara.saga.jp",
            "tosu.saga.jp",
            "yoshinogari.saga.jp",
            "arakawa.saitama.jp",
            "asaka.saitama.jp",
            "chichibu.saitama.jp",
            "fujimi.saitama.jp",
            "fujimino.saitama.jp",
            "fukaya.saitama.jp",
            "hanno.saitama.jp",
            "hanyu.saitama.jp",
            "hasuda.saitama.jp",
            "hatogaya.saitama.jp",
            "hatoyama.saitama.jp",
            "hidaka.saitama.jp",
            "higashichichibu.saitama.jp",
            "higashimatsuyama.saitama.jp",
            "honjo.saitama.jp",
            "ina.saitama.jp",
            "iruma.saitama.jp",
            "iwatsuki.saitama.jp",
            "kamiizumi.saitama.jp",
            "kamikawa.saitama.jp",
            "kamisato.saitama.jp",
            "kasukabe.saitama.jp",
            "kawagoe.saitama.jp",
            "kawaguchi.saitama.jp",
            "kawajima.saitama.jp",
            "kazo.saitama.jp",
            "kitamoto.saitama.jp",
            "koshigaya.saitama.jp",
            "kounosu.saitama.jp",
            "kuki.saitama.jp",
            "kumagaya.saitama.jp",
            "matsubushi.saitama.jp",
            "minano.saitama.jp",
            "misato.saitama.jp",
            "miyashiro.saitama.jp",
            "miyoshi.saitama.jp",
            "moroyama.saitama.jp",
            "nagatoro.saitama.jp",
            "namegawa.saitama.jp",
            "niiza.saitama.jp",
            "ogano.saitama.jp",
            "ogawa.saitama.jp",
            "ogose.saitama.jp",
            "okegawa.saitama.jp",
            "omiya.saitama.jp",
            "otaki.saitama.jp",
            "ranzan.saitama.jp",
            "ryokami.saitama.jp",
            "saitama.saitama.jp",
            "sakado.saitama.jp",
            "satte.saitama.jp",
            "sayama.saitama.jp",
            "shiki.saitama.jp",
            "shiraoka.saitama.jp",
            "soka.saitama.jp",
            "sugito.saitama.jp",
            "toda.saitama.jp",
            "tokigawa.saitama.jp",
            "tokorozawa.saitama.jp",
            "tsurugashima.saitama.jp",
            "urawa.saitama.jp",
            "warabi.saitama.jp",
            "yashio.saitama.jp",
            "yokoze.saitama.jp",
            "yono.saitama.jp",
            "yorii.saitama.jp",
            "yoshida.saitama.jp",
            "yoshikawa.saitama.jp",
            "yoshimi.saitama.jp",
            "aisho.shiga.jp",
            "gamo.shiga.jp",
            "higashiomi.shiga.jp",
            "hikone.shiga.jp",
            "koka.shiga.jp",
            "konan.shiga.jp",
            "kosei.shiga.jp",
            "koto.shiga.jp",
            "kusatsu.shiga.jp",
            "maibara.shiga.jp",
            "moriyama.shiga.jp",
            "nagahama.shiga.jp",
            "nishiazai.shiga.jp",
            "notogawa.shiga.jp",
            "omihachiman.shiga.jp",
            "otsu.shiga.jp",
            "ritto.shiga.jp",
            "ryuoh.shiga.jp",
            "takashima.shiga.jp",
            "takatsuki.shiga.jp",
            "torahime.shiga.jp",
            "toyosato.shiga.jp",
            "yasu.shiga.jp",
            "akagi.shimane.jp",
            "ama.shimane.jp",
            "gotsu.shimane.jp",
            "hamada.shimane.jp",
            "higashiizumo.shimane.jp",
            "hikawa.shimane.jp",
            "hikimi.shimane.jp",
            "izumo.shimane.jp",
            "kakinoki.shimane.jp",
            "masuda.shimane.jp",
            "matsue.shimane.jp",
            "misato.shimane.jp",
            "nishinoshima.shimane.jp",
            "ohda.shimane.jp",
            "okinoshima.shimane.jp",
            "okuizumo.shimane.jp",
            "shimane.shimane.jp",
            "tamayu.shimane.jp",
            "tsuwano.shimane.jp",
            "unnan.shimane.jp",
            "yakumo.shimane.jp",
            "yasugi.shimane.jp",
            "yatsuka.shimane.jp",
            "arai.shizuoka.jp",
            "atami.shizuoka.jp",
            "fuji.shizuoka.jp",
            "fujieda.shizuoka.jp",
            "fujikawa.shizuoka.jp",
            "fujinomiya.shizuoka.jp",
            "fukuroi.shizuoka.jp",
            "gotemba.shizuoka.jp",
            "haibara.shizuoka.jp",
            "hamamatsu.shizuoka.jp",
            "higashiizu.shizuoka.jp",
            "ito.shizuoka.jp",
            "iwata.shizuoka.jp",
            "izu.shizuoka.jp",
            "izunokuni.shizuoka.jp",
            "kakegawa.shizuoka.jp",
            "kannami.shizuoka.jp",
            "kawanehon.shizuoka.jp",
            "kawazu.shizuoka.jp",
            "kikugawa.shizuoka.jp",
            "kosai.shizuoka.jp",
            "makinohara.shizuoka.jp",
            "matsuzaki.shizuoka.jp",
            "minamiizu.shizuoka.jp",
            "mishima.shizuoka.jp",
            "morimachi.shizuoka.jp",
            "nishiizu.shizuoka.jp",
            "numazu.shizuoka.jp",
            "omaezaki.shizuoka.jp",
            "shimada.shizuoka.jp",
            "shimizu.shizuoka.jp",
            "shimoda.shizuoka.jp",
            "shizuoka.shizuoka.jp",
            "susono.shizuoka.jp",
            "yaizu.shizuoka.jp",
            "yoshida.shizuoka.jp",
            "ashikaga.tochigi.jp",
            "bato.tochigi.jp",
            "haga.tochigi.jp",
            "ichikai.tochigi.jp",
            "iwafune.tochigi.jp",
            "kaminokawa.tochigi.jp",
            "kanuma.tochigi.jp",
            "karasuyama.tochigi.jp",
            "kuroiso.tochigi.jp",
            "mashiko.tochigi.jp",
            "mibu.tochigi.jp",
            "moka.tochigi.jp",
            "motegi.tochigi.jp",
            "nasu.tochigi.jp",
            "nasushiobara.tochigi.jp",
            "nikko.tochigi.jp",
            "nishikata.tochigi.jp",
            "nogi.tochigi.jp",
            "ohira.tochigi.jp",
            "ohtawara.tochigi.jp",
            "oyama.tochigi.jp",
            "sakura.tochigi.jp",
            "sano.tochigi.jp",
            "shimotsuke.tochigi.jp",
            "shioya.tochigi.jp",
            "takanezawa.tochigi.jp",
            "tochigi.tochigi.jp",
            "tsuga.tochigi.jp",
            "ujiie.tochigi.jp",
            "utsunomiya.tochigi.jp",
            "yaita.tochigi.jp",
            "aizumi.tokushima.jp",
            "anan.tokushima.jp",
            "ichiba.tokushima.jp",
            "itano.tokushima.jp",
            "kainan.tokushima.jp",
            "komatsushima.tokushima.jp",
            "matsushige.tokushima.jp",
            "mima.tokushima.jp",
            "minami.tokushima.jp",
            "miyoshi.tokushima.jp",
            "mugi.tokushima.jp",
            "nakagawa.tokushima.jp",
            "naruto.tokushima.jp",
            "sanagochi.tokushima.jp",
            "shishikui.tokushima.jp",
            "tokushima.tokushima.jp",
            "wajiki.tokushima.jp",
            "adachi.tokyo.jp",
            "akiruno.tokyo.jp",
            "akishima.tokyo.jp",
            "aogashima.tokyo.jp",
            "arakawa.tokyo.jp",
            "bunkyo.tokyo.jp",
            "chiyoda.tokyo.jp",
            "chofu.tokyo.jp",
            "chuo.tokyo.jp",
            "edogawa.tokyo.jp",
            "fuchu.tokyo.jp",
            "fussa.tokyo.jp",
            "hachijo.tokyo.jp",
            "hachioji.tokyo.jp",
            "hamura.tokyo.jp",
            "higashikurume.tokyo.jp",
            "higashimurayama.tokyo.jp",
            "higashiyamato.tokyo.jp",
            "hino.tokyo.jp",
            "hinode.tokyo.jp",
            "hinohara.tokyo.jp",
            "inagi.tokyo.jp",
            "itabashi.tokyo.jp",
            "katsushika.tokyo.jp",
            "kita.tokyo.jp",
            "kiyose.tokyo.jp",
            "kodaira.tokyo.jp",
            "koganei.tokyo.jp",
            "kokubunji.tokyo.jp",
            "komae.tokyo.jp",
            "koto.tokyo.jp",
            "kouzushima.tokyo.jp",
            "kunitachi.tokyo.jp",
            "machida.tokyo.jp",
            "meguro.tokyo.jp",
            "minato.tokyo.jp",
            "mitaka.tokyo.jp",
            "mizuho.tokyo.jp",
            "musashimurayama.tokyo.jp",
            "musashino.tokyo.jp",
            "nakano.tokyo.jp",
            "nerima.tokyo.jp",
            "ogasawara.tokyo.jp",
            "okutama.tokyo.jp",
            "ome.tokyo.jp",
            "oshima.tokyo.jp",
            "ota.tokyo.jp",
            "setagaya.tokyo.jp",
            "shibuya.tokyo.jp",
            "shinagawa.tokyo.jp",
            "shinjuku.tokyo.jp",
            "suginami.tokyo.jp",
            "sumida.tokyo.jp",
            "tachikawa.tokyo.jp",
            "taito.tokyo.jp",
            "tama.tokyo.jp",
            "toshima.tokyo.jp",
            "chizu.tottori.jp",
            "hino.tottori.jp",
            "kawahara.tottori.jp",
            "koge.tottori.jp",
            "kotoura.tottori.jp",
            "misasa.tottori.jp",
            "nanbu.tottori.jp",
            "nichinan.tottori.jp",
            "sakaiminato.tottori.jp",
            "tottori.tottori.jp",
            "wakasa.tottori.jp",
            "yazu.tottori.jp",
            "yonago.tottori.jp",
            "asahi.toyama.jp",
            "fuchu.toyama.jp",
            "fukumitsu.toyama.jp",
            "funahashi.toyama.jp",
            "himi.toyama.jp",
            "imizu.toyama.jp",
            "inami.toyama.jp",
            "johana.toyama.jp",
            "kamiichi.toyama.jp",
            "kurobe.toyama.jp",
            "nakaniikawa.toyama.jp",
            "namerikawa.toyama.jp",
            "nanto.toyama.jp",
            "nyuzen.toyama.jp",
            "oyabe.toyama.jp",
            "taira.toyama.jp",
            "takaoka.toyama.jp",
            "tateyama.toyama.jp",
            "toga.toyama.jp",
            "tonami.toyama.jp",
            "toyama.toyama.jp",
            "unazuki.toyama.jp",
            "uozu.toyama.jp",
            "yamada.toyama.jp",
            "arida.wakayama.jp",
            "aridagawa.wakayama.jp",
            "gobo.wakayama.jp",
            "hashimoto.wakayama.jp",
            "hidaka.wakayama.jp",
            "hirogawa.wakayama.jp",
            "inami.wakayama.jp",
            "iwade.wakayama.jp",
            "kainan.wakayama.jp",
            "kamitonda.wakayama.jp",
            "katsuragi.wakayama.jp",
            "kimino.wakayama.jp",
            "kinokawa.wakayama.jp",
            "kitayama.wakayama.jp",
            "koya.wakayama.jp",
            "koza.wakayama.jp",
            "kozagawa.wakayama.jp",
            "kudoyama.wakayama.jp",
            "kushimoto.wakayama.jp",
            "mihama.wakayama.jp",
            "misato.wakayama.jp",
            "nachikatsuura.wakayama.jp",
            "shingu.wakayama.jp",
            "shirahama.wakayama.jp",
            "taiji.wakayama.jp",
            "tanabe.wakayama.jp",
            "wakayama.wakayama.jp",
            "yuasa.wakayama.jp",
            "yura.wakayama.jp",
            "asahi.yamagata.jp",
            "funagata.yamagata.jp",
            "higashine.yamagata.jp",
            "iide.yamagata.jp",
            "kahoku.yamagata.jp",
            "kaminoyama.yamagata.jp",
            "kaneyama.yamagata.jp",
            "kawanishi.yamagata.jp",
            "mamurogawa.yamagata.jp",
            "mikawa.yamagata.jp",
            "murayama.yamagata.jp",
            "nagai.yamagata.jp",
            "nakayama.yamagata.jp",
            "nanyo.yamagata.jp",
            "nishikawa.yamagata.jp",
            "obanazawa.yamagata.jp",
            "oe.yamagata.jp",
            "oguni.yamagata.jp",
            "ohkura.yamagata.jp",
            "oishida.yamagata.jp",
            "sagae.yamagata.jp",
            "sakata.yamagata.jp",
            "sakegawa.yamagata.jp",
            "shinjo.yamagata.jp",
            "shirataka.yamagata.jp",
            "shonai.yamagata.jp",
            "takahata.yamagata.jp",
            "tendo.yamagata.jp",
            "tozawa.yamagata.jp",
            "tsuruoka.yamagata.jp",
            "yamagata.yamagata.jp",
            "yamanobe.yamagata.jp",
            "yonezawa.yamagata.jp",
            "yuza.yamagata.jp",
            "abu.yamaguchi.jp",
            "hagi.yamaguchi.jp",
            "hikari.yamaguchi.jp",
            "hofu.yamaguchi.jp",
            "iwakuni.yamaguchi.jp",
            "kudamatsu.yamaguchi.jp",
            "mitou.yamaguchi.jp",
            "nagato.yamaguchi.jp",
            "oshima.yamaguchi.jp",
            "shimonoseki.yamaguchi.jp",
            "shunan.yamaguchi.jp",
            "tabuse.yamaguchi.jp",
            "tokuyama.yamaguchi.jp",
            "toyota.yamaguchi.jp",
            "ube.yamaguchi.jp",
            "yuu.yamaguchi.jp",
            "chuo.yamanashi.jp",
            "doshi.yamanashi.jp",
            "fuefuki.yamanashi.jp",
            "fujikawa.yamanashi.jp",
            "fujikawaguchiko.yamanashi.jp",
            "fujiyoshida.yamanashi.jp",
            "hayakawa.yamanashi.jp",
            "hokuto.yamanashi.jp",
            "ichikawamisato.yamanashi.jp",
            "kai.yamanashi.jp",
            "kofu.yamanashi.jp",
            "koshu.yamanashi.jp",
            "kosuge.yamanashi.jp",
            "minami-alps.yamanashi.jp",
            "minobu.yamanashi.jp",
            "nakamichi.yamanashi.jp",
            "nanbu.yamanashi.jp",
            "narusawa.yamanashi.jp",
            "nirasaki.yamanashi.jp",
            "nishikatsura.yamanashi.jp",
            "oshino.yamanashi.jp",
            "otsuki.yamanashi.jp",
            "showa.yamanashi.jp",
            "tabayama.yamanashi.jp",
            "tsuru.yamanashi.jp",
            "uenohara.yamanashi.jp",
            "yamanakako.yamanashi.jp",
            "yamanashi.yamanashi.jp",
            "ke",
            "ac.ke",
            "co.ke",
            "go.ke",
            "info.ke",
            "me.ke",
            "mobi.ke",
            "ne.ke",
            "or.ke",
            "sc.ke",
            "kg",
            "org.kg",
            "net.kg",
            "com.kg",
            "edu.kg",
            "gov.kg",
            "mil.kg",
            "*.kh",
            "ki",
            "edu.ki",
            "biz.ki",
            "net.ki",
            "org.ki",
            "gov.ki",
            "info.ki",
            "com.ki",
            "km",
            "org.km",
            "nom.km",
            "gov.km",
            "prd.km",
            "tm.km",
            "edu.km",
            "mil.km",
            "ass.km",
            "com.km",
            "coop.km",
            "asso.km",
            "presse.km",
            "medecin.km",
            "notaires.km",
            "pharmaciens.km",
            "veterinaire.km",
            "gouv.km",
            "kn",
            "net.kn",
            "org.kn",
            "edu.kn",
            "gov.kn",
            "kp",
            "com.kp",
            "edu.kp",
            "gov.kp",
            "org.kp",
            "rep.kp",
            "tra.kp",
            "kr",
            "ac.kr",
            "co.kr",
            "es.kr",
            "go.kr",
            "hs.kr",
            "kg.kr",
            "mil.kr",
            "ms.kr",
            "ne.kr",
            "or.kr",
            "pe.kr",
            "re.kr",
            "sc.kr",
            "busan.kr",
            "chungbuk.kr",
            "chungnam.kr",
            "daegu.kr",
            "daejeon.kr",
            "gangwon.kr",
            "gwangju.kr",
            "gyeongbuk.kr",
            "gyeonggi.kr",
            "gyeongnam.kr",
            "incheon.kr",
            "jeju.kr",
            "jeonbuk.kr",
            "jeonnam.kr",
            "seoul.kr",
            "ulsan.kr",
            "kw",
            "com.kw",
            "edu.kw",
            "emb.kw",
            "gov.kw",
            "ind.kw",
            "net.kw",
            "org.kw",
            "ky",
            "edu.ky",
            "gov.ky",
            "com.ky",
            "org.ky",
            "net.ky",
            "kz",
            "org.kz",
            "edu.kz",
            "net.kz",
            "gov.kz",
            "mil.kz",
            "com.kz",
            "la",
            "int.la",
            "net.la",
            "info.la",
            "edu.la",
            "gov.la",
            "per.la",
            "com.la",
            "org.la",
            "lb",
            "com.lb",
            "edu.lb",
            "gov.lb",
            "net.lb",
            "org.lb",
            "lc",
            "com.lc",
            "net.lc",
            "co.lc",
            "org.lc",
            "edu.lc",
            "gov.lc",
            "li",
            "lk",
            "gov.lk",
            "sch.lk",
            "net.lk",
            "int.lk",
            "com.lk",
            "org.lk",
            "edu.lk",
            "ngo.lk",
            "soc.lk",
            "web.lk",
            "ltd.lk",
            "assn.lk",
            "grp.lk",
            "hotel.lk",
            "ac.lk",
            "lr",
            "com.lr",
            "edu.lr",
            "gov.lr",
            "org.lr",
            "net.lr",
            "ls",
            "co.ls",
            "org.ls",
            "lt",
            "gov.lt",
            "lu",
            "lv",
            "com.lv",
            "edu.lv",
            "gov.lv",
            "org.lv",
            "mil.lv",
            "id.lv",
            "net.lv",
            "asn.lv",
            "conf.lv",
            "ly",
            "com.ly",
            "net.ly",
            "gov.ly",
            "plc.ly",
            "edu.ly",
            "sch.ly",
            "med.ly",
            "org.ly",
            "id.ly",
            "ma",
            "co.ma",
            "net.ma",
            "gov.ma",
            "org.ma",
            "ac.ma",
            "press.ma",
            "mc",
            "tm.mc",
            "asso.mc",
            "md",
            "me",
            "co.me",
            "net.me",
            "org.me",
            "edu.me",
            "ac.me",
            "gov.me",
            "its.me",
            "priv.me",
            "mg",
            "org.mg",
            "nom.mg",
            "gov.mg",
            "prd.mg",
            "tm.mg",
            "edu.mg",
            "mil.mg",
            "com.mg",
            "co.mg",
            "mh",
            "mil",
            "mk",
            "com.mk",
            "org.mk",
            "net.mk",
            "edu.mk",
            "gov.mk",
            "inf.mk",
            "name.mk",
            "ml",
            "com.ml",
            "edu.ml",
            "gouv.ml",
            "gov.ml",
            "net.ml",
            "org.ml",
            "presse.ml",
            "*.mm",
            "mn",
            "gov.mn",
            "edu.mn",
            "org.mn",
            "mo",
            "com.mo",
            "net.mo",
            "org.mo",
            "edu.mo",
            "gov.mo",
            "mobi",
            "mp",
            "mq",
            "mr",
            "gov.mr",
            "ms",
            "com.ms",
            "edu.ms",
            "gov.ms",
            "net.ms",
            "org.ms",
            "mt",
            "com.mt",
            "edu.mt",
            "net.mt",
            "org.mt",
            "mu",
            "com.mu",
            "net.mu",
            "org.mu",
            "gov.mu",
            "ac.mu",
            "co.mu",
            "or.mu",
            "museum",
            "academy.museum",
            "agriculture.museum",
            "air.museum",
            "airguard.museum",
            "alabama.museum",
            "alaska.museum",
            "amber.museum",
            "ambulance.museum",
            "american.museum",
            "americana.museum",
            "americanantiques.museum",
            "americanart.museum",
            "amsterdam.museum",
            "and.museum",
            "annefrank.museum",
            "anthro.museum",
            "anthropology.museum",
            "antiques.museum",
            "aquarium.museum",
            "arboretum.museum",
            "archaeological.museum",
            "archaeology.museum",
            "architecture.museum",
            "art.museum",
            "artanddesign.museum",
            "artcenter.museum",
            "artdeco.museum",
            "arteducation.museum",
            "artgallery.museum",
            "arts.museum",
            "artsandcrafts.museum",
            "asmatart.museum",
            "assassination.museum",
            "assisi.museum",
            "association.museum",
            "astronomy.museum",
            "atlanta.museum",
            "austin.museum",
            "australia.museum",
            "automotive.museum",
            "aviation.museum",
            "axis.museum",
            "badajoz.museum",
            "baghdad.museum",
            "bahn.museum",
            "bale.museum",
            "baltimore.museum",
            "barcelona.museum",
            "baseball.museum",
            "basel.museum",
            "baths.museum",
            "bauern.museum",
            "beauxarts.museum",
            "beeldengeluid.museum",
            "bellevue.museum",
            "bergbau.museum",
            "berkeley.museum",
            "berlin.museum",
            "bern.museum",
            "bible.museum",
            "bilbao.museum",
            "bill.museum",
            "birdart.museum",
            "birthplace.museum",
            "bonn.museum",
            "boston.museum",
            "botanical.museum",
            "botanicalgarden.museum",
            "botanicgarden.museum",
            "botany.museum",
            "brandywinevalley.museum",
            "brasil.museum",
            "bristol.museum",
            "british.museum",
            "britishcolumbia.museum",
            "broadcast.museum",
            "brunel.museum",
            "brussel.museum",
            "brussels.museum",
            "bruxelles.museum",
            "building.museum",
            "burghof.museum",
            "bus.museum",
            "bushey.museum",
            "cadaques.museum",
            "california.museum",
            "cambridge.museum",
            "can.museum",
            "canada.museum",
            "capebreton.museum",
            "carrier.museum",
            "cartoonart.museum",
            "casadelamoneda.museum",
            "castle.museum",
            "castres.museum",
            "celtic.museum",
            "center.museum",
            "chattanooga.museum",
            "cheltenham.museum",
            "chesapeakebay.museum",
            "chicago.museum",
            "children.museum",
            "childrens.museum",
            "childrensgarden.museum",
            "chiropractic.museum",
            "chocolate.museum",
            "christiansburg.museum",
            "cincinnati.museum",
            "cinema.museum",
            "circus.museum",
            "civilisation.museum",
            "civilization.museum",
            "civilwar.museum",
            "clinton.museum",
            "clock.museum",
            "coal.museum",
            "coastaldefence.museum",
            "cody.museum",
            "coldwar.museum",
            "collection.museum",
            "colonialwilliamsburg.museum",
            "coloradoplateau.museum",
            "columbia.museum",
            "columbus.museum",
            "communication.museum",
            "communications.museum",
            "community.museum",
            "computer.museum",
            "computerhistory.museum",
            "comunicações.museum",
            "contemporary.museum",
            "contemporaryart.museum",
            "convent.museum",
            "copenhagen.museum",
            "corporation.museum",
            "correios-e-telecomunicações.museum",
            "corvette.museum",
            "costume.museum",
            "countryestate.museum",
            "county.museum",
            "crafts.museum",
            "cranbrook.museum",
            "creation.museum",
            "cultural.museum",
            "culturalcenter.museum",
            "culture.museum",
            "cyber.museum",
            "cymru.museum",
            "dali.museum",
            "dallas.museum",
            "database.museum",
            "ddr.museum",
            "decorativearts.museum",
            "delaware.museum",
            "delmenhorst.museum",
            "denmark.museum",
            "depot.museum",
            "design.museum",
            "detroit.museum",
            "dinosaur.museum",
            "discovery.museum",
            "dolls.museum",
            "donostia.museum",
            "durham.museum",
            "eastafrica.museum",
            "eastcoast.museum",
            "education.museum",
            "educational.museum",
            "egyptian.museum",
            "eisenbahn.museum",
            "elburg.museum",
            "elvendrell.museum",
            "embroidery.museum",
            "encyclopedic.museum",
            "england.museum",
            "entomology.museum",
            "environment.museum",
            "environmentalconservation.museum",
            "epilepsy.museum",
            "essex.museum",
            "estate.museum",
            "ethnology.museum",
            "exeter.museum",
            "exhibition.museum",
            "family.museum",
            "farm.museum",
            "farmequipment.museum",
            "farmers.museum",
            "farmstead.museum",
            "field.museum",
            "figueres.museum",
            "filatelia.museum",
            "film.museum",
            "fineart.museum",
            "finearts.museum",
            "finland.museum",
            "flanders.museum",
            "florida.museum",
            "force.museum",
            "fortmissoula.museum",
            "fortworth.museum",
            "foundation.museum",
            "francaise.museum",
            "frankfurt.museum",
            "franziskaner.museum",
            "freemasonry.museum",
            "freiburg.museum",
            "fribourg.museum",
            "frog.museum",
            "fundacio.museum",
            "furniture.museum",
            "gallery.museum",
            "garden.museum",
            "gateway.museum",
            "geelvinck.museum",
            "gemological.museum",
            "geology.museum",
            "georgia.museum",
            "giessen.museum",
            "glas.museum",
            "glass.museum",
            "gorge.museum",
            "grandrapids.museum",
            "graz.museum",
            "guernsey.museum",
            "halloffame.museum",
            "hamburg.museum",
            "handson.museum",
            "harvestcelebration.museum",
            "hawaii.museum",
            "health.museum",
            "heimatunduhren.museum",
            "hellas.museum",
            "helsinki.museum",
            "hembygdsforbund.museum",
            "heritage.museum",
            "histoire.museum",
            "historical.museum",
            "historicalsociety.museum",
            "historichouses.museum",
            "historisch.museum",
            "historisches.museum",
            "history.museum",
            "historyofscience.museum",
            "horology.museum",
            "house.museum",
            "humanities.museum",
            "illustration.museum",
            "imageandsound.museum",
            "indian.museum",
            "indiana.museum",
            "indianapolis.museum",
            "indianmarket.museum",
            "intelligence.museum",
            "interactive.museum",
            "iraq.museum",
            "iron.museum",
            "isleofman.museum",
            "jamison.museum",
            "jefferson.museum",
            "jerusalem.museum",
            "jewelry.museum",
            "jewish.museum",
            "jewishart.museum",
            "jfk.museum",
            "journalism.museum",
            "judaica.museum",
            "judygarland.museum",
            "juedisches.museum",
            "juif.museum",
            "karate.museum",
            "karikatur.museum",
            "kids.museum",
            "koebenhavn.museum",
            "koeln.museum",
            "kunst.museum",
            "kunstsammlung.museum",
            "kunstunddesign.museum",
            "labor.museum",
            "labour.museum",
            "lajolla.museum",
            "lancashire.museum",
            "landes.museum",
            "lans.museum",
            "läns.museum",
            "larsson.museum",
            "lewismiller.museum",
            "lincoln.museum",
            "linz.museum",
            "living.museum",
            "livinghistory.museum",
            "localhistory.museum",
            "london.museum",
            "losangeles.museum",
            "louvre.museum",
            "loyalist.museum",
            "lucerne.museum",
            "luxembourg.museum",
            "luzern.museum",
            "mad.museum",
            "madrid.museum",
            "mallorca.museum",
            "manchester.museum",
            "mansion.museum",
            "mansions.museum",
            "manx.museum",
            "marburg.museum",
            "maritime.museum",
            "maritimo.museum",
            "maryland.museum",
            "marylhurst.museum",
            "media.museum",
            "medical.museum",
            "medizinhistorisches.museum",
            "meeres.museum",
            "memorial.museum",
            "mesaverde.museum",
            "michigan.museum",
            "midatlantic.museum",
            "military.museum",
            "mill.museum",
            "miners.museum",
            "mining.museum",
            "minnesota.museum",
            "missile.museum",
            "missoula.museum",
            "modern.museum",
            "moma.museum",
            "money.museum",
            "monmouth.museum",
            "monticello.museum",
            "montreal.museum",
            "moscow.museum",
            "motorcycle.museum",
            "muenchen.museum",
            "muenster.museum",
            "mulhouse.museum",
            "muncie.museum",
            "museet.museum",
            "museumcenter.museum",
            "museumvereniging.museum",
            "music.museum",
            "national.museum",
            "nationalfirearms.museum",
            "nationalheritage.museum",
            "nativeamerican.museum",
            "naturalhistory.museum",
            "naturalhistorymuseum.museum",
            "naturalsciences.museum",
            "nature.museum",
            "naturhistorisches.museum",
            "natuurwetenschappen.museum",
            "naumburg.museum",
            "naval.museum",
            "nebraska.museum",
            "neues.museum",
            "newhampshire.museum",
            "newjersey.museum",
            "newmexico.museum",
            "newport.museum",
            "newspaper.museum",
            "newyork.museum",
            "niepce.museum",
            "norfolk.museum",
            "north.museum",
            "nrw.museum",
            "nuernberg.museum",
            "nuremberg.museum",
            "nyc.museum",
            "nyny.museum",
            "oceanographic.museum",
            "oceanographique.museum",
            "omaha.museum",
            "online.museum",
            "ontario.museum",
            "openair.museum",
            "oregon.museum",
            "oregontrail.museum",
            "otago.museum",
            "oxford.museum",
            "pacific.museum",
            "paderborn.museum",
            "palace.museum",
            "paleo.museum",
            "palmsprings.museum",
            "panama.museum",
            "paris.museum",
            "pasadena.museum",
            "pharmacy.museum",
            "philadelphia.museum",
            "philadelphiaarea.museum",
            "philately.museum",
            "phoenix.museum",
            "photography.museum",
            "pilots.museum",
            "pittsburgh.museum",
            "planetarium.museum",
            "plantation.museum",
            "plants.museum",
            "plaza.museum",
            "portal.museum",
            "portland.museum",
            "portlligat.museum",
            "posts-and-telecommunications.museum",
            "preservation.museum",
            "presidio.museum",
            "press.museum",
            "project.museum",
            "public.museum",
            "pubol.museum",
            "quebec.museum",
            "railroad.museum",
            "railway.museum",
            "research.museum",
            "resistance.museum",
            "riodejaneiro.museum",
            "rochester.museum",
            "rockart.museum",
            "roma.museum",
            "russia.museum",
            "saintlouis.museum",
            "salem.museum",
            "salvadordali.museum",
            "salzburg.museum",
            "sandiego.museum",
            "sanfrancisco.museum",
            "santabarbara.museum",
            "santacruz.museum",
            "santafe.museum",
            "saskatchewan.museum",
            "satx.museum",
            "savannahga.museum",
            "schlesisches.museum",
            "schoenbrunn.museum",
            "schokoladen.museum",
            "school.museum",
            "schweiz.museum",
            "science.museum",
            "scienceandhistory.museum",
            "scienceandindustry.museum",
            "sciencecenter.museum",
            "sciencecenters.museum",
            "science-fiction.museum",
            "sciencehistory.museum",
            "sciences.museum",
            "sciencesnaturelles.museum",
            "scotland.museum",
            "seaport.museum",
            "settlement.museum",
            "settlers.museum",
            "shell.museum",
            "sherbrooke.museum",
            "sibenik.museum",
            "silk.museum",
            "ski.museum",
            "skole.museum",
            "society.museum",
            "sologne.museum",
            "soundandvision.museum",
            "southcarolina.museum",
            "southwest.museum",
            "space.museum",
            "spy.museum",
            "square.museum",
            "stadt.museum",
            "stalbans.museum",
            "starnberg.museum",
            "state.museum",
            "stateofdelaware.museum",
            "station.museum",
            "steam.museum",
            "steiermark.museum",
            "stjohn.museum",
            "stockholm.museum",
            "stpetersburg.museum",
            "stuttgart.museum",
            "suisse.museum",
            "surgeonshall.museum",
            "surrey.museum",
            "svizzera.museum",
            "sweden.museum",
            "sydney.museum",
            "tank.museum",
            "tcm.museum",
            "technology.museum",
            "telekommunikation.museum",
            "television.museum",
            "texas.museum",
            "textile.museum",
            "theater.museum",
            "time.museum",
            "timekeeping.museum",
            "topology.museum",
            "torino.museum",
            "touch.museum",
            "town.museum",
            "transport.museum",
            "tree.museum",
            "trolley.museum",
            "trust.museum",
            "trustee.museum",
            "uhren.museum",
            "ulm.museum",
            "undersea.museum",
            "university.museum",
            "usa.museum",
            "usantiques.museum",
            "usarts.museum",
            "uscountryestate.museum",
            "usculture.museum",
            "usdecorativearts.museum",
            "usgarden.museum",
            "ushistory.museum",
            "ushuaia.museum",
            "uslivinghistory.museum",
            "utah.museum",
            "uvic.museum",
            "valley.museum",
            "vantaa.museum",
            "versailles.museum",
            "viking.museum",
            "village.museum",
            "virginia.museum",
            "virtual.museum",
            "virtuel.museum",
            "vlaanderen.museum",
            "volkenkunde.museum",
            "wales.museum",
            "wallonie.museum",
            "war.museum",
            "washingtondc.museum",
            "watchandclock.museum",
            "watch-and-clock.museum",
            "western.museum",
            "westfalen.museum",
            "whaling.museum",
            "wildlife.museum",
            "williamsburg.museum",
            "windmill.museum",
            "workshop.museum",
            "york.museum",
            "yorkshire.museum",
            "yosemite.museum",
            "youth.museum",
            "zoological.museum",
            "zoology.museum",
            "ירושלים.museum",
            "иком.museum",
            "mv",
            "aero.mv",
            "biz.mv",
            "com.mv",
            "coop.mv",
            "edu.mv",
            "gov.mv",
            "info.mv",
            "int.mv",
            "mil.mv",
            "museum.mv",
            "name.mv",
            "net.mv",
            "org.mv",
            "pro.mv",
            "mw",
            "ac.mw",
            "biz.mw",
            "co.mw",
            "com.mw",
            "coop.mw",
            "edu.mw",
            "gov.mw",
            "int.mw",
            "museum.mw",
            "net.mw",
            "org.mw",
            "mx",
            "com.mx",
            "org.mx",
            "gob.mx",
            "edu.mx",
            "net.mx",
            "my",
            "com.my",
            "net.my",
            "org.my",
            "gov.my",
            "edu.my",
            "mil.my",
            "name.my",
            "mz",
            "ac.mz",
            "adv.mz",
            "co.mz",
            "edu.mz",
            "gov.mz",
            "mil.mz",
            "net.mz",
            "org.mz",
            "na",
            "info.na",
            "pro.na",
            "name.na",
            "school.na",
            "or.na",
            "dr.na",
            "us.na",
            "mx.na",
            "ca.na",
            "in.na",
            "cc.na",
            "tv.na",
            "ws.na",
            "mobi.na",
            "co.na",
            "com.na",
            "org.na",
            "name",
            "nc",
            "asso.nc",
            "nom.nc",
            "ne",
            "net",
            "nf",
            "com.nf",
            "net.nf",
            "per.nf",
            "rec.nf",
            "web.nf",
            "arts.nf",
            "firm.nf",
            "info.nf",
            "other.nf",
            "store.nf",
            "ng",
            "com.ng",
            "edu.ng",
            "gov.ng",
            "i.ng",
            "mil.ng",
            "mobi.ng",
            "name.ng",
            "net.ng",
            "org.ng",
            "sch.ng",
            "ni",
            "ac.ni",
            "biz.ni",
            "co.ni",
            "com.ni",
            "edu.ni",
            "gob.ni",
            "in.ni",
            "info.ni",
            "int.ni",
            "mil.ni",
            "net.ni",
            "nom.ni",
            "org.ni",
            "web.ni",
            "nl",
            "bv.nl",
            "no",
            "fhs.no",
            "vgs.no",
            "fylkesbibl.no",
            "folkebibl.no",
            "museum.no",
            "idrett.no",
            "priv.no",
            "mil.no",
            "stat.no",
            "dep.no",
            "kommune.no",
            "herad.no",
            "aa.no",
            "ah.no",
            "bu.no",
            "fm.no",
            "hl.no",
            "hm.no",
            "jan-mayen.no",
            "mr.no",
            "nl.no",
            "nt.no",
            "of.no",
            "ol.no",
            "oslo.no",
            "rl.no",
            "sf.no",
            "st.no",
            "svalbard.no",
            "tm.no",
            "tr.no",
            "va.no",
            "vf.no",
            "gs.aa.no",
            "gs.ah.no",
            "gs.bu.no",
            "gs.fm.no",
            "gs.hl.no",
            "gs.hm.no",
            "gs.jan-mayen.no",
            "gs.mr.no",
            "gs.nl.no",
            "gs.nt.no",
            "gs.of.no",
            "gs.ol.no",
            "gs.oslo.no",
            "gs.rl.no",
            "gs.sf.no",
            "gs.st.no",
            "gs.svalbard.no",
            "gs.tm.no",
            "gs.tr.no",
            "gs.va.no",
            "gs.vf.no",
            "akrehamn.no",
            "åkrehamn.no",
            "algard.no",
            "ålgård.no",
            "arna.no",
            "brumunddal.no",
            "bryne.no",
            "bronnoysund.no",
            "brønnøysund.no",
            "drobak.no",
            "drøbak.no",
            "egersund.no",
            "fetsund.no",
            "floro.no",
            "florø.no",
            "fredrikstad.no",
            "hokksund.no",
            "honefoss.no",
            "hønefoss.no",
            "jessheim.no",
            "jorpeland.no",
            "jørpeland.no",
            "kirkenes.no",
            "kopervik.no",
            "krokstadelva.no",
            "langevag.no",
            "langevåg.no",
            "leirvik.no",
            "mjondalen.no",
            "mjøndalen.no",
            "mo-i-rana.no",
            "mosjoen.no",
            "mosjøen.no",
            "nesoddtangen.no",
            "orkanger.no",
            "osoyro.no",
            "osøyro.no",
            "raholt.no",
            "råholt.no",
            "sandnessjoen.no",
            "sandnessjøen.no",
            "skedsmokorset.no",
            "slattum.no",
            "spjelkavik.no",
            "stathelle.no",
            "stavern.no",
            "stjordalshalsen.no",
            "stjørdalshalsen.no",
            "tananger.no",
            "tranby.no",
            "vossevangen.no",
            "afjord.no",
            "åfjord.no",
            "agdenes.no",
            "al.no",
            "ål.no",
            "alesund.no",
            "ålesund.no",
            "alstahaug.no",
            "alta.no",
            "áltá.no",
            "alaheadju.no",
            "álaheadju.no",
            "alvdal.no",
            "amli.no",
            "åmli.no",
            "amot.no",
            "åmot.no",
            "andebu.no",
            "andoy.no",
            "andøy.no",
            "andasuolo.no",
            "ardal.no",
            "årdal.no",
            "aremark.no",
            "arendal.no",
            "ås.no",
            "aseral.no",
            "åseral.no",
            "asker.no",
            "askim.no",
            "askvoll.no",
            "askoy.no",
            "askøy.no",
            "asnes.no",
            "åsnes.no",
            "audnedaln.no",
            "aukra.no",
            "aure.no",
            "aurland.no",
            "aurskog-holand.no",
            "aurskog-høland.no",
            "austevoll.no",
            "austrheim.no",
            "averoy.no",
            "averøy.no",
            "balestrand.no",
            "ballangen.no",
            "balat.no",
            "bálát.no",
            "balsfjord.no",
            "bahccavuotna.no",
            "báhccavuotna.no",
            "bamble.no",
            "bardu.no",
            "beardu.no",
            "beiarn.no",
            "bajddar.no",
            "bájddar.no",
            "baidar.no",
            "báidár.no",
            "berg.no",
            "bergen.no",
            "berlevag.no",
            "berlevåg.no",
            "bearalvahki.no",
            "bearalváhki.no",
            "bindal.no",
            "birkenes.no",
            "bjarkoy.no",
            "bjarkøy.no",
            "bjerkreim.no",
            "bjugn.no",
            "bodo.no",
            "bodø.no",
            "badaddja.no",
            "bådåddjå.no",
            "budejju.no",
            "bokn.no",
            "bremanger.no",
            "bronnoy.no",
            "brønnøy.no",
            "bygland.no",
            "bykle.no",
            "barum.no",
            "bærum.no",
            "bo.telemark.no",
            "bø.telemark.no",
            "bo.nordland.no",
            "bø.nordland.no",
            "bievat.no",
            "bievát.no",
            "bomlo.no",
            "bømlo.no",
            "batsfjord.no",
            "båtsfjord.no",
            "bahcavuotna.no",
            "báhcavuotna.no",
            "dovre.no",
            "drammen.no",
            "drangedal.no",
            "dyroy.no",
            "dyrøy.no",
            "donna.no",
            "dønna.no",
            "eid.no",
            "eidfjord.no",
            "eidsberg.no",
            "eidskog.no",
            "eidsvoll.no",
            "eigersund.no",
            "elverum.no",
            "enebakk.no",
            "engerdal.no",
            "etne.no",
            "etnedal.no",
            "evenes.no",
            "evenassi.no",
            "evenášši.no",
            "evje-og-hornnes.no",
            "farsund.no",
            "fauske.no",
            "fuossko.no",
            "fuoisku.no",
            "fedje.no",
            "fet.no",
            "finnoy.no",
            "finnøy.no",
            "fitjar.no",
            "fjaler.no",
            "fjell.no",
            "flakstad.no",
            "flatanger.no",
            "flekkefjord.no",
            "flesberg.no",
            "flora.no",
            "fla.no",
            "flå.no",
            "folldal.no",
            "forsand.no",
            "fosnes.no",
            "frei.no",
            "frogn.no",
            "froland.no",
            "frosta.no",
            "frana.no",
            "fræna.no",
            "froya.no",
            "frøya.no",
            "fusa.no",
            "fyresdal.no",
            "forde.no",
            "førde.no",
            "gamvik.no",
            "gangaviika.no",
            "gáŋgaviika.no",
            "gaular.no",
            "gausdal.no",
            "gildeskal.no",
            "gildeskål.no",
            "giske.no",
            "gjemnes.no",
            "gjerdrum.no",
            "gjerstad.no",
            "gjesdal.no",
            "gjovik.no",
            "gjøvik.no",
            "gloppen.no",
            "gol.no",
            "gran.no",
            "grane.no",
            "granvin.no",
            "gratangen.no",
            "grimstad.no",
            "grong.no",
            "kraanghke.no",
            "kråanghke.no",
            "grue.no",
            "gulen.no",
            "hadsel.no",
            "halden.no",
            "halsa.no",
            "hamar.no",
            "hamaroy.no",
            "habmer.no",
            "hábmer.no",
            "hapmir.no",
            "hápmir.no",
            "hammerfest.no",
            "hammarfeasta.no",
            "hámmárfeasta.no",
            "haram.no",
            "hareid.no",
            "harstad.no",
            "hasvik.no",
            "aknoluokta.no",
            "ákŋoluokta.no",
            "hattfjelldal.no",
            "aarborte.no",
            "haugesund.no",
            "hemne.no",
            "hemnes.no",
            "hemsedal.no",
            "heroy.more-og-romsdal.no",
            "herøy.møre-og-romsdal.no",
            "heroy.nordland.no",
            "herøy.nordland.no",
            "hitra.no",
            "hjartdal.no",
            "hjelmeland.no",
            "hobol.no",
            "hobøl.no",
            "hof.no",
            "hol.no",
            "hole.no",
            "holmestrand.no",
            "holtalen.no",
            "holtålen.no",
            "hornindal.no",
            "horten.no",
            "hurdal.no",
            "hurum.no",
            "hvaler.no",
            "hyllestad.no",
            "hagebostad.no",
            "hægebostad.no",
            "hoyanger.no",
            "høyanger.no",
            "hoylandet.no",
            "høylandet.no",
            "ha.no",
            "hå.no",
            "ibestad.no",
            "inderoy.no",
            "inderøy.no",
            "iveland.no",
            "jevnaker.no",
            "jondal.no",
            "jolster.no",
            "jølster.no",
            "karasjok.no",
            "karasjohka.no",
            "kárášjohka.no",
            "karlsoy.no",
            "galsa.no",
            "gálsá.no",
            "karmoy.no",
            "karmøy.no",
            "kautokeino.no",
            "guovdageaidnu.no",
            "klepp.no",
            "klabu.no",
            "klæbu.no",
            "kongsberg.no",
            "kongsvinger.no",
            "kragero.no",
            "kragerø.no",
            "kristiansand.no",
            "kristiansund.no",
            "krodsherad.no",
            "krødsherad.no",
            "kvalsund.no",
            "rahkkeravju.no",
            "ráhkkerávju.no",
            "kvam.no",
            "kvinesdal.no",
            "kvinnherad.no",
            "kviteseid.no",
            "kvitsoy.no",
            "kvitsøy.no",
            "kvafjord.no",
            "kvæfjord.no",
            "giehtavuoatna.no",
            "kvanangen.no",
            "kvænangen.no",
            "navuotna.no",
            "návuotna.no",
            "kafjord.no",
            "kåfjord.no",
            "gaivuotna.no",
            "gáivuotna.no",
            "larvik.no",
            "lavangen.no",
            "lavagis.no",
            "loabat.no",
            "loabát.no",
            "lebesby.no",
            "davvesiida.no",
            "leikanger.no",
            "leirfjord.no",
            "leka.no",
            "leksvik.no",
            "lenvik.no",
            "leangaviika.no",
            "leaŋgaviika.no",
            "lesja.no",
            "levanger.no",
            "lier.no",
            "lierne.no",
            "lillehammer.no",
            "lillesand.no",
            "lindesnes.no",
            "lindas.no",
            "lindås.no",
            "lom.no",
            "loppa.no",
            "lahppi.no",
            "láhppi.no",
            "lund.no",
            "lunner.no",
            "luroy.no",
            "lurøy.no",
            "luster.no",
            "lyngdal.no",
            "lyngen.no",
            "ivgu.no",
            "lardal.no",
            "lerdal.no",
            "lærdal.no",
            "lodingen.no",
            "lødingen.no",
            "lorenskog.no",
            "lørenskog.no",
            "loten.no",
            "løten.no",
            "malvik.no",
            "masoy.no",
            "måsøy.no",
            "muosat.no",
            "muosát.no",
            "mandal.no",
            "marker.no",
            "marnardal.no",
            "masfjorden.no",
            "meland.no",
            "meldal.no",
            "melhus.no",
            "meloy.no",
            "meløy.no",
            "meraker.no",
            "meråker.no",
            "moareke.no",
            "moåreke.no",
            "midsund.no",
            "midtre-gauldal.no",
            "modalen.no",
            "modum.no",
            "molde.no",
            "moskenes.no",
            "moss.no",
            "mosvik.no",
            "malselv.no",
            "målselv.no",
            "malatvuopmi.no",
            "málatvuopmi.no",
            "namdalseid.no",
            "aejrie.no",
            "namsos.no",
            "namsskogan.no",
            "naamesjevuemie.no",
            "nååmesjevuemie.no",
            "laakesvuemie.no",
            "nannestad.no",
            "narvik.no",
            "narviika.no",
            "naustdal.no",
            "nedre-eiker.no",
            "nes.akershus.no",
            "nes.buskerud.no",
            "nesna.no",
            "nesodden.no",
            "nesseby.no",
            "unjarga.no",
            "unjárga.no",
            "nesset.no",
            "nissedal.no",
            "nittedal.no",
            "nord-aurdal.no",
            "nord-fron.no",
            "nord-odal.no",
            "norddal.no",
            "nordkapp.no",
            "davvenjarga.no",
            "davvenjárga.no",
            "nordre-land.no",
            "nordreisa.no",
            "raisa.no",
            "ráisa.no",
            "nore-og-uvdal.no",
            "notodden.no",
            "naroy.no",
            "nærøy.no",
            "notteroy.no",
            "nøtterøy.no",
            "odda.no",
            "oksnes.no",
            "øksnes.no",
            "oppdal.no",
            "oppegard.no",
            "oppegård.no",
            "orkdal.no",
            "orland.no",
            "ørland.no",
            "orskog.no",
            "ørskog.no",
            "orsta.no",
            "ørsta.no",
            "os.hedmark.no",
            "os.hordaland.no",
            "osen.no",
            "osteroy.no",
            "osterøy.no",
            "ostre-toten.no",
            "østre-toten.no",
            "overhalla.no",
            "ovre-eiker.no",
            "øvre-eiker.no",
            "oyer.no",
            "øyer.no",
            "oygarden.no",
            "øygarden.no",
            "oystre-slidre.no",
            "øystre-slidre.no",
            "porsanger.no",
            "porsangu.no",
            "porsáŋgu.no",
            "porsgrunn.no",
            "radoy.no",
            "radøy.no",
            "rakkestad.no",
            "rana.no",
            "ruovat.no",
            "randaberg.no",
            "rauma.no",
            "rendalen.no",
            "rennebu.no",
            "rennesoy.no",
            "rennesøy.no",
            "rindal.no",
            "ringebu.no",
            "ringerike.no",
            "ringsaker.no",
            "rissa.no",
            "risor.no",
            "risør.no",
            "roan.no",
            "rollag.no",
            "rygge.no",
            "ralingen.no",
            "rælingen.no",
            "rodoy.no",
            "rødøy.no",
            "romskog.no",
            "rømskog.no",
            "roros.no",
            "røros.no",
            "rost.no",
            "røst.no",
            "royken.no",
            "røyken.no",
            "royrvik.no",
            "røyrvik.no",
            "rade.no",
            "råde.no",
            "salangen.no",
            "siellak.no",
            "saltdal.no",
            "salat.no",
            "sálát.no",
            "sálat.no",
            "samnanger.no",
            "sande.more-og-romsdal.no",
            "sande.møre-og-romsdal.no",
            "sande.vestfold.no",
            "sandefjord.no",
            "sandnes.no",
            "sandoy.no",
            "sandøy.no",
            "sarpsborg.no",
            "sauda.no",
            "sauherad.no",
            "sel.no",
            "selbu.no",
            "selje.no",
            "seljord.no",
            "sigdal.no",
            "siljan.no",
            "sirdal.no",
            "skaun.no",
            "skedsmo.no",
            "ski.no",
            "skien.no",
            "skiptvet.no",
            "skjervoy.no",
            "skjervøy.no",
            "skierva.no",
            "skiervá.no",
            "skjak.no",
            "skjåk.no",
            "skodje.no",
            "skanland.no",
            "skånland.no",
            "skanit.no",
            "skánit.no",
            "smola.no",
            "smøla.no",
            "snillfjord.no",
            "snasa.no",
            "snåsa.no",
            "snoasa.no",
            "snaase.no",
            "snåase.no",
            "sogndal.no",
            "sokndal.no",
            "sola.no",
            "solund.no",
            "songdalen.no",
            "sortland.no",
            "spydeberg.no",
            "stange.no",
            "stavanger.no",
            "steigen.no",
            "steinkjer.no",
            "stjordal.no",
            "stjørdal.no",
            "stokke.no",
            "stor-elvdal.no",
            "stord.no",
            "stordal.no",
            "storfjord.no",
            "omasvuotna.no",
            "strand.no",
            "stranda.no",
            "stryn.no",
            "sula.no",
            "suldal.no",
            "sund.no",
            "sunndal.no",
            "surnadal.no",
            "sveio.no",
            "svelvik.no",
            "sykkylven.no",
            "sogne.no",
            "søgne.no",
            "somna.no",
            "sømna.no",
            "sondre-land.no",
            "søndre-land.no",
            "sor-aurdal.no",
            "sør-aurdal.no",
            "sor-fron.no",
            "sør-fron.no",
            "sor-odal.no",
            "sør-odal.no",
            "sor-varanger.no",
            "sør-varanger.no",
            "matta-varjjat.no",
            "mátta-várjjat.no",
            "sorfold.no",
            "sørfold.no",
            "sorreisa.no",
            "sørreisa.no",
            "sorum.no",
            "sørum.no",
            "tana.no",
            "deatnu.no",
            "time.no",
            "tingvoll.no",
            "tinn.no",
            "tjeldsund.no",
            "dielddanuorri.no",
            "tjome.no",
            "tjøme.no",
            "tokke.no",
            "tolga.no",
            "torsken.no",
            "tranoy.no",
            "tranøy.no",
            "tromso.no",
            "tromsø.no",
            "tromsa.no",
            "romsa.no",
            "trondheim.no",
            "troandin.no",
            "trysil.no",
            "trana.no",
            "træna.no",
            "trogstad.no",
            "trøgstad.no",
            "tvedestrand.no",
            "tydal.no",
            "tynset.no",
            "tysfjord.no",
            "divtasvuodna.no",
            "divttasvuotna.no",
            "tysnes.no",
            "tysvar.no",
            "tysvær.no",
            "tonsberg.no",
            "tønsberg.no",
            "ullensaker.no",
            "ullensvang.no",
            "ulvik.no",
            "utsira.no",
            "vadso.no",
            "vadsø.no",
            "cahcesuolo.no",
            "čáhcesuolo.no",
            "vaksdal.no",
            "valle.no",
            "vang.no",
            "vanylven.no",
            "vardo.no",
            "vardø.no",
            "varggat.no",
            "várggát.no",
            "vefsn.no",
            "vaapste.no",
            "vega.no",
            "vegarshei.no",
            "vegårshei.no",
            "vennesla.no",
            "verdal.no",
            "verran.no",
            "vestby.no",
            "vestnes.no",
            "vestre-slidre.no",
            "vestre-toten.no",
            "vestvagoy.no",
            "vestvågøy.no",
            "vevelstad.no",
            "vik.no",
            "vikna.no",
            "vindafjord.no",
            "volda.no",
            "voss.no",
            "varoy.no",
            "værøy.no",
            "vagan.no",
            "vågan.no",
            "voagat.no",
            "vagsoy.no",
            "vågsøy.no",
            "vaga.no",
            "vågå.no",
            "valer.ostfold.no",
            "våler.østfold.no",
            "valer.hedmark.no",
            "våler.hedmark.no",
            "*.np",
            "nr",
            "biz.nr",
            "info.nr",
            "gov.nr",
            "edu.nr",
            "org.nr",
            "net.nr",
            "com.nr",
            "nu",
            "nz",
            "ac.nz",
            "co.nz",
            "cri.nz",
            "geek.nz",
            "gen.nz",
            "govt.nz",
            "health.nz",
            "iwi.nz",
            "kiwi.nz",
            "maori.nz",
            "mil.nz",
            "māori.nz",
            "net.nz",
            "org.nz",
            "parliament.nz",
            "school.nz",
            "om",
            "co.om",
            "com.om",
            "edu.om",
            "gov.om",
            "med.om",
            "museum.om",
            "net.om",
            "org.om",
            "pro.om",
            "onion",
            "org",
            "pa",
            "ac.pa",
            "gob.pa",
            "com.pa",
            "org.pa",
            "sld.pa",
            "edu.pa",
            "net.pa",
            "ing.pa",
            "abo.pa",
            "med.pa",
            "nom.pa",
            "pe",
            "edu.pe",
            "gob.pe",
            "nom.pe",
            "mil.pe",
            "org.pe",
            "com.pe",
            "net.pe",
            "pf",
            "com.pf",
            "org.pf",
            "edu.pf",
            "*.pg",
            "ph",
            "com.ph",
            "net.ph",
            "org.ph",
            "gov.ph",
            "edu.ph",
            "ngo.ph",
            "mil.ph",
            "i.ph",
            "pk",
            "com.pk",
            "net.pk",
            "edu.pk",
            "org.pk",
            "fam.pk",
            "biz.pk",
            "web.pk",
            "gov.pk",
            "gob.pk",
            "gok.pk",
            "gon.pk",
            "gop.pk",
            "gos.pk",
            "info.pk",
            "pl",
            "com.pl",
            "net.pl",
            "org.pl",
            "aid.pl",
            "agro.pl",
            "atm.pl",
            "auto.pl",
            "biz.pl",
            "edu.pl",
            "gmina.pl",
            "gsm.pl",
            "info.pl",
            "mail.pl",
            "miasta.pl",
            "media.pl",
            "mil.pl",
            "nieruchomosci.pl",
            "nom.pl",
            "pc.pl",
            "powiat.pl",
            "priv.pl",
            "realestate.pl",
            "rel.pl",
            "sex.pl",
            "shop.pl",
            "sklep.pl",
            "sos.pl",
            "szkola.pl",
            "targi.pl",
            "tm.pl",
            "tourism.pl",
            "travel.pl",
            "turystyka.pl",
            "gov.pl",
            "ap.gov.pl",
            "ic.gov.pl",
            "is.gov.pl",
            "us.gov.pl",
            "kmpsp.gov.pl",
            "kppsp.gov.pl",
            "kwpsp.gov.pl",
            "psp.gov.pl",
            "wskr.gov.pl",
            "kwp.gov.pl",
            "mw.gov.pl",
            "ug.gov.pl",
            "um.gov.pl",
            "umig.gov.pl",
            "ugim.gov.pl",
            "upow.gov.pl",
            "uw.gov.pl",
            "starostwo.gov.pl",
            "pa.gov.pl",
            "po.gov.pl",
            "psse.gov.pl",
            "pup.gov.pl",
            "rzgw.gov.pl",
            "sa.gov.pl",
            "so.gov.pl",
            "sr.gov.pl",
            "wsa.gov.pl",
            "sko.gov.pl",
            "uzs.gov.pl",
            "wiih.gov.pl",
            "winb.gov.pl",
            "pinb.gov.pl",
            "wios.gov.pl",
            "witd.gov.pl",
            "wzmiuw.gov.pl",
            "piw.gov.pl",
            "wiw.gov.pl",
            "griw.gov.pl",
            "wif.gov.pl",
            "oum.gov.pl",
            "sdn.gov.pl",
            "zp.gov.pl",
            "uppo.gov.pl",
            "mup.gov.pl",
            "wuoz.gov.pl",
            "konsulat.gov.pl",
            "oirm.gov.pl",
            "augustow.pl",
            "babia-gora.pl",
            "bedzin.pl",
            "beskidy.pl",
            "bialowieza.pl",
            "bialystok.pl",
            "bielawa.pl",
            "bieszczady.pl",
            "boleslawiec.pl",
            "bydgoszcz.pl",
            "bytom.pl",
            "cieszyn.pl",
            "czeladz.pl",
            "czest.pl",
            "dlugoleka.pl",
            "elblag.pl",
            "elk.pl",
            "glogow.pl",
            "gniezno.pl",
            "gorlice.pl",
            "grajewo.pl",
            "ilawa.pl",
            "jaworzno.pl",
            "jelenia-gora.pl",
            "jgora.pl",
            "kalisz.pl",
            "kazimierz-dolny.pl",
            "karpacz.pl",
            "kartuzy.pl",
            "kaszuby.pl",
            "katowice.pl",
            "kepno.pl",
            "ketrzyn.pl",
            "klodzko.pl",
            "kobierzyce.pl",
            "kolobrzeg.pl",
            "konin.pl",
            "konskowola.pl",
            "kutno.pl",
            "lapy.pl",
            "lebork.pl",
            "legnica.pl",
            "lezajsk.pl",
            "limanowa.pl",
            "lomza.pl",
            "lowicz.pl",
            "lubin.pl",
            "lukow.pl",
            "malbork.pl",
            "malopolska.pl",
            "mazowsze.pl",
            "mazury.pl",
            "mielec.pl",
            "mielno.pl",
            "mragowo.pl",
            "naklo.pl",
            "nowaruda.pl",
            "nysa.pl",
            "olawa.pl",
            "olecko.pl",
            "olkusz.pl",
            "olsztyn.pl",
            "opoczno.pl",
            "opole.pl",
            "ostroda.pl",
            "ostroleka.pl",
            "ostrowiec.pl",
            "ostrowwlkp.pl",
            "pila.pl",
            "pisz.pl",
            "podhale.pl",
            "podlasie.pl",
            "polkowice.pl",
            "pomorze.pl",
            "pomorskie.pl",
            "prochowice.pl",
            "pruszkow.pl",
            "przeworsk.pl",
            "pulawy.pl",
            "radom.pl",
            "rawa-maz.pl",
            "rybnik.pl",
            "rzeszow.pl",
            "sanok.pl",
            "sejny.pl",
            "slask.pl",
            "slupsk.pl",
            "sosnowiec.pl",
            "stalowa-wola.pl",
            "skoczow.pl",
            "starachowice.pl",
            "stargard.pl",
            "suwalki.pl",
            "swidnica.pl",
            "swiebodzin.pl",
            "swinoujscie.pl",
            "szczecin.pl",
            "szczytno.pl",
            "tarnobrzeg.pl",
            "tgory.pl",
            "turek.pl",
            "tychy.pl",
            "ustka.pl",
            "walbrzych.pl",
            "warmia.pl",
            "warszawa.pl",
            "waw.pl",
            "wegrow.pl",
            "wielun.pl",
            "wlocl.pl",
            "wloclawek.pl",
            "wodzislaw.pl",
            "wolomin.pl",
            "wroclaw.pl",
            "zachpomor.pl",
            "zagan.pl",
            "zarow.pl",
            "zgora.pl",
            "zgorzelec.pl",
            "pm",
            "pn",
            "gov.pn",
            "co.pn",
            "org.pn",
            "edu.pn",
            "net.pn",
            "post",
            "pr",
            "com.pr",
            "net.pr",
            "org.pr",
            "gov.pr",
            "edu.pr",
            "isla.pr",
            "pro.pr",
            "biz.pr",
            "info.pr",
            "name.pr",
            "est.pr",
            "prof.pr",
            "ac.pr",
            "pro",
            "aaa.pro",
            "aca.pro",
            "acct.pro",
            "avocat.pro",
            "bar.pro",
            "cpa.pro",
            "eng.pro",
            "jur.pro",
            "law.pro",
            "med.pro",
            "recht.pro",
            "ps",
            "edu.ps",
            "gov.ps",
            "sec.ps",
            "plo.ps",
            "com.ps",
            "org.ps",
            "net.ps",
            "pt",
            "net.pt",
            "gov.pt",
            "org.pt",
            "edu.pt",
            "int.pt",
            "publ.pt",
            "com.pt",
            "nome.pt",
            "pw",
            "co.pw",
            "ne.pw",
            "or.pw",
            "ed.pw",
            "go.pw",
            "belau.pw",
            "py",
            "com.py",
            "coop.py",
            "edu.py",
            "gov.py",
            "mil.py",
            "net.py",
            "org.py",
            "qa",
            "com.qa",
            "edu.qa",
            "gov.qa",
            "mil.qa",
            "name.qa",
            "net.qa",
            "org.qa",
            "sch.qa",
            "re",
            "asso.re",
            "com.re",
            "nom.re",
            "ro",
            "arts.ro",
            "com.ro",
            "firm.ro",
            "info.ro",
            "nom.ro",
            "nt.ro",
            "org.ro",
            "rec.ro",
            "store.ro",
            "tm.ro",
            "www.ro",
            "rs",
            "ac.rs",
            "co.rs",
            "edu.rs",
            "gov.rs",
            "in.rs",
            "org.rs",
            "ru",
            "ac.ru",
            "edu.ru",
            "gov.ru",
            "int.ru",
            "mil.ru",
            "test.ru",
            "rw",
            "gov.rw",
            "net.rw",
            "edu.rw",
            "ac.rw",
            "com.rw",
            "co.rw",
            "int.rw",
            "mil.rw",
            "gouv.rw",
            "sa",
            "com.sa",
            "net.sa",
            "org.sa",
            "gov.sa",
            "med.sa",
            "pub.sa",
            "edu.sa",
            "sch.sa",
            "sb",
            "com.sb",
            "edu.sb",
            "gov.sb",
            "net.sb",
            "org.sb",
            "sc",
            "com.sc",
            "gov.sc",
            "net.sc",
            "org.sc",
            "edu.sc",
            "sd",
            "com.sd",
            "net.sd",
            "org.sd",
            "edu.sd",
            "med.sd",
            "tv.sd",
            "gov.sd",
            "info.sd",
            "se",
            "a.se",
            "ac.se",
            "b.se",
            "bd.se",
            "brand.se",
            "c.se",
            "d.se",
            "e.se",
            "f.se",
            "fh.se",
            "fhsk.se",
            "fhv.se",
            "g.se",
            "h.se",
            "i.se",
            "k.se",
            "komforb.se",
            "kommunalforbund.se",
            "komvux.se",
            "l.se",
            "lanbib.se",
            "m.se",
            "n.se",
            "naturbruksgymn.se",
            "o.se",
            "org.se",
            "p.se",
            "parti.se",
            "pp.se",
            "press.se",
            "r.se",
            "s.se",
            "t.se",
            "tm.se",
            "u.se",
            "w.se",
            "x.se",
            "y.se",
            "z.se",
            "sg",
            "com.sg",
            "net.sg",
            "org.sg",
            "gov.sg",
            "edu.sg",
            "per.sg",
            "sh",
            "com.sh",
            "net.sh",
            "gov.sh",
            "org.sh",
            "mil.sh",
            "si",
            "sj",
            "sk",
            "sl",
            "com.sl",
            "net.sl",
            "edu.sl",
            "gov.sl",
            "org.sl",
            "sm",
            "sn",
            "art.sn",
            "com.sn",
            "edu.sn",
            "gouv.sn",
            "org.sn",
            "perso.sn",
            "univ.sn",
            "so",
            "com.so",
            "net.so",
            "org.so",
            "sr",
            "st",
            "co.st",
            "com.st",
            "consulado.st",
            "edu.st",
            "embaixada.st",
            "gov.st",
            "mil.st",
            "net.st",
            "org.st",
            "principe.st",
            "saotome.st",
            "store.st",
            "su",
            "sv",
            "com.sv",
            "edu.sv",
            "gob.sv",
            "org.sv",
            "red.sv",
            "sx",
            "gov.sx",
            "sy",
            "edu.sy",
            "gov.sy",
            "net.sy",
            "mil.sy",
            "com.sy",
            "org.sy",
            "sz",
            "co.sz",
            "ac.sz",
            "org.sz",
            "tc",
            "td",
            "tel",
            "tf",
            "tg",
            "th",
            "ac.th",
            "co.th",
            "go.th",
            "in.th",
            "mi.th",
            "net.th",
            "or.th",
            "tj",
            "ac.tj",
            "biz.tj",
            "co.tj",
            "com.tj",
            "edu.tj",
            "go.tj",
            "gov.tj",
            "int.tj",
            "mil.tj",
            "name.tj",
            "net.tj",
            "nic.tj",
            "org.tj",
            "test.tj",
            "web.tj",
            "tk",
            "tl",
            "gov.tl",
            "tm",
            "com.tm",
            "co.tm",
            "org.tm",
            "net.tm",
            "nom.tm",
            "gov.tm",
            "mil.tm",
            "edu.tm",
            "tn",
            "com.tn",
            "ens.tn",
            "fin.tn",
            "gov.tn",
            "ind.tn",
            "intl.tn",
            "nat.tn",
            "net.tn",
            "org.tn",
            "info.tn",
            "perso.tn",
            "tourism.tn",
            "edunet.tn",
            "rnrt.tn",
            "rns.tn",
            "rnu.tn",
            "mincom.tn",
            "agrinet.tn",
            "defense.tn",
            "turen.tn",
            "to",
            "com.to",
            "gov.to",
            "net.to",
            "org.to",
            "edu.to",
            "mil.to",
            "tr",
            "com.tr",
            "info.tr",
            "biz.tr",
            "net.tr",
            "org.tr",
            "web.tr",
            "gen.tr",
            "tv.tr",
            "av.tr",
            "dr.tr",
            "bbs.tr",
            "name.tr",
            "tel.tr",
            "gov.tr",
            "bel.tr",
            "pol.tr",
            "mil.tr",
            "k12.tr",
            "edu.tr",
            "kep.tr",
            "nc.tr",
            "gov.nc.tr",
            "tt",
            "co.tt",
            "com.tt",
            "org.tt",
            "net.tt",
            "biz.tt",
            "info.tt",
            "pro.tt",
            "int.tt",
            "coop.tt",
            "jobs.tt",
            "mobi.tt",
            "travel.tt",
            "museum.tt",
            "aero.tt",
            "name.tt",
            "gov.tt",
            "edu.tt",
            "tv",
            "tw",
            "edu.tw",
            "gov.tw",
            "mil.tw",
            "com.tw",
            "net.tw",
            "org.tw",
            "idv.tw",
            "game.tw",
            "ebiz.tw",
            "club.tw",
            "網路.tw",
            "組織.tw",
            "商業.tw",
            "tz",
            "ac.tz",
            "co.tz",
            "go.tz",
            "hotel.tz",
            "info.tz",
            "me.tz",
            "mil.tz",
            "mobi.tz",
            "ne.tz",
            "or.tz",
            "sc.tz",
            "tv.tz",
            "ua",
            "com.ua",
            "edu.ua",
            "gov.ua",
            "in.ua",
            "net.ua",
            "org.ua",
            "cherkassy.ua",
            "cherkasy.ua",
            "chernigov.ua",
            "chernihiv.ua",
            "chernivtsi.ua",
            "chernovtsy.ua",
            "ck.ua",
            "cn.ua",
            "cr.ua",
            "crimea.ua",
            "cv.ua",
            "dn.ua",
            "dnepropetrovsk.ua",
            "dnipropetrovsk.ua",
            "dominic.ua",
            "donetsk.ua",
            "dp.ua",
            "if.ua",
            "ivano-frankivsk.ua",
            "kh.ua",
            "kharkiv.ua",
            "kharkov.ua",
            "kherson.ua",
            "khmelnitskiy.ua",
            "khmelnytskyi.ua",
            "kiev.ua",
            "kirovograd.ua",
            "km.ua",
            "kr.ua",
            "krym.ua",
            "ks.ua",
            "kv.ua",
            "kyiv.ua",
            "lg.ua",
            "lt.ua",
            "lugansk.ua",
            "lutsk.ua",
            "lv.ua",
            "lviv.ua",
            "mk.ua",
            "mykolaiv.ua",
            "nikolaev.ua",
            "od.ua",
            "odesa.ua",
            "odessa.ua",
            "pl.ua",
            "poltava.ua",
            "rivne.ua",
            "rovno.ua",
            "rv.ua",
            "sb.ua",
            "sebastopol.ua",
            "sevastopol.ua",
            "sm.ua",
            "sumy.ua",
            "te.ua",
            "ternopil.ua",
            "uz.ua",
            "uzhgorod.ua",
            "vinnica.ua",
            "vinnytsia.ua",
            "vn.ua",
            "volyn.ua",
            "yalta.ua",
            "zaporizhzhe.ua",
            "zaporizhzhia.ua",
            "zhitomir.ua",
            "zhytomyr.ua",
            "zp.ua",
            "zt.ua",
            "ug",
            "co.ug",
            "or.ug",
            "ac.ug",
            "sc.ug",
            "go.ug",
            "ne.ug",
            "com.ug",
            "org.ug",
            "uk",
            "ac.uk",
            "co.uk",
            "gov.uk",
            "ltd.uk",
            "me.uk",
            "net.uk",
            "nhs.uk",
            "org.uk",
            "plc.uk",
            "police.uk",
            "*.sch.uk",
            "us",
            "dni.us",
            "fed.us",
            "isa.us",
            "kids.us",
            "nsn.us",
            "ak.us",
            "al.us",
            "ar.us",
            "as.us",
            "az.us",
            "ca.us",
            "co.us",
            "ct.us",
            "dc.us",
            "de.us",
            "fl.us",
            "ga.us",
            "gu.us",
            "hi.us",
            "ia.us",
            "id.us",
            "il.us",
            "in.us",
            "ks.us",
            "ky.us",
            "la.us",
            "ma.us",
            "md.us",
            "me.us",
            "mi.us",
            "mn.us",
            "mo.us",
            "ms.us",
            "mt.us",
            "nc.us",
            "nd.us",
            "ne.us",
            "nh.us",
            "nj.us",
            "nm.us",
            "nv.us",
            "ny.us",
            "oh.us",
            "ok.us",
            "or.us",
            "pa.us",
            "pr.us",
            "ri.us",
            "sc.us",
            "sd.us",
            "tn.us",
            "tx.us",
            "ut.us",
            "vi.us",
            "vt.us",
            "va.us",
            "wa.us",
            "wi.us",
            "wv.us",
            "wy.us",
            "k12.ak.us",
            "k12.al.us",
            "k12.ar.us",
            "k12.as.us",
            "k12.az.us",
            "k12.ca.us",
            "k12.co.us",
            "k12.ct.us",
            "k12.dc.us",
            "k12.de.us",
            "k12.fl.us",
            "k12.ga.us",
            "k12.gu.us",
            "k12.ia.us",
            "k12.id.us",
            "k12.il.us",
            "k12.in.us",
            "k12.ks.us",
            "k12.ky.us",
            "k12.la.us",
            "k12.ma.us",
            "k12.md.us",
            "k12.me.us",
            "k12.mi.us",
            "k12.mn.us",
            "k12.mo.us",
            "k12.ms.us",
            "k12.mt.us",
            "k12.nc.us",
            "k12.ne.us",
            "k12.nh.us",
            "k12.nj.us",
            "k12.nm.us",
            "k12.nv.us",
            "k12.ny.us",
            "k12.oh.us",
            "k12.ok.us",
            "k12.or.us",
            "k12.pa.us",
            "k12.pr.us",
            "k12.ri.us",
            "k12.sc.us",
            "k12.tn.us",
            "k12.tx.us",
            "k12.ut.us",
            "k12.vi.us",
            "k12.vt.us",
            "k12.va.us",
            "k12.wa.us",
            "k12.wi.us",
            "k12.wy.us",
            "cc.ak.us",
            "cc.al.us",
            "cc.ar.us",
            "cc.as.us",
            "cc.az.us",
            "cc.ca.us",
            "cc.co.us",
            "cc.ct.us",
            "cc.dc.us",
            "cc.de.us",
            "cc.fl.us",
            "cc.ga.us",
            "cc.gu.us",
            "cc.hi.us",
            "cc.ia.us",
            "cc.id.us",
            "cc.il.us",
            "cc.in.us",
            "cc.ks.us",
            "cc.ky.us",
            "cc.la.us",
            "cc.ma.us",
            "cc.md.us",
            "cc.me.us",
            "cc.mi.us",
            "cc.mn.us",
            "cc.mo.us",
            "cc.ms.us",
            "cc.mt.us",
            "cc.nc.us",
            "cc.nd.us",
            "cc.ne.us",
            "cc.nh.us",
            "cc.nj.us",
            "cc.nm.us",
            "cc.nv.us",
            "cc.ny.us",
            "cc.oh.us",
            "cc.ok.us",
            "cc.or.us",
            "cc.pa.us",
            "cc.pr.us",
            "cc.ri.us",
            "cc.sc.us",
            "cc.sd.us",
            "cc.tn.us",
            "cc.tx.us",
            "cc.ut.us",
            "cc.vi.us",
            "cc.vt.us",
            "cc.va.us",
            "cc.wa.us",
            "cc.wi.us",
            "cc.wv.us",
            "cc.wy.us",
            "lib.ak.us",
            "lib.al.us",
            "lib.ar.us",
            "lib.as.us",
            "lib.az.us",
            "lib.ca.us",
            "lib.co.us",
            "lib.ct.us",
            "lib.dc.us",
            "lib.fl.us",
            "lib.ga.us",
            "lib.gu.us",
            "lib.hi.us",
            "lib.ia.us",
            "lib.id.us",
            "lib.il.us",
            "lib.in.us",
            "lib.ks.us",
            "lib.ky.us",
            "lib.la.us",
            "lib.ma.us",
            "lib.md.us",
            "lib.me.us",
            "lib.mi.us",
            "lib.mn.us",
            "lib.mo.us",
            "lib.ms.us",
            "lib.mt.us",
            "lib.nc.us",
            "lib.nd.us",
            "lib.ne.us",
            "lib.nh.us",
            "lib.nj.us",
            "lib.nm.us",
            "lib.nv.us",
            "lib.ny.us",
            "lib.oh.us",
            "lib.ok.us",
            "lib.or.us",
            "lib.pa.us",
            "lib.pr.us",
            "lib.ri.us",
            "lib.sc.us",
            "lib.sd.us",
            "lib.tn.us",
            "lib.tx.us",
            "lib.ut.us",
            "lib.vi.us",
            "lib.vt.us",
            "lib.va.us",
            "lib.wa.us",
            "lib.wi.us",
            "lib.wy.us",
            "pvt.k12.ma.us",
            "chtr.k12.ma.us",
            "paroch.k12.ma.us",
            "ann-arbor.mi.us",
            "cog.mi.us",
            "dst.mi.us",
            "eaton.mi.us",
            "gen.mi.us",
            "mus.mi.us",
            "tec.mi.us",
            "washtenaw.mi.us",
            "uy",
            "com.uy",
            "edu.uy",
            "gub.uy",
            "mil.uy",
            "net.uy",
            "org.uy",
            "uz",
            "co.uz",
            "com.uz",
            "net.uz",
            "org.uz",
            "va",
            "vc",
            "com.vc",
            "net.vc",
            "org.vc",
            "gov.vc",
            "mil.vc",
            "edu.vc",
            "ve",
            "arts.ve",
            "co.ve",
            "com.ve",
            "e12.ve",
            "edu.ve",
            "firm.ve",
            "gob.ve",
            "gov.ve",
            "info.ve",
            "int.ve",
            "mil.ve",
            "net.ve",
            "org.ve",
            "rec.ve",
            "store.ve",
            "tec.ve",
            "web.ve",
            "vg",
            "vi",
            "co.vi",
            "com.vi",
            "k12.vi",
            "net.vi",
            "org.vi",
            "vn",
            "com.vn",
            "net.vn",
            "org.vn",
            "edu.vn",
            "gov.vn",
            "int.vn",
            "ac.vn",
            "biz.vn",
            "info.vn",
            "name.vn",
            "pro.vn",
            "health.vn",
            "vu",
            "com.vu",
            "edu.vu",
            "net.vu",
            "org.vu",
            "wf",
            "ws",
            "com.ws",
            "net.ws",
            "org.ws",
            "gov.ws",
            "edu.ws",
            "yt",
            "امارات",
            "հայ",
            "বাংলা",
            "бг",
            "бел",
            "中国",
            "中國",
            "الجزائر",
            "مصر",
            "ею",
            "გე",
            "ελ",
            "香港",
            "公司.香港",
            "教育.香港",
            "政府.香港",
            "個人.香港",
            "網絡.香港",
            "組織.香港",
            "ಭಾರತ",
            "ଭାରତ",
            "ভাৰত",
            "भारतम्",
            "भारोत",
            "ڀارت",
            "ഭാരതം",
            "भारत",
            "بارت",
            "بھارت",
            "భారత్",
            "ભારત",
            "ਭਾਰਤ",
            "ভারত",
            "இந்தியா",
            "ایران",
            "ايران",
            "عراق",
            "الاردن",
            "한국",
            "қаз",
            "ලංකා",
            "இலங்கை",
            "المغرب",
            "мкд",
            "мон",
            "澳門",
            "澳门",
            "مليسيا",
            "عمان",
            "پاکستان",
            "پاكستان",
            "فلسطين",
            "срб",
            "пр.срб",
            "орг.срб",
            "обр.срб",
            "од.срб",
            "упр.срб",
            "ак.срб",
            "рф",
            "قطر",
            "السعودية",
            "السعودیة",
            "السعودیۃ",
            "السعوديه",
            "سودان",
            "新加坡",
            "சிங்கப்பூர்",
            "سورية",
            "سوريا",
            "ไทย",
            "ศึกษา.ไทย",
            "ธุรกิจ.ไทย",
            "รัฐบาล.ไทย",
            "ทหาร.ไทย",
            "เน็ต.ไทย",
            "องค์กร.ไทย",
            "تونس",
            "台灣",
            "台湾",
            "臺灣",
            "укр",
            "اليمن",
            "xxx",
            "*.ye",
            "ac.za",
            "agric.za",
            "alt.za",
            "co.za",
            "edu.za",
            "gov.za",
            "grondar.za",
            "law.za",
            "mil.za",
            "net.za",
            "ngo.za",
            "nis.za",
            "nom.za",
            "org.za",
            "school.za",
            "tm.za",
            "web.za",
            "zm",
            "ac.zm",
            "biz.zm",
            "co.zm",
            "com.zm",
            "edu.zm",
            "gov.zm",
            "info.zm",
            "mil.zm",
            "net.zm",
            "org.zm",
            "sch.zm",
            "zw",
            "ac.zw",
            "co.zw",
            "gov.zw",
            "mil.zw",
            "org.zw",
            "aaa",
            "aarp",
            "abarth",
            "abb",
            "abbott",
            "abbvie",
            "abc",
            "able",
            "abogado",
            "abudhabi",
            "academy",
            "accenture",
            "accountant",
            "accountants",
            "aco",
            "active",
            "actor",
            "adac",
            "ads",
            "adult",
            "aeg",
            "aetna",
            "afamilycompany",
            "afl",
            "africa",
            "agakhan",
            "agency",
            "aig",
            "aigo",
            "airbus",
            "airforce",
            "airtel",
            "akdn",
            "alfaromeo",
            "alibaba",
            "alipay",
            "allfinanz",
            "allstate",
            "ally",
            "alsace",
            "alstom",
            "americanexpress",
            "americanfamily",
            "amex",
            "amfam",
            "amica",
            "amsterdam",
            "analytics",
            "android",
            "anquan",
            "anz",
            "aol",
            "apartments",
            "app",
            "apple",
            "aquarelle",
            "arab",
            "aramco",
            "archi",
            "army",
            "art",
            "arte",
            "asda",
            "associates",
            "athleta",
            "attorney",
            "auction",
            "audi",
            "audible",
            "audio",
            "auspost",
            "author",
            "auto",
            "autos",
            "avianca",
            "aws",
            "axa",
            "azure",
            "baby",
            "baidu",
            "banamex",
            "bananarepublic",
            "band",
            "bank",
            "bar",
            "barcelona",
            "barclaycard",
            "barclays",
            "barefoot",
            "bargains",
            "baseball",
            "basketball",
            "bauhaus",
            "bayern",
            "bbc",
            "bbt",
            "bbva",
            "bcg",
            "bcn",
            "beats",
            "beauty",
            "beer",
            "bentley",
            "berlin",
            "best",
            "bestbuy",
            "bet",
            "bharti",
            "bible",
            "bid",
            "bike",
            "bing",
            "bingo",
            "bio",
            "black",
            "blackfriday",
            "blanco",
            "blockbuster",
            "blog",
            "bloomberg",
            "blue",
            "bms",
            "bmw",
            "bnl",
            "bnpparibas",
            "boats",
            "boehringer",
            "bofa",
            "bom",
            "bond",
            "boo",
            "book",
            "booking",
            "bosch",
            "bostik",
            "boston",
            "bot",
            "boutique",
            "box",
            "bradesco",
            "bridgestone",
            "broadway",
            "broker",
            "brother",
            "brussels",
            "budapest",
            "bugatti",
            "build",
            "builders",
            "business",
            "buy",
            "buzz",
            "bzh",
            "cab",
            "cafe",
            "cal",
            "call",
            "calvinklein",
            "cam",
            "camera",
            "camp",
            "cancerresearch",
            "canon",
            "capetown",
            "capital",
            "capitalone",
            "car",
            "caravan",
            "cards",
            "care",
            "career",
            "careers",
            "cars",
            "cartier",
            "casa",
            "case",
            "caseih",
            "cash",
            "casino",
            "catering",
            "catholic",
            "cba",
            "cbn",
            "cbre",
            "cbs",
            "ceb",
            "center",
            "ceo",
            "cern",
            "cfa",
            "cfd",
            "chanel",
            "channel",
            "charity",
            "chase",
            "chat",
            "cheap",
            "chintai",
            "christmas",
            "chrome",
            "chrysler",
            "church",
            "cipriani",
            "circle",
            "cisco",
            "citadel",
            "citi",
            "citic",
            "city",
            "cityeats",
            "claims",
            "cleaning",
            "click",
            "clinic",
            "clinique",
            "clothing",
            "cloud",
            "club",
            "clubmed",
            "coach",
            "codes",
            "coffee",
            "college",
            "cologne",
            "comcast",
            "commbank",
            "community",
            "company",
            "compare",
            "computer",
            "comsec",
            "condos",
            "construction",
            "consulting",
            "contact",
            "contractors",
            "cooking",
            "cookingchannel",
            "cool",
            "corsica",
            "country",
            "coupon",
            "coupons",
            "courses",
            "credit",
            "creditcard",
            "creditunion",
            "cricket",
            "crown",
            "crs",
            "cruise",
            "cruises",
            "csc",
            "cuisinella",
            "cymru",
            "cyou",
            "dabur",
            "dad",
            "dance",
            "data",
            "date",
            "dating",
            "datsun",
            "day",
            "dclk",
            "dds",
            "deal",
            "dealer",
            "deals",
            "degree",
            "delivery",
            "dell",
            "deloitte",
            "delta",
            "democrat",
            "dental",
            "dentist",
            "desi",
            "design",
            "dev",
            "dhl",
            "diamonds",
            "diet",
            "digital",
            "direct",
            "directory",
            "discount",
            "discover",
            "dish",
            "diy",
            "dnp",
            "docs",
            "doctor",
            "dodge",
            "dog",
            "doha",
            "domains",
            "dot",
            "download",
            "drive",
            "dtv",
            "dubai",
            "duck",
            "dunlop",
            "duns",
            "dupont",
            "durban",
            "dvag",
            "dvr",
            "earth",
            "eat",
            "eco",
            "edeka",
            "education",
            "email",
            "emerck",
            "energy",
            "engineer",
            "engineering",
            "enterprises",
            "epost",
            "epson",
            "equipment",
            "ericsson",
            "erni",
            "esq",
            "estate",
            "esurance",
            "etisalat",
            "eurovision",
            "eus",
            "events",
            "everbank",
            "exchange",
            "expert",
            "exposed",
            "express",
            "extraspace",
            "fage",
            "fail",
            "fairwinds",
            "faith",
            "family",
            "fan",
            "fans",
            "farm",
            "farmers",
            "fashion",
            "fast",
            "fedex",
            "feedback",
            "ferrari",
            "ferrero",
            "fiat",
            "fidelity",
            "fido",
            "film",
            "final",
            "finance",
            "financial",
            "fire",
            "firestone",
            "firmdale",
            "fish",
            "fishing",
            "fit",
            "fitness",
            "flickr",
            "flights",
            "flir",
            "florist",
            "flowers",
            "fly",
            "foo",
            "food",
            "foodnetwork",
            "football",
            "ford",
            "forex",
            "forsale",
            "forum",
            "foundation",
            "fox",
            "free",
            "fresenius",
            "frl",
            "frogans",
            "frontdoor",
            "frontier",
            "ftr",
            "fujitsu",
            "fujixerox",
            "fun",
            "fund",
            "furniture",
            "futbol",
            "fyi",
            "gal",
            "gallery",
            "gallo",
            "gallup",
            "game",
            "games",
            "gap",
            "garden",
            "gbiz",
            "gdn",
            "gea",
            "gent",
            "genting",
            "george",
            "ggee",
            "gift",
            "gifts",
            "gives",
            "giving",
            "glade",
            "glass",
            "gle",
            "global",
            "globo",
            "gmail",
            "gmbh",
            "gmo",
            "gmx",
            "godaddy",
            "gold",
            "goldpoint",
            "golf",
            "goo",
            "goodhands",
            "goodyear",
            "goog",
            "google",
            "gop",
            "got",
            "grainger",
            "graphics",
            "gratis",
            "green",
            "gripe",
            "grocery",
            "group",
            "guardian",
            "gucci",
            "guge",
            "guide",
            "guitars",
            "guru",
            "hair",
            "hamburg",
            "hangout",
            "haus",
            "hbo",
            "hdfc",
            "hdfcbank",
            "health",
            "healthcare",
            "help",
            "helsinki",
            "here",
            "hermes",
            "hgtv",
            "hiphop",
            "hisamitsu",
            "hitachi",
            "hiv",
            "hkt",
            "hockey",
            "holdings",
            "holiday",
            "homedepot",
            "homegoods",
            "homes",
            "homesense",
            "honda",
            "honeywell",
            "horse",
            "hospital",
            "host",
            "hosting",
            "hot",
            "hoteles",
            "hotels",
            "hotmail",
            "house",
            "how",
            "hsbc",
            "hughes",
            "hyatt",
            "hyundai",
            "ibm",
            "icbc",
            "ice",
            "icu",
            "ieee",
            "ifm",
            "ikano",
            "imamat",
            "imdb",
            "immo",
            "immobilien",
            "inc",
            "industries",
            "infiniti",
            "ing",
            "ink",
            "institute",
            "insurance",
            "insure",
            "intel",
            "international",
            "intuit",
            "investments",
            "ipiranga",
            "irish",
            "iselect",
            "ismaili",
            "ist",
            "istanbul",
            "itau",
            "itv",
            "iveco",
            "jaguar",
            "java",
            "jcb",
            "jcp",
            "jeep",
            "jetzt",
            "jewelry",
            "jio",
            "jlc",
            "jll",
            "jmp",
            "jnj",
            "joburg",
            "jot",
            "joy",
            "jpmorgan",
            "jprs",
            "juegos",
            "juniper",
            "kaufen",
            "kddi",
            "kerryhotels",
            "kerrylogistics",
            "kerryproperties",
            "kfh",
            "kia",
            "kim",
            "kinder",
            "kindle",
            "kitchen",
            "kiwi",
            "koeln",
            "komatsu",
            "kosher",
            "kpmg",
            "kpn",
            "krd",
            "kred",
            "kuokgroup",
            "kyoto",
            "lacaixa",
            "ladbrokes",
            "lamborghini",
            "lamer",
            "lancaster",
            "lancia",
            "lancome",
            "land",
            "landrover",
            "lanxess",
            "lasalle",
            "lat",
            "latino",
            "latrobe",
            "law",
            "lawyer",
            "lds",
            "lease",
            "leclerc",
            "lefrak",
            "legal",
            "lego",
            "lexus",
            "lgbt",
            "liaison",
            "lidl",
            "life",
            "lifeinsurance",
            "lifestyle",
            "lighting",
            "like",
            "lilly",
            "limited",
            "limo",
            "lincoln",
            "linde",
            "link",
            "lipsy",
            "live",
            "living",
            "lixil",
            "llc",
            "loan",
            "loans",
            "locker",
            "locus",
            "loft",
            "lol",
            "london",
            "lotte",
            "lotto",
            "love",
            "lpl",
            "lplfinancial",
            "ltd",
            "ltda",
            "lundbeck",
            "lupin",
            "luxe",
            "luxury",
            "macys",
            "madrid",
            "maif",
            "maison",
            "makeup",
            "man",
            "management",
            "mango",
            "map",
            "market",
            "marketing",
            "markets",
            "marriott",
            "marshalls",
            "maserati",
            "mattel",
            "mba",
            "mckinsey",
            "med",
            "media",
            "meet",
            "melbourne",
            "meme",
            "memorial",
            "men",
            "menu",
            "merckmsd",
            "metlife",
            "miami",
            "microsoft",
            "mini",
            "mint",
            "mit",
            "mitsubishi",
            "mlb",
            "mls",
            "mma",
            "mobile",
            "mobily",
            "moda",
            "moe",
            "moi",
            "mom",
            "monash",
            "money",
            "monster",
            "mopar",
            "mormon",
            "mortgage",
            "moscow",
            "moto",
            "motorcycles",
            "mov",
            "movie",
            "movistar",
            "msd",
            "mtn",
            "mtr",
            "mutual",
            "nab",
            "nadex",
            "nagoya",
            "nationwide",
            "natura",
            "navy",
            "nba",
            "nec",
            "netbank",
            "netflix",
            "network",
            "neustar",
            "new",
            "newholland",
            "news",
            "next",
            "nextdirect",
            "nexus",
            "nfl",
            "ngo",
            "nhk",
            "nico",
            "nike",
            "nikon",
            "ninja",
            "nissan",
            "nissay",
            "nokia",
            "northwesternmutual",
            "norton",
            "now",
            "nowruz",
            "nowtv",
            "nra",
            "nrw",
            "ntt",
            "nyc",
            "obi",
            "observer",
            "off",
            "office",
            "okinawa",
            "olayan",
            "olayangroup",
            "oldnavy",
            "ollo",
            "omega",
            "one",
            "ong",
            "onl",
            "online",
            "onyourside",
            "ooo",
            "open",
            "oracle",
            "orange",
            "organic",
            "origins",
            "osaka",
            "otsuka",
            "ott",
            "ovh",
            "page",
            "panasonic",
            "panerai",
            "paris",
            "pars",
            "partners",
            "parts",
            "party",
            "passagens",
            "pay",
            "pccw",
            "pet",
            "pfizer",
            "pharmacy",
            "phd",
            "philips",
            "phone",
            "photo",
            "photography",
            "photos",
            "physio",
            "piaget",
            "pics",
            "pictet",
            "pictures",
            "pid",
            "pin",
            "ping",
            "pink",
            "pioneer",
            "pizza",
            "place",
            "play",
            "playstation",
            "plumbing",
            "plus",
            "pnc",
            "pohl",
            "poker",
            "politie",
            "porn",
            "pramerica",
            "praxi",
            "press",
            "prime",
            "prod",
            "productions",
            "prof",
            "progressive",
            "promo",
            "properties",
            "property",
            "protection",
            "pru",
            "prudential",
            "pub",
            "pwc",
            "qpon",
            "quebec",
            "quest",
            "qvc",
            "racing",
            "radio",
            "raid",
            "read",
            "realestate",
            "realtor",
            "realty",
            "recipes",
            "red",
            "redstone",
            "redumbrella",
            "rehab",
            "reise",
            "reisen",
            "reit",
            "reliance",
            "ren",
            "rent",
            "rentals",
            "repair",
            "report",
            "republican",
            "rest",
            "restaurant",
            "review",
            "reviews",
            "rexroth",
            "rich",
            "richardli",
            "ricoh",
            "rightathome",
            "ril",
            "rio",
            "rip",
            "rmit",
            "rocher",
            "rocks",
            "rodeo",
            "rogers",
            "room",
            "rsvp",
            "rugby",
            "ruhr",
            "run",
            "rwe",
            "ryukyu",
            "saarland",
            "safe",
            "safety",
            "sakura",
            "sale",
            "salon",
            "samsclub",
            "samsung",
            "sandvik",
            "sandvikcoromant",
            "sanofi",
            "sap",
            "sarl",
            "sas",
            "save",
            "saxo",
            "sbi",
            "sbs",
            "sca",
            "scb",
            "schaeffler",
            "schmidt",
            "scholarships",
            "school",
            "schule",
            "schwarz",
            "science",
            "scjohnson",
            "scor",
            "scot",
            "search",
            "seat",
            "secure",
            "security",
            "seek",
            "select",
            "sener",
            "services",
            "ses",
            "seven",
            "sew",
            "sex",
            "sexy",
            "sfr",
            "shangrila",
            "sharp",
            "shaw",
            "shell",
            "shia",
            "shiksha",
            "shoes",
            "shop",
            "shopping",
            "shouji",
            "show",
            "showtime",
            "shriram",
            "silk",
            "sina",
            "singles",
            "site",
            "ski",
            "skin",
            "sky",
            "skype",
            "sling",
            "smart",
            "smile",
            "sncf",
            "soccer",
            "social",
            "softbank",
            "software",
            "sohu",
            "solar",
            "solutions",
            "song",
            "sony",
            "soy",
            "space",
            "spiegel",
            "sport",
            "spot",
            "spreadbetting",
            "srl",
            "srt",
            "stada",
            "staples",
            "star",
            "starhub",
            "statebank",
            "statefarm",
            "statoil",
            "stc",
            "stcgroup",
            "stockholm",
            "storage",
            "store",
            "stream",
            "studio",
            "study",
            "style",
            "sucks",
            "supplies",
            "supply",
            "support",
            "surf",
            "surgery",
            "suzuki",
            "swatch",
            "swiftcover",
            "swiss",
            "sydney",
            "symantec",
            "systems",
            "tab",
            "taipei",
            "talk",
            "taobao",
            "target",
            "tatamotors",
            "tatar",
            "tattoo",
            "tax",
            "taxi",
            "tci",
            "tdk",
            "team",
            "tech",
            "technology",
            "telecity",
            "telefonica",
            "temasek",
            "tennis",
            "teva",
            "thd",
            "theater",
            "theatre",
            "tiaa",
            "tickets",
            "tienda",
            "tiffany",
            "tips",
            "tires",
            "tirol",
            "tjmaxx",
            "tjx",
            "tkmaxx",
            "tmall",
            "today",
            "tokyo",
            "tools",
            "top",
            "toray",
            "toshiba",
            "total",
            "tours",
            "town",
            "toyota",
            "toys",
            "trade",
            "trading",
            "training",
            "travel",
            "travelchannel",
            "travelers",
            "travelersinsurance",
            "trust",
            "trv",
            "tube",
            "tui",
            "tunes",
            "tushu",
            "tvs",
            "ubank",
            "ubs",
            "uconnect",
            "unicom",
            "university",
            "uno",
            "uol",
            "ups",
            "vacations",
            "vana",
            "vanguard",
            "vegas",
            "ventures",
            "verisign",
            "versicherung",
            "vet",
            "viajes",
            "video",
            "vig",
            "viking",
            "villas",
            "vin",
            "vip",
            "virgin",
            "visa",
            "vision",
            "vista",
            "vistaprint",
            "viva",
            "vivo",
            "vlaanderen",
            "vodka",
            "volkswagen",
            "volvo",
            "vote",
            "voting",
            "voto",
            "voyage",
            "vuelos",
            "wales",
            "walmart",
            "walter",
            "wang",
            "wanggou",
            "warman",
            "watch",
            "watches",
            "weather",
            "weatherchannel",
            "webcam",
            "weber",
            "website",
            "wed",
            "wedding",
            "weibo",
            "weir",
            "whoswho",
            "wien",
            "wiki",
            "williamhill",
            "win",
            "windows",
            "wine",
            "winners",
            "wme",
            "wolterskluwer",
            "woodside",
            "work",
            "works",
            "world",
            "wow",
            "wtc",
            "wtf",
            "xbox",
            "xerox",
            "xfinity",
            "xihuan",
            "xin",
            "कॉम",
            "セール",
            "佛山",
            "慈善",
            "集团",
            "在线",
            "大众汽车",
            "点看",
            "คอม",
            "八卦",
            "موقع",
            "公益",
            "公司",
            "香格里拉",
            "网站",
            "移动",
            "我爱你",
            "москва",
            "католик",
            "онлайн",
            "сайт",
            "联通",
            "קום",
            "时尚",
            "微博",
            "淡马锡",
            "ファッション",
            "орг",
            "नेट",
            "ストア",
            "삼성",
            "商标",
            "商店",
            "商城",
            "дети",
            "ポイント",
            "新闻",
            "工行",
            "家電",
            "كوم",
            "中文网",
            "中信",
            "娱乐",
            "谷歌",
            "電訊盈科",
            "购物",
            "クラウド",
            "通販",
            "网店",
            "संगठन",
            "餐厅",
            "网络",
            "ком",
            "诺基亚",
            "食品",
            "飞利浦",
            "手表",
            "手机",
            "ارامكو",
            "العليان",
            "اتصالات",
            "بازار",
            "موبايلي",
            "ابوظبي",
            "كاثوليك",
            "همراه",
            "닷컴",
            "政府",
            "شبكة",
            "بيتك",
            "عرب",
            "机构",
            "组织机构",
            "健康",
            "招聘",
            "рус",
            "珠宝",
            "大拿",
            "みんな",
            "グーグル",
            "世界",
            "書籍",
            "网址",
            "닷넷",
            "コム",
            "天主教",
            "游戏",
            "vermögensberater",
            "vermögensberatung",
            "企业",
            "信息",
            "嘉里大酒店",
            "嘉里",
            "广东",
            "政务",
            "xyz",
            "yachts",
            "yahoo",
            "yamaxun",
            "yandex",
            "yodobashi",
            "yoga",
            "yokohama",
            "you",
            "youtube",
            "yun",
            "zappos",
            "zara",
            "zero",
            "zip",
            "zippo",
            "zone",
            "zuerich",
            "cc.ua",
            "inf.ua",
            "ltd.ua",
            "beep.pl",
            "*.compute.estate",
            "*.alces.network",
            "alwaysdata.net",
            "cloudfront.net",
            "*.compute.amazonaws.com",
            "*.compute-1.amazonaws.com",
            "*.compute.amazonaws.com.cn",
            "us-east-1.amazonaws.com",
            "cn-north-1.eb.amazonaws.com.cn",
            "elasticbeanstalk.com",
            "ap-northeast-1.elasticbeanstalk.com",
            "ap-northeast-2.elasticbeanstalk.com",
            "ap-northeast-3.elasticbeanstalk.com",
            "ap-south-1.elasticbeanstalk.com",
            "ap-southeast-1.elasticbeanstalk.com",
            "ap-southeast-2.elasticbeanstalk.com",
            "ca-central-1.elasticbeanstalk.com",
            "eu-central-1.elasticbeanstalk.com",
            "eu-west-1.elasticbeanstalk.com",
            "eu-west-2.elasticbeanstalk.com",
            "eu-west-3.elasticbeanstalk.com",
            "sa-east-1.elasticbeanstalk.com",
            "us-east-1.elasticbeanstalk.com",
            "us-east-2.elasticbeanstalk.com",
            "us-gov-west-1.elasticbeanstalk.com",
            "us-west-1.elasticbeanstalk.com",
            "us-west-2.elasticbeanstalk.com",
            "*.elb.amazonaws.com",
            "*.elb.amazonaws.com.cn",
            "s3.amazonaws.com",
            "s3-ap-northeast-1.amazonaws.com",
            "s3-ap-northeast-2.amazonaws.com",
            "s3-ap-south-1.amazonaws.com",
            "s3-ap-southeast-1.amazonaws.com",
            "s3-ap-southeast-2.amazonaws.com",
            "s3-ca-central-1.amazonaws.com",
            "s3-eu-central-1.amazonaws.com",
            "s3-eu-west-1.amazonaws.com",
            "s3-eu-west-2.amazonaws.com",
            "s3-eu-west-3.amazonaws.com",
            "s3-external-1.amazonaws.com",
            "s3-fips-us-gov-west-1.amazonaws.com",
            "s3-sa-east-1.amazonaws.com",
            "s3-us-gov-west-1.amazonaws.com",
            "s3-us-east-2.amazonaws.com",
            "s3-us-west-1.amazonaws.com",
            "s3-us-west-2.amazonaws.com",
            "s3.ap-northeast-2.amazonaws.com",
            "s3.ap-south-1.amazonaws.com",
            "s3.cn-north-1.amazonaws.com.cn",
            "s3.ca-central-1.amazonaws.com",
            "s3.eu-central-1.amazonaws.com",
            "s3.eu-west-2.amazonaws.com",
            "s3.eu-west-3.amazonaws.com",
            "s3.us-east-2.amazonaws.com",
            "s3.dualstack.ap-northeast-1.amazonaws.com",
            "s3.dualstack.ap-northeast-2.amazonaws.com",
            "s3.dualstack.ap-south-1.amazonaws.com",
            "s3.dualstack.ap-southeast-1.amazonaws.com",
            "s3.dualstack.ap-southeast-2.amazonaws.com",
            "s3.dualstack.ca-central-1.amazonaws.com",
            "s3.dualstack.eu-central-1.amazonaws.com",
            "s3.dualstack.eu-west-1.amazonaws.com",
            "s3.dualstack.eu-west-2.amazonaws.com",
            "s3.dualstack.eu-west-3.amazonaws.com",
            "s3.dualstack.sa-east-1.amazonaws.com",
            "s3.dualstack.us-east-1.amazonaws.com",
            "s3.dualstack.us-east-2.amazonaws.com",
            "s3-website-us-east-1.amazonaws.com",
            "s3-website-us-west-1.amazonaws.com",
            "s3-website-us-west-2.amazonaws.com",
            "s3-website-ap-northeast-1.amazonaws.com",
            "s3-website-ap-southeast-1.amazonaws.com",
            "s3-website-ap-southeast-2.amazonaws.com",
            "s3-website-eu-west-1.amazonaws.com",
            "s3-website-sa-east-1.amazonaws.com",
            "s3-website.ap-northeast-2.amazonaws.com",
            "s3-website.ap-south-1.amazonaws.com",
            "s3-website.ca-central-1.amazonaws.com",
            "s3-website.eu-central-1.amazonaws.com",
            "s3-website.eu-west-2.amazonaws.com",
            "s3-website.eu-west-3.amazonaws.com",
            "s3-website.us-east-2.amazonaws.com",
            "t3l3p0rt.net",
            "tele.amune.org",
            "on-aptible.com",
            "user.party.eus",
            "pimienta.org",
            "poivron.org",
            "potager.org",
            "sweetpepper.org",
            "myasustor.com",
            "myfritz.net",
            "*.awdev.ca",
            "*.advisor.ws",
            "backplaneapp.io",
            "betainabox.com",
            "bnr.la",
            "blackbaudcdn.net",
            "boomla.net",
            "boxfuse.io",
            "square7.ch",
            "bplaced.com",
            "bplaced.de",
            "square7.de",
            "bplaced.net",
            "square7.net",
            "browsersafetymark.io",
            "mycd.eu",
            "ae.org",
            "ar.com",
            "br.com",
            "cn.com",
            "com.de",
            "com.se",
            "de.com",
            "eu.com",
            "gb.com",
            "gb.net",
            "hu.com",
            "hu.net",
            "jp.net",
            "jpn.com",
            "kr.com",
            "mex.com",
            "no.com",
            "qc.com",
            "ru.com",
            "sa.com",
            "se.net",
            "uk.com",
            "uk.net",
            "us.com",
            "uy.com",
            "za.bz",
            "za.com",
            "africa.com",
            "gr.com",
            "in.net",
            "us.org",
            "co.com",
            "c.la",
            "certmgr.org",
            "xenapponazure.com",
            "virtueeldomein.nl",
            "cleverapps.io",
            "c66.me",
            "cloud66.ws",
            "jdevcloud.com",
            "wpdevcloud.com",
            "cloudaccess.host",
            "freesite.host",
            "cloudaccess.net",
            "cloudcontrolled.com",
            "cloudcontrolapp.com",
            "co.ca",
            "*.otap.co",
            "co.cz",
            "c.cdn77.org",
            "cdn77-ssl.net",
            "r.cdn77.net",
            "rsc.cdn77.org",
            "ssl.origin.cdn77-secure.org",
            "cloudns.asia",
            "cloudns.biz",
            "cloudns.club",
            "cloudns.cc",
            "cloudns.eu",
            "cloudns.in",
            "cloudns.info",
            "cloudns.org",
            "cloudns.pro",
            "cloudns.pw",
            "cloudns.us",
            "cloudeity.net",
            "cnpy.gdn",
            "co.nl",
            "co.no",
            "webhosting.be",
            "hosting-cluster.nl",
            "dyn.cosidns.de",
            "dynamisches-dns.de",
            "dnsupdater.de",
            "internet-dns.de",
            "l-o-g-i-n.de",
            "dynamic-dns.info",
            "feste-ip.net",
            "knx-server.net",
            "static-access.net",
            "realm.cz",
            "*.cryptonomic.net",
            "cupcake.is",
            "cyon.link",
            "cyon.site",
            "daplie.me",
            "localhost.daplie.me",
            "dattolocal.com",
            "dattorelay.com",
            "dattoweb.com",
            "mydatto.com",
            "dattolocal.net",
            "mydatto.net",
            "biz.dk",
            "co.dk",
            "firm.dk",
            "reg.dk",
            "store.dk",
            "debian.net",
            "dedyn.io",
            "dnshome.de",
            "drayddns.com",
            "dreamhosters.com",
            "mydrobo.com",
            "drud.io",
            "drud.us",
            "duckdns.org",
            "dy.fi",
            "tunk.org",
            "dyndns-at-home.com",
            "dyndns-at-work.com",
            "dyndns-blog.com",
            "dyndns-free.com",
            "dyndns-home.com",
            "dyndns-ip.com",
            "dyndns-mail.com",
            "dyndns-office.com",
            "dyndns-pics.com",
            "dyndns-remote.com",
            "dyndns-server.com",
            "dyndns-web.com",
            "dyndns-wiki.com",
            "dyndns-work.com",
            "dyndns.biz",
            "dyndns.info",
            "dyndns.org",
            "dyndns.tv",
            "at-band-camp.net",
            "ath.cx",
            "barrel-of-knowledge.info",
            "barrell-of-knowledge.info",
            "better-than.tv",
            "blogdns.com",
            "blogdns.net",
            "blogdns.org",
            "blogsite.org",
            "boldlygoingnowhere.org",
            "broke-it.net",
            "buyshouses.net",
            "cechire.com",
            "dnsalias.com",
            "dnsalias.net",
            "dnsalias.org",
            "dnsdojo.com",
            "dnsdojo.net",
            "dnsdojo.org",
            "does-it.net",
            "doesntexist.com",
            "doesntexist.org",
            "dontexist.com",
            "dontexist.net",
            "dontexist.org",
            "doomdns.com",
            "doomdns.org",
            "dvrdns.org",
            "dyn-o-saur.com",
            "dynalias.com",
            "dynalias.net",
            "dynalias.org",
            "dynathome.net",
            "dyndns.ws",
            "endofinternet.net",
            "endofinternet.org",
            "endoftheinternet.org",
            "est-a-la-maison.com",
            "est-a-la-masion.com",
            "est-le-patron.com",
            "est-mon-blogueur.com",
            "for-better.biz",
            "for-more.biz",
            "for-our.info",
            "for-some.biz",
            "for-the.biz",
            "forgot.her.name",
            "forgot.his.name",
            "from-ak.com",
            "from-al.com",
            "from-ar.com",
            "from-az.net",
            "from-ca.com",
            "from-co.net",
            "from-ct.com",
            "from-dc.com",
            "from-de.com",
            "from-fl.com",
            "from-ga.com",
            "from-hi.com",
            "from-ia.com",
            "from-id.com",
            "from-il.com",
            "from-in.com",
            "from-ks.com",
            "from-ky.com",
            "from-la.net",
            "from-ma.com",
            "from-md.com",
            "from-me.org",
            "from-mi.com",
            "from-mn.com",
            "from-mo.com",
            "from-ms.com",
            "from-mt.com",
            "from-nc.com",
            "from-nd.com",
            "from-ne.com",
            "from-nh.com",
            "from-nj.com",
            "from-nm.com",
            "from-nv.com",
            "from-ny.net",
            "from-oh.com",
            "from-ok.com",
            "from-or.com",
            "from-pa.com",
            "from-pr.com",
            "from-ri.com",
            "from-sc.com",
            "from-sd.com",
            "from-tn.com",
            "from-tx.com",
            "from-ut.com",
            "from-va.com",
            "from-vt.com",
            "from-wa.com",
            "from-wi.com",
            "from-wv.com",
            "from-wy.com",
            "ftpaccess.cc",
            "fuettertdasnetz.de",
            "game-host.org",
            "game-server.cc",
            "getmyip.com",
            "gets-it.net",
            "go.dyndns.org",
            "gotdns.com",
            "gotdns.org",
            "groks-the.info",
            "groks-this.info",
            "ham-radio-op.net",
            "here-for-more.info",
            "hobby-site.com",
            "hobby-site.org",
            "home.dyndns.org",
            "homedns.org",
            "homeftp.net",
            "homeftp.org",
            "homeip.net",
            "homelinux.com",
            "homelinux.net",
            "homelinux.org",
            "homeunix.com",
            "homeunix.net",
            "homeunix.org",
            "iamallama.com",
            "in-the-band.net",
            "is-a-anarchist.com",
            "is-a-blogger.com",
            "is-a-bookkeeper.com",
            "is-a-bruinsfan.org",
            "is-a-bulls-fan.com",
            "is-a-candidate.org",
            "is-a-caterer.com",
            "is-a-celticsfan.org",
            "is-a-chef.com",
            "is-a-chef.net",
            "is-a-chef.org",
            "is-a-conservative.com",
            "is-a-cpa.com",
            "is-a-cubicle-slave.com",
            "is-a-democrat.com",
            "is-a-designer.com",
            "is-a-doctor.com",
            "is-a-financialadvisor.com",
            "is-a-geek.com",
            "is-a-geek.net",
            "is-a-geek.org",
            "is-a-green.com",
            "is-a-guru.com",
            "is-a-hard-worker.com",
            "is-a-hunter.com",
            "is-a-knight.org",
            "is-a-landscaper.com",
            "is-a-lawyer.com",
            "is-a-liberal.com",
            "is-a-libertarian.com",
            "is-a-linux-user.org",
            "is-a-llama.com",
            "is-a-musician.com",
            "is-a-nascarfan.com",
            "is-a-nurse.com",
            "is-a-painter.com",
            "is-a-patsfan.org",
            "is-a-personaltrainer.com",
            "is-a-photographer.com",
            "is-a-player.com",
            "is-a-republican.com",
            "is-a-rockstar.com",
            "is-a-socialist.com",
            "is-a-soxfan.org",
            "is-a-student.com",
            "is-a-teacher.com",
            "is-a-techie.com",
            "is-a-therapist.com",
            "is-an-accountant.com",
            "is-an-actor.com",
            "is-an-actress.com",
            "is-an-anarchist.com",
            "is-an-artist.com",
            "is-an-engineer.com",
            "is-an-entertainer.com",
            "is-by.us",
            "is-certified.com",
            "is-found.org",
            "is-gone.com",
            "is-into-anime.com",
            "is-into-cars.com",
            "is-into-cartoons.com",
            "is-into-games.com",
            "is-leet.com",
            "is-lost.org",
            "is-not-certified.com",
            "is-saved.org",
            "is-slick.com",
            "is-uberleet.com",
            "is-very-bad.org",
            "is-very-evil.org",
            "is-very-good.org",
            "is-very-nice.org",
            "is-very-sweet.org",
            "is-with-theband.com",
            "isa-geek.com",
            "isa-geek.net",
            "isa-geek.org",
            "isa-hockeynut.com",
            "issmarterthanyou.com",
            "isteingeek.de",
            "istmein.de",
            "kicks-ass.net",
            "kicks-ass.org",
            "knowsitall.info",
            "land-4-sale.us",
            "lebtimnetz.de",
            "leitungsen.de",
            "likes-pie.com",
            "likescandy.com",
            "merseine.nu",
            "mine.nu",
            "misconfused.org",
            "mypets.ws",
            "myphotos.cc",
            "neat-url.com",
            "office-on-the.net",
            "on-the-web.tv",
            "podzone.net",
            "podzone.org",
            "readmyblog.org",
            "saves-the-whales.com",
            "scrapper-site.net",
            "scrapping.cc",
            "selfip.biz",
            "selfip.com",
            "selfip.info",
            "selfip.net",
            "selfip.org",
            "sells-for-less.com",
            "sells-for-u.com",
            "sells-it.net",
            "sellsyourhome.org",
            "servebbs.com",
            "servebbs.net",
            "servebbs.org",
            "serveftp.net",
            "serveftp.org",
            "servegame.org",
            "shacknet.nu",
            "simple-url.com",
            "space-to-rent.com",
            "stuff-4-sale.org",
            "stuff-4-sale.us",
            "teaches-yoga.com",
            "thruhere.net",
            "traeumtgerade.de",
            "webhop.biz",
            "webhop.info",
            "webhop.net",
            "webhop.org",
            "worse-than.tv",
            "writesthisblog.com",
            "ddnss.de",
            "dyn.ddnss.de",
            "dyndns.ddnss.de",
            "dyndns1.de",
            "dyn-ip24.de",
            "home-webserver.de",
            "dyn.home-webserver.de",
            "myhome-server.de",
            "ddnss.org",
            "definima.net",
            "definima.io",
            "bci.dnstrace.pro",
            "ddnsfree.com",
            "ddnsgeek.com",
            "giize.com",
            "gleeze.com",
            "kozow.com",
            "loseyourip.com",
            "ooguy.com",
            "theworkpc.com",
            "casacam.net",
            "dynu.net",
            "accesscam.org",
            "camdvr.org",
            "freeddns.org",
            "mywire.org",
            "webredirect.org",
            "myddns.rocks",
            "blogsite.xyz",
            "dynv6.net",
            "e4.cz",
            "mytuleap.com",
            "enonic.io",
            "customer.enonic.io",
            "eu.org",
            "al.eu.org",
            "asso.eu.org",
            "at.eu.org",
            "au.eu.org",
            "be.eu.org",
            "bg.eu.org",
            "ca.eu.org",
            "cd.eu.org",
            "ch.eu.org",
            "cn.eu.org",
            "cy.eu.org",
            "cz.eu.org",
            "de.eu.org",
            "dk.eu.org",
            "edu.eu.org",
            "ee.eu.org",
            "es.eu.org",
            "fi.eu.org",
            "fr.eu.org",
            "gr.eu.org",
            "hr.eu.org",
            "hu.eu.org",
            "ie.eu.org",
            "il.eu.org",
            "in.eu.org",
            "int.eu.org",
            "is.eu.org",
            "it.eu.org",
            "jp.eu.org",
            "kr.eu.org",
            "lt.eu.org",
            "lu.eu.org",
            "lv.eu.org",
            "mc.eu.org",
            "me.eu.org",
            "mk.eu.org",
            "mt.eu.org",
            "my.eu.org",
            "net.eu.org",
            "ng.eu.org",
            "nl.eu.org",
            "no.eu.org",
            "nz.eu.org",
            "paris.eu.org",
            "pl.eu.org",
            "pt.eu.org",
            "q-a.eu.org",
            "ro.eu.org",
            "ru.eu.org",
            "se.eu.org",
            "si.eu.org",
            "sk.eu.org",
            "tr.eu.org",
            "uk.eu.org",
            "us.eu.org",
            "eu-1.evennode.com",
            "eu-2.evennode.com",
            "eu-3.evennode.com",
            "eu-4.evennode.com",
            "us-1.evennode.com",
            "us-2.evennode.com",
            "us-3.evennode.com",
            "us-4.evennode.com",
            "twmail.cc",
            "twmail.net",
            "twmail.org",
            "mymailer.com.tw",
            "url.tw",
            "apps.fbsbx.com",
            "ru.net",
            "adygeya.ru",
            "bashkiria.ru",
            "bir.ru",
            "cbg.ru",
            "com.ru",
            "dagestan.ru",
            "grozny.ru",
            "kalmykia.ru",
            "kustanai.ru",
            "marine.ru",
            "mordovia.ru",
            "msk.ru",
            "mytis.ru",
            "nalchik.ru",
            "nov.ru",
            "pyatigorsk.ru",
            "spb.ru",
            "vladikavkaz.ru",
            "vladimir.ru",
            "abkhazia.su",
            "adygeya.su",
            "aktyubinsk.su",
            "arkhangelsk.su",
            "armenia.su",
            "ashgabad.su",
            "azerbaijan.su",
            "balashov.su",
            "bashkiria.su",
            "bryansk.su",
            "bukhara.su",
            "chimkent.su",
            "dagestan.su",
            "east-kazakhstan.su",
            "exnet.su",
            "georgia.su",
            "grozny.su",
            "ivanovo.su",
            "jambyl.su",
            "kalmykia.su",
            "kaluga.su",
            "karacol.su",
            "karaganda.su",
            "karelia.su",
            "khakassia.su",
            "krasnodar.su",
            "kurgan.su",
            "kustanai.su",
            "lenug.su",
            "mangyshlak.su",
            "mordovia.su",
            "msk.su",
            "murmansk.su",
            "nalchik.su",
            "navoi.su",
            "north-kazakhstan.su",
            "nov.su",
            "obninsk.su",
            "penza.su",
            "pokrovsk.su",
            "sochi.su",
            "spb.su",
            "tashkent.su",
            "termez.su",
            "togliatti.su",
            "troitsk.su",
            "tselinograd.su",
            "tula.su",
            "tuva.su",
            "vladikavkaz.su",
            "vladimir.su",
            "vologda.su",
            "channelsdvr.net",
            "fastlylb.net",
            "map.fastlylb.net",
            "freetls.fastly.net",
            "map.fastly.net",
            "a.prod.fastly.net",
            "global.prod.fastly.net",
            "a.ssl.fastly.net",
            "b.ssl.fastly.net",
            "global.ssl.fastly.net",
            "fastpanel.direct",
            "fastvps-server.com",
            "fhapp.xyz",
            "fedorainfracloud.org",
            "fedorapeople.org",
            "cloud.fedoraproject.org",
            "app.os.fedoraproject.org",
            "app.os.stg.fedoraproject.org",
            "filegear.me",
            "firebaseapp.com",
            "flynnhub.com",
            "flynnhosting.net",
            "freebox-os.com",
            "freeboxos.com",
            "fbx-os.fr",
            "fbxos.fr",
            "freebox-os.fr",
            "freeboxos.fr",
            "freedesktop.org",
            "*.futurecms.at",
            "*.ex.futurecms.at",
            "*.in.futurecms.at",
            "futurehosting.at",
            "futuremailing.at",
            "*.ex.ortsinfo.at",
            "*.kunden.ortsinfo.at",
            "*.statics.cloud",
            "service.gov.uk",
            "github.io",
            "githubusercontent.com",
            "gitlab.io",
            "homeoffice.gov.uk",
            "ro.im",
            "shop.ro",
            "goip.de",
            "*.0emm.com",
            "appspot.com",
            "blogspot.ae",
            "blogspot.al",
            "blogspot.am",
            "blogspot.ba",
            "blogspot.be",
            "blogspot.bg",
            "blogspot.bj",
            "blogspot.ca",
            "blogspot.cf",
            "blogspot.ch",
            "blogspot.cl",
            "blogspot.co.at",
            "blogspot.co.id",
            "blogspot.co.il",
            "blogspot.co.ke",
            "blogspot.co.nz",
            "blogspot.co.uk",
            "blogspot.co.za",
            "blogspot.com",
            "blogspot.com.ar",
            "blogspot.com.au",
            "blogspot.com.br",
            "blogspot.com.by",
            "blogspot.com.co",
            "blogspot.com.cy",
            "blogspot.com.ee",
            "blogspot.com.eg",
            "blogspot.com.es",
            "blogspot.com.mt",
            "blogspot.com.ng",
            "blogspot.com.tr",
            "blogspot.com.uy",
            "blogspot.cv",
            "blogspot.cz",
            "blogspot.de",
            "blogspot.dk",
            "blogspot.fi",
            "blogspot.fr",
            "blogspot.gr",
            "blogspot.hk",
            "blogspot.hr",
            "blogspot.hu",
            "blogspot.ie",
            "blogspot.in",
            "blogspot.is",
            "blogspot.it",
            "blogspot.jp",
            "blogspot.kr",
            "blogspot.li",
            "blogspot.lt",
            "blogspot.lu",
            "blogspot.md",
            "blogspot.mk",
            "blogspot.mr",
            "blogspot.mx",
            "blogspot.my",
            "blogspot.nl",
            "blogspot.no",
            "blogspot.pe",
            "blogspot.pt",
            "blogspot.qa",
            "blogspot.re",
            "blogspot.ro",
            "blogspot.rs",
            "blogspot.ru",
            "blogspot.se",
            "blogspot.sg",
            "blogspot.si",
            "blogspot.sk",
            "blogspot.sn",
            "blogspot.td",
            "blogspot.tw",
            "blogspot.ug",
            "blogspot.vn",
            "google.ae",
            "google.al",
            "google.am",
            "google.ba",
            "google.be",
            "google.bg",
            "google.bj",
            "google.ca",
            "google.cf",
            "google.ch",
            "google.cl",
            "google.co.at",
            "google.co.id",
            "google.co.il",
            "google.co.ke",
            "google.co.nz",
            "google.co.uk",
            "google.co.za",
            "google.com",
            "google.com.ar",
            "google.com.au",
            "google.com.br",
            "google.com.by",
            "google.com.co",
            "google.com.cy",
            "google.com.ee",
            "google.com.eg",
            "google.com.es",
            "google.com.mt",
            "google.com.ng",
            "google.com.tr",
            "google.com.uy",
            "google.cv",
            "google.cz",
            "google.de",
            "google.dk",
            "google.fi",
            "google.fr",
            "google.gr",
            "google.hk",
            "google.hr",
            "google.hu",
            "google.ie",
            "google.in",
            "google.is",
            "google.it",
            "google.jp",
            "google.kr",
            "google.li",
            "google.lt",
            "google.lu",
            "google.md",
            "google.mk",
            "google.mr",
            "google.mx",
            "google.my",
            "google.nl",
            "google.no",
            "google.pe",
            "google.pt",
            "google.qa",
            "google.re",
            "google.ro",
            "google.rs",
            "google.ru",
            "google.se",
            "google.sg",
            "google.si",
            "google.sk",
            "google.sn",
            "google.td",
            "google.tw",
            "google.ug",
            "google.vn",
            "cloudfunctions.net",
            "cloud.goog",
            "codespot.com",
            "googleapis.com",
            "googlecode.com",
            "pagespeedmobilizer.com",
            "publishproxy.com",
            "withgoogle.com",
            "withyoutube.com",
            "hashbang.sh",
            "hasura.app",
            "hasura-app.io",
            "hepforge.org",
            "herokuapp.com",
            "herokussl.com",
            "myravendb.com",
            "ravendb.community",
            "ravendb.me",
            "development.run",
            "ravendb.run",
            "moonscale.net",
            "iki.fi",
            "biz.at",
            "info.at",
            "info.cx",
            "ac.leg.br",
            "al.leg.br",
            "am.leg.br",
            "ap.leg.br",
            "ba.leg.br",
            "ce.leg.br",
            "df.leg.br",
            "es.leg.br",
            "go.leg.br",
            "ma.leg.br",
            "mg.leg.br",
            "ms.leg.br",
            "mt.leg.br",
            "pa.leg.br",
            "pb.leg.br",
            "pe.leg.br",
            "pi.leg.br",
            "pr.leg.br",
            "rj.leg.br",
            "rn.leg.br",
            "ro.leg.br",
            "rr.leg.br",
            "rs.leg.br",
            "sc.leg.br",
            "se.leg.br",
            "sp.leg.br",
            "to.leg.br",
            "pixolino.com",
            "ipifony.net",
            "mein-iserv.de",
            "test-iserv.de",
            "myjino.ru",
            "*.hosting.myjino.ru",
            "*.landing.myjino.ru",
            "*.spectrum.myjino.ru",
            "*.vps.myjino.ru",
            "*.triton.zone",
            "*.cns.joyent.com",
            "js.org",
            "keymachine.de",
            "knightpoint.systems",
            "co.krd",
            "edu.krd",
            "git-repos.de",
            "lcube-server.de",
            "svn-repos.de",
            "app.lmpm.com",
            "linkitools.space",
            "linkyard.cloud",
            "linkyard-cloud.ch",
            "we.bs",
            "uklugs.org",
            "glug.org.uk",
            "lug.org.uk",
            "lugs.org.uk",
            "barsy.bg",
            "barsy.co.uk",
            "barsyonline.co.uk",
            "barsycenter.com",
            "barsyonline.com",
            "barsy.club",
            "barsy.de",
            "barsy.eu",
            "barsy.in",
            "barsy.info",
            "barsy.io",
            "barsy.me",
            "barsy.menu",
            "barsy.mobi",
            "barsy.net",
            "barsy.online",
            "barsy.org",
            "barsy.pro",
            "barsy.pub",
            "barsy.shop",
            "barsy.site",
            "barsy.support",
            "barsy.uk",
            "*.magentosite.cloud",
            "mayfirst.info",
            "mayfirst.org",
            "hb.cldmail.ru",
            "miniserver.com",
            "memset.net",
            "cloud.metacentrum.cz",
            "custom.metacentrum.cz",
            "flt.cloud.muni.cz",
            "usr.cloud.muni.cz",
            "meteorapp.com",
            "eu.meteorapp.com",
            "co.pl",
            "azurecontainer.io",
            "azurewebsites.net",
            "azure-mobile.net",
            "cloudapp.net",
            "mozilla-iot.org",
            "bmoattachments.org",
            "net.ru",
            "org.ru",
            "pp.ru",
            "bitballoon.com",
            "netlify.com",
            "4u.com",
            "ngrok.io",
            "nh-serv.co.uk",
            "nfshost.com",
            "dnsking.ch",
            "mypi.co",
            "n4t.co",
            "001www.com",
            "ddnslive.com",
            "myiphost.com",
            "forumz.info",
            "16-b.it",
            "32-b.it",
            "64-b.it",
            "soundcast.me",
            "tcp4.me",
            "dnsup.net",
            "hicam.net",
            "now-dns.net",
            "ownip.net",
            "vpndns.net",
            "dynserv.org",
            "now-dns.org",
            "x443.pw",
            "now-dns.top",
            "ntdll.top",
            "freeddns.us",
            "crafting.xyz",
            "zapto.xyz",
            "nsupdate.info",
            "nerdpol.ovh",
            "blogsyte.com",
            "brasilia.me",
            "cable-modem.org",
            "ciscofreak.com",
            "collegefan.org",
            "couchpotatofries.org",
            "damnserver.com",
            "ddns.me",
            "ditchyourip.com",
            "dnsfor.me",
            "dnsiskinky.com",
            "dvrcam.info",
            "dynns.com",
            "eating-organic.net",
            "fantasyleague.cc",
            "geekgalaxy.com",
            "golffan.us",
            "health-carereform.com",
            "homesecuritymac.com",
            "homesecuritypc.com",
            "hopto.me",
            "ilovecollege.info",
            "loginto.me",
            "mlbfan.org",
            "mmafan.biz",
            "myactivedirectory.com",
            "mydissent.net",
            "myeffect.net",
            "mymediapc.net",
            "mypsx.net",
            "mysecuritycamera.com",
            "mysecuritycamera.net",
            "mysecuritycamera.org",
            "net-freaks.com",
            "nflfan.org",
            "nhlfan.net",
            "no-ip.ca",
            "no-ip.co.uk",
            "no-ip.net",
            "noip.us",
            "onthewifi.com",
            "pgafan.net",
            "point2this.com",
            "pointto.us",
            "privatizehealthinsurance.net",
            "quicksytes.com",
            "read-books.org",
            "securitytactics.com",
            "serveexchange.com",
            "servehumour.com",
            "servep2p.com",
            "servesarcasm.com",
            "stufftoread.com",
            "ufcfan.org",
            "unusualperson.com",
            "workisboring.com",
            "3utilities.com",
            "bounceme.net",
            "ddns.net",
            "ddnsking.com",
            "gotdns.ch",
            "hopto.org",
            "myftp.biz",
            "myftp.org",
            "myvnc.com",
            "no-ip.biz",
            "no-ip.info",
            "no-ip.org",
            "noip.me",
            "redirectme.net",
            "servebeer.com",
            "serveblog.net",
            "servecounterstrike.com",
            "serveftp.com",
            "servegame.com",
            "servehalflife.com",
            "servehttp.com",
            "serveirc.com",
            "serveminecraft.net",
            "servemp3.com",
            "servepics.com",
            "servequake.com",
            "sytes.net",
            "webhop.me",
            "zapto.org",
            "stage.nodeart.io",
            "nodum.co",
            "nodum.io",
            "pcloud.host",
            "nyc.mn",
            "nom.ae",
            "nom.af",
            "nom.ai",
            "nom.al",
            "nym.by",
            "nym.bz",
            "nom.cl",
            "nom.gd",
            "nom.ge",
            "nom.gl",
            "nym.gr",
            "nom.gt",
            "nym.gy",
            "nom.hn",
            "nym.ie",
            "nom.im",
            "nom.ke",
            "nym.kz",
            "nym.la",
            "nym.lc",
            "nom.li",
            "nym.li",
            "nym.lt",
            "nym.lu",
            "nym.me",
            "nom.mk",
            "nym.mn",
            "nym.mx",
            "nom.nu",
            "nym.nz",
            "nym.pe",
            "nym.pt",
            "nom.pw",
            "nom.qa",
            "nym.ro",
            "nom.rs",
            "nom.si",
            "nym.sk",
            "nom.st",
            "nym.su",
            "nym.sx",
            "nom.tj",
            "nym.tw",
            "nom.ug",
            "nom.uy",
            "nom.vc",
            "nom.vg",
            "cya.gg",
            "cloudycluster.net",
            "nid.io",
            "opencraft.hosting",
            "operaunite.com",
            "outsystemscloud.com",
            "ownprovider.com",
            "own.pm",
            "ox.rs",
            "oy.lc",
            "pgfog.com",
            "pagefrontapp.com",
            "art.pl",
            "gliwice.pl",
            "krakow.pl",
            "poznan.pl",
            "wroc.pl",
            "zakopane.pl",
            "pantheonsite.io",
            "gotpantheon.com",
            "mypep.link",
            "on-web.fr",
            "*.platform.sh",
            "*.platformsh.site",
            "xen.prgmr.com",
            "priv.at",
            "protonet.io",
            "chirurgiens-dentistes-en-france.fr",
            "byen.site",
            "ras.ru",
            "qa2.com",
            "dev-myqnapcloud.com",
            "alpha-myqnapcloud.com",
            "myqnapcloud.com",
            "*.quipelements.com",
            "vapor.cloud",
            "vaporcloud.io",
            "rackmaze.com",
            "rackmaze.net",
            "rhcloud.com",
            "resindevice.io",
            "devices.resinstaging.io",
            "hzc.io",
            "wellbeingzone.eu",
            "ptplus.fit",
            "wellbeingzone.co.uk",
            "sandcats.io",
            "logoip.de",
            "logoip.com",
            "schokokeks.net",
            "scrysec.com",
            "firewall-gateway.com",
            "firewall-gateway.de",
            "my-gateway.de",
            "my-router.de",
            "spdns.de",
            "spdns.eu",
            "firewall-gateway.net",
            "my-firewall.org",
            "myfirewall.org",
            "spdns.org",
            "*.s5y.io",
            "*.sensiosite.cloud",
            "biz.ua",
            "co.ua",
            "pp.ua",
            "shiftedit.io",
            "myshopblocks.com",
            "1kapp.com",
            "appchizi.com",
            "applinzi.com",
            "sinaapp.com",
            "vipsinaapp.com",
            "bounty-full.com",
            "alpha.bounty-full.com",
            "beta.bounty-full.com",
            "static.land",
            "dev.static.land",
            "sites.static.land",
            "apps.lair.io",
            "*.stolos.io",
            "spacekit.io",
            "customer.speedpartner.de",
            "storj.farm",
            "utwente.io",
            "temp-dns.com",
            "diskstation.me",
            "dscloud.biz",
            "dscloud.me",
            "dscloud.mobi",
            "dsmynas.com",
            "dsmynas.net",
            "dsmynas.org",
            "familyds.com",
            "familyds.net",
            "familyds.org",
            "i234.me",
            "myds.me",
            "synology.me",
            "vpnplus.to",
            "taifun-dns.de",
            "gda.pl",
            "gdansk.pl",
            "gdynia.pl",
            "med.pl",
            "sopot.pl",
            "gwiddle.co.uk",
            "cust.dev.thingdust.io",
            "cust.disrec.thingdust.io",
            "cust.prod.thingdust.io",
            "cust.testing.thingdust.io",
            "bloxcms.com",
            "townnews-staging.com",
            "12hp.at",
            "2ix.at",
            "4lima.at",
            "lima-city.at",
            "12hp.ch",
            "2ix.ch",
            "4lima.ch",
            "lima-city.ch",
            "trafficplex.cloud",
            "de.cool",
            "12hp.de",
            "2ix.de",
            "4lima.de",
            "lima-city.de",
            "1337.pictures",
            "clan.rip",
            "lima-city.rocks",
            "webspace.rocks",
            "lima.zone",
            "*.transurl.be",
            "*.transurl.eu",
            "*.transurl.nl",
            "tuxfamily.org",
            "dd-dns.de",
            "diskstation.eu",
            "diskstation.org",
            "dray-dns.de",
            "draydns.de",
            "dyn-vpn.de",
            "dynvpn.de",
            "mein-vigor.de",
            "my-vigor.de",
            "my-wan.de",
            "syno-ds.de",
            "synology-diskstation.de",
            "synology-ds.de",
            "uber.space",
            "*.uberspace.de",
            "hk.com",
            "hk.org",
            "ltd.hk",
            "inc.hk",
            "virtualuser.de",
            "virtual-user.de",
            "lib.de.us",
            "2038.io",
            "router.management",
            "v-info.info",
            "wedeploy.io",
            "wedeploy.me",
            "wedeploy.sh",
            "remotewd.com",
            "wmflabs.org",
            "half.host",
            "xnbay.com",
            "u2.xnbay.com",
            "u2-local.xnbay.com",
            "cistron.nl",
            "demon.nl",
            "xs4all.space",
            "official.academy",
            "yolasite.com",
            "ybo.faith",
            "yombo.me",
            "homelink.one",
            "ybo.party",
            "ybo.review",
            "ybo.science",
            "ybo.trade",
            "nohost.me",
            "noho.st",
            "za.net",
            "za.org",
            "now.sh",
            "zone.id",
          ];
        },
        {},
      ],
      2: [
        function (a, o, r) {
          "use strict";
          var p = a("punycode"),
            k = {};
          (k.rules = a("./data/rules.json").map(function (a) {
            return {
              rule: a,
              suffix: a.replace(/^(\*\.|\!)/, ""),
              punySuffix: -1,
              wildcard: "*" === a.charAt(0),
              exception: "!" === a.charAt(0),
            };
          })),
            (k.endsWith = function (a, o) {
              return -1 !== a.indexOf(o, a.length - o.length);
            }),
            (k.findRule = function (a) {
              var i = p.toASCII(a);
              return k.rules.reduce(function (a, o) {
                return (
                  -1 === o.punySuffix && (o.punySuffix = p.toASCII(o.suffix)),
                  k.endsWith(i, "." + o.punySuffix) || i === o.punySuffix
                    ? o
                    : a
                );
              }, null);
            }),
            (r.errorCodes = {
              DOMAIN_TOO_SHORT: "Domain name too short.",
              DOMAIN_TOO_LONG:
                "Domain name too long. It should be no more than 255 chars.",
              LABEL_STARTS_WITH_DASH:
                "Domain name label can not start with a dash.",
              LABEL_ENDS_WITH_DASH:
                "Domain name label can not end with a dash.",
              LABEL_TOO_LONG:
                "Domain name label should be at most 63 chars long.",
              LABEL_TOO_SHORT:
                "Domain name label should be at least 1 character long.",
              LABEL_INVALID_CHARS:
                "Domain name label can only contain alphanumeric characters or dashes.",
            }),
            (k.validate = function (a) {
              var o = p.toASCII(a);
              if (o.length < 1) return "DOMAIN_TOO_SHORT";
              if (255 < o.length) return "DOMAIN_TOO_LONG";
              for (var i, e = o.split("."), n = 0; n < e.length; ++n) {
                if (!(i = e[n]).length) return "LABEL_TOO_SHORT";
                if (63 < i.length) return "LABEL_TOO_LONG";
                if ("-" === i.charAt(0)) return "LABEL_STARTS_WITH_DASH";
                if ("-" === i.charAt(i.length - 1))
                  return "LABEL_ENDS_WITH_DASH";
                if (!/^[a-z0-9\-]+$/.test(i)) return "LABEL_INVALID_CHARS";
              }
            }),
            (r.parse = function (a) {
              if ("string" != typeof a)
                throw new TypeError("Domain name must be a string.");
              var o = a.slice(0).toLowerCase();
              "." === o.charAt(o.length - 1) && (o = o.slice(0, o.length - 1));
              var i = k.validate(o);
              if (i)
                return {
                  input: a,
                  error: { message: r.errorCodes[i], code: i },
                };
              var e = {
                  input: a,
                  tld: null,
                  sld: null,
                  domain: null,
                  subdomain: null,
                  listed: !1,
                },
                n = o.split(".");
              if ("local" === n[n.length - 1]) return e;
              var s = function () {
                  return (
                    /xn--/.test(o) &&
                      (e.domain && (e.domain = p.toASCII(e.domain)),
                      e.subdomain && (e.subdomain = p.toASCII(e.subdomain))),
                    e
                  );
                },
                m = k.findRule(o);
              if (!m)
                return n.length < 2
                  ? e
                  : ((e.tld = n.pop()),
                    (e.sld = n.pop()),
                    (e.domain = [e.sld, e.tld].join(".")),
                    n.length && (e.subdomain = n.pop()),
                    s());
              e.listed = !0;
              var t = m.suffix.split("."),
                u = n.slice(0, n.length - t.length);
              return (
                m.exception && u.push(t.shift()),
                (e.tld = t.join(".")),
                u.length
                  ? (m.wildcard && (t.unshift(u.pop()), (e.tld = t.join("."))),
                    u.length &&
                      ((e.sld = u.pop()),
                      (e.domain = [e.sld, e.tld].join(".")),
                      u.length && (e.subdomain = u.join("."))),
                    s())
                  : s()
              );
            }),
            (r.get = function (a) {
              return (a && r.parse(a).domain) || null;
            }),
            (r.isValid = function (a) {
              var o = r.parse(a);
              return Boolean(o.domain && o.listed);
            });
        },
        { "./data/rules.json": 1, punycode: 3 },
      ],
      3: [
        function (a, T, D) {
          (function (S) {
            !(function (a) {
              var o = "object" == typeof D && D && !D.nodeType && D,
                i = "object" == typeof T && T && !T.nodeType && T,
                e = "object" == typeof S && S;
              (e.global !== e && e.window !== e && e.self !== e) || (a = e);
              var n,
                s,
                d = 2147483647,
                b = 36,
                y = 1,
                f = 26,
                m = 38,
                t = 700,
                v = 72,
                w = 128,
                z = "-",
                u = /^xn--/,
                r = /[^\x20-\x7E]/,
                p = /[\x2E\u3002\uFF0E\uFF61]/g,
                k = {
                  overflow: "Overflow: input needs wider integers to process",
                  "not-basic": "Illegal input >= 0x80 (not a basic code point)",
                  "invalid-input": "Invalid input",
                },
                c = b - y,
                x = Math.floor,
                q = String.fromCharCode;
              function A(a) {
                throw new RangeError(k[a]);
              }
              function g(a, o) {
                for (var i = a.length, e = []; i--; ) e[i] = o(a[i]);
                return e;
              }
              function l(a, o) {
                var i = a.split("@"),
                  e = "";
                return (
                  1 < i.length && ((e = i[0] + "@"), (a = i[1])),
                  e + g((a = a.replace(p, ".")).split("."), o).join(".")
                );
              }
              function O(a) {
                for (var o, i, e = [], n = 0, s = a.length; n < s; )
                  55296 <= (o = a.charCodeAt(n++)) && o <= 56319 && n < s
                    ? 56320 == (64512 & (i = a.charCodeAt(n++)))
                      ? e.push(((1023 & o) << 10) + (1023 & i) + 65536)
                      : (e.push(o), n--)
                    : e.push(o);
                return e;
              }
              function _(a) {
                return g(a, function (a) {
                  var o = "";
                  return (
                    65535 < a &&
                      ((o += q((((a -= 65536) >>> 10) & 1023) | 55296)),
                      (a = 56320 | (1023 & a))),
                    (o += q(a))
                  );
                }).join("");
              }
              function L(a, o) {
                return a + 22 + 75 * (a < 26) - ((0 != o) << 5);
              }
              function I(a, o, i) {
                var e = 0;
                for (
                  a = i ? x(a / t) : a >> 1, a += x(a / o);
                  (c * f) >> 1 < a;
                  e += b
                )
                  a = x(a / c);
                return x(e + ((c + 1) * a) / (a + m));
              }
              function h(a) {
                var o,
                  i,
                  e,
                  n,
                  s,
                  m,
                  t,
                  u,
                  r,
                  p,
                  k,
                  c = [],
                  g = a.length,
                  l = 0,
                  h = w,
                  j = v;
                for ((i = a.lastIndexOf(z)) < 0 && (i = 0), e = 0; e < i; ++e)
                  128 <= a.charCodeAt(e) && A("not-basic"),
                    c.push(a.charCodeAt(e));
                for (n = 0 < i ? i + 1 : 0; n < g; ) {
                  for (
                    s = l, m = 1, t = b;
                    g <= n && A("invalid-input"),
                      (k = a.charCodeAt(n++)),
                      (b <=
                        (u =
                          k - 48 < 10
                            ? k - 22
                            : k - 65 < 26
                            ? k - 65
                            : k - 97 < 26
                            ? k - 97
                            : b) ||
                        u > x((d - l) / m)) &&
                        A("overflow"),
                      (l += u * m),
                      !(u < (r = t <= j ? y : j + f <= t ? f : t - j));
                    t += b
                  )
                    m > x(d / (p = b - r)) && A("overflow"), (m *= p);
                  (j = I(l - s, (o = c.length + 1), 0 == s)),
                    x(l / o) > d - h && A("overflow"),
                    (h += x(l / o)),
                    (l %= o),
                    c.splice(l++, 0, h);
                }
                return _(c);
              }
              function j(a) {
                var o,
                  i,
                  e,
                  n,
                  s,
                  m,
                  t,
                  u,
                  r,
                  p,
                  k,
                  c,
                  g,
                  l,
                  h,
                  j = [];
                for (c = (a = O(a)).length, o = w, s = v, m = i = 0; m < c; ++m)
                  (k = a[m]) < 128 && j.push(q(k));
                for (e = n = j.length, n && j.push(z); e < c; ) {
                  for (t = d, m = 0; m < c; ++m)
                    o <= (k = a[m]) && k < t && (t = k);
                  for (
                    t - o > x((d - i) / (g = e + 1)) && A("overflow"),
                      i += (t - o) * g,
                      o = t,
                      m = 0;
                    m < c;
                    ++m
                  )
                    if (((k = a[m]) < o && ++i > d && A("overflow"), k == o)) {
                      for (
                        u = i, r = b;
                        !(u < (p = r <= s ? y : s + f <= r ? f : r - s));
                        r += b
                      )
                        (h = u - p),
                          (l = b - p),
                          j.push(q(L(p + (h % l), 0))),
                          (u = x(h / l));
                      j.push(q(L(u, 0))), (s = I(i, g, e == n)), (i = 0), ++e;
                    }
                  ++i, ++o;
                }
                return j.join("");
              }
              if (
                ((n = {
                  version: "1.4.1",
                  ucs2: { decode: O, encode: _ },
                  decode: h,
                  encode: j,
                  toASCII: function (a) {
                    return l(a, function (a) {
                      return r.test(a) ? "xn--" + j(a) : a;
                    });
                  },
                  toUnicode: function (a) {
                    return l(a, function (a) {
                      return u.test(a) ? h(a.slice(4).toLowerCase()) : a;
                    });
                  },
                }),
                o && i)
              )
                if (T.exports == o) i.exports = n;
                else for (s in n) n.hasOwnProperty(s) && (o[s] = n[s]);
              else a.punycode = n;
            })(this);
          }.call(
            this,
            "undefined" != typeof global
              ? global
              : "undefined" != typeof self
              ? self
              : "undefined" != typeof window
              ? window
              : {}
          ));
        },
        {},
      ],
    },
    {},
    [2]
  )(2);
});

function setup_grid() {
  var bookmarksGrid = document.getElementById("bookmarks-grid");

  var grid = new Gridifier(bookmarksGrid, {
    dragifier: false,
    sortDispersion: false,
    dragifierMode: "d",
    toggle: "visibility",
  });
  globalGrid = grid;

  if (
    typeof localStorage.storedItems != "undefined" &&
    typeof localStorage.useCustomTiles != "undefined" &&
    localStorage.useCustomTiles == "true"
  ) {
    var storedItems = JSON.parse(localStorage.storedItems);
    for (var i = 0; i < storedItems.length; i++) {
      add_favorite(storedItems[i]);
    }
  } else if (
    typeof localStorage.useCustomTiles == "undefined" ||
    localStorage.useCustomTiles == "false"
  ) {
    console.log(
      "Fetching tiles from Most Visited because storedItems is undefined"
    );
    try {
      fetch_tiles_from_most_visited();
    } catch (err) {
      console.log("Fetch tiles from most visited: " + err);
    }
    if (typeof localStorage.storedItems == "undefined")
      window.setTimeout(function () {
        if (typeof localStorage.storedItems == "undefined") {
          fetch_tiles_from_most_visited();
          globalGrid.appendNew();
          swap_if_ready();
          if (localStorage.triedToLoadMostVisited < 10) {
            document.location.reload();
          }
        }
      }, 10);
    if (typeof localStorage.storedItems == "undefined")
      window.setTimeout(function () {
        if (typeof localStorage.storedItems == "undefined") {
          fetch_tiles_from_most_visited();
          globalGrid.appendNew();
          swap_if_ready();
        }
      }, 100);
    if (typeof localStorage.storedItems == "undefined")
      window.setTimeout(function () {
        if (typeof localStorage.storedItems == "undefined") {
          fetch_tiles_from_most_visited();
          globalGrid.appendNew();
          swap_if_ready();
        }
      }, 500);
    if (typeof localStorage.storedItems == "undefined")
      window.setTimeout(function () {
        if (typeof localStorage.storedItems == "undefined") {
          fetch_tiles_from_most_visited();
          globalGrid.appendNew();
          swap_if_ready();
          if (localStorage.triedToLoadMostVisited < 10) {
            document.location.reload();
          }
        }
      }, 1000);
    if (typeof localStorage.storedItems == "undefined")
      window.setTimeout(function () {
        if (typeof localStorage.storedItems == "undefined") {
          fetch_tiles_from_most_visited();
          globalGrid.appendNew();
          swap_if_ready();
        }
      }, 2000);
    if (typeof localStorage.storedItems == "undefined")
      window.setTimeout(function () {
        if (typeof localStorage.storedItems == "undefined") {
          fetch_tiles_from_most_visited();
          globalGrid.appendNew();
          swap_if_ready();
        }
      }, 4000);
    if (typeof localStorage.storedItems == "undefined")
      window.setTimeout(function () {
        if (typeof localStorage.storedItems == "undefined") {
          fetch_tiles_from_most_visited();
          globalGrid.appendNew();
          swap_if_ready();
        }
      }, 8000);
  }
  grid.appendNew();
  swap_if_ready();
  window.setTimeout(function () {
    swap_if_ready();
  }, 10);
  window.setTimeout(function () {
    swap_if_ready();
  }, 100);
  window.setTimeout(function () {
    swap_if_ready();
  }, 200);
  window.setTimeout(function () {
    swap_if_ready();
  }, 400);
  window.setTimeout(function () {
    swap_if_ready();
  }, 800);
  window.setTimeout(function () {
    save_grid_snapshot();
  }, 900);

  grid.onShow(function (item) {
    swap_if_ready();
  });

  grid.onReposition(function (items) {
    save_grid_snapshot();
  });

  grid.onDragEnd(function (items) {
    console.log("On Drag End Started");
    localStorage.storedItems = JSON.stringify([]);
    Array.prototype.forEach.call(items, function (el) {
      if (!el.className.includes("grid-idea"));
      add_to_storage(el);
    });
    window.setTimeout(function () {
      save_grid_snapshot();
    }, 300);
    window.setTimeout(function () {
      save_grid_snapshot();
    }, 800);
    // localStorage stores only strings
    localStorage.useCustomTiles = "true";
    console.log("On Drag End Done");
  });

  grid.onDisconnect(function (item) {
    console.log("Received onDisconnect EVENT");
    console.log(item);
    console.log("Really removing item (onDisconnect)");
    var items = globalGrid.collectConnected();
    items.sort(function (a, b) {
      if (a === b) return 0;
      var rect_a = a.getBoundingClientRect();
      var rect_b = b.getBoundingClientRect();
      if (parseInt(rect_a.top) < parseInt(rect_b.top)) {
        return -1;
      }
      if (
        parseInt(rect_a.top) == parseInt(rect_b.top) &&
        parseInt(rect_a.left) < parseInt(rect_b.left)
      ) {
        return -1;
      }
      return 1;
    });

    console.log("After");
    console.log(items);
    localStorage.storedItems = JSON.stringify([]);
    Array.prototype.forEach.call(items, function (el) {
      add_to_storage(el);
    });
    window.setTimeout(function () {
      save_grid_snapshot();
    }, 500);
    localStorage.useCustomTiles = "true";
    console.log("Item removed");
  });

  if (
    !document.areIdeasFetched &&
    !window.chrome.embeddedSearch.newTabPage.isIncognito &&
    typeof localStorage.hideExplore == "undefined"
  ) {
    document.areIdeasFetched = true;
    document.getElementById("explore-section").style.display = "none";
    console.log("Fetching tiles ideas");
    fetch(
      "https://tiles.kiwibrowser.org/ideas/?version=2&cachebuster=" +
        Math.random(),
      { method: "GET" }
    )
      .then(function (response) {
        console.log("We received tiles ideas");
        return response.json();
      })
      .then(function (answer) {
        for (var i = 0; i < answer.length; i++) {
          add_favorite_idea(
            answer[i].name,
            answer[i].click_url,
            answer[i].impression_url,
            answer[i].image_url
          );
        }
        if (answer.length > 0)
          document.getElementById("explore-section").style.display = "block";
        grid.appendNew();
        swap_if_ready();
        window.setTimeout(function () {
          swap_if_ready();
        }, 10);
        window.setTimeout(function () {
          swap_if_ready();
        }, 100);
        window.setTimeout(function () {
          swap_if_ready();
        }, 200);
        window.setTimeout(function () {
          swap_if_ready();
        }, 400);
        window.setTimeout(function () {
          swap_if_ready();
        }, 800);
        window.setTimeout(function () {
          save_grid_snapshot();
        }, 900);
      });
  }
}

try {
  window.setTimeout(function () {
    setup_grid();
  }, 2);
} catch (err) {
  console.log("Delayed init failed, retrying later");
  window.setTimeout(function () {
    setup_grid();
  }, 100);
}

if (document.readyState != "loading") {
  window.document.dispatchEvent(
    new Event("DOMContentLoaded", { bubbles: true, cancelable: true })
  );
}
