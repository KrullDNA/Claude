# Apotheca AR Makeup Try-On Plugin

A WordPress plugin that adds virtual makeup try-on functionality to your WooCommerce store using AR face tracking technology.

## Features

✅ **Real-time AR Makeup Try-On**
- Lipstick with customizable colors
- Eyeshadow with various shades
- Live camera preview with face tracking
- Easy color picker and presets

✅ **WooCommerce Integration**
- Add "Virtual Try-On" button to product pages
- Works seamlessly with Elementor
- Shortcode support for any page

✅ **User-Friendly**
- No app download required
- Works in browser on desktop and mobile
- Simple, beautiful interface

## Technology

- **AR Library:** Jeeliz WebAR Makeup (Open Source)
- **Face Tracking:** Real-time facial landmark detection
- **Browser Based:** No server-side processing needed
- **Free:** Uses open-source libraries, no API costs

## Installation

### Step 1: Upload Plugin

1. Download the `apotheca-ar-makeup.zip` file
2. In WordPress admin, go to **Plugins > Add New**
3. Click **Upload Plugin** button
4. Choose the zip file and click **Install Now**
5. Click **Activate Plugin**

### Step 2: Configure Settings (Optional)

1. In WordPress admin, go to **AR Makeup** in the sidebar
2. Set your default lipstick and eyeshadow colors
3. Enable/disable mobile support
4. Click **Save Changes**

## Usage

### Method 1: Add to WooCommerce Products (EASIEST!)

1. Edit a product in WooCommerce
2. Look at the right sidebar (like where the Publish box is)
3. Find the **"AR Virtual Try-On"** box
4. Toggle the switch to **ON**
5. (Optional) Set product-specific colors
6. Update the product

The "Virtual Try-On" button will now appear on that product page!

**Bonus:** You can also set specific lipstick/eyeshadow colors for each product. When customers use AR, your product's exact colors will be applied automatically!

### Method 2: Elementor Widget (FULL CONTROL!)

1. Edit any page with Elementor
2. Search for "AR Makeup Try-On" widget
3. Drag it onto your page
4. Customize EVERYTHING in the style panel:
   - Button colors, typography, hover effects
   - Modal colors and sizing
   - AR video area size and borders
   - Control panel styling
   - All spacing and dimensions

This gives you complete design control without touching any code!

### Method 3: Use Shortcode

Add this shortcode to any page, post, or widget:

```
[apotheca_ar_tryon show_button="true"]
```

This will display a "Try Virtual Makeup" button that opens the AR experience.

## Browser Compatibility

✅ Chrome (recommended)
✅ Firefox
✅ Safari
✅ Edge

**Note:** Requires HTTPS (secure connection) for camera access.

## Troubleshooting

### Camera Not Working
- Make sure you're on HTTPS (not HTTP)
- Grant camera permissions when prompted
- Check if another app is using your camera
- Try a different browser

### AR Not Loading
- Check browser console for errors (F12 > Console)
- Clear your browser cache
- Disable conflicting plugins temporarily
- Make sure you have good internet connection

### Button Not Appearing
- Make sure the custom field `_apotheca_ar_enabled` is set to `yes`
- Check if the CSS class `apotheca-ar-trigger` is applied
- Clear cache if using a caching plugin

## Roadmap

Future features planned:
- 🎨 Blush and contouring
- 👁️ Eyeliner and mascara
- 💋 Multiple lipstick finishes (matte, glossy, etc.)
- 📸 Screenshot and share functionality
- 🛍️ Direct product integration with specific shades
- 📊 Analytics and engagement tracking

## Support

For support or feature requests:
1. Check the troubleshooting section above
2. Look for errors in browser console (F12)
3. Provide feedback via the WordPress plugin page

## Credits

- Built for Apotheca
- Uses Jeeliz WebAR Makeup library
- Developed with Claude AI assistance

## License

GPL v2 or later

---

**Version:** 1.0.0  
**Last Updated:** February 2026
