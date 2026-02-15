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
   * MediaPipe FaceMesh landmark index sets for each face region.
   * Indices reference the 468-point (+ iris refinement) mesh.
   * All values can be fine-tuned; these cover the correct anatomical areas.
   *
   * Supported regions (matches apotheca_ar_attribute_face_regions PHP enum):
   *   lips | eyebrows | eyelash | eyeshadow | eyeliner | blush | concealer | foundation
   */
  const REGION_POLYGONS = {

    // --- Lips ---
    // Outer contour — both upper and lower lip together (closed path)
    lips_outer: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308,
                 324, 318, 402, 317, 14, 87, 178, 88, 95, 78],
    // Inner mouth opening — subtracted so colour never fills the open mouth gap
    lips_inner: [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308,
                 324, 318, 402, 317, 14, 87, 178, 88, 95],

    // --- Eyebrows ---
    left_eyebrow:  [46, 53, 52, 65, 55, 107, 66, 105, 63, 70],
    right_eyebrow: [276, 283, 282, 295, 285, 336, 296, 334, 293, 300],

    // --- Eyeshadow (upper eyelid band from lash line upward) ---
    left_eyeshadow:  [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7],
    right_eyeshadow: [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249],

    // --- Eyeliner (tight strip at the upper lash line where lid meets lashes) ---
    // Rendered as a stroke, not a fill — see drawEyeLine()
    left_eyeliner:  [33, 246, 161, 160, 159, 158, 157, 173, 133, 155],
    right_eyeliner: [263, 466, 388, 387, 386, 385, 384, 398, 362, 382],

    // --- Eyelash (outermost upper lash-edge, slightly shorter arc) ---
    // Rendered as a slightly thicker stroke — see drawEyeLine()
    left_eyelash:  [33, 246, 161, 160, 159, 158, 157, 173, 133],
    right_eyelash: [263, 466, 388, 387, 386, 385, 384, 398, 362],

    // --- Blush (cheek area below the cheekbone, lateral to the nose) ---
    left_blush:  [116, 117, 118, 119, 120, 121, 128, 129, 209, 49,
                  187, 207, 206, 203, 142, 126, 100, 101, 50, 36],
    right_blush: [345, 346, 347, 348, 349, 350, 357, 358, 429, 279,
                  411, 427, 426, 423, 371, 355, 329, 330, 280, 266],

    // --- Concealer (under-eye hollow, below the lower eyelid) ---
    left_concealer:  [33, 7, 163, 144, 145, 153, 154, 155, 133,
                      130, 25, 110, 24, 23, 22, 26, 112, 243],
    right_concealer: [263, 249, 390, 373, 374, 380, 381, 382, 362,
                      359, 255, 339, 254, 253, 252, 256, 341, 463],

    // --- Foundation (full face oval, chin to hairline) ---
    face_oval: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
                397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
                172,  58, 132,  93, 234, 127, 162,  21,  54, 103,  67, 109],
  };

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
      // Lips — outer shape with inner mouth opening removed so colour stays
      // only on the lip surface (not inside an open mouth).
      if (this.selectedRegions.lips) {
        this.drawLips(ctx, landmarks, this.selectedRegions.lips, t);
      }

      // Eyebrows
      if (this.selectedRegions.eyebrows) {
        this.drawRegionPolygon(ctx, landmarks, REGION_POLYGONS.left_eyebrow,  this.selectedRegions.eyebrows, 0.55, t);
        this.drawRegionPolygon(ctx, landmarks, REGION_POLYGONS.right_eyebrow, this.selectedRegions.eyebrows, 0.55, t);
      }

      // Eyeshadow (soft blend over the upper eyelid)
      if (this.selectedRegions.eyeshadow) {
        this.drawRegionPolygon(ctx, landmarks, REGION_POLYGONS.left_eyeshadow,  this.selectedRegions.eyeshadow, 0.28, t);
        this.drawRegionPolygon(ctx, landmarks, REGION_POLYGONS.right_eyeshadow, this.selectedRegions.eyeshadow, 0.28, t);
      }

      // Eyeliner (thin stroked line along the upper lash line)
      if (this.selectedRegions.eyeliner) {
        this.drawEyeLine(ctx, landmarks, REGION_POLYGONS.left_eyeliner,  this.selectedRegions.eyeliner, 2, 0.85, t);
        this.drawEyeLine(ctx, landmarks, REGION_POLYGONS.right_eyeliner, this.selectedRegions.eyeliner, 2, 0.85, t);
      }

      // Eyelash (slightly thicker stroke at the outermost lash edge)
      if (this.selectedRegions.eyelash) {
        this.drawEyeLine(ctx, landmarks, REGION_POLYGONS.left_eyelash,  this.selectedRegions.eyelash, 3, 0.90, t);
        this.drawEyeLine(ctx, landmarks, REGION_POLYGONS.right_eyelash, this.selectedRegions.eyelash, 3, 0.90, t);
      }

      // Blush (sheer colour wash over the cheeks)
      if (this.selectedRegions.blush) {
        this.drawRegionPolygon(ctx, landmarks, REGION_POLYGONS.left_blush,  this.selectedRegions.blush, 0.18, t);
        this.drawRegionPolygon(ctx, landmarks, REGION_POLYGONS.right_blush, this.selectedRegions.blush, 0.18, t);
      }

      // Concealer (very sheer tint under the eye)
      if (this.selectedRegions.concealer) {
        this.drawRegionPolygon(ctx, landmarks, REGION_POLYGONS.left_concealer,  this.selectedRegions.concealer, 0.20, t);
        this.drawRegionPolygon(ctx, landmarks, REGION_POLYGONS.right_concealer, this.selectedRegions.concealer, 0.20, t);
      }

      // Foundation (sheer tint over the full face oval)
      if (this.selectedRegions.foundation) {
        this.drawRegionPolygon(ctx, landmarks, REGION_POLYGONS.face_oval, this.selectedRegions.foundation, 0.18, t);
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
     * Draw lips with mouth-hole compositing.
     *
     * The outer lip contour is filled on an off-screen canvas, then the inner
     * mouth-opening polygon is punched out (destination-out) before compositing
     * onto the main canvas. This ensures colour only appears on the lip surface
     * and never inside an open mouth.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {Array}  landmarks  MediaPipe normalised landmark array
     * @param {string} color      CSS colour
     * @param {Object} t          Render transform { srcW, srcH, scale, dx, dy }
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

    /**
     * Draw eyeliner or eyelash as a stroked open path along landmark indices.
     * Used instead of a filled polygon so the result is a thin, precise line.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {Array}  landmarks
     * @param {Array}  indices       Landmark index array (open path, not closed)
     * @param {string} color
     * @param {number} lineWidthPx   Stroke width in CSS pixels
     * @param {number} alpha
     * @param {Object} t             Render transform
     */
    drawEyeLine: function (ctx, landmarks, indices, color, lineWidthPx, alpha, t) {
      if (!indices || indices.length < 2) return;

      const srcW  = (t && t.srcW) || 0;
      const srcH  = (t && t.srcH) || 0;
      const scale = (t && t.scale) || 1;
      const dx    = (t && t.dx)   || 0;
      const dy    = (t && t.dy)   || 0;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha || 0.9));
      ctx.strokeStyle = color;
      ctx.lineWidth   = lineWidthPx || 2;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';

      ctx.beginPath();
      const first = landmarks[indices[0]];
      ctx.moveTo((first.x * srcW * scale) + dx, (first.y * srcH * scale) + dy);
      for (let i = 1; i < indices.length; i++) {
        const p = landmarks[indices[i]];
        ctx.lineTo((p.x * srcW * scale) + dx, (p.y * srcH * scale) + dy);
      }
      ctx.stroke();
      ctx.restore();
    },

    /**
     * Trace a closed landmark path without filling.
     * Used internally by drawLips() for compositing.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {Array}  landmarks
     * @param {Array}  indices
     * @param {Object} t  Render transform
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
     * Backwards-compatible API: previously updateMakeup('lipstick', color)
     * Now simply stores the region colour (drawing is done per-frame in onResults).
     */
    updateMakeup: function (region, color) {
      if (!region || region === 'none') return;
      this.selectedRegions[region] = color;
    }
  };

  // Init
  $(document).ready(function () {
    ApothecaAR.init();
    window.ApothecaAR = ApothecaAR;
  });
})(jQuery);
