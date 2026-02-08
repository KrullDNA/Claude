/**
 * Apotheca AR Makeup Try-On
 * Main JavaScript file
 */

(function($) {
    'use strict';

    let arInstance = null;
    let isInitialized = false;

    const ApothecaAR = {

        selectedColors: {},  // Per-attribute selections: { 'mascara': '#...', 'brow': '#...' }

        /**
         * Initialize AR system
         */
        init: function() {
            this.setupEventListeners();

            // If swatch colors available, listen for variation changes
            if (typeof apothecaAR !== 'undefined' && apothecaAR.swatchColorsAvailable) {
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
                self.detectSwatchColor();
            });

            // Also listen for variation reset
            $('.variations_form').on('reset_data', function() {
                self.selectedColors = {};
            });
        },

        /**
         * Detect swatch color from currently selected variation
         */
        detectSwatchColor: function() {
            const selectedSwatch = $('.fif-vse-swatch.fif-vse-selected');

            if (selectedSwatch.length > 0) {
                let swatchColor = selectedSwatch.css('background-color');

                if (swatchColor) {
                    swatchColor = this.rgbToHex(swatchColor);
                    // Store as generic selection for WooCommerce page swatches
                    this.selectedColors['_woo_swatch'] = swatchColor;
                    console.log('Detected swatch color:', swatchColor);
                }
            }
        },

        /**
         * Convert RGB color to hex
         */
        rgbToHex: function(rgb) {
            if (rgb.charAt(0) === '#') {
                return rgb;
            }

            var match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
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

            // Close modal on overlay click (outside container)
            $(document).on('click', '#apotheca-ar-modal', function(e) {
                if ($(e.target).is('#apotheca-ar-modal')) {
                    ApothecaAR.closeARModal();
                }
            });

            // Close on Escape key
            $(document).on('keydown', function(e) {
                if (e.key === 'Escape' && $('#apotheca-ar-modal').is(':visible')) {
                    ApothecaAR.closeARModal();
                }
            });

            // Product swatch clicks in modal - multi-select per attribute
            $(document).on('click', '.apotheca-swatch-btn', function() {
                var color = $(this).data('color');
                var name = $(this).data('name');
                var attribute = $(this).data('attribute') || '';
                var $group = $(this).closest('.apotheca-variation-swatches');

                // Remove active from siblings in the SAME attribute group only
                $group.find('.apotheca-swatch-btn').removeClass('active');
                // Add active to this swatch
                $(this).addClass('active');

                // Store per-attribute selection
                if (attribute) {
                    ApothecaAR.selectedColors[attribute] = color;
                } else {
                    ApothecaAR.selectedColors['_default'] = color;
                }

                // Apply the color
                ApothecaAR.updateMakeup('lipstick', color);

                console.log('Applied product shade:', name, color, 'attribute:', attribute);
                console.log('All selections:', ApothecaAR.selectedColors);
            });

            // Toggle switches for lipstick/eyeshadow
            $(document).on('change', '#apotheca-enable-lipstick', function() {
                ApothecaAR.toggleMakeup('lipstick', $(this).is(':checked'));
            });

            $(document).on('change', '#apotheca-enable-eyeshadow', function() {
                ApothecaAR.toggleMakeup('eyeshadow', $(this).is(':checked'));
            });

            // Color picker changes
            $(document).on('change', '#apotheca-lipstick-color', function() {
                ApothecaAR.updateMakeup('lipstick', $(this).val());
            });

            $(document).on('change', '#apotheca-eyeshadow-color', function() {
                ApothecaAR.updateMakeup('eyeshadow', $(this).val());
            });
        },

        /**
         * Open AR modal
         */
        openARModal: function() {
            var modal = $('#apotheca-ar-modal');

            if (modal.length === 0) {
                console.error('AR modal not found');
                return;
            }

            modal.fadeIn(300);
            $('body').addClass('apotheca-ar-active');

            // Initialize AR if not already done
            if (!isInitialized) {
                console.log('Modal opened, waiting for animation...');
                setTimeout(function() {
                    ApothecaAR.waitForJeelizAndInitialize();
                }, 400);
            }
        },

        /**
         * Wait for Jeeliz library to load, then initialize
         */
        waitForJeelizAndInitialize: function() {
            var self = this;
            var attempts = 0;
            var maxAttempts = 20;

            function checkAndInit() {
                attempts++;

                if (typeof JEELIZFACEFILTER !== 'undefined') {
                    console.log('Jeeliz library loaded after', attempts, 'attempts');
                    self.initializeAR();
                } else if (attempts < maxAttempts) {
                    if (attempts === 1 || attempts % 5 === 0) {
                        console.log('Waiting for Jeeliz library... attempt', attempts + '/' + maxAttempts);
                    }
                    setTimeout(checkAndInit, 500);
                } else {
                    console.error('Jeeliz library failed to load after', attempts, 'attempts');

                    $('#apotheca-ar-loading').html(
                        '<div style="text-align: center; padding: 20px;">' +
                        '<p style="color: #ff6b6b; font-size: 16px; margin-bottom: 15px;">AR library failed to load.</p>' +
                        '<p style="font-size: 13px; margin-bottom: 15px;">Please check:</p>' +
                        '<ul style="text-align: left; font-size: 12px; line-height: 1.8; margin-bottom: 15px;">' +
                        '<li>Internet connection is working</li>' +
                        '<li>Ad blockers are disabled</li>' +
                        '<li>Firewall allows cdn.jsdelivr.net</li>' +
                        '<li>Browser console (F12) for errors</li>' +
                        '</ul>' +
                        '<button onclick="location.reload()" style="margin-top: 10px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Refresh Page</button>' +
                        '</div>'
                    );
                }
            }

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
         *
         * FIX: The previous implementation had a critical bug where calling
         * canvas.getContext('webgl2') as a "test" BEFORE Jeeliz init would
         * steal the WebGL context, causing Jeeliz to hang silently because
         * a canvas can only have ONE type of context at a time.
         */
        initializeAR: function() {
            console.log('initializeAR called');

            var canvas = document.getElementById('apotheca-ar-canvas');

            if (!canvas) {
                console.error('Canvas not found');
                $('#apotheca-ar-loading').html('<p style="color: #ff6b6b;">Error: Canvas not found</p>');
                return;
            }

            // Set canvas dimensions to match its CSS layout size
            // WebGL requires explicit width/height attributes
            if (canvas.offsetWidth > 0 && canvas.offsetHeight > 0) {
                canvas.width = canvas.offsetWidth;
                canvas.height = canvas.offsetHeight;
            } else {
                canvas.width = 640;
                canvas.height = 480;
            }

            if (typeof JEELIZFACEFILTER === 'undefined') {
                console.error('Jeeliz library not loaded');
                $('#apotheca-ar-loading').html('<p style="color: #ff6b6b;">Error: AR library not loaded. Please refresh the page.</p>');
                return;
            }

            // DO NOT test WebGL by calling getContext() here!
            // Creating a context on the canvas before Jeeliz steals it and
            // causes JEELIZFACEFILTER.init() to hang with no callback.
            // Jeeliz will create its own context internally.

            // Show loading
            $('#apotheca-ar-loading').show();

            var nncPath = (typeof apothecaAR !== 'undefined' ? apothecaAR.pluginUrl : '') + 'assets/lib/NNC/NN_DEFAULT.json';
            console.log('NNC Path:', nncPath);

            // Timeout to detect if callback never fires
            var callbackFired = false;
            var timeoutId = setTimeout(function() {
                if (!callbackFired) {
                    console.error('TIMEOUT: callbackReady never fired after 15 seconds');
                    $('#apotheca-ar-loading').html(
                        '<div style="text-align: center; padding: 20px;">' +
                        '<p style="color: #ff6b6b; font-size: 16px;">AR initialization timed out.</p>' +
                        '<p style="font-size: 13px; margin-top: 10px;">This usually means:</p>' +
                        '<ul style="text-align: left; font-size: 12px; line-height: 1.8;">' +
                        '<li>Camera permission was denied</li>' +
                        '<li>WebGL is not available</li>' +
                        '<li>Neural network file failed to load</li>' +
                        '</ul>' +
                        '<button onclick="location.reload()" style="margin-top: 15px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Refresh Page</button>' +
                        '</div>'
                    );
                }
            }, 15000);

            // Initialize Jeeliz Face Filter
            try {
                JEELIZFACEFILTER.init({
                    canvasId: 'apotheca-ar-canvas',
                    NNCPath: nncPath,
                    followZRot: true,
                    maxFacesDetected: 1,
                    callbackReady: function(errCode, spec) {
                        callbackFired = true;
                        clearTimeout(timeoutId);

                        console.log('callbackReady fired, errCode:', errCode);

                        if (errCode) {
                            console.error('Jeeliz initialization error:', errCode);

                            var errorMsg = 'Could not start AR. ';
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

                            errorMsg += '<br><br>Please ensure:<br>- Your site uses HTTPS<br>- You allowed camera access<br>- You are using Chrome, Safari, or Firefox';

                            $('#apotheca-ar-loading').html('<p style="color: #ff6b6b;">' + errorMsg + '</p>');
                            return;
                        }

                        console.log('Jeeliz AR initialized successfully');
                        arInstance = spec;
                        isInitialized = true;
                        $('#apotheca-ar-loading').hide();

                        // Set default makeup
                        ApothecaAR.setDefaultMakeup();
                    },
                    callbackTrack: function(detectState) {
                        // Face tracking callback - called every frame
                        if (detectState.detected > 0.5) {
                            // Face is detected - makeup rendering would happen here
                        }
                    }
                });
            } catch (error) {
                callbackFired = true;
                clearTimeout(timeoutId);
                console.error('Error during JEELIZFACEFILTER.init():', error);
                $('#apotheca-ar-loading').html('<p style="color: #ff6b6b;">Error initializing AR: ' + error.message + '</p>');
            }
        },

        /**
         * Set default makeup colors
         */
        setDefaultMakeup: function() {
            // Auto-select first swatch in each attribute group
            $('.apotheca-variation-swatches').each(function() {
                var $firstSwatch = $(this).find('.apotheca-swatch-btn').first();

                if ($firstSwatch.length > 0) {
                    $firstSwatch.addClass('active');
                    var attribute = $firstSwatch.data('attribute') || '_default';
                    ApothecaAR.selectedColors[attribute] = $firstSwatch.data('color');
                }
            });

            // Apply the first available color
            var firstColor = null;
            for (var key in this.selectedColors) {
                if (this.selectedColors.hasOwnProperty(key)) {
                    firstColor = this.selectedColors[key];
                    break;
                }
            }

            if (firstColor) {
                this.updateMakeup('lipstick', firstColor);
                console.log('Applied default selections:', this.selectedColors);
            } else {
                var defaultColor = (typeof apothecaAR !== 'undefined' && apothecaAR.defaultLipstickColor) ? apothecaAR.defaultLipstickColor : '#ff0000';
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

            var rgb = this.hexToRgb(color);

            console.log('Apply makeup - Type:', type, 'Color:', color, 'RGB:', rgb);

            if (type === 'lipstick') {
                console.log('Lipstick color selected:', color);
            } else if (type === 'eyeshadow') {
                console.log('Eyeshadow color selected:', color);
            }
        },

        /**
         * Toggle makeup on/off
         */
        toggleMakeup: function(type, enabled) {
            if (!isInitialized) {
                return;
            }

            console.log('Toggle makeup - Type:', type, 'Enabled:', enabled);

            if (type === 'lipstick') {
                if (enabled) {
                    var color = $('#apotheca-lipstick-color').val();
                    this.updateMakeup('lipstick', color);
                } else {
                    console.log('Lipstick disabled');
                }
            } else if (type === 'eyeshadow') {
                if (enabled) {
                    var color = $('#apotheca-eyeshadow-color').val();
                    this.updateMakeup('eyeshadow', color);
                } else {
                    console.log('Eyeshadow disabled');
                }
            }
        },

        /**
         * Convert hex color to RGB
         */
        hexToRgb: function(hex) {
            var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
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
