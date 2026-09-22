import { expect, test } from 'bun:test';
import { classifyContent } from './content';
import { cleanContent } from '../../scripts/wordpress-html';

test('WordPress HTML keeps useful media and removes active content', () => {
	const html = cleanContent(
		'<p onclick="evil()">Text<script>evil()</script><img src="https://example.com/a.jpg" onerror="evil()"><a href="javascript:evil()">link</a></p><iframe src="https://evil.com"></iframe><iframe src="https://www.youtube.com/embed/123" title="Talk"></iframe>'
	);
	expect(html).not.toMatch(/onclick|onerror|javascript:|<script|<iframe src="https:\/\/evil.com/);
	expect(html).toContain('https://example.com/a.jpg');
	expect(html).toContain('https://www.youtube.com/embed/123');
	expect(html).toContain('Open embedded resource');
});
test('PDF destinations prioritise publication and presentation over news', () => {
	expect(classifyContent('making-3d-fair', 'post', ['News', 'Outputs', 'Publications']).kind).toBe(
		'publication'
	);
	expect(classifyContent('workshop', 'post', ['News', 'Presentations']).kind).toBe('presentation');
	expect(classifyContent('submission-guidelines', 'page', []).section).toBe('publish');
	expect(classifyContent('team', 'page', []).section).toBe('about');
	expect(classifyContent('structural-and-lighting-models', '3d_registry', []).section).toBe(
		'explore'
	);
});
test('Avada headings and empty layout paragraphs become valid editor markup', () => {
	expect(cleanContent('<p></p><h2><p>Guidebook</p></h2><p>Body</p><p><br /></p>')).toBe(
		'<h2>Guidebook</h2><p>Body</p>'
	);
});
