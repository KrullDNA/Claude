<?php
/**
 * Plugin Name: Apotheca AR Makeup Try-On
 * Plugin URI: https://apotheca.com
 * Description: Virtual makeup try-on tool for WooCommerce products using AR face tracking
 * Version: 1.0.0
 * Author: Apotheca
 * Author URI: https://apotheca.com
 * License: GPL v2 or later
 * Text Domain: apotheca-ar
 * Requires at least: 5.0
 * Requires PHP: 7.2
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
// IMPORTANT: Used for asset cache-busting. Keep in sync with the plugin header above.
define('APOTHECA_AR_VERSION', '1.0.0');
define('APOTHECA_AR_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('APOTHECA_AR_PLUGIN_URL', plugin_dir_url(__FILE__));

// Include required files
require_once APOTHECA_AR_PLUGIN_DIR . 'includes/product-meta-box.php';
require_once APOTHECA_AR_PLUGIN_DIR . 'includes/attribute-face-region.php';

class Apotheca_AR_Makeup {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));
        add_shortcode('apotheca_ar_tryon', array($this, 'render_ar_widget'));
        
        // Register Elementor widget
        add_action('elementor/widgets/register', array($this, 'register_elementor_widget'));
        
        // Note: Removed auto-add button from WooCommerce products
        // Use Elementor widget or shortcode instead
    }

    /**
     * Enqueue admin scripts (WooCommerce → Products → Attributes)
     * Ensures our custom Face Region field is included in WC's AJAX save payload.
     */
    public function enqueue_admin_scripts($hook_suffix) {
        if (!current_user_can('manage_woocommerce')) {
            return;
        }

        // Only on the global Product Attributes screen.
        // Typical hook: 'product_page_product_attributes'
        $is_attr_screen = false;
        if ($hook_suffix === 'product_page_product_attributes') {
            $is_attr_screen = true;
        }
        if (!$is_attr_screen && isset($_GET['page'], $_GET['post_type']) && $_GET['page'] === 'product_attributes' && $_GET['post_type'] === 'product') {
            $is_attr_screen = true;
        }
        if (!$is_attr_screen) {
            return;
        }

        $admin_js = APOTHECA_AR_PLUGIN_URL . 'assets/js/apotheca-ar-admin-attributes.js';
        $admin_path = APOTHECA_AR_PLUGIN_DIR . 'assets/js/apotheca-ar-admin-attributes.js';
        $ver = APOTHECA_AR_VERSION;
        if (file_exists($admin_path)) {
            $ver = (string) filemtime($admin_path);
        }

        wp_enqueue_script('apotheca-ar-admin-attributes', $admin_js, array('jquery'), $ver, true);
    }
    
    /**
     * Enqueue scripts and styles
     */
    public function enqueue_scripts() {
        // Cache-busting versions (fallback to APOTHECA_AR_VERSION)
        $css_ver = APOTHECA_AR_VERSION;
        $js_ver  = APOTHECA_AR_VERSION;

        $css_path = APOTHECA_AR_PLUGIN_DIR . 'assets/css/apotheca-ar.css';
        $js_path  = APOTHECA_AR_PLUGIN_DIR . 'assets/js/apotheca-ar.js';

        if (file_exists($css_path)) {
            $css_ver = (string) filemtime($css_path);
        }
        if (file_exists($js_path)) {
            $js_ver = (string) filemtime($js_path);
        }

        // Enqueue CSS
        wp_enqueue_style(
            'apotheca-ar-styles',
            APOTHECA_AR_PLUGIN_URL . 'assets/css/apotheca-ar.css',
            array(),
            $css_ver
        );

// Enqueue MediaPipe (Face Mesh) libraries from CDN (no build step)
wp_enqueue_script(
    'mediapipe-drawing-utils',
    'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
    array(),
    null,
    true
);

wp_enqueue_script(
    'mediapipe-camera-utils',
    'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
    array(),
    null,
    true
);

wp_enqueue_script(
    'mediapipe-face-mesh',
    'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js',
    array('mediapipe-drawing-utils', 'mediapipe-camera-utils'),
    null,
    true
);

// Enqueue our custom AR script

        wp_enqueue_script(
            'apotheca-ar-script',
            APOTHECA_AR_PLUGIN_URL . 'assets/js/apotheca-ar.js',
            array('jquery', 'mediapipe-face-mesh'),
            $js_ver,
            true
        );
        
        // Pass PHP variables to JavaScript
        $product_lipstick_color = '';
        $product_eyeshadow_color = '';
        $swatch_colors_available = false;
        
        // Get product-specific colors if on a product page
        if (is_product()) {
            global $post;
            $product = wc_get_product($post->ID);
            
            // Check for manual colors first
            $product_lipstick_color = get_post_meta($post->ID, '_apotheca_ar_lipstick_color', true);
            $product_eyeshadow_color = get_post_meta($post->ID, '_apotheca_ar_eyeshadow_color', true);
            
            // Check if product has variation swatches
            if ($product && $product->is_type('variable')) {
                $swatch_colors_available = true;
            }
        }
        
        wp_localize_script('apotheca-ar-script', 'apothecaAR', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('apotheca_ar_nonce'),
            'pluginUrl' => APOTHECA_AR_PLUGIN_URL,
            'defaultLipstickColor' => get_option('apotheca_ar_default_lipstick', '#ff0000'),
            'defaultEyeshadowColor' => get_option('apotheca_ar_default_eyeshadow', '#8b4513'),
            'productLipstickColor' => $product_lipstick_color,
            'productEyeshadowColor' => $product_eyeshadow_color,
            'swatchColorsAvailable' => $swatch_colors_available
        ));
    }

    /**
     * Render AR widget shortcode
     */
    public function render_ar_widget($atts) {
        $atts = shortcode_atts(array(
            'product_id' => '',
            'makeup_type' => 'lipstick',
            'color' => ''
        ), $atts);
        
        ob_start();
        include APOTHECA_AR_PLUGIN_DIR . 'templates/ar-widget.php';
        return ob_get_clean();
    }
    
    /**
     * Add try-on button to WooCommerce products
     */
    public function add_tryon_button() {
        global $product;
        
        // Check if this product has AR enabled (you can add custom field later)
        $ar_enabled = get_post_meta($product->get_id(), '_apotheca_ar_enabled', true);
        
        if ($ar_enabled == 'yes') {
            echo '<button type="button" class="apotheca-ar-trigger button" data-product-id="' . esc_attr($product->get_id()) . '">
                    Virtual Try-On
                  </button>';
        }
    }
    
    /**
     * Register Elementor widget
     */
    public function register_elementor_widget($widgets_manager) {
        require_once APOTHECA_AR_PLUGIN_DIR . 'includes/elementor-widget.php';
        $widgets_manager->register(new \Apotheca_AR_Elementor_Widget());
    }
    
    /**
     * NOTE:
     * The previous “AR Makeup” admin settings page / CPT-style menu is no longer used.
     * Settings are now driven by WooCommerce Attributes → Face Region mapping.
     */
}

// Initialize plugin
function apotheca_ar_init() {
    return Apotheca_AR_Makeup::get_instance();
}
add_action('plugins_loaded', 'apotheca_ar_init');
