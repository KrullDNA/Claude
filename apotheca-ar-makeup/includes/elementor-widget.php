<?php
/**
 * Elementor Widget: Apotheca AR Makeup Try-On
 */

if (!defined('ABSPATH')) {
    exit;
}

class Apotheca_AR_Elementor_Widget extends \Elementor\Widget_Base {

    public function get_name() {
        return 'apotheca_ar_tryon';
    }

    public function get_title() {
        return 'AR Makeup Try-On';
    }

    public function get_icon() {
        return 'eicon-video-camera';
    }

    public function get_categories() {
        return ['general'];
    }

    public function get_keywords() {
        return ['ar', 'makeup', 'virtual', 'try-on', 'camera', 'apotheca'];
    }

    /**
     * Register widget controls
     */
    protected function register_controls() {
        
        // CONTENT SECTION
        $this->start_controls_section(
            'content_section',
            [
                'label' => 'Content',
                'tab' => \Elementor\Controls_Manager::TAB_CONTENT,
            ]
        );

        $this->add_control(
            'button_text',
            [
                'label' => 'Button Text',
                'type' => \Elementor\Controls_Manager::TEXT,
                'default' => 'Virtual Try-On',
                'placeholder' => 'Enter button text',
            ]
        );

        $this->add_control(
            'button_icon',
            [
                'label' => 'Button Icon',
                'type' => \Elementor\Controls_Manager::ICONS,
                'default' => [
                    'value' => 'fas fa-video',
                    'library' => 'solid',
                ],
            ]
        );

        $this->add_control(
            'icon_position',
            [
                'label' => 'Icon Position',
                'type' => \Elementor\Controls_Manager::CHOOSE,
                'options' => [
                    'left' => [
                        'title' => 'Left',
                        'icon' => 'eicon-h-align-left',
                    ],
                    'right' => [
                        'title' => 'Right',
                        'icon' => 'eicon-h-align-right',
                    ],
                ],
                'default' => 'left',
                'toggle' => true,
            ]
        );

        $this->add_responsive_control(
            'button_align',
            [
                'label' => 'Button Alignment',
                'type' => \Elementor\Controls_Manager::CHOOSE,
                'options' => [
                    'left' => [
                        'title' => 'Left',
                        'icon' => 'eicon-text-align-left',
                    ],
                    'center' => [
                        'title' => 'Center',
                        'icon' => 'eicon-text-align-center',
                    ],
                    'right' => [
                        'title' => 'Right',
                        'icon' => 'eicon-text-align-right',
                    ],
                    'justify' => [
                        'title' => 'Justified',
                        'icon' => 'eicon-text-align-justify',
                    ],
                ],
                'default' => 'center',
                'selectors' => [
                    '{{WRAPPER}} .apotheca-ar-widget' => 'text-align: {{VALUE}};',
                ],
            ]
        );

        $this->end_controls_section();

        // BUTTON STYLE SECTION
        $this->start_controls_section(
            'button_style_section',
            [
                'label' => 'Button Style',
                'tab' => \Elementor\Controls_Manager::TAB_STYLE,
            ]
        );

        $this->add_group_control(
            \Elementor\Group_Control_Typography::get_type(),
            [
                'name' => 'button_typography',
                'selector' => '{{WRAPPER}} .apotheca-ar-trigger',
            ]
        );

        $this->start_controls_tabs('button_style_tabs');

        // Normal State
        $this->start_controls_tab(
            'button_normal_tab',
            [
                'label' => 'Normal',
            ]
        );

        $this->add_control(
            'button_text_color',
            [
                'label' => 'Text Color',
                'type' => \Elementor\Controls_Manager::COLOR,
                'default' => '#ffffff',
                'selectors' => [
                    '{{WRAPPER}} .apotheca-ar-trigger' => 'color: {{VALUE}};',
                ],
            ]
        );

        $this->add_group_control(
            \Elementor\Group_Control_Background::get_type(),
            [
                'name' => 'button_background',
                'types' => ['classic', 'gradient'],
                'selector' => '{{WRAPPER}} .apotheca-ar-trigger',
                'fields_options' => [
                    'background' => [
                        'default' => 'gradient',
                    ],
                    'color' => [
                        'default' => '#667eea',
                    ],
                    'color_b' => [
                        'default' => '#764ba2',
                    ],
                    'gradient_angle' => [
                        'default' => [
                            'unit' => 'deg',
                            'size' => 135,
                        ],
                    ],
                ],
            ]
        );

        $this->add_group_control(
            \Elementor\Group_Control_Border::get_type(),
            [
                'name' => 'button_border',
                'selector' => '{{WRAPPER}} .apotheca-ar-trigger',
            ]
        );

        $this->add_group_control(
            \Elementor\Group_Control_Box_Shadow::get_type(),
            [
                'name' => 'button_box_shadow',
                'selector' => '{{WRAPPER}} .apotheca-ar-trigger',
            ]
        );

        $this->end_controls_tab();

        // Hover State
        $this->start_controls_tab(
            'button_hover_tab',
            [
                'label' => 'Hover',
            ]
        );

        $this->add_control(
            'button_hover_text_color',
            [
                'label' => 'Text Color',
                'type' => \Elementor\Controls_Manager::COLOR,
                'default' => '#ffffff',
                'selectors' => [
                    '{{WRAPPER}} .apotheca-ar-trigger:hover' => 'color: {{VALUE}};',
                ],
            ]
        );

        $this->add_group_control(
            \Elementor\Group_Control_Background::get_type(),
            [
                'name' => 'button_hover_background',
                'types' => ['classic', 'gradient'],
                'selector' => '{{WRAPPER}} .apotheca-ar-trigger:hover',
            ]
        );

        $this->add_group_control(
            \Elementor\Group_Control_Border::get_type(),
            [
                'name' => 'button_hover_border',
                'selector' => '{{WRAPPER}} .apotheca-ar-trigger:hover',
            ]
        );

        $this->add_group_control(
            \Elementor\Group_Control_Box_Shadow::get_type(),
            [
                'name' => 'button_hover_box_shadow',
                'selector' => '{{WRAPPER}} .apotheca-ar-trigger:hover',
                'fields_options' => [
                    'box_shadow' => [
                        'default' => [
                            'horizontal' => 0,
                            'vertical' => 4,
                            'blur' => 12,
                            'spread' => 0,
                            'color' => 'rgba(102, 126, 234, 0.4)',
                        ],
                    ],
                ],
            ]
        );

        $this->add_control(
            'button_hover_animation',
            [
                'label' => 'Hover Animation',
                'type' => \Elementor\Controls_Manager::HOVER_ANIMATION,
            ]
        );

        $this->end_controls_tab();

        $this->end_controls_tabs();

        $this->add_responsive_control(
            'button_border_radius',
            [
                'label' => 'Border Radius',
                'type' => \Elementor\Controls_Manager::DIMENSIONS,
                'size_units' => ['px', '%'],
                'default' => [
                    'top' => 8,
                    'right' => 8,
                    'bottom' => 8,
                    'left' => 8,
                    'unit' => 'px',
                ],
                'selectors' => [
                    '{{WRAPPER}} .apotheca-ar-trigger' => 'border-radius: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
                ],
                'separator' => 'before',
            ]
        );

        $this->add_responsive_control(
            'button_padding',
            [
                'label' => 'Padding',
                'type' => \Elementor\Controls_Manager::DIMENSIONS,
                'size_units' => ['px', 'em', '%'],
                'default' => [
                    'top' => 12,
                    'right' => 24,
                    'bottom' => 12,
                    'left' => 24,
                    'unit' => 'px',
                ],
                'selectors' => [
                    '{{WRAPPER}} .apotheca-ar-trigger' => 'padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
                ],
            ]
        );

        $this->add_responsive_control(
            'button_margin',
            [
                'label' => 'Margin',
                'type' => \Elementor\Controls_Manager::DIMENSIONS,
                'size_units' => ['px', 'em', '%'],
                'selectors' => [
                    '{{WRAPPER}} .apotheca-ar-trigger' => 'margin: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
                ],
            ]
        );

        $this->add_responsive_control(
            'icon_spacing',
            [
                'label' => 'Icon Spacing',
                'type' => \Elementor\Controls_Manager::SLIDER,
                'size_units' => ['px'],
                'range' => [
                    'px' => [
                        'min' => 0,
                        'max' => 50,
                    ],
                ],
                'default' => [
                    'unit' => 'px',
                    'size' => 8,
                ],
                'selectors' => [
                    '{{WRAPPER}} .apotheca-ar-trigger .icon-left' => 'margin-right: {{SIZE}}{{UNIT}};',
                    '{{WRAPPER}} .apotheca-ar-trigger .icon-right' => 'margin-left: {{SIZE}}{{UNIT}};',
                ],
            ]
        );

        $this->end_controls_section();

        // MODAL STYLE SECTION
        $this->start_controls_section(
            'modal_style_section',
            [
                'label' => 'Modal Style',
                'tab' => \Elementor\Controls_Manager::TAB_STYLE,
            ]
        );

        $this->add_control(
            'modal_overlay_color',
            [
                'label' => 'Overlay Background',
                'type' => \Elementor\Controls_Manager::COLOR,
                'default' => 'rgba(0, 0, 0, 0.9)',
                'selectors' => [
                    '#apotheca-ar-modal' => 'background-color: {{VALUE}};',
                ],
            ]
        );

        $this->add_control(
            'modal_container_bg',
            [
                'label' => 'Container Background',
                'type' => \Elementor\Controls_Manager::COLOR,
                'default' => '#1a1a1a',
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-ar-container' => 'background-color: {{VALUE}};',
                ],
            ]
        );

        $this->add_responsive_control(
            'modal_container_padding',
            [
                'label' => 'Container Padding',
                'type' => \Elementor\Controls_Manager::DIMENSIONS,
                'size_units' => ['px', 'em'],
                'default' => [
                    'top' => 20,
                    'right' => 20,
                    'bottom' => 20,
                    'left' => 20,
                    'unit' => 'px',
                ],
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-ar-container' => 'padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
                ],
            ]
        );

        $this->add_responsive_control(
            'modal_border_radius',
            [
                'label' => 'Border Radius',
                'type' => \Elementor\Controls_Manager::DIMENSIONS,
                'size_units' => ['px', '%'],
                'default' => [
                    'top' => 16,
                    'right' => 16,
                    'bottom' => 16,
                    'left' => 16,
                    'unit' => 'px',
                ],
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-ar-container' => 'border-radius: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
                ],
            ]
        );

        $this->end_controls_section();

        // AR VIDEO AREA STYLE
        $this->start_controls_section(
            'ar_video_style_section',
            [
                'label' => 'AR Video Area',
                'tab' => \Elementor\Controls_Manager::TAB_STYLE,
            ]
        );

        $this->add_responsive_control(
            'ar_video_height',
            [
                'label' => 'Height',
                'type' => \Elementor\Controls_Manager::SLIDER,
                'size_units' => ['px', 'vh'],
                'range' => [
                    'px' => [
                        'min' => 300,
                        'max' => 1000,
                    ],
                    'vh' => [
                        'min' => 30,
                        'max' => 90,
                    ],
                ],
                'default' => [
                    'unit' => 'px',
                    'size' => 600,
                ],
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-ar-video-wrapper' => 'height: {{SIZE}}{{UNIT}};',
                ],
            ]
        );

        $this->add_control(
            'ar_video_bg',
            [
                'label' => 'Background Color',
                'type' => \Elementor\Controls_Manager::COLOR,
                'default' => '#000000',
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-ar-video-wrapper' => 'background-color: {{VALUE}};',
                ],
            ]
        );

        $this->add_responsive_control(
            'ar_video_border_radius',
            [
                'label' => 'Border Radius',
                'type' => \Elementor\Controls_Manager::DIMENSIONS,
                'size_units' => ['px', '%'],
                'default' => [
                    'top' => 12,
                    'right' => 12,
                    'bottom' => 12,
                    'left' => 12,
                    'unit' => 'px',
                ],
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-ar-video-wrapper' => 'border-radius: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
                ],
            ]
        );

        $this->add_group_control(
            \Elementor\Group_Control_Border::get_type(),
            [
                'name' => 'ar_video_border',
                'selector' => '#apotheca-ar-modal .apotheca-ar-video-wrapper',
            ]
        );

        $this->add_group_control(
            \Elementor\Group_Control_Box_Shadow::get_type(),
            [
                'name' => 'ar_video_shadow',
                'selector' => '#apotheca-ar-modal .apotheca-ar-video-wrapper',
            ]
        );

        $this->end_controls_section();

        // CONTROLS PANEL STYLE
        $this->start_controls_section(
            'controls_panel_style_section',
            [
                'label' => 'Controls Panel',
                'tab' => \Elementor\Controls_Manager::TAB_STYLE,
            ]
        );

        $this->add_control(
            'controls_bg',
            [
                'label' => 'Background Color',
                'type' => \Elementor\Controls_Manager::COLOR,
                'default' => '#2a2a2a',
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-ar-controls' => 'background-color: {{VALUE}};',
                ],
            ]
        );

        $this->add_responsive_control(
            'controls_padding',
            [
                'label' => 'Padding',
                'type' => \Elementor\Controls_Manager::DIMENSIONS,
                'size_units' => ['px', 'em'],
                'default' => [
                    'top' => 20,
                    'right' => 20,
                    'bottom' => 20,
                    'left' => 20,
                    'unit' => 'px',
                ],
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-ar-controls' => 'padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
                ],
            ]
        );

        $this->add_responsive_control(
            'controls_border_radius',
            [
                'label' => 'Border Radius',
                'type' => \Elementor\Controls_Manager::DIMENSIONS,
                'size_units' => ['px', '%'],
                'default' => [
                    'top' => 12,
                    'right' => 12,
                    'bottom' => 12,
                    'left' => 12,
                    'unit' => 'px',
                ],
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-ar-controls' => 'border-radius: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
                ],
            ]
        );

        $this->add_group_control(
            \Elementor\Group_Control_Typography::get_type(),
            [
                'name' => 'controls_label_typography',
                'label' => 'Label Typography',
                'selector' => '#apotheca-ar-modal .apotheca-ar-controls label',
            ]
        );

        $this->add_control(
            'controls_label_color',
            [
                'label' => 'Label Color',
                'type' => \Elementor\Controls_Manager::COLOR,
                'default' => '#e0e0e0',
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-ar-controls label' => 'color: {{VALUE}};',
                ],
            ]
        );

        $this->add_responsive_control(
            'controls_spacing',
            [
                'label' => 'Spacing Between Groups',
                'type' => \Elementor\Controls_Manager::SLIDER,
                'size_units' => ['px'],
                'range' => [
                    'px' => [
                        'min' => 0,
                        'max' => 50,
                    ],
                ],
                'default' => [
                    'unit' => 'px',
                    'size' => 25,
                ],
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-control-group' => 'margin-bottom: {{SIZE}}{{UNIT}};',
                ],
            ]
        );

        $this->end_controls_section();

        // TITLE STYLE
        $this->start_controls_section(
            'title_style_section',
            [
                'label' => 'Modal Title',
                'tab' => \Elementor\Controls_Manager::TAB_STYLE,
            ]
        );

        $this->add_group_control(
            \Elementor\Group_Control_Typography::get_type(),
            [
                'name' => 'title_typography',
                'selector' => '#apotheca-ar-modal h2',
            ]
        );

        $this->add_control(
            'title_color',
            [
                'label' => 'Text Color',
                'type' => \Elementor\Controls_Manager::COLOR,
                'default' => '#ffffff',
                'selectors' => [
                    '#apotheca-ar-modal h2' => 'color: {{VALUE}};',
                ],
            ]
        );

        $this->add_responsive_control(
            'title_spacing',
            [
                'label' => 'Bottom Spacing',
                'type' => \Elementor\Controls_Manager::SLIDER,
                'size_units' => ['px'],
                'range' => [
                    'px' => [
                        'min' => 0,
                        'max' => 50,
                    ],
                ],
                'default' => [
                    'unit' => 'px',
                    'size' => 20,
                ],
                'selectors' => [
                    '#apotheca-ar-modal h2' => 'margin-bottom: {{SIZE}}{{UNIT}};',
                ],
            ]
        );

        $this->end_controls_section();

        // CLOSE BUTTON STYLE
        $this->start_controls_section(
            'close_button_style_section',
            [
                'label' => 'Close Button',
                'tab' => \Elementor\Controls_Manager::TAB_STYLE,
            ]
        );

        $this->add_responsive_control(
            'close_button_size',
            [
                'label' => 'Button Size',
                'type' => \Elementor\Controls_Manager::SLIDER,
                'size_units' => ['px'],
                'range' => [
                    'px' => [
                        'min' => 30,
                        'max' => 60,
                    ],
                ],
                'default' => [
                    'unit' => 'px',
                    'size' => 40,
                ],
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-ar-close' => 'width: {{SIZE}}{{UNIT}}; height: {{SIZE}}{{UNIT}};',
                ],
            ]
        );

        $this->add_control(
            'close_button_color',
            [
                'label' => 'Color',
                'type' => \Elementor\Controls_Manager::COLOR,
                'default' => '#ffffff',
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-ar-close' => 'color: {{VALUE}};',
                ],
            ]
        );

        $this->add_control(
            'close_button_bg',
            [
                'label' => 'Background',
                'type' => \Elementor\Controls_Manager::COLOR,
                'default' => 'rgba(255, 255, 255, 0.1)',
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-ar-close' => 'background-color: {{VALUE}};',
                ],
            ]
        );

        $this->add_control(
            'close_button_hover_bg',
            [
                'label' => 'Hover Background',
                'type' => \Elementor\Controls_Manager::COLOR,
                'default' => 'rgba(255, 255, 255, 0.2)',
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-ar-close:hover' => 'background-color: {{VALUE}};',
                ],
            ]
        );

        $this->end_controls_section();
    }

    /**
     * Render widget output
     */
    protected function render() {
        $settings = $this->get_settings_for_display();
        
        $button_class = 'apotheca-ar-trigger elementor-button';
        
        if (!empty($settings['button_hover_animation'])) {
            $button_class .= ' elementor-animation-' . $settings['button_hover_animation'];
        }
        
        // Get product variations if on product page
        $variations_html = '';
        if (is_product()) {
            global $post;
            $product = wc_get_product($post->ID);
            
            if ($product && $product->is_type('variable')) {
                $variations_html = $this->get_variations_html($product);
            }
        }
        
        ?>
        <div class="apotheca-ar-widget">
            <button class="<?php echo esc_attr($button_class); ?>">
                <?php if (!empty($settings['button_icon']['value']) && $settings['icon_position'] === 'left') : ?>
                    <span class="icon-left">
                        <?php \Elementor\Icons_Manager::render_icon($settings['button_icon'], ['aria-hidden' => 'true']); ?>
                    </span>
                <?php endif; ?>
                
                <span><?php echo esc_html($settings['button_text']); ?></span>
                
                <?php if (!empty($settings['button_icon']['value']) && $settings['icon_position'] === 'right') : ?>
                    <span class="icon-right">
                        <?php \Elementor\Icons_Manager::render_icon($settings['button_icon'], ['aria-hidden' => 'true']); ?>
                    </span>
                <?php endif; ?>
            </button>
        </div>
        
        <!-- Include AR Modal (only once per page) -->
        <?php
        static $modal_included = false;
        if (!$modal_included) {
            $modal_included = true;
            include APOTHECA_AR_PLUGIN_DIR . 'templates/ar-modal.php';
        }
        ?>
        <?php
    }
    
    /**
     * Get variations HTML for modal
     */
    private function get_variations_html($product) {
        $attributes = $product->get_attributes();
        $html = '';
        
        foreach ($attributes as $attribute) {
            $attr_name = strtolower($attribute->get_name());
            $is_color_attr = (
                strpos($attr_name, 'color') !== false ||
                strpos($attr_name, 'colour') !== false ||
                strpos($attr_name, 'shade') !== false ||
                strpos($attr_name, 'tone') !== false
            );
            
            if ($is_color_attr && $attribute->is_taxonomy()) {
                $terms = $attribute->get_terms();
                
                $html .= '<div class="apotheca-variation-swatches">';
                $html .= '<h4>' . esc_html($attribute->get_name()) . '</h4>';
                $html .= '<div class="apotheca-swatch-list">';
                
                foreach ($terms as $term) {
                    $swatch_color = get_term_meta($term->term_id, 'fif_swatch_color', true);
                    
                    if (!empty($swatch_color)) {
                        $html .= sprintf(
                            '<button type="button" class="apotheca-swatch-btn" data-color="%s" data-name="%s" style="background-color: %s;" title="%s"></button>',
                            esc_attr($swatch_color),
                            esc_attr($term->name),
                            esc_attr($swatch_color),
                            esc_attr($term->name)
                        );
                    }
                }
                
                $html .= '</div>';
                $html .= '</div>';
            }
        }
        
        return $html;
    }
}
