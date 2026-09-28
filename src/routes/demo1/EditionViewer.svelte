<script lang="ts">
	import { onMount, tick } from 'svelte';
	import LampDial from './LampDial.svelte';
	import TabletDiagram from './TabletDiagram.svelte';
	import {
		ANNOTATIONS,
		CATEGORIES,
		HOME_STAGING,
		MODE_LABELS,
		STORIES,
		type Annotation,
		type Category,
		type ModelFacts,
		type Staging
	} from './edition-content';
	import {
		RENDER_MODES,
		TabletRenderer,
		type RenderMode,
		type TabletFrame
	} from './tablet-renderer';
	import {
		PLATE_HEIGHT,
		PLATE_WIDTH,
		bakeTabletMap,
		buildTabletMesh,
		sampleHeight,
		type TabletMap
	} from './tablet-surface';

	interface Props {
		/** Called once the model is built, with figures for the technical record. */
		onready?: (facts: ModelFacts) => void;
	}

	let { onready }: Props = $props();

	type Status = 'pending' | 'live' | 'fallback';
	type Tool = 'turn' | 'light' | 'measure';
	type Panel = 'overview' | 'annotation' | 'chapter';
	type GuideTab = 'stories' | 'annotations';
	type CompactTab = 'note' | GuideTab;
	interface PlatePoint {
		u: number;
		v: number;
		h: number;
	}
	interface PinPosition {
		x: number;
		y: number;
		visible: boolean;
	}

	const MAX_PIXEL_RATIO = 1.75;
	const COMPACT_PIXEL_RATIO = 1.25;
	/** Caps the drawing buffer on very large screens; each pixel marches a shadow ray. */
	const MAX_CANVAS_PIXELS = 2_400_000;
	const CHAPTER_MS = 9000;
	const MIN_ZOOM = 0.8;
	const MAX_ZOOM = 5;
	const EASED = [
		'yaw',
		'tilt',
		'zoom',
		'panX',
		'panY',
		'contour',
		'grid',
		'focusU',
		'focusV',
		'focusRadius',
		'focus'
	] as const;
	const GUIDE_TABS: GuideTab[] = ['stories', 'annotations'];
	const COMPACT_TABS: CompactTab[] = ['note', 'stories', 'annotations'];
	const TOOLS: { id: Tool; label: string }[] = [
		{ id: 'turn', label: 'Turn' },
		{ id: 'light', label: 'Light' },
		{ id: 'measure', label: 'Measure' }
	];

	const byId = (id: string) => ANNOTATIONS.find((item) => item.id === id)!;
	const categoryLabel = (id: Category) => CATEGORIES.find((item) => item.id === id)!.label;
	const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
	const toDegrees = (radians: number) => (radians * 180) / Math.PI;
	const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
	const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
	const storiesWith = (id: string) =>
		STORIES.flatMap((story) =>
			story.chapters
				.map((chapter, index) => ({ story, chapter, index }))
				.filter(({ chapter }) => chapter.focus === id || chapter.annotations.includes(id))
		);

	let viewport = $state<HTMLElement>();
	let canvas = $state<HTMLCanvasElement>();

	let status = $state<Status>('pending');
	let wide = $state(true);
	let expanded = $state(false);
	let guideTab = $state<GuideTab>('stories');
	let compactTab = $state<CompactTab>('note');
	let panel = $state<Panel>('overview');
	let selectedId = $state<string | null>(null);
	let storyId = $state<string | null>(null);
	let chapterIndex = $state(0);
	let playing = $state(false);
	let tool = $state<Tool>('turn');
	let mode = $state<RenderMode>(HOME_STAGING.mode);
	let contour = $state(HOME_STAGING.contour);
	let grid = $state(HOME_STAGING.grid);
	let showPins = $state(true);
	let hiddenCategories = $state<Category[]>([]);
	let azimuth = $state(HOME_STAGING.azimuth);
	let elevation = $state(HOME_STAGING.elevation);
	/** The lamp drifts across the tablet until the reader or a view takes it over. */
	let sweeping = $state(false);
	let reducedMotion = $state(false);
	let pageVisible = $state(true);
	let measureA = $state<PlatePoint | null>(null);
	let measureB = $state<PlatePoint | null>(null);
	let pins = $state<Record<string, PinPosition>>({});
	let ruler = $state<{ a: PinPosition; b: PinPosition | null } | null>(null);
	let announcement = $state('');
	let copyState = $state<'idle' | 'copied' | 'failed'>('idle');
	let shareUrl = $state('');
	let viewChanged = $state(false);

	const selected = $derived(selectedId ? byId(selectedId) : null);
	const story = $derived(STORIES.find((item) => item.id === storyId) ?? null);
	const chapter = $derived(story?.chapters[chapterIndex] ?? null);
	const region = $derived(
		panel === 'annotation' && selected
			? selected.focus
			: panel === 'chapter' && chapter?.focus
				? byId(chapter.focus).focus
				: null
	);
	const linked = $derived(
		panel === 'chapter' && chapter ? chapter.annotations : selected ? [selected.id] : []
	);
	const listed = $derived(ANNOTATIONS.filter((item) => !hiddenCategories.includes(item.category)));
	const pinned = $derived(
		showPins ? listed.filter((item) => status !== 'live' || (pins[item.id]?.visible ?? false)) : []
	);
	const pinStop = $derived(
		pinned.find((item) => item.id === selectedId)?.id ?? pinned[0]?.id ?? null
	);
	const measured = $derived(
		measureA && measureB
			? Math.hypot(
					(measureB.u - measureA.u) * PLATE_WIDTH,
					(measureB.v - measureA.v) * PLATE_HEIGHT,
					measureB.h - measureA.h
				)
			: null
	);
	const selectedIndex = $derived(selected ? ANNOTATIONS.indexOf(selected) : -1);
	const figure = $derived(
		panel === 'annotation' && selected
			? `${selected.number}. ${selected.title}`
			: panel === 'chapter' && chapter
				? chapter.title
				: 'The whole tablet'
	);
	const noteLabel = $derived(
		panel === 'annotation' ? 'Note' : panel === 'chapter' ? 'Chapter' : 'About'
	);

	// Frame state changes every frame, so it stays outside Svelte's reactivity.
	let renderer: TabletRenderer | null = null;
	let map: TabletMap | null = null;
	const initialFrame = (): TabletFrame => ({
		yaw: HOME_STAGING.yaw,
		tilt: HOME_STAGING.tilt,
		zoom: HOME_STAGING.zoom,
		panX: HOME_STAGING.panX,
		panY: HOME_STAGING.panY,
		azimuth: toRadians(HOME_STAGING.azimuth),
		elevation: toRadians(HOME_STAGING.elevation),
		mode: HOME_STAGING.mode,
		contour: 0,
		grid: 0,
		focusU: 0.5,
		focusV: 0.5,
		focusRadius: 0.3,
		focus: 0
	});
	const frame = initialFrame();
	const target = initialFrame();
	let raf = 0;
	let last = 0;
	let lastSync = 0;
	let clock = 0;
	let inView = true;

	// ---------- drawing ----------

	function settled() {
		for (const key of EASED) if (Math.abs(target[key] - frame[key]) > 0.0005) return false;
		return (
			Math.abs(wrap(target.azimuth - frame.azimuth)) < 0.001 &&
			Math.abs(target.elevation - frame.elevation) < 0.001
		);
	}

	function samePin(a: PinPosition | undefined, b: PinPosition) {
		if (!a || a.visible !== b.visible) return false;
		return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
	}

	/** Moves the HTML pins and the ruler to where their plate positions now land on screen. */
	function placeOverlays() {
		if (!renderer) return;
		let changed = false;
		const next: Record<string, PinPosition> = {};
		for (const item of ANNOTATIONS) {
			next[item.id] = renderer.project(frame, item.u, item.v);
			if (!samePin(pins[item.id], next[item.id])) changed = true;
		}
		if (changed) pins = next;
		if (measureA) {
			const a = renderer.project(frame, measureA.u, measureA.v);
			const b = measureB ? renderer.project(frame, measureB.u, measureB.v) : null;
			const moved =
				!ruler ||
				!samePin(ruler.a, a) ||
				(b ? !samePin(ruler.b ?? undefined, b) : ruler.b !== null);
			if (moved) ruler = { a, b };
		} else if (ruler) {
			ruler = null;
		}
	}

	function step(now: number) {
		raf = 0;
		if (!renderer) return;
		const dt = Math.min((now - last) / 1000, 0.05);
		last = now;
		const drifting = sweeping && !reducedMotion;
		if (drifting) {
			clock += dt;
			target.azimuth = toRadians(90 + 72 * Math.sin(clock * 0.32));
			target.elevation = toRadians(17 + 8 * Math.sin(clock * 0.23 + 1));
		}
		const ease = reducedMotion ? 1 : 1 - Math.exp(-dt * 4.2);
		const lampEase = reducedMotion ? 1 : 1 - Math.exp(-dt * 6);
		for (const key of EASED) frame[key] += (target[key] - frame[key]) * ease;
		frame.azimuth += wrap(target.azimuth - frame.azimuth) * lampEase;
		frame.elevation += (target.elevation - frame.elevation) * lampEase;
		frame.mode = target.mode;
		renderer.render(frame);
		placeOverlays();

		if (drifting || !settled()) raf = requestAnimationFrame(step);
		if (drifting && now - lastSync > 250) {
			lastSync = now;
			azimuth = Math.round(((toDegrees(frame.azimuth) % 360) + 360) % 360);
			elevation = Math.round(toDegrees(frame.elevation));
		}
	}

	/** Draws at least one more frame; the loop then keeps itself alive only while something moves. */
	function schedule() {
		if (raf || !renderer || !inView || !pageVisible) return;
		last = performance.now();
		raf = requestAnimationFrame(step);
	}

	function halt() {
		cancelAnimationFrame(raf);
		raf = 0;
	}

	// Reader-facing state drives the frame the loop eases towards.
	$effect(() => {
		target.mode = mode;
		target.contour = contour ? 1 : 0;
		target.grid = grid ? 1 : 0;
		if (!sweeping) {
			target.azimuth = toRadians(azimuth);
			target.elevation = toRadians(elevation);
		}
		if (region) {
			// A highlight that appears from nothing starts in place rather than sliding in.
			if (frame.focus < 0.02) {
				frame.focusU = region.u;
				frame.focusV = region.v;
				frame.focusRadius = region.radius;
			}
			target.focusU = region.u;
			target.focusV = region.v;
			target.focusRadius = region.radius;
			target.focus = 1;
		} else {
			target.focus = 0;
		}
		void measureA;
		void measureB;
		if (pageVisible) schedule();
	});

	// A running story turns its own pages, one timer at a time, and stops on the last chapter.
	$effect(() => {
		if (!playing || !story || !pageVisible) return;
		const index = chapterIndex;
		const timer = setTimeout(() => {
			if (story && index < story.chapters.length - 1) openChapter(story.id, index + 1, false);
			else playing = false;
		}, CHAPTER_MS);
		return () => clearTimeout(timer);
	});

	// A copied link belongs to the view it was copied from.
	$effect(() => {
		void panel;
		void selectedId;
		void chapterIndex;
		void storyId;
		copyState = 'idle';
	});

	// ---------- views, annotations and stories ----------

	function announce(message: string) {
		announcement = message;
	}

	function stage(staging: Staging) {
		target.yaw = staging.yaw;
		target.tilt = staging.tilt;
		target.zoom = staging.zoom;
		target.panX = staging.panX;
		target.panY = staging.panY;
		sweeping = false;
		azimuth = staging.azimuth;
		elevation = staging.elevation;
		mode = staging.mode;
		contour = staging.contour;
		grid = staging.grid;
		viewChanged = false;
		schedule();
	}

	function selectAnnotation(id: string) {
		const item = byId(id);
		selectedId = id;
		panel = 'annotation';
		playing = false;
		stage(item.staging);
		if (!wide) compactTab = 'note';
		announce(`Annotation ${item.number}, ${item.title}. The view and lamp have moved to it.`);
	}

	function stepAnnotation(offset: number) {
		const pool = listed.length ? listed : ANNOTATIONS;
		const current = selected ? pool.indexOf(selected) : -1;
		const next = pool[(current + offset + pool.length) % pool.length];
		selectAnnotation(next.id);
	}

	function openChapter(id: string, index: number, stopPlaying = true) {
		const next = STORIES.find((item) => item.id === id);
		if (!next) return;
		const clamped = clamp(index, 0, next.chapters.length - 1);
		storyId = id;
		chapterIndex = clamped;
		selectedId = null;
		panel = 'chapter';
		if (stopPlaying) playing = false;
		stage(next.chapters[clamped].staging);
		if (!wide) compactTab = 'note';
		announce(
			`${next.title}, chapter ${clamped + 1} of ${next.chapters.length}: ${next.chapters[clamped].title}.`
		);
	}

	function stepChapter(offset: number) {
		if (story) openChapter(story.id, chapterIndex + offset);
	}

	function togglePlay() {
		if (!story) return;
		if (!playing && chapterIndex === story.chapters.length - 1) openChapter(story.id, 0);
		playing = !playing;
	}

	function closeStory() {
		storyId = null;
		playing = false;
		panel = 'overview';
		stage(HOME_STAGING);
		announce('Story closed. Showing the whole tablet.');
	}

	function showWhole() {
		selectedId = null;
		if (story) {
			openChapter(story.id, chapterIndex);
			return;
		}
		panel = 'overview';
		stage(HOME_STAGING);
		announce('Showing the whole tablet.');
	}

	function reapply() {
		if (panel === 'annotation' && selected) stage(selected.staging);
		else if (panel === 'chapter' && chapter) stage(chapter.staging);
		else stage(HOME_STAGING);
	}

	function toggleCategory(id: Category) {
		hiddenCategories = hiddenCategories.includes(id)
			? hiddenCategories.filter((item) => item !== id)
			: [...hiddenCategories, id];
	}

	// ---------- camera and lamp ----------

	function takeLamp(nextAzimuth: number, nextElevation: number) {
		sweeping = false;
		azimuth = nextAzimuth;
		elevation = nextElevation;
		viewChanged = true;
	}

	function turnBy(dx: number, dy: number) {
		target.yaw = clamp(target.yaw + dx, -1.1, 1.1);
		target.tilt = clamp(target.tilt + dy, -0.35, 1.1);
		frame.yaw = target.yaw;
		frame.tilt = target.tilt;
		viewChanged = true;
		schedule();
	}

	function panBy(dx: number, dy: number, immediate: boolean) {
		const units = renderer ? renderer.unitsPerPixel(frame) : 0.004;
		target.panX = clamp(target.panX - dx * units, -PLATE_WIDTH / 2, PLATE_WIDTH / 2);
		target.panY = clamp(target.panY + dy * units, -PLATE_HEIGHT / 2, PLATE_HEIGHT / 2);
		if (immediate) {
			frame.panX = target.panX;
			frame.panY = target.panY;
		}
		viewChanged = true;
		schedule();
	}

	function zoomBy(factor: number, immediate = false) {
		target.zoom = clamp(target.zoom * factor, MIN_ZOOM, MAX_ZOOM);
		if (immediate) frame.zoom = target.zoom;
		viewChanged = true;
		schedule();
	}

	function resetView() {
		target.yaw = HOME_STAGING.yaw;
		target.tilt = HOME_STAGING.tilt;
		target.zoom = 1;
		target.panX = 0;
		target.panY = 0;
		viewChanged = true;
		schedule();
		announce('View reset to the whole tablet. Lamp and shading are unchanged.');
	}

	// ---------- pointer and keyboard on the model ----------

	// Gesture bookkeeping is read only by event handlers, not by the template.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const pointers = new Map<number, { x: number; y: number }>();
	let dragStartX = 0;
	let dragStartY = 0;
	let dragMoved = false;
	let dragPans = false;
	let pinchDistance = 0;
	let pinchX = 0;
	let pinchY = 0;

	function localPoint(event: PointerEvent | MouseEvent) {
		const rect = viewport!.getBoundingClientRect();
		return { x: event.clientX - rect.left, y: event.clientY - rect.top };
	}

	function onInterface(eventTarget: EventTarget | null) {
		return eventTarget instanceof Element && !!eventTarget.closest('button, a, input, [data-ui]');
	}

	function lampFromPoint(x: number, y: number) {
		if (!viewport) return;
		const nx = (x / viewport.clientWidth) * 2 - 1;
		const ny = 1 - (y / viewport.clientHeight) * 2;
		// Near the middle the lamp stands high; towards the edges it drops to a raking angle.
		takeLamp(
			Math.round(((toDegrees(Math.atan2(ny, nx)) % 360) + 360) % 360),
			Math.round(70 - 64 * Math.min(1, Math.hypot(nx, ny)))
		);
	}

	function placeMeasure(x: number, y: number) {
		const hit = renderer?.unproject(frame, x, y);
		if (!hit) {
			announce('That point is off the stone. Try again on the tablet surface.');
			return;
		}
		if (!measureA || measureB) {
			measureA = hit;
			measureB = null;
			announce('First point placed. Place the second point to measure.');
		} else {
			measureB = hit;
			announce(`Second point placed. Distance ${formatUnits(measured ?? 0)}.`);
		}
	}

	function clearMeasure() {
		measureA = null;
		measureB = null;
	}

	function setTool(next: Tool) {
		tool = next;
		if (next !== 'measure') clearMeasure();
	}

	function onpointerdown(event: PointerEvent) {
		if (status !== 'live' || !viewport || onInterface(event.target)) return;
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		viewport.setPointerCapture(event.pointerId);
		const point = localPoint(event);
		pointers.set(event.pointerId, point);
		if (pointers.size === 1) {
			dragStartX = point.x;
			dragStartY = point.y;
			dragMoved = false;
			dragPans = event.shiftKey;
			if (tool === 'light') lampFromPoint(point.x, point.y);
		} else if (pointers.size === 2) {
			const [a, b] = [...pointers.values()];
			pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
			pinchX = (a.x + b.x) / 2;
			pinchY = (a.y + b.y) / 2;
			dragMoved = true;
		}
	}

	function onpointermove(event: PointerEvent) {
		const previous = pointers.get(event.pointerId);
		if (!previous) return;
		const point = localPoint(event);
		pointers.set(event.pointerId, point);
		if (pointers.size >= 2) {
			const [a, b] = [...pointers.values()];
			const distance = Math.hypot(a.x - b.x, a.y - b.y);
			const midX = (a.x + b.x) / 2;
			const midY = (a.y + b.y) / 2;
			if (pinchDistance > 0) zoomBy(distance / pinchDistance, true);
			panBy(midX - pinchX, midY - pinchY, true);
			pinchDistance = distance;
			pinchX = midX;
			pinchY = midY;
			return;
		}
		if (Math.hypot(point.x - dragStartX, point.y - dragStartY) > 4) dragMoved = true;
		if (tool === 'light') lampFromPoint(point.x, point.y);
		else if (dragPans) panBy(point.x - previous.x, point.y - previous.y, true);
		else turnBy((point.x - previous.x) * 0.006, (point.y - previous.y) * 0.005);
	}

	function onpointerend(event: PointerEvent) {
		if (!pointers.has(event.pointerId)) return;
		pointers.delete(event.pointerId);
		if (viewport?.hasPointerCapture(event.pointerId))
			viewport.releasePointerCapture(event.pointerId);
		if (pointers.size < 2) pinchDistance = 0;
		if (event.type === 'pointerup' && pointers.size === 0 && !dragMoved && tool === 'measure') {
			const point = localPoint(event);
			placeMeasure(point.x, point.y);
		}
	}

	function onwheel(event: WheelEvent) {
		// Only a pinch or a modified wheel zooms, so scrolling the page is never captured.
		if (status !== 'live' || !(event.ctrlKey || event.metaKey)) return;
		event.preventDefault();
		zoomBy(Math.exp(-event.deltaY * 0.01), true);
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.target !== event.currentTarget) return;
		const big = event.shiftKey ? 3 : 1;
		const arrows: Record<string, [number, number]> = {
			ArrowLeft: [-1, 0],
			ArrowRight: [1, 0],
			ArrowUp: [0, -1],
			ArrowDown: [0, 1]
		};
		const arrow = arrows[event.key];
		if (arrow && event.altKey) {
			panBy(arrow[0] * -24, arrow[1] * -24, false);
		} else if (arrow && event.shiftKey) {
			takeLamp(
				(((azimuth - arrow[0] * 10) % 360) + 360) % 360,
				clamp(elevation - arrow[1] * 3, 4, 88)
			);
		} else if (arrow) {
			if (status !== 'live') return;
			target.yaw = clamp(target.yaw + arrow[0] * 0.08 * big, -1.1, 1.1);
			target.tilt = clamp(target.tilt + arrow[1] * 0.06 * big, -0.35, 1.1);
			viewChanged = true;
			schedule();
		} else if (event.key === '+' || event.key === '=') zoomBy(1.2);
		else if (event.key === '-' || event.key === '_') zoomBy(1 / 1.2);
		else if (event.key === '0') resetView();
		else if (event.key === ']') stepAnnotation(1);
		else if (event.key === '[') stepAnnotation(-1);
		else if (event.key === 'Escape' && (measureA || selected)) {
			if (measureA) clearMeasure();
			else showWhole();
		} else if ((event.key === 'Enter' || event.key === ' ') && tool === 'measure' && viewport) {
			placeMeasure(viewport.clientWidth / 2, viewport.clientHeight / 2);
		} else return;
		event.preventDefault();
	}

	// ---------- lists, pins and tabs ----------

	/**
	 * Arrow keys move focus from one button to the next within `scope`; Home and End jump to the
	 * ends. Up and left go back, down and right go forward.
	 */
	function roveButtons(event: KeyboardEvent, scope: string, selector: string) {
		const back = event.key === 'ArrowUp' || event.key === 'ArrowLeft';
		const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight';
		if (!back && !forward && event.key !== 'Home' && event.key !== 'End') return;
		const button = event.currentTarget as HTMLElement;
		const container = button.closest(scope);
		if (!container) return;
		const buttons = [...container.querySelectorAll<HTMLElement>(selector)];
		const current = buttons.indexOf(button);
		if (current < 0) return;
		event.preventDefault();
		let next = back ? current - 1 : current + 1;
		if (event.key === 'Home') next = 0;
		if (event.key === 'End') next = buttons.length - 1;
		buttons[(next + buttons.length) % buttons.length]?.focus();
	}

	function onpinkey(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			showWhole();
			viewport?.focus();
			return;
		}
		roveButtons(event, '.viewport', 'button[data-pin]');
	}

	/** Left and right arrows, Home and End move between tabs and select them. */
	function ontabkey<T extends string>(
		event: KeyboardEvent,
		tabs: T[],
		current: T,
		set: (tab: T) => void
	) {
		const index = tabs.indexOf(current);
		let next = index;
		if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
		else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
		else if (event.key === 'Home') next = 0;
		else if (event.key === 'End') next = tabs.length - 1;
		else return;
		event.preventDefault();
		set(tabs[next]);
		const list = (event.currentTarget as HTMLElement).closest('[role="tablist"]');
		void tick().then(() => list?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
	}

	// ---------- links ----------

	function viewHash() {
		if (panel === 'annotation' && selected) return `#annotation=${selected.id}`;
		if (panel === 'chapter' && story) return `#story=${story.id}&chapter=${chapterIndex + 1}`;
		return '';
	}

	async function copyLink() {
		shareUrl = `${window.location.origin}${window.location.pathname}${viewHash()}`;
		try {
			await navigator.clipboard.writeText(shareUrl);
			copyState = 'copied';
		} catch {
			copyState = 'failed';
		}
	}

	function applyHash() {
		const params = new URLSearchParams(window.location.hash.slice(1));
		const annotationId = params.get('annotation');
		const storyParam = params.get('story');
		if (annotationId && ANNOTATIONS.some((item) => item.id === annotationId)) {
			selectAnnotation(annotationId);
		} else if (storyParam && STORIES.some((item) => item.id === storyParam)) {
			openChapter(storyParam, Number(params.get('chapter') ?? 1) - 1);
		}
	}

	const formatUnits = (value: number) => `${value.toFixed(3)} model units`;

	// ---------- lifecycle ----------

	onMount(() => {
		const listeners = new AbortController();
		const { signal } = listeners;
		const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		const wideQuery = window.matchMedia('(min-width: 1180px)');
		reducedMotion = motionQuery.matches;
		sweeping = !reducedMotion;
		wide = wideQuery.matches;
		pageVisible = document.visibilityState === 'visible';
		const compact =
			window.matchMedia('(max-width: 900px), (pointer: coarse)').matches ||
			(navigator.hardwareConcurrency ?? 8) <= 4;
		let resize: ResizeObserver | undefined;
		let visibility: IntersectionObserver | undefined;

		motionQuery.addEventListener(
			'change',
			(event) => {
				reducedMotion = event.matches;
				if (reducedMotion) sweeping = false;
				schedule();
			},
			{ signal }
		);
		wideQuery.addEventListener(
			'change',
			(event) => {
				wide = event.matches;
				if (wide && compactTab !== 'note') guideTab = compactTab;
			},
			{ signal }
		);
		document.addEventListener(
			'visibilitychange',
			() => {
				pageVisible = document.visibilityState === 'visible';
				if (pageVisible) schedule();
				else halt();
			},
			{ signal }
		);
		window.addEventListener('hashchange', applyHash, { signal });
		// The model's own gestures and keys, attached once and removed with everything else.
		viewport?.addEventListener('wheel', onwheel, { passive: false, signal });
		viewport?.addEventListener('pointerdown', onpointerdown, { signal });
		viewport?.addEventListener('pointermove', onpointermove, { signal });
		viewport?.addEventListener('pointerup', onpointerend, { signal });
		viewport?.addEventListener('pointercancel', onpointerend, { signal });
		viewport?.addEventListener('keydown', onkeydown, { signal });
		applyHash();

		const start = async () => {
			const surface = canvas;
			const host = viewport;
			if (signal.aborted || !surface || !host) return;
			const mesh = buildTabletMesh(compact ? 72 : 120);
			try {
				map = await bakeTabletMap(compact ? 300 : 432, signal);
				if (signal.aborted) return;
				renderer = TabletRenderer.create(surface, mesh, map, { shadowSteps: compact ? 8 : 14 });
			} catch {
				if (signal.aborted) return;
				renderer = null;
			}
			if (!renderer || !map) {
				status = 'fallback';
				return;
			}
			status = 'live';
			onready?.({
				vertices: mesh.vertexCount,
				triangles: mesh.indices.length / 3,
				mapWidth: map.width,
				mapHeight: map.height,
				surviving: map.surviving,
				low: map.low,
				high: map.high
			});

			surface.addEventListener(
				'webglcontextlost',
				(event) => {
					event.preventDefault();
					halt();
					renderer?.dispose();
					renderer = null;
					status = 'fallback';
					clearMeasure();
					announce('The 3D view stopped working, so a flat diagram is shown instead.');
				},
				{ signal }
			);

			const fit = () => {
				const box = surface.getBoundingClientRect();
				const pixelRatio = Math.min(
					window.devicePixelRatio || 1,
					compact ? COMPACT_PIXEL_RATIO : MAX_PIXEL_RATIO,
					Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, box.width * box.height))
				);
				renderer?.resize(box.width, box.height, pixelRatio);
				// A resize changes where every pin lands, even when nothing else moves.
				if (renderer) {
					renderer.render(frame);
					placeOverlays();
				}
				schedule();
			};
			fit();
			resize = new ResizeObserver(fit);
			resize.observe(surface);

			visibility = new IntersectionObserver(([entry]) => {
				inView = entry.isIntersecting;
				if (inView) schedule();
				else halt();
			});
			visibility.observe(host);
		};

		// The surface is baked in slices after the first paint, so the edition never waits for it.
		void start();

		return () => {
			listeners.abort();
			resize?.disconnect();
			visibility?.disconnect();
			halt();
			renderer?.dispose();
			renderer = null;
			map = null;
			pointers.clear();
		};
	});

	const pinLeft = (item: Annotation) =>
		status === 'live' ? `${pins[item.id]?.x ?? 0}px` : `${((item.u * 150 + 4) / 158) * 100}%`;
	const pinTop = (item: Annotation) =>
		status === 'live' ? `${pins[item.id]?.y ?? 0}px` : `${(((1 - item.v) * 200 + 4) / 208) * 100}%`;
	const isCurrent = (id: string, index: number) =>
		storyId === id && chapterIndex === index && panel === 'chapter';
	const surfaceHeight = (item: Annotation) => {
		const h = status === 'live' && map ? sampleHeight(map, item.u, item.v) : Number.NaN;
		return Number.isNaN(h) ? '—' : formatUnits(h);
	};
</script>

{#snippet storyList()}
	<div class="stories">
		{#each STORIES as item (item.id)}
			<article class="story" class:is-open={storyId === item.id}>
				<header>
					<h3>{item.title}</h3>
					<p>{item.summary}</p>
				</header>
				<ol class="chapters">
					{#each item.chapters as entry, index (entry.id)}
						<li>
							<button
								type="button"
								aria-current={isCurrent(item.id, index) ? 'step' : undefined}
								onclick={() => openChapter(item.id, index)}
							>
								<span class="chapter-number">{index + 1}</span>
								<span>{entry.title}</span>
							</button>
						</li>
					{/each}
				</ol>
				{#if storyId !== item.id}
					<button
						type="button"
						class="button button-primary"
						onclick={() => openChapter(item.id, 0)}
					>
						Start story <span aria-hidden="true">→</span>
					</button>
				{/if}
			</article>
		{/each}
	</div>
{/snippet}

{#snippet annotationList()}
	<div class="annotations">
		<fieldset class="filters">
			<legend>Show on the model</legend>
			{#each CATEGORIES as category (category.id)}
				<button
					type="button"
					class="chip"
					aria-pressed={!hiddenCategories.includes(category.id)}
					onclick={() => toggleCategory(category.id)}
				>
					<span class="swatch" data-category={category.id} aria-hidden="true"></span>
					{category.label}
				</button>
			{/each}
		</fieldset>
		{#if listed.length === 0}
			<p class="empty">All categories are hidden. Choose one above to list its annotations.</p>
		{:else}
			<ol class="annotation-list">
				{#each listed as item (item.id)}
					<li>
						<button
							type="button"
							data-annotation={item.id}
							aria-pressed={selectedId === item.id}
							class:is-linked={linked.includes(item.id)}
							onclick={() => selectAnnotation(item.id)}
							onkeydown={(event) =>
								roveButtons(event, '.annotation-list', 'button[data-annotation]')}
						>
							<span class="badge" data-category={item.category}>{item.number}</span>
							<span class="annotation-text">
								<span class="annotation-title">{item.title}</span>
								<span class="annotation-category">{categoryLabel(item.category)}</span>
							</span>
						</button>
					</li>
				{/each}
			</ol>
			<p class="keys">
				Arrow keys move through the list. In the viewer, [ and ] step between annotations.
			</p>
		{/if}
	</div>
{/snippet}

{#snippet annotationLink(item: Annotation)}
	<li>
		<button type="button" onclick={() => selectAnnotation(item.id)}>
			<span class="small badge" data-category={item.category}>{item.number}</span>
			{item.title}
		</button>
	</li>
{/snippet}

{#snippet copyControls()}
	<div class="share">
		<button type="button" class="button button-outline" onclick={copyLink}>
			Copy link to this view
		</button>
		<p class="share-status" role="status">
			{#if copyState === 'copied'}Link copied.{:else if copyState === 'failed'}Copy this link:{/if}
		</p>
		{#if copyState === 'failed'}
			<input
				class="share-url"
				type="text"
				readonly
				value={shareUrl}
				aria-label="Link to this view"
				onfocus={(event) => event.currentTarget.select()}
			/>
		{/if}
	</div>
{/snippet}

{#snippet context()}
	<div class="context">
		{#if panel === 'annotation' && selected}
			<p class="kicker">
				<span class="badge" data-category={selected.category}>{selected.number}</span>
				Annotation · {categoryLabel(selected.category)}
			</p>
			<h2 id="edition-viewer-context-title">{selected.title}</h2>

			<section class="block">
				<h3>Observed on the model</h3>
				<p>{selected.observation}</p>
			</section>
			<section class="illustrative block">
				<h3>Editorial note <span class="tag">Illustrative</span></h3>
				<p>{selected.note}</p>
			</section>
			<section class="block">
				<h3>View for this note</h3>
				<p>{selected.method}</p>
				<dl class="facts">
					<div>
						<dt>Lamp</dt>
						<dd>{selected.staging.azimuth}° around · {selected.staging.elevation}° up</dd>
					</div>
					<div>
						<dt>Shading</dt>
						<dd>
							{MODE_LABELS[selected.staging.mode].label}{selected.staging.contour
								? ' with contours'
								: ''}
						</dd>
					</div>
					<div>
						<dt>Anchor</dt>
						<dd>u {selected.u.toFixed(3)} · v {selected.v.toFixed(3)}</dd>
					</div>
					<div>
						<dt>Surface height</dt>
						<dd>{surfaceHeight(selected)}</dd>
					</div>
				</dl>
				{#if viewChanged}
					<button type="button" class="button button-outline" onclick={reapply}>
						Return to this note's view
					</button>
				{/if}
			</section>

			{#if storiesWith(selected.id).length}
				<section class="block">
					<h3>In stories</h3>
					<ul class="links">
						{#each storiesWith(selected.id) as entry (`${entry.story.id}-${entry.chapter.id}`)}
							<li>
								<button type="button" onclick={() => openChapter(entry.story.id, entry.index)}>
									{entry.story.title} · {entry.index + 1}. {entry.chapter.title}
								</button>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
			<section class="block">
				<h3>Related annotations</h3>
				<ul class="links">
					{#each selected.related as id (id)}
						{@render annotationLink(byId(id))}
					{/each}
				</ul>
			</section>

			<nav class="pager" aria-label="Annotations">
				<button type="button" class="button button-outline" onclick={() => stepAnnotation(-1)}>
					<span aria-hidden="true">←</span> Previous
				</button>
				<span class="pager-count">{selectedIndex + 1} / {ANNOTATIONS.length}</span>
				<button type="button" class="button button-outline" onclick={() => stepAnnotation(1)}>
					Next <span aria-hidden="true">→</span>
				</button>
			</nav>
			<button type="button" class="text-button" onclick={showWhole}>
				{story ? 'Back to the story' : 'Back to the whole tablet'}
			</button>
			{@render copyControls()}
		{:else if panel === 'chapter' && story && chapter}
			<p class="kicker">Story · {story.title}</p>
			<p class="count">Chapter {chapterIndex + 1} of {story.chapters.length}</p>
			<h2 id="edition-viewer-context-title">{chapter.title}</h2>
			{#each chapter.text as paragraph, index (index)}
				<p class="prose">{paragraph}</p>
			{/each}
			<section class="block">
				<h3>Annotations in this chapter</h3>
				<ul class="links">
					{#each chapter.annotations as id (id)}
						{@render annotationLink(byId(id))}
					{/each}
				</ul>
			</section>
			{#if viewChanged}
				<button type="button" class="button button-outline" onclick={reapply}>
					Return to the chapter's view
				</button>
			{/if}
			<nav class="pager" aria-label="Chapters">
				<button
					type="button"
					class="button button-outline"
					disabled={chapterIndex === 0}
					onclick={() => stepChapter(-1)}
				>
					<span aria-hidden="true">←</span> Previous
				</button>
				<span class="pager-count">{chapterIndex + 1} / {story.chapters.length}</span>
				{#if chapterIndex < story.chapters.length - 1}
					<button type="button" class="button button-primary" onclick={() => stepChapter(1)}>
						Next <span aria-hidden="true">→</span>
					</button>
				{:else}
					<button type="button" class="button button-outline" onclick={closeStory}>
						Finish story
					</button>
				{/if}
			</nav>
			{@render copyControls()}
		{:else}
			<p class="kicker">About this edition</p>
			<h2 id="edition-viewer-context-title">A tablet read by lamplight</h2>
			<p class="prose">
				This demonstration shows a 3D scholarly edition built around its object: a carved tablet
				with a rosette, a panel of cut signs and a broken corner, with numbered annotations, guided
				stories and an edition record.
			</p>
			<p class="caveat">
				The tablet is procedural. It is generated in your browser and depicts no real object.
				Observations describe the model; notes marked <strong>Illustrative</strong> show the kind of
				commentary an editor would write and are not findings.
			</p>
			<div class="start">
				<button
					type="button"
					class="button button-primary"
					onclick={() => openChapter(STORIES[0].id, 0)}
				>
					Start the first story <span aria-hidden="true">→</span>
				</button>
				<button
					type="button"
					class="button button-outline"
					onclick={() => selectAnnotation(ANNOTATIONS[0].id)}
				>
					Open annotation 1
				</button>
			</div>
			<section class="block">
				<h3>Using the viewer</h3>
				<ul class="howto">
					<li>
						<strong>Turn</strong> drag the tablet, or focus the viewer and use the arrow keys.
					</li>
					<li>
						<strong>Light</strong> use the lamp dial, choose the Light tool and drag, or hold Shift with
						the arrow keys.
					</li>
					<li>
						<strong>Zoom</strong> pinch, use Ctrl or ⌘ with the scroll wheel, the + and − buttons, or
						the + and − keys. Shift-drag or Alt with the arrows moves the view.
					</li>
					<li>
						<strong>Measure</strong> choose Measure and click two points, or press Enter to place one
						at the centre.
					</li>
				</ul>
			</section>
		{/if}
	</div>
{/snippet}

{#snippet pin(item: Annotation)}
	<button
		type="button"
		class="pin"
		class:is-selected={selectedId === item.id}
		class:is-linked={linked.includes(item.id)}
		data-pin={item.id}
		data-category={item.category}
		style:left={pinLeft(item)}
		style:top={pinTop(item)}
		tabindex={pinStop === item.id ? 0 : -1}
		aria-pressed={selectedId === item.id}
		aria-label={`Annotation ${item.number}: ${item.title}`}
		onclick={() => selectAnnotation(item.id)}
		onkeydown={onpinkey}
	>
		<span class="pin-dot" aria-hidden="true">{item.number}</span>
		<span class="pin-label" aria-hidden="true">{item.title}</span>
	</button>
{/snippet}

<div
	id="edition-viewer"
	class:is-wide={wide}
	class:is-expanded={wide && expanded}
	class:is-live={status === 'live'}
>
	{#if wide && !expanded}
		<aside class="rail guide" aria-label="Edition guide">
			<div class="tabs" role="tablist" aria-label="Guide">
				{#each GUIDE_TABS as tab (tab)}
					<button
						type="button"
						role="tab"
						id={`edition-viewer-tab-${tab}`}
						aria-selected={guideTab === tab}
						aria-controls="edition-viewer-guide"
						tabindex={guideTab === tab ? 0 : -1}
						onclick={() => (guideTab = tab)}
						onkeydown={(event) =>
							ontabkey(event, GUIDE_TABS, guideTab, (next) => (guideTab = next))}
					>
						{tab === 'stories' ? 'Stories' : 'Annotations'}
						<span class="tab-count">
							{tab === 'stories' ? STORIES.length : ANNOTATIONS.length}
						</span>
					</button>
				{/each}
			</div>
			<div
				class="rail-body"
				id="edition-viewer-guide"
				role="tabpanel"
				tabindex="0"
				aria-labelledby={`edition-viewer-tab-${guideTab}`}
			>
				{#if guideTab === 'stories'}
					{@render storyList()}
				{:else}
					{@render annotationList()}
				{/if}
			</div>
		</aside>
	{/if}

	<section class="stage" aria-label="3D model">
		<!-- An application region: the viewer takes arrow keys itself; listeners attach on mount. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div
			bind:this={viewport}
			class="viewport"
			class:tool-light={tool === 'light'}
			class:tool-measure={tool === 'measure'}
			class:touch-scroll={!wide && tool === 'turn'}
			role="application"
			aria-roledescription="3D viewer"
			aria-label={`Conceptual tablet. ${figure}.`}
			aria-describedby="edition-viewer-keys"
			tabindex="0"
		>
			<canvas bind:this={canvas} aria-hidden="true"></canvas>

			{#if status !== 'live'}
				<div class="diagram" class:is-pending={status === 'pending'}>
					<div class="diagram-plate">
						<TabletDiagram focus={region} {grid} />
						{#each pinned as item (item.id)}
							{@render pin(item)}
						{/each}
					</div>
				</div>
			{:else}
				{#each pinned as item (item.id)}
					{@render pin(item)}
				{/each}
			{/if}

			{#if ruler && status === 'live'}
				<svg class="ruler" aria-hidden="true">
					{#if ruler.b}
						<line x1={ruler.a.x} y1={ruler.a.y} x2={ruler.b.x} y2={ruler.b.y} />
						<circle cx={ruler.b.x} cy={ruler.b.y} r="5" />
					{/if}
					<circle cx={ruler.a.x} cy={ruler.a.y} r="5" />
				</svg>
			{/if}
			{#if tool === 'measure' && status === 'live'}
				<span class="crosshair" aria-hidden="true"></span>
			{/if}
		</div>

		<div class="caption" data-ui>
			<p class="fig">
				<span class="fig-label">Fig.</span>
				<span class="fig-title">{figure}</span>
			</p>
			<p class="disclaimer">Conceptual tablet · procedural, not a scan of a real object</p>
			{#if status === 'pending'}
				<p class="state" role="status">Preparing the 3D model…</p>
			{:else if status === 'fallback'}
				<p class="state">
					This browser cannot draw the 3D tablet, so a flat diagram is shown. Annotations, stories
					and the record still work.
				</p>
			{/if}
		</div>

		{#if tool === 'measure' && status === 'live'}
			<div class="measure" data-ui role="group" aria-label="Measurement">
				<p>
					{#if measured !== null}
						<strong>{formatUnits(measured)}</strong>
						<span>between the two points, following the surface heights</span>
					{:else if measureA}
						Place the second point.
					{:else}
						Click two points on the tablet. The object has no real size, so distances are in model
						units; the plate is {PLATE_WIDTH} × {PLATE_HEIGHT}.
					{/if}
				</p>
				{#if measureA}
					<button type="button" onclick={clearMeasure}>Clear</button>
				{/if}
			</div>
		{/if}

		{#if story && panel !== 'overview'}
			<div class="player" data-ui role="group" aria-label={`Story: ${story.title}`}>
				<div class="player-head">
					<p class="player-title">
						<span class="player-story">{story.title}</span>
						<span class="player-chapter">
							{chapterIndex + 1}/{story.chapters.length} · {story.chapters[chapterIndex].title}
						</span>
					</p>
					<button type="button" class="player-close" onclick={closeStory} aria-label="Close story">
						<span aria-hidden="true">×</span>
					</button>
				</div>
				<ol class="progress">
					{#each story.chapters as entry, index (entry.id)}
						<li>
							<button
								type="button"
								class:is-done={index < chapterIndex}
								class:is-running={playing && index === chapterIndex}
								aria-current={isCurrent(story.id, index) ? 'step' : undefined}
								aria-label={`Chapter ${index + 1}: ${entry.title}`}
								onclick={() => openChapter(story.id, index)}
								style:--chapter-ms={`${CHAPTER_MS}ms`}
							></button>
						</li>
					{/each}
				</ol>
				<div class="player-buttons">
					<button type="button" disabled={chapterIndex === 0} onclick={() => stepChapter(-1)}>
						<span aria-hidden="true">←</span> Back
					</button>
					<button type="button" aria-pressed={playing} onclick={togglePlay}>
						{playing ? 'Pause' : 'Play'}
					</button>
					<button
						type="button"
						disabled={chapterIndex === story.chapters.length - 1}
						onclick={() => stepChapter(1)}
					>
						Next <span aria-hidden="true">→</span>
					</button>
				</div>
			</div>
		{/if}

		<div class="toolbar" data-ui>
			<div class="tool-group lamp">
				<LampDial {azimuth} {elevation} disabled={status !== 'live'} onchange={takeLamp} />
				{#if !reducedMotion || sweeping}
					<button
						type="button"
						class="small"
						aria-pressed={sweeping}
						disabled={status !== 'live'}
						onclick={() => (sweeping = !sweeping)}
					>
						{sweeping ? 'Pause lamp' : 'Sweep lamp'}
					</button>
				{/if}
			</div>

			<fieldset class="tool-group segmented" disabled={status !== 'live'}>
				<legend>Drag to</legend>
				{#each TOOLS as option (option.id)}
					<label>
						<input
							type="radio"
							name="edition-viewer-tool"
							value={option.id}
							checked={tool === option.id}
							onchange={() => setTool(option.id)}
						/>
						<span>{option.label}</span>
					</label>
				{/each}
			</fieldset>

			<fieldset class="tool-group segmented" disabled={status !== 'live'}>
				<legend>Shading</legend>
				{#each RENDER_MODES as option (option)}
					<label title={MODE_LABELS[option].hint}>
						<input
							type="radio"
							name="edition-viewer-mode"
							value={option}
							checked={mode === option}
							onchange={() => {
								mode = option;
								viewChanged = true;
							}}
						/>
						<span>{MODE_LABELS[option].label}</span>
					</label>
				{/each}
			</fieldset>

			<div class="tool-group toggles" role="group" aria-label="Overlays">
				<button
					type="button"
					aria-pressed={contour}
					disabled={status !== 'live'}
					onclick={() => {
						contour = !contour;
						viewChanged = true;
					}}>Contours</button
				>
				<button
					type="button"
					aria-pressed={grid}
					onclick={() => {
						grid = !grid;
						viewChanged = true;
					}}>Grid</button
				>
				<button type="button" aria-pressed={showPins} onclick={() => (showPins = !showPins)}
					>Pins</button
				>
			</div>

			<div class="tool-group view" role="group" aria-label="View">
				<button
					type="button"
					aria-label="Zoom out"
					disabled={status !== 'live'}
					onclick={() => zoomBy(1 / 1.3)}><span aria-hidden="true">−</span></button
				>
				<button
					type="button"
					aria-label="Zoom in"
					disabled={status !== 'live'}
					onclick={() => zoomBy(1.3)}><span aria-hidden="true">+</span></button
				>
				<button type="button" disabled={status !== 'live'} onclick={resetView}>Reset</button>
				{#if wide}
					<button type="button" aria-pressed={expanded} onclick={() => (expanded = !expanded)}>
						{expanded ? 'Show panels' : 'Focus'}
					</button>
				{/if}
			</div>
		</div>

		<p id="edition-viewer-keys" class="sr-only">
			Drag or use the arrow keys to turn the tablet. Shift with the arrows moves the lamp, Alt with
			the arrows moves the view, plus and minus zoom, zero resets. Left and right square brackets
			step between annotations; Escape returns to the whole tablet. With the Measure tool, Enter
			places a point at the centre of the view.
		</p>
	</section>

	{#if wide && !expanded}
		<aside class="rail note" aria-labelledby="edition-viewer-context-title">
			<div class="rail-body">
				{@render context()}
			</div>
		</aside>
	{:else if !wide}
		<section class="panel" aria-label="Edition guide and notes">
			<div class="tabs" role="tablist" aria-label="Guide and notes">
				{#each COMPACT_TABS as tab (tab)}
					<button
						type="button"
						role="tab"
						id={`edition-viewer-compact-${tab}`}
						aria-selected={compactTab === tab}
						aria-controls="edition-viewer-compact-panel"
						tabindex={compactTab === tab ? 0 : -1}
						onclick={() => (compactTab = tab)}
						onkeydown={(event) =>
							ontabkey(event, COMPACT_TABS, compactTab, (next) => (compactTab = next))}
					>
						{tab === 'note' ? noteLabel : tab === 'stories' ? 'Stories' : 'Annotations'}
					</button>
				{/each}
			</div>
			<div
				class="panel-body"
				id="edition-viewer-compact-panel"
				role="tabpanel"
				tabindex="0"
				aria-labelledby={`edition-viewer-compact-${compactTab}`}
			>
				{#if compactTab === 'note'}
					{@render context()}
				{:else if compactTab === 'stories'}
					{@render storyList()}
				{:else}
					{@render annotationList()}
				{/if}
			</div>
		</section>
	{/if}

	<p class="sr-only" role="status" aria-live="polite">{announcement}</p>
</div>

<style>
	#edition-viewer {
		--nav-offset: 64px;
		--rule: color-mix(in srgb, var(--color-ink) 12%, transparent);
		--rule-strong: color-mix(in srgb, var(--color-ink) 24%, transparent);
		--stage-paper: 244, 241, 235;
		--peach: #f4b5a0;
		--cat-text: #e0643f;
		--cat-ornament: #d9a441;
		--cat-form: #5f9c7a;
		--cat-condition: #8aa2c8;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		background: var(--color-paper);
		color: var(--color-ink);
		font-family: var(--font-sans);
	}
	#edition-viewer.is-wide {
		grid-template-columns: 300px minmax(0, 1fr) minmax(320px, 380px);
		height: calc(100vh - var(--nav-offset));
		height: calc(100svh - var(--nav-offset));
		min-height: 640px;
		max-height: 1040px;
		border-block: 1px solid var(--color-ink);
	}
	#edition-viewer.is-expanded {
		grid-template-columns: minmax(0, 1fr);
	}
	#edition-viewer :global(button:focus-visible),
	#edition-viewer :global(a:focus-visible),
	#edition-viewer :global(input:focus-visible),
	#edition-viewer :global([tabindex='0']:focus-visible) {
		outline: 2px solid var(--color-vermillion);
		outline-offset: 2px;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	/* ---------- rails ---------- */
	.rail {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		min-height: 0;
		background: var(--color-paper);
	}
	.guide {
		border-right: 1px solid var(--rule);
	}
	.note {
		grid-template-rows: minmax(0, 1fr);
		border-left: 1px solid var(--rule);
	}
	.rail-body {
		min-height: 0;
		overflow-y: auto;
		padding: 20px 20px 32px;
		overscroll-behavior: auto;
	}
	.tabs {
		display: flex;
		gap: 4px;
		padding: 12px 16px 0;
		border-bottom: 1px solid var(--rule);
	}
	.tabs button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 44px;
		padding: 0 12px;
		border: 0;
		border-bottom: 2px solid transparent;
		background: none;
		color: var(--color-ink-3);
		font: 500 14px/1 var(--font-sans);
		cursor: pointer;
	}
	.tabs button[aria-selected='true'] {
		border-bottom-color: var(--color-vermillion);
		color: var(--color-ink);
	}
	.tab-count {
		font: 500 10.5px/1 var(--font-mono);
		color: var(--color-ink-4);
	}

	.kicker {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 0;
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-vermillion-ink);
	}
	.count {
		margin: 6px 0 0;
		font: 500 12px/1 var(--font-mono);
		color: var(--color-ink-3);
	}
	.context h2 {
		margin: 12px 0 16px;
		font: 400 clamp(26px, 2.2vw, 32px) / 1.08 var(--font-serif);
		letter-spacing: -0.015em;
		text-wrap: balance;
	}
	.prose {
		margin: 0 0 14px;
		font-size: 16px;
		line-height: 1.6;
		color: var(--color-ink-2);
		text-wrap: pretty;
	}
	.caveat {
		margin: 0 0 20px;
		padding: 12px 14px;
		border-left: 3px solid var(--color-vermillion);
		background: var(--color-vermillion-wash);
		font-size: 14px;
		line-height: 1.5;
		color: var(--color-ink-2);
	}
	.block {
		margin-top: 20px;
		padding-top: 16px;
		border-top: 1px solid var(--rule);
	}
	.block h3 {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0 0 8px;
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-ink-3);
	}
	.block p {
		margin: 0 0 10px;
		font-size: 15.5px;
		line-height: 1.55;
		color: var(--color-ink-2);
	}
	.illustrative p {
		font-family: var(--font-serif);
		font-style: italic;
	}
	.tag {
		padding: 3px 6px;
		border: 1px solid var(--rule-strong);
		border-radius: var(--radius-round);
		font-size: 9.5px;
		letter-spacing: 0.08em;
		color: var(--color-ink-3);
	}
	.facts {
		display: grid;
		margin: 0 0 12px;
	}
	.facts div {
		display: grid;
		grid-template-columns: 7.5rem minmax(0, 1fr);
		gap: 12px;
		padding: 7px 0;
		border-bottom: 1px solid var(--rule);
	}
	.facts dt {
		font: 500 10.5px/1.6 var(--font-mono);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-ink-3);
	}
	.facts dd {
		margin: 0;
		font-size: 14px;
		font-variant-numeric: tabular-nums;
	}
	.links {
		display: grid;
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.links button {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 40px;
		padding: 6px 10px 6px 6px;
		border: 1px solid var(--rule);
		border-radius: var(--radius-control);
		background: none;
		color: var(--color-ink);
		font: 500 14px/1.3 var(--font-sans);
		text-align: left;
		cursor: pointer;
	}
	.links button:hover {
		border-color: var(--rule-strong);
		background: var(--color-paper-2);
	}
	.pager {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-top: 24px;
	}
	.pager-count {
		font: 500 12px/1 var(--font-mono);
		color: var(--color-ink-3);
		font-variant-numeric: tabular-nums;
	}
	.text-button {
		margin-top: 12px;
		min-height: 40px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--color-ink-2);
		font: 500 14px/1 var(--font-sans);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 4px;
		cursor: pointer;
	}
	.start {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.howto {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 14px;
		line-height: 1.5;
		color: var(--color-ink-2);
	}
	.howto strong {
		display: inline-block;
		min-width: 5.5em;
		font-weight: 600;
		color: var(--color-ink);
	}

	.button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: 44px;
		padding: 10px 16px;
		border: 1px solid transparent;
		border-radius: var(--radius-control);
		font: 500 14px/1.2 var(--font-sans);
		cursor: pointer;
		transition:
			background 0.18s ease,
			border-color 0.18s ease;
	}
	.button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.button-primary {
		background: var(--color-forest);
		color: var(--color-paper);
	}
	.button-primary:hover {
		background: var(--color-forest-hover);
	}
	.button-outline {
		border-color: var(--rule-strong);
		background: transparent;
		color: var(--color-ink);
	}
	.button-outline:hover:not(:disabled) {
		border-color: var(--color-ink);
	}

	.share {
		display: grid;
		gap: 6px;
		margin-top: 20px;
		padding-top: 16px;
		border-top: 1px solid var(--rule);
	}
	.share .button {
		justify-self: start;
	}
	.share-status {
		min-height: 1.2em;
		margin: 0;
		font: 500 12px/1.4 var(--font-mono);
		color: var(--color-ink-3);
	}
	.share-url {
		width: 100%;
		min-height: 40px;
		padding: 0 10px;
		border: 1px solid var(--rule-strong);
		border-radius: var(--radius-control);
		background: var(--color-paper-2);
		font: 12px/1 var(--font-mono);
	}

	/* ---------- stories and annotations ---------- */
	.stories {
		display: grid;
		gap: 20px;
	}
	.story {
		display: grid;
		gap: 12px;
		padding-bottom: 20px;
		border-bottom: 1px solid var(--rule);
	}
	.story header h3 {
		margin: 0 0 4px;
		font: 400 21px/1.15 var(--font-serif);
	}
	.story header p {
		margin: 0;
		font-size: 14px;
		line-height: 1.45;
		color: var(--color-ink-3);
	}
	.story.is-open header h3 {
		color: var(--color-vermillion-ink);
	}
	.story > .button {
		justify-self: start;
	}
	.chapters {
		display: grid;
		gap: 2px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.chapters button {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: 40px;
		padding: 6px 8px;
		border: 1px solid transparent;
		border-radius: var(--radius-control);
		background: none;
		color: var(--color-ink-2);
		font: 400 14.5px/1.3 var(--font-sans);
		text-align: left;
		cursor: pointer;
	}
	.chapters button:hover {
		background: var(--color-paper-2);
	}
	.chapters button[aria-current='step'] {
		border-color: var(--color-vermillion);
		background: var(--color-vermillion-wash);
		color: var(--color-ink);
	}
	.chapter-number {
		display: grid;
		place-items: center;
		flex: none;
		width: 24px;
		height: 24px;
		border: 1px solid var(--rule-strong);
		border-radius: 50%;
		font: 500 11px/1 var(--font-mono);
		color: var(--color-ink-3);
	}
	[aria-current='step'] .chapter-number {
		border-color: var(--color-vermillion);
		background: var(--color-vermillion);
		color: #fff;
	}

	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0 0 16px;
		padding: 0;
		border: 0;
	}
	.filters legend {
		margin-bottom: 8px;
		padding: 0;
		font: 500 11px/1 var(--font-mono);
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-ink-3);
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 36px;
		padding: 0 12px;
		border: 1px solid var(--rule-strong);
		border-radius: var(--radius-round);
		background: none;
		color: var(--color-ink-3);
		font: 500 13px/1 var(--font-sans);
		cursor: pointer;
	}
	.chip[aria-pressed='true'] {
		border-color: var(--color-ink);
		color: var(--color-ink);
	}
	.chip[aria-pressed='false'] .swatch {
		opacity: 0.3;
	}
	.swatch {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--swatch);
	}
	[data-category='text'] {
		--swatch: var(--cat-text);
	}
	[data-category='ornament'] {
		--swatch: var(--cat-ornament);
	}
	[data-category='form'] {
		--swatch: var(--cat-form);
	}
	[data-category='condition'] {
		--swatch: var(--cat-condition);
	}
	.annotation-list {
		display: grid;
		gap: 2px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.annotation-list button {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 52px;
		padding: 6px 8px;
		border: 1px solid transparent;
		border-radius: var(--radius-control);
		background: none;
		text-align: left;
		cursor: pointer;
	}
	.annotation-list button:hover {
		background: var(--color-paper-2);
	}
	.annotation-list button.is-linked {
		border-color: var(--rule-strong);
	}
	.annotation-list button[aria-pressed='true'] {
		border-color: var(--color-vermillion);
		background: var(--color-vermillion-wash);
	}
	.annotation-text {
		display: grid;
		gap: 3px;
	}
	.annotation-title {
		font: 500 15px/1.25 var(--font-sans);
		color: var(--color-ink);
	}
	.annotation-category {
		font: 400 11px/1 var(--font-mono);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-ink-3);
	}
	.badge {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: 28px;
		height: 28px;
		border: 2px solid var(--swatch, var(--color-vermillion));
		border-radius: 50%;
		background: var(--color-paper);
		font: 600 12px/1 var(--font-mono);
		letter-spacing: 0;
		color: var(--color-ink);
	}
	.badge.small {
		width: 24px;
		height: 24px;
		font-size: 11px;
	}
	.keys,
	.empty {
		margin: 14px 0 0;
		font: 400 12px/1.5 var(--font-mono);
		color: var(--color-ink-3);
	}

	/* ---------- the stage ---------- */
	.stage {
		position: relative;
		isolation: isolate;
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto;
		min-width: 0;
		min-height: 0;
		background:
			radial-gradient(ellipse 62% 55% at 50% 45%, #2a3a2f 0%, #18221c 58%, #101512 100%),
			var(--color-ink);
		color: var(--color-paper);
	}
	.viewport {
		position: relative;
		grid-row: 1;
		grid-column: 1;
		min-height: 0;
		overflow: hidden;
		cursor: grab;
		touch-action: none;
	}
	.viewport:active {
		cursor: grabbing;
	}
	.viewport.tool-light {
		cursor: crosshair;
	}
	.viewport.tool-measure {
		cursor: cell;
	}
	/* On narrow screens a vertical swipe over the model still scrolls the page; sideways turns it. */
	.viewport.touch-scroll {
		touch-action: pan-y;
	}
	#edition-viewer .viewport:focus-visible {
		outline-offset: -4px;
	}
	/* A soft pool of lamplight on the bench the tablet lies on. */
	.viewport::before {
		content: '';
		position: absolute;
		inset: 0;
		background: radial-gradient(
			ellipse 38% 30% at 50% 58%,
			rgba(255, 226, 190, 0.1),
			transparent 70%
		);
		pointer-events: none;
	}
	canvas {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		opacity: 0;
		transition: opacity 0.9s ease;
	}
	.is-live canvas {
		opacity: 1;
	}

	.diagram {
		position: absolute;
		inset: 88px 24px 24px;
		display: grid;
		place-items: center;
		container-type: size;
	}
	.diagram-plate {
		position: relative;
		width: min(100cqw, calc(100cqh * 158 / 208));
		aspect-ratio: 158 / 208;
	}
	.diagram.is-pending .diagram-plate {
		opacity: 0.55;
	}

	.pin {
		position: absolute;
		z-index: 2;
		display: flex;
		align-items: center;
		gap: 8px;
		margin: -16px 0 0 -16px;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
	}
	.pin-dot {
		display: grid;
		place-items: center;
		flex: none;
		width: 32px;
		height: 32px;
		border: 2px solid var(--swatch);
		border-radius: 50%;
		background: rgba(16, 21, 18, 0.78);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
		font: 600 12px/1 var(--font-mono);
		color: var(--color-paper);
		transition:
			transform 0.18s ease,
			background 0.18s ease;
	}
	.pin-label {
		max-width: 16rem;
		padding: 6px 10px;
		border-radius: var(--radius-control);
		background: rgba(16, 21, 18, 0.86);
		font: 500 13px/1.2 var(--font-sans);
		color: var(--color-paper);
		white-space: nowrap;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.18s ease;
	}
	.pin:hover .pin-label,
	.pin:focus-visible .pin-label,
	.pin.is-selected .pin-label {
		opacity: 1;
	}
	.pin:hover .pin-dot {
		transform: scale(1.08);
	}
	.pin.is-linked .pin-dot {
		box-shadow:
			0 0 0 3px rgba(244, 181, 160, 0.35),
			0 2px 8px rgba(0, 0, 0, 0.35);
	}
	.pin.is-selected .pin-dot {
		background: var(--color-vermillion);
		border-color: #fff;
		color: #fff;
	}
	#edition-viewer .pin:focus-visible {
		outline: none;
	}
	.pin:focus-visible .pin-dot {
		outline: 2px solid #fff;
		outline-offset: 2px;
	}

	.ruler {
		position: absolute;
		inset: 0;
		z-index: 1;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
	.ruler line {
		stroke: #ffe2be;
		stroke-width: 2;
		stroke-dasharray: 6 4;
	}
	.ruler circle {
		fill: var(--color-vermillion);
		stroke: #fff;
		stroke-width: 2;
	}
	.crosshair {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 22px;
		height: 22px;
		margin: -11px 0 0 -11px;
		border: 1.5px solid rgba(255, 226, 190, 0.8);
		border-radius: 50%;
		pointer-events: none;
		opacity: 0;
	}
	.viewport:focus-visible .crosshair {
		opacity: 1;
	}

	.caption {
		position: relative;
		z-index: 3;
		grid-row: 1;
		grid-column: 1;
		align-self: start;
		display: grid;
		gap: 4px;
		max-width: min(100%, 38rem);
		padding: 18px 20px 28px;
		background: linear-gradient(180deg, rgba(16, 21, 18, 0.72), transparent);
		pointer-events: none;
	}
	.caption p {
		margin: 0;
	}
	.fig {
		display: flex;
		align-items: baseline;
		gap: 10px;
	}
	.fig-label {
		font: italic 400 20px/1 var(--font-serif);
		color: var(--peach);
	}
	.fig-title {
		font: 500 15px/1.3 var(--font-sans);
		color: var(--color-paper);
	}
	.disclaimer {
		font: 500 10px/1.4 var(--font-mono);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(var(--stage-paper), 0.66);
	}
	.state {
		max-width: 44ch;
		margin-top: 6px !important;
		font: italic 400 14px/1.4 var(--font-serif);
		color: rgba(var(--stage-paper), 0.85);
	}

	.measure {
		position: absolute;
		top: 14px;
		right: 14px;
		z-index: 3;
		display: flex;
		align-items: center;
		gap: 10px;
		max-width: min(22rem, calc(100% - 28px));
		padding: 10px 12px;
		border: 1px solid rgba(var(--stage-paper), 0.25);
		border-radius: var(--radius-control);
		background: rgba(16, 21, 18, 0.86);
	}
	.measure p {
		margin: 0;
		font-size: 13px;
		line-height: 1.4;
		color: rgba(var(--stage-paper), 0.85);
	}
	.measure strong {
		display: block;
		font: 500 15px/1.3 var(--font-mono);
		color: var(--color-paper);
	}

	.player {
		position: relative;
		z-index: 3;
		grid-row: 1;
		grid-column: 1;
		align-self: end;
		justify-self: center;
		display: grid;
		gap: 10px;
		width: min(100% - 24px, 34rem);
		margin-bottom: 12px;
		padding: 12px 14px;
		border: 1px solid rgba(var(--stage-paper), 0.22);
		border-radius: var(--radius-surface);
		background: rgba(16, 21, 18, 0.88);
		backdrop-filter: blur(6px);
	}
	.player-head {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 12px;
	}
	.player-title {
		display: grid;
		gap: 3px;
		margin: 0;
	}
	.player-story {
		font: 500 10.5px/1 var(--font-mono);
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--peach);
	}
	.player-chapter {
		font: 500 14.5px/1.3 var(--font-sans);
		color: var(--color-paper);
	}
	.player-close {
		display: grid;
		place-items: center;
		flex: none;
		width: 36px;
		height: 36px;
		border: 1px solid rgba(var(--stage-paper), 0.25);
		border-radius: 50%;
		background: none;
		color: var(--color-paper);
		font-size: 18px;
		cursor: pointer;
	}
	.progress {
		display: flex;
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.progress li {
		flex: 1;
	}
	.progress button {
		position: relative;
		display: block;
		width: 100%;
		height: 20px;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
	}
	.progress button::before,
	.progress button::after {
		content: '';
		position: absolute;
		inset: 8px 0;
		border-radius: 2px;
		background: rgba(var(--stage-paper), 0.22);
	}
	.progress button::after {
		right: 100%;
		background: var(--color-vermillion);
	}
	.progress button.is-done::after,
	.progress button[aria-current='step']::after {
		right: 0;
	}
	.progress button.is-running::after {
		right: 100%;
		animation: chapter-run var(--chapter-ms) linear forwards;
	}
	@keyframes chapter-run {
		to {
			right: 0;
		}
	}
	.player-buttons {
		display: flex;
		gap: 6px;
	}

	.player-buttons button,
	.toolbar button,
	.segmented span {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-height: 36px;
		padding: 0 12px;
		border: 1px solid rgba(var(--stage-paper), 0.26);
		border-radius: var(--radius-control);
		background: rgba(16, 21, 18, 0.5);
		color: var(--color-paper);
		font: 500 12px/1 var(--font-sans);
		cursor: pointer;
		transition:
			border-color 0.18s ease,
			background 0.18s ease;
	}
	.player-buttons button:hover:not(:disabled),
	.toolbar button:hover:not(:disabled),
	.segmented label:hover span {
		border-color: rgba(var(--stage-paper), 0.7);
	}
	.player-buttons button:disabled,
	.toolbar button:disabled,
	.segmented:disabled span {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.player-buttons button[aria-pressed='true'],
	.toolbar button[aria-pressed='true'],
	.segmented input:checked + span {
		border-color: var(--peach);
		background: rgba(244, 181, 160, 0.16);
		color: #fff;
	}

	.toolbar {
		position: relative;
		z-index: 3;
		grid-row: 2;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px 18px;
		padding: 12px 16px 14px;
		border-top: 1px solid rgba(var(--stage-paper), 0.14);
		background: #101512;
	}
	.tool-group {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}
	.tool-group.lamp {
		gap: 10px;
	}
	.segmented legend {
		float: left;
		margin-right: 6px;
		padding: 0;
		font: 500 10px/36px var(--font-mono);
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(var(--stage-paper), 0.62);
	}
	.segmented label {
		position: relative;
		display: inline-flex;
	}
	.segmented input {
		position: absolute;
		opacity: 0;
		width: 1px;
		height: 1px;
	}
	.segmented input:focus-visible + span {
		outline: 2px solid var(--color-vermillion);
		outline-offset: 2px;
	}
	.view button[aria-label] {
		width: 36px;
		padding: 0;
		font-size: 17px;
	}

	/* ---------- compact layouts ---------- */
	.panel {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		min-width: 0;
		background: var(--color-paper);
	}
	.panel-body {
		padding: 20px clamp(16px, 4vw, 28px) 36px;
	}

	#edition-viewer:not(.is-wide) .stage {
		height: min(72vh, 680px);
		height: min(72svh, 680px);
		min-height: 440px;
	}
	/* Side by side while there is room for a readable note next to the model. */
	@media (min-width: 760px) and (max-width: 1179px) {
		#edition-viewer:not(.is-wide) {
			grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
			height: calc(100vh - var(--nav-offset));
			height: calc(100svh - var(--nav-offset));
			min-height: 600px;
			border-block: 1px solid var(--color-ink);
		}
		#edition-viewer:not(.is-wide) .stage {
			height: auto;
			min-height: 0;
		}
		.panel {
			min-height: 0;
			border-left: 1px solid var(--rule);
		}
		.panel-body {
			min-height: 0;
			overflow-y: auto;
		}
	}
	@media (max-width: 759px) {
		#edition-viewer:not(.is-wide) .stage {
			height: auto;
			min-height: 0;
			grid-template-rows: min(60svh, 520px) auto;
			border-bottom: 1px solid var(--color-ink);
		}
		.caption {
			padding: 12px 14px 20px;
		}
		.fig-label {
			font-size: 17px;
		}
		.fig-title {
			font-size: 14px;
		}
		.disclaimer {
			font-size: 9px;
		}
		.toolbar {
			gap: 10px 12px;
			padding: 10px 12px 12px;
		}
		.segmented legend {
			float: none;
			width: 100%;
			line-height: 1.2;
			margin-bottom: 4px;
		}
		.player {
			padding: 10px;
		}
		.pin-label {
			display: none;
		}
		.pin.is-selected .pin-label {
			display: block;
			max-width: 11rem;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.diagram {
			inset: 72px 16px 16px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		canvas,
		.pin-dot,
		.pin-label,
		.button,
		.player-buttons button,
		.toolbar button,
		.segmented span {
			transition: none;
		}
		.progress button.is-running::after {
			animation: none;
			right: 100%;
		}
	}
</style>
