<?php
/**
 * WooCommerce Product Meta Box
 * Adds AR Try-On toggle to product edit screen
 */

if (!defined('ABSPATH')) {
    exit;
}

class Apotheca_AR_Product_Meta_Box {
    
    public function __construct() {
        add_action('add_meta_boxes', array($this, 'add_meta_box'));
        add_action('woocommerce_process_product_meta', array($this, 'save_meta_box'));
        
        // Add custom CSS for the meta box styling
        add_action('admin_head', array($this, 'add_meta_box_styles'));
    }
    
    /**
     * Add meta box to product edit screen
     */
    public function add_meta_box() {
        add_meta_box(
            'apotheca_ar_product_settings',
            '<span class="dashicons dashicons-video-alt3" style="margin-right: 5px;"></span> AR Virtual Try-On',
            array($this, 'render_meta_box'),
            'product',
            'side',
            'default'
        );
    }
    
    /**
     * Render meta box content
     */
    public function render_meta_box($post) {
        wp_nonce_field('apotheca_ar_meta_box', 'apotheca_ar_meta_box_nonce');
        
        $enabled = get_post_meta($post->ID, '_apotheca_ar_enabled', true);
        $lipstick_color = get_post_meta($post->ID, '_apotheca_ar_lipstick_color', true);
        $eyeshadow_color = get_post_meta($post->ID, '_apotheca_ar_eyeshadow_color', true);
        
        // Auto-detect colors from variation swatches
        $detected_colors = $this->get_swatch_colors($post->ID);
        $has_swatch_colors = !empty($detected_colors);
        
        ?>
        <div class="apotheca-ar-meta-box">
            <!-- Enable AR Toggle -->
            <div class="apotheca-ar-field">
                <label class="apotheca-ar-toggle-label">
                    <input type="checkbox" 
                           name="_apotheca_ar_enabled" 
                           id="apotheca_ar_enabled" 
                           value="yes" 
                           <?php checked($enabled, 'yes'); ?>
                           class="apotheca-ar-toggle-checkbox">
                    <span class="apotheca-ar-toggle-slider"></span>
                    <span class="apotheca-ar-toggle-text">Enable Virtual Try-On</span>
                </label>
            </div>
            
            <!-- Product-Specific Colors (Optional) -->
            <div id="apotheca-ar-colors" class="apotheca-ar-colors" style="<?php echo ($enabled === 'yes') ? '' : 'display:none;'; ?>">
                
                <?php if ($has_swatch_colors) : ?>
                    <!-- Show detected swatch colors -->
                    <div class="apotheca-ar-success-box">
                        <span class="dashicons dashicons-yes-alt"></span>
                        <div>
                            <p><strong>✨ Variation Swatch Colors Detected!</strong></p>
                            <p>Your existing color swatches will be used automatically for AR try-on. No need to enter colors again!</p>
                        </div>
                    </div>
                    
                    <div class="apotheca-ar-detected-colors">
                        <h4>Available Colors from Variation Swatches:</h4>
                        <?php 
                        // Group colors by attribute for better organization
                        $grouped_colors = array();
                        foreach ($detected_colors as $color_data) {
                            $attr_name = isset($color_data['attribute']) ? $color_data['attribute'] : 'Unknown';
                            if (!isset($grouped_colors[$attr_name])) {
                                $grouped_colors[$attr_name] = array();
                            }
                            $grouped_colors[$attr_name][] = $color_data;
                        }
                        
                        foreach ($grouped_colors as $attr_name => $colors) : ?>
                            <div class="apotheca-ar-attribute-group">
                                <div class="apotheca-ar-attribute-label">
                                    <?php echo esc_html(ucfirst(str_replace(['pa_', '-', '_'], ['', ' ', ' '], $attr_name))); ?>
                                </div>
                                <?php foreach ($colors as $color_data) : ?>
                                    <div class="apotheca-ar-color-item">
                                        <span class="apotheca-ar-color-preview" style="background-color: <?php echo esc_attr($color_data['hex']); ?>"></span>
                                        <span class="apotheca-ar-color-name"><?php echo esc_html($color_data['name']); ?></span>
                                        <span class="apotheca-ar-color-hex"><?php echo esc_html($color_data['hex']); ?></span>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        <?php endforeach; ?>
                    </div>
                    
                    <p class="apotheca-ar-description" style="margin-top: 15px;">
                        <strong>How it works:</strong> When customers select a color variation, that exact hex color will be applied in the AR try-on automatically.
                    </p>
                    
                <?php else : ?>
                    <!-- No swatches detected - show manual color pickers -->
                    <p class="apotheca-ar-description">
                        <strong>Optional:</strong> Set specific colors for this product. Leave empty to use default AR colors.
                    </p>
                    
                    <div class="apotheca-ar-field">
                        <label for="apotheca_ar_lipstick_color">
                            <span class="dashicons dashicons-admin-customizer"></span>
                            Lipstick Color
                        </label>
                        <div class="apotheca-ar-color-picker-wrap">
                            <input type="color" 
                                   name="_apotheca_ar_lipstick_color" 
                                   id="apotheca_ar_lipstick_color"
                                   value="<?php echo esc_attr($lipstick_color ? $lipstick_color : '#ff0000'); ?>"
                                   class="apotheca-ar-color-input">
                            <input type="text" 
                                   value="<?php echo esc_attr($lipstick_color); ?>" 
                                   placeholder="Default color"
                                   class="apotheca-ar-color-text"
                                   readonly>
                        </div>
                        <button type="button" class="button button-small apotheca-clear-color" data-target="lipstick">
                            Clear
                        </button>
                    </div>
                    
                    <div class="apotheca-ar-field">
                        <label for="apotheca_ar_eyeshadow_color">
                            <span class="dashicons dashicons-admin-customizer"></span>
                            Eyeshadow Color
                        </label>
                        <div class="apotheca-ar-color-picker-wrap">
                            <input type="color" 
                                   name="_apotheca_ar_eyeshadow_color" 
                                   id="apotheca_ar_eyeshadow_color"
                                   value="<?php echo esc_attr($eyeshadow_color ? $eyeshadow_color : '#8b4513'); ?>"
                                   class="apotheca-ar-color-input">
                            <input type="text" 
                                   value="<?php echo esc_attr($eyeshadow_color); ?>" 
                                   placeholder="Default color"
                                   class="apotheca-ar-color-text"
                                   readonly>
                        </div>
                        <button type="button" class="button button-small apotheca-clear-color" data-target="eyeshadow">
                            Clear
                        </button>
                    </div>
                    
                    <div class="apotheca-ar-info-box">
                        <span class="dashicons dashicons-info"></span>
                        <p>When customers use AR try-on, these specific colors will be applied automatically.</p>
                    </div>
                <?php endif; ?>
            </div>
        </div>
        
        <script>
        jQuery(document).ready(function($) {
            // Toggle color fields visibility
            $('#apotheca_ar_enabled').on('change', function() {
                if ($(this).is(':checked')) {
                    $('#apotheca-ar-colors').slideDown();
                } else {
                    $('#apotheca-ar-colors').slideUp();
                }
            });
            
            // Update text input when color changes
            $('.apotheca-ar-color-input').on('change', function() {
                $(this).siblings('.apotheca-ar-color-text').val($(this).val());
            });
            
            // Clear color button
            $('.apotheca-clear-color').on('click', function() {
                var target = $(this).data('target');
                var input = $('#apotheca_ar_' + target + '_color');
                var textInput = input.siblings('.apotheca-ar-color-text');
                
                textInput.val('');
                input.val(target === 'lipstick' ? '#ff0000' : '#8b4513');
            });
        });
        </script>
        <?php
    }
    
    /**
     * Save meta box data
     */
    public function save_meta_box($post_id) {
        // Check nonce
        if (!isset($_POST['apotheca_ar_meta_box_nonce']) || 
            !wp_verify_nonce($_POST['apotheca_ar_meta_box_nonce'], 'apotheca_ar_meta_box')) {
            return;
        }
        
        // Check autosave
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
            return;
        }
        
        // Check permissions
        if (!current_user_can('edit_post', $post_id)) {
            return;
        }
        
        // Save enabled status
        $enabled = isset($_POST['_apotheca_ar_enabled']) ? 'yes' : 'no';
        update_post_meta($post_id, '_apotheca_ar_enabled', $enabled);
        
        // Save lipstick color (only if not empty)
        if (isset($_POST['_apotheca_ar_lipstick_color']) && !empty($_POST['_apotheca_ar_lipstick_color'])) {
            $lipstick_color = sanitize_hex_color($_POST['_apotheca_ar_lipstick_color']);
            update_post_meta($post_id, '_apotheca_ar_lipstick_color', $lipstick_color);
        } else {
            delete_post_meta($post_id, '_apotheca_ar_lipstick_color');
        }
        
        // Save eyeshadow color (only if not empty)
        if (isset($_POST['_apotheca_ar_eyeshadow_color']) && !empty($_POST['_apotheca_ar_eyeshadow_color'])) {
            $eyeshadow_color = sanitize_hex_color($_POST['_apotheca_ar_eyeshadow_color']);
            update_post_meta($post_id, '_apotheca_ar_eyeshadow_color', $eyeshadow_color);
        } else {
            delete_post_meta($post_id, '_apotheca_ar_eyeshadow_color');
        }
    }
    
    /**
     * Get swatch colors from product variations
     */
    private function get_swatch_colors($product_id) {
        $product = wc_get_product($product_id);
        $colors = array();
        
        if (!$product || !$product->is_type('variable')) {
            return $colors;
        }
        
        // Get ALL product attributes
        $attributes = $product->get_attributes();
        
        foreach ($attributes as $attribute) {
            // Check ALL attributes (not just color-related)
            // This gives you flexibility to name attributes however you want
            // (foundation, brow, lip, cheek, etc.)
            
            if ($attribute->is_taxonomy()) {
                $terms = $attribute->get_terms();
                
                foreach ($terms as $term) {
                    // Get swatch color from variation swatches plugin
                    $swatch_color = get_term_meta($term->term_id, 'fif_swatch_color', true);
                    
                    if (!empty($swatch_color)) {
                        $colors[] = array(
                            'name' => $term->name,
                            'hex' => $swatch_color,
                            'term_id' => $term->term_id,
                            'attribute' => $attribute->get_name() // Include attribute name for context
                        );
                    }
                }
            }
        }
        
        return $colors;
    }
    
    /**
     * Add custom styles for meta box
     */
    public function add_meta_box_styles() {
        global $typenow;
        
        if ($typenow !== 'product') {
            return;
        }
        ?>
        <style>
            .apotheca-ar-meta-box {
                margin: -12px -12px 0;
                padding: 12px;
            }
            
            .apotheca-ar-field {
                margin-bottom: 15px;
            }
            
            .apotheca-ar-field label {
                display: block;
                margin-bottom: 8px;
                font-weight: 600;
                color: #1d2327;
            }
            
            .apotheca-ar-field label .dashicons {
                font-size: 16px;
                width: 16px;
                height: 16px;
                vertical-align: middle;
                color: #667eea;
            }
            
            /* Toggle Switch */
            .apotheca-ar-toggle-label {
                display: flex;
                align-items: center;
                cursor: pointer;
                user-select: none;
                margin: 0;
                padding: 10px;
                background: #f6f7f7;
                border-radius: 6px;
                transition: background 0.3s;
            }
            
            .apotheca-ar-toggle-label:hover {
                background: #e8e9ea;
            }
            
            .apotheca-ar-toggle-checkbox {
                position: absolute;
                opacity: 0;
                cursor: pointer;
                height: 0;
                width: 0;
            }
            
            .apotheca-ar-toggle-slider {
                position: relative;
                display: inline-block;
                width: 44px;
                height: 24px;
                background-color: #ccc;
                border-radius: 12px;
                transition: background-color 0.3s;
                margin-right: 10px;
                flex-shrink: 0;
            }
            
            .apotheca-ar-toggle-slider::before {
                content: '';
                position: absolute;
                height: 18px;
                width: 18px;
                left: 3px;
                bottom: 3px;
                background-color: white;
                border-radius: 50%;
                transition: transform 0.3s;
            }
            
            .apotheca-ar-toggle-checkbox:checked + .apotheca-ar-toggle-slider {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            
            .apotheca-ar-toggle-checkbox:checked + .apotheca-ar-toggle-slider::before {
                transform: translateX(20px);
            }
            
            .apotheca-ar-toggle-text {
                font-weight: 600;
                color: #1d2327;
                flex-grow: 1;
            }
            
            /* Colors Section */
            .apotheca-ar-colors {
                margin-top: 15px;
                padding-top: 15px;
                border-top: 1px solid #dcdcde;
            }
            
            .apotheca-ar-description {
                font-size: 12px;
                color: #646970;
                margin: 0 0 15px 0;
                line-height: 1.5;
            }
            
            .apotheca-ar-color-picker-wrap {
                display: flex;
                gap: 8px;
                margin-bottom: 8px;
            }
            
            .apotheca-ar-color-input {
                width: 60px;
                height: 38px;
                border: 1px solid #dcdcde;
                border-radius: 4px;
                cursor: pointer;
                padding: 0;
            }
            
            .apotheca-ar-color-input::-webkit-color-swatch-wrapper {
                padding: 2px;
            }
            
            .apotheca-ar-color-input::-webkit-color-swatch {
                border: none;
                border-radius: 2px;
            }
            
            .apotheca-ar-color-text {
                flex: 1;
                height: 38px;
                padding: 0 12px;
                border: 1px solid #dcdcde;
                border-radius: 4px;
                background: #f6f7f7;
                font-family: monospace;
                font-size: 13px;
                color: #646970;
            }
            
            .apotheca-clear-color {
                margin-left: 0 !important;
            }
            
            /* Info Box */
            .apotheca-ar-info-box {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                padding: 10px;
                background: #f0f6fc;
                border-left: 3px solid #667eea;
                border-radius: 4px;
                margin-top: 15px;
            }
            
            .apotheca-ar-info-box .dashicons {
                color: #667eea;
                flex-shrink: 0;
                margin-top: 2px;
            }
            
            .apotheca-ar-info-box p {
                margin: 0;
                font-size: 12px;
                line-height: 1.5;
                color: #1d2327;
            }
            
            /* Success Box */
            .apotheca-ar-success-box {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                padding: 12px;
                background: #e7f7e7;
                border-left: 4px solid #00a32a;
                border-radius: 4px;
                margin-bottom: 15px;
            }
            
            .apotheca-ar-success-box .dashicons {
                color: #00a32a;
                font-size: 24px;
                width: 24px;
                height: 24px;
                flex-shrink: 0;
            }
            
            .apotheca-ar-success-box p {
                margin: 0 0 5px 0;
                font-size: 13px;
                line-height: 1.5;
                color: #1d2327;
            }
            
            .apotheca-ar-success-box p:last-child {
                margin-bottom: 0;
            }
            
            /* Detected Colors Display */
            .apotheca-ar-detected-colors {
                margin: 15px 0;
                padding: 12px;
                background: #f9f9f9;
                border-radius: 6px;
            }
            
            .apotheca-ar-detected-colors h4 {
                margin: 0 0 10px 0;
                font-size: 13px;
                font-weight: 600;
                color: #1d2327;
            }
            
            .apotheca-ar-attribute-group {
                margin-bottom: 15px;
            }
            
            .apotheca-ar-attribute-group:last-child {
                margin-bottom: 0;
            }
            
            .apotheca-ar-attribute-label {
                font-size: 12px;
                font-weight: 600;
                color: #667eea;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 8px;
                padding: 4px 0;
                border-bottom: 2px solid #667eea;
            }
            
            .apotheca-ar-color-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 8px;
                margin-bottom: 8px;
                background: white;
                border: 1px solid #dcdcde;
                border-radius: 4px;
            }
            
            .apotheca-ar-color-item:last-child {
                margin-bottom: 0;
            }
            
            .apotheca-ar-color-preview {
                width: 32px;
                height: 32px;
                border-radius: 4px;
                border: 2px solid #dcdcde;
                flex-shrink: 0;
                box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
            }
            
            .apotheca-ar-color-name {
                flex: 1;
                font-weight: 500;
                font-size: 13px;
                color: #1d2327;
            }
            
            .apotheca-ar-color-hex {
                font-family: monospace;
                font-size: 12px;
                color: #646970;
                background: #f0f0f1;
                padding: 4px 8px;
                border-radius: 3px;
            }
            
            #apotheca_ar_product_settings h2.hndle {
                display: flex;
                align-items: center;
            }
            
            #apotheca_ar_product_settings h2.hndle .dashicons {
                color: #667eea;
                margin-right: 5px;
            }
        </style>
        <?php
    }
}

// Initialize
new Apotheca_AR_Product_Meta_Box();
