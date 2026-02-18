<?php
/**
 * AR Widget Template (shortcode version)
 */
if (!defined('ABSPATH')) {
    exit;
}
?>
<!-- Include AR Modal -->
<?php
$modal_settings = [
    'modal_title' => 'Virtual Makeup Try-On',
    'controls_heading_text' => 'Makeup Controls',
    'show_tips_box' => 'yes',
    'tips_title' => 'Tips',
    'tips_content' => "Make sure you're in good lighting\nKeep your face centered in the frame\nClick product shades above to try different colors\nAllow camera access when prompted",
];
include APOTHECA_AR_PLUGIN_DIR . 'templates/ar-modal.php';
?>

<!-- Trigger Button (if using shortcode standalone) -->
<?php if (!empty($atts['show_button'])) : ?>
<div class="apotheca-ar-widget">
    <button class="apotheca-ar-open">Try Virtual Makeup</button>
</div>
<?php endif; ?>
