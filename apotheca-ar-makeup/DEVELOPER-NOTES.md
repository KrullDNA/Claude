# Developer Notes

This document explains how the plugin works and how to extend it.

## Architecture Overview

```
apotheca-ar-makeup/
├── apotheca-ar-makeup.php     # Main plugin file (WordPress hooks)
├── assets/
│   ├── js/
│   │   └── apotheca-ar.js      # AR functionality (Jeeliz integration)
│   └── css/
│       └── apotheca-ar.css     # Styling
└── templates/
    ├── ar-widget.php           # Modal HTML template
    └── admin-settings.php      # Admin page template
```

## Key Components

### 1. Main Plugin Class (`apotheca-ar-makeup.php`)

**WordPress Hooks:**
- `wp_enqueue_scripts` - Loads JS/CSS
- `admin_menu` - Adds admin page
- `woocommerce_before_add_to_cart_button` - Adds button to products

**Shortcode:**
- `[apotheca_ar_tryon]` - Embeds AR modal

### 2. JavaScript (`apotheca-ar.js`)

**Main Methods:**
- `init()` - Sets up event listeners
- `openARModal()` - Shows modal and initializes camera
- `initializeAR()` - Initializes Jeeliz library
- `updateMakeup()` - Changes makeup colors
- `hexToRgb()` - Color conversion helper

**Jeeliz Integration:**
```javascript
JEELIZWEBARMAKEUP.init({
    canvasId: 'apotheca-ar-canvas',
    NNCPath: 'CDN_URL',
    callbackReady: function(errCode) { ... }
});
```

## How to Add New Makeup Types

### Example: Adding Blush

**1. Update JavaScript (apotheca-ar.js)**

Add new method:
```javascript
updateBlush: function(color, opacity) {
    if (!isInitialized) return;
    
    const rgb = this.hexToRgb(color);
    JEELIZWEBARMAKEUP.update_blush({
        color: [rgb.r / 255, rgb.g / 255, rgb.b / 255],
        opacity: opacity || 0.5
    });
}
```

Add event listener in `setupEventListeners()`:
```javascript
$(document).on('change', '#apotheca-blush-color', function() {
    const color = $(this).val();
    ApothecaAR.updateBlush(color);
});
```

**2. Update Template (templates/ar-widget.php)**

Add new control group:
```html
<div class="apotheca-control-group">
    <div class="apotheca-toggle">
        <input type="checkbox" id="apotheca-enable-blush">
        <label for="apotheca-enable-blush">Blush</label>
    </div>
    
    <label for="apotheca-blush-color">Color</label>
    <div class="apotheca-color-picker-wrapper">
        <input type="color" id="apotheca-blush-color" value="#ff69b4">
    </div>
</div>
```

## Jeeliz WebAR Makeup API

### Available Methods

```javascript
// Lipstick
JEELIZWEBARMAKEUP.update_lipstick({
    color: [r, g, b],  // RGB values 0-1
    opacity: 0.8        // 0-1
});

// Eyeshadow
JEELIZWEBARMAKEUP.update_eyeshadow({
    color: [r, g, b],
    opacity: 0.6
});

// Foundation (if supported in version)
JEELIZWEBARMAKEUP.update_foundation({
    color: [r, g, b],
    opacity: 0.7
});
```

### Detecting Face
```javascript
callbackTrack: function(detectState) {
    // detectState.detected = true/false
    // detectState.x, detectState.y = face position
}
```

## WooCommerce Integration

### Enable AR for Products

**Method 1: Custom Field**
```php
update_post_meta($product_id, '_apotheca_ar_enabled', 'yes');
```

**Method 2: Product Category**
Add this to `apotheca-ar-makeup.php`:
```php
public function add_tryon_button() {
    global $product;
    
    // Check if product is in "Makeup" category
    if (has_term('makeup', 'product_cat', $product->get_id())) {
        echo '<button class="apotheca-ar-trigger">...</button>';
    }
}
```

### Map Product Colors to AR

Store color hex values in product meta:
```php
// When creating product
update_post_meta($product_id, '_ar_lipstick_color', '#ff0000');

// In JavaScript, retrieve and apply
wp_localize_script('apotheca-ar-script', 'productData', array(
    'color' => get_post_meta(get_the_ID(), '_ar_lipstick_color', true)
));
```

## Adding Features

### Screenshot Functionality

Add to JavaScript:
```javascript
takeScreenshot: function() {
    const canvas = document.getElementById('apotheca-ar-canvas');
    const dataURL = canvas.toDataURL('image/png');
    
    // Create download link
    const link = document.createElement('a');
    link.download = 'apotheca-virtual-tryon.png';
    link.href = dataURL;
    link.click();
}
```

Add button to template:
```html
<button id="screenshot-btn">📸 Take Screenshot</button>
```

### Save to User Account

Add AJAX handler in main PHP:
```php
add_action('wp_ajax_save_ar_look', array($this, 'save_look'));

public function save_look() {
    check_ajax_referer('apotheca_ar_nonce', 'nonce');
    
    $user_id = get_current_user_id();
    $look_data = $_POST['look_data'];
    
    // Save to user meta
    $looks = get_user_meta($user_id, 'saved_ar_looks', true) ?: array();
    $looks[] = $look_data;
    update_user_meta($user_id, 'saved_ar_looks', $looks);
    
    wp_send_json_success();
}
```

## Performance Optimization

### Lazy Load AR Library
```javascript
// Only load when button clicked
function loadJeeliz() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'JEELIZ_CDN_URL';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}
```

### Reduce Canvas Size on Mobile
```javascript
if (window.innerWidth < 768) {
    canvas.width = 640;
    canvas.height = 480;
}
```

## Security Best Practices

1. **Nonce Verification**
```php
check_ajax_referer('apotheca_ar_nonce', 'nonce');
```

2. **Capability Checks**
```php
if (!current_user_can('manage_options')) {
    wp_die('Unauthorized');
}
```

3. **Input Sanitization**
```php
$color = sanitize_hex_color($_POST['color']);
```

## Debugging

### Enable Debug Mode

Add to `apotheca-ar.js`:
```javascript
const DEBUG = true;

if (DEBUG) {
    console.log('AR initialized:', isInitialized);
    console.log('Face detected:', detectState.detected);
}
```

### Common Issues

1. **Camera not accessible**
   - Check HTTPS
   - Check browser permissions
   
2. **Jeeliz not loading**
   - Check CDN availability
   - Check browser compatibility
   
3. **Performance issues**
   - Reduce canvas resolution
   - Disable unused features

## Browser Compatibility

Tested on:
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

Requires:
- WebGL support
- getUserMedia API
- Canvas API

## Resources

- [Jeeliz WebAR Docs](https://github.com/jeeliz/jeelizWebAR)
- [WordPress Plugin Handbook](https://developer.wordpress.org/plugins/)
- [WooCommerce Developer Docs](https://woocommerce.com/document/introduction-to-woocommerce-development/)

---

**Need Help?**  
These notes are for developers extending the plugin. For basic usage, see README.md and QUICK-START.txt.
