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
                
                <!-- Lipstick Controls -->
                <div class="apotheca-control-group">
                    <div class="apotheca-toggle">
                        <input type="checkbox" id="apotheca-enable-lipstick" checked>
                        <label for="apotheca-enable-lipstick">Lipstick</label>
                    </div>
                    
                    <label for="apotheca-lipstick-color">Color</label>
                    <div class="apotheca-color-picker-wrapper">
                        <input type="color" id="apotheca-lipstick-color" value="#ff0000">
                        <span class="apotheca-color-value">#ff0000</span>
                    </div>
                    
                    <div class="apotheca-color-presets">
                        <div class="apotheca-color-preset" style="background: #ff0000;" data-color="#ff0000" data-type="lipstick"></div>
                        <div class="apotheca-color-preset" style="background: #dc143c;" data-color="#dc143c" data-type="lipstick"></div>
                        <div class="apotheca-color-preset" style="background: #8b0000;" data-color="#8b0000" data-type="lipstick"></div>
                        <div class="apotheca-color-preset" style="background: #ff69b4;" data-color="#ff69b4" data-type="lipstick"></div>
                        <div class="apotheca-color-preset" style="background: #ff1493;" data-color="#ff1493" data-type="lipstick"></div>
                        <div class="apotheca-color-preset" style="background: #c71585;" data-color="#c71585" data-type="lipstick"></div>
                    </div>
                </div>
                
                <!-- Eyeshadow Controls -->
                <div class="apotheca-control-group">
                    <div class="apotheca-toggle">
                        <input type="checkbox" id="apotheca-enable-eyeshadow">
                        <label for="apotheca-enable-eyeshadow">Eyeshadow</label>
                    </div>
                    
                    <label for="apotheca-eyeshadow-color">Color</label>
                    <div class="apotheca-color-picker-wrapper">
                        <input type="color" id="apotheca-eyeshadow-color" value="#8b4513">
                        <span class="apotheca-color-value">#8b4513</span>
                    </div>
                    
                    <div class="apotheca-color-presets">
                        <div class="apotheca-color-preset" style="background: #8b4513;" data-color="#8b4513" data-type="eyeshadow"></div>
                        <div class="apotheca-color-preset" style="background: #d2691e;" data-color="#d2691e" data-type="eyeshadow"></div>
                        <div class="apotheca-color-preset" style="background: #cd853f;" data-color="#cd853f" data-type="eyeshadow"></div>
                        <div class="apotheca-color-preset" style="background: #daa520;" data-color="#daa520" data-type="eyeshadow"></div>
                        <div class="apotheca-color-preset" style="background: #9370db;" data-color="#9370db" data-type="eyeshadow"></div>
                        <div class="apotheca-color-preset" style="background: #4169e1;" data-color="#4169e1" data-type="eyeshadow"></div>
                    </div>
                </div>
                
                <!-- Instructions -->
                <div style="margin-top: 20px; padding: 15px; background: rgba(102, 126, 234, 0.1); border-radius: 8px; font-size: 13px; line-height: 1.6;">
                    <strong>💡 Tips:</strong><br>
                    • Make sure you're in good lighting<br>
                    • Keep your face centered in the frame<br>
                    • Try different colors using the pickers<br>
                    • Toggle makeup on/off to compare
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Trigger Button (if using shortcode standalone) -->
<?php if (!empty($atts['show_button'])): ?>
<div class="apotheca-ar-widget">
    <button class="apotheca-ar-open">Try Virtual Makeup</button>
</div>
<?php endif; ?>

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
});
</script>
