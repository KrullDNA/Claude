# Changelog

All notable changes to Apotheca AR Makeup Try-On will be documented in this file.

## 1.0.25
- Remove: Face Region debug notice on the WooCommerce Attributes admin screen (logging remains available via the apotheca_ar_debug filter).
- Fix: Mobile (iOS Safari) — stronger horizontal containment (safe-area gutters via modal padding + explicit overflow-x hidden + container overflow hidden + canvas max-width).

## 1.0.23
- Fix: WooCommerce Attributes Face Region now preselects correctly on edit across WC versions (supports object/array payloads).
- Fix: Mobile (iOS Safari) — moved safe-area gutters to the modal padding and set container width:100% at mobile breakpoint to prevent right-edge overflow.

## 1.0.20
- Fix: attribute Face Region saving made more robust (stores mapping by attribute ID + per-attribute option + per-name option; nonce is optional if missing in WC AJAX flow).
- Fix: mobile overflow (iPhone Safari) — container width is now constrained to viewport and horizontal overflow is hidden on the modal.

## 1.0.17
- UI: Zoom control is left-aligned with the variation headings/swatches.
- Elementor: Added styling controls for the Zoom control (container, label/value typography, slider accent/height).
- Mobile: Added iOS safe-area aware gutters so the camera panel is contained with equal left/right margins.

## 1.0.17
- UI: Zoom control is left-aligned with the variation headings/swatches.
- Elementor: Added styling controls for the Zoom control (container, label/value typography, slider accent/height).
- Mobile: Added iOS safe-area aware gutters so the camera panel is contained with equal left/right margins.

## 1.0.16
- Fix: canvas now fills the entire camera area (no letterboxing / black bars) using a proportional "cover" draw strategy.
- Add: optional Zoom slider in the modal controls; uses safe canvas zoom and attempts native camera zoom when supported.
- Improve: landmark-to-canvas mapping now matches the cropped/zoomed camera draw so overlays stay aligned.
- Improve: canvas sizing now tracks window resize while the modal is open.

## 1.0.15
- Fix: do not use display:none for the MediaPipe video element (prevents permission/metadata events on some browsers).
- Fix: reset selectedRegions on each modal open so no overlays appear unless the user selects a swatch.
- Improve: add HTTPS/secure-context + getUserMedia checks with clearer in-modal error messages.
- Improve: add a "Retry" button + stall detector if the browser permission prompt is blocked.

## 1.0.14
- Fix: add missing #apotheca-ar-video element to modal template so MediaPipe camera can initialise.

## 1.0.13
- Replaced Jeeliz with MediaPipe Face Mesh (CDN) and added 2D overlay rendering for lips, brows, and eyeshadow.
- Swatch clicks now apply colours by data-face-region and drive per-frame rendering.

## [1.0.12] - 2026-02-13

### Added
- Added `data-face-region` to AR modal swatch groups and swatch buttons, sourced from the saved WooCommerce Attribute → Face Region mapping.


## [1.0.5] - 2026-02-08

### Fixed - CRITICAL: Library Name Correction
- **BREAKING FIX:** Corrected library from non-existent `jeelizWebARMakeup` to actual `jeelizFaceFilter`
- Updated all references from `JEELIZWEBARMAKEUP` to `JEELIZFACEFILTER`
- Fixed file paths to use `jeelizFaceFilter.js` and `NN_DEFAULT.json`
- Added fallback to GitHub CDN if local files missing

### Changed
- File structure now uses `/assets/lib/jeelizFaceFilter.js` and `/assets/lib/NNC/NN_DEFAULT.json`
- Removed references to non-existent WASM files (not needed by FaceFilter)
- Updated README files to reflect correct setup
- Makeup methods now have TODO placeholders for Claude Code development

### Added
- `CLAUDE-CODE-NEXT-STEPS.md` - Complete guide for building makeup rendering with Claude Code
- Console logging for face tracking verification
- Better error messages for debugging

### Status
- ✅ Face tracking: WORKS (when correct files uploaded)
- ⚠️ Makeup rendering: TO BE BUILT with Claude Code (custom WebGL shaders needed)
- ✅ UI/Swatches/Product variations: WORKING

### Important Notes
**This version requires the correct Jeeliz library files:**
1. `jeelizFaceFilter.js` - Face tracking library
2. `NNC/NN_DEFAULT.json` - Neural network model

**The jeelizWebARMakeup library referenced in previous versions does not exist!**

The base `jeelizFaceFilter` library only provides face tracking. Custom makeup rendering must be built separately using WebGL shaders. See `CLAUDE-CODE-NEXT-STEPS.md` for complete instructions.

---

## [1.0.0] - 2026-02-08

### Added
- Initial release
- Real-time AR makeup try-on using Jeeliz WebAR library
- Lipstick feature with color customization
- Eyeshadow feature with color customization
- Color picker with preset colors
- **NEW: Automatic Variation Swatches Integration**
  - Auto-detects hex colors from "Variation Swatches Elementor" plugin
  - Reads `fif_swatch_color` term meta automatically
  - Zero duplicate color entry needed
  - Displays detected colors in product admin
  - Automatically applies selected variation color in AR
  - Smart attribute detection (color, colour, shade, tone)
  - Falls back gracefully if swatches not present
  - Color priority system (swatch → manual → default)
- **NEW: Full Elementor widget with complete styling controls**
  - Button styling (colors, typography, borders, shadows, hover states)
  - Modal styling (overlay, container, padding, borders)
  - AR video area styling (size, borders, shadows)
  - Controls panel styling (colors, typography, spacing)
  - Title and close button styling
  - Complete design freedom without code
- **NEW: Easy WooCommerce product toggle**
  - Simple on/off switch in product sidebar (like Publish box)
  - No more custom fields needed!
  - Optional product-specific colors (lipstick & eyeshadow)
  - Automatic color application when AR opens
  - Beautiful admin UI with color pickers
  - Shows detected swatch colors when available
  - Smart UI that adapts to product type
- Shortcode support: [apotheca_ar_tryon]
- Classic Elementor button integration (CSS class method)
- Admin settings page for default colors
- Responsive modal interface
- Mobile device support (beta)
- Toggle on/off for individual makeup types
- Face detection with Jeeliz face tracking
- Professional UI with gradient buttons and smooth animations
- Product-specific color mapping

### Features
- Browser-based, no app download required
- HTTPS required for camera access
- Works on desktop and mobile browsers
- Open-source AR library (no API costs)
- Seamless integration with existing variation swatches
- Automatic color synchronization across systems
- No duplicate data entry
- Customizable default colors per product
- Easy integration with existing WooCommerce setup
- Elementor page builder full support

### Technical
- Uses Jeeliz WebAR Makeup v1.0.6
- jQuery-based event handling
- WordPress plugin architecture
- Elementor widget API integration
- WooCommerce meta box integration
- Variation swatches meta field detection
- Product meta data for colors
- CSS Grid layout for responsive design
- WooCommerce variation change event listeners
- RGB to Hex color conversion
- Smart attribute name detection algorithm

## [Planned]

### Version 1.1.0 (Future)
- Blush feature
- Eyeliner feature
- Highlighter and contouring
- Multiple lipstick finishes (matte, glossy, satin)
- Screenshot and share functionality
- Product-specific shade mapping

### Version 1.2.0 (Future)
- Analytics integration
- Custom preset management
- Bulk product AR enablement
- Advanced color matching
- Virtual try-on history
- Comparison mode (before/after slider)

### Version 2.0.0 (Future)
- Mascara and false lashes
- Foundation/skin tone matching
- Multiple face support
- AR filter effects
- Social sharing integration
- Video recording capability
