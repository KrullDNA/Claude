<div class="wrap">
    <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin-top: 20px;">
        <h2>🎨 Apotheca AR Makeup Try-On Settings</h2>
        <p>Configure your virtual makeup try-on tool settings below.</p>
        
        <form method="post" action="options.php">
            <?php
            settings_fields('apotheca_ar_settings');
            do_settings_sections('apotheca_ar_settings');
            ?>
            
            <table class="form-table">
                <tr>
                    <th scope="row">
                        <label for="apotheca_ar_default_lipstick">Default Lipstick Color</label>
                    </th>
                    <td>
                        <input type="color" 
                               id="apotheca_ar_default_lipstick" 
                               name="apotheca_ar_default_lipstick" 
                               value="<?php echo esc_attr(get_option('apotheca_ar_default_lipstick', '#ff0000')); ?>">
                        <p class="description">The default color shown when AR loads</p>
                    </td>
                </tr>
                
                <tr>
                    <th scope="row">
                        <label for="apotheca_ar_default_eyeshadow">Default Eyeshadow Color</label>
                    </th>
                    <td>
                        <input type="color" 
                               id="apotheca_ar_default_eyeshadow" 
                               name="apotheca_ar_default_eyeshadow" 
                               value="<?php echo esc_attr(get_option('apotheca_ar_default_eyeshadow', '#8b4513')); ?>">
                        <p class="description">The default eyeshadow color</p>
                    </td>
                </tr>
                
                <tr>
                    <th scope="row">
                        <label for="apotheca_ar_enable_mobile">Enable on Mobile</label>
                    </th>
                    <td>
                        <input type="checkbox" 
                               id="apotheca_ar_enable_mobile" 
                               name="apotheca_ar_enable_mobile" 
                               value="1" 
                               <?php checked(get_option('apotheca_ar_enable_mobile'), 1); ?>>
                        <p class="description">Allow AR try-on on mobile devices (may have performance issues)</p>
                    </td>
                </tr>
            </table>
            
            <?php submit_button(); ?>
        </form>
        
        <hr style="margin: 40px 0;">
        
        <h2>📋 How to Use</h2>
        
        <h3>Method 1: Add to WooCommerce Products</h3>
        <ol>
            <li>Edit any product in WooCommerce</li>
            <li>Scroll to "Product Data" section</li>
            <li>Add custom field: <code>_apotheca_ar_enabled</code> with value <code>yes</code></li>
            <li>The "Virtual Try-On" button will appear on that product page</li>
        </ol>
        
        <h3>Method 2: Use Shortcode Anywhere</h3>
        <p>Add this shortcode to any page or post:</p>
        <code style="background: #f0f0f0; padding: 10px; display: block; margin: 10px 0;">[apotheca_ar_tryon show_button="true"]</code>
        
        <h3>Method 3: Add Button to Elementor</h3>
        <ol>
            <li>Add a Button widget in Elementor</li>
            <li>Set the button text to "Virtual Try-On"</li>
            <li>In the Link field, add: <code>#</code></li>
            <li>In Advanced > Custom CSS Classes, add: <code>apotheca-ar-trigger</code></li>
        </ol>
        
        <hr style="margin: 40px 0;">
        
        <h2>🎯 Roadmap - Coming Soon</h2>
        <ul>
            <li>✨ More makeup types (blush, eyeliner, mascara)</li>
            <li>🎨 Product-specific color mapping</li>
            <li>📸 Screenshot/share functionality</li>
            <li>💄 Custom makeup presets</li>
            <li>📊 Analytics tracking</li>
        </ul>
        
        <hr style="margin: 40px 0;">
        
        <div style="background: #f9f9f9; padding: 20px; border-left: 4px solid #667eea; margin-top: 20px;">
            <h3 style="margin-top: 0;">ℹ️ Technical Information</h3>
            <p><strong>Version:</strong> <?php echo APOTHECA_AR_VERSION; ?></p>
            <p><strong>AR Library:</strong> Jeeliz WebAR Makeup (Open Source)</p>
            <p><strong>Browser Requirements:</strong> Chrome, Firefox, Safari (latest versions)</p>
            <p><strong>Camera Access:</strong> Required for AR functionality</p>
            <p><strong>Support:</strong> For issues, check browser console for errors</p>
        </div>
    </div>
</div>

<style>
.wrap h2 {
    color: #333;
    font-size: 20px;
    margin: 20px 0 10px;
}

.wrap h3 {
    color: #555;
    font-size: 16px;
    margin: 15px 0 10px;
}

.wrap code {
    background: #f0f0f0;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: monospace;
}

.wrap ol, .wrap ul {
    line-height: 1.8;
}
</style>
