/**
 * Content of the /demo1 demonstration edition. The object is the procedural tablet in
 * tablet-surface.ts, so every "observation" below describes what that code actually carves. Anything
 * interpretive is written as an example of what an editor could say and is labelled as illustrative;
 * nothing here makes a claim about a real object, site, person or publication.
 */

import type { RenderMode } from './tablet-renderer';

export type Category = 'text' | 'ornament' | 'form' | 'condition';

export const CATEGORIES: { id: Category; label: string }[] = [
	{ id: 'text', label: 'Cut signs' },
	{ id: 'ornament', label: 'Ornament' },
	{ id: 'form', label: 'Form' },
	{ id: 'condition', label: 'Condition' }
];

/** A camera, lamp and shading the model moves to; any field left out keeps its current value. */
export interface Staging {
	yaw: number;
	tilt: number;
	zoom: number;
	/** Point of the plate held at the middle of the view, in plate units from its centre. */
	panX: number;
	panY: number;
	/** Lamp direction and height, in degrees. */
	azimuth: number;
	elevation: number;
	mode: RenderMode;
	contour: boolean;
	grid: boolean;
}

export interface Annotation {
	id: string;
	number: number;
	title: string;
	category: Category;
	/** Where the pin sits, in texture coordinates (v runs up the plate). */
	u: number;
	v: number;
	/** Region the annotation concerns: centre in texture coordinates, radius in plate units. */
	focus: { u: number; v: number; radius: number };
	staging: Staging;
	/** What anyone can check on this model; true of the procedural tablet. */
	observation: string;
	/** An example of the editorial note an edition could carry here. Illustrative only. */
	note: string;
	/** Why the suggested light and shading were chosen. */
	method: string;
	related: string[];
}

const view = (
	panX: number,
	panY: number,
	zoom: number,
	azimuth: number,
	elevation: number,
	mode: RenderMode = 'stone',
	extra: Partial<Staging> = {}
): Staging => ({
	yaw: -0.08,
	tilt: 0.22,
	zoom,
	panX,
	panY,
	azimuth,
	elevation,
	mode,
	contour: false,
	grid: false,
	...extra
});

export const ANNOTATIONS: Annotation[] = [
	{
		id: 'panel',
		number: 1,
		title: 'Sunken panel',
		category: 'text',
		u: 0.5,
		v: 0.2575,
		focus: { u: 0.5, v: 0.2575, radius: 0.46 },
		staging: view(0, -0.485, 1.7, 176, 9),
		observation:
			'The lower half of the face is cut back into a shallow rectangular panel carrying five lines of incised signs. Its floor sits about 0.012 model units below the surrounding field.',
		note: 'Illustrative note: an editor would record the extent of the panel, how the lines are laid out, and whether the setting-out marks are visible on the model or only inferred.',
		method:
			'Raking light from the left, 9° above the surface, casts the panel edge as a line of shadow.',
		related: ['line-1', 'line-5']
	},
	{
		id: 'line-1',
		number: 2,
		title: 'Line 1 of the signs',
		category: 'text',
		u: 0.5,
		v: 0.394,
		focus: { u: 0.5, v: 0.394, radius: 0.2 },
		staging: view(0, -0.21, 3.2, 150, 10),
		observation:
			'The first line has thirteen sign positions. Each sign is built from up to three straight V-cuts; the edition record counts cut and blank positions line by line.',
		note: 'Illustrative note: here an edition would give a transcription sign by sign, mark each reading as certain, probable or unclear, and name the lighting it was checked under. This tablet has no script, so no reading is offered.',
		method: 'Light from the upper left at 10° separates cut strokes from the surface texture.',
		related: ['panel', 'line-5']
	},
	{
		id: 'line-5',
		number: 3,
		title: 'Line 5, the short line',
		category: 'text',
		u: 0.5,
		v: 0.114,
		focus: { u: 0.5, v: 0.114, radius: 0.2 },
		staging: view(0, -0.77, 3.2, 200, 7, 'specular'),
		observation:
			'The last line is shorter than the four above it: seven sign positions, centred in the panel.',
		note: 'Illustrative note: a shorter, centred line could be discussed as a layout choice or a closing formula. Which it is would have to be argued from comparable objects, cited in the edition.',
		method:
			'Specular enhancement removes colour and exaggerates slope changes, so shallow cuts read more clearly.',
		related: ['line-1', 'panel']
	},
	{
		id: 'rosette',
		number: 4,
		title: 'Eight-petalled rosette',
		category: 'ornament',
		u: 0.5,
		v: 0.81,
		focus: { u: 0.5, v: 0.7, radius: 0.44 },
		staging: view(0, 0.4, 1.9, 118, 22, 'stone', { contour: true }),
		observation:
			'A raised ring encloses eight petals set around a central boss. Each petal carries a fine groove along its axis.',
		note: 'Illustrative note: a motif note would compare the rosette with published parallels and give the references it relies on. None are given here because the motif is invented.',
		method: 'Contour lines every 0.008 model units show how the petals rise towards the boss.',
		related: ['boss', 'moulding']
	},
	{
		id: 'boss',
		number: 5,
		title: 'Drilled boss',
		category: 'ornament',
		u: 0.5,
		v: 0.7,
		focus: { u: 0.5, v: 0.7, radius: 0.13 },
		staging: view(0, 0.4, 4, 90, 30, 'height'),
		observation:
			'At the centre of the rosette a domed boss is the highest point of the carving. A small drilled hollow sits at its top.',
		note: 'Illustrative note: whether a hollow like this is original, a later fixing point or damage is exactly the kind of question an edition should leave visibly open when the evidence does not decide it.',
		method: 'Height shading maps low surfaces to green and the highest to vermillion.',
		related: ['rosette']
	},
	{
		id: 'moulding',
		number: 6,
		title: 'Frame moulding',
		category: 'form',
		u: 0.06,
		v: 0.42,
		focus: { u: 0.06, v: 0.42, radius: 0.22 },
		staging: view(-0.66, -0.16, 3, 4, 14, 'height', { contour: true, yaw: 0.28 }),
		observation:
			'A raised band runs round the face, with a narrow bead along its crest and a fine groove just inside it. The outer edge is bevelled down.',
		note: 'Illustrative note: measurements taken on the model belong here, next to the method and tolerance used to take them. Use the measure tool to try it.',
		method: 'Height shading with contours shows the profile of the band without casting shadows.',
		related: ['rosette', 'break']
	},
	{
		id: 'break',
		number: 7,
		title: 'Broken corner',
		category: 'condition',
		u: 0.767,
		v: 0.875,
		focus: { u: 0.8, v: 0.875, radius: 0.3 },
		staging: view(0.45, 0.75, 2.4, 40, 16),
		observation:
			'The upper-right corner is missing along a jagged diagonal. The surviving surface drops away towards the break.',
		note: 'Illustrative note: paradata should say what is missing, whether anything was reconstructed, and how a reader can tell captured evidence from inference. Nothing is reconstructed on this model.',
		method: 'Light from the upper right catches the fracture edge.',
		related: ['surface', 'moulding']
	},
	{
		id: 'surface',
		number: 8,
		title: 'Surface texture',
		category: 'condition',
		u: 0.25,
		v: 0.55,
		focus: { u: 0.25, v: 0.55, radius: 0.16 },
		staging: view(-0.375, 0.1, 4, 250, 6, 'specular'),
		observation:
			'The flat field carries a fine, uneven texture and scattered shallow pits. On this model they are generated noise, not recorded weathering.',
		note: 'Illustrative note: a condition note would separate tool marks, weathering and damage, and say which of them the capture resolution can support.',
		method: 'A very low lamp from below left makes the smallest relief throw shadows.',
		related: ['break']
	}
];

export interface Chapter {
	id: string;
	title: string;
	text: string[];
	staging: Staging;
	/** Annotation whose region is highlighted, if any. */
	focus?: string;
	/** Annotations the chapter points readers to. */
	annotations: string[];
}

export interface Story {
	id: string;
	title: string;
	summary: string;
	chapters: Chapter[];
}

const whole = (
	azimuth: number,
	elevation: number,
	mode: RenderMode = 'stone',
	extra: Partial<Staging> = {}
): Staging => ({
	yaw: -0.18,
	tilt: 0.3,
	zoom: 1,
	panX: 0,
	panY: 0,
	azimuth,
	elevation,
	mode,
	contour: false,
	grid: false,
	...extra
});

const annotation = (id: string) => ANNOTATIONS.find((item) => item.id === id)!;

export const STORIES: Story[] = [
	{
		id: 'reading',
		title: 'Reading the cut signs',
		summary: 'How lighting and shading change what can be seen in an inscribed panel.',
		chapters: [
			{
				id: 'entire',
				title: 'The object entire',
				text: [
					'Start with the whole slab: a moulded frame, a rosette in the upper half and a sunken panel of cut signs below. The upper-right corner is broken away.',
					'The tablet is generated in your browser. It stands in for a captured model so the tools of an edition can be shown without making claims about a real object.'
				],
				staging: whole(120, 42),
				annotations: ['panel', 'rosette', 'break']
			},
			{
				id: 'raking',
				title: 'Raking light across the panel',
				text: [
					'With the lamp high, the panel reads faintly. Lower it to a grazing angle from the left and the edge of the panel and every cut stroke throw shadows.',
					'Try the lamp dial: the same surface looks different under every light, which is why an edition lets readers move it.'
				],
				staging: annotation('panel').staging,
				focus: 'panel',
				annotations: ['panel']
			},
			{
				id: 'first-line',
				title: 'The first line',
				text: [
					'Thirteen sign positions, each built from a few straight cuts. A reading would go here, sign by sign, with its certainty stated.',
					'This tablet has no script, so the edition says so rather than offering a reading.'
				],
				staging: annotation('line-1').staging,
				focus: 'line-1',
				annotations: ['line-1']
			},
			{
				id: 'short-line',
				title: 'A short last line',
				text: [
					'Specular enhancement strips out colour and turns slope into brightness. The last line, seven positions long and centred, stands out against the empty panel floor.'
				],
				staging: annotation('line-5').staging,
				focus: 'line-5',
				annotations: ['line-5', 'panel']
			},
			{
				id: 'unsettled',
				title: 'What light cannot settle',
				text: [
					'Surface normals show direction without any lamp at all: a check on what shadows may exaggerate.',
					'A careful edition records which views a reading rests on and leaves open what they do not decide.'
				],
				staging: view(0, -0.485, 1.6, 150, 20, 'normals'),
				focus: 'panel',
				annotations: ['panel', 'line-1', 'line-5']
			}
		]
	},
	{
		id: 'ornament',
		title: 'Ornament and form',
		summary: 'The rosette, its boss and the frame, read through contours and height.',
		chapters: [
			{
				id: 'rosette',
				title: 'A rosette in relief',
				text: [
					'Eight petals inside a raised ring. Under a steady lamp from the upper left the carving reads as a single motif.'
				],
				staging: view(0, 0.4, 1.9, 118, 26),
				focus: 'rosette',
				annotations: ['rosette']
			},
			{
				id: 'contours',
				title: 'Contours of the petals',
				text: [
					'Contour lines drawn on the model trace equal heights. Where they crowd together the surface is steep; the petals rise towards the centre.'
				],
				staging: annotation('rosette').staging,
				focus: 'rosette',
				annotations: ['rosette', 'boss']
			},
			{
				id: 'boss',
				title: 'The drilled boss',
				text: [
					'Height shading colours the highest surfaces vermillion, so the boss stands out at the centre. The small hollow at its top shows as a dip in the colour.'
				],
				staging: annotation('boss').staging,
				focus: 'boss',
				annotations: ['boss']
			},
			{
				id: 'frame',
				title: 'The frame moulding',
				text: [
					'Turn to the left edge: a raised band with a bead and an inner groove. This is where a measurement, and the method behind it, would be recorded.'
				],
				staging: annotation('moulding').staging,
				focus: 'moulding',
				annotations: ['moulding']
			}
		]
	},
	{
		id: 'condition',
		title: 'Condition and making',
		summary: 'Damage, surface and the record of how the model came to be.',
		chapters: [
			{
				id: 'break',
				title: 'The broken corner',
				text: [
					'The upper-right corner is lost. Light from that side catches the jagged edge where the surface drops away.'
				],
				staging: annotation('break').staging,
				focus: 'break',
				annotations: ['break']
			},
			{
				id: 'not-reconstructed',
				title: 'Nothing filled in',
				text: [
					'The mesh view shows the grid the geometry is built on. It stops at the break: nothing has been modelled where there is no stone.',
					'In a captured edition, paradata would say the same about any gap, repair or reconstruction.'
				],
				staging: view(0.3, 0.55, 1.8, 40, 30, 'mesh'),
				focus: 'break',
				annotations: ['break']
			},
			{
				id: 'texture',
				title: 'Texture and pitting',
				text: [
					'A lamp just above the surface picks out fine texture and scattered pits. Here they come from a noise function, and the edition says so.'
				],
				staging: annotation('surface').staging,
				focus: 'surface',
				annotations: ['surface']
			},
			{
				id: 'record',
				title: 'A documented view',
				text: [
					'Finally a fixed view against a reference grid, square to the camera under a stated light: the view a catalogue photograph would record, kept alongside the interactive model.'
				],
				staging: {
					yaw: 0,
					tilt: 0,
					zoom: 1,
					panX: 0,
					panY: 0,
					azimuth: 135,
					elevation: 38,
					mode: 'stone',
					contour: false,
					grid: true
				},
				annotations: ['moulding', 'break']
			}
		]
	}
];

/** The view the edition opens on and returns to. */
export const HOME_STAGING: Staging = whole(120, 42);

export const MODE_LABELS: Record<RenderMode, { label: string; hint: string }> = {
	stone: { label: 'Stone', hint: 'Lit surface with cast shadows' },
	specular: { label: 'Specular', hint: 'Colour removed, slope changes exaggerated' },
	normals: { label: 'Normals', hint: 'Surface direction as colour, independent of the lamp' },
	height: { label: 'Height', hint: 'Low surfaces green, high surfaces vermillion' },
	mesh: { label: 'Mesh', hint: 'The grid the geometry is built on' }
};

/** Figures read from the model once it has been built, for the technical record. */
export interface ModelFacts {
	vertices: number;
	triangles: number;
	mapWidth: number;
	mapHeight: number;
	/** Share of the plate where stone survives, 0 to 1. */
	surviving: number;
	low: number;
	high: number;
}

export const EDITION = {
	title: 'Tablet with Rosette and Cut Signs',
	subtitle: 'A demonstration 3D scholarly edition',
	identifier: 'demo1',
	status: 'Demonstration · not submitted for review',
	version: 'Design prototype, not versioned'
};
