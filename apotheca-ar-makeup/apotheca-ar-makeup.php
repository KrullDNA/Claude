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
define('APOTHECA_AR_VERSION', '1.0.0');
define('APOTHECA_AR_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('APOTHECA_AR_PLUGIN_URL', plugin_dir_url(__FILE__));

// Include required files
require_once APOTHECA_AR_PLUGIN_DIR . 'includes/product-meta-box.php';

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
        add_shortcode('apotheca_ar_tryon', array($this, 'render_ar_widget'));
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        
        // Register Elementor widget
        add_action('elementor/widgets/register', array($this, 'register_elementor_widget'));
        
        // Note: Removed auto-add button from WooCommerce products
        // Use Elementor widget or shortcode instead
    }
    
    /**
     * Enqueue scripts and styles
     */
    public function enqueue_scripts() {
        // Enqueue CSS
        wp_enqueue_style(
            'apotheca-ar-styles',
            APOTHECA_AR_PLUGIN_URL . 'assets/css/apotheca-ar.css',
            array(),
            APOTHECA_AR_VERSION
        );
        
        // Enqueue Jeeliz Face Filter library
        // Check if local files exist, otherwise use CDN
        $jeeliz_local_path = APOTHECA_AR_PLUGIN_DIR . 'assets/lib/jeelizFaceFilter.js';
        
        if (file_exists($jeeliz_local_path)) {
            // Load from local files (preferred)
            wp_enqueue_script(
                'jeeliz-facefilter',
                APOTHECA_AR_PLUGIN_URL . 'assets/lib/jeelizFaceFilter.js',
                array(),
                '6.0.0',
                false
            );
        } else {
            // Fallback to CDN if local files not downloaded yet
            wp_enqueue_script(
                'jeeliz-facefilter',
                'https://cdn.jsdelivr.net/gh/jeeliz/jeelizFaceFilter@master/dist/jeelizFaceFilter.js',
                array(),
                '6.0.0',
                false
            );
        }
        
        // Enqueue our custom AR script
        wp_enqueue_script(
            'apotheca-ar-script',
            APOTHECA_AR_PLUGIN_URL . 'assets/js/apotheca-ar.js',
            array('jquery', 'jeeliz-facefilter'),
            APOTHECA_AR_VERSION,
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
     * Add admin menu
     */
    public function add_admin_menu() {
        add_menu_page(
            'Apotheca AR Settings',
            'AR Makeup',
            'manage_options',
            'apotheca-ar-settings',
            array($this, 'render_admin_page'),
            'dashicons-visibility',
            30
        );
    }
    
    /**
     * Register settings
     */
    public function register_settings() {
        register_setting('apotheca_ar_settings', 'apotheca_ar_default_lipstick');
        register_setting('apotheca_ar_settings', 'apotheca_ar_default_eyeshadow');
        register_setting('apotheca_ar_settings', 'apotheca_ar_enable_mobile');
    }
    
    /**
     * Render admin page
     */
    public function render_admin_page() {
        include APOTHECA_AR_PLUGIN_DIR . 'templates/admin-settings.php';
    }
}

// Initialize plugin
function apotheca_ar_init() {
    return Apotheca_AR_Makeup::get_instance();
}
add_action('plugins_loaded', 'apotheca_ar_init');
