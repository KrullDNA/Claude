/**
 * Apotheca AR Makeup Try-On
 * Main JavaScript file
 */

(function($) {
    'use strict';

    let arInstance = null;
    let isInitialized = false;

    const ApothecaAR = {
        
        selectedSwatchColor: null,
        
        /**
         * Initialize AR system
         */
        init: function() {
            this.setupEventListeners();
            
            // If swatch colors available, listen for variation changes
            if (apothecaAR.swatchColorsAvailable) {
                this.setupVariationListener();
            }
        },

        /**
         * Setup variation change listener
         */
        setupVariationListener: function() {
            const self = this;
            
            // Listen for WooCommerce variation selection
            $('.variations_form').on('found_variation', function(event, variation) {
                // Detect swatch color from the selected variation
                self.detectSwatchColor();
            });
            
            // Also listen for variation reset
            $('.variations_form').on('reset_data', function() {
                self.selectedSwatchColor = null;
            });
        },
        
        /**
         * Detect swatch color from currently selected variation
         */
        detectSwatchColor: function() {
            // Look for the selected swatch (variation swatches plugin creates these)
            const selectedSwatch = $('.fif-vse-swatch.fif-vse-selected');
            
            if (selectedSwatch.length > 0) {
                // Get the background color or data attribute
                let swatchColor = selectedSwatch.css('background-color');
                
                // Convert RGB to hex
                if (swatchColor) {
                    swatchColor = this.rgbToHex(swatchColor);
                    this.selectedSwatchColor = swatchColor;
                    console.log('Detected swatch color:', swatchColor);
                }
            }
        },
        
        /**
         * Convert RGB color to hex
         */
        rgbToHex: function(rgb) {
            // Handle already hex colors
            if (rgb.charAt(0) === '#') {
                return rgb;
            }
            
            // Parse rgb(r, g, b) format
            const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
            if (!match) {
                return rgb;
            }
            
            function hex(x) {
                return ("0" + parseInt(x).toString(16)).slice(-2);
            }
            
            return "#" + hex(match[1]) + hex(match[2]) + hex(match[3]);
        },

        /**
         * Setup event listeners
         */
        setupEventListeners: function() {
            // Trigger AR modal when button is clicked
            $(document).on('click', '.apotheca-ar-trigger, .apotheca-ar-open', function(e) {
                e.preventDefault();
                ApothecaAR.openARModal();
            });

            // Close modal
            $(document).on('click', '.apotheca-ar-close', function() {
                ApothecaAR.closeARModal();
            });
            
            // Product swatch clicks in modal
            $(document).on('click', '.apotheca-swatch-btn', function() {
                const color = $(this).data('color');
                const name = $(this).data('name');
                
                // Remove active class from all swatches
                $('.apotheca-swatch-btn').removeClass('active');
                // Add active class to clicked swatch
                $(this).addClass('active');
                
                // Apply the color to lipstick
                ApothecaAR.updateMakeup('lipstick', color);
                
                // Store this as the selected swatch color
                ApothecaAR.selectedSwatchColor = color;
                
                console.log('Applied product shade:', name, color);
            });
        },

        /**
         * Open AR modal
         */
        openARModal: function() {
            const modal = $('#apotheca-ar-modal');
            
            if (modal.length === 0) {
                console.error('AR modal not found');
                return;
            }

            modal.fadeIn(300);
            $('body').addClass('apotheca-ar-active');

            // Initialize AR if not already done
            // Wait for modal animation to complete before initializing
            if (!isInitialized) {
                console.log('📹 Modal opened, waiting 400ms for animation to complete...');
                setTimeout(function() {
                    console.log('📹 Animation complete, checking for Jeeliz library...');
                    // Check if Jeeliz library is loaded, wait if not
                    ApothecaAR.waitForJeelizAndInitialize();
                }, 400); // Wait slightly longer than fade animation
            }
        },
        
        /**
         * Wait for Jeeliz library to load, then initialize
         */
        waitForJeelizAndInitialize: function() {
            const self = this;
            let attempts = 0;
            const maxAttempts = 20; // Try for 10 seconds (500ms x 20)
            
            console.log('Starting Jeeliz library check...');
            console.log('Checking if script tag exists:', !!document.querySelector('script[src*="jeeliz"]'));
            
            function checkAndInit() {
                attempts++;
                
                if (typeof JEELIZFACEFILTER !== 'undefined') {
                    // Library loaded!
                    console.log('✅ Jeeliz library loaded successfully after', attempts, 'attempts');
                    console.log('🎬 Calling initializeAR()...');
                    self.initializeAR();
                } else if (attempts < maxAttempts) {
                    // Try again in 500ms
                    if (attempts === 1 || attempts % 5 === 0) {
                        console.log('⏳ Waiting for Jeeliz library... attempt', attempts + '/' + maxAttempts);
                    }
                    setTimeout(checkAndInit, 500);
                } else {
                    // Give up after 10 seconds
                    console.error('❌ Jeeliz library failed to load after', attempts, 'attempts');
                    console.error('Possible causes:');
                    console.error('1. Ad blocker blocking cdn.jsdelivr.net');
                    console.error('2. Content Security Policy (CSP) blocking external scripts');
                    console.error('3. Slow/failed network connection');
                    console.error('4. Firewall blocking CDN');
                    
                    // Check network tab
                    console.error('Check Network tab (F12) for failed requests to jsdelivr.net');
                    
                    $('#apotheca-ar-loading').html(
                        '<div style="text-align: center; padding: 20px;">' +
                        '<p style="color: #ff6b6b; font-size: 16px; margin-bottom: 15px;">❌ AR library failed to load.</p>' +
                        '<p style="font-size: 13px; margin-bottom: 15px;">Please check:</p>' +
                        '<ul style="text-align: left; font-size: 12px; line-height: 1.8; margin-bottom: 15px;">' +
                        '<li>✓ Internet connection is working</li>' +
                        '<li>✓ Ad blockers are disabled</li>' +
                        '<li>✓ Firewall allows cdn.jsdelivr.net</li>' +
                        '<li>✓ Browser console (F12) for errors</li>' +
                        '</ul>' +
                        '<button onclick="location.reload()" style="margin-top: 10px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">🔄 Refresh Page</button>' +
                        '</div>'
                    );
                }
            }
            
            // Start checking
            checkAndInit();
        },

        /**
         * Close AR modal
         */
        closeARModal: function() {
            $('#apotheca-ar-modal').fadeOut(300);
            $('body').removeClass('apotheca-ar-active');
            
            // Stop video stream
            if (arInstance) {
                try {
                    JEELIZFACEFILTER.destroy();
                    isInitialized = false;
                    arInstance = null;
                } catch(e) {
                    console.log('Error destroying AR:', e);
                }
            }
        },

        /**
         * Initialize Jeeliz WebAR Makeup
         */
        initializeAR: function() {
            console.log('📹 ============ initializeAR CALLED ============');
            console.log('📹 Looking for canvas element: apotheca-ar-canvas');
            
            const canvas = document.getElementById('apotheca-ar-canvas');
            
            console.log('📹 Canvas found:', canvas);
            
            if (!canvas) {
                console.error('❌ Canvas not found');
                $('#apotheca-ar-loading').html('<p style="color: #ff6b6b;">Error: Canvas not found</p>');
                return;
            }
            
            console.log('✅ Canvas OK, checking library...');
            
            // Check canvas dimensions and visibility
            console.log('📹 Canvas dimensions:', canvas.width, 'x', canvas.height);
            console.log('📹 Canvas style:', window.getComputedStyle(canvas).display);
            console.log('📹 Canvas offsetWidth:', canvas.offsetWidth, 'offsetHeight:', canvas.offsetHeight);
            console.log('📹 Canvas parent:', canvas.parentElement);
            
            // CRITICAL FIX: Make canvas internal dimensions match CSS size
            // WebGL requires these to match!
            if (canvas.offsetWidth > 0 && canvas.offsetHeight > 0) {
                console.log('📹 Setting canvas internal dimensions to match CSS size...');
                canvas.width = canvas.offsetWidth;
                canvas.height = canvas.offsetHeight;
                console.log('✅ Canvas resized to:', canvas.width, 'x', canvas.height);
            } else {
                // Fallback to standard size if offset is 0
                console.warn('⚠️ Canvas has zero offset dimensions, using defaults...');
                canvas.width = 640;
                canvas.height = 480;
            }
            
            // Check if Jeeliz library is loaded
            if (typeof JEELIZFACEFILTER === 'undefined') {
                console.error('❌ Jeeliz library not loaded');
                $('#apotheca-ar-loading').html('<p style="color: #ff6b6b;">Error: AR library not loaded. Please refresh the page.</p>');
                return;
            }

            console.log('✅ Library OK, showing loading screen...');
            
            // Test WebGL availability
            const testGL = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            console.log('📹 WebGL context available:', testGL ? 'YES' : 'NO');
            if (!testGL) {
                console.error('❌ WebGL not available!');
                $('#apotheca-ar-loading').html('<p style="color: #ff6b6b;">WebGL not available in your browser. Please use Chrome, Firefox, or Safari.</p>');
                return;
            }
            console.log('✅ WebGL OK');

            // Show loading
            $('#apotheca-ar-loading').show();

            console.log('📹 Initializing JEELIZFACEFILTER with canvas:', 'apotheca-ar-canvas');
            console.log('📹 NNC Path:', apothecaAR.pluginUrl + 'assets/lib/NNC/NN_DEFAULT.json');
            console.log('📹 Calling JEELIZFACEFILTER.init()...');

            // Set a timeout to detect if callback never fires
            let callbackFired = false;
            setTimeout(function() {
                if (!callbackFired) {
                    console.error('❌ TIMEOUT: callbackReady never fired after 10 seconds!');
                    console.error('This usually means:');
                    console.error('1. WebGL failed to initialize');
                    console.error('2. Neural network failed to load');
                    console.error('3. Camera initialization hung');
                    $('#apotheca-ar-loading').html('<p style="color: #ff6b6b;">AR initialization timed out. Please refresh and try again.</p>');
                }
            }, 10000);

            // Initialize Jeeliz Face Filter
            try {
                JEELIZFACEFILTER.init({
                    canvasId: 'apotheca-ar-canvas',
                    NNCPath: apothecaAR.pluginUrl + 'assets/lib/NNC/NN_DEFAULT.json',
                    followZRot: true, // Follow head rotation
                    maxFacesDetected: 1, // Only detect one face
                    callbackReady: function(errCode, spec) {
                        callbackFired = true;
                        console.log('🎉 callbackReady FIRED! errCode:', errCode);
                        
                        if (errCode) {
                            console.error('Jeeliz initialization error:', errCode);
                            
                            let errorMsg = 'Could not start AR. ';
                            if (errCode === 'WEBCAM_UNAVAILABLE') {
                                errorMsg += 'Camera not available.';
                            } else if (errCode === 'GL_INCOMPATIBLE') {
                                errorMsg += 'Your browser does not support WebGL.';
                            } else if (errCode === 'ALREADY_INITIALIZED') {
                                errorMsg += 'AR already initialized.';
                            } else if (errCode === 'INVALID_CANVASID') {
                                errorMsg += 'Canvas element not found.';
                            } else {
                                errorMsg += 'Error code: ' + errCode;
                            }
                            
                            errorMsg += '<br><br>Please ensure:<br>• Your site uses HTTPS<br>• You allowed camera access<br>• You\'re using Chrome, Safari, or Firefox';
                            
                            $('#apotheca-ar-loading').html('<p style="color: #ff6b6b;">' + errorMsg + '</p>');
                            return;
                        }

                        console.log('Jeeliz AR initialized successfully');
                        console.log('Spec:', spec);
                        isInitialized = true;
                        $('#apotheca-ar-loading').hide();
                        
                        // Set default makeup
                        ApothecaAR.setDefaultMakeup();
                    },
                    callbackTrack: function(detectState) {
                        // Render the video to the canvas on each frame
                        JEELIZFACEFILTER.render_video();
                        
                        // detectState tells us if a face is detected
                        // detectState.detected is between 0 and 1 (probability)
                        if (detectState.detected > 0.5) {
                            // Face is detected!
                        // TODO: This is where we'll add makeup rendering
                        // For now, just the video shows
                    }
                }
            });
            } catch (error) {
                console.error('❌ Error during JEELIZFACEFILTER.init():', error);
                console.error('❌ Error stack:', error.stack);
                $('#apotheca-ar-loading').html('<p style="color: #ff6b6b;">Error initializing AR: ' + error.message + '</p>');
            }
        },

        /**
         * Set default makeup colors
         */
        setDefaultMakeup: function() {
            // Use first swatch color if available
            const firstSwatch = $('.apotheca-swatch-btn').first();
            
            if (firstSwatch.length > 0) {
                const color = firstSwatch.data('color');
                const name = firstSwatch.data('name');
                
                // Mark as active
                firstSwatch.addClass('active');
                
                // Apply color
                this.updateMakeup('lipstick', color);
                this.selectedSwatchColor = color;
                
                console.log('Applied default product shade:', name, color);
            } else {
                // Fallback if no swatches (shouldn't happen based on requirements)
                const defaultColor = apothecaAR.defaultLipstickColor || '#ff0000';
                this.updateMakeup('lipstick', defaultColor);
                console.log('Applied fallback color:', defaultColor);
            }
        },

        /**
         * Update makeup color and intensity
         */
        updateMakeup: function(type, color) {
            if (!isInitialized) {
                return;
            }

            // Convert hex to RGB
            const rgb = this.hexToRgb(color);
            
            // TODO: Build custom makeup renderer with Claude Code
            // The base JEELIZFACEFILTER library only provides face tracking
            // We need to build custom WebGL shaders for makeup rendering
            
            console.log('TODO: Apply makeup - Type:', type, 'Color:', color, 'RGB:', rgb);
            
            // This is where we'll add custom makeup rendering code
            // For now, just log that face is being tracked
            if (type === 'lipstick') {
                console.log('Lipstick color selected:', color);
                // Will implement: Custom lip detection and color overlay
            } else if (type === 'eyeshadow') {
                console.log('Eyeshadow color selected:', color);
                // Will implement: Custom eye detection and color overlay
            }
        },

        /**
         * Toggle makeup on/off
         */
        toggleMakeup: function(type, enabled) {
            if (!isInitialized) {
                return;
            }

            // TODO: Implement with Claude Code
            console.log('Toggle makeup - Type:', type, 'Enabled:', enabled);
            
            if (type === 'lipstick') {
                if (enabled) {
                    const color = $('#apotheca-lipstick-color').val();
                    this.updateMakeup('lipstick', color);
                } else {
                    console.log('Lipstick disabled');
                    // Will implement: Hide lipstick overlay
                }
            } else if (type === 'eyeshadow') {
                if (enabled) {
                    const color = $('#apotheca-eyeshadow-color').val();
                    this.updateMakeup('eyeshadow', color);
                } else {
                    console.log('Eyeshadow disabled');
                    // Will implement: Hide eyeshadow overlay
                }
            }
        },

        /**
         * Convert hex color to RGB
         */
        hexToRgb: function(hex) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : { r: 255, g: 0, b: 0 };
        }
    };

    // Initialize on document ready
    $(document).ready(function() {
        ApothecaAR.init();
    });

})(jQuery);
