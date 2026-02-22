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
        <button class="apotheca-ar-close" aria-label="Close AR Try-On"><span class="apotheca-close-icon" aria-hidden="true">&times;</span></button>

        <h2 class="apotheca-modal-title"><?php echo esc_html($modal_title); ?></h2>

        <div class="apotheca-ar-content">
            <!-- Video/Canvas Area -->
            <div class="apotheca-ar-video-wrapper">
                <!--
                  MediaPipe CameraUtils requires a real <video> element to attach the webcam stream.
                  IMPORTANT: Do not use display:none; on some browsers it prevents camera start/metadata events.
                  Keep it off-screen instead.
                -->
                <video
                    id="apotheca-ar-video"
                    autoplay
                    playsinline
                    muted
                    style="position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;"
                ></video>
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

                <div class="apotheca-ar-zoom-control" aria-label="Camera zoom">
                    <div class="apotheca-ar-zoom-row">
                        <span class="apotheca-ar-zoom-label">Zoom</span>
                        <span class="apotheca-ar-zoom-value" id="apotheca-ar-zoom-value">100%</span>
                    </div>
                    <input
                        type="range"
                        id="apotheca-ar-zoom"
                        class="apotheca-ar-zoom"
                        min="1"
                        max="2.5"
                        step="0.01"
                        value="1"
                    />
                </div>

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

							// Honour the custom ordering set in Products > Attributes > Configure terms
							$tax_from_key = (string) $attribute->get_name();
							if ($tax_from_key && taxonomy_exists($tax_from_key)) {
								$term_ids = wc_get_product_terms($product->get_id(), $tax_from_key, array('fields' => 'ids'));
								if (!is_wp_error($term_ids) && !empty($term_ids)) {
									$ordered_terms = get_terms(array(
										'taxonomy'   => $tax_from_key,
										'hide_empty' => false,
										'include'    => $term_ids,
										'orderby'    => 'meta_value_num',
										'meta_key'   => 'order',
										'order'      => 'ASC',
									));

									if (is_wp_error($ordered_terms) || empty($ordered_terms)) {
										$ordered_terms = get_terms(array(
											'taxonomy'   => $tax_from_key,
											'hide_empty' => false,
											'include'    => $term_ids,
											'orderby'    => 'term_order',
											'order'      => 'ASC',
										));
									}
									if (!is_wp_error($ordered_terms) && !empty($ordered_terms)) {
										$terms = $ordered_terms;
									}
								}
							}

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
									$tax_name   = (string) $attribute->get_name(); // e.g. pa_brow
									$attr_label = wc_attribute_label($tax_name);
									$attr_slug  = sanitize_title($tax_name);
									$attr_id    = method_exists($attribute, 'get_id') ? (int) $attribute->get_id() : 0;
									$attr_name  = function_exists('wc_attribute_taxonomy_slug') ? wc_attribute_taxonomy_slug($tax_name) : preg_replace('/^pa_/', '', $tax_name);
									$face_region = function_exists('apotheca_ar_get_attribute_face_region') ? apotheca_ar_get_attribute_face_region($attr_id, $attr_name) : 'none';

									$variations_html .= '<div class="apotheca-variation-swatches" data-face-region="' . esc_attr($face_region) . '">';
                                    $variations_html .= '<h4>' . esc_html($attr_label) . '</h4>';
									$variations_html .= '<div class="apotheca-swatch-list" data-face-region="' . esc_attr($face_region) . '">';

                                    foreach ($terms as $term) {
                                        $swatch_color = get_term_meta($term->term_id, 'fif_swatch_color', true);

                                        if (!empty($swatch_color)) {
											$variations_html .= sprintf(
												'<button type="button" class="apotheca-swatch-btn" data-color="%s" data-name="%s" data-attribute="%s" data-label="%s" data-face-region="%s" title="%s">'
												. '<span class="apotheca-swatch-inner" style="--apotheca-swatch-bg: %s;"><span class="apotheca-swatch-fill"></span></span>'
												. '</button>',
												esc_attr($swatch_color),
												esc_attr($term->name),
												esc_attr($attr_slug),
												esc_attr($term->name),
												esc_attr($face_region),
												esc_attr($term->name),
												esc_attr($swatch_color)
											);
                                        }
                                    }

                                    $variations_html .= '</div>';
                                    // Name label below all swatches for this attribute
                                    $variations_html .= '<div class="apotheca-swatch-active-name"></div>';
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
                        <strong class="apotheca-tips-title"><?php echo esc_html($tips_title); ?></strong>
                    <?php endif; ?>
                    <span class="apotheca-tips-content">
                    <?php
                    // If the editor content contains HTML, render it as formatted content.
                    // Otherwise keep legacy behaviour: each line becomes a bullet.
                    if (preg_match('/<\s*\w+[^>]*>/', $tips_content)) {
                        echo wp_kses_post($tips_content);
                    } else {
                        $lines = explode("\n", $tips_content);
                        foreach ($lines as $line) {
                            $line = trim($line);
                            if (!empty($line)) {
                                echo '&bull; ' . esc_html($line) . '<br>';
                            }
                        }
                    }
                    ?>
                    </span>
                </div>
                <?php endif; ?>
            </div>
        </div>
    </div>
</div>

<?php
// ── Product-level opacity overrides ──────────────────────────────────────────
// Read lip_opacity and blush_opacity custom meta fields (0-100 integers).
// Only regions with an explicit value are included; the JS falls back to the
// Elementor widget setting for any region not present in this object.
$product_styles = array();
if (isset($product) && $product && is_a($product, 'WC_Product')) {
    $product_id = $product->get_id();

    $lip_raw = get_post_meta($product_id, 'lip_opacity', true);
    if ($lip_raw !== '' && $lip_raw !== false && $lip_raw !== null) {
        $lip_val = (int) $lip_raw;
        if ($lip_val >= 0 && $lip_val <= 100) {
            $product_styles['lips'] = array('opacity' => round($lip_val / 100, 4));
        }
    }

    $blush_raw = get_post_meta($product_id, 'blush_opacity', true);
    if ($blush_raw !== '' && $blush_raw !== false && $blush_raw !== null) {
        $blush_val = (int) $blush_raw;
        if ($blush_val >= 0 && $blush_val <= 100) {
            $product_styles['blush'] = array('opacity' => round($blush_val / 100, 4));
        }
    }
}
?>
<script>
// Product-specific opacity overrides (empty object when no meta is set).
// Merged over the Elementor widget defaults in _getRegionStyle().
window.apothecaARProductStyles = <?php echo wp_json_encode(empty($product_styles) ? new stdClass() : $product_styles); ?>;
</script>

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
