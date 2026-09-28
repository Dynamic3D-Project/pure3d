import type { GlyphSource } from '../home3/particle-field';

const COLUMNS = 8;
const ROWS = 8;
/** Cell size in atlas pixels; 8 × 64 keeps both sides of the atlas a power of two. */
const CELL = 64;
const FONT_SIZE = 44;
const OUTLINE = 7;

/** The letters of the headline in reading order, without spaces. */
function letterSequence(copy: HTMLElement) {
	const source = copy.querySelector('h1')?.textContent ?? copy.textContent ?? '';
	return Array.from(source.replace(/\s+/g, ''));
}

/**
 * Sets every distinct letter of the hero headline into its own atlas cell, white with a black
 * outline, and assigns the particles to cells so the cloud spells the headline over and over.
 */
export const headlineGlyphs: GlyphSource = async (copy, count) => {
	const heading = copy.querySelector('h1') ?? copy;
	const style = getComputedStyle(heading);
	const font = `${style.fontWeight} ${FONT_SIZE}px ${style.fontFamily}`;
	// The atlas is drawn once, so it waits for the face the headline is set in.
	await document.fonts.load(font);

	const letters = letterSequence(copy);
	if (letters.length === 0) throw new Error('The hero has no text to set as letters.');

	const canvas = document.createElement('canvas');
	canvas.width = COLUMNS * CELL;
	canvas.height = ROWS * CELL;
	const context = canvas.getContext('2d');
	if (!context) throw new Error('The letter atlas could not be drawn.');

	context.font = font;
	context.textAlign = 'center';
	context.textBaseline = 'alphabetic';
	context.lineJoin = 'round';
	context.lineWidth = OUTLINE;
	context.strokeStyle = '#000';
	context.fillStyle = '#fff';

	const cellOf = new Map<string, number>();
	for (const letter of letters) {
		if (cellOf.has(letter) || cellOf.size >= COLUMNS * ROWS) continue;
		const cell = cellOf.size;
		cellOf.set(letter, cell);

		// Centre the ink rather than the em box, so every letter sits in the middle of its cell.
		const metrics = context.measureText(letter);
		const x =
			(cell % COLUMNS) * CELL +
			CELL / 2 +
			(metrics.actualBoundingBoxLeft - metrics.actualBoundingBoxRight) / 2;
		const y =
			Math.floor(cell / COLUMNS) * CELL +
			CELL / 2 +
			(metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
		context.strokeText(letter, x, y);
		context.fillText(letter, x, y);
	}

	const cells = new Float32Array(count);
	for (let i = 0; i < count; i++) cells[i] = cellOf.get(letters[i % letters.length]) ?? 0;

	return { atlas: canvas, columns: COLUMNS, rows: ROWS, cells };
};
