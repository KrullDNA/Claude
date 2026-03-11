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
    // Outer contour — traces the FULL boundary of both lips together.
    // Path: left corner (61) → upper-lip outer edge (185…409) → right corner (291)
    //       → lower-lip outer edge (375…146) → back to left corner.
    // Previously this only used the lower-outer edge, so the upper lip was invisible.
    lips_outer: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409,
                 291, 375, 321, 405, 314, 17, 84, 181, 91, 146],
    // Inner mouth opening — the hole that forms when the mouth opens.
    // Subtracted (destination-out) so colour never appears inside the open mouth.
    // Upper inner: 78→191→80→81→82→13→312→311→310→415→308
    // Lower inner: 308→324→318→402→317→14→87→178→88→95→78
    lips_inner: [78, 191, 80, 81, 82, 13, 312, 311, 310, 415,
                 308, 324, 318, 402, 317, 14, 87, 178, 88, 95],

    // --- Eyebrows ---
    left_eyebrow:  [46, 53, 52, 65, 55, 107, 66, 105, 63, 70],
    right_eyebrow: [276, 283, 282, 295, 285, 336, 296, 334, 293, 300],

    // --- Eyeshadow (upper eyelid + crease area; NOT the eyeball) ---
    // The previous polygon largely traced the eye itself, which causes the fill to look like
    // "painted eyeballs". This region is a larger band from the upper lash line up towards
    // the eyebrow, forming a realistic eyeshadow area.
    //
    // Approach:
    //  - Lower boundary: upper eyelid / upper lash line arc
    //  - Upper boundary: eyebrow arc to close the shape
    //
    // NOTE: This is intentionally approximate and can be refined later.
    left_eyeshadow:  [
      // upper lash / lid arc (outer -> inner)
      33, 246, 161, 160, 159, 158, 157, 173, 133,
      // eyebrow (inner -> outer) to form upper boundary
      70, 63, 105, 66, 107, 55, 65, 52, 53, 46,
      // (closed automatically by the renderer)
    ],
    right_eyeshadow: [
      // upper lash / lid arc (outer -> inner)
      263, 466, 388, 387, 386, 385, 384, 398, 362,
      // eyebrow (inner -> outer)
      300, 293, 334, 296, 336, 285, 295, 282, 283, 276,
      // (closed automatically by the renderer)
    ],

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

  // ──────────────────────────────────────────────────────────────────────────
  // Eyelash SVG support
  //
  // We rasterise an SVG (tinted to the selected colour) to an ImageBitmap and
  // then "warp" it along the user's upper lid by drawing thin slices along the
  // eyelid curve. This approximates contour-following without a heavy mesh warp.
  //
  // If you have a final, preferred SVG: replace the path(s) in
  // EYELASH_SVG_RIGHT with your exact artwork.
  // ──────────────────────────────────────────────────────────────────────────
  const EYELASH_SVG_RIGHT = `
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="160" viewBox="0 0 512 160">
      <g fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">
        <path d="M40,110 C140,70 240,55 320,60 C400,65 455,80 472,92" />
        <path d="M90,98  L70,50" />
        <path d="M130,90 L118,38" />
        <path d="M170,84 L165,30" />
        <path d="M210,80 L215,28" />
        <path d="M250,78 L268,28" />
        <path d="M290,80 L320,34" />
        <path d="M330,84 L370,45" />
        <path d="M370,90 L418,60" />
        <path d="M410,98 L455,78" />
      </g>
    </svg>
  `.trim();

  const _eyelashCache = new Map(); // `${color}|${flip}` -> { bitmap, w, h }

  function _svgToEyelashBitmap(color, flipX) {
    const key = `${color || '#000'}|${flipX ? 1 : 0}`;
    if (_eyelashCache.has(key)) return Promise.resolve(_eyelashCache.get(key));

    // Tint via currentColor replacement.
    let svg = EYELASH_SVG_RIGHT.replace(/currentColor/g, (color || '#000'));

    // Optional flip for the left eye.
    if (flipX) {
      // Wrap in a group transform to mirror around the viewBox centre.
      svg = svg.replace(
        /<svg ([^>]+)viewBox="0 0 512 160">/,
        '<svg $1viewBox="0 0 512 160"><g transform="translate(512,0) scale(-1,1)">' 
      ).replace('</svg>', '</g></svg>');
    }

    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    return createImageBitmap(blob).then((bitmap) => {
      const obj = { bitmap, w: bitmap.width, h: bitmap.height };
      _eyelashCache.set(key, obj);
      return obj;
    }).catch((e) => {
      console.warn('[Apotheca AR] Failed to rasterise eyelash SVG', e);
      return null;
    });
  }

  function _catmullRomSpline(points, samplesPerSeg) {
    const out = [];
    const n = points.length;
    const s = Math.max(3, samplesPerSeg || 10);
    if (n < 2) return points.slice();

    for (let i = 0; i < n - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(n - 1, i + 2)];
      for (let t = 0; t < s; t++) {
        const u = t / s;
        const u2 = u * u;
        const u3 = u2 * u;
        const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * u + (2*p0.x - 5*p1.x + 4*p2.x - p3.x) * u2 + (-p0.x + 3*p1.x - 3*p2.x + p3.x) * u3);
        const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * u + (2*p0.y - 5*p1.y + 4*p2.y - p3.y) * u2 + (-p0.y + 3*p1.y - 3*p2.y + p3.y) * u3);
        out.push({ x, y });
      }
    }
    out.push(points[n - 1]);
    return out;
  }

  /**
   * REGION_TRIANGLES — precomputed flat triangle index lists for WebGL drawElements.
   *
   * Derivation methodology (Option A — precomputed, no per-frame triangulation):
   *   Each region boundary from REGION_POLYGONS is a closed polygon [v0, v1, … vN-1].
   *   A centroid-fan (ear-0) triangulation from the first vertex v0 produces N-2 triangles:
   *     [v0, v1, v2],  [v0, v2, v3],  …  [v0, v(N-2), v(N-1)]
   *   This is O(N) and computed at author-time — never at runtime.
   *
   *   Lips are split into lips_outer (filled region) and lips_inner (mouth-opening hole).
   *   The hole is punched out via the WebGL stencil buffer in MakeupWebGL.drawLipsGL():
   *     1. Write outer triangles to stencil (→ 1 everywhere outer covers)
   *     2. Write inner triangles to stencil (→ 2 where mouth opening covers)
   *     3. Colour pass: draw outer triangles only where stencil == 1 (not inside mouth)
   *
   *   Triangle index ranges stay within the 468-landmark FaceMesh space (Uint16 safe).
   *   Every list is directly usable as a Uint16Array IBO with gl.TRIANGLES.
   */
  const REGION_TRIANGLES = {

    // --- Lips outer (20 boundary verts → 18 triangles) ---
    // Fan from 61 (left mouth corner) across the full two-lip outer contour.
    // Covers: upper-lip outer edge (185 40 39 37 0 267 269 270 409)
    //         right corner (291) + lower-lip outer edge (375 321 405 314 17 84 181 91 146)
    lips_outer: [
       61,185, 40,   61, 40, 39,   61, 39, 37,   61, 37,  0,
       61,  0,267,   61,267,269,   61,269,270,   61,270,409,
       61,409,291,   61,291,375,   61,375,321,   61,321,405,
       61,405,314,   61,314, 17,   61, 17, 84,   61, 84,181,
       61,181, 91,   61, 91,146,
    ],

    // --- Lips inner / mouth opening (20 boundary verts → 18 triangles) ---
    // Fan from 78 (left inner corner). Used as stencil mask only; never colour-filled.
    // Upper inner: 191 80 81 82 13 312 311 310 415 308
    // Lower inner: 324 318 402 317 14 87 178 88 95
    lips_inner: [
       78,191, 80,   78, 80, 81,   78, 81, 82,   78, 82, 13,
       78, 13,312,   78,312,311,   78,311,310,   78,310,415,
       78,415,308,   78,308,324,   78,324,318,   78,318,402,
       78,402,317,   78,317, 14,   78, 14, 87,   78, 87,178,
       78,178, 88,   78, 88, 95,
    ],

    // --- Left eyebrow (10 boundary verts → 8 triangles) ---
    // Fan from 46 across: 53 52 65 55 107 66 105 63 70
    left_brow: [
       46, 53, 52,   46, 52, 65,   46, 65, 55,   46, 55,107,
       46,107, 66,   46, 66,105,   46,105, 63,   46, 63, 70,
    ],

    // --- Right eyebrow (10 boundary verts → 8 triangles) ---
    // Fan from 276 across: 283 282 295 285 336 296 334 293 300
    right_brow: [
      276,283,282,  276,282,295,  276,295,285,  276,285,336,
      276,336,296,  276,296,334,  276,334,293,  276,293,300,
    ],

    // --- Left eyeshadow (upper lid + crease band; 19 boundary verts → 17 triangles) ---
    // Fan from 33 (outer eye corner) around the upper lash line, then up and
    // around the eyebrow to close the eyeshadow area.
    left_eyeshadow: [
      33,246,161,  33,161,160,  33,160,159,  33,159,158,
      33,158,157,  33,157,173,  33,173,133,  33,133, 70,
      33, 70, 63,  33, 63,105,  33,105, 66,  33, 66,107,
      33,107, 55,  33, 55, 65,  33, 65, 52,  33, 52, 53,
      33, 53, 46,
    ],

    // --- Right eyeshadow (upper lid + crease band; 19 boundary verts → 17 triangles) ---
    // Fan from 263 (outer eye corner) mirroring the left side.
    right_eyeshadow: [
      263,466,388,  263,388,387,  263,387,386,  263,386,385,
      263,385,384,  263,384,398,  263,398,362,  263,362,300,
      263,300,293,  263,293,334,  263,334,296,  263,296,336,
      263,336,285,  263,285,295,  263,295,282,  263,282,283,
      263,283,276,
    ],
  };

  /* ─────────────────────────────────────────────────────────────────────────
   * MakeupWebGL — WebGL makeup overlay renderer
   *
   * Creates a transparent WebGL canvas positioned directly over the main
   * 2D camera canvas (z-index above it, pointer-events: none).  Each frame:
   *   1. clear()                — wipe the overlay
   *   2. updateLandmarks(lm,t)  — upload 468 vertex positions to the GPU VBO
   *   3. drawRegion / drawLipsGL — one drawElements call per active region
   *
   * Falls back gracefully (ready === false) if WebGL is unavailable;
   * the existing Canvas 2D path then handles all rendering.
   * ───────────────────────────────────────────────────────────────────────── */
  const MakeupWebGL = (function () {
    'use strict';

    // ── Vertex shader ──────────────────────────────────────────────────────
    // Receives 2-D canvas pixel coordinates and converts to WebGL clip space.
    // Y is negated because canvas Y increases downward, GL Y increases upward.
    const VERT_SRC = [
      'attribute vec2 a_pos;',
      'uniform vec2 u_res;',
      'void main(){',
      '  vec2 c=(a_pos/u_res)*2.0-1.0;',
      '  gl_Position=vec4(c.x,-c.y,0.0,1.0);',
      '}',
    ].join('\n');

    // ── Fragment shader ────────────────────────────────────────────────────
    // Uniforms:
    //   u_color     vec3  RGB in [0,1]
    //   u_intensity float  Overall opacity/strength [0,1]
    //   u_feather   float  Edge-softness scale [0,1].
    //               Currently scales final alpha; a signed-distance-field
    //               approach can be dropped in here when per-vertex UVs are added.
    const FRAG_SRC = [
      'precision mediump float;',
      'uniform vec3  u_color;',
      'uniform float u_intensity;',
      'uniform float u_feather;',
      'void main(){',
      '  float a=u_intensity*(1.0-u_feather*0.35);',
      '  gl_FragColor=vec4(u_color,clamp(a,0.0,1.0));',
      '}',
    ].join('\n');

    // ── Private state ──────────────────────────────────────────────────────
    let gl       = null;
    let prog     = null;
    let locs     = {};
    let vbo      = null;   // DYNAMIC_DRAW VBO — 468 landmarks × 2 floats, updated per frame
    let ibos     = {};     // { key: { buf: WebGLBuffer, count: number } }
    let overlayEl = null;

    // ── Helpers ────────────────────────────────────────────────────────────
    function compile(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn('[Apotheca AR GL] Shader error:', gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
      }
      return s;
    }

    function buildProgram() {
      const vs = compile(gl.VERTEX_SHADER,   VERT_SRC);
      const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
      if (!vs || !fs) return null;
      const p = gl.createProgram();
      gl.attachShader(p, vs);
      gl.attachShader(p, fs);
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.warn('[Apotheca AR GL] Link error:', gl.getProgramInfoLog(p));
        return null;
      }
      return p;
    }

    // Parse any CSS colour string (#rrggbb, #rgb, rgb()) → [r,g,b] in 0..1
    function toRGB(color) {
      if (!color || color === 'none') return [1, 0, 0];
      let hex = color.trim();
      if (hex.charAt(0) === '#') {
        hex = hex.slice(1);
        if (hex.length === 3) { hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2]; }
        const n = parseInt(hex, 16);
        return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
      }
      const m = hex.match(/rgb\(\s*(\d+),\s*(\d+),\s*(\d+)/i);
      if (m) return [+m[1]/255, +m[2]/255, +m[3]/255];
      return [1, 0, 0];
    }

    // Upload vertex positions from current landmark frame into the VBO
    function uploadVerts(landmarks, t) {
      const srcW = t.srcW, srcH = t.srcH, scale = t.scale, dx = t.dx, dy = t.dy;

      // IMPORTANT (retina / DPR fix):
      // The 2D canvas is drawn in CSS pixels (ctx2d setTransform(dpr,...)), but
      // the WebGL overlay canvas uses the *backing buffer* pixel dimensions
      // (mainCanvas.width/height), which are scaled by DPR.
      //
      // Landmarks are converted to coordinates in the same CSS pixel space used
      // for drawImage() (w/h, dx/dy are CSS px). Therefore we must scale the
      // vertex coordinates into overlay backing-buffer pixels so they line up.
      const cssW = (t && t.w) ? t.w : (overlayEl ? overlayEl.width : 1);
      const cssH = (t && t.h) ? t.h : (overlayEl ? overlayEl.height : 1);
      const pxScaleX = overlayEl ? (overlayEl.width  / (cssW || 1)) : 1;
      const pxScaleY = overlayEl ? (overlayEl.height / (cssH || 1)) : 1;

      const verts = new Float32Array(468 * 2);
      for (let i = 0; i < 468; i++) {
        const lm = landmarks[i];
        if (!lm) continue;
        const xCss = (lm.x * srcW * scale) + dx;
        const yCss = (lm.y * srcH * scale) + dy;
        verts[i * 2]     = xCss * pxScaleX;
        verts[i * 2 + 1] = yCss * pxScaleY;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts);
    }

    // Bind VBO + set attrib pointer (called before every draw)
    function bindVBO() {
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.enableVertexAttribArray(locs.a_pos);
      gl.vertexAttribPointer(locs.a_pos, 2, gl.FLOAT, false, 0, 0);
    }

    // ── Public API ─────────────────────────────────────────────────────────
    return {
      ready: false,

      /**
       * Initialise the WebGL overlay canvas and compile all shaders / IBOs.
       * Call once when the modal first opens (after canvasEl is known).
       *
       * @param {HTMLCanvasElement} mainCanvas  The existing 2D camera canvas
       * @returns {boolean}  true if WebGL is available
       */
      init: function (mainCanvas) {
        // Create overlay canvas, insert immediately after the 2D canvas
        overlayEl = document.createElement('canvas');
        overlayEl.id = 'apotheca-ar-makeup-overlay';
        overlayEl.style.cssText =
          'position:absolute;top:0;left:0;width:100%;height:100%;' +
          'pointer-events:none;z-index:2;';
        mainCanvas.parentNode.insertBefore(overlayEl, mainCanvas.nextSibling);
        overlayEl.width  = mainCanvas.width;
        overlayEl.height = mainCanvas.height;

        // Request WebGL with alpha + stencil (stencil needed for lips cutout)
        gl = overlayEl.getContext('webgl', {
          alpha: true, premultipliedAlpha: false, stencil: true
        });
        if (!gl) {
          console.warn('[Apotheca AR GL] WebGL unavailable — using Canvas 2D fallback');
          overlayEl.remove();
          overlayEl = null;
          return false;
        }

        // Compile shaders
        prog = buildProgram();
        if (!prog) {
          overlayEl.remove();
          overlayEl = null;
          return false;
        }

        // Cache uniform / attribute locations
        locs.a_pos       = gl.getAttribLocation( prog, 'a_pos');
        locs.u_res       = gl.getUniformLocation(prog, 'u_res');
        locs.u_color     = gl.getUniformLocation(prog, 'u_color');
        locs.u_intensity = gl.getUniformLocation(prog, 'u_intensity');
        locs.u_feather   = gl.getUniformLocation(prog, 'u_feather');

        // VBO — 468 landmarks × 2 floats (x,y in canvas pixels), updated per frame
        vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, 468 * 2 * 4, gl.DYNAMIC_DRAW);

        // Build one IBO per REGION_TRIANGLES entry
        ibos = {};
        Object.keys(REGION_TRIANGLES).forEach(function (key) {
          const data = new Uint16Array(REGION_TRIANGLES[key]);
          const buf  = gl.createBuffer();
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf);
          gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);
          ibos[key] = { buf: buf, count: data.length };
        });

        // Blending — standard over compositing, src-alpha / one-minus-src-alpha
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        this.ready = true;
        return true;
      },

      /**
       * Match the overlay canvas dimensions to the (possibly resized) main canvas.
       * Call from the same sizeCanvasToWrapper path that resizes the 2D canvas.
       *
       * @param {HTMLCanvasElement} mainCanvas
       */
      resize: function (mainCanvas) {
        if (!overlayEl) return;
        overlayEl.width  = mainCanvas.width;
        overlayEl.height = mainCanvas.height;
        overlayEl.style.width  = mainCanvas.style.width;
        overlayEl.style.height = mainCanvas.style.height;
      },

      /**
       * Clear the overlay every frame before drawing new overlays.
       */
      clear: function () {
        if (!gl) return;
        gl.viewport(0, 0, overlayEl.width, overlayEl.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
      },

      /**
       * Upload this frame's landmark positions to the GPU.
       * Must be called once per frame before any drawRegion / drawLipsGL calls.
       *
       * @param {Array}  landmarks  MediaPipe multiFaceLandmarks[0]
       * @param {Object} t          Render transform { srcW, srcH, scale, dx, dy }
       */
      updateLandmarks: function (landmarks, t) {
        if (!gl || !landmarks) return;
        uploadVerts(landmarks, t);
      },

      /**
       * Draw a single region using gl.drawElements (TRIANGLES).
       * The IBO for `iboKey` must exist in REGION_TRIANGLES.
       *
       * @param {string} iboKey     Key in REGION_TRIANGLES (e.g. 'left_brow')
       * @param {string} colorHex   CSS colour string
       * @param {number} intensity  Alpha multiplier [0,1]
       * @param {number} feather    Edge-softness [0,1] — scales fragment alpha
       */
      drawRegion: function (iboKey, colorHex, intensity, feather) {
        if (!gl || !ibos[iboKey]) return;
        const rgb = toRGB(colorHex);

        gl.useProgram(prog);
        gl.uniform2f(locs.u_res,       overlayEl.width, overlayEl.height);
        gl.uniform3f(locs.u_color,     rgb[0], rgb[1], rgb[2]);
        gl.uniform1f(locs.u_intensity, intensity != null ? intensity : 0.5);
        gl.uniform1f(locs.u_feather,   feather   != null ? feather   : 0.0);

        bindVBO();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibos[iboKey].buf);
        gl.drawElements(gl.TRIANGLES, ibos[iboKey].count, gl.UNSIGNED_SHORT, 0);
      },

      /**
       * Draw lips with stencil-buffer mouth cutout so colour never fills an open mouth.
       *
       * Algorithm (3 passes):
       *   Pass 1 — stencil write, no colour:
       *     Draw lips_outer triangles  → stencil becomes 1 in outer-lip region
       *     Draw lips_inner triangles  → stencil increments to 2 in mouth-opening region
       *   Pass 2 — colour draw:
       *     stencilFunc EQUAL 1 — passes only where stencil == 1 (lip flesh, not interior)
       *     Draw lips_outer triangles with colour + intensity + feather uniforms
       *   Pass 3 — restore GL state
       *
       * @param {string} colorHex
       * @param {number} intensity  Default 0.65
       * @param {number} feather    Default 0.0
       */
      drawLipsGL: function (colorHex, intensity, feather) {
        if (!gl || !ibos.lips_outer || !ibos.lips_inner) return;
        const rgb = toRGB(colorHex);

        gl.enable(gl.STENCIL_TEST);
        gl.useProgram(prog);
        gl.uniform2f(locs.u_res, overlayEl.width, overlayEl.height);
        bindVBO();

        // ── Pass 1: build stencil — no colour output ──
        gl.colorMask(false, false, false, false);
        gl.stencilFunc(gl.ALWAYS, 0, 0xFF);

        // Outer lip → stencil = 1
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibos.lips_outer.buf);
        gl.drawElements(gl.TRIANGLES, ibos.lips_outer.count, gl.UNSIGNED_SHORT, 0);

        // Inner mouth → stencil = 2 where mouth opening overlaps
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibos.lips_inner.buf);
        gl.drawElements(gl.TRIANGLES, ibos.lips_inner.count, gl.UNSIGNED_SHORT, 0);

        // ── Pass 2: colour — only where stencil == 1 (lip, not mouth hole) ──
        gl.colorMask(true, true, true, true);
        gl.stencilFunc(gl.EQUAL, 1, 0xFF);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

        gl.uniform3f(locs.u_color,     rgb[0], rgb[1], rgb[2]);
        gl.uniform1f(locs.u_intensity, intensity != null ? intensity : 0.65);
        gl.uniform1f(locs.u_feather,   feather   != null ? feather   : 0.0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibos.lips_outer.buf);
        gl.drawElements(gl.TRIANGLES, ibos.lips_outer.count, gl.UNSIGNED_SHORT, 0);

        // ── Pass 3: restore state ──
        gl.disable(gl.STENCIL_TEST);
        gl.clear(gl.STENCIL_BUFFER_BIT);
      },

      /** Remove the overlay canvas and reset state (call on plugin teardown). */
      destroy: function () {
        if (overlayEl) { overlayEl.remove(); overlayEl = null; }
        gl = null;
        this.ready = false;
      },
    };
  })();

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

      // Initialise the WebGL makeup overlay (once per page load).
      // MakeupWebGL creates a transparent canvas layered above canvasEl.
      if (!MakeupWebGL.ready) {
        MakeupWebGL.init(canvasEl);
      }
      MakeupWebGL.clear();

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

      MakeupWebGL.clear();   // wipe makeup overlay immediately on close
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

          // Keep the WebGL overlay in sync with the 2D canvas dimensions
          MakeupWebGL.resize(canvasEl);

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
      const gl = MakeupWebGL.ready;

      // ── WebGL path: lips / eyebrows / eyeshadow ───────────────────────
      // These regions have precomputed triangle IBOs in REGION_TRIANGLES.
      // Each is a single gl.drawElements call with colour, intensity, feather uniforms.
      // When WebGL is unavailable the Canvas 2D fallback below is used instead.
      if (gl) {
        MakeupWebGL.clear();
        MakeupWebGL.updateLandmarks(landmarks, t);

        // Lips — stencil-buffer mouth cutout keeps colour off the open-mouth interior
        if (this.selectedRegions.lips) {
          MakeupWebGL.drawLipsGL(this.selectedRegions.lips, 0.65, 0.0);
        }

        // Eyebrows — left and right as separate drawElements calls
        if (this.selectedRegions.eyebrows) {
          MakeupWebGL.drawRegion('left_brow',  this.selectedRegions.eyebrows, 0.55, 0.0);
          MakeupWebGL.drawRegion('right_brow', this.selectedRegions.eyebrows, 0.55, 0.0);
        }

        // Eyeshadow — upper eyelid area, soft blend
        if (this.selectedRegions.eyeshadow) {
          MakeupWebGL.drawRegion('left_eyeshadow',  this.selectedRegions.eyeshadow, 0.28, 0.15);
          MakeupWebGL.drawRegion('right_eyeshadow', this.selectedRegions.eyeshadow, 0.28, 0.15);
        }
      } else {
        // Canvas 2D fallback for lips / eyebrows / eyeshadow
        if (this.selectedRegions.lips) {
          this.drawLips(ctx, landmarks, this.selectedRegions.lips, t);
        }
        if (this.selectedRegions.eyebrows) {
          this.drawRegionPolygon(ctx, landmarks, REGION_POLYGONS.left_eyebrow,  this.selectedRegions.eyebrows, 0.55, t);
          this.drawRegionPolygon(ctx, landmarks, REGION_POLYGONS.right_eyebrow, this.selectedRegions.eyebrows, 0.55, t);
        }
        if (this.selectedRegions.eyeshadow) {
          this.drawRegionPolygon(ctx, landmarks, REGION_POLYGONS.left_eyeshadow,  this.selectedRegions.eyeshadow, 0.28, t);
          this.drawRegionPolygon(ctx, landmarks, REGION_POLYGONS.right_eyeshadow, this.selectedRegions.eyeshadow, 0.28, t);
        }
      }

      // ── Canvas 2D path: remaining regions (no triangle mesh yet) ─────
      // Eyeliner (thin stroke along the upper lash line)
      if (this.selectedRegions.eyeliner) {
        // Add a subtle wing/curl at the outer corner for a more realistic AR look.
        this.drawEyeLine(ctx, landmarks, REGION_POLYGONS.left_eyeliner,  this.selectedRegions.eyeliner, 2.4, 0.95, t, { wing: true, side: 'left'  });
        this.drawEyeLine(ctx, landmarks, REGION_POLYGONS.right_eyeliner, this.selectedRegions.eyeliner, 2.4, 0.95, t, { wing: true, side: 'right' });
      }

      // Eyelash (slightly thicker stroke at the lash edge)
      if (this.selectedRegions.eyelash) {
        // Render mascara by warping a tinted eyelash SVG along the upper lid.
        this.drawEyelashSVG(ctx, landmarks, REGION_POLYGONS.left_eyelash,  this.selectedRegions.eyelash, 0.98, t, { side: 'left'  });
        this.drawEyelashSVG(ctx, landmarks, REGION_POLYGONS.right_eyelash, this.selectedRegions.eyelash, 0.98, t, { side: 'right' });
      }

      // Blush (sheer wash over the cheeks)
      if (this.selectedRegions.blush) {
        // Use a soft radial gradient centred on each cheek for a more natural blush.
        this.drawBlush(ctx, landmarks, this.selectedRegions.blush, 0.45, t);
      }

      // Concealer (very sheer tint under the eye)
      if (this.selectedRegions.concealer) {
        this.drawRegionPolygon(ctx, landmarks, REGION_POLYGONS.left_concealer,  this.selectedRegions.concealer, 0.20, t);
        this.drawRegionPolygon(ctx, landmarks, REGION_POLYGONS.right_concealer, this.selectedRegions.concealer, 0.20, t);
      }

      // Foundation (sheer tint, extrapolated to hairline)
      if (this.selectedRegions.foundation) {
        this.drawFoundation(ctx, landmarks, this.selectedRegions.foundation, t);
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
     * MediaPipe's face_oval only tracks to the mid/upper forehead skin; it has no
     * hairline landmarks. This method takes the face oval, converts it to pixel
     * coordinates, then extrapolates the upper-half points further upward so the
     * tint reaches the actual hairline rather than stopping at the tracked boundary.
     *
     * The extrapolation is proportional: points at the very top of the oval move up
     * by HAIRLINE_EXTEND × faceHeight, points exactly at the vertical centre move
     * by 0. The bottom half is untouched so the jaw/chin edge stays accurate.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {Array}  landmarks  MediaPipe normalised landmark array
     * @param {string} color      CSS colour
     * @param {Object} t          Render transform { srcW, srcH, scale, dx, dy }
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
    drawEyeLine: function (ctx, landmarks, indices, color, lineWidthPx, alpha, t, opts) {
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

      // Convert all points first so we can optionally add a wing/curl.
      const pts = [];
      for (let i = 0; i < indices.length; i++) {
        const p = landmarks[indices[i]];
        pts.push({
          x: (p.x * srcW * scale) + dx,
          y: (p.y * srcH * scale) + dy,
        });
      }

      // Smooth polyline to reduce sharp angles.
      const smooth = _catmullRomSpline(pts, 10);

      ctx.beginPath();
      ctx.moveTo(smooth[0].x, smooth[0].y);
      for (let i = 1; i < smooth.length; i++) {
        ctx.lineTo(smooth[i].x, smooth[i].y);
      }

      // Optional outer-corner wing/curl (eyeliner).
      if (opts && opts.wing && pts.length >= 3) {
        const side = (opts.side === 'right') ? 'right' : 'left';
        const pN1 = pts[pts.length - 2];
        const pN  = pts[pts.length - 1];

        // Tangent at the outer corner.
        let vx = pN.x - pN1.x;
        let vy = pN.y - pN1.y;
        const len = Math.max(1, Math.hypot(vx, vy));
        vx /= len; vy /= len;

        // Force an "outward" x-direction so the curl doesn't flip to the wrong side.
        const outwardSign = (side === 'left') ? -1 : 1;
        const tx = outwardSign * Math.abs(vx);
        const ty = vy;

        // Normal used to lift the wing slightly upwards.
        const nx = -ty;
        const ny = tx;

        // Wing length scales with eye width.
        const eyeW = Math.max(1, Math.hypot(pts[0].x - pN.x, pts[0].y - pN.y));
        const wingLen = eyeW * 0.22;

        const cpx = pN.x + (tx * wingLen * 0.35) + (nx * wingLen * 0.35);
        const cpy = pN.y + (ty * wingLen * 0.35) + (ny * wingLen * 0.35);
        const tipx = pN.x + (tx * wingLen * 0.90) + (nx * wingLen * 0.12);
        const tipy = pN.y + (ty * wingLen * 0.90) + (ny * wingLen * 0.12);

        ctx.quadraticCurveTo(cpx, cpy, tipx, tipy);
      }

      ctx.stroke();
      ctx.restore();
    },

    /**
     * Draw eyelashes by warping a tinted SVG along the upper lid curve.
     *
     * We rasterise the SVG to an ImageBitmap and then draw thin slices of the
     * bitmap along the eyelid spline with local rotation. This gives a much
     * more "mascara" look than line strokes, without a heavy mesh warp.
     */
    drawEyelashSVG: function (ctx, landmarks, indices, color, alpha, t, opts) {
      if (!indices || indices.length < 6) return;
      const side = (opts && opts.side === 'right') ? 'right' : 'left';
      const flipX = (side === 'left');

      // Lazy-load bitmap (first frame may not render lashes until cached).
      const key = `${color || '#000'}|${flipX ? 1 : 0}`;
      if (!_eyelashCache.has(key)) {
        _svgToEyelashBitmap(color || '#000', flipX).then(() => {});
        // Fallback: draw simple lashes while the SVG bitmap loads.
        this.drawMascaraLashes(ctx, landmarks, indices, color, alpha, t);
        return;
      }
      const bmpObj = _eyelashCache.get(key);
      if (!bmpObj || !bmpObj.bitmap) return;

      const srcW  = (t && t.srcW) || 0;
      const srcH  = (t && t.srcH) || 0;
      const scale = (t && t.scale) || 1;
      const dx    = (t && t.dx)   || 0;
      const dy    = (t && t.dy)   || 0;

      // Build eyelid points in canvas space.
      const pts = [];
      for (let i = 0; i < indices.length; i++) {
        const p = landmarks[indices[i]];
        pts.push({
          x: (p.x * srcW * scale) + dx,
          y: (p.y * srcH * scale) + dy,
        });
      }
      const lid = _catmullRomSpline(pts, 12);
      if (lid.length < 8) return;

      // Estimate eye width + a normal direction (roughly "up" from the lid).
      const pA = lid[0];
      const pB = lid[lid.length - 1];
      const eyeW = Math.max(6, Math.hypot(pB.x - pA.x, pB.y - pA.y));
      const lashH = eyeW * 0.18; // lash height proportional to eye width.

      // Precompute cumulative arc-length for stable slicing.
      const arc = [0];
      for (let i = 1; i < lid.length; i++) {
        arc[i] = arc[i - 1] + Math.hypot(lid[i].x - lid[i - 1].x, lid[i].y - lid[i - 1].y);
      }
      const totalLen = Math.max(1, arc[arc.length - 1]);

      // Number of slices along the lid.
      const slices = Math.max(18, Math.min(44, Math.round(eyeW / 6)));

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha || 1));

      for (let s = 0; s < slices; s++) {
        const u0 = s / slices;
        const u1 = (s + 1) / slices;

        const d0 = u0 * totalLen;
        const d1 = u1 * totalLen;

        // Find indices on the spline for d0 and d1.
        let i0 = 0;
        while (i0 < arc.length - 1 && arc[i0] < d0) i0++;
        let i1 = i0;
        while (i1 < arc.length - 1 && arc[i1] < d1) i1++;

        const p0 = lid[Math.max(0, Math.min(lid.length - 1, i0))];
        const p1 = lid[Math.max(0, Math.min(lid.length - 1, i1))];

        const cx = (p0.x + p1.x) * 0.5;
        const cy = (p0.y + p1.y) * 0.5;

        const vx = p1.x - p0.x;
        const vy = p1.y - p0.y;
        const segLen = Math.max(1, Math.hypot(vx, vy));
        const ang = Math.atan2(vy, vx);

        // Normal (rotate tangent -90deg) — lift lashes "up" from lid.
        const nx = -vy / segLen;
        const ny =  vx / segLen;

        // Lift amount and thickness.
        const lift = lashH * 0.35;
        const w = segLen;
        const h = lashH;

        // Source slice in the bitmap.
        const sx = Math.floor(u0 * bmpObj.w);
        const sw = Math.max(1, Math.floor((u1 - u0) * bmpObj.w));

        ctx.save();
        ctx.translate(cx + nx * lift, cy + ny * lift);
        ctx.rotate(ang);

        // Draw slice centred on origin; negative y places lashes above lid.
        ctx.drawImage(bmpObj.bitmap, sx, 0, sw, bmpObj.h, -w * 0.5, -h, w, h);
        ctx.restore();
      }

      ctx.restore();
    },

    /**
     * Draw mascara-like lashes along an upper lash-line arc.
     * This is a lightweight approximation: short tapered strokes projected
     * outward from the lash-line based on the eye centre.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {Array}  landmarks
     * @param {Array}  indices  Upper lash-line indices
     * @param {string} color
     * @param {number} alpha
     * @param {Object} t
     */
    drawMascaraLashes: function (ctx, landmarks, indices, color, alpha, t) {
      if (!indices || indices.length < 4) return;

      const srcW  = (t && t.srcW) || 0;
      const srcH  = (t && t.srcH) || 0;
      const scale = (t && t.scale) || 1;
      const dx    = (t && t.dx)   || 0;
      const dy    = (t && t.dy)   || 0;

      // Convert points.
      const pts = indices.map((idx) => {
        const p = landmarks[idx];
        return { x: (p.x * srcW * scale) + dx, y: (p.y * srcH * scale) + dy };
      });

      // Eye centre (average of the arc points).
      let cx = 0, cy = 0;
      for (let i = 0; i < pts.length; i++) { cx += pts[i].x; cy += pts[i].y; }
      cx /= pts.length; cy /= pts.length;

      // Eye width for scaling.
      const eyeW = Math.max(1, Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y));
      const baseLen = eyeW * 0.10;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha || 0.9));
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Draw strokes at every 2nd point to keep it light.
      for (let i = 1; i < pts.length - 1; i += 2) {
        const p = pts[i];
        // Outward direction from centre.
        let vx = p.x - cx;
        let vy = p.y - cy;
        const vlen = Math.max(1, Math.hypot(vx, vy));
        vx /= vlen; vy /= vlen;

        // Slight randomness in length for realism (deterministic by index).
        const jitter = 0.75 + ((i % 5) * 0.06);
        const len = baseLen * jitter;

        // Taper: thicker at base, thinner at tip (simulate with 2 strokes).
        const tipx = p.x + vx * len;
        const tipy = p.y + vy * len;
        ctx.lineWidth = Math.max(1.2, eyeW * 0.012);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(tipx, tipy);
        ctx.stroke();
      }

      // Also draw a subtle lash-line darkening (thin line) to connect lashes.
      ctx.lineWidth = Math.max(1.2, eyeW * 0.010);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();

      ctx.restore();
    },

    /**
     * Draw blush as two soft radial gradients (one per cheek).
     * Avoids hard-edged polygon artefacts and looks closer to real blush.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {Array}  landmarks
     * @param {string} color
     * @param {number} alpha
     * @param {Object} t
     */
    drawBlush: function (ctx, landmarks, color, alpha, t) {
      const srcW  = (t && t.srcW) || 0;
      const srcH  = (t && t.srcH) || 0;
      const scale = (t && t.scale) || 1;
      const dx    = (t && t.dx)   || 0;
      const dy    = (t && t.dy)   || 0;

      // Landmark centres (approx). These track well across faces.
      const L = landmarks[50]  || landmarks[116];
      const R = landmarks[280] || landmarks[345];
      const eyeL = landmarks[33];
      const eyeR = landmarks[263];
      if (!L || !R || !eyeL || !eyeR) return;

      const lx = (L.x * srcW * scale) + dx;
      const ly = (L.y * srcH * scale) + dy;
      const rx = (R.x * srcW * scale) + dx;
      const ry = (R.y * srcH * scale) + dy;

      const exL = (eyeL.x * srcW * scale) + dx;
      const eyL = (eyeL.y * srcH * scale) + dy;
      const exR = (eyeR.x * srcW * scale) + dx;
      const eyR = (eyeR.y * srcH * scale) + dy;

      // Radius derived from distance between cheek and outer eye corner.
      const rL = Math.max(18, Math.hypot(lx - exL, ly - eyL) * 0.70);
      const rR = Math.max(18, Math.hypot(rx - exR, ry - eyR) * 0.70);

      function rgbaFromCss(css, a) {
        // Basic #rgb/#rrggbb/rgb() parsing for gradient stops.
        let c = (css || '').trim();
        if (!c) return 'rgba(255,0,0,' + a + ')';
        if (c[0] === '#') {
          let h = c.slice(1);
          if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
          const n = parseInt(h, 16);
          const r = (n >> 16) & 255;
          const g = (n >> 8) & 255;
          const b = n & 255;
          return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
        }
        const m = c.match(/rgb\(\s*(\d+),\s*(\d+),\s*(\d+)/i);
        if (m) return 'rgba(' + (+m[1]) + ',' + (+m[2]) + ',' + (+m[3]) + ',' + a + ')';
        // Fallback: hope the browser can resolve named colours.
        return c;
      }

      function drawCheek(cx, cy, r) {
        const grad = ctx.createRadialGradient(cx, cy, r * 0.10, cx, cy, r);
        const a = Math.max(0, Math.min(1, alpha || 0.35));
        grad.addColorStop(0.0, rgbaFromCss(color, a));
        grad.addColorStop(1.0, rgbaFromCss(color, 0.0));

        ctx.save();
        ctx.globalAlpha = 1;
        ctx.fillStyle = grad;
        // Ellipse by scaling a circle.
        ctx.translate(cx, cy);
        ctx.scale(1.15, 0.85);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.closePath();

        // Feather by using a destination-in blur shadow.
        ctx.fill();
        ctx.restore();
      }

      // Blend blush gently over the base camera frame.
      ctx.save();
      ctx.globalCompositeOperation = 'soft-light';
      drawCheek(lx, ly, rL);
      drawCheek(rx, ry, rR);
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
