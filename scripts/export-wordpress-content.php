<?php
// Read-only export. Run inside the existing WordPress container; does not update WordPress.
ob_start();
define('WP_CACHE', false);
$_SERVER['HTTP_HOST'] = 'legacy.57-129-98-223.sslip.io';
$_SERVER['REQUEST_URI'] = '/';
require '/var/www/html/wp-load.php';
ob_end_clean();
$posts = get_posts(['post_type' => ['post', 'page', '3d_registry'], 'post_status' => 'publish', 'numberposts' => -1, 'orderby' => 'ID', 'order' => 'ASC', 'date_query' => [['before' => '2026-08-26 23:59:59', 'inclusive' => true]]]);
$items = [];
foreach ($posts as $entry) {
    $GLOBALS['post'] = clone $entry;
    setup_postdata($entry);
    $notes = [];
    if ($entry->post_password) $notes[] = 'Password-protected in WordPress: review access before publishing.';
    ob_start();
    try { $html = apply_filters('the_content', $entry->post_content); }
    catch (Throwable $e) { $html = $entry->post_content; $notes[] = 'WordPress rendering needs review: ' . $e->getMessage(); }
    ob_end_clean();
    $cover = get_the_post_thumbnail_url($entry, 'full') ?: '';
    if ($entry->post_type === '3d_registry') {
        $html = '';
        foreach (['project_description', 'project_purpose', 'project_leader', 'model_creator', 'start_date', 'end_date', 'main_institution', 'partner_institutions', 'subject', 'publisher', 'language', 'copyright', 'publication_type', 'license', 'modelling_methods', 'software_used', 'model_format', 'display_technology', 'procedural_modality', 'mechanisms', 'input_devices', 'interaction', 'further_information', 'publications'] as $field) {
            $value = get_post_meta($entry->ID, $field, true);
            if (is_array($value)) $value = implode(', ', array_filter($value, 'is_scalar'));
            if (!is_scalar($value) || trim((string)$value) === '') continue;
            $html .= '<h2>' . esc_html(ucwords(str_replace('_', ' ', $field))) . '</h2>' . wpautop(esc_html((string)$value));
        }
        $image = get_post_meta($entry->ID, 'project_image', true);
        if (is_string($image) && strpos($image, '/wp-content/uploads/') !== false) {
            $cover = 'http://legacy.57-129-98-223.sslip.io' . substr($image, strpos($image, '/wp-content/uploads/'));
        }
        $notes[] = 'Recovered from backed-up registry metadata without the missing ACF plugin; review as an edition/collection entry.';
    }
    if ($entry->post_name === '3d-registry') {
        $html = '<p>Explore projects documented in the PURE3D 3D Registry.</p><ul>';
        foreach ($posts as $registry) {
            if ($registry->post_type === '3d_registry') $html .= '<li><a href="' . esc_url(get_permalink($registry)) . '">' . esc_html($registry->post_title) . '</a></li>';
        }
        $html .= '</ul>';
        $notes[] = 'Registry index rebuilt from backed-up records. Review before publication.';
    }
    $items[] = [
        'id' => $entry->ID, 'type' => $entry->post_type, 'slug' => $entry->post_name,
        'title' => html_entity_decode(get_the_title($entry), ENT_QUOTES | ENT_HTML5, 'UTF-8'),
        'content' => $html, 'raw' => $entry->post_content,
        'summary' => wp_strip_all_tags($entry->post_excerpt),
        'url' => get_permalink($entry), 'date' => $entry->post_date_gmt,
        'modified' => $entry->post_modified_gmt,
        'author' => get_the_author_meta('display_name', $entry->post_author),
        'categories' => wp_get_post_categories($entry->ID, ['fields' => 'names']),
        'cover' => $cover, 'notes' => $notes
    ];
}
wp_reset_postdata();
while (ob_get_level() > 0) ob_end_clean();
echo json_encode($items, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
