/*
 * Apotheca AR WebGL Renderer (Face Mesh)
 * - Builds a stable triangle mesh from MediaPipe Face Mesh landmarks.
 * - Uses TRIANGULATION indices (from TensorFlow.js face-landmarks-detection demo triangulation.js; Apache 2.0).
 * - Per-frame updates vertex + UV buffers via bufferSubData (no realloc).
 * - Applies exponential moving average smoothing to reduce jitter.
 */
(function() {
  'use strict';

  // 468-landmark triangle index list (triplets). Max index 467 => Uint16Array OK.
  const TRIANGULATION = new Uint16Array([127,34,139,11,0,37,232,231,120,72,37,39,128,121,47,232,121,128,104,69,67,175,171,148,157,154,155,118,50,101,73,39,40,9,151,108,48,115,131,194,204,211,74,40,185,80,42,183,40,92,186,230,229,118,202,212,214,83,18,17,76,61,146,160,29,30,56,157,173,106,204,194,135,214,192,203,165,98,21,71,68,51,45,4,144,24,23,77,146,91,205,50,187,201,200,18,91,106,182,90,91,181,85,84,17,206,203,36,148,171,140,92,40,39,193,189,244,159,158,28,247,246,161,236,3,196,54,68,104,193,168,8,117,228,31,189,193,55,98,97,99,126,47,100,166,79,218,155,154,26,209,49,131,135,136,150,47,126,217,223,52,53,45,51,134,211,170,140,67,69,108,43,106,91,230,119,120,226,130,247,63,53,52,238,20,242,46,70,156,78,62,96,46,53,63,143,34,227,173,155,133,123,117,111,44,125,19,236,134,51,216,206,205,154,153,22,39,37,167,200,201,208,36,142,100,57,212,202,20,60,99,28,158,157,35,226,113,160,159,27,204,202,210,113,225,46,43,202,204,62,76,77,137,123,116,41,38,72,203,129,142,64,98,240,49,102,64,41,73,74,212,216,207,42,74,184,169,170,211,170,149,176,105,66,69,122,6,168,123,147,187,96,77,90,65,55,107,89,90,180,101,100,120,63,105,104,93,137,227,15,86,85,129,102,49,14,87,86,55,8,9,100,47,121,145,23,22,88,89,179,6,122,196,88,95,96,138,172,136,215,58,172,115,48,219,42,80,81,195,3,51,43,146,61,171,175,199,81,82,38,53,46,225,144,163,110,246,33,7,52,65,66,229,228,117,34,127,234,107,108,69,109,108,151,48,64,235,62,78,191,129,209,126,111,35,143,163,161,246,117,123,50,222,65,52,19,125,141,221,55,65,3,195,197,25,7,33,220,237,44,70,71,139,122,193,245,247,130,33,71,21,162,153,158,159,170,169,150,188,174,196,216,186,92,144,160,161,2,97,167,141,125,241,164,167,37,72,38,12,145,159,160,38,82,13,63,68,71,226,35,111,158,153,154,101,50,205,206,92,165,209,198,217,165,167,97,220,115,218,133,112,243,239,238,241,214,135,169,190,173,133,171,208,32,125,44,237,86,87,178,85,86,179,84,85,180,83,84,181,201,83,182,137,93,132,76,62,183,61,76,184,57,61,185,212,57,186,214,207,187,34,143,156,79,239,237,123,137,177,44,1,4,201,194,32,64,102,129,213,215,138,59,166,219,242,99,97,2,94,141,75,59,235,24,110,228,25,130,226,23,24,229,22,23,230,26,22,231,112,26,232,189,190,243,221,56,190,28,56,221,27,28,222,29,27,223,30,29,224,247,30,225,238,79,20,166,59,75,60,75,240,147,177,215,20,79,166,187,147,213,112,233,244,233,128,245,128,114,188,114,217,174,131,115,220,217,198,236,198,131,134,177,132,58,143,35,124,110,163,7,228,110,25,356,389,368,11,302,267,452,350,349,302,303,269,357,343,277,452,453,357,333,332,297,175,152,377,384,398,382,347,348,330,303,304,270,9,336,337,278,279,360,418,262,431,304,408,409,310,415,407,270,409,410,450,348,347,422,430,434,313,314,17,306,307,375,387,388,260,286,414,398,335,406,418,364,367,416,423,358,327,251,284,298,281,5,4,373,374,253,307,320,321,425,427,411,421,313,18,321,405,406,320,404,405,315,16,17,426,425,266,377,400,369,322,391,269,417,465,464,386,257,258,466,260,388,456,399,419,284,332,333,417,285,8,346,340,261,413,441,285,327,460,328,355,371,329,392,439,438,382,341,256,429,420,360,364,394,379,277,343,437,443,444,283,275,440,363,431,262,369,297,338,337,273,375,321,450,451,349,446,342,467,293,334,282,458,461,462,276,353,383,308,324,325,276,300,293,372,345,447,382,398,362,352,345,340,274,1,19,456,248,281,436,427,425,381,256,252,269,391,393,200,199,428,266,330,329,287,273,422,250,462,328,258,286,384,265,353,342,387,259,257,424,431,430,342,353,276,273,335,424,292,325,307,366,447,345,271,303,302,423,266,371,294,455,460,279,278,294,271,272,304,432,434,427,272,407,408,394,430,431,395,369,400,334,333,299,351,417,168,352,280,411,325,319,320,295,296,336,319,403,404,330,348,349,293,298,333,323,454,447,15,16,315,358,429,279,14,15,316,285,336,9,329,349,350,374,380,252,318,402,403,6,197,419,318,319,325,367,364,365,435,367,397,344,438,439,272,271,311,195,5,281,273,287,291,396,428,199,311,271,268,283,444,445,373,254,339,263,466,249,282,334,296,449,347,346,264,447,454,336,296,299,338,10,151,278,439,455,292,407,415,358,371,355,340,345,372,390,249,466,346,347,280,442,443,282,19,94,370,441,442,295,248,419,197,263,255,359,440,275,274,300,383,368,351,412,465,263,467,466,301,368,389,380,374,386,395,378,379,412,351,419,436,426,322,373,390,388,2,164,393,370,462,461,164,0,267,302,11,12,374,373,387,268,12,13,293,300,301,446,261,340,385,384,381,330,266,425,426,423,391,429,355,437,391,327,326,440,457,438,341,382,362,459,457,461,434,430,394,414,463,362,396,369,262,354,461,457,316,403,402,315,404,403,314,405,404,313,406,405,421,418,406,366,401,361,306,408,407,291,409,408,287,410,409,432,436,410,434,416,411,264,368,383,309,438,457,352,376,401,274,275,4,421,428,262,294,327,358,433,416,367,289,455,439,462,370,326,2,326,370,305,460,455,254,449,448,255,261,446,253,450,449,252,451,450,256,452,451,341,453,452,413,464,463,441,413,414,258,442,441,257,443,442,259,444,443,260,445,444,467,342,445,459,458,250,289,392,290,290,328,460,376,433,435,250,290,392,411,416,433,341,463,464,453,464,465,357,465,412,343,412,399,360,363,440,437,399,456,420,456,363,401,435,288,372,383,353,339,255,249,448,261,255,133,243,190,133,155,112,33,246,247,33,130,25,398,384,286,362,398,414,362,463,341,263,359,467,263,249,255,466,467,260,75,60,166,238,239,79,162,127,139,72,11,37,121,232,120,73,72,39,114,128,47,233,232,128,103,104,67,152,175,148,173,157,155,119,118,101,74,73,40,107,9,108,49,48,131,32,194,211,184,74,185,191,80,183,185,40,186,119,230,118,210,202,214,84,83,17,77,76,146,161,160,30,190,56,173,182,106,194,138,135,192,129,203,98,54,21,68,5,51,4,145,144,23,90,77,91,207,205,187,83,201,18,181,91,182,180,90,181,16,85,17,205,206,36,176,148,140,165,92,39,245,193,244,27,159,28,30,247,161,174,236,196,103,54,104,55,193,8,111,117,31,221,189,55,240,98,99,142,126,100,219,166,218,112,155,26,198,209,131,169,135,150,114,47,217,224,223,53,220,45,134,32,211,140,109,67,108,146,43,91,231,230,120,113,226,247,105,63,52,241,238,242,124,46,156,95,78,96,70,46,63,116,143,227,116,123,111,1,44,19,3,236,51,207,216,205,26,154,22,165,39,167,199,200,208,101,36,100,43,57,202,242,20,99,56,28,157,124,35,113,29,160,27,211,204,210,124,113,46,106,43,204,96,62,77,227,137,116,73,41,72,36,203,142,235,64,240,48,49,64,42,41,74,214,212,207,183,42,184,210,169,211,140,170,176,104,105,69,193,122,168,50,123,187,89,96,90,66,65,107,179,89,180,119,101,120,68,63,104,234,93,227,16,15,85,209,129,49,15,14,86,107,55,9,120,100,121,153,145,22,178,88,179,197,6,196,89,88,96,135,138,136,138,215,172,218,115,219,41,42,81,5,195,51,57,43,61,208,171,199,41,81,38,224,53,225,24,144,110,105,52,66,118,229,117,227,34,234,66,107,69,10,109,151,219,48,235,183,62,191,142,129,126,116,111,143,7,163,246,118,117,50,223,222,52,94,19,141,222,221,65,196,3,197,45,220,44,156,70,139,188,122,245,139,71,162,145,153,159,149,170,150,122,188,196,206,216,92,163,144,161,164,2,167,242,141,241,0,164,37,11,72,12,144,145,160,12,38,13,70,63,71,31,226,111,157,158,154,36,101,205,203,206,165,126,209,217,98,165,97,237,220,218,237,239,241,210,214,169,140,171,32,241,125,237,179,86,178,180,85,179,181,84,180,182,83,181,194,201,182,177,137,132,184,76,183,185,61,184,186,57,185,216,212,186,192,214,187,139,34,156,218,79,237,147,123,177,45,44,4,208,201,32,98,64,129,192,213,138,235,59,219,141,242,97,97,2,141,240,75,235,229,24,228,31,25,226,230,23,229,231,22,230,232,26,231,233,112,232,244,189,243,189,221,190,222,28,221,223,27,222,224,29,223,225,30,224,113,247,225,99,60,240,213,147,215,60,20,166,192,187,213,243,112,244,244,233,245,245,128,188,188,114,174,134,131,220,174,217,236,236,198,134,215,177,58,156,143,124,25,110,7,31,228,25,264,356,368,0,11,267,451,452,349,267,302,269,350,357,277,350,452,357,299,333,297,396,175,377,381,384,382,280,347,330,269,303,270,151,9,337,344,278,360,424,418,431,270,304,409,272,310,407,322,270,410,449,450,347,432,422,434,18,313,17,291,306,375,259,387,260,424,335,418,434,364,416,391,423,327,301,251,298,275,281,4,254,373,253,375,307,321,280,425,411,200,421,18,335,321,406,321,320,405,314,315,17,423,426,266,396,377,369,270,322,269,413,417,464,385,386,258,248,456,419,298,284,333,168,417,8,448,346,261,417,413,285,326,327,328,277,355,329,309,392,438,381,382,256,279,429,360,365,364,379,355,277,437,282,443,283,281,275,363,395,431,369,299,297,337,335,273,321,348,450,349,359,446,467,283,293,282,250,458,462,300,276,383,292,308,325,283,276,293,264,372,447,346,352,340,354,274,19,363,456,281,426,436,425,380,381,252,267,269,393,421,200,428,371,266,329,432,287,422,290,250,328,385,258,384,446,265,342,386,387,257,422,424,430,445,342,276,422,273,424,306,292,307,352,366,345,268,271,302,358,423,371,327,294,460,331,279,294,303,271,304,436,432,427,304,272,408,395,394,431,378,395,400,296,334,299,6,351,168,376,352,411,307,325,320,285,295,336,320,319,404,329,330,349,334,293,333,366,323,447,316,15,315,331,358,279,317,14,316,8,285,9,277,329,350,253,374,252,319,318,403,351,6,419,324,318,325,397,367,365,288,435,397,278,344,439,310,272,311,248,195,281,375,273,291,175,396,199,312,311,268,276,283,445,390,373,339,295,282,296,448,449,346,356,264,454,337,336,299,337,338,151,294,278,455,308,292,415,429,358,355,265,340,372,388,390,466,352,346,280,295,442,282,354,19,370,285,441,295,195,248,197,457,440,274,301,300,368,417,351,465,251,301,389,385,380,386,394,395,379,399,412,419,410,436,322,387,373,388,326,2,393,354,370,461,393,164,267,268,302,12,386,374,387,312,268,13,298,293,301,265,446,340,380,385,381,280,330,425,322,426,391,420,429,437,393,391,326,344,440,438,458,459,461,364,434,394,428,396,262,274,354,457,317,316,402,316,315,403,315,314,404,314,313,405,313,421,406,323,366,361,292,306,407,306,291,408,291,287,409,287,432,410,427,434,411,372,264,383,459,309,457,366,352,401,1,274,4,418,421,262,331,294,358,435,433,367,392,289,439,328,462,326,94,2,370,289,305,455,339,254,448,359,255,446,254,253,449,253,252,450,252,256,451,256,341,452,414,413,463,286,441,414,286,258,441,258,257,442,257,259,443,259,260,444,260,467,445,309,459,250,305,289,290,305,290,460,401,376,435,309,250,392,376,411,433,453,341,464,357,453,465,343,357,412,437,343,399,344,360,440,420,437,456,360,420,363,361,401,288,265,372,353,390,339,249,339,448,255]);

  // Region vertex definitions (approximate but stable). Used to derive sub-mesh triangles from TRIANGULATION.
  // We precompute region index buffers once at init by filtering TRIANGULATION triangles where all 3 vertices are in a region's vertex set.
  // Region vertex definitions (approximate but stable). We derive sub-mesh triangles from TRIANGULATION.
  // Note: Regions are designed to be used as "both sides" (no left/right selection in UI), but we keep left/right buffers internally.
  const REGION_VERTICES = {
    // Lips: keep full lips (upper + lower) and avoid mouth interior by excluding triangles fully inside the inner ring.
    // Standard outer/inner lip rings used in many MediaPipe examples.
    // Outer ring anchors help ensure full upper-lip coverage.
    lips_outer: [
      61,185,40,39,37,0,267,269,270,409,291,375,321,405,314,17,84,181,91,146
    ],
    lips_inner: [
      78,95,88,178,87,14,317,402,318,324,308,415,310,311,312,13,82,81,80,191
    ],

    left_brow:  [70,63,105,66,107,55,65,52,53,46],
    right_brow: [300,293,334,296,336,285,295,282,283,276],

    left_eyeshadow:  [33,160,159,158,157,173,133,155,154,153,145,144,163,7],
    right_eyeshadow: [263,387,386,385,384,398,362,382,381,380,374,373,390,249],

    // Eyelash/Eyeliner: for now both use the upper-eye rim set (refine later with thinner submesh).
    left_eyelash:  [33,160,159,158,157,173,133],
    right_eyelash: [263,387,386,385,384,398,362],
    left_eyeliner:  [33,160,159,158,157,173,133],
    right_eyeliner: [263,387,386,385,384,398,362],

    left_blush:  [50,101,118,119,120,47,100,117,111,116,123,147,187,207,206,205],
    right_blush: [280,352,347,348,349,277,329,330,340,345,352,376,411,427,426,425]
  };

  function _uniqueSet(arr) {
    const s = new Set();
    for (let i=0;i<arr.length;i++) s.add(arr[i]);
    return s;
  }

  function buildRegionTriangles(tri, vertexSet) {
    const out = [];
    for (let i=0;i<tri.length;i+=3) {
      const a = tri[i], b = tri[i+1], c = tri[i+2];
      if (vertexSet.has(a) && vertexSet.has(b) && vertexSet.has(c)) {
        out.push(a,b,c);
      }
    }
    return new Uint16Array(out);
  }

  // Special: lips should include full lip surface but exclude the mouth interior.
  // We build triangles whose vertices are in (outer ∪ inner) BUT reject triangles where all 3 vertices are in the inner ring.
  function buildLipsTriangles(tri, outerSet, innerSet) {
    const all = new Set(outerSet);
    for (const v of innerSet) all.add(v);

    // We rely on the inner-lip clip in the shader to avoid colouring the mouth cavity.
    const out = [];
    for (let i=0;i<tri.length;i+=3) {
      const a = tri[i], b = tri[i+1], c = tri[i+2];
      if (!all.has(a) || !all.has(b) || !all.has(c)) continue;
      const allInner = innerSet.has(a) && innerSet.has(b) && innerSet.has(c);
      if (allInner) continue;
      out.push(a,b,c);
    }
    return new Uint16Array(out);
  }

  function compileShader(gl, type, source) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const err = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error('Shader compile failed: ' + err);
    }
    return sh;
  }

  function createProgram(gl, vsSource, fsSource) {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const err = gl.getProgramInfoLog(prog);
      gl.deleteProgram(prog);
      throw new Error('Program link failed: ' + err);
    }
    return prog;
  }

  // Exponential moving average smoothing for landmarks.
  // smoothingFactor: 0..1 (higher = more smoothing). Default 0.7.
  function createLandmarkSmoother(numLandmarks, smoothingFactor) {
    const sf = (typeof smoothingFactor === 'number') ? Math.min(0.99, Math.max(0.0, smoothingFactor)) : 0.7;
    const prev = new Float32Array(numLandmarks * 2);
    let initialised = false;

    function smooth(landmarks) {
      // landmarks: array of {x,y} in [0..1]
      if (!landmarks || landmarks.length < numLandmarks) return null;

      if (!initialised) {
        for (let i=0;i<numLandmarks;i++) {
          prev[i*2] = landmarks[i].x;
          prev[i*2+1] = landmarks[i].y;
        }
        initialised = true;
        return prev;
      }

      const a = sf;
      const b = 1.0 - sf;
      for (let i=0;i<numLandmarks;i++) {
        const x = landmarks[i].x;
        const y = landmarks[i].y;
        const j = i*2;
        prev[j]     = prev[j]     * a + x * b;
        prev[j + 1] = prev[j + 1] * a + y * b;
      }
      return prev;
    }

    function reset() {
      initialised = false;
    }

    return { smooth, reset, smoothingFactor: sf };
  }

  // A minimal WebGL2 renderer that:
  // 1) draws a video background quad
  // 2) keeps a dynamic face mesh (positions + UVs + indices) updated each frame
  // 3) provides renderFrame(landmarks, selectedByRegion) (selectedByRegion unused here beyond debug)
  function FaceMeshWebGLRenderer(canvas, videoEl, opts) {
    if (!canvas) throw new Error('Canvas missing');
    this.canvas = canvas;
    this.videoEl = videoEl;
    this.opts = opts || {};
    this.gl = null;

    this._programVideo = null;
    this._programMesh = null;

    this._vaoVideo = null;
    this._vaoMesh = null;

    this._videoTex = null;

    this._meshIndexBuffer = null;

    this._regionIndexBuffers = {}; // name -> buffer
    this._regionIndexCounts = {};  // name -> count
    this._meshPosBuffer = null;
    this._meshUvBuffer = null;

    this._numLandmarks = 468;
    this._posData = new Float32Array(this._numLandmarks * 2); // clip-space xy
    this._uvData  = new Float32Array(this._numLandmarks * 2); // uv
    this._smoother = createLandmarkSmoother(this._numLandmarks, this.opts.smoothingFactor ?? 0.7);

    // Cached indices for inner-lip polygon clip (UV space)
    this._lipsInnerIdx = REGION_VERTICES.lips_inner.slice();
    this._innerPolyTmp = new Float32Array(32 * 2); // max 32 points

    this._disposed = false;
  }

  FaceMeshWebGLRenderer.prototype.init = function() {
    if (this.gl) return;
		const ctxOpts = {
		  alpha: true,
		  antialias: true,
		  premultipliedAlpha: false,
		  preserveDrawingBuffer: false
		};
		// Try WebGL2 first, then WebGL1. Some browsers will fail WebGL2 on a canvas
		// if a 2D context was previously created.
		const gl = this.canvas.getContext('webgl2', ctxOpts) ||
		           this.canvas.getContext('webgl', ctxOpts) ||
		           this.canvas.getContext('experimental-webgl', ctxOpts);
		if (!gl) throw new Error('WebGL not available');
    this.gl = gl;
		this._isWebGL2 = (typeof gl.createVertexArray === 'function');

    // ---------- Program: Video background ----------
		const vsVideo = this._isWebGL2 ? `#version 300 es
		  in vec2 a_pos;
		  in vec2 a_uv;
		  out vec2 v_uv;
		  void main() {
		    v_uv = a_uv;
		    gl_Position = vec4(a_pos, 0.0, 1.0);
		  }
		` : `
		  attribute vec2 a_pos;
		  attribute vec2 a_uv;
		  varying vec2 v_uv;
		  void main() {
		    v_uv = a_uv;
		    gl_Position = vec4(a_pos, 0.0, 1.0);
		  }
		`;
		const fsVideo = this._isWebGL2 ? `#version 300 es
		  precision mediump float;
		  in vec2 v_uv;
		  uniform sampler2D u_video;
		  out vec4 outColor;
		  void main() {
		    outColor = texture(u_video, v_uv);
		  }
		` : `
		  precision mediump float;
		  varying vec2 v_uv;
		  uniform sampler2D u_video;
		  void main() {
		    gl_FragColor = texture2D(u_video, v_uv);
		  }
		`;
    this._programVideo = createProgram(gl, vsVideo, fsVideo);

    // Fullscreen quad (two triangles) in clip space.
    const quadVerts = new Float32Array([
      // x, y,   u, v
      -1, -1,   0, 1,
       1, -1,   1, 1,
      -1,  1,   0, 0,
      -1,  1,   0, 0,
       1, -1,   1, 1,
       1,  1,   1, 0
    ]);
    const quadVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

		this._locVideoPos = gl.getAttribLocation(this._programVideo, 'a_pos');
		this._locVideoUv  = gl.getAttribLocation(this._programVideo, 'a_uv');
		this._videoVbo = quadVbo;

		if (this._isWebGL2) {
		  this._vaoVideo = gl.createVertexArray();
		  gl.bindVertexArray(this._vaoVideo);
		  gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo);
		  gl.enableVertexAttribArray(this._locVideoPos);
		  gl.vertexAttribPointer(this._locVideoPos, 2, gl.FLOAT, false, 16, 0);
		  gl.enableVertexAttribArray(this._locVideoUv);
		  gl.vertexAttribPointer(this._locVideoUv, 2, gl.FLOAT, false, 16, 8);
	    if (this._isWebGL2) gl.bindVertexArray(null);
		}
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // Video texture
    this._videoTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._videoTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, null);

    // ---------- Program: Face mesh (debug / basis for masks) ----------
    // Mesh vertex shader supports an optional per-draw "expand" + "offset".
    // We use this for Foundation to extend the skin tint closer to the hairline.
    const vsMesh = this._isWebGL2 ? `#version 300 es
      in vec2 a_pos;   // clip space
      in vec2 a_uv;    // uv space
      uniform vec2 u_center; // clip-space anchor
      uniform vec2 u_expand; // (x,y) scale around center
      uniform vec2 u_offset; // clip-space translation
      out vec2 v_uv;
      void main() {
        v_uv = a_uv;
        vec2 p = a_pos;
        p = u_center + (p - u_center) * u_expand;
        p = p + u_offset;
        gl_Position = vec4(p, 0.0, 1.0);
      }
    ` : `
      attribute vec2 a_pos;
      attribute vec2 a_uv;
      uniform vec2 u_center;
      uniform vec2 u_expand;
      uniform vec2 u_offset;
      varying vec2 v_uv;
      void main() {
        v_uv = a_uv;
        vec2 p = a_pos;
        p = u_center + (p - u_center) * u_expand;
        p = p + u_offset;
        gl_Position = vec4(p, 0.0, 1.0);
      }
    `;

    const fsMesh = this._isWebGL2 ? `#version 300 es
      precision mediump float;
      in vec2 v_uv;
      uniform sampler2D u_video;

      uniform vec3  u_color;     // rgb 0..1
      uniform float u_opacity;   // 0..1
      uniform float u_intensity; // 0..1
      uniform int   u_mode;      // 0=mix,1=multiply,2=overlay,3=softlight

      // Optional clip: used for lips to prevent filling the mouth cavity when the mouth opens.
      // We pass the inner-lip polygon in UV space and discard fragments inside it.
      uniform int   u_useInnerClip;
      uniform int   u_innerCount;
      uniform vec2  u_innerPoly[32];

      out vec4 outColor;

      vec3 blendMultiply(vec3 b, vec3 s){ return b * s; }

      vec3 blendOverlay(vec3 b, vec3 s){
        return mix(2.0*b*s, 1.0 - 2.0*(1.0-b)*(1.0-s), step(0.5, b));
      }

      vec3 blendSoftLight(vec3 b, vec3 s){
        return (1.0 - 2.0*s) * b*b + 2.0*s*b;
      }

      bool pointInPoly(vec2 p, int count, vec2 poly[32]){
        bool c = false;
        int j = count - 1;
        for (int i = 0; i < 32; i++) {
          if (i >= count) break;
          vec2 pi = poly[i];
          vec2 pj = poly[j];
          bool intersect = ((pi.y > p.y) != (pj.y > p.y)) &&
            (p.x < (pj.x - pi.x) * (p.y - pi.y) / (pj.y - pi.y + 1e-6) + pi.x);
          if (intersect) c = !c;
          j = i;
        }
        return c;
      }

      void main() {
        vec4 base4 = texture(u_video, v_uv);
        vec3 base = base4.rgb;

        if (u_useInnerClip == 1 && u_innerCount > 2) {
          if (pointInPoly(v_uv, u_innerCount, u_innerPoly)) {
            discard;
          }
        }

        vec3 blended = base;
        if (u_mode == 1) blended = blendMultiply(base, u_color);
        else if (u_mode == 2) blended = blendOverlay(base, u_color);
        else if (u_mode == 3) blended = blendSoftLight(base, u_color);
        else blended = mix(base, u_color, 0.5);

        float a = clamp(u_opacity * u_intensity, 0.0, 1.0);
        vec3 outRgb = mix(base, blended, a);

        // We output an *opaque* colour because we've already composited with the underlying video.
        // This avoids double-blending artefacts.
        outColor = vec4(outRgb, 1.0);
      }
    ` : `
      precision mediump float;
      varying vec2 v_uv;
      uniform sampler2D u_video;

      uniform vec3  u_color;
      uniform float u_opacity;
      uniform float u_intensity;
      uniform int   u_mode;

      uniform int   u_useInnerClip;
      uniform int   u_innerCount;
      uniform vec2  u_innerPoly[32];

      vec3 blendMultiply(vec3 b, vec3 s){ return b * s; }
      vec3 blendOverlay(vec3 b, vec3 s){
        return mix(2.0*b*s, 1.0 - 2.0*(1.0-b)*(1.0-s), step(0.5, b));
      }
      vec3 blendSoftLight(vec3 b, vec3 s){
        return (1.0 - 2.0*s) * b*b + 2.0*s*b;
      }

      bool pointInPoly(vec2 p, int count, vec2 poly[32]){
        bool c = false;
        int j = count - 1;
        for (int i = 0; i < 32; i++) {
          if (i >= count) break;
          vec2 pi = poly[i];
          vec2 pj = poly[j];
          bool intersect = ((pi.y > p.y) != (pj.y > p.y)) &&
            (p.x < (pj.x - pi.x) * (p.y - pi.y) / (pj.y - pi.y + 1e-6) + pi.x);
          if (intersect) c = !c;
          j = i;
        }
        return c;
      }

      void main() {
        vec4 base4 = texture2D(u_video, v_uv);
        vec3 base = base4.rgb;

        if (u_useInnerClip == 1 && u_innerCount > 2) {
          if (pointInPoly(v_uv, u_innerCount, u_innerPoly)) {
            discard;
          }
        }

        vec3 blended = base;
        if (u_mode == 1) blended = blendMultiply(base, u_color);
        else if (u_mode == 2) blended = blendOverlay(base, u_color);
        else if (u_mode == 3) blended = blendSoftLight(base, u_color);
        else blended = mix(base, u_color, 0.5);

        float a = clamp(u_opacity * u_intensity, 0.0, 1.0);
        vec3 outRgb = mix(base, blended, a);
        gl_FragColor = vec4(outRgb, 1.0);
      }
    `;
    this._programMesh = createProgram(gl, vsMesh, fsMesh);

    // Cache uniform locations (mesh program)
    this._uMeshVideo = gl.getUniformLocation(this._programMesh, 'u_video');
    this._uMeshColor = gl.getUniformLocation(this._programMesh, 'u_color');
    this._uMeshOpacity = gl.getUniformLocation(this._programMesh, 'u_opacity');
    this._uMeshIntensity = gl.getUniformLocation(this._programMesh, 'u_intensity');
    this._uMeshMode = gl.getUniformLocation(this._programMesh, 'u_mode');

    // Per-draw mesh transform (used mainly for Foundation)
    this._uMeshCenter = gl.getUniformLocation(this._programMesh, 'u_center');
    this._uMeshExpand = gl.getUniformLocation(this._programMesh, 'u_expand');
    this._uMeshOffset = gl.getUniformLocation(this._programMesh, 'u_offset');

    // Lips inner clip uniforms
    this._uUseInnerClip = gl.getUniformLocation(this._programMesh, 'u_useInnerClip');
    this._uInnerCount = gl.getUniformLocation(this._programMesh, 'u_innerCount');
    this._uInnerPoly = gl.getUniformLocation(this._programMesh, 'u_innerPoly[0]');

    if (this._isWebGL2) {
      this._vaoMesh = gl.createVertexArray();
      gl.bindVertexArray(this._vaoMesh);
    } else {
      this._vaoMesh = null;
    }

    // Dynamic vertex positions (clip space)
    this._meshPosBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._meshPosBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this._posData.byteLength, gl.DYNAMIC_DRAW);

    this._locMeshPos = gl.getAttribLocation(this._programMesh, 'a_pos');
    gl.enableVertexAttribArray(this._locMeshPos);
    gl.vertexAttribPointer(this._locMeshPos, 2, gl.FLOAT, false, 0, 0);

    // Dynamic UV buffer
    this._meshUvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._meshUvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this._uvData.byteLength, gl.DYNAMIC_DRAW);

    this._locMeshUv = gl.getAttribLocation(this._programMesh, 'a_uv');
    gl.enableVertexAttribArray(this._locMeshUv);
    gl.vertexAttribPointer(this._locMeshUv, 2, gl.FLOAT, false, 0, 0);

    // Index buffer (static)
    this._meshIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._meshIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, TRIANGULATION, gl.STATIC_DRAW);


    // ---- Precompute region sub-mesh index buffers (derived from TRIANGULATION topology).
    const lipsOuterSet = _uniqueSet(REGION_VERTICES.lips_outer);
    const lipsInnerSet = _uniqueSet(REGION_VERTICES.lips_inner);

    const regionTriangles = {
      // Full lips (upper+lower) excluding mouth interior.
      lips: buildLipsTriangles(TRIANGULATION, lipsOuterSet, lipsInnerSet),

      left_brow: buildRegionTriangles(TRIANGULATION, _uniqueSet(REGION_VERTICES.left_brow)),
      right_brow: buildRegionTriangles(TRIANGULATION, _uniqueSet(REGION_VERTICES.right_brow)),

      left_eyeshadow: buildRegionTriangles(TRIANGULATION, _uniqueSet(REGION_VERTICES.left_eyeshadow)),
      right_eyeshadow: buildRegionTriangles(TRIANGULATION, _uniqueSet(REGION_VERTICES.right_eyeshadow)),

      left_eyelash: buildRegionTriangles(TRIANGULATION, _uniqueSet(REGION_VERTICES.left_eyelash)),
      right_eyelash: buildRegionTriangles(TRIANGULATION, _uniqueSet(REGION_VERTICES.right_eyelash)),

      left_eyeliner: buildRegionTriangles(TRIANGULATION, _uniqueSet(REGION_VERTICES.left_eyeliner)),
      right_eyeliner: buildRegionTriangles(TRIANGULATION, _uniqueSet(REGION_VERTICES.right_eyeliner)),

      left_blush: buildRegionTriangles(TRIANGULATION, _uniqueSet(REGION_VERTICES.left_blush)),
      right_blush: buildRegionTriangles(TRIANGULATION, _uniqueSet(REGION_VERTICES.right_blush))
    };

    for (const [name, idx] of Object.entries(regionTriangles)) {
      if (!idx || idx.length === 0) continue;
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      this._regionIndexBuffers[name] = buf;
      this._regionIndexCounts[name] = idx.length;
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._meshIndexBuffer);

	    if (this._isWebGL2) gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    // Global GL state
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    // No blending needed because region fragments are composited against the video in-shader.
    gl.disable(gl.BLEND);
  };

  FaceMeshWebGLRenderer.prototype._updateVideoTexture = function() {
    const gl = this.gl;
    const v = this.videoEl;
    if (!gl || !v) return;

    if (v.readyState >= 2) {
      gl.bindTexture(gl.TEXTURE_2D, this._videoTex);
      // This call updates the existing texture in-place (no realloc).
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
  };

  // Compute how the video is fitted into the canvas using "cover" behaviour,
  // including an additional zoom multiplier.
  FaceMeshWebGLRenderer.prototype._computeCover = function(canvasW, canvasH, videoW, videoH, zoom) {
    zoom = zoom || 1;
    if (!videoW || !videoH || !canvasW || !canvasH) {
      return { scale: 1, offsetX: 0, offsetY: 0, dispW: canvasW, dispH: canvasH, uMin: 0, uMax: 1, vMin: 0, vMax: 1 };
    }
    const baseScale = Math.max(canvasW / videoW, canvasH / videoH);
    const scale = baseScale * zoom;
    const dispW = videoW * scale;
    const dispH = videoH * scale;
    const offsetX = (canvasW - dispW) * 0.5;
    const offsetY = (canvasH - dispH) * 0.5;

    // Visible crop in normalised video coords (origin TOP-LEFT).
    const uMin = (-offsetX) / dispW;
    const uMax = (canvasW - offsetX) / dispW;
    const vMin = (-offsetY) / dispH;
    const vMax = (canvasH - offsetY) / dispH;

    return { scale, offsetX, offsetY, dispW, dispH, uMin, uMax, vMin, vMax };
  };

  FaceMeshWebGLRenderer.prototype._updateMeshBuffers = function(landmarks, cover) {
    const gl = this.gl;
    if (!gl) return;

    const sm = this._smoother.smooth(landmarks);
    if (!sm) return;

    // Convert to clip space and UVs.
    // Landmarks are normalised in image coords [0..1] with origin top-left.
    // We match the same "cover" transform used by the video background quad.
    // UVs are in *video space* with origin TOP-LEFT to match the background shader mapping.
    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;
    const videoW = this.videoEl && (this.videoEl.videoWidth || this.videoEl.width) || 0;
    const videoH = this.videoEl && (this.videoEl.videoHeight || this.videoEl.height) || 0;
    const c = cover || this._computeCover(canvasW, canvasH, videoW, videoH, 1);
    for (let i=0;i<this._numLandmarks;i++) {
      const x = sm[i*2];
      const y = sm[i*2 + 1];

      // Map video-normalised coordinates into canvas pixels using cover transform.
      const px = (x * videoW * c.scale) + c.offsetX;
      const py = (y * videoH * c.scale) + c.offsetY;

      // Canvas pixels -> clip space.
      this._posData[i*2]     = (px / canvasW) * 2.0 - 1.0;
      this._posData[i*2 + 1] = 1.0 - (py / canvasH) * 2.0;

      // UVs in video space (origin TOP-LEFT) to match the background quad mapping.
      this._uvData[i*2]      = x;
      this._uvData[i*2 + 1]  = y;
    }

    // Upload without reallocation.
    gl.bindBuffer(gl.ARRAY_BUFFER, this._meshPosBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this._posData);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._meshUvBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this._uvData);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  };

  FaceMeshWebGLRenderer.prototype.renderFrame = function(landmarks, selectedByRegion) {
    if (this._disposed) return;
    if (!this.gl) this.init();
    const gl = this.gl;

    const zoom = arguments.length >= 3 ? (arguments[2] || 1) : 1;

    // Resize canvas backing store to match CSS size (HiDPI aware).
    const dpr = window.devicePixelRatio || 1;
    const displayW = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const displayH = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== displayW || this.canvas.height !== displayH) {
      this.canvas.width = displayW;
      this.canvas.height = displayH;
    }
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    // Compute cover transform (must match video quad + mesh positions).
    const videoW = this.videoEl && (this.videoEl.videoWidth || this.videoEl.width) || 0;
    const videoH = this.videoEl && (this.videoEl.videoHeight || this.videoEl.height) || 0;
    const cover = this._computeCover(this.canvas.width, this.canvas.height, videoW, videoH, zoom);

    // Update fullscreen quad UVs only when needed.
    const coverKey = [this.canvas.width, this.canvas.height, videoW, videoH, zoom].join(':');
    if (this._lastCoverKey !== coverKey) {
      this._lastCoverKey = coverKey;
      const u0 = clamp01(cover.uMin);
      const u1 = clamp01(cover.uMax);
      const v0 = clamp01(cover.vMin);
      const v1 = clamp01(cover.vMax);
      // Vertex format: x,y,u,v (6 vertices)
      const quadVerts = new Float32Array([
        -1, -1,   u0, v1,
         1, -1,   u1, v1,
        -1,  1,   u0, v0,
        -1,  1,   u0, v0,
         1, -1,   u1, v1,
         1,  1,   u1, v0
      ]);
      gl.bindBuffer(gl.ARRAY_BUFFER, this._videoVbo);
      gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    this._updateVideoTexture();
    this._updateMeshBuffers(landmarks, cover);

    // ---- Draw video background
    gl.useProgram(this._programVideo);
	    if (this._isWebGL2 && this._vaoVideo) {
	      gl.bindVertexArray(this._vaoVideo);
	    } else {
	      gl.bindBuffer(gl.ARRAY_BUFFER, this._videoVbo);
	      gl.enableVertexAttribArray(this._locVideoPos);
	      gl.vertexAttribPointer(this._locVideoPos, 2, gl.FLOAT, false, 16, 0);
	      gl.enableVertexAttribArray(this._locVideoUv);
	      gl.vertexAttribPointer(this._locVideoUv, 2, gl.FLOAT, false, 16, 8);
	    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._videoTex);
    gl.uniform1i(gl.getUniformLocation(this._programVideo, 'u_video'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // ---- Draw region sub-meshes (precomputed triangle sets) ----
    if (selectedByRegion && Object.keys(selectedByRegion).length) {
      gl.useProgram(this._programMesh);
	      if (this._isWebGL2 && this._vaoMesh) {
	        gl.bindVertexArray(this._vaoMesh);
	      } else {
	        // Non-VAO path (WebGL1): rebind dynamic buffers + attrib pointers.
	        gl.bindBuffer(gl.ARRAY_BUFFER, this._meshPosBuffer);
	        gl.enableVertexAttribArray(this._locMeshPos);
	        gl.vertexAttribPointer(this._locMeshPos, 2, gl.FLOAT, false, 0, 0);
	        gl.bindBuffer(gl.ARRAY_BUFFER, this._meshUvBuffer);
	        gl.enableVertexAttribArray(this._locMeshUv);
	        gl.vertexAttribPointer(this._locMeshUv, 2, gl.FLOAT, false, 0, 0);
	      }
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      // Default mesh transform (no expansion). We still set uniforms so WebGL doesn't use stale values.
      // Use landmark 168 (between eyes) as a stable anchor when available.
      const anchorIdx = (this._posData && this._posData.length >= (168 * 2 + 2)) ? 168 : 1;
      const cx = this._posData[anchorIdx * 2] || 0.0;
      const cy = this._posData[anchorIdx * 2 + 1] || 0.0;
      if (this._uMeshCenter) gl.uniform2f(this._uMeshCenter, cx, cy);
      if (this._uMeshExpand) gl.uniform2f(this._uMeshExpand, 1.0, 1.0);
      if (this._uMeshOffset) gl.uniform2f(this._uMeshOffset, 0.0, 0.0);

      const drawRegion = (regionName, hex, opacity, useInnerClip) => {
        const buf = this._regionIndexBuffers[regionName];
        const count = this._regionIndexCounts[regionName];
        if (!buf || !count || !hex) return;

        gl.uniform1i(this._uUseInnerClip, useInnerClip ? 1 : 0);

        const rgba = hexToRgba(hex, 1.0);
        gl.uniform3f(this._uMeshColor, rgba[0], rgba[1], rgba[2]);
        gl.uniform1f(this._uMeshOpacity, opacity);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf);
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
      };

      // Foundation: whole face mesh tint. (Soft-light can be subtle; use a slightly higher default opacity.)
      if (selectedByRegion.foundation) {
        const rgba = hexToRgba(selectedByRegion.foundation, 1.0);
        gl.uniform3f(this._uMeshColor, rgba[0], rgba[1], rgba[2]);
        // Foundation needs to be visible even with subtle colours.
        // Multiply at a moderate opacity reads more reliably than softlight.
        gl.uniform1f(this._uMeshOpacity, 0.22);
        gl.uniform1f(this._uMeshIntensity, 1.0);
        gl.uniform1i(this._uMeshMode, 1); // multiply
        gl.uniform1i(this._uUseInnerClip, 0);

        // Extend foundation tint upward toward hairline (approx) by slightly expanding the mesh
        // around a stable anchor (between eyes). This is a pragmatic approach because FaceMesh
        // tessellation typically stops short of the true hairline.
        if (this._uMeshExpand) gl.uniform2f(this._uMeshExpand, 1.06, 1.18);
        if (this._uMeshOffset) gl.uniform2f(this._uMeshOffset, 0.0, 0.02);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._meshIndexBuffer);
        gl.drawElements(gl.TRIANGLES, TRIANGULATION.length, gl.UNSIGNED_SHORT, 0);

        // Reset transform for subsequent regions
        if (this._uMeshExpand) gl.uniform2f(this._uMeshExpand, 1.0, 1.0);
        if (this._uMeshOffset) gl.uniform2f(this._uMeshOffset, 0.0, 0.0);
      }

      // Lips: always full lips (accept lips / upper_lip / lower_lip but render full lips).
      const lipsColour = selectedByRegion.lips || selectedByRegion.upper_lip || selectedByRegion.lower_lip;
      if (lipsColour) {
        // Enable inner-lip clip to prevent colouring the mouth cavity.
        const n = Math.min(32, this._lipsInnerIdx.length);
        for (let i = 0; i < n; i++) {
          const idx = this._lipsInnerIdx[i];
          // UV space is (x, 1-y) to match the video texture.
          const u = this._uvData[idx * 2];
          const v = this._uvData[idx * 2 + 1];
          this._innerPolyTmp[i * 2] = u;
          this._innerPolyTmp[i * 2 + 1] = v;
        }
        gl.uniform1i(this._uUseInnerClip, 1);
        gl.uniform1i(this._uInnerCount, n);
        gl.uniform2fv(this._uInnerPoly, this._innerPolyTmp);

        drawRegion('lips', lipsColour, 0.60, true);
      }

      // Brows (accept brows / left_brow / right_brow)
      const browColour = selectedByRegion.brows || selectedByRegion.left_brow || selectedByRegion.right_brow;
      if (browColour) {
        drawRegion('left_brow', selectedByRegion.left_brow || browColour, 0.55, false);
        drawRegion('right_brow', selectedByRegion.right_brow || browColour, 0.55, false);
      }

      // Eyeshadow (accept eyeshadow / left_eyeshadow / right_eyeshadow)
      const shadowColour = selectedByRegion.eyeshadow || selectedByRegion.left_eyeshadow || selectedByRegion.right_eyeshadow;
      if (shadowColour) {
        drawRegion('left_eyeshadow', selectedByRegion.left_eyeshadow || shadowColour, 0.40, false);
        drawRegion('right_eyeshadow', selectedByRegion.right_eyeshadow || shadowColour, 0.40, false);
      }

      // Eyelash (both eyes)
      if (selectedByRegion.eyelash) {
        drawRegion('left_eyelash', selectedByRegion.eyelash, 0.55, false);
        drawRegion('right_eyelash', selectedByRegion.eyelash, 0.55, false);
      }

      // Eyeliner (both eyes)
      if (selectedByRegion.eyeliner) {
        drawRegion('left_eyeliner', selectedByRegion.eyeliner, 0.65, false);
        drawRegion('right_eyeliner', selectedByRegion.eyeliner, 0.65, false);
      }

      // Blush (both cheeks)
      if (selectedByRegion.blush) {
        drawRegion('left_blush', selectedByRegion.blush, 0.28, false);
        drawRegion('right_blush', selectedByRegion.blush, 0.28, false);
      }

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._meshIndexBuffer);
    }
    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  };

  FaceMeshWebGLRenderer.prototype.dispose = function() {
    if (this._disposed) return;
    this._disposed = true;
    if (!this.gl) return;

    const gl = this.gl;
    try {
      if (this._videoTex) gl.deleteTexture(this._videoTex);
      if (this._meshIndexBuffer) gl.deleteBuffer(this._meshIndexBuffer);
      if (this._meshPosBuffer) gl.deleteBuffer(this._meshPosBuffer);
      if (this._meshUvBuffer) gl.deleteBuffer(this._meshUvBuffer);
      if (this._regionIndexBuffers) {
        for (const k in this._regionIndexBuffers) {
          if (this._regionIndexBuffers[k]) gl.deleteBuffer(this._regionIndexBuffers[k]);
        }
      }
	      if (this._isWebGL2 && gl.deleteVertexArray) {
	        if (this._vaoVideo) gl.deleteVertexArray(this._vaoVideo);
	        if (this._vaoMesh) gl.deleteVertexArray(this._vaoMesh);
	      }
      if (this._programVideo) gl.deleteProgram(this._programVideo);
      if (this._programMesh) gl.deleteProgram(this._programMesh);
    } catch (e) {
      // ignore
    }
    this._smoother.reset();
    this.gl = null;
  };

  function hexToRgba(input, alpha) {
    if (!input) return [1,0,0, alpha ?? 0.2];
    const s = String(input).trim();

    // rgb()/rgba()
    const rgbMatch = s.match(/^rgba?\(([^)]+)\)$/i);
    if (rgbMatch) {
      const parts = rgbMatch[1].split(',').map(p => p.trim());
      const r = Math.min(255, Math.max(0, parseFloat(parts[0]))) / 255;
      const g = Math.min(255, Math.max(0, parseFloat(parts[1]))) / 255;
      const b = Math.min(255, Math.max(0, parseFloat(parts[2]))) / 255;
      const a = (parts.length >= 4) ? Math.min(1, Math.max(0, parseFloat(parts[3]))) : (alpha ?? 0.2);
      return [r, g, b, a];
    }

    // hex
    let h = s;
    if (h[0] === '#') h = h.slice(1);
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    const n = parseInt(h, 16);
    const r = ((n >> 16) & 255) / 255;
    const g = ((n >> 8) & 255) / 255;
    const b = (n & 255) / 255;
    return [r, g, b, alpha ?? 0.2];
  }

  function clamp01(v) {
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
  }

  // Expose on window for apotheca-ar.js to use.
  window.ApothecaARWebGLRenderer = {
    TRIANGULATION,
    REGION_VERTICES,
    buildRegionTriangles,
    createLandmarkSmoother,
    FaceMeshWebGLRenderer
  };
})();
