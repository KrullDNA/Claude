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

        // =============================================
        // CONTENT TAB
        // =============================================

        // --- Button Content ---
        $this->start_controls_section(
            'content_section',
            [
                'label' => 'Button',
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

        // --- Modal Content ---
        $this->start_controls_section(
            'modal_content_section',
            [
                'label' => 'Modal Content',
                'tab' => \Elementor\Controls_Manager::TAB_CONTENT,
            ]
        );

        $this->add_control(
            'modal_title',
            [
                'label' => 'Modal Title',
                'type' => \Elementor\Controls_Manager::TEXT,
                'default' => 'Virtual Makeup Try-On',
                'placeholder' => 'Enter modal title',
            ]
        );

        $this->add_control(
            'controls_heading_text',
            [
                'label' => 'Controls Panel Heading',
                'type' => \Elementor\Controls_Manager::TEXT,
                'default' => 'Makeup Controls',
                'placeholder' => 'Enter controls heading',
            ]
        );

        $this->end_controls_section();

        // --- Tips Box Content ---
        $this->start_controls_section(
            'tips_content_section',
            [
                'label' => 'Tips Box',
                'tab' => \Elementor\Controls_Manager::TAB_CONTENT,
            ]
        );

        $this->add_control(
            'show_tips_box',
            [
                'label' => 'Show Tips Box',
                'type' => \Elementor\Controls_Manager::SWITCHER,
                'label_on' => 'Show',
                'label_off' => 'Hide',
                'return_value' => 'yes',
                'default' => 'yes',
            ]
        );

        $this->add_control(
            'tips_title',
            [
                'label' => 'Tips Title',
                'type' => \Elementor\Controls_Manager::TEXT,
                'default' => 'Tips',
                'placeholder' => 'Enter tips title',
                'condition' => [
                    'show_tips_box' => 'yes',
                ],
            ]
        );

        $this->add_control(
            'tips_content',
            [
                'label' => 'Tips Content',
                // WYSIWYG so admins can format tips (bullets, line breaks, links, etc.)
                'type' => \Elementor\Controls_Manager::WYSIWYG,
                'default' => "<ul>\n<li>Make sure you're in good lighting</li>\n<li>Keep your face centred in the frame</li>\n<li>Click product shades above to try different colours</li>\n<li>Allow camera access when prompted</li>\n</ul>",
                'placeholder' => 'Enter tips',
                'condition' => [
                    'show_tips_box' => 'yes',
                ],
            ]
        );

        $this->end_controls_section();

        // =============================================
        // STYLE TAB
        // =============================================

        // --- Button Style ---
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

        // --- Swatch Style ---
        $this->start_controls_section(
            'swatch_style_section',
            [
                'label' => 'Swatch Style',
                'tab' => \Elementor\Controls_Manager::TAB_STYLE,
            ]
        );

        $this->add_responsive_control(
            'swatch_size',
            [
                'label' => 'Swatch Size',
                'type' => \Elementor\Controls_Manager::SLIDER,
                'size_units' => ['px'],
                'range' => [
                    'px' => [
                        'min' => 0,
                        'max' => 80,
                    ],
                ],
                'default' => [
                    'unit' => 'px',
                    'size' => 40,
                ],
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-swatch-list' => '--apotheca-swatch-size: {{SIZE}}{{UNIT}};',
                ],
            ]
        );

        $this->add_control(
            'swatch_shape',
            [
                'label' => 'Swatch Shape',
                'type' => \Elementor\Controls_Manager::SELECT,
                'default' => 'circle',
                'options' => [
                    'circle' => 'Circle',
                    'rounded' => 'Rounded Square',
                    'square' => 'Square',
                ],
                'selectors_dictionary' => [
                    'circle' => '50%',
                    'rounded' => '8px',
                    'square' => '0px',
                ],
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-swatch-list' => '--apotheca-swatch-radius: {{VALUE}};',
                ],
            ]
        );

        $this->add_responsive_control(
            'swatch_gap',
            [
                'label' => 'Gap Between Swatches',
                'type' => \Elementor\Controls_Manager::SLIDER,
                'size_units' => ['px'],
                'range' => [
                    'px' => [
                        'min' => 0,
                        'max' => 30,
                    ],
                ],
                'default' => [
                    'unit' => 'px',
                    'size' => 10,
                ],
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-swatch-list' => 'gap: {{SIZE}}{{UNIT}};',
                ],
            ]
        );

        $this->add_control(
            'swatch_border_heading',
            [
                'label' => 'Border',
                'type' => \Elementor\Controls_Manager::HEADING,
                'separator' => 'before',
            ]
        );

        $this->add_responsive_control(
            'swatch_border_width',
            [
                'label' => 'Border Width',
                'type' => \Elementor\Controls_Manager::SLIDER,
                'size_units' => ['px'],
                'range' => [
                    'px' => [
                        'min' => 0,
                        'max' => 6,
                    ],
                ],
                'default' => [
                    'unit' => 'px',
                    'size' => 0,
                ],
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-swatch-list' => '--apotheca-swatch-border-width: {{SIZE}}{{UNIT}};',
                ],
            ]
        );

        $this->add_control(
            'swatch_border_color',
            [
                'label' => 'Border Color',
                'type' => \Elementor\Controls_Manager::COLOR,
                'default' => 'rgba(255, 255, 255, 0.3)',
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-swatch-list' => '--apotheca-swatch-border-color: {{VALUE}};',
                ],
            ]
        );

        $this->add_control(
            'swatch_hover_heading',
            [
                'label' => 'Hover & Active',
                'type' => \Elementor\Controls_Manager::HEADING,
                'separator' => 'before',
            ]
        );

        $this->add_control(
            'swatch_hover_border_color',
            [
                'label' => 'Hover Border Color',
                'type' => \Elementor\Controls_Manager::COLOR,
                'default' => 'rgba(0,0,0,0.75)',
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-swatch-list' => '--apotheca-swatch-outline-hover-color: {{VALUE}};',
                ],
            ]
        );

        $this->add_control(
            'swatch_active_border_color',
            [
                'label' => 'Active Border Color',
                'type' => \Elementor\Controls_Manager::COLOR,
                'default' => 'rgba(0,0,0,0.85)',
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-swatch-list' => '--apotheca-swatch-outline-active-color: {{VALUE}};',
                ],
            ]
        );

        $this->add_responsive_control(
            'swatch_active_border_width',
            [
                'label' => 'Active Border Width',
                'type' => \Elementor\Controls_Manager::SLIDER,
                'size_units' => ['px'],
                'range' => [
                    'px' => [
                        'min' => 1,
                        'max' => 6,
                    ],
                ],
                'default' => [
                    'unit' => 'px',
                    'size' => 3,
                ],
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-swatch-list' => '--apotheca-swatch-outline-hover: {{SIZE}}{{UNIT}}; --apotheca-swatch-outline-active: {{SIZE}}{{UNIT}};',
                ],
            ]
        );

        $this->add_control(
            'swatch_hover_name_heading',
            [
                'label' => 'Swatch Name Label',
                'type' => \Elementor\Controls_Manager::HEADING,
                'separator' => 'before',
            ]
        );

        $this->add_control(
            'swatch_name_color',
            [
                'label' => 'Name Color',
                'type' => \Elementor\Controls_Manager::COLOR,
                'default' => '#e0e0e0',
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-swatch-active-name' => 'color: {{VALUE}};',
                ],
            ]
        );

        $this->add_group_control(
            \Elementor\Group_Control_Typography::get_type(),
            [
                'name' => 'swatch_name_typography',
                'label' => 'Name Typography',
                'selector' => '#apotheca-ar-modal .apotheca-swatch-active-name',
            ]
        );

        $this->end_controls_section();

        // --- Modal Style ---
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

        // --- AR Video Area Style ---
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

        // --- Controls Panel Style ---
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
                    '#apotheca-ar-modal .apotheca-variation-swatches' => 'margin-bottom: {{SIZE}}{{UNIT}};',
                ],
            ]
        );

        $this->add_control(
            'controls_heading_divider',
            [
                'label' => 'Panel Heading',
                'type' => \Elementor\Controls_Manager::HEADING,
                'separator' => 'before',
            ]
        );

        $this->add_control(
            'controls_heading_color',
            [
                'label' => 'Heading Color',
                'type' => \Elementor\Controls_Manager::COLOR,
                'default' => '#ffffff',
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-ar-controls h3' => 'color: {{VALUE}};',
                ],
            ]
        );

        $this->add_group_control(
            \Elementor\Group_Control_Typography::get_type(),
            [
                'name' => 'controls_heading_typography',
                'label' => 'Heading Typography',
                'selector' => '#apotheca-ar-modal .apotheca-ar-controls h3',
            ]
        );

        $this->add_control(
            'controls_attr_heading_divider',
            [
                'label' => 'Attribute Heading',
                'type' => \Elementor\Controls_Manager::HEADING,
                'separator' => 'before',
            ]
        );

        $this->add_control(
            'controls_attr_heading_color',
            [
                'label' => 'Attribute Heading Color',
                'type' => \Elementor\Controls_Manager::COLOR,
                'default' => '#ffffff',
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-variation-swatches h4' => 'color: {{VALUE}};',
                ],
            ]
        );

        $this->add_group_control(
            \Elementor\Group_Control_Typography::get_type(),
            [
                'name' => 'controls_attr_heading_typography',
                'label' => 'Attribute Heading Typography',
                'selector' => '#apotheca-ar-modal .apotheca-variation-swatches h4',
            ]
        );

        // --- Zoom Control Style ---
        $this->add_control(
            'zoom_style_heading',
            [
                'label' => 'Zoom Control',
                'type' => \Elementor\Controls_Manager::HEADING,
                'separator' => 'before',
            ]
        );

        $this->add_control(
            'zoom_bg_color',
            [
                'label' => 'Background Color',
                'type' => \Elementor\Controls_Manager::COLOR,
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-ar-zoom-control' => 'background-color: {{VALUE}};',
                ],
            ]
        );

        $this->add_responsive_control(
            'zoom_padding',
            [
                'label' => 'Padding',
                'type' => \Elementor\Controls_Manager::DIMENSIONS,
                'size_units' => ['px', 'em'],
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-ar-zoom-control' => 'padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
                ],
            ]
        );

        $this->add_responsive_control(
            'zoom_margin_bottom',
            [
                'label' => 'Bottom Margin',
                'type' => \Elementor\Controls_Manager::SLIDER,
                'size_units' => ['px'],
                'range' => [
                    'px' => ['min' => 0, 'max' => 60],
                ],
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-ar-zoom-control' => 'margin-bottom: {{SIZE}}{{UNIT}};',
                ],
            ]
        );

        $this->add_group_control(
            \Elementor\Group_Control_Border::get_type(),
            [
                'name' => 'zoom_border',
                'selector' => '#apotheca-ar-modal .apotheca-ar-zoom-control',
            ]
        );

        $this->add_responsive_control(
            'zoom_border_radius',
            [
                'label' => 'Border Radius',
                'type' => \Elementor\Controls_Manager::DIMENSIONS,
                'size_units' => ['px', '%'],
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-ar-zoom-control' => 'border-radius: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
                ],
            ]
        );

        $this->add_group_control(
            \Elementor\Group_Control_Box_Shadow::get_type(),
            [
                'name' => 'zoom_shadow',
                'selector' => '#apotheca-ar-modal .apotheca-ar-zoom-control',
            ]
        );

        $this->add_control(
            'zoom_label_heading',
            [
                'label' => 'Label',
                'type' => \Elementor\Controls_Manager::HEADING,
                'separator' => 'before',
            ]
        );

        $this->add_control(
            'zoom_label_color',
            [
                'label' => 'Label Color',
                'type' => \Elementor\Controls_Manager::COLOR,
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-ar-zoom-label' => 'color: {{VALUE}};',
                ],
            ]
        );

        $this->add_group_control(
            \Elementor\Group_Control_Typography::get_type(),
            [
                'name' => 'zoom_label_typography',
                'selector' => '#apotheca-ar-modal .apotheca-ar-zoom-label',
            ]
        );

        $this->add_control(
            'zoom_value_heading',
            [
                'label' => 'Value',
                'type' => \Elementor\Controls_Manager::HEADING,
            ]
        );

        $this->add_control(
            'zoom_value_color',
            [
                'label' => 'Value Color',
                'type' => \Elementor\Controls_Manager::COLOR,
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-ar-zoom-value' => 'color: {{VALUE}};',
                ],
            ]
        );

        $this->add_group_control(
            \Elementor\Group_Control_Typography::get_type(),
            [
                'name' => 'zoom_value_typography',
                'selector' => '#apotheca-ar-modal .apotheca-ar-zoom-value',
            ]
        );

        $this->add_control(
            'zoom_slider_heading',
            [
                'label' => 'Slider',
                'type' => \Elementor\Controls_Manager::HEADING,
                'separator' => 'before',
            ]
        );

        $this->add_control(
            'zoom_slider_accent_color',
            [
                'label' => 'Accent Color',
                'type' => \Elementor\Controls_Manager::COLOR,
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-ar-zoom' => 'accent-color: {{VALUE}};',
                ],
            ]
        );

        $this->add_responsive_control(
            'zoom_slider_height',
            [
                'label' => 'Slider Height',
                'type' => \Elementor\Controls_Manager::SLIDER,
                'size_units' => ['px'],
                'range' => [
                    'px' => ['min' => 2, 'max' => 24],
                ],
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-ar-zoom' => 'height: {{SIZE}}{{UNIT}};',
                ],
            ]
        );

        $this->end_controls_section();

        // --- Modal Title Style ---
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
                'selector' => '#apotheca-ar-modal .apotheca-modal-title',
            ]
        );

        $this->add_control(
            'title_color',
            [
                'label' => 'Text Color',
                'type' => \Elementor\Controls_Manager::COLOR,
                'default' => '#ffffff',
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-modal-title' => 'color: {{VALUE}};',
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
                    '#apotheca-ar-modal .apotheca-modal-title' => 'margin-bottom: {{SIZE}}{{UNIT}};',
                ],
            ]
        );

        $this->end_controls_section();

        // --- Tips Box Style ---
        $this->start_controls_section(
            'tips_style_section',
            [
                'label' => 'Tips Box Style',
                'tab' => \Elementor\Controls_Manager::TAB_STYLE,
                'condition' => [
                    'show_tips_box' => 'yes',
                ],
            ]
        );

        $this->add_control(
            'tips_bg_color',
            [
                'label' => 'Background Color',
                'type' => \Elementor\Controls_Manager::COLOR,
                'default' => 'rgba(102, 126, 234, 0.1)',
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-tips-box' => 'background-color: {{VALUE}};',
                ],
            ]
        );

        $this->add_control(
            'tips_text_color',
            [
                'label' => 'Text Color',
                'type' => \Elementor\Controls_Manager::COLOR,
                'default' => '#e0e0e0',
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-tips-box' => 'color: {{VALUE}};',
                ],
            ]
        );

        $this->add_control(
            'tips_title_style_heading',
            [
                'label' => 'Title',
                'type' => \Elementor\Controls_Manager::HEADING,
                'separator' => 'before',
            ]
        );

        $this->add_control(
            'tips_title_color',
            [
                'label' => 'Title Color',
                'type' => \Elementor\Controls_Manager::COLOR,
                'default' => '#ffffff',
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-tips-box strong' => 'color: {{VALUE}};',
                ],
            ]
        );

        $this->add_group_control(
            \Elementor\Group_Control_Typography::get_type(),
            [
                'name' => 'tips_title_typography',
                'label' => 'Title Typography',
                'selector' => '#apotheca-ar-modal .apotheca-tips-box strong',
            ]
        );

        $this->add_responsive_control(
            'tips_title_margin',
            [
                'label' => 'Title Margin',
                'type' => \Elementor\Controls_Manager::DIMENSIONS,
                'size_units' => ['px', 'em'],
                'default' => [
                    'top' => 0,
                    'right' => 0,
                    'bottom' => 8,
                    'left' => 0,
                    'unit' => 'px',
                ],
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-tips-box strong' => 'display:inline-block; margin: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
                ],
            ]
        );

        $this->add_control(
            'tips_content_style_heading',
            [
                'label' => 'Content',
                'type' => \Elementor\Controls_Manager::HEADING,
                'separator' => 'before',
            ]
        );

        $this->add_group_control(
            \Elementor\Group_Control_Typography::get_type(),
            [
                'name' => 'tips_content_typography',
                'label' => 'Content Typography',
                'selector' => '#apotheca-ar-modal .apotheca-tips-box .apotheca-tips-content',
            ]
        );

        $this->add_responsive_control(
            'tips_content_line_height',
            [
                'label' => 'Content Line Height',
                'type' => \Elementor\Controls_Manager::SLIDER,
                'size_units' => ['em'],
                'range' => [
                    'em' => [
                        'min' => 0.8,
                        'max' => 3,
                        'step' => 0.05,
                    ],
                ],
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-tips-box .apotheca-tips-content' => 'line-height: {{SIZE}}{{UNIT}};',
                    '#apotheca-ar-modal .apotheca-tips-box .apotheca-tips-content *' => 'line-height: inherit;',
                ],
            ]
        );

        $this->add_responsive_control(
            'tips_padding',
            [
                'label' => 'Padding',
                'type' => \Elementor\Controls_Manager::DIMENSIONS,
                'size_units' => ['px', 'em'],
                'default' => [
                    'top' => 15,
                    'right' => 15,
                    'bottom' => 15,
                    'left' => 15,
                    'unit' => 'px',
                ],
                'selectors' => [
                    '#apotheca-ar-modal .apotheca-tips-box' => 'padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
                ],
            ]
        );

        $this->add_responsive_control(
            'tips_border_radius',
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
                    '#apotheca-ar-modal .apotheca-tips-box' => 'border-radius: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
                ],
            ]
        );

        $this->add_group_control(
            \Elementor\Group_Control_Border::get_type(),
            [
                'name' => 'tips_border',
                'selector' => '#apotheca-ar-modal .apotheca-tips-box',
            ]
        );

        $this->end_controls_section();

        // --- Close Button Style ---
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
            // Pass settings to modal template
            $modal_settings = [
                'modal_title' => $settings['modal_title'],
                'controls_heading_text' => $settings['controls_heading_text'],
                'show_tips_box' => $settings['show_tips_box'],
                'tips_title' => $settings['tips_title'],
                'tips_content' => $settings['tips_content'],
            ];
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
            if ($attribute->is_taxonomy()) {
				$terms = $attribute->get_terms();

				// Honour the custom ordering set in Products > Attributes > Configure terms
				// (drag-and-drop ordering). WooCommerce stores this ordering either in term meta
				// key "order" (most common), or in the wp_terms.term_order column (older installs).
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
                $attr_label = wc_attribute_label($attribute->get_name());
                $attr_slug = sanitize_title($attribute->get_name());

                $has_swatches = false;
                foreach ($terms as $term) {
                    if (get_term_meta($term->term_id, 'fif_swatch_color', true)) {
                        $has_swatches = true;
                        break;
                    }
                }

                if ($has_swatches) {
                    $html .= '<div class="apotheca-variation-swatches">';
                    $html .= '<h4>' . esc_html($attr_label) . '</h4>';
                    $html .= '<div class="apotheca-swatch-list">';

                    foreach ($terms as $term) {
                        $swatch_color = get_term_meta($term->term_id, 'fif_swatch_color', true);

                        if (!empty($swatch_color)) {
                            $html .= sprintf(
                                '<button type="button" class="apotheca-swatch-btn" data-color="%s" data-name="%s" data-attribute="%s" data-label="%s" title="%s">'
                                . '<span class="apotheca-swatch-inner" style="--apotheca-swatch-bg: %s;"><span class="apotheca-swatch-fill"></span></span>'
                                . '</button>',
                                esc_attr($swatch_color),
                                esc_attr($term->name),
                                esc_attr($attr_slug),
                                esc_attr($term->name),
                                esc_attr($term->name),
                                esc_attr($swatch_color)
                            );
                        }
                    }

                    $html .= '</div>';
                    $html .= '<div class="apotheca-swatch-active-name"></div>';
                    $html .= '</div>';
                }
            }
        }

        return $html;
    }
}
