<?php
/**
 * WooCommerce Attribute → Face Region mapping
 *
 * Adds a "Face Region" dropdown to Products → Attributes when adding/editing an attribute.
 * Stores the mapping in wp_options as an array keyed by attribute_id (preferred) and by attribute_name (fallback).
 */

if (!defined('ABSPATH')) {
    exit;
}

class Apotheca_AR_Attribute_Face_Region {

    const OPTION_NAME = 'apotheca_ar_attribute_face_regions';
    const NONCE_ACTION = 'apotheca_ar_attribute_face_region';
    const NONCE_NAME = 'apotheca_ar_attribute_face_region_nonce';

    /**
     * Enable debug logging by adding this to wp-config.php or a small MU plugin:
     * add_filter('apotheca_ar_debug', '__return_true');
     */
    private function debug_enabled() {
        return (bool) apply_filters('apotheca_ar_debug', false);
    }

    private function debug_log($message, $context = array()) {
        if (!$this->debug_enabled()) {
            return;
        }

        $line = '[Apotheca AR][Face Region] ' . $message;
        if (!empty($context) && is_array($context)) {
            $line .= ' ' . wp_json_encode($context);
        }

        // Server log only
        error_log($line);
    }

    /**
     * Allowed enum values.
     *
     * Enum: none | lips | eyebrows | eyelash | eyeshadow | eyeliner | blush | concealer | foundation
     *
     * - lips       : Both upper and lower lips; colour must not appear inside the open mouth.
     * - eyebrows   : The eyebrow area.
     * - eyelash    : Applied to the eyelashes of the eye.
     * - eyeshadow  : The upper eyelid area.
     * - eyeliner   : Upper eyelid edge where the eye meets the eyelid.
     * - blush      : The cheeks.
     * - concealer  : The under-eye area.
     * - foundation : Full face from chin to hairline.
     *
     * @return array<string, string> value => label
     */
    public static function get_regions() {
        return array(
            'none'       => __('None', 'apotheca-ar'),
            'lips'       => __('Lips', 'apotheca-ar'),
            'eyebrows'   => __('Eyebrows', 'apotheca-ar'),
            'eyelash'    => __('Eyelash', 'apotheca-ar'),
            'eyeshadow'  => __('Eyeshadow', 'apotheca-ar'),
            'eyeliner'   => __('Eyeliner', 'apotheca-ar'),
            'blush'      => __('Blush', 'apotheca-ar'),
            'concealer'  => __('Concealer', 'apotheca-ar'),
            'foundation' => __('Foundation', 'apotheca-ar'),
        );
    }

    public function __construct() {
        // Add field on Add Attribute screen
        add_action('woocommerce_after_add_attribute_fields', array($this, 'render_add_field'));

        // Add field on Edit Attribute screen
        add_action('woocommerce_after_edit_attribute_fields', array($this, 'render_edit_field'));

        // Save field. Note: updated hook can pass 3 args on some WC versions.
        add_action('woocommerce_attribute_added', array($this, 'handle_attribute_saved'), 10, 2);
        add_action('woocommerce_attribute_updated', array($this, 'handle_attribute_saved'), 10, 3);

        // No admin-page debug notices (logs only when enabled via filter)
    }

    /**
     * Render dropdown on Add Attribute form.
     */
    public function render_add_field() {
        if (!current_user_can('manage_woocommerce')) {
            return;
        }

        $regions = self::get_regions();

        echo '<div class="form-field">';
        echo '<label for="apotheca_ar_face_region">' . esc_html__('Face Region', 'apotheca-ar') . '</label>';
        wp_nonce_field(self::NONCE_ACTION, self::NONCE_NAME);
        echo '<select name="apotheca_ar_face_region" id="apotheca_ar_face_region">';

        foreach ($regions as $value => $label) {
            printf(
                '<option value="%s">%s</option>',
                esc_attr($value),
                esc_html($label)
            );
        }

        echo '</select>';
        echo '<p class="description">' . esc_html__('Choose which part of the face this attribute controls in the AR Try‑On (e.g. Brow colour → Brows).', 'apotheca-ar') . '</p>';
        echo '</div>';
    }

    /**
     * Render dropdown on Edit Attribute form.
     *
     * @param object $attribute Attribute taxonomy object
     */
    public function render_edit_field($attribute) {
        if (!current_user_can('manage_woocommerce')) {
            return;
        }

        // WooCommerce passes different shapes depending on version:
        // - Some versions pass an object with ->attribute_id / ->attribute_name
        // - Others pass an array with ['attribute_id'] / ['attribute_name']
        $attribute_id   = 0;
        $attribute_name = '';
        if (is_array($attribute)) {
            $attribute_id   = isset($attribute['attribute_id']) ? (int) $attribute['attribute_id'] : 0;
            $attribute_name = isset($attribute['attribute_name']) ? (string) $attribute['attribute_name'] : '';
        } elseif (is_object($attribute)) {
            $attribute_id   = isset($attribute->attribute_id) ? (int) $attribute->attribute_id : 0;
            $attribute_name = isset($attribute->attribute_name) ? (string) $attribute->attribute_name : '';
        }

        // On some WooCommerce versions, the callback receives an incomplete shape.
        // The edit screen URL always includes ?edit=<attribute_id>, so use that as a reliable source.
        if (!$attribute_id && isset($_GET['edit'])) {
            $attribute_id = absint($_GET['edit']);
        }

        // Ensure we have the canonical attribute_name (slug) for fallback lookup.
        if ((!$attribute_name || $attribute_name === '') && $attribute_id && function_exists('wc_get_attribute')) {
            $attr_obj = wc_get_attribute($attribute_id);
            if ($attr_obj && !empty($attr_obj->name)) {
                $attribute_name = (string) $attr_obj->name;
            }
        }

        $current = apotheca_ar_get_attribute_face_region($attribute_id, $attribute_name);
        if (!$current) {
            $current = 'none';
        }

        $regions = self::get_regions();
        ?>
        <tr class="form-field">
            <th scope="row" valign="top">
                <label for="apotheca_ar_face_region"><?php echo esc_html__('Face Region', 'apotheca-ar'); ?></label>
            </th>
            <td>
                <?php wp_nonce_field(self::NONCE_ACTION, self::NONCE_NAME); ?>
                <select name="apotheca_ar_face_region" id="apotheca_ar_face_region">
                    <?php foreach ($regions as $value => $label) : ?>
                        <option value="<?php echo esc_attr($value); ?>" <?php selected($current, $value); ?>>
                            <?php echo esc_html($label); ?>
                        </option>
                    <?php endforeach; ?>
                </select>
                <p class="description">
                    <?php echo esc_html__('Choose which part of the face this attribute controls in the AR Try‑On (e.g. Brow colour → Brows).', 'apotheca-ar'); ?>
                </p>
            </td>
        </tr>
        <?php
    }

    /**
     * Save handler for attribute added/updated.
     *
     * @param int   $attribute_id
     * @param array $data
     */
    public function handle_attribute_saved($attribute_id, $data, $old_slug = null) {
        $attribute_id = (int) $attribute_id;

        if (!$attribute_id || !current_user_can('manage_woocommerce')) {
            return;
        }

        $this->debug_log('handle_attribute_saved fired', array(
            'attribute_id' => $attribute_id,
            'request_method' => isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : '',
            'is_ajax' => (defined('DOING_AJAX') && DOING_AJAX) ? 1 : 0,
            'keys' => array_values(array_unique(array_merge(array_keys($_GET), array_keys($_POST), array_keys($_REQUEST)))),
        ));

        // Our field may be submitted via normal POST or WC's AJAX flow.
        // If our nonce is present, verify it. If it's absent, still proceed (WC already verifies its own nonce).
        if (isset($_REQUEST[self::NONCE_NAME])) {
            $nonce = sanitize_text_field(wp_unslash($_REQUEST[self::NONCE_NAME]));
            if (!wp_verify_nonce($nonce, self::NONCE_ACTION)) {
                return;
            }
        }

        $region = isset($_REQUEST['apotheca_ar_face_region']) ? sanitize_text_field(wp_unslash($_REQUEST['apotheca_ar_face_region'])) : '';
        if ($region === '') {
            // Some WC AJAX flows may not include custom fields unless appended.
            // Log it clearly so we can confirm whether admin JS is working.
            $this->debug_log('Missing apotheca_ar_face_region in request', array(
                'action' => isset($_REQUEST['action']) ? sanitize_text_field(wp_unslash($_REQUEST['action'])) : '',
            ));
            $region = 'none';
        }

        $regions = array_keys(self::get_regions());
        if (!in_array($region, $regions, true)) {
            $region = 'none';
        }

        $map = get_option(self::OPTION_NAME, array());
        if (!is_array($map)) {
            $map = array();
        }

        // Preferred: store by attribute ID.
        $map[(string) $attribute_id] = $region;

        // Also store as a per-attribute option. This makes persistence robust even if a host/plugin
        // interferes with array options or object-caching edge cases.
        update_option(self::OPTION_NAME . '_' . (string) $attribute_id, $region, false);

        // Fallback: also store by attribute_name.
        // 1) Best: read from WC after save
        $attr_name = '';
        if (function_exists('wc_get_attribute')) {
            $attr_obj = wc_get_attribute($attribute_id);
            if ($attr_obj && !empty($attr_obj->name)) {
                $attr_name = (string) $attr_obj->name;
            }
        }
        // 2) Next best: posted attribute_name
        if (!$attr_name && isset($_REQUEST['attribute_name'])) {
            $attr_name = (string) wp_unslash($_REQUEST['attribute_name']);
        }
        // 3) Last resort: hook data
        if (!$attr_name && is_array($data) && isset($data['attribute_name'])) {
            $attr_name = (string) $data['attribute_name'];
        }

        $attr_name = sanitize_title($attr_name);
        if ($attr_name) {
            $map['name:' . $attr_name] = $region;
            update_option(self::OPTION_NAME . '_name_' . $attr_name, $region, false);
        }

        update_option(self::OPTION_NAME, $map, false);

        $this->debug_log('Saved region mapping', array(
            'attribute_id' => $attribute_id,
            'region' => $region,
            'attr_name' => $attr_name,
            'option_array_key' => (string) $attribute_id,
        ));
    }
}

/**
 * Helper: Get a face region for a given attribute.
 *
 * @param int    $attribute_id
 * @param string $attribute_name
 * @return string One of the allowed enum values.
 */
function apotheca_ar_get_attribute_face_region($attribute_id = 0, $attribute_name = '') {
    $attribute_id   = (int) $attribute_id;
    $attribute_name = (string) $attribute_name;

    $map = get_option(Apotheca_AR_Attribute_Face_Region::OPTION_NAME, array());
    if (!is_array($map)) {
        $map = array();
    }

    if ($attribute_id) {
        // Preferred: array option by ID.
        if (isset($map[(string) $attribute_id])) {
            return (string) $map[(string) $attribute_id];
        }

        // Fallback: per-attribute option.
        $per = get_option(Apotheca_AR_Attribute_Face_Region::OPTION_NAME . '_' . (string) $attribute_id, '');
        if (is_string($per) && $per !== '') {
            return $per;
        }
    }

    $attr_name = sanitize_title($attribute_name);
    if ($attr_name && isset($map['name:' . $attr_name])) {
        return (string) $map['name:' . $attr_name];
    }

    if ($attr_name) {
        $by_name = get_option(Apotheca_AR_Attribute_Face_Region::OPTION_NAME . '_name_' . $attr_name, null);
        if (is_string($by_name) && $by_name !== '') {
            return $by_name;
        }
    }

    return 'none';
}

// Boot.
new Apotheca_AR_Attribute_Face_Region();
