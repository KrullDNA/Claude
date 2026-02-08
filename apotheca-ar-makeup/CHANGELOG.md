# Changelog

All notable changes to Apotheca AR Makeup Try-On will be documented in this file.

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
