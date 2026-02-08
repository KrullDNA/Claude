<?php
/**
 * AR Modal Template
 *
 * Uses $modal_settings when rendered from Elementor widget, falls back to defaults otherwise.
 */
if (!defined('ABSPATH')) {
    exit;
}

// Defaults (used when rendered via shortcode without Elementor)
$modal_title = isset($modal_settings['modal_title']) ? $modal_settings['modal_title'] : 'Virtual Makeup Try-On';
$controls_heading = isset($modal_settings['controls_heading_text']) ? $modal_settings['controls_heading_text'] : 'Makeup Controls';
$show_tips = isset($modal_settings['show_tips_box']) ? $modal_settings['show_tips_box'] : 'yes';
$tips_title = isset($modal_settings['tips_title']) ? $modal_settings['tips_title'] : 'Tips';
$tips_content = isset($modal_settings['tips_content']) ? $modal_settings['tips_content'] : "Make sure you're in good lighting\nKeep your face centered in the frame\nClick product shades above to try different colors\nAllow camera access when prompted";
?>
<!-- Apotheca AR Makeup Try-On Modal -->
<div id="apotheca-ar-modal" class="apotheca-ar-modal">
    <div class="apotheca-ar-container">
        <button class="apotheca-ar-close" aria-label="Close AR Try-On">&times;</button>

        <h2 class="apotheca-modal-title"><?php echo esc_html($modal_title); ?></h2>

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
                <h3><?php echo esc_html($controls_heading); ?></h3>

                <?php
                // Get product variations if on product page
                $show_variations = false;
                $variations_html = '';

                $product = null;

                if (function_exists('is_product') && is_product()) {
                    global $post;
                    if ($post) {
                        $product = wc_get_product($post->ID);
                    }
                }

                if (!$product) {
                    $queried_object = get_queried_object();
                    if ($queried_object && isset($queried_object->ID) && function_exists('wc_get_product')) {
                        $product = wc_get_product($queried_object->ID);
                    }
                }

                if (!$product) {
                    global $product;
                }

                if ($product && is_a($product, 'WC_Product') && $product->is_type('variable')) {
                    $attributes = $product->get_attributes();

                    foreach ($attributes as $attribute) {
                        if ($attribute->is_taxonomy()) {
                            $terms = $attribute->get_terms();

                            if (!empty($terms)) {
                                $has_swatches = false;
                                foreach ($terms as $term) {
                                    if (get_term_meta($term->term_id, 'fif_swatch_color', true)) {
                                        $has_swatches = true;
                                        break;
                                    }
                                }

                                if ($has_swatches) {
                                    $show_variations = true;
                                    $attr_label = wc_attribute_label($attribute->get_name());
                                    $attr_slug = sanitize_title($attribute->get_name());

                                    $variations_html .= '<div class="apotheca-variation-swatches">';
                                    $variations_html .= '<h4>' . esc_html($attr_label) . '</h4>';
                                    $variations_html .= '<div class="apotheca-swatch-list">';

                                    foreach ($terms as $term) {
                                        $swatch_color = get_term_meta($term->term_id, 'fif_swatch_color', true);

                                        if (!empty($swatch_color)) {
                                            $variations_html .= sprintf(
                                                '<button type="button" class="apotheca-swatch-btn" data-color="%s" data-name="%s" data-attribute="%s" style="background-color: %s;" title="%s">' .
                                                '<span class="apotheca-swatch-name">%s</span>' .
                                                '</button>',
                                                esc_attr($swatch_color),
                                                esc_attr($term->name),
                                                esc_attr($attr_slug),
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

                if ($show_variations) {
                    echo $variations_html;
                    echo '<div class="apotheca-control-divider"></div>';
                } elseif (function_exists('current_user_can') && current_user_can('manage_options')) {
                    if (!$product || !is_a($product, 'WC_Product')) {
                        echo '<div style="color: #ff6b6b; font-size: 12px; padding: 10px; background: rgba(255,107,107,0.1); border-radius: 4px; margin-bottom: 15px;">Debug: No product found</div>';
                    } elseif (!$product->is_type('variable')) {
                        echo '<div style="color: #ffa94d; font-size: 12px; padding: 10px; background: rgba(255,169,77,0.1); border-radius: 4px; margin-bottom: 15px;">Debug: Product is not variable (Type: ' . esc_html($product->get_type()) . ')</div>';
                    } else {
                        echo '<div style="color: #ffa94d; font-size: 12px; padding: 10px; background: rgba(255,169,77,0.1); border-radius: 4px; margin-bottom: 15px;">Debug: No swatch colors found in any attributes</div>';
                    }
                }
                ?>

                <!-- Tips Box -->
                <?php if ($show_tips === 'yes' && !empty($tips_content)) : ?>
                <div class="apotheca-tips-box">
                    <?php if (!empty($tips_title)) : ?>
                        <strong><?php echo esc_html($tips_title); ?></strong><br>
                    <?php endif; ?>
                    <?php
                    $lines = explode("\n", $tips_content);
                    foreach ($lines as $line) {
                        $line = trim($line);
                        if (!empty($line)) {
                            echo '&bull; ' . esc_html($line) . '<br>';
                        }
                    }
                    ?>
                </div>
                <?php endif; ?>
            </div>
        </div>
    </div>
</div>

<script>
jQuery(document).ready(function($) {
    // Color picker input display sync
    $('#apotheca-lipstick-color').on('input', function() {
        $(this).siblings('.apotheca-color-value').text($(this).val());
    });

    $('#apotheca-eyeshadow-color').on('input', function() {
        $(this).siblings('.apotheca-color-value').text($(this).val());
    });

    // Preset color clicks
    $('.apotheca-color-preset').on('click', function() {
        var color = $(this).data('color');
        var type = $(this).data('type');

        if (type === 'lipstick') {
            $('#apotheca-lipstick-color').val(color).trigger('change');
            $('#apotheca-lipstick-color').siblings('.apotheca-color-value').text(color);
        } else if (type === 'eyeshadow') {
            $('#apotheca-eyeshadow-color').val(color).trigger('change');
            $('#apotheca-eyeshadow-color').siblings('.apotheca-color-value').text(color);
        }
    });
});
</script>
