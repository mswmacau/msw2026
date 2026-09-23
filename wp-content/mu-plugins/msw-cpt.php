<?php
/**
 * Plugin Name: MSW 街健館 — 活動內容模型
 * Description: 註冊 msw_event 活動文章類型，並開放給 REST API，供 Next.js 前端讀取。
 * Version: 1.0
 * Author: MSW
 */

if (!defined('ABSPATH')) exit;

add_action('init', function () {
    register_post_type('msw_event', [
        'labels' => [
            'name'          => '活動',
            'singular_name' => '活動',
            'add_new_item'  => '新增活動',
            'edit_item'     => '編輯活動',
        ],
        'public'       => true,
        'show_in_rest' => true,           // REST API 可用 → Next.js 可讀
        'supports'     => ['title', 'editor', 'excerpt', 'thumbnail', 'custom-fields'],
        'has_archive'  => true,
        'rewrite'      => ['slug' => 'events'],
        'menu_icon'    => 'dashicons-calendar-alt',
        'menu_position' => 6,
    ]);

    register_taxonomy('msw_event_type', 'msw_event', [
        'labels'       => ['name' => '活動類型', 'singular_name' => '活動類型'],
        'public'       => true,
        'show_in_rest' => true,
        'hierarchical' => true,
    ]);
});

/** 讓 REST API 回傳精選圖片（_embed）與自訂欄位 */
add_action('rest_api_init', function () {
    register_rest_field('msw_event', 'msw_meta', [
        'get_callback' => function ($post) {
            return [
                'schedule' => get_post_meta($post['id'], 'schedule', true),
                'location' => get_post_meta($post['id'], 'location', true),
                'points'   => get_post_meta($post['id'], 'points', true),
            ];
        },
        'schema' => [
            'type' => 'object',
            'properties' => [
                'schedule' => ['type' => 'string'],
                'location' => ['type' => 'string'],
                'points'   => ['type' => 'string'],
            ],
        ],
    ]);
});

/** 前端跨域讀取（開發環境） */
add_action('rest_api_init', function () {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    add_filter('rest_pre_serve_request', function ($value) {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Authorization, Content-Type');
        return $value;
    });
}, 15);
