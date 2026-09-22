import { expect, test } from 'bun:test';
import { embedUrl } from './editor-embed';
test('only supported HTTPS video URLs can become editor embeds', () => {
	expect(embedUrl('https://youtu.be/abc-123')).toBe(
		'https://www.youtube-nocookie.com/embed/abc-123'
	);
	expect(embedUrl('https://www.youtube.com/watch?v=abc')).toBe(
		'https://www.youtube-nocookie.com/embed/abc'
	);
	expect(embedUrl('https://vimeo.com/12345')).toBe('https://player.vimeo.com/video/12345');
	expect(embedUrl('javascript:alert(1)')).toBeNull();
	expect(embedUrl('https://www.youtube.com.evil.org/embed/abc')).toBeNull();
});
