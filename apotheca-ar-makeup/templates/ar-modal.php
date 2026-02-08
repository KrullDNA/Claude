<!-- Apotheca AR Makeup Try-On Modal -->
<div id="apotheca-ar-modal" class="apotheca-ar-modal">
    <div class="apotheca-ar-container">
        <button class="apotheca-ar-close" aria-label="Close AR Try-On">&times;</button>
        
        <h2 style="color: white; margin-top: 0;">Virtual Makeup Try-On</h2>
        
        <div class="apotheca-ar-content">
            <!-- Video/Canvas Area -->
            <div class="apotheca-ar-video-wrapper">
                <canvas id="apotheca-ar-canvas"></canvas>
                <div id="apotheca-ar-loading">
                    <div class="apotheca-ar-spinner"></div>
                    <p>Loading AR system...</p>
                    <p style="font-size: 12px; margin-top: 10px;">Please allow camera access</p>
                </div>
            </div>
            
            <!-- Controls Panel -->
            <div class="apotheca-ar-controls">
                <h3>Makeup Controls</h3>
                
                <?php
                // Get product variations if on product page
                $show_variations = false;
                $variations_html = '';
                
                // Try multiple ways to get product (Elementor builds pages differently)
                $product = null;
                
                if (is_product()) {
                    // Standard product page
                    global $post;
                    if ($post) {
                        $product = wc_get_product($post->ID);
                    }
                }
                
                // Fallback: try from query vars
                if (!$product) {
                    $queried_object = get_queried_object();
                    if ($queried_object && isset($queried_object->ID)) {
                        $product = wc_get_product($queried_object->ID);
                    }
                }
                
                // Another fallback: from global $product
                if (!$product) {
                    global $product;
                }
                
                if ($product && $product->is_type('variable')) {
                        $attributes = $product->get_attributes();
                        
                        foreach ($attributes as $attribute) {
                            // Accept ALL taxonomy attributes
                            if ($attribute->is_taxonomy()) {
                                $terms = $attribute->get_terms();
                                
                                if (!empty($terms)) {
                                    // Check if ANY term has a swatch color
                                    $has_swatches = false;
                                    foreach ($terms as $term) {
                                        if (get_term_meta($term->term_id, 'fif_swatch_color', true)) {
                                            $has_swatches = true;
                                            break;
                                        }
                                    }
                                    
                                    if ($has_swatches) {
                                        $show_variations = true;
                                        
                                        // Get the attribute label (Mascara, Brow, etc.)
                                        $attr_label = wc_attribute_label($attribute->get_name());
                                        
                                        $variations_html .= '<div class="apotheca-variation-swatches">';
                                        $variations_html .= '<h4>' . esc_html($attr_label) . '</h4>';
                                        $variations_html .= '<div class="apotheca-swatch-list">';
                                        
                                        foreach ($terms as $term) {
                                            $swatch_color = get_term_meta($term->term_id, 'fif_swatch_color', true);
                                            
                                            if (!empty($swatch_color)) {
                                                $variations_html .= sprintf(
                                                    '<button type="button" class="apotheca-swatch-btn" data-color="%s" data-name="%s" style="background-color: %s;" title="%s">
                                                        <span class="apotheca-swatch-name">%s</span>
                                                    </button>',
                                                    esc_attr($swatch_color),
                                                    esc_attr($term->name),
                                                    esc_attr($swatch_color),
                                                    esc_attr($term->name),
                                                    esc_html($term->name)
                                                );
                                            }
                                        }
                                        
                                        $variations_html .= '</div>';
                                        $variations_html .= '</div>';
                                    }
                                }
                            }
                        }
                }
                
                // Show product variations if available
                if ($show_variations) {
                    echo $variations_html;
                    echo '<div class="apotheca-control-divider"></div>';
                } else {
                    // Debug: show why variations aren't showing
                    if (current_user_can('manage_options')) {
                        if (!$product) {
                            echo '<div style="color: #ff6b6b; font-size: 12px; padding: 10px; background: rgba(255,107,107,0.1); border-radius: 4px; margin-bottom: 15px;">Debug: No product found</div>';
                        } elseif (!$product->is_type('variable')) {
                            echo '<div style="color: #ffa94d; font-size: 12px; padding: 10px; background: rgba(255,169,77,0.1); border-radius: 4px; margin-bottom: 15px;">Debug: Product is not variable (Type: ' . $product->get_type() . ')</div>';
                        } else {
                            echo '<div style="color: #ffa94d; font-size: 12px; padding: 10px; background: rgba(255,169,77,0.1); border-radius: 4px; margin-bottom: 15px;">Debug: No swatch colors found in any attributes</div>';
                        }
                    }
                }
                ?>
                
                <!-- Instructions -->
                <div style="margin-top: 20px; padding: 15px; background: rgba(102, 126, 234, 0.1); border-radius: 8px; font-size: 13px; line-height: 1.6;">
                    <strong>💡 Tips:</strong><br>
                    • Make sure you're in good lighting<br>
                    • Keep your face centered in the frame<br>
                    • Click product shades above to try different colors<br>
                    • Allow camera access when prompted
                </div>
            </div>
        </div>
    </div>
</div>

<script>
// Update color value display
jQuery(document).ready(function($) {
    $('#apotheca-lipstick-color').on('input', function() {
        $(this).siblings('.apotheca-color-value').text($(this).val());
    });
    
    $('#apotheca-eyeshadow-color').on('input', function() {
        $(this).siblings('.apotheca-color-value').text($(this).val());
    });
    
    // Preset color clicks
    $('.apotheca-color-preset').on('click', function() {
        const color = $(this).data('color');
        const type = $(this).data('type');
        
        if (type === 'lipstick') {
            $('#apotheca-lipstick-color').val(color).trigger('change');
            $('#apotheca-lipstick-color').siblings('.apotheca-color-value').text(color);
        } else if (type === 'eyeshadow') {
            $('#apotheca-eyeshadow-color').val(color).trigger('change');
            $('#apotheca-eyeshadow-color').siblings('.apotheca-color-value').text(color);
        }
    });
    
    // Product swatch clicks in modal
    $('.apotheca-swatch-btn').on('click', function() {
        const color = $(this).data('color');
        const name = $(this).data('name');
        
        // Remove active class from all swatches
        $('.apotheca-swatch-btn').removeClass('active');
        // Add active class to clicked swatch
        $(this).addClass('active');
        
        // Update lipstick color
        $('#apotheca-lipstick-color').val(color).trigger('change');
        $('#apotheca-lipstick-color').siblings('.apotheca-color-value').text(color);
        
        console.log('Applied product shade:', name, color);
    });
});
</script>
