/**
 * Apotheca AR Makeup Try-On
 * MediaPipe Face Mesh implementation (replaces Jeeliz)
 */

(function ($) {
  'use strict';

  // MediaPipe instances (kept between modal opens)
  let faceMesh = null;
  let camera = null;
  let isRunning = false;

  // DOM refs (set on open)
  let $modal = null;
  let videoEl = null;
  let canvasEl = null;
  let ctx2d = null;

  // NOTE: No default overlays should be applied. Colours are only rendered
  // when the user selects a swatch (data-face-region) in the modal.

  /**
   * Basic polygon index sets (MediaPipe FaceMesh indices).
   * These are intentionally simple and can be refined later.
   */
  const REGION_POLYGONS = {
    // Lips
    lips_outer: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409,
                 291, 375, 321, 405, 314, 17, 84, 181, 91, 146],
    lips_inner: [78, 191, 80, 81, 82, 13, 312, 311, 310, 415,
                 308, 324, 318, 402, 317, 14, 87, 178, 88, 95],

    // Brows (approx outlines)
    left_brow: [70, 63, 105, 66, 107, 55, 65, 52, 53, 46],
    right_brow: [336, 296, 334, 293, 300, 276, 283, 282, 295, 285],

    // Eyeshadow reference landmarks (polygon-based rendering).
    // outer/inner:   eye corner landmarks — define the horizontal span.
    // lidPeak:       topmost point of the upper eyelid arc.
    // lowerLid:      lowest point of the lower eyelid arc (eye-opening cutout).
    // browRef:       stable landmark on the lower brow edge (gradient height ref).
    // upperLidArc:   ordered landmark indices tracing the upper eyelid from the
    //                outer corner to the inner corner (corners excluded; added
    //                separately as outer/inner above).  Used as the BOTTOM edge
    //                of the shadow polygon so it follows the real lid contour.
    // browPoly:      ordered landmark indices forming the eyebrow polygon used
    //                for the brow destination-out cutout.  Traced outer→inner
    //                along the lower brow edge, then inner→outer along the upper
    //                brow edge (MediaPipe FaceMesh connectivity).
    left_eyeshadow: {
      outer: 33, inner: 133, lidPeak: 159, lowerLid: 145, browRef: 66,
      upperLidArc: [246, 161, 160, 159, 158, 157, 173],
      browPoly:    [70, 63, 105, 66, 107, 55, 65, 52, 53, 46],
    },
    right_eyeshadow: {
      outer: 263, inner: 362, lidPeak: 386, lowerLid: 374, browRef: 295,
      upperLidArc: [466, 388, 387, 386, 385, 384, 398],
      browPoly:    [300, 293, 334, 296, 336, 285, 295, 282, 283, 276],
    },

    // Concealer reference landmarks (under-eye / eye-bag coverage).
    // Mirrors eyeshadow geometry but positioned below the lower lid.
    // outer/inner:   eye corner landmarks — define the horizontal span.
    // lidPeak:       topmost upper-lid point — used only for the eye-opening cutout.
    // lowerLid:      lowest point of the lower eyelid — top edge of the concealer.
    // cheekRef:      infraorbital-rim landmark directly below the eye centre;
    //                defines how far DOWN the concealer ellipse extends.
    left_concealer: {
      outer: 33, inner: 133, lidPeak: 159, lowerLid: 145, cheekRef: 119,
    },
    right_concealer: {
      outer: 263, inner: 362, lidPeak: 386, lowerLid: 374, cheekRef: 348,
    },

    // Foundation (full face oval, chin to hairline)
    face_oval: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
                397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
                172,  58, 132,  93, 234, 127, 162,  21,  54, 103,  67, 109],

    // Blush — upper cheek (apple) anchor points used to position the gradient.
    // "left"  = left side of the image frame (user's right cheek in selfie mode).
    // "right" = right side of the image frame (user's left cheek in selfie mode).
    left_cheek_anchors:  [116, 117, 118, 123, 101],
    right_cheek_anchors: [345, 346, 347, 352, 330]
  };

  /**
   * MediaPipe landmark indices for each eye used when positioning SVG overlays.
   *
   * "left"  = left side of the image frame (user's right eye in selfie mode).
   * "right" = right side of the image frame (user's left eye in selfie mode).
   *
   * outer: lateral canthus (outer corner of the eye)
   * inner: medial canthus (inner corner, near the nose)
   * peak:  topmost point of the upper eyelid arc
   */
  const EYE_LANDMARKS = {
    left: {
      outer: 33,
      inner: 133,
      peak: 159,
      // Full upper-eyelid arc (outer → inner) — used for broad measurements.
      upperLid: [33, 246, 161, 160, 159, 158, 157, 173, 133],
      // Middle points ONLY (no corners) — these move most during blinks.
      // Using only these gives ~3× more blink displacement than averaging the
      // full arc which includes the near-static corner landmarks.
      midUpperLid: [246, 161, 160, 159, 158, 157, 173]
    },
    right: {
      outer: 263,
      inner: 362,
      peak: 386,
      upperLid: [263, 466, 388, 387, 386, 385, 384, 398, 362],
      midUpperLid: [466, 388, 387, 386, 385, 384, 398]
    }
  };

  /**
   * Per-region SVG overlay configuration.
   *
   * widthScale   – multiply measured eye width by this factor.  Values > 1
   *               let the SVG extend beyond the corner landmarks.  The
   *               extension is split: outerExtend fraction goes toward the
   *               temple (outer corner, where cat-eye lashes/liner go), the
   *               rest is symmetric.
   *
   * anchorBlend  – 0 = SVG bottom sits at the eye-corner baseline (local-Y 0),
   *               1 = SVG bottom sits at the upper-lid PEAK (most negative
   *               local-Y, highest on screen).  Negative values push the SVG
   *               bottom BELOW the baseline (positive local-Y = lower on screen)
   *               so the SVG extends upward into the eye area — needed for liner.
   *
   * outerExtend  – fraction of eye width added exclusively on the OUTER side
   *               (temple side) beyond the widthScale extension, so the flick /
   *               outer lashes protrude past the eye corner naturally.
   */
  const SVG_OVERLAY_CFG = {
    eyelash: {
      widthScale:  1.25,   // 25% wider than outer→inner distance
      anchorBlend: 0.2,    // SVG bottom just above baseline ≈ lash line
      outerExtend: 0.04    // small outer extension; too much causes outer lashes to droop
    },
    eyeliner: {
      widthScale:  1.35,   // wider — liner + cat-eye flick needs more room
      anchorBlend: -1.0,   // SVG bottom below baseline → liner rises into the eye area
      outerExtend: 0.20    // 20% extra on outer side for the liner flick
    }
  };

  // ---------------------------------------------------------------------------
  // SVG overlay caches
  // ---------------------------------------------------------------------------

  /**
   * Raw SVG text cache keyed by URL.
   * null = fetch in flight / failed; string = ready.
   */
  const svgTextCache = {};

  /**
   * Colourised SVG Image elements, keyed by "<region>_<side>|<colour>".
   * e.g. "eyelash_left|#cc0033"
   */
  const svgImageCache = {};

  // ---------------------------------------------------------------------------

  const ApothecaAR = {
    // Per-region selections (face regions from PHP attribute mapping)
    selectedRegions: {},

    // Keep old structure (per-attribute selections) for backwards compatibility/logging
    selectedColors: {},

    // Visual zoom (1.0 = default). Implemented as a safe canvas crop/scale.
    // Where supported, we also try native track zoom via applyConstraints.
    zoomLevel: 1,

    // Cached draw transform for mapping landmarks when drawing in "cover" mode.
    // { srcW, srcH, scale, dx, dy }
    renderTransform: null,

    // window resize handler reference so we can remove it on close
    _resizeHandler: null,

    init: function () {
      this.setupEventListeners();

      // If swatch colors available, listen for variation changes (legacy Woo swatch detection)
      if (typeof apothecaAR !== 'undefined' && apothecaAR.swatchColorsAvailable) {
        this.setupVariationListener();
      }
    },

    setupVariationListener: function () {
      const self = this;

      $('.variations_form').on('found_variation', function () {
        self.detectSwatchColor();
      });

      $('.variations_form').on('reset_data', function () {
        self.selectedColors = {};
        self.selectedRegions = {};
      });
    },

    detectSwatchColor: function () {
      const selectedSwatch = $('.fif-vse-swatch.fif-vse-selected');
      if (selectedSwatch.length > 0) {
        let swatchColor = selectedSwatch.css('background-color');
        if (swatchColor) {
          swatchColor = this.rgbToHex(swatchColor);
          this.selectedColors['_woo_swatch'] = swatchColor;
          // Do NOT auto-apply any region. Rendering happens only via modal swatch clicks.
        }
      }
    },

    rgbToHex: function (rgb) {
      if (!rgb) return '';
      if (rgb.charAt(0) === '#') return rgb;

      const res = rgb.match(/\d+/g);
      if (!res || res.length < 3) return rgb;

      const r = parseInt(res[0], 10);
      const g = parseInt(res[1], 10);
      const b = parseInt(res[2], 10);

      return (
        '#' +
        ((1 << 24) + (r << 16) + (g << 8) + b)
          .toString(16)
          .slice(1)
          .toUpperCase()
      );
    },

    setupEventListeners: function () {
      // Open modal
      $(document).on('click', '.apotheca-ar-trigger, .apotheca-ar-open', function (e) {
        e.preventDefault();
        ApothecaAR.openARModal();
      });

      // Close modal
      $(document).on('click', '.apotheca-ar-close', function () {
        ApothecaAR.closeARModal();
      });

      // Close on overlay click
      $(document).on('click', '#apotheca-ar-modal', function (e) {
        if ($(e.target).is('#apotheca-ar-modal')) {
          ApothecaAR.closeARModal();
        }
      });

      // Close on Escape
      $(document).on('keydown', function (e) {
        if (e.key === 'Escape' && $('#apotheca-ar-modal').is(':visible')) {
          ApothecaAR.closeARModal();
        }
      });

      // Retry camera (shown when permission prompt is blocked or stalls)
      $(document).on('click', '.apotheca-ar-retry', function () {
        // restart pipeline
        ApothecaAR.stopMediaPipe();
        ApothecaAR.startMediaPipe();
      });

      // Zoom slider
      $(document).on('input change', '#apotheca-ar-zoom', function () {
        const v = parseFloat($(this).val() || '1') || 1;
        ApothecaAR.setZoom(v);
      });

      // Swatch click handler (now region-based)
      $(document).on('click', '.apotheca-swatch-btn', function () {
        const color = $(this).data('color');
        const name = $(this).data('name');
        const attribute = $(this).data('attribute') || '';
        const region =
          $(this).data('face-region') ||
          $(this).closest('.apotheca-variation-swatches').data('face-region') ||
          'none';

        const $group = $(this).closest('.apotheca-variation-swatches');

        // UI state within this attribute group
        $group.find('.apotheca-swatch-btn').removeClass('active');
        $(this).addClass('active');
        $group.find('.apotheca-swatch-active-name').text(name);

        // Store per-attribute selection (legacy)
        if (attribute) {
          ApothecaAR.selectedColors[attribute] = color;
        } else {
          ApothecaAR.selectedColors['_default'] = color;
        }

        // Store per-region selection (new)
        if (region && region !== 'none') {
          ApothecaAR.selectedRegions[region] = color;
        }

        // Backwards-compatible call (no longer lipstick-only)
        ApothecaAR.updateMakeup(region, color);

        // Debug
        // console.log('Applied:', { name, color, attribute, region, selectedRegions: ApothecaAR.selectedRegions });
      });

      // Swatch hover - show name in group label
      $(document).on('mouseenter', '.apotheca-swatch-btn', function () {
        const name = $(this).data('name');
        const $group = $(this).closest('.apotheca-variation-swatches');
        $group.find('.apotheca-swatch-active-name').text(name);
      });

      $(document).on('mouseleave', '.apotheca-swatch-btn', function () {
        const $group = $(this).closest('.apotheca-variation-swatches');
        const $active = $group.find('.apotheca-swatch-btn.active');
        const activeName = $active.length ? $active.data('name') : '';
        $group.find('.apotheca-swatch-active-name').text(activeName);
      });

      // Zoom slider
      $(document).on('input change', '#apotheca-ar-zoom', function () {
        const v = parseFloat($(this).val() || '1');
        ApothecaAR.setZoom(v);
      });
    },

    openARModal: function () {
      $modal = $('#apotheca-ar-modal');
      $modal.fadeIn(300);
      $('body').addClass('apotheca-ar-active');

      // Always start with a clean slate when opening the modal so no "default"
      // overlays appear unless the user actively selects swatches.
      this.selectedRegions = {};

      // Reset zoom UI/state each time the modal is opened
      this.setZoom(1, true);

      // Set DOM refs
      videoEl = document.getElementById('apotheca-ar-video');
      canvasEl = document.getElementById('apotheca-ar-canvas');

      if (!videoEl || !canvasEl) {
        $('#apotheca-ar-loading').html(
          '<div style="text-align:center;padding:20px;">' +
            '<p style="color:#ff6b6b;font-size:16px;margin-bottom:10px;">AR elements missing.</p>' +
            '<p style="font-size:12px;">Expected #apotheca-ar-video and #apotheca-ar-canvas in the modal template.</p>' +
            '</div>'
        );
        return;
      }

      ctx2d = canvasEl.getContext('2d');

      // Pre-fetch SVG files so they are ready when the user selects a swatch
      this._prefetchSvgOverlays();

      // Start MediaPipe
      this.startMediaPipe();
    },

    /**
     * Set zoom level (canvas crop/scale). Also tries native camera zoom if supported.
     */
    setZoom: function (value, silentUI) {
      const v = Math.max(1, Math.min(2.5, value || 1));
      this.zoomLevel = v;

      // Update UI
      if (!silentUI) {
        const pct = Math.round(v * 100);
        $('#apotheca-ar-zoom-value').text(pct + '%');
      } else {
        $('#apotheca-ar-zoom').val(v);
        $('#apotheca-ar-zoom-value').text('100%');
      }

      // Try native track zoom if available (mobile devices often support it)
      try {
        if (videoEl && videoEl.srcObject && videoEl.srcObject.getVideoTracks) {
          const track = videoEl.srcObject.getVideoTracks()[0];
          if (track && track.getCapabilities) {
            const caps = track.getCapabilities();
            if (caps && typeof caps.zoom !== 'undefined') {
              const zMin = caps.zoom.min || 1;
              const zMax = caps.zoom.max || 1;
              const z = Math.max(zMin, Math.min(zMax, v));
              if (track.applyConstraints) {
                track.applyConstraints({ advanced: [{ zoom: z }] }).catch(() => {});
              }
            }
          }
        }
      } catch (e) {
        // ignore
      }
    },

    closeARModal: function () {
      $('#apotheca-ar-modal').fadeOut(300);
      $('body').removeClass('apotheca-ar-active');

      this.stopMediaPipe();
    },

    /**
     * Start FaceMesh + camera stream (initialise once, start/stop per modal open/close)
     */
    startMediaPipe: function () {
      const self = this;

      // Show loading UI
      $('#apotheca-ar-loading').show();

      // Camera permissions require HTTPS (secure context). If the site is loaded
      // over HTTP, most browsers will silently block getUserMedia without a prompt.
      if (typeof window.isSecureContext !== 'undefined' && !window.isSecureContext) {
        $('#apotheca-ar-loading').html(
          '<div style="text-align:center;padding:20px;">' +
            '<p style="color:#ff6b6b;font-size:16px;margin-bottom:10px;">Camera requires HTTPS.</p>' +
            '<p style="font-size:12px;">This page is not a secure context, so the browser will not show the camera permission prompt. Please use https:// (or localhost) and try again.</p>' +
          '</div>'
        );
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        $('#apotheca-ar-loading').html(
          '<div style="text-align:center;padding:20px;">' +
            '<p style="color:#ff6b6b;font-size:16px;margin-bottom:10px;">Camera not available.</p>' +
            '<p style="font-size:12px;">Your browser does not support camera access (getUserMedia).</p>' +
          '</div>'
        );
        return;
      }

      // Ensure CDN scripts are available
      if (typeof FaceMesh === 'undefined' || typeof Camera === 'undefined') {
        $('#apotheca-ar-loading').html(
          '<div style="text-align:center;padding:20px;">' +
            '<p style="color:#ff6b6b;font-size:16px;margin-bottom:10px;">MediaPipe failed to load.</p>' +
            '<p style="font-size:12px;">Please check your internet connection or script blockers.</p>' +
            '</div>'
        );
        return;
      }

      // Create FaceMesh once
      if (!faceMesh) {
        faceMesh = new FaceMesh({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });

        faceMesh.setOptions({
          refineLandmarks: true,
          maxNumFaces: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        faceMesh.onResults(function (results) {
          self.onResults(results);
        });
      }

      // Start Camera once per open
      try {
        // Use higher ideal constraints to avoid blur on large canvases.
        // MediaPipe CameraUtils will downscale internally if needed.
        const idealW = 1280;
        const idealH = 720;

        camera = new Camera(videoEl, {
          onFrame: async () => {
            if (!isRunning) return;
            await faceMesh.send({ image: videoEl });
          },
          width: idealW,
          height: idealH
        });

        isRunning = true;

        // IMPORTANT: start() must run from a user gesture (modal open click)
        // otherwise some browsers suppress the permission prompt.
        const startPromise = camera.start();

        // Size canvas after metadata is available; also handle the case where
        // metadata is already available.
        const sizeCanvasToWrapper = () => {
          const $wrap = $modal ? $modal.find('.apotheca-ar-video-wrapper') : null;
          const wrapEl = $wrap && $wrap.length ? $wrap.get(0) : null;
          const wrapW = wrapEl ? wrapEl.clientWidth : (videoEl.videoWidth || idealW);
          const wrapH = wrapEl ? wrapEl.clientHeight : (videoEl.videoHeight || idealH);

          // Fill the entire wrapper. We will draw the camera image using a
          // "cover" strategy (crop) so it stays proportional without letterboxing.
          const cssW = wrapW;
          const cssH = wrapH;

          const dpr = window.devicePixelRatio || 1;

          // Set CSS size (for layout) and internal buffer size (for crispness)
          canvasEl.style.width = cssW + 'px';
          canvasEl.style.height = cssH + 'px';
          canvasEl.width = Math.round(cssW * dpr);
          canvasEl.height = Math.round(cssH * dpr);

          if (ctx2d) {
            ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx2d.imageSmoothingEnabled = true;
          }

          $('#apotheca-ar-loading').fadeOut(200);
        };

        // Keep canvas sizing responsive
        try {
          if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler);
          }
        } catch (e) {}
        this._resizeHandler = sizeCanvasToWrapper;
        window.addEventListener('resize', this._resizeHandler);

        // Prefer loadedmetadata, but also try loadeddata and a small timeout.
        videoEl.onloadedmetadata = sizeCanvasToWrapper;
        videoEl.onloadeddata = sizeCanvasToWrapper;

        // Fallback: if the browser doesn't show a permission prompt (or the user
        // previously blocked it), CameraUtils may stall and the loading overlay
        // will remain. After a short delay, surface a helpful message + retry.
        setTimeout(() => {
          if (!$('#apotheca-ar-loading').is(':visible')) return;

          const hasStream = !!(videoEl && videoEl.srcObject);
          const hasMeta = !!(videoEl && videoEl.videoWidth && videoEl.videoHeight);

          if (!hasStream && !hasMeta) {
            $('#apotheca-ar-loading').html(
              '<div style="text-align:center;padding:20px;">' +
                '<p style="color:#ff6b6b;font-size:16px;margin-bottom:10px;">Camera access needed.</p>' +
                '<p style="font-size:12px;line-height:1.4;margin-bottom:14px;">If you are not seeing a browser permission popup, your camera permission may be blocked for this site. Please check the camera icon in your browser address bar (or Site Settings) and allow camera access.</p>' +
                '<button type="button" class="apotheca-ar-retry" style="padding:10px 14px;border-radius:10px;border:1px solid #444;background:#111;color:#fff;cursor:pointer;">Retry</button>' +
              '</div>'
            );
          }
        }, 1500);

        // If start returns a promise, catch permission errors and show message.
        if (startPromise && typeof startPromise.then === 'function') {
          startPromise
            .then(() => {
              // If metadata event didn't fire (rare), size after a short delay
              setTimeout(() => {
                if ($('#apotheca-ar-loading').is(':visible')) {
                  sizeCanvasToWrapper();
                }
              }, 300);
            })
            .catch((err) => {
              console.error(err);
              const msg = (err && err.name === 'NotAllowedError')
                ? 'Camera permission was blocked. Please allow camera access in your browser settings and reload.'
                : 'Camera failed to start. Please allow camera access and reload.';

              $('#apotheca-ar-loading').html(
                '<div style="text-align:center;padding:20px;">' +
                  '<p style="color:#ff6b6b;font-size:16px;margin-bottom:10px;">Camera access required.</p>' +
                  '<p style="font-size:12px;">' + msg + '</p>' +
                '</div>'
              );
            });
        }
      } catch (e) {
        console.error(e);
        $('#apotheca-ar-loading').html(
          '<div style="text-align:center;padding:20px;">' +
            '<p style="color:#ff6b6b;font-size:16px;margin-bottom:10px;">Camera failed to start.</p>' +
            '<p style="font-size:12px;">Please allow camera access and reload.</p>' +
            '</div>'
        );
      }
    },

    /**
     * Stop camera + release resources on modal close
     */
    stopMediaPipe: function () {
      isRunning = false;

      // Remove resize listener
      try {
        if (this._resizeHandler) {
          window.removeEventListener('resize', this._resizeHandler);
          this._resizeHandler = null;
        }
      } catch (e) {
        // ignore
      }

      try {
        if (camera && typeof camera.stop === 'function') {
          camera.stop();
        }
      } catch (e) {
        // ignore
      }

      // Also stop raw media stream tracks (extra safety)
      try {
        if (videoEl && videoEl.srcObject && videoEl.srcObject.getTracks) {
          videoEl.srcObject.getTracks().forEach((t) => t.stop());
          videoEl.srcObject = null;
        }
      } catch (e) {
        // ignore
      }

      camera = null;

      // Clear canvas
      try {
        if (ctx2d && canvasEl) {
          ctx2d.clearRect(0, 0, canvasEl.width, canvasEl.height);
        }
      } catch (e) {
        // ignore
      }
    },

    /**
     * Draw loop callback from FaceMesh results
     */
    onResults: function (results) {
      if (!ctx2d || !canvasEl) return;

      // Because we set a DPR transform, draw in CSS pixel coordinates.
      const w = parseInt(canvasEl.style.width, 10) || canvasEl.width;
      const h = parseInt(canvasEl.style.height, 10) || canvasEl.height;

      // Draw camera frame using a "cover" strategy so it fills the canvas
      // without distorting the aspect ratio (cropping instead of letterboxing).
      ctx2d.save();
      ctx2d.clearRect(0, 0, w, h);

      this.renderTransform = null;

      if (results && results.image) {
        const img = results.image;
        const srcW = img.videoWidth || img.width || 0;
        const srcH = img.videoHeight || img.height || 0;

        if (srcW && srcH) {
          const baseScale = Math.max(w / srcW, h / srcH);
          const scale = baseScale * (this.zoomLevel || 1);

          const dw = srcW * scale;
          const dh = srcH * scale;
          const dx = (w - dw) / 2;
          const dy = (h - dh) / 2;

          // Cache the transform so landmark mapping matches the cropped draw
          this.renderTransform = { srcW, srcH, scale, dx, dy, w, h };

          ctx2d.drawImage(img, dx, dy, dw, dh);
        } else {
          // Fallback
          ctx2d.drawImage(img, 0, 0, w, h);
          this.renderTransform = { srcW: w, srcH: h, scale: 1, dx: 0, dy: 0, w, h };
        }
      }

      ctx2d.restore();

      const landmarks = results && results.multiFaceLandmarks && results.multiFaceLandmarks[0];
      if (!landmarks) return;

      // Apply overlays based on selected regions
      this.drawOverlays(ctx2d, landmarks, this.renderTransform || { srcW: w, srcH: h, scale: 1, dx: 0, dy: 0, w, h });
    },

    drawOverlays: function (ctx, landmarks, t) {
      // Foundation (base tint under all other regions)
      if (this.selectedRegions.foundation) {
        this.drawFoundation(ctx, landmarks, this.selectedRegions.foundation, t, this._getRegionStyle('foundation'));
      }

      // Concealer (under-eye coverage — above foundation, below blush/eyeshadow)
      const concealerSel = this.selectedRegions.concealer;
      if (concealerSel) {
        this.drawConcealer(ctx, landmarks, concealerSel, t, this._getRegionStyle('concealer'));
      }

      // Blush (upper cheeks — rendered above foundation, below eye makeup)
      if (this.selectedRegions.blush) {
        this.drawBlush(ctx, landmarks, this.selectedRegions.blush, t, this._getRegionStyle('blush'));
      }

      // Eyebrows — support both 'eyebrows' (current enum) and legacy 'brows'.
      // Feather, opacity and blend mode are applied here via a wrapping ctx save
      // so drawRegionPolygon inherits the correct composite state.
      const browSel = this.selectedRegions.eyebrows || this.selectedRegions.brows || this.selectedRegions.left_brow || this.selectedRegions.right_brow;
      if (browSel) {
        const left  = this.selectedRegions.left_brow  || this.selectedRegions.eyebrows || this.selectedRegions.brows || browSel;
        const right = this.selectedRegions.right_brow || this.selectedRegions.eyebrows || this.selectedRegions.brows || browSel;
        const bStyle     = this._getRegionStyle('eyebrows');
        const bAlpha     = (bStyle.opacity !== undefined) ? bStyle.opacity : 0.45;
        const bBlend     = bStyle.blendMode || 'source-over';
        const bFeatherPx = bStyle.feather ? (bStyle.feather / 100 * 12) : 0;
        ctx.save();
        ctx.globalCompositeOperation = bBlend;
        if (bFeatherPx > 0) ctx.filter = 'blur(' + bFeatherPx.toFixed(1) + 'px)';
        this.drawRegionPolygon(ctx, landmarks, REGION_POLYGONS.left_brow,  left,  bAlpha, t);
        this.drawRegionPolygon(ctx, landmarks, REGION_POLYGONS.right_brow, right, bAlpha, t);
        ctx.restore();
      }

      // Eyeshadow (feathered ellipse above upper eyelid — drawn before liner/lash)
      const shadowSel = this.selectedRegions.eyeshadow || this.selectedRegions.left_eyeshadow || this.selectedRegions.right_eyeshadow;
      if (shadowSel) {
        this.drawEyeshadow(ctx, landmarks, shadowSel, t, this._getRegionStyle('eyeshadow'));
      }

      // Eyeliner (SVG overlay — sits above eyeshadow, below eyelash)
      const eyelinerColor = this.selectedRegions.eyeliner;
      if (eyelinerColor) {
        const eyelinerStyle = this._getRegionStyle('eyeliner');
        const leftImg  = this._getSvgImage('eyeliner', 'left',  eyelinerColor);
        const rightImg = this._getSvgImage('eyeliner', 'right', eyelinerColor);
        if (leftImg)  this.drawEyeSvgOverlay(ctx, landmarks, leftImg,  EYE_LANDMARKS.left.outer,  EYE_LANDMARKS.left.inner,  EYE_LANDMARKS.left.midUpperLid,  SVG_OVERLAY_CFG.eyeliner, t, eyelinerStyle);
        if (rightImg) this.drawEyeSvgOverlay(ctx, landmarks, rightImg, EYE_LANDMARKS.right.outer, EYE_LANDMARKS.right.inner, EYE_LANDMARKS.right.midUpperLid, SVG_OVERLAY_CFG.eyeliner, t, eyelinerStyle);
      }

      // Eyelash (SVG overlay — topmost eye layer)
      const eyelashColor = this.selectedRegions.eyelash;
      if (eyelashColor) {
        const eyelashStyle = this._getRegionStyle('eyelash');
        const leftImg  = this._getSvgImage('eyelash', 'left',  eyelashColor);
        const rightImg = this._getSvgImage('eyelash', 'right', eyelashColor);
        if (leftImg)  this.drawEyeSvgOverlay(ctx, landmarks, leftImg,  EYE_LANDMARKS.left.outer,  EYE_LANDMARKS.left.inner,  EYE_LANDMARKS.left.midUpperLid,  SVG_OVERLAY_CFG.eyelash, t, eyelashStyle);
        if (rightImg) this.drawEyeSvgOverlay(ctx, landmarks, rightImg, EYE_LANDMARKS.right.outer, EYE_LANDMARKS.right.inner, EYE_LANDMARKS.right.midUpperLid, SVG_OVERLAY_CFG.eyelash, t, eyelashStyle);
      }

      // Lips (with mouth-hole compositing)
      const lipsSel = this.selectedRegions.lips || this.selectedRegions.upper_lip || this.selectedRegions.lower_lip;
      if (lipsSel) {
        this.drawLips(ctx, landmarks, lipsSel, t, this._getRegionStyle('lips'));
      }
    },

    /**
     * Draw a filled polygon region on the canvas.
     * landmarks: array of {x,y,z} normalised coords (0..1)
     */
    drawRegionPolygon: function (ctx, landmarks, indices, color, alpha, t) {
      if (!indices || indices.length < 3) return;

      const srcW = (t && t.srcW) || 0;
      const srcH = (t && t.srcH) || 0;
      const scale = (t && t.scale) || 1;
      const dx = (t && t.dx) || 0;
      const dy = (t && t.dy) || 0;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha || 0.3));
      ctx.fillStyle = color;

      ctx.beginPath();

      const first = landmarks[indices[0]];
      const x0 = (first.x * srcW * scale) + dx;
      const y0 = (first.y * srcH * scale) + dy;
      ctx.moveTo(x0, y0);

      for (let i = 1; i < indices.length; i++) {
        const p = landmarks[indices[i]];
        const x = (p.x * srcW * scale) + dx;
        const y = (p.y * srcH * scale) + dy;
        ctx.lineTo(x, y);
      }

      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },


    /**
     * Draw foundation over the full face — chin to hairline.
     *
     * Rendered on an off-screen canvas so that destination-out cutouts can be
     * applied before the result is composited onto the main canvas.  A small
     * blur is applied at composite time to feather the outer oval and all
     * cutout edges.
     *
     * Cutouts (destination-out):
     *   • Both eye openings  (full upper + lower lid arc)
     *   • Lips outer polygon (removes the lip-paint zone)
     *   • Lips inner polygon (removes the open-mouth gap when lips are parted)
     *   • Left and right nostrils (approximate aperture polygons)
     */
    drawFoundation: function (ctx, landmarks, color, t, style) {
      const indices = REGION_POLYGONS.face_oval;
      if (!indices || indices.length < 3) return;

      const srcW  = (t && t.srcW) || 0;
      const srcH  = (t && t.srcH) || 0;
      const scale = (t && t.scale) || 1;
      const dx    = (t && t.dx)   || 0;
      const dy    = (t && t.dy)   || 0;

      // Helper: landmark index → canvas pixel coords
      const lmPx = function (i) {
        const lm = landmarks[i];
        return { x: (lm.x * srcW * scale) + dx,
                 y: (lm.y * srcH * scale) + dy };
      };

      // Convert face oval to canvas pixel coords
      const pts = indices.map(lmPx);

      // Bounding box of the tracked oval
      let minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < pts.length; i++) {
        if (pts[i].y < minY) minY = pts[i].y;
        if (pts[i].y > maxY) maxY = pts[i].y;
      }
      const faceH = maxY - minY;
      const midY  = (minY + maxY) / 2;

      // How far above the tracked forehead to push the oval.
      // MediaPipe's face_oval already approximates the hairline, so only a
      // modest extension is needed to close the gap at the top of the forehead.
      // 0.22 crept into grey/white hair; 0.10 left a visible uncovered band.
      // 0.16 is the midpoint that reaches the hairline without visible overshoot.
      const HAIRLINE_EXTEND = 0.16;

      // Extend only the upper half; leave lower half (jaw/chin) untouched.
      // All upper-half points are raised by the same absolute amount rather than
      // proportionally.  The proportional formula gave temporal landmarks (which
      // sit only 20-40 % of the way from midY to topY) far too little extension,
      // leaving the right and left temporal forehead areas uncovered especially
      // when the face is slightly tilted.  Uniform extension closes that gap.
      const extended = pts.map(function (p) {
        if (p.y >= midY) return p;
        return { x: p.x, y: p.y - faceH * HAIRLINE_EXTEND };
      });

      // ── Off-screen canvas (same physical-pixel buffer as main canvas) ─────────
      const bufW = canvasEl.width;
      const bufH = canvasEl.height;
      const dpr  = window.devicePixelRatio || 1;
      const cssW = parseInt(canvasEl.style.width,  10) || Math.round(bufW / dpr);
      const cssH = parseInt(canvasEl.style.height, 10) || Math.round(bufH / dpr);

      const oc   = document.createElement('canvas');
      oc.width   = bufW;
      oc.height  = bufH;
      const octx = oc.getContext('2d');
      // Mirror the DPR transform so landmark coordinates map identically
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // ── Phase 1: fill the face oval ───────────────────────────────────────────
      octx.fillStyle   = color;
      octx.globalAlpha = 1.0;
      octx.beginPath();
      octx.moveTo(extended[0].x, extended[0].y);
      for (let i = 1; i < extended.length; i++) octx.lineTo(extended[i].x, extended[i].y);
      octx.closePath();
      octx.fill();

      // ── Phase 2: destination-out cutouts ──────────────────────────────────────
      octx.globalCompositeOperation = 'destination-out';
      octx.globalAlpha = 1.0;

      // Helper: fill a closed polygon cutout from an array of landmark indices
      const cutPoly = function (idxArr) {
        const cpts = idxArr.map(lmPx);
        octx.beginPath();
        octx.moveTo(cpts[0].x, cpts[0].y);
        for (let i = 1; i < cpts.length; i++) octx.lineTo(cpts[i].x, cpts[i].y);
        octx.closePath();
        octx.fill();
      };

      // Left eye — full opening: upper lid arc + lower lid arc
      cutPoly([33, 246, 161, 160, 159, 158, 157, 173,
               133, 155, 154, 153, 145, 144, 163, 7]);
      // Right eye — full opening
      cutPoly([263, 466, 388, 387, 386, 385, 384, 398,
               362, 382, 381, 380, 374, 373, 390, 249]);

      // Lips — outer boundary removes the lip-paint zone; inner boundary
      // removes the mouth opening when the lips are parted
      cutPoly(REGION_POLYGONS.lips_outer);
      cutPoly(REGION_POLYGONS.lips_inner);

      // Nostrils — approximate outline of each nostril aperture.
      // Indices chosen from MediaPipe FaceMesh alar / columella landmarks.
      cutPoly([49, 64, 98, 97, 2, 129]);    // left nostril
      cutPoly([279, 294, 327, 326, 2, 358]); // right nostril

      // Eyebrows — remove foundation from the brow area so the natural brow
      // colour shows through.  Indices are the standard MediaPipe face-mesh
      // eyebrow contour (upper arc + lower arc forming a closed loop).
      cutPoly([46, 53, 52, 65, 55, 70, 63, 105, 66, 107]);         // right brow
      cutPoly([276, 283, 282, 295, 285, 300, 293, 334, 296, 336]); // left brow

      // ── Phase 2.5: Hair-aware cutout ──────────────────────────────────────────
      // Reads the video frame already drawn on the main canvas (ctx) and finds
      // pixels inside the face oval that look like hair — i.e. significantly
      // darker and/or differently-coloured than the detected skin tone.  Those
      // pixels are erased via destination-out so the foundation doesn't paint
      // over bangs, side hair, or any other hair that falls across the face.
      //
      // The skin reference is sampled from stable nose-bridge landmarks that are
      // never covered by hair.  Thresholds adapt to skin luminance so darker
      // skin tones aren't over-classified as hair.  The resulting mask is blurred
      // slightly before compositing to feather the hair-edge transition.
      //
      // Wrapped in try/catch: getImageData is blocked on tainted canvases
      // (e.g. cross-origin video) and we degrade gracefully in that case.
      try {
        const hImgData = ctx.getImageData(0, 0, bufW, bufH);
        const hPx      = hImgData.data;

        // Sample skin reference colour from stable, hair-free nose-bridge area
        const SKIN_IDXS = [168, 197, 195, 4, 1];
        let skinR = 0, skinG = 0, skinB = 0, skinN = 0;
        SKIN_IDXS.forEach(function (idx) {
          if (!landmarks[idx]) return;
          const sp  = lmPx(idx);
          const spx = Math.round(sp.x * dpr);
          const spy = Math.round(sp.y * dpr);
          if (spx < 0 || spx >= bufW || spy < 0 || spy >= bufH) return;
          const spo = (spy * bufW + spx) * 4;
          if (hPx[spo + 3] < 128) return;
          skinR += hPx[spo]; skinG += hPx[spo + 1]; skinB += hPx[spo + 2]; skinN++;
        });

        if (skinN > 0) {
          skinR /= skinN; skinG /= skinN; skinB /= skinN;
          const skinLumH = 0.299 * skinR + 0.587 * skinG + 0.114 * skinB;

          // Adaptive thresholds — scaled by skin luminance so darker skin tones
          // (whose pixels are inherently closer to dark hair in RGB space) are
          // not incorrectly classified as hair.
          const HAIR_DIST = Math.max(30, skinLumH * 0.55); // colour-distance cutoff
          // Raised from 0.20 → 0.30: grey/silver hair is only ~20 % darker than
          // skin and was being falsely detected, cutting out forehead skin at the
          // temples.  0.30 still catches all genuinely dark hair while ignoring
          // near-skin-tone grey hair that colour analysis cannot separate reliably.
          const HAIR_LUM  = Math.max(15, skinLumH * 0.30); // pixel must also be darker

          // Convert the CSS-space extended polygon to buffer-pixel coords
          const hBufPts = extended.map(function (p) {
            return { x: p.x * dpr, y: p.y * dpr };
          });
          const hNP = hBufPts.length;

          // Bounding box of the polygon in buffer-pixel space
          let hBx0 = bufW, hBx1 = 0, hBy0 = bufH, hBy1 = 0;
          hBufPts.forEach(function (p) {
            if (p.x < hBx0) hBx0 = p.x; if (p.x > hBx1) hBx1 = p.x;
            if (p.y < hBy0) hBy0 = p.y; if (p.y > hBy1) hBy1 = p.y;
          });
          hBx0 = Math.max(0, Math.floor(hBx0));
          hBx1 = Math.min(bufW - 1, Math.ceil(hBx1));
          hBy0 = Math.max(0, Math.floor(hBy0));
          hBy1 = Math.min(bufH - 1, Math.ceil(hBy1));

          // ── Hairline-zone ceiling ─────────────────────────────────────────────
          // Restrict the scan to above the eyebrow line so beard/stubble on the
          // lower face and natural shadows around the eyes are never classified
          // as hair.  Head hair (bangs, side hair from temples) only enters the
          // face from the top, so scanning the upper zone is sufficient.
          //
          // Use the brow-reference landmarks from the eyeshadow config (66 left,
          // 296 right) as the cutoff y-level, shifted slightly upward by 2 % of
          // face height so the very top of the brow is still preserved.
          if (landmarks[66] && landmarks[296]) {
            const browY = (lmPx(66).y + lmPx(296).y) / 2;
            const browYBuf = Math.floor((browY - faceH * 0.02) * dpr);
            hBy1 = Math.min(hBy1, browYBuf);
          }

          // ── Horizontal + vertical top inset ──────────────────────────────────
          // Pull the scan edges inward on all sides to create a dead-zone near
          // the polygon boundary.  Without this, two problems occur:
          //   • Temporal corners: the hair-skin boundary sits right at the
          //     face-oval edge; the 3 px mask blur bleeds onto adjacent skin.
          //   • Head-turn case: when the face is turned, the far-side temple
          //     hair enters the polygon more deeply on the horizontal axis.
          // 15 % left/right keeps the middle ~70 % of the forehead (where bangs
          // actually fall) while excluding the temporal edges entirely.
          // A 10 % top inset trims the very tip of the extended polygon where
          // the sharp corners can produce mis-classified boundary pixels.
          const hXInset = Math.round((hBx1 - hBx0) * 0.15);
          hBx0 += hXInset;
          hBx1 -= hXInset;
          const hYInset = Math.round((hBy1 - hBy0) * 0.10);
          hBy0 += hYInset;

          // Ray-cast point-in-polygon test (buffer-pixel coords)
          var hPIP = function (px, py) {
            var inside = false;
            for (var i = 0, j = hNP - 1; i < hNP; j = i++) {
              var xi = hBufPts[i].x, yi = hBufPts[i].y;
              var xj = hBufPts[j].x, yj = hBufPts[j].y;
              if ((yi > py) !== (yj > py) &&
                  px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
                inside = !inside;
              }
            }
            return inside;
          };

          // Build the hair mask on a buffer-sized off-screen canvas
          const hmC   = document.createElement('canvas');
          hmC.width   = bufW;
          hmC.height  = bufH;
          const hmCtx = hmC.getContext('2d');
          const hmImd = hmCtx.createImageData(bufW, bufH);
          const hmD   = hmImd.data;
          let hairFound = false;

          // Sample every 2nd pixel and stamp 2×2 blocks to avoid gaps.
          // This keeps the inner loop fast while maintaining solid coverage.
          const HS = 2;
          for (let hy = hBy0; hy <= hBy1; hy += HS) {
            for (let hx = hBx0; hx <= hBx1; hx += HS) {
              if (!hPIP(hx + 0.5, hy + 0.5)) continue;
              const po = (hy * bufW + hx) * 4;
              const pr = hPx[po], pg = hPx[po + 1], pb = hPx[po + 2], pa = hPx[po + 3];
              if (pa < 128) continue;
              const pLum  = 0.299 * pr + 0.587 * pg + 0.114 * pb;
              const pDist = Math.sqrt(
                (pr - skinR) * (pr - skinR) +
                (pg - skinG) * (pg - skinG) +
                (pb - skinB) * (pb - skinB)
              );
              if (pDist > HAIR_DIST && (skinLumH - pLum) > HAIR_LUM) {
                for (let dy = 0; dy < HS; dy++) {
                  for (let dx = 0; dx < HS; dx++) {
                    const my = hy + dy, mx = hx + dx;
                    if (my > hBy1 || mx > hBx1) continue;
                    const mo = (my * bufW + mx) * 4;
                    hmD[mo] = hmD[mo + 1] = hmD[mo + 2] = 0;
                    hmD[mo + 3] = 255;
                  }
                }
                hairFound = true;
              }
            }
          }

          if (hairFound) {
            hmCtx.putImageData(hmImd, 0, 0);
            // Erase hair pixels from the foundation layer; blur softens the
            // hair-edge transition so it doesn't look like a hard cutout.
            octx.save();
            octx.globalCompositeOperation = 'destination-out';
            octx.globalAlpha = 1.0;
            octx.filter = 'blur(2px)';
            // hmC is buffer-sized; octx uses the DPR transform so we pass CSS dims
            octx.drawImage(hmC, 0, 0, bufW, bufH, 0, 0, bufW / dpr, bufH / dpr);
            octx.restore();
          }
        }
      } catch (e) {
        // getImageData blocked (e.g. tainted canvas) — skip hair cutout gracefully
      }

      // ── Phase 3: composite onto main canvas with edge feathering ─────────────
      // Opacity, feather (blur) and blend mode come from Elementor style controls.
      // Feather 0–100 % maps to 0–12 px of blur; default 25 % ≈ 3 px (original).
      const foundStyle    = style || {};
      const foundOpacity  = (foundStyle.opacity  !== undefined) ? foundStyle.opacity  : 0.18;
      const foundFeatherPx = (foundStyle.feather !== undefined) ? (foundStyle.feather / 100 * 12) : 3;
      const foundBlend    = foundStyle.blendMode || 'source-over';
      ctx.save();
      ctx.filter                   = 'blur(' + foundFeatherPx.toFixed(1) + 'px)';
      ctx.globalAlpha              = foundOpacity;
      ctx.globalCompositeOperation = foundBlend;
      ctx.drawImage(oc, 0, 0, bufW, bufH, 0, 0, cssW, cssH);
      ctx.restore();
    },

    /**
     * Draw soft, feathered eyeshadow above each eye.
     *
     * A single radial-gradient ellipse per eye is drawn on an offscreen canvas,
     * then the eye opening is punched out with a gradient-based destination-out
     * before the result is composited onto the main canvas.
     *
     * One ellipse (no extra corner blobs) eliminates the seaming/patching that
     * occurred when multiple gradient shapes overlapped.  The ellipse is wide
     * enough (semi-W = half-eye-length × 1.60) to cover the outer and inner
     * corner areas naturally, and the radial gradient fades to zero before
     * reaching the brow so no hard brow cutout is needed.
     *
     * Ellipse geometry (per eye):
     *   Centre X  = eye midpoint shifted 8 % toward the outer corner.
     *   Centre Y  = lid peak shifted 20 % of lid-to-brow distance upward.
     *   Semi-W    = half eye-length × 1.60  (covers corners, extends to temples).
     *   Semi-H    = lid-to-brow distance × 0.65.
     *   Peak opacity = 0.55, fading smoothly to 0 at the ellipse boundary.
     *
     * Eye-opening cutout:
     *   Gradient destination-out: fully opaque inside r = 55 % of cutSemiW,
     *   fading to transparent at r = 110 %, giving a feathered lash-line edge.
     */
    drawEyeshadow: function (ctx, landmarks, color, t, style) {
      const srcW  = (t && t.srcW)  || 0;
      const srcH  = (t && t.srcH)  || 0;
      const scale = (t && t.scale) || 1;
      const dx    = (t && t.dx)    || 0;
      const dy    = (t && t.dy)    || 0;

      const px = function (idx) {
        const lm = landmarks[idx];
        return { x: (lm.x * srcW * scale) + dx,
                 y: (lm.y * srcH * scale) + dy };
      };

      const col  = (color && /^#[0-9a-fA-F]{6}$/.test(color)) ? color : '#c0a0c0';
      const r    = parseInt(col.slice(1, 3), 16);
      const g    = parseInt(col.slice(3, 5), 16);
      const b    = parseInt(col.slice(5, 7), 16);
      const rgba = function (a) {
        return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
      };

      // Offscreen canvas keeps destination-out away from the main canvas layers.
      const canvasW = ctx.canvas.width;
      const canvasH = ctx.canvas.height;
      const off    = document.createElement('canvas');
      off.width    = canvasW;
      off.height   = canvasH;
      const offCtx = off.getContext('2d');

      const drawEye = function (refs) {
        const outer    = px(refs.outer);
        const inner    = px(refs.inner);
        const lidPeak  = px(refs.lidPeak);
        const lowerLid = px(refs.lowerLid);
        const brow     = px(refs.browRef);

        const eyeVec = { x: inner.x - outer.x, y: inner.y - outer.y };
        const eyeLen = Math.sqrt(eyeVec.x * eyeVec.x + eyeVec.y * eyeVec.y);
        if (eyeLen < 1) return;

        const lidToBrow = lidPeak.y - brow.y;
        if (lidToBrow < 1) return;

        // ── Phase 1: single radial-gradient ellipse ───────────────────────────
        // Centre X: midpoint shifted 13 % outward toward the temple so the
        // gradient is denser over the outer corner area.
        const midX  = (outer.x + inner.x) * 0.5 - eyeVec.x * 0.13;
        // Semi-W: 60 % wider than the half eye-length covers the corner areas
        // without needing separate corner blobs (which caused visible seams).
        const semiW = (eyeLen * 0.5) * 1.60;
        // Centre Y and Semi-H are sized from browRef (lidToBrow) — the browRef
        // landmark gives the correct full lid-to-brow distance regardless of
        // eye-openness.  The browPoly polygon cutout (Phase 2 Pass A) is what
        // actually masks the brow area; shadow sizing must not be constrained by
        // the lowest brow-hair point (which sits close to the lid and makes the
        // shadow too thin).
        const cy    = lidPeak.y - lidToBrow * 0.20;
        const semiH = Math.min(lidToBrow * 0.80, eyeLen * 0.55);
        if (semiH < 1) return;

        const scaleY = semiH / semiW;
        const cys    = cy / scaleY;

        // Gradient holds more opacity through the 0.28–0.58 range where the outer
        // and inner corner areas sit (~60 % of semiW from centre once the vertical
        // offset of the canthus is accounted for in the scaled ellipse space).
        const grad = offCtx.createRadialGradient(midX, cys, 0, midX, cys, semiW);
        grad.addColorStop(0,    rgba(0.55));
        grad.addColorStop(0.28, rgba(0.44));
        grad.addColorStop(0.55, rgba(0.30));
        grad.addColorStop(0.75, rgba(0.12));
        grad.addColorStop(0.90, rgba(0.03));
        grad.addColorStop(1,    rgba(0));

        offCtx.save();
        offCtx.scale(1, scaleY);
        offCtx.beginPath();
        offCtx.arc(midX, cys, semiW, 0, Math.PI * 2);
        offCtx.fillStyle = grad;
        offCtx.fill();
        offCtx.restore();

        // ── Phase 2: eyebrow cutout ────────────────────────────────────────────
        // Two-pass destination-out to remove shadow from the brow region.
        //
        // Pass A — browPoly polygon with a small blur.
        //   Follows the actual brow landmark shape so the erase is accurate
        //   regardless of eye-openness.  A small blur feathers the lower brow
        //   edge so the shadow-to-brow transition is soft, not hard.
        const browBlurPx = Math.max(3, Math.round(eyeLen * 0.03));
        offCtx.save();
        offCtx.globalCompositeOperation = 'destination-out';
        offCtx.filter = 'blur(' + browBlurPx + 'px)';
        offCtx.beginPath();
        refs.browPoly.forEach(function (idx, i) {
          const p = px(idx);
          if (i === 0) offCtx.moveTo(p.x, p.y);
          else         offCtx.lineTo(p.x, p.y);
        });
        offCtx.closePath();
        offCtx.fillStyle = 'rgba(0,0,0,1)';
        offCtx.fill();
        offCtx.restore();
        //
        // Pass B — gradient rect above the topmost brow landmark.
        //   Erases any shadow that overshoots above the brow polygon itself,
        //   fading from transparent at the brow top to fully opaque further up.
        const browTopY = refs.browPoly.reduce(function (topY, idx) {
          return Math.min(topY, px(idx).y);
        }, brow.y);
        const aboveFadeH = Math.max(4, lidToBrow * 0.18);
        const aboveMask  = offCtx.createLinearGradient(
          0, browTopY + aboveFadeH, 0, browTopY);
        aboveMask.addColorStop(0, 'rgba(0,0,0,0)');
        aboveMask.addColorStop(1, 'rgba(0,0,0,1)');
        offCtx.save();
        offCtx.globalCompositeOperation = 'destination-out';
        offCtx.fillStyle = aboveMask;
        offCtx.fillRect(midX - semiW, 0, semiW * 2,
                        Math.ceil(browTopY + aboveFadeH));
        offCtx.restore();

        // ── Phase 3: feathered eye-opening cutout ─────────────────────────────
        // Gradient destination-out: fully opaque inside innerR (eyeball safely
        // erased), feathering to zero at outerR (soft lash-line edge).
        // cutSemiW is sized to the full eye opening; centre is biased 60/40
        // toward the upper lid because the shadow bleeds downward from above.
        const eyeCx    = (outer.x + inner.x) * 0.5;
        const eyeCy    = lidPeak.y * 0.60 + lowerLid.y * 0.40;
        const eyeH     = Math.abs(lidPeak.y - lowerLid.y);
        const cutSemiW = (eyeLen * 0.5) * 0.95;
        const cutSemiH = (eyeH  * 0.5) * 1.05;
        if (cutSemiW < 1 || cutSemiH < 1) return;

        const cutScaleY = cutSemiH / cutSemiW;
        const eyeCys    = eyeCy / cutScaleY;
        const innerR    = cutSemiW * 0.68;
        const outerR    = cutSemiW * 1.05;

        const cutGrad = offCtx.createRadialGradient(
          eyeCx, eyeCys, innerR,
          eyeCx, eyeCys, outerR
        );
        cutGrad.addColorStop(0, 'rgba(0,0,0,1)');
        cutGrad.addColorStop(1, 'rgba(0,0,0,0)');

        offCtx.save();
        offCtx.globalCompositeOperation = 'destination-out';
        offCtx.scale(1, cutScaleY);
        offCtx.beginPath();
        offCtx.arc(eyeCx, eyeCys, outerR, 0, Math.PI * 2);
        offCtx.fillStyle = cutGrad;
        offCtx.fill();
        offCtx.restore();
      };

      drawEye(REGION_POLYGONS.left_eyeshadow);
      drawEye(REGION_POLYGONS.right_eyeshadow);

      // Composite with Elementor-controlled opacity and blend mode.
      const shadowStyle   = style || {};
      const shadowOpacity = (shadowStyle.opacity  !== undefined) ? shadowStyle.opacity  : 1.0;
      const shadowBlend   = shadowStyle.blendMode || 'source-over';
      ctx.save();
      ctx.globalAlpha              = shadowOpacity;
      ctx.globalCompositeOperation = shadowBlend;
      ctx.drawImage(off, 0, 0);
      ctx.restore();
    },

    /**
     * Draw soft under-eye concealer on both eyes.
     *
     * Mirrors drawEyeshadow geometry but placed below the lower lid to cover
     * the eye-bag area.  A single radial-gradient ellipse is drawn on an
     * offscreen canvas; a feathered destination-out cutout then removes any
     * colour that bleeds into the eye opening above the lower lash line.
     *
     * Key differences from drawEyeshadow:
     *   - cy is 20 % BELOW lowerLid (not above lidPeak)
     *   - depth reference is cheekRef (infraorbital rim) instead of browRef
     *   - no brow cutout pass needed
     *   - eye-opening cutout centre is biased 70/30 toward the lower lid
     */
    drawConcealer: function (ctx, landmarks, color, t, style) {
      const srcW  = (t && t.srcW)  || 0;
      const srcH  = (t && t.srcH)  || 0;
      const scale = (t && t.scale) || 1;
      const dx    = (t && t.dx)    || 0;
      const dy    = (t && t.dy)    || 0;

      const px = function (idx) {
        const lm = landmarks[idx];
        return { x: (lm.x * srcW * scale) + dx,
                 y: (lm.y * srcH * scale) + dy };
      };

      const col  = (color && /^#[0-9a-fA-F]{6}$/.test(color)) ? color : '#e8c8a0';
      const r    = parseInt(col.slice(1, 3), 16);
      const g    = parseInt(col.slice(3, 5), 16);
      const b    = parseInt(col.slice(5, 7), 16);
      const rgba = function (a) {
        return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
      };

      // Offscreen canvas keeps destination-out away from the main canvas layers.
      const canvasW = ctx.canvas.width;
      const canvasH = ctx.canvas.height;
      const off    = document.createElement('canvas');
      off.width    = canvasW;
      off.height   = canvasH;
      const offCtx = off.getContext('2d');

      const drawEye = function (refs) {
        const outer    = px(refs.outer);
        const inner    = px(refs.inner);
        const lidPeak  = px(refs.lidPeak);
        const lowerLid = px(refs.lowerLid);
        const cheek    = px(refs.cheekRef);

        const eyeVec = { x: inner.x - outer.x, y: inner.y - outer.y };
        const eyeLen = Math.sqrt(eyeVec.x * eyeVec.x + eyeVec.y * eyeVec.y);
        if (eyeLen < 1) return;

        const lidToCheek = cheek.y - lowerLid.y;   // positive: cheek is below lid
        if (lidToCheek < 1) return;

        // ── Phase 1: single radial-gradient ellipse ───────────────────────────
        // Centre X: same outward temple shift as eyeshadow — eye bags are most
        // visible toward the outer corner.
        const midX  = (outer.x + inner.x) * 0.5 - eyeVec.x * 0.13;
        // Semi-W: same 60 % extension as eyeshadow covers corner areas cleanly.
        const semiW = (eyeLen * 0.5) * 1.60;
        // Centre Y: 55 % below the lower lid — pushed down for deeper coverage.
        const cy    = lowerLid.y + lidToCheek * 0.55;
        // Semi-H: 150 % of lid-to-cheek distance (OR 110 % of eye width) so
        // the bottom of the ellipse reaches well down into the cheek area.
        // The top edge is unaffected — the eye-opening cutout (Phase 2) always
        // clips the concealer back to the lower lash line.
        const semiH = Math.min(lidToCheek * 1.50, eyeLen * 1.10);
        if (semiH < 1) return;

        const scaleY = semiH / semiW;
        const cys    = cy / scaleY;

        const grad = offCtx.createRadialGradient(midX, cys, 0, midX, cys, semiW);
        grad.addColorStop(0,    rgba(0.55));
        grad.addColorStop(0.28, rgba(0.44));
        grad.addColorStop(0.55, rgba(0.30));
        grad.addColorStop(0.75, rgba(0.12));
        grad.addColorStop(0.90, rgba(0.03));
        grad.addColorStop(1,    rgba(0));

        offCtx.save();
        offCtx.scale(1, scaleY);
        offCtx.beginPath();
        offCtx.arc(midX, cys, semiW, 0, Math.PI * 2);
        offCtx.fillStyle = grad;
        offCtx.fill();
        offCtx.restore();

        // ── Phase 2: feathered eye-opening cutout ─────────────────────────────
        // Removes any concealer that bleeds up into the eye opening / iris.
        // Centre biased 70/30 toward the lower lid (concealer is below, so most
        // bleed is at the lower lash line rather than the upper lid).
        const eyeCx    = (outer.x + inner.x) * 0.5;
        const eyeCy    = lowerLid.y * 0.70 + lidPeak.y * 0.30;
        const eyeH     = Math.abs(lidPeak.y - lowerLid.y);
        const cutSemiW = (eyeLen * 0.5) * 0.95;
        const cutSemiH = (eyeH  * 0.5) * 1.05;
        if (cutSemiW < 1 || cutSemiH < 1) return;

        const cutScaleY = cutSemiH / cutSemiW;
        const eyeCys    = eyeCy / cutScaleY;
        const innerR    = cutSemiW * 0.68;
        const outerR    = cutSemiW * 1.05;

        const cutGrad = offCtx.createRadialGradient(
          eyeCx, eyeCys, innerR,
          eyeCx, eyeCys, outerR
        );
        cutGrad.addColorStop(0, 'rgba(0,0,0,1)');
        cutGrad.addColorStop(1, 'rgba(0,0,0,0)');

        offCtx.save();
        offCtx.globalCompositeOperation = 'destination-out';
        offCtx.scale(1, cutScaleY);
        offCtx.beginPath();
        offCtx.arc(eyeCx, eyeCys, outerR, 0, Math.PI * 2);
        offCtx.fillStyle = cutGrad;
        offCtx.fill();
        offCtx.restore();
      };

      drawEye(REGION_POLYGONS.left_concealer);
      drawEye(REGION_POLYGONS.right_concealer);

      // Composite with Elementor-controlled opacity and blend mode.
      const concealStyle   = style || {};
      const concealOpacity = (concealStyle.opacity  !== undefined) ? concealStyle.opacity  : 1.0;
      const concealBlend   = concealStyle.blendMode || 'source-over';
      ctx.save();
      ctx.globalAlpha              = concealOpacity;
      ctx.globalCompositeOperation = concealBlend;
      ctx.drawImage(off, 0, 0);
      ctx.restore();
    },

    /**
     * Draw soft feathered blush on both upper cheeks.
     *
     * Each cheek is rendered as a radial gradient circle whose:
     *   - centre  = centroid of the cheek anchor landmarks defined in REGION_POLYGONS
     *   - radius  = ~65 % of the ipsilateral eye width (outer→inner corner distance),
     *               which scales naturally with face size and distance from camera.
     *
     * The gradient fades from semi-opaque at the centre to fully transparent at the
     * edge, giving the soft, feathered look typical of real blush.
     */
    drawBlush: function (ctx, landmarks, color, t, style) {
      const srcW  = (t && t.srcW)  || 0;
      const srcH  = (t && t.srcH)  || 0;
      const scale = (t && t.scale) || 1;
      const dx    = (t && t.dx)    || 0;
      const dy    = (t && t.dy)    || 0;

      // Convert a landmark index to canvas pixel coordinates.
      const px = function (idx) {
        const lm = landmarks[idx];
        return {
          x: (lm.x * srcW * scale) + dx,
          y: (lm.y * srcH * scale) + dy
        };
      };

      // Parse colour to an rgba() string.  Falls back to a soft rose if the
      // colour is not a recognisable 6-digit hex value.
      const col = (color && /^#[0-9a-fA-F]{6}$/.test(color)) ? color : '#e8a0a0';
      const r   = parseInt(col.slice(1, 3), 16);
      const g   = parseInt(col.slice(3, 5), 16);
      const b   = parseInt(col.slice(5, 7), 16);
      const rgba = function (a) {
        return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
      };

      // Draw one feathered blush circle.
      //   anchorIdxs   – landmark indices whose centroid is the blush centre.
      //   eyeOuterIdx  – lateral canthus (outer eye corner) for the same side.
      //   eyeInnerIdx  – medial canthus (inner eye corner) for the same side.
      const drawCheek = function (anchorIdxs, eyeOuterIdx, eyeInnerIdx) {
        // Centroid of the cheek anchor landmarks.
        let cx = 0, cy = 0;
        for (let i = 0; i < anchorIdxs.length; i++) {
          const p = px(anchorIdxs[i]);
          cx += p.x;
          cy += p.y;
        }
        cx /= anchorIdxs.length;
        cy /= anchorIdxs.length;

        // Radius based on ipsilateral eye width so it scales with face size.
        const outer = px(eyeOuterIdx);
        const inner = px(eyeInnerIdx);
        const eyeW  = Math.sqrt(
          Math.pow(inner.x - outer.x, 2) + Math.pow(inner.y - outer.y, 2)
        );
        const radius = eyeW * 0.85;
        if (radius < 1) return;

        // Feathered radial gradient: semi-opaque centre → fully transparent edge.
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0,    rgba(0.38));
        grad.addColorStop(0.45, rgba(0.22));
        grad.addColorStop(0.75, rgba(0.10));
        grad.addColorStop(1,    rgba(0));

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      };

      // Apply Elementor-controlled opacity and blend mode around both cheeks.
      const blushStyle   = style || {};
      const blushOpacity = (blushStyle.opacity  !== undefined) ? blushStyle.opacity  : 1.0;
      const blushBlend   = blushStyle.blendMode || 'source-over';
      ctx.save();
      ctx.globalAlpha              = blushOpacity;
      ctx.globalCompositeOperation = blushBlend;

      // Left cheek (image left / user's right cheek):
      //   anchors = left_cheek_anchors, eye = landmarks 33 (outer) → 133 (inner)
      drawCheek(REGION_POLYGONS.left_cheek_anchors,  33, 133);

      // Right cheek (image right / user's left cheek):
      //   anchors = right_cheek_anchors, eye = landmarks 263 (outer) → 362 (inner)
      drawCheek(REGION_POLYGONS.right_cheek_anchors, 263, 362);

      ctx.restore();
    },

    /**
     * Draw lips with mouth-hole compositing.
     */
    drawLips: function (ctx, landmarks, color, t, style) {
      const bufW = canvasEl.width;
      const bufH = canvasEl.height;
      const dpr  = window.devicePixelRatio || 1;
      const cssW = parseInt(canvasEl.style.width,  10) || Math.round(bufW / dpr);
      const cssH = parseInt(canvasEl.style.height, 10) || Math.round(bufH / dpr);

      // Resolve Elementor style controls (opacity, feather, blend mode).
      const lipsStyle    = style || {};
      const lipsOpacity  = (lipsStyle.opacity  !== undefined) ? lipsStyle.opacity  : 0.70;
      const lipsFeatherPx = (lipsStyle.feather !== undefined) ? (lipsStyle.feather / 100 * 12) : 0;
      const lipsBlend    = lipsStyle.blendMode || 'source-over';

      // Off-screen canvas with the same physical pixel buffer as the main canvas
      const oc   = document.createElement('canvas');
      oc.width   = bufW;
      oc.height  = bufH;
      const octx = oc.getContext('2d');
      // Mirror the DPR transform so landmark coordinates map identically
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // 1. Fill the outer lip shape using the Elementor-controlled opacity.
      octx.fillStyle   = color;
      octx.globalAlpha = lipsOpacity;
      this._tracePath(octx, landmarks, REGION_POLYGONS.lips_outer, t);
      octx.fill();

      // 2. Punch out the inner mouth opening so open-mouth gap is transparent
      octx.globalCompositeOperation = 'destination-out';
      octx.globalAlpha = 1.0;
      this._tracePath(octx, landmarks, REGION_POLYGONS.lips_inner, t);
      octx.fill();

      // 3. Composite the off-screen result onto the main canvas.
      //    Apply feather blur and blend mode from Elementor controls.
      //    ctx has a DPR transform so we draw in CSS pixel space (cssW × cssH).
      ctx.save();
      ctx.globalCompositeOperation = lipsBlend;
      if (lipsFeatherPx > 0) ctx.filter = 'blur(' + lipsFeatherPx.toFixed(1) + 'px)';
      ctx.drawImage(oc, 0, 0, bufW, bufH, 0, 0, cssW, cssH);
      ctx.restore();
    },

    // -------------------------------------------------------------------------
    // SVG overlay helpers
    // -------------------------------------------------------------------------

    /**
     * Convert a normalised MediaPipe landmark to canvas pixel coordinates.
     */
    _lmPx: function (landmark, t) {
      return {
        x: landmark.x * t.srcW * t.scale + t.dx,
        y: landmark.y * t.srcH * t.scale + t.dy
      };
    },

    /**
     * Draw a colourised SVG image aligned to the upper eyelid of one eye.
     *
     * Design decisions
     * ─────────────────
     * BLINK TRACKING  Previously we averaged the full upper-lid arc including
     *   the relatively static corner landmarks (33/133, 263/362), which diluted
     *   blink movement.  Now we use only the 7 MIDDLE arc points (midUpperLid)
     *   which move ~3× more per blink.  We take the MINIMUM local-Y of those
     *   points (the one closest to the screen top = the lid peak), which is the
     *   most blink-sensitive single value.
     *
     * ANCHOR BLEND  Different makeup types need different vertical positions.
     *   peakLocalY is the minimum (most-upward) of the middle lid points.
     *   anchorBlend=1 puts the SVG bottom at that peak  → correct for eyelash.
     *   anchorBlend=0.5 moves it halfway toward the corner baseline → lower,
     *   correct for eyeliner which should sit on (not above) the lid edge.
     *   Blink response scales proportionally (50% of peak movement for liner).
     *
     * WIDTH & OUTER EXTENSION  Eye width is measured from the widest-spread
     *   upper-lid arc landmarks (not just corners) so narrow/wide eyes are
     *   handled by facial recognition automatically.  widthScale makes the SVG
     *   wider than the raw measurement; outerExtend adds extra width only on
     *   the temple side so lash tips and cat-eye flicks clear the corner.
     *
     * COORDINATE NORMALISATION  The outer→inner angle for the right eye is
     *   ~180°, which would flip the local-Y axis and put the SVG below the eye.
     *   We always swap so the baseline runs left-to-right (smaller-X → larger-X),
     *   keeping local +Y = downward on screen for both eyes.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {Array}    landmarks    - MediaPipe landmark array for the frame.
     * @param {Image}    svgImg       - Colourised SVG as an HTMLImageElement.
     * @param {number}   outerIdx     - Landmark index of the outer (temple) corner.
     * @param {number}   innerIdx     - Landmark index of the inner (nose) corner.
     * @param {number[]} midLidIdxs   - Middle upper-lid arc indices (no corners).
     * @param {Object}   cfg          - Config from SVG_OVERLAY_CFG.
     * @param {Object}   t            - Render transform {srcW,srcH,scale,dx,dy}.
     */
    drawEyeSvgOverlay: function (ctx, landmarks, svgImg, outerIdx, innerIdx, midLidIdxs, cfg, t, style) {
      if (!svgImg || !svgImg.complete || !svgImg.naturalWidth) return;

      const outer = this._lmPx(landmarks[outerIdx], t);
      const inner = this._lmPx(landmarks[innerIdx], t);

      // ── 1. Left-to-right normalisation ───────────────────────────────────
      // After this swap, leftPt.x < rightPt.x always, so local +Y is always
      // downward on screen.  We also record which side is the "outer" corner
      // (the temple side, where the flick / outer lashes go).
      const outerOnLeft = (outer.x <= inner.x); // true for left eye in selfie
      const leftPt  = outerOnLeft ? outer : inner;
      const rightPt = outerOnLeft ? inner : outer;

      // ── 2. Eye width from widest spread of the lid arc landmarks ─────────
      // Using the outermost landmark positions (rather than just the corner
      // indices) captures narrow-set vs wide-set eyes automatically.
      const angle   = Math.atan2(rightPt.y - leftPt.y, rightPt.x - leftPt.x);
      const cosA    = Math.cos(-angle);
      const sinA    = Math.sin(-angle);

      // Project all mid-lid points into local (rotated) space and gather
      // the spread in X (for width) and the minimum Y (for blink tracking).
      let localXMin =  Infinity, localXMax = -Infinity;
      let localYMin =  Infinity;                // most-upward = peak of lid arc

      const baseX = (leftPt.x + rightPt.x) / 2;
      const baseY = (leftPt.y + rightPt.y) / 2;

      for (let i = 0; i < midLidIdxs.length; i++) {
        const p = this._lmPx(landmarks[midLidIdxs[i]], t);
        const lx = (p.x - baseX) * cosA + (p.y - baseY) * sinA;
        const ly = -(p.x - baseX) * sinA + (p.y - baseY) * cosA;
        if (lx < localXMin) localXMin = lx;
        if (lx > localXMax) localXMax = lx;
        if (ly < localYMin) localYMin = ly;
      }

      // Also include the corner landmarks for the true eye width
      [leftPt, rightPt].forEach(function (p) {
        const lx = (p.x - baseX) * cosA + (p.y - baseY) * sinA;
        if (lx < localXMin) localXMin = lx;
        if (lx > localXMax) localXMax = lx;
      });

      const measuredWidth = localXMax - localXMin;
      if (measuredWidth < 1) return;

      // ── 3. Draw dimensions ────────────────────────────────────────────────
      const widthScale  = cfg.widthScale  || 1.0;
      const outerExtend = cfg.outerExtend || 0;

      // Total draw width = measured × scale, plus extra on the outer side
      const drawW       = measuredWidth * widthScale + measuredWidth * outerExtend;
      const drawH       = (svgImg.naturalHeight / svgImg.naturalWidth) * drawW;

      // X offset in local space: shift SVG toward the outer corner so the
      // extra width pads that side.  outerOnLeft → outer = left → shift negative.
      const outerShift  = (measuredWidth * outerExtend) / 2;
      const xOff        = outerOnLeft ? -outerShift : outerShift;

      // Local-X centre of the measured arc (may not be exactly 0 after swap)
      const arcCenterLocalX = (localXMin + localXMax) / 2;

      // ── 4. Blink-aware vertical anchor ───────────────────────────────────
      // peakLocalY is the most-negative local-Y among mid-lid points.
      // anchorBlend=1 → SVG bottom sits right at the lid peak (eyelash).
      // anchorBlend=0.5 → halfway toward local-Y=0 (baseline) → lower (eyeliner).
      const anchorBlend   = (cfg.anchorBlend !== undefined) ? cfg.anchorBlend : 1.0;
      const peakLocalY    = localYMin;                    // most-upward, blink-responsive
      const anchorLocalY  = peakLocalY * anchorBlend;    // scaled toward baseline

      // ── 5. Draw ───────────────────────────────────────────────────────────
      const cx = baseX + arcCenterLocalX * Math.cos(angle);
      const cy = baseY + arcCenterLocalX * Math.sin(angle);

      // Apply Elementor-controlled opacity and blend mode for this SVG region.
      const svgStyle   = style || {};
      const svgOpacity = (svgStyle.opacity  !== undefined) ? svgStyle.opacity  : 1.0;
      const svgBlend   = svgStyle.blendMode || 'source-over';

      ctx.save();
      ctx.imageSmoothingEnabled    = true;
      ctx.imageSmoothingQuality    = 'high';
      ctx.globalAlpha              = svgOpacity;
      ctx.globalCompositeOperation = svgBlend;
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      // SVG bottom at anchorLocalY; extends upward (more-negative) by drawH
      ctx.drawImage(
        svgImg,
        -drawW / 2 + xOff,      // left edge: centred then shifted toward outer side
        anchorLocalY - drawH,    // top edge (above the anchor)
        drawW,
        drawH
      );
      ctx.restore();
    },

    /**
     * Fetch the raw SVG text for a URL and pass it to callback(text).
     * Results are cached; in-flight fetches are not duplicated.
     * Calls callback(null) on error.
     */
    _fetchSvgText: function (url, callback) {
      if (svgTextCache.hasOwnProperty(url)) {
        // Already fetched (or in-flight with null placeholder)
        if (svgTextCache[url] !== null) {
          callback(svgTextCache[url]);
        }
        // If null, the fetch failed — don't retry
        return;
      }

      // Mark as in-flight so concurrent calls don't re-fetch
      svgTextCache[url] = null;

      // Queue callbacks in case multiple callers request the same URL before it loads
      const queue = [callback];
      svgTextCache['__q__' + url] = queue;

      fetch(url, { credentials: 'same-origin' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.text();
        })
        .then(function (text) {
          svgTextCache[url] = text;
          const q = svgTextCache['__q__' + url] || [];
          delete svgTextCache['__q__' + url];
          q.forEach(function (cb) { cb(text); });
        })
        .catch(function () {
          // Leave null so we know it failed; flush any queued callbacks with null
          const q = svgTextCache['__q__' + url] || [];
          delete svgTextCache['__q__' + url];
          q.forEach(function (cb) { cb(null); });
        });
    },

    /**
     * Replace fill/stroke colours in an SVG string with `color`.
     * Preserves "none", "inherit", "transparent", and url(...) values.
     */
    _colorizeSvgText: function (svgText, color) {
      let result = svgText;

      // Ensure the root <svg> has explicit width/height so browsers rasterise it
      if (!/<svg[^>]+\bwidth=/.test(result)) {
        result = result.replace(/<svg\b/, '<svg width="500"');
      }
      if (!/<svg[^>]+\bheight=/.test(result)) {
        result = result.replace(/<svg\b/, '<svg height="200"');
      }

      // Set fill on the root <svg> element so it cascades to paths that inherit
      result = result.replace(/(<svg\b[^>]*?)>/, function (match, opening) {
        // Remove any existing fill on the <svg> tag, then add ours
        const stripped = opening.replace(/\s+fill="[^"]*"/, '');
        return stripped + ' fill="' + color + '">';
      });

      // Replace explicit fill/stroke attribute values (skip none / inherit / transparent / url)
      const skipAttr = /^(none|inherit|transparent|currentColor|url\()/i;
      result = result
        .replace(/\bfill="([^"]*)"/g, function (match, val) {
          return skipAttr.test(val.trim()) ? match : 'fill="' + color + '"';
        })
        .replace(/\bstroke="([^"]*)"/g, function (match, val) {
          return skipAttr.test(val.trim()) ? match : 'stroke="' + color + '"';
        });

      // Replace fill/stroke in inline style attributes
      result = result
        .replace(/\bfill\s*:\s*([^;}"']+)/g, function (match, val) {
          return skipAttr.test(val.trim()) ? match : 'fill:' + color;
        })
        .replace(/\bstroke\s*:\s*([^;}"']+)/g, function (match, val) {
          return skipAttr.test(val.trim()) ? match : 'stroke:' + color;
        });

      return result;
    },

    /**
     * Build a colourised HTMLImageElement from an SVG URL and call callback(img).
     * Calls callback(null) on any error.
     */
    _buildColorizedSvgImage: function (url, color, callback) {
      if (!url || !color) { callback(null); return; }
      const self = this;

      this._fetchSvgText(url, function (svgText) {
        if (!svgText) { callback(null); return; }

        const colored = self._colorizeSvgText(svgText, color);
        let blobUrl;
        try {
          const blob = new Blob([colored], { type: 'image/svg+xml;charset=utf-8' });
          blobUrl = URL.createObjectURL(blob);
        } catch (e) {
          callback(null);
          return;
        }

        const img = new Image();
        img.onload = function () {
          URL.revokeObjectURL(blobUrl);
          callback(img);
        };
        img.onerror = function () {
          URL.revokeObjectURL(blobUrl);
          callback(null);
        };
        img.src = blobUrl;
      });
    },

    /**
     * Kick off async loading of colourised SVG images for a given region+colour.
     * Results are stored in svgImageCache keyed by "<region>_<side>|<colour>".
     * Called whenever the user picks a colour for 'eyelash' or 'eyeliner'.
     */
    _prepareSvgOverlays: function (region, color) {
      const overlays = window.apothecaARSvgOverlays || {};
      const self = this;

      function build(side, url) {
        if (!url) return;
        const storeKey = region + '_' + side + '|' + color;

        // Skip if already cached and ready
        const cached = svgImageCache[storeKey];
        if (cached && cached.complete && cached.naturalWidth) return;

        self._buildColorizedSvgImage(url, color, function (img) {
          svgImageCache[storeKey] = img;
        });
      }

      if (region === 'eyelash') {
        build('left',  overlays.eyelash_left);
        build('right', overlays.eyelash_right);
      } else if (region === 'eyeliner') {
        build('left',  overlays.eyeliner_left);
        build('right', overlays.eyeliner_right);
      }
    },

    /**
     * Pre-fetch all configured SVG files when the modal opens so that when
     * the user selects a colour the images appear immediately (no visible lag).
     * Only the text is fetched here; colourised images are built on swatch click.
     */
    _prefetchSvgOverlays: function () {
      const overlays = window.apothecaARSvgOverlays || {};
      const self = this;
      ['eyelash_left', 'eyelash_right', 'eyeliner_left', 'eyeliner_right'].forEach(function (key) {
        const url = overlays[key];
        if (url && !svgTextCache.hasOwnProperty(url)) {
          self._fetchSvgText(url, function () {}); // warm-up only
        }
      });
    },

    /**
     * Return a cached, ready SVG image for the given region+side+colour, or null.
     */
    _getSvgImage: function (region, side, color) {
      const key = region + '_' + side + '|' + color;
      const img = svgImageCache[key];
      return (img && img.complete && img.naturalWidth) ? img : null;
    },

    // -------------------------------------------------------------------------

    /**
     * Backwards-compatible API: previously updateMakeup('lipstick', color)
     * Now stores the region colour and triggers SVG preparation for eye regions.
     */

    _tracePath: function (ctx, landmarks, indices, t) {
      if (!indices || indices.length < 3) return;

      const srcW  = (t && t.srcW) || 0;
      const srcH  = (t && t.srcH) || 0;
      const scale = (t && t.scale) || 1;
      const dx    = (t && t.dx)   || 0;
      const dy    = (t && t.dy)   || 0;

      const first = landmarks[indices[0]];
      ctx.beginPath();
      ctx.moveTo((first.x * srcW * scale) + dx, (first.y * srcH * scale) + dy);
      for (let i = 1; i < indices.length; i++) {
        const p = landmarks[indices[i]];
        ctx.lineTo((p.x * srcW * scale) + dx, (p.y * srcH * scale) + dy);
      }
      ctx.closePath();
    },

    /**
     * Return the Elementor-configured rendering style for a face region.
     * Falls back to safe defaults if the widget has not yet output the variable.
     *
     * @param  {string} region  e.g. 'eyebrows', 'lips', 'eyelash', …
     * @return {Object}         { opacity?, feather?, blendMode }
     */
    _getRegionStyle: function (region) {
      var styles = window.apothecaARRegionStyles || {};
      return styles[region] || {};
    },

    updateMakeup: function (region, color) {
      if (!region || region === 'none') return;
      this.selectedRegions[region] = color;

      // For SVG-based regions, start building the colourised image immediately
      if (region === 'eyelash' || region === 'eyeliner') {
        this._prepareSvgOverlays(region, color);
      }
    }
  };

  // Init
  $(document).ready(function () {
    ApothecaAR.init();
    window.ApothecaAR = ApothecaAR;
  });
})(jQuery);
