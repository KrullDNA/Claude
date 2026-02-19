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

    // Eyeshadow — reference landmarks for the elliptical gradient.
    // outer/inner: eye corners used for width and horizontal centre.
    // lidPeak:     topmost point of the upper eyelid arc.
    // browRef:     a stable point on the lower edge of the brow used to
    //              set vertical height (brow.y < lidPeak.y in canvas space).
    left_eyeshadow:  { outer: 33,  inner: 133, lidPeak: 159, browRef: 66  },
    right_eyeshadow: { outer: 263, inner: 362, lidPeak: 386, browRef: 295 },

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
        this.drawFoundation(ctx, landmarks, this.selectedRegions.foundation, t);
      }

      // Blush (upper cheeks — rendered above foundation, below eye makeup)
      if (this.selectedRegions.blush) {
        this.drawBlush(ctx, landmarks, this.selectedRegions.blush, t);
      }

      // Eyebrows — support both 'eyebrows' (current enum) and legacy 'brows'
      const browSel = this.selectedRegions.eyebrows || this.selectedRegions.brows || this.selectedRegions.left_brow || this.selectedRegions.right_brow;
      if (browSel) {
        const left  = this.selectedRegions.left_brow  || this.selectedRegions.eyebrows || this.selectedRegions.brows || browSel;
        const right = this.selectedRegions.right_brow || this.selectedRegions.eyebrows || this.selectedRegions.brows || browSel;
        this.drawRegionPolygon(ctx, landmarks, REGION_POLYGONS.left_brow,  left,  0.45, t);
        this.drawRegionPolygon(ctx, landmarks, REGION_POLYGONS.right_brow, right, 0.45, t);
      }

      // Eyeshadow (feathered ellipse above upper eyelid — drawn before liner/lash)
      const shadowSel = this.selectedRegions.eyeshadow || this.selectedRegions.left_eyeshadow || this.selectedRegions.right_eyeshadow;
      if (shadowSel) {
        this.drawEyeshadow(ctx, landmarks, shadowSel, t);
      }

      // Eyeliner (SVG overlay — sits above eyeshadow, below eyelash)
      const eyelinerColor = this.selectedRegions.eyeliner;
      if (eyelinerColor) {
        const leftImg  = this._getSvgImage('eyeliner', 'left',  eyelinerColor);
        const rightImg = this._getSvgImage('eyeliner', 'right', eyelinerColor);
        if (leftImg)  this.drawEyeSvgOverlay(ctx, landmarks, leftImg,  EYE_LANDMARKS.left.outer,  EYE_LANDMARKS.left.inner,  EYE_LANDMARKS.left.midUpperLid,  SVG_OVERLAY_CFG.eyeliner, t);
        if (rightImg) this.drawEyeSvgOverlay(ctx, landmarks, rightImg, EYE_LANDMARKS.right.outer, EYE_LANDMARKS.right.inner, EYE_LANDMARKS.right.midUpperLid, SVG_OVERLAY_CFG.eyeliner, t);
      }

      // Eyelash (SVG overlay — topmost eye layer)
      const eyelashColor = this.selectedRegions.eyelash;
      if (eyelashColor) {
        const leftImg  = this._getSvgImage('eyelash', 'left',  eyelashColor);
        const rightImg = this._getSvgImage('eyelash', 'right', eyelashColor);
        if (leftImg)  this.drawEyeSvgOverlay(ctx, landmarks, leftImg,  EYE_LANDMARKS.left.outer,  EYE_LANDMARKS.left.inner,  EYE_LANDMARKS.left.midUpperLid,  SVG_OVERLAY_CFG.eyelash, t);
        if (rightImg) this.drawEyeSvgOverlay(ctx, landmarks, rightImg, EYE_LANDMARKS.right.outer, EYE_LANDMARKS.right.inner, EYE_LANDMARKS.right.midUpperLid, SVG_OVERLAY_CFG.eyelash, t);
      }

      // Lips (with mouth-hole compositing)
      const lipsSel = this.selectedRegions.lips || this.selectedRegions.upper_lip || this.selectedRegions.lower_lip;
      if (lipsSel) {
        this.drawLips(ctx, landmarks, lipsSel, t);
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
     */
    drawFoundation: function (ctx, landmarks, color, t) {
      const indices = REGION_POLYGONS.face_oval;
      if (!indices || indices.length < 3) return;

      const srcW  = (t && t.srcW) || 0;
      const srcH  = (t && t.srcH) || 0;
      const scale = (t && t.scale) || 1;
      const dx    = (t && t.dx)   || 0;
      const dy    = (t && t.dy)   || 0;

      // Convert to canvas pixel coords
      const pts = indices.map(function (i) {
        const lm = landmarks[i];
        return { x: (lm.x * srcW * scale) + dx,
                 y: (lm.y * srcH * scale) + dy };
      });

      // Bounding box of the tracked oval
      let minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < pts.length; i++) {
        if (pts[i].y < minY) minY = pts[i].y;
        if (pts[i].y > maxY) maxY = pts[i].y;
      }
      const faceH   = maxY - minY;
      const midY    = (minY + maxY) / 2;

      // How far above the tracked forehead to push the oval.
      // 0.22 ≈ 22 % of face height — enough to reach the hairline on most faces.
      // Increase toward 0.30 for taller foreheads; decrease toward 0.12 for smaller.
      const HAIRLINE_EXTEND = 0.22;

      // Extend only the upper half; leave lower half (jaw/chin) untouched
      const extended = pts.map(function (p) {
        if (p.y >= midY) return p;                       // lower half — no change
        const relPos = (midY - p.y) / (midY - minY);    // 0 at midY, 1 at topmost point
        return { x: p.x, y: p.y - faceH * HAIRLINE_EXTEND * relPos };
      });

      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle   = color;
      ctx.beginPath();
      ctx.moveTo(extended[0].x, extended[0].y);
      for (let i = 1; i < extended.length; i++) {
        ctx.lineTo(extended[i].x, extended[i].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },

    /**
     * Draw feathered elliptical eyeshadow ABOVE each eye on the upper eyelid.
     *
     * Layout (per eye):
     *   Centre X  = horizontal midpoint between outer and inner eye corners,
     *               shifted 8 % of eye-width toward the outer corner (temples)
     *               so the shadow naturally tails outward.
     *   Centre Y  = the upper-lid peak (lidPeak landmark), shifted 20 % of the
     *               lid-to-brow distance upward — this places the centre just
     *               above the crease, NOT over the eyeball.
     *   Semi-W    = half eye-width × 1.25  (25 % wider than the eye opening on
     *               each side, giving the slight left/right extension requested).
     *   Semi-H    = lid-to-brow distance  × 0.60  (covers the full lid height).
     *
     * The ellipse is drawn with ctx.scale so a circular gradient becomes the
     * correct ellipse shape. Opacity fades from 0.55 at the centre to 0 at the
     * edge for a seamless, feathered finish.
     */
    drawEyeshadow: function (ctx, landmarks, color, t) {
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

      const col = (color && /^#[0-9a-fA-F]{6}$/.test(color)) ? color : '#c0a0c0';
      const r   = parseInt(col.slice(1, 3), 16);
      const g   = parseInt(col.slice(3, 5), 16);
      const b   = parseInt(col.slice(5, 7), 16);
      const rgba = function (a) {
        return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
      };

      const drawLid = function (refs) {
        const outer   = px(refs.outer);
        const inner   = px(refs.inner);
        const lidPeak = px(refs.lidPeak);
        const brow    = px(refs.browRef);

        // Horizontal geometry
        const eyeVec  = { x: inner.x - outer.x, y: inner.y - outer.y };
        const eyeLen  = Math.sqrt(eyeVec.x * eyeVec.x + eyeVec.y * eyeVec.y);
        if (eyeLen < 1) return;

        // Centre X: midpoint shifted 8 % of eye-width toward the outer corner
        const midX = (outer.x + inner.x) * 0.5 - eyeVec.x * 0.08;

        // Semi-width: 25 % wider than half eye-length on each side
        const semiW = (eyeLen * 0.5) * 1.25;

        // Vertical geometry (brow.y < lidPeak.y in canvas coords = above in image)
        const lidToBrow = lidPeak.y - brow.y;   // positive value
        if (lidToBrow < 1) return;

        // Centre Y: lid peak shifted 20 % of the lid-to-brow gap upward
        const cy = lidPeak.y - lidToBrow * 0.20;

        // Semi-height: 60 % of lid-to-brow distance
        const semiH = lidToBrow * 0.60;
        if (semiH < 1) return;

        // Draw the ellipse via canvas y-scale trick.
        // In the scaled coordinate system, y-coords must be divided by scaleY.
        const scaleY = semiH / semiW;
        const cys    = cy / scaleY;   // y in scaled space

        const grad = ctx.createRadialGradient(midX, cys, 0, midX, cys, semiW);
        grad.addColorStop(0,    rgba(0.55));
        grad.addColorStop(0.35, rgba(0.38));
        grad.addColorStop(0.65, rgba(0.18));
        grad.addColorStop(0.85, rgba(0.06));
        grad.addColorStop(1,    rgba(0));

        ctx.save();
        ctx.scale(1, scaleY);
        ctx.beginPath();
        ctx.arc(midX, cys, semiW, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      };

      drawLid(REGION_POLYGONS.left_eyeshadow);
      drawLid(REGION_POLYGONS.right_eyeshadow);
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
    drawBlush: function (ctx, landmarks, color, t) {
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

      // Left cheek (image left / user's right cheek):
      //   anchors = left_cheek_anchors, eye = landmarks 33 (outer) → 133 (inner)
      drawCheek(REGION_POLYGONS.left_cheek_anchors,  33, 133);

      // Right cheek (image right / user's left cheek):
      //   anchors = right_cheek_anchors, eye = landmarks 263 (outer) → 362 (inner)
      drawCheek(REGION_POLYGONS.right_cheek_anchors, 263, 362);
    },

    /**
     * Draw lips with mouth-hole compositing.
     */
    drawLips: function (ctx, landmarks, color, t) {
      const bufW = canvasEl.width;
      const bufH = canvasEl.height;
      const dpr  = window.devicePixelRatio || 1;
      const cssW = parseInt(canvasEl.style.width,  10) || Math.round(bufW / dpr);
      const cssH = parseInt(canvasEl.style.height, 10) || Math.round(bufH / dpr);

      // Off-screen canvas with the same physical pixel buffer as the main canvas
      const oc   = document.createElement('canvas');
      oc.width   = bufW;
      oc.height  = bufH;
      const octx = oc.getContext('2d');
      // Mirror the DPR transform so landmark coordinates map identically
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // 1. Fill the outer lip shape
      octx.fillStyle   = color;
      octx.globalAlpha = 0.70;
      this._tracePath(octx, landmarks, REGION_POLYGONS.lips_outer, t);
      octx.fill();

      // 2. Punch out the inner mouth opening so open-mouth gap is transparent
      octx.globalCompositeOperation = 'destination-out';
      octx.globalAlpha = 1.0;
      this._tracePath(octx, landmarks, REGION_POLYGONS.lips_inner, t);
      octx.fill();

      // 3. Composite the off-screen result onto the main canvas.
      //    ctx has a DPR transform so we draw in CSS pixel space (cssW × cssH).
      ctx.save();
      ctx.globalAlpha = 1.0;
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
    drawEyeSvgOverlay: function (ctx, landmarks, svgImg, outerIdx, innerIdx, midLidIdxs, cfg, t) {
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

      ctx.save();
      ctx.imageSmoothingEnabled  = true;
      ctx.imageSmoothingQuality  = 'high';
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
