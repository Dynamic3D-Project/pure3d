<script lang="ts">
	const ACCENT_NAMES: Record<number, string> = {
		35: 'Vermillion',
		70: 'Ochre',
		145: 'Verdigris',
		220: 'Prussian',
		300: 'Aubergine',
		0: 'Ink · mono'
	};

	type PaperKey = 'warm' | 'cool' | 'bright' | 'ink';

	const PAPER_PRESETS: Record<
		PaperKey,
		{ paper: string; p2: string; p3: string; ink: string; i2: string; i3: string; i4: string; bg: string }
	> = {
		warm: { paper: '#F4F1EB', p2: '#ECE7DD', p3: '#E2DCCF', ink: '#141413', i2: '#2B2A27', i3: '#555249', i4: '#8A8579', bg: '#FBFAF6' },
		cool: { paper: '#EEF0F2', p2: '#E4E7EC', p3: '#D6DBE2', ink: '#121416', i2: '#262A2E', i3: '#4E545B', i4: '#848A92', bg: '#F8FAFB' },
		bright: { paper: '#FCFAF4', p2: '#F5F1E6', p3: '#EBE5D3', ink: '#0F0F0E', i2: '#25241F', i3: '#52503F', i4: '#8D8770', bg: '#FFFFFF' },
		ink: { paper: '#15130F', p2: '#1D1B16', p3: '#28251F', ink: '#F4F1EB', i2: '#D8D2C4', i3: '#A9A393', i4: '#75705F', bg: '#1A1813' }
	};

	let tweaksOpen = $state(false);
	let accentHue = $state<number>(35);
	let paper = $state<PaperKey>('warm');
	let density = $state<'dense' | 'default' | 'airy'>('default');
	let serif = $state<'Fraunces' | 'EB Garamond' | 'Playfair Display'>('Fraunces');
	let heroHeadline = $state('A quiet system for ~dimensional~ scholarship.');
	let italicWord = $state('dimensional');

	let rootEl: HTMLElement | null = $state(null);

	function applyTweaks() {
		if (!rootEl) return;
		const s = rootEl.style;
		if (accentHue === 0) {
			s.setProperty('--ds-vermillion', 'oklch(25% 0.01 80)');
			s.setProperty('--ds-vermillion-ink', 'oklch(18% 0.01 80)');
			s.setProperty('--ds-vermillion-wash', 'oklch(92% 0.005 80)');
		} else {
			s.setProperty('--ds-vermillion', `oklch(62% 0.19 ${accentHue})`);
			s.setProperty('--ds-vermillion-ink', `oklch(40% 0.15 ${accentHue})`);
			s.setProperty('--ds-vermillion-wash', `oklch(95% 0.035 ${accentHue})`);
		}
		const p = PAPER_PRESETS[paper];
		s.setProperty('--ds-paper', p.paper);
		s.setProperty('--ds-paper-2', p.p2);
		s.setProperty('--ds-paper-3', p.p3);
		s.setProperty('--ds-paper-bg', p.bg);
		s.setProperty('--ds-ink', p.ink);
		s.setProperty('--ds-ink-2', p.i2);
		s.setProperty('--ds-ink-3', p.i3);
		s.setProperty('--ds-ink-4', p.i4);
		s.setProperty('--ds-rule', paper === 'ink' ? 'rgba(244,241,235,0.1)' : 'rgba(20,20,19,0.1)');
		s.setProperty('--ds-rule-strong', paper === 'ink' ? 'rgba(244,241,235,0.2)' : 'rgba(20,20,19,0.2)');
		s.setProperty('--ds-serif', `'${serif}', 'Times New Roman', serif`);
	}

	$effect(() => {
		if (!rootEl) return;
		// re-run when any of these change
		void accentHue;
		void paper;
		void density;
		void serif;
		applyTweaks();
	});

	let heroParts = $derived.by(() => {
		const parts = heroHeadline.split(/~([^~]+)~/);
		if (parts.length === 3) return { before: parts[0], italic: parts[1], after: parts[2], ok: true };
		return { before: heroHeadline, italic: '', after: '', ok: false };
	});
</script>

<svelte:head>
	<title>Pure 3D — Design System v0.1</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;1,400&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=Inter+Tight:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Playfair+Display:ital,wght@0,400;1,400&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="ds-root" bind:this={rootEl} data-density={density}>
	<!-- ============== REUSABLE SYMBOLS ============== -->
	<svg width="0" height="0" style="position:absolute" aria-hidden="true">
		<defs>
			<!--
				MARK: "D" as a faceted geodesic half-dome.
				Subdivided triangles forming the D-shape, wireframe in ink with
				vertices picked out and a single accent on the front-left vertex.
			-->
			<symbol id="p3d-mark" viewBox="0 0 64 64">
				<path
					d="M10 8 L44 8 C 56 8, 60 20, 60 32 C 60 44, 56 56, 44 56 L10 56 Z"
					fill="currentColor"
					opacity="0.04"
				/>
				<g fill="currentColor" opacity="0.12" stroke="none">
					<polygon points="44,8 60,32 44,32" />
					<polygon points="44,32 60,32 44,56" />
				</g>
				<g fill="currentColor" opacity="0.05" stroke="none">
					<polygon points="8,8 32,8 8,32" />
					<polygon points="8,56 32,56 8,32" />
				</g>
				<path
					d="M8 8 L44 8 C 56 8, 60 20, 60 32 C 60 44, 56 56, 44 56 L8 56 Z"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linejoin="round"
				/>
				<g fill="none" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round" stroke-linecap="round">
					<path d="M8 8 L8 56" />
					<path d="M8 32 L60 32" />
					<path d="M8 8 L32 8 L8 32" />
					<path d="M32 8 L44 8 L32 32 L8 32" />
					<path d="M44 8 L60 32 L32 32 L32 8 L44 8" />
					<path d="M8 32 L32 32 L32 56 L8 56" />
					<path d="M32 32 L44 56 L32 56" />
					<path d="M32 32 L60 32 L44 56 L32 56" />
					<path d="M8 8 L32 32" />
					<path d="M32 8 L8 32" />
					<path d="M8 32 L32 56" />
					<path d="M32 32 L8 56" />
					<path d="M32 8 L60 32" />
					<path d="M32 56 L60 32" />
				</g>
				<g>
					<circle cx="8" cy="8" r="1.6" fill="currentColor" />
					<circle cx="44" cy="8" r="1.6" fill="currentColor" />
					<circle cx="8" cy="56" r="1.6" fill="currentColor" />
					<circle cx="44" cy="56" r="1.6" fill="currentColor" />
					<circle cx="8" cy="32" r="2.2" fill="var(--ds-vermillion, #D55A3D)" />
					<circle cx="60" cy="32" r="1.8" fill="currentColor" />
					<circle cx="32" cy="32" r="1.6" fill="currentColor" />
				</g>
			</symbol>

			<!-- Small simplified mark for sub-24px placements -->
			<symbol id="p3d-mark-sm" viewBox="0 0 24 24">
				<path
					d="M3 3 L15 3 C 21 3, 22 9, 22 12 C 22 15, 21 21, 15 21 L3 21 Z"
					fill="none"
					stroke="currentColor"
					stroke-width="1.6"
					stroke-linejoin="round"
				/>
				<path
					d="M3 3 L3 21 M3 12 L22 12 M3 3 L12 12 L3 21 M12 3 L12 21 M12 12 L22 12 M12 3 L22 12 L12 21"
					fill="none"
					stroke="currentColor"
					stroke-width="1"
					stroke-linejoin="round"
					opacity="0.9"
				/>
				<circle cx="3" cy="12" r="1.4" fill="var(--ds-vermillion, #D55A3D)" />
				<circle cx="22" cy="12" r="1" fill="currentColor" />
				<circle cx="12" cy="12" r="1" fill="currentColor" />
			</symbol>
		</defs>
	</svg>

	<!-- ============== TOP BAR ============== -->
	<header class="topbar">
		<div class="shell topbar-inner">
			<div class="mark">
				<span class="wm-inline"
					>Pure&nbsp;<span class="wm-3">3</span><svg class="wm-d-xs" aria-hidden="true"><use href="#p3d-mark-sm" /></svg></span
				>
				<small>Design System · v0.1</small>
			</div>
			<nav>
				<a href="#foundations">Foundations</a>
				<a href="#identity">Identity</a>
				<a href="#type">Type</a>
				<a href="#color">Color</a>
				<a href="#viewer">Viewer</a>
				<a href="#components">Components</a>
				<a href="#motion">Motion</a>
				<a href="#collections">Collections</a>
				<a href="#editions">Editions</a>
			</nav>
			<div class="top-actions">
				<button
					type="button"
					class="chip-btn"
					aria-expanded={tweaksOpen}
					onclick={() => (tweaksOpen = !tweaksOpen)}
				>
					{tweaksOpen ? 'Close tweaks' : 'Tweaks'}
				</button>
				<span class="chip">Working draft</span>
			</div>
		</div>
	</header>

	<main>
		<!-- ============== HERO ============== -->
		<section class="hero">
			<div class="shell">
				<div class="eyebrow">
					<span class="dot"></span>
					<span>Pure 3D / Design System</span>
					<span style="opacity:.35;">———</span>
					<span>April 2026 · working draft</span>
				</div>

				<h1>
					{#if heroParts.ok}
						{heroParts.before}<br /><em>{heroParts.italic}</em>{heroParts.after}
					{:else}
						{heroHeadline}
					{/if}
				</h1>

				<div class="hero-grid">
					<p class="hero-lede">
						Pure 3D publishes cultural-heritage and scientific objects as interactive, citable, long-lived records. The interface should
						recede, <pre></pre>aper, ink, and precise chrome framing the model itself. This document declares the system: the marks, the measures,
						and the manner.
					</p>
					<dl class="hero-meta">
						<div><dt>Project</dt><dd>Pure 3D — publishing platform</dd></div>
						<div><dt>Audience</dt><dd>Curators, researchers, students</dd></div>
						<div><dt>Stance</dt><dd>Museum-grade · quiet · precise</dd></div>
						<div><dt>Built for</dt><dd>Web, print catalog, kiosk</dd></div>
					</dl>
				</div>
			</div>
		</section>

		<!-- ============== FOUNDATIONS ============== -->
		<section id="foundations" class="sec">
			<div class="shell">
				<div class="sec-head">
					<div class="sec-num">§ 01 — Foundations</div>
					<div>
						<h2 class="sec-title">Three <em>principles</em> that govern everything.</h2>
						<p class="sec-sub">
							Before colors and type, the stance. Every component in this system should be interrogable against these three
							questions.
						</p>
					</div>
				</div>

				<div class="principles">
					<div class="principle">
						<div class="n">01</div>
						<h3>The object is the interface.</h3>
						<p>Chrome is instrument, not ornament. If a control isn't helping the reader see, it doesn't belong in the frame.</p>
					</div>
					<div class="principle">
						<div class="n">02</div>
						<h3>Precision without coldness.</h3>
						<p>Grotesk for measure, serif italic for voice. We are rigorous, but the tone is human — this is a scholarly gallery, not a dashboard.</p>
					</div>
					<div class="principle">
						<div class="n">03</div>
						<h3>Permanence first.</h3>
						<p>What we publish outlives us. The system favors quiet defaults and long-read typography — it should still feel current in ten years.</p>
					</div>
				</div>
			</div>
		</section>

		<!-- ============== IDENTITY ============== -->
		<section id="identity" class="sec">
			<div class="shell">
				<div class="sec-head">
					<div class="sec-num">§ 02 — Identity</div>
					<div>
						<h2 class="sec-title">Logo &amp; <em>wordmark</em> lockup.</h2>
						<p class="sec-sub">
							The mark is a tetrahedron seen from the front with its interior edge exposed — the simplest volumetric solid, a single
							vertex anchored by a vermillion point. "Pure 3D" is set in the system grotesk; the superscript "3D" is a serif italic,
							borrowed from the body voice, to signal that this is scholarship.
						</p>
					</div>
				</div>

				<div class="lockup-stage">
					<div class="lockup-main">
						<span class="crosshair tl">+ 00.00, 00.00</span>
						<span class="crosshair tr">+ 16.00, 00.00</span>
						<span class="crosshair bl">+ 00.00, 10.00</span>
						<span class="crosshair br">+ 16.00, 10.00</span>

						<div class="logo-hero">
							<div class="logo-wm">Pure <span class="wm-num">3</span><svg class="wm-d-lg" aria-hidden="true"><use href="#p3d-mark" /></svg></div>
						</div>
					</div>

					<div class="lockup-variants">
						<div class="lvar">
							<div class="lg">
								<div class="wm">Pure <span class="wm-num-sm">3</span><svg class="wm-d-sm" aria-hidden="true"><use href="#p3d-mark" /></svg></div>
							</div>
							<span class="lab">Primary / Paper</span>
						</div>

						<div class="lvar ink">
							<div class="lg">
								<div class="wm">Pure <span class="wm-num-sm">3</span><svg class="wm-d-sm" aria-hidden="true"><use href="#p3d-mark" /></svg></div>
							</div>
							<span class="lab">Inverse / Ink</span>
						</div>

						<div class="lvar vermillion">
							<div class="lg">
								<div class="wm">Pure <span class="wm-num-sm">3</span><svg class="wm-d-sm" aria-hidden="true"><use href="#p3d-mark" /></svg></div>
							</div>
							<span class="lab">Accent / Signal</span>
						</div>
					</div>
				</div>

				<div class="construction">
					<div class="constr-board">
						<div class="grid-bg"></div>
						<svg viewBox="0 0 320 220" width="100%" height="100%" style="position:relative;z-index:1;" aria-hidden="true">
							<rect x="20" y="40" width="280" height="140" fill="none" stroke="var(--ds-vermillion)" stroke-width="1" stroke-dasharray="3 4" />
							<g transform="translate(55,82)">
								<path d="M30 4 L54 52 L6 52 Z" stroke="var(--ds-ink)" stroke-width="1.6" fill="none" stroke-linejoin="round" />
								<path d="M30 4 L30 52" stroke="var(--ds-ink)" stroke-width="1.6" />
								<path d="M6 52 L30 28 L54 52" stroke="var(--ds-ink)" stroke-width="1.6" fill="none" stroke-linejoin="round" />
								<circle cx="30" cy="28" r="3.2" fill="var(--ds-vermillion)" />
							</g>
							<text x="140" y="125" font-family="Inter Tight" font-weight="500" font-size="42" letter-spacing="-1" fill="var(--ds-ink)">Pure</text>
							<text x="238" y="108" font-family="Fraunces" font-style="italic" font-size="22" fill="var(--ds-vermillion-ink)">3D</text>
							<text x="20" y="32" font-family="JetBrains Mono" font-size="9" fill="var(--ds-ink-4)">x — CLEAR SPACE</text>
							<text x="20" y="200" font-family="JetBrains Mono" font-size="9" fill="var(--ds-ink-4)">MINIMUM SIZE · MARK 16PX · LOCKUP 112PX</text>
							<line x1="55" y1="30" x2="109" y2="30" stroke="var(--ds-ink)" stroke-width=".6" />
							<line x1="55" y1="26" x2="55" y2="34" stroke="var(--ds-ink)" stroke-width=".6" />
							<line x1="109" y1="26" x2="109" y2="34" stroke="var(--ds-ink)" stroke-width=".6" />
							<text x="77" y="24" font-family="JetBrains Mono" font-size="9" fill="var(--ds-ink)" text-anchor="middle">2x</text>
						</svg>
					</div>

					<div class="constr-board">
						<div class="grid-bg"></div>
						<div class="misuse-grid">
							<div class="misuse">
								<div class="misuse-sample dim italic-sample">
									<svg width="20" height="20" viewBox="0 0 28 28" fill="none">
										<path d="M14 3 L25 22 L3 22 Z" stroke="currentColor" stroke-width="1.4" fill="var(--ds-paper-3)" />
									</svg>
									<span>Pure3D</span>
								</div>
								<div class="misuse-lbl">✗ No italic wordmark</div>
							</div>
							<div class="misuse">
								<div class="misuse-sample gradient">
									<svg width="18" height="18" viewBox="0 0 28 28" fill="none"
										><path d="M14 3 L25 22 L3 22 Z" stroke="#fff" stroke-width="1.4" /></svg
									>
									<span>Pure 3D</span>
								</div>
								<div class="misuse-lbl">✗ No gradients, no pills</div>
							</div>
							<div class="misuse">
								<div class="misuse-sample rotated">
									<svg width="22" height="22" viewBox="0 0 28 28" fill="none"
										><path d="M14 3 L25 22 L3 22 Z" stroke="currentColor" stroke-width="1.4" /></svg
									>
									<span>Pure 3D</span>
								</div>
								<div class="misuse-lbl">✗ Never rotate</div>
							</div>
							<div class="misuse">
								<div class="misuse-sample solid">
									<svg width="22" height="22" viewBox="0 0 28 28" fill="none"
										><path d="M14 3 L25 22 L3 22 Z" fill="var(--ds-vermillion)" stroke="none" /></svg
									>
									<span>Pure 3D</span>
								</div>
								<div class="misuse-lbl">✗ No solid-fill mark</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>

		<!-- ============== TYPE ============== -->
		<section id="type" class="sec">
			<div class="shell">
				<div class="sec-head">
					<div class="sec-num">§ 03 — Type</div>
					<div>
						<h2 class="sec-title">A grotesk <em>for measure</em>, a serif for voice.</h2>
						<p class="sec-sub">
							Inter Tight handles all structural type — titles, UI, metadata. Fraunces italic is reserved for emphasis, quotations, and
							the "3D" in the wordmark. JetBrains Mono carries labels and technical readouts. Three families, clear roles.
						</p>
					</div>
				</div>

				<div class="pairing">
					<div class="pair-card pc1">
						<div class="name"><span>Inter Tight</span><span>Grotesk</span></div>
						<div class="sample">Aa Bb Gg 0123</div>
						<div class="role">Titles · UI · body · navigation</div>
					</div>
					<div class="pair-card pc2">
						<div class="name"><span>Fraunces</span><span>Serif · Italic</span></div>
						<div class="sample">Aa Bb Gg 0123</div>
						<div class="role">Voice · emphasis · lede</div>
					</div>
					<div class="pair-card pc3">
						<div class="name"><span>JetBrains Mono</span><span>Monospace</span></div>
						<div class="sample">Aa Bb Gg 0123</div>
						<div class="role">Labels · coords · metadata</div>
					</div>
				</div>

				<div class="labeled-rule"><span class="lbl">Scale</span><span class="rl"></span></div>

				<div class="type-grid">
					<div class="type-row">
						<div class="meta">Display</div>
						<div class="t-display">Mesh, not <em>metaphor.</em></div>
						<div class="spec">Inter Tight · 500<br />72/68 · −3.5%</div>
					</div>
					<div class="type-row">
						<div class="meta">H1</div>
						<div class="t-h1">Bronze Ewer, Khorasan, c. 1180</div>
						<div class="spec">Inter Tight · 500<br />48/50 · −2.5%</div>
					</div>
					<div class="type-row">
						<div class="meta">H2</div>
						<div class="t-h2">On reading surfaces</div>
						<div class="spec">Inter Tight · 500<br />32/35 · −2%</div>
					</div>
					<div class="type-row">
						<div class="meta">Lede</div>
						<div class="t-lede">
							The object is not illustrated by the interface — it is held in it. Every control exists to widen the reader's view.
						</div>
						<div class="spec">Fraunces · 400<br />22/32</div>
					</div>
					<div class="type-row">
						<div class="meta">Body</div>
						<div class="t-body">
							Captured on a TRITOP handheld photogrammetry rig in the conservation studio at the Rijksmuseum, December 2025. Geometry
							reduced to 240,000 triangles; textures baked to 4k PBR. Provenance notes and surface annotations were contributed by Dr.
							Leila Haddad and the curator of Islamic metalwork.
						</div>
						<div class="spec">Inter Tight · 400<br />15/23</div>
					</div>
					<div class="type-row">
						<div class="meta">Caption / Label</div>
						<div class="t-caption">Acc. No. P3D-2026-0142 · Edition 01/01 · CC-BY-NC-SA</div>
						<div class="spec">JetBrains Mono · 500<br />11.5/16 · +6%</div>
					</div>
				</div>
			</div>
		</section>

		<!-- ============== COLOR ============== -->
		<section id="color" class="sec">
			<div class="shell">
				<div class="sec-head">
					<div class="sec-num">§ 04 — Color</div>
					<div>
						<h2 class="sec-title">Paper, ink, and a single <em>vermillion</em>.</h2>
						<p class="sec-sub">
							The palette is pulled from archive — unbleached card stock, ink, and the red of a museum accession label. Neutrals do
							95% of the work. The vermillion is reserved: links, annotation pins, critical state. Never decorative.
						</p>
					</div>
				</div>

				<div class="color-grid">
					<div class="sw" style="background:#F4F1EB;color:#141413;">
						<div class="role">Surface · primary</div>
						<div><div class="name">Paper</div><div class="hex">#F4F1EB · oklch(94% .01 80)</div></div>
					</div>
					<div class="sw" style="background:#ECE7DD;color:#141413;">
						<div class="role">Surface · secondary</div>
						<div><div class="name">Paper 2</div><div class="hex">#ECE7DD</div></div>
					</div>
					<div class="sw" style="background:#E2DCCF;color:#141413;">
						<div class="role">Surface · tertiary</div>
						<div><div class="name">Paper 3</div><div class="hex">#E2DCCF</div></div>
					</div>
					<div class="sw" style="background:#8A8579;color:#141413;">
						<div class="role">Text · quiet</div>
						<div><div class="name">Ink 4</div><div class="hex">#8A8579</div></div>
					</div>
					<div class="sw" style="background:#555249;color:#F4F1EB;">
						<div class="role">Text · body</div>
						<div><div class="name">Ink 3</div><div class="hex">#555249</div></div>
					</div>
					<div class="sw" style="background:#2B2A27;color:#F4F1EB;">
						<div class="role">Text · heading</div>
						<div><div class="name">Ink 2</div><div class="hex">#2B2A27</div></div>
					</div>
					<div class="sw" style="background:#141413;color:#F4F1EB;">
						<div class="role">Text · strong · viewer</div>
						<div><div class="name">Ink</div><div class="hex">#141413</div></div>
					</div>
					<div class="sw" style="background:oklch(62% 0.19 35);color:#fff;">
						<div class="role">Accent · signal</div>
						<div><div class="name">Vermillion</div><div class="hex">oklch(62% .19 35)</div></div>
					</div>
					<div class="sw" style="background:oklch(40% 0.15 35);color:#fff;">
						<div class="role">Accent · ink</div>
						<div><div class="name">Vermillion Ink</div><div class="hex">oklch(40% .15 35)</div></div>
					</div>
					<div class="sw" style="background:oklch(95% 0.035 35);color:#141413;">
						<div class="role">Accent · wash</div>
						<div><div class="name">Vermillion Wash</div><div class="hex">oklch(95% .035 35)</div></div>
					</div>
					<div class="sw" style="background:#EAF0E4;color:#141413;">
						<div class="role">Semantic · open</div>
						<div><div class="name">Sage Wash</div><div class="hex">#EAF0E4</div></div>
					</div>
					<div class="sw" style="background:#2F5D3A;color:#F4F1EB;">
						<div class="role">Semantic · success</div>
						<div><div class="name">Verdigris</div><div class="hex">#2F5D3A</div></div>
					</div>
				</div>

				<div class="accent-plate">
					<div class="acc-hero">
						<div>
							<div class="acc-kicker">The single accent</div>
							<h4>Reserved for <em>signal,</em><br />never for decoration.</h4>
						</div>
						<div class="meta-row">
							<div><span>Hex</span>#D55A3D</div>
							<div><span>OKLCH</span>62% .19 35</div>
							<div><span>Pair with</span>Paper · Ink</div>
						</div>
					</div>
					<div class="acc-notes">
						<ul>
							<li><span>01</span>Active annotation pin, active viewer tool, primary link-on-paper.</li>
							<li><span>02</span>Never used as a background behind body copy. Headers only, or under UI chrome.</li>
							<li>
								<span>03</span>The superscript "3D" of the wordmark uses <em>Vermillion Ink</em>, not the base accent, to hold its
								weight beside the grotesk.
							</li>
							<li><span>04</span>Error and warning states borrow the accent temporarily, with the semantic "!" glyph.</li>
						</ul>
					</div>
				</div>
			</div>
		</section>

		<!-- ============== GRID / SPACING ============== -->
		<section class="sec">
			<div class="shell">
				<div class="sec-head">
					<div class="sec-num">§ 05 — Grid &amp; Space</div>
					<div>
						<h2 class="sec-title">Twelve columns. <em>Eight</em>-pixel rhythm.</h2>
						<p class="sec-sub">
							All layouts resolve to a 12-column grid with a 16px gutter and a 64px margin at 1440+. Every spacing, radius, and
							line-height snaps to the 8-pixel baseline. Radii are small — 2px for buttons, 4px for surfaces, 8px rare and only on the
							viewer shell.
						</p>
					</div>
				</div>

				<div class="grid-demo">
					<div class="gd-cols">
						{#each Array(12) as _, i (i)}<div></div>{/each}
					</div>
					<div class="gd-over">
						<div class="gd-block gd-b1">Hero · 5 col</div>
						<div class="gd-block gd-b2">Metadata · 7 col</div>
						<div class="gd-block gd-b3">Viewer · 8 col</div>
						<div class="gd-block gd-b4">Panel · 4 col</div>
					</div>
				</div>
				<div class="legend">
					<span><i class="i-wash"></i> 12-col grid · 16px gutter</span>
					<span><i class="i-ink"></i> Content block</span>
					<span>Baseline · 8px</span>
				</div>

				<div class="space-grid">
					<div class="sp"><div class="bar" style="height:4px;"></div><div class="lbl"><b>s-1</b><span>4</span></div></div>
					<div class="sp"><div class="bar" style="height:8px;"></div><div class="lbl"><b>s-2</b><span>8</span></div></div>
					<div class="sp"><div class="bar" style="height:16px;"></div><div class="lbl"><b>s-4</b><span>16</span></div></div>
					<div class="sp"><div class="bar" style="height:32px;"></div><div class="lbl"><b>s-6</b><span>32</span></div></div>
					<div class="sp"><div class="bar" style="height:64px;"></div><div class="lbl"><b>s-8</b><span>64</span></div></div>
				</div>
			</div>
		</section>

		<!-- ============== VIEWER ============== -->
		<section id="viewer" class="sec sec-paper2">
			<div class="shell">
				<div class="sec-head">
					<div class="sec-num">§ 06 — Viewer chrome</div>
					<div>
						<h2 class="sec-title">The viewer <em>is</em> the product.</h2>
						<p class="sec-sub">
							Everything inward of the viewer shell is ink-on-ink: a near-black studio backdrop, off-white type, and the accent
							reserved for active annotations and the current tool. Metadata floats as labels, not a sidebar. The model is always
							composed into the optical center — never aligned to a panel.
						</p>
					</div>
				</div>

				<div class="plate-label">
					<span>Pattern · Object View</span>
					<span class="pl-r">1440 × 900 · Canvas-led</span>
				</div>

				<div class="viewer-wrap">
					<div class="viewer-bg"></div>

					<div class="model-shadow"></div>
					<div class="model">
						<svg viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg" aria-label="3D model preview placeholder">
							<defs>
								<linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
									<stop offset="0%" stop-color="#C9B88E" />
									<stop offset="50%" stop-color="#8A7549" />
									<stop offset="100%" stop-color="#3F331F" />
								</linearGradient>
								<linearGradient id="metal2" x1="0" y1="0" x2="1" y2="1">
									<stop offset="0%" stop-color="#A18A5B" />
									<stop offset="100%" stop-color="#2B2414" />
								</linearGradient>
								<linearGradient id="metal3" x1="0" y1="0" x2="1" y2="0">
									<stop offset="0%" stop-color="#B49B66" />
									<stop offset="100%" stop-color="#6E5C38" />
								</linearGradient>
							</defs>
							<path d="M60 80 C 50 100, 48 160, 70 190 L 130 190 C 152 160, 150 100, 140 80 Z" fill="url(#metal)" />
							<path d="M70 85 C 62 105, 60 155, 78 182 L 96 182 C 88 155, 86 105, 86 85 Z" fill="url(#metal3)" opacity=".6" />
							<path d="M78 80 L 78 50 L 122 50 L 122 80 Z" fill="url(#metal2)" />
							<ellipse cx="100" cy="48" rx="24" ry="6" fill="#6E5C38" />
							<ellipse cx="100" cy="46" rx="24" ry="6" fill="url(#metal)" />
							<path d="M140 90 C 175 95, 175 155, 140 160" stroke="url(#metal2)" stroke-width="8" fill="none" stroke-linecap="round" />
							<ellipse cx="100" cy="192" rx="32" ry="6" fill="#2B2414" />
							<path d="M60 120 L 140 120" stroke="#3F331F" stroke-width="1" opacity=".6" />
							<path d="M60 124 L 140 124" stroke="#C9B88E" stroke-width=".5" opacity=".6" />
							<path d="M60 152 L 140 152" stroke="#3F331F" stroke-width="1" opacity=".6" />
							<path d="M60 156 L 140 156" stroke="#C9B88E" stroke-width=".5" opacity=".6" />
						</svg>
					</div>

					<div class="viewer-top">
						<div class="l">
							<span class="dot"></span>
							<span>Pure 3D · Viewer</span>
							<span class="sep">/</span>
							<span style="opacity:.7;">Rijksmuseum · Islamic Metalwork</span>
						</div>
						<div class="r">
							<span>Share</span>
							<span>Cite</span>
							<span>Download .glb</span>
							<span>⟶ Catalog</span>
						</div>
					</div>

					<div class="viewer-metadata">
						<h3 class="vm-title">Bronze Ewer<br /><em>Khorasan, c. 1180</em></h3>
						<p class="vm-sub">"The face of the vessel turns three ways — toward the hand, the eye, and the altar."</p>
						<dl class="vm-dl">
							<dt>Acc. No.</dt><dd>P3D-2026-0142</dd>
							<dt>Material</dt><dd>Cast &amp; engraved bronze</dd>
							<dt>H × Ø</dt><dd>38.2 × 18.4 cm</dd>
							<dt>Capture</dt><dd>Photogrammetry · 240k △</dd>
							<dt>License</dt><dd>CC-BY-NC-SA 4.0</dd>
						</dl>
					</div>

					<div class="pin" style="left:57%;top:37%;">1<div class="pin-label">Inlaid silver medallion</div></div>
					<div class="pin" style="left:63%;top:54%;">2</div>
					<div class="pin" style="left:45%;top:74%;">3</div>

					<div class="viewer-toolbar">
						<div class="vt-btn active" title="Orbit">
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none"
								><path d="M8 2.5 A 5.5 3 0 1 0 8 8.5 A 5.5 3 0 1 0 8 2.5" stroke="currentColor" stroke-width="1.2" /><path
									d="M2.5 8 A 3 5.5 0 1 0 8.5 8 A 3 5.5 0 1 0 2.5 8"
									stroke="currentColor"
									stroke-width="1.2"
								/></svg
							>
						</div>
						<div class="vt-btn" title="Pan">
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none"
								><path d="M8 2 L8 14 M2 8 L14 8" stroke="currentColor" stroke-width="1.2" /><path
									d="M5 5 L11 11 M11 5 L5 11"
									stroke="currentColor"
									stroke-width=".8"
									opacity=".5"
								/></svg
							>
						</div>
						<div class="vt-btn" title="Measure">
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none"
								><path d="M3 11 L11 3 L13 5 L5 13 Z" stroke="currentColor" stroke-width="1.2" fill="none" /><path
									d="M5 9 L6 10 M7 7 L8.5 8.5 M9 5 L10 6"
									stroke="currentColor"
									stroke-width=".8"
								/></svg
							>
						</div>
						<div class="vt-btn" title="Annotate">
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none"
								><circle cx="8" cy="7" r="3" stroke="currentColor" stroke-width="1.2" /><path
									d="M8 10 L8 14"
									stroke="currentColor"
									stroke-width="1.2"
								/></svg
							>
						</div>

						<div class="vt-sep"></div>

						<div class="vt-scrub">
							<span>X-ray</span>
							<div class="vt-track"></div>
							<span style="opacity:.5;">0.40</span>
						</div>

						<div class="vt-sep"></div>

						<div class="vt-btn" title="Reset view">
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none"
								><path d="M13 3 L13 6 L10 6" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" /><path
									d="M13 6 A 5 5 0 1 0 11 11.5"
									stroke="currentColor"
									stroke-width="1.2"
									fill="none"
									stroke-linecap="round"
								/></svg
							>
						</div>
						<div class="vt-btn" title="Fullscreen">
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none"
								><path
									d="M2 6 L2 2 L6 2 M10 2 L14 2 L14 6 M14 10 L14 14 L10 14 M6 14 L2 14 L2 10"
									stroke="currentColor"
									stroke-width="1.2"
									fill="none"
								/></svg
							>
						</div>
					</div>

					<div class="viewer-panel">
						<div class="vp-head">
							<span>Annotations · 3</span>
							<span style="opacity:.5;">View all</span>
						</div>
						<div class="vp-ann">
							<div class="vp-item active">
								<span class="pn">1</span>
								<div>
									<div class="pt">Inlaid silver medallion</div>
									<div class="pd">Openwork Kufic script around the shoulder — an inscription of praise.</div>
								</div>
							</div>
							<div class="vp-item">
								<span class="pn">2</span>
								<div>
									<div class="pt">Engraved band</div>
									<div class="pd">Friezes of animals in roundels, a motif characteristic of Khorasani metalwork.</div>
								</div>
							</div>
							<div class="vp-item">
								<span class="pn">3</span>
								<div>
									<div class="pt">Foot, repaired c. 1890</div>
									<div class="pd">Later solder visible under raking light — earlier restoration, stable.</div>
								</div>
							</div>
						</div>
						<div class="vp-foot">
							<span>FPS 60</span><span>240k △</span><span>WebGL2</span>
						</div>
					</div>
				</div>

				<div class="legend mt-6">
					<span><i class="i-vermillion"></i> Active tool / annotation</span>
					<span><i class="i-italic-swatch"></i> Object italic (metadata title)</span>
					<span><i class="i-chrome"></i> Off-white chrome · 70% on ink</span>
					<span>Chrome opacity · 0.78 glass</span>
				</div>
			</div>
		</section>

		<!-- ============== COMPONENTS ============== -->
		<section id="components" class="sec">
			<div class="shell">
				<div class="sec-head">
					<div class="sec-num">§ 07 — Components</div>
					<div>
						<h2 class="sec-title">A small <em>vocabulary,</em> spoken consistently.</h2>
						<p class="sec-sub">
							The system is deliberately narrow: four button roles, three badge states, one input. Anything outside this vocabulary
							needs a case made for it.
						</p>
					</div>
				</div>

				<div class="comp-grid">
					<div class="plate">
						<div class="plate-label"><span>Buttons</span><span class="pl-r">4 roles</span></div>
						<div class="row-wrap">
							<button class="btn btn-primary">Open viewer <span class="k">⏎</span></button>
							<button class="btn btn-secondary">Download .glb</button>
							<button class="btn btn-ghost">Cite this object</button>
							<button class="btn btn-accent">Save annotation</button>
						</div>
						<div class="row-wrap row-disabled">
							<button class="btn btn-primary" disabled>Disabled</button>
							<button class="btn btn-secondary" disabled>Disabled</button>
						</div>
					</div>

					<div class="plate">
						<div class="plate-label"><span>Badges / Status</span><span class="pl-r">Object states</span></div>
						<div class="row-wrap">
							<span class="badge verified"><span class="d"></span>Verified</span>
							<span class="badge open"><span class="d"></span>Open access</span>
							<span class="badge draft"><span class="d"></span>Draft record</span>
							<span class="badge embargo"><span class="d"></span>Embargoed · 2027</span>
						</div>
						<div class="plate-note">Status always sits beside the object title, never after it in a sentence.</div>
					</div>

					<div class="plate">
						<div class="plate-label"><span>Input · Search</span><span class="pl-r">Catalog</span></div>
						<label class="input-label" for="ds-search">Search the catalog</label>
						<div class="search-wrap">
							<input id="ds-search" class="input" placeholder="e.g. Khorasan, ewer, bronze" value="Khorasan ewer" />
							<span class="search-kbd">⌘K</span>
						</div>
						<div class="chips">
							<span class="badge quiet">+ Bronze</span>
							<span class="badge quiet">+ 12th c.</span>
							<span class="badge quiet">+ Metalwork</span>
						</div>
					</div>

					<div class="plate">
						<div class="plate-label"><span>Catalog card</span><span class="pl-r">Default surface</span></div>
						<div class="catalog-card">
							<div class="cat-thumb">
								<svg class="cat-mark" viewBox="0 0 24 24" aria-hidden="true"><use href="#p3d-mark-sm" /></svg>
							</div>
							<div>
								<div class="cat-row">
									<span class="badge verified sm"><span class="d"></span>Verified</span>
									<span class="cat-acc">P3D-2026-0142</span>
								</div>
								<div class="cat-title">Bronze Ewer, <em>Khorasan</em></div>
								<div class="cat-sub">c. 1180 · Rijksmuseum, Amsterdam</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>

		<!-- ============== MOTION ============== -->
		<section id="motion" class="sec">
			<div class="shell">
				<div class="sec-head">
					<div class="sec-num">§ 08 — Motion</div>
					<div>
						<h2 class="sec-title">Four curves. <em>Short</em> durations.</h2>
						<p class="sec-sub">
							Motion is almost always 180–240ms. Pages fade through; panels slide 8px; the viewer settles with a gentle overshoot.
							Never bounce, never spring unless touching a 3D transform.
						</p>
					</div>
				</div>

				<div class="motion-grid">
					<div class="m-card m1">
						<div class="head"><span>01 · UI default</span><span>200ms</span></div>
						<div class="demo"><div class="ball"></div></div>
						<div class="name">Quiet ease-out</div>
						<p class="desc">cubic-bezier(.2, .7, .2, 1) — hovers, reveals, panel slides.</p>
					</div>
					<div class="m-card m2">
						<div class="head"><span>02 · Transition</span><span>320ms</span></div>
						<div class="demo"><div class="ball"></div></div>
						<div class="name">Expressive</div>
						<p class="desc">cubic-bezier(.85, 0, .15, 1) — page transitions, modal enter.</p>
					</div>
					<div class="m-card m3">
						<div class="head"><span>03 · Settle</span><span>480ms</span></div>
						<div class="demo"><div class="ball"></div></div>
						<div class="name">Soft overshoot</div>
						<p class="desc">For the 3D camera settling into a saved view only.</p>
					</div>
					<div class="m-card m4">
						<div class="head"><span>04 · Mechanical</span><span>—</span></div>
						<div class="demo"><div class="ball"></div></div>
						<div class="name">Linear · loop</div>
						<p class="desc">Reserved for progress indicators and the orbit auto-rotate.</p>
					</div>
				</div>
			</div>
		</section>

		<!-- ============== COLLECTIONS ============== -->
		<section id="collections" class="sec">
			<div class="shell">
				<div class="sec-head">
					<div class="sec-num">§ 09 — Collections</div>
					<div>
						<h2 class="sec-title">Objects <em>gathered</em> by a curator's hand.</h2>
						<p class="sec-sub">
							A collection is not a folder — it is an argument. The pattern leads with the curator's voice, surfaces the essay, and
							only then lays out the objects. Cards tile asymmetrically so the eye moves through the collection the way it would
							through a gallery.
						</p>
					</div>
				</div>

				<div class="coll-header">
					<div>
						<div class="coll-kicker">Collection · 14 objects · Curated by Dr. Leila Haddad</div>
						<h3 class="coll-h">Bronze &amp; <em>Breath</em></h3>
						<p class="coll-lede">
							A reading of twelfth-century Khorasani metalwork through the objects that held, poured, and were held. Fourteen vessels,
							three workshops, one argument about the human hand.
						</p>
					</div>
					<dl class="coll-stats">
						<div><dt>Objects</dt><dd>14</dd></div>
						<div><dt>Centuries</dt><dd>11–13</dd></div>
						<div><dt>Verified</dt><dd class="accented">12/14</dd></div>
						<div><dt>Updated</dt><dd class="mono">2026-04-18</dd></div>
					</dl>
				</div>

				<div class="coll-grid">
					<div class="coll-card feature">
						<div class="coll-img">
							<svg viewBox="0 0 200 220" width="58%" style="filter:drop-shadow(0 20px 30px #00000066);">
								<defs
									><linearGradient id="cg1" x1="0" y1="0" x2="1" y2="1"
										><stop offset="0%" stop-color="#C9B88E" /><stop offset="100%" stop-color="#3F331F" /></linearGradient
									></defs
								>
								<path d="M60 80 C 50 100, 48 160, 70 190 L 130 190 C 152 160, 150 100, 140 80 Z" fill="url(#cg1)" />
								<path d="M78 80 L 78 50 L 122 50 L 122 80 Z" fill="#5A4A2C" />
								<ellipse cx="100" cy="48" rx="24" ry="6" fill="#8A7549" />
								<path d="M140 90 C 175 95, 175 155, 140 160" stroke="#5A4A2C" stroke-width="8" fill="none" stroke-linecap="round" />
							</svg>
							<span class="coll-tag">01 · Keystone</span>
						</div>
						<div class="coll-meta">
							<span class="badge verified sm"><span class="d"></span>Verified</span>
							<div class="coll-title">Bronze Ewer, <em>Khorasan</em></div>
							<div class="coll-sub">c. 1180 · Rijksmuseum · <span class="read-essay">Read essay →</span></div>
						</div>
					</div>

					<div class="coll-card">
						<div class="coll-img dim">
							<svg viewBox="0 0 120 140" width="50%"
								><rect x="40" y="20" width="40" height="100" rx="4" fill="#6E5C38" /><rect
									x="30"
									y="110"
									width="60"
									height="14"
									rx="2"
									fill="#3F331F"
								/></svg
							>
						</div>
						<div class="coll-meta"><div class="coll-title">Incense Burner</div><div class="coll-sub">c. 1150 · Herat</div></div>
					</div>
					<div class="coll-card">
						<div class="coll-img dim">
							<svg viewBox="0 0 120 140" width="60%"
								><ellipse cx="60" cy="78" rx="44" ry="32" fill="#8A7549" /><ellipse cx="60" cy="72" rx="44" ry="32" fill="#C9B88E" /></svg
							>
						</div>
						<div class="coll-meta"><div class="coll-title">Shallow Dish</div><div class="coll-sub">c. 1200 · Nishapur</div></div>
					</div>
					<div class="coll-card">
						<div class="coll-img dim">
							<svg viewBox="0 0 120 140" width="45%"
								><path d="M40 30 L80 30 L90 110 L30 110 Z" fill="#6E5C38" /><path d="M50 30 L50 20 L70 20 L70 30" fill="#3F331F" /></svg
							>
						</div>
						<div class="coll-meta">
							<span class="badge draft sm"><span class="d"></span>Draft</span>
							<div class="coll-title">Covered Tankard</div>
							<div class="coll-sub">c. 1210 · Private coll.</div>
						</div>
					</div>
					<div class="coll-card">
						<div class="coll-img dim">
							<svg viewBox="0 0 120 140" width="55%"
								><circle cx="60" cy="70" r="36" fill="#8A7549" /><circle cx="60" cy="70" r="26" fill="#3F331F" /><circle
									cx="60"
									cy="70"
									r="6"
									fill="#C9B88E"
								/></svg
							>
						</div>
						<div class="coll-meta"><div class="coll-title">Mirror, engraved</div><div class="coll-sub">c. 1170 · Mosul</div></div>
					</div>
					<div class="coll-card">
						<div class="coll-img dim">
							<svg viewBox="0 0 120 140" width="50%"
								><path d="M45 30 L75 30 L85 70 L75 110 L45 110 L35 70 Z" fill="#8A7549" /></svg
							>
						</div>
						<div class="coll-meta"><div class="coll-title">Pilgrim Flask</div><div class="coll-sub">c. 1190 · Louvre</div></div>
					</div>
					<div class="coll-card">
						<div class="coll-img dim">
							<svg viewBox="0 0 120 140" width="60%"
								><rect x="20" y="50" width="80" height="40" rx="20" fill="#6E5C38" /><rect
									x="50"
									y="30"
									width="20"
									height="20"
									fill="#3F331F"
								/></svg
							>
						</div>
						<div class="coll-meta">
							<span class="badge embargo sm"><span class="d"></span>Embargoed · 2027</span>
							<div class="coll-title">Inkwell, silver-inlaid</div>
							<div class="coll-sub">c. 1220 · Met</div>
						</div>
					</div>
				</div>

				<div class="legend mt-6">
					<span>Feature card spans 2×2 · anchors the argument</span>
					<span>Cards are objects, not tiles — never crop the silhouette</span>
					<span>Embargoed objects remain visible, never hidden</span>
				</div>

				<div class="labeled-rule">
					<span class="lbl">Index pattern — a reader's list of collections</span><span class="rl"></span>
				</div>

				<div class="coll-index">
					<div class="ci-row">
						<div class="ci-num">01</div>
						<div class="ci-body">
							<div class="ci-title">Bronze &amp; <em>Breath</em></div>
							<div class="ci-curator">Dr. Leila Haddad · Rijksmuseum</div>
						</div>
						<div class="ci-count">14 objects</div>
						<div class="ci-span">11th — 13th c.</div>
						<div class="ci-cta">↗</div>
					</div>
					<div class="ci-row">
						<div class="ci-num">02</div>
						<div class="ci-body">
							<div class="ci-title">Before the <em>Lathe</em></div>
							<div class="ci-curator">Prof. Henrik Voss · KHM Wien</div>
						</div>
						<div class="ci-count">22 objects</div>
						<div class="ci-span">Prehistoric — Iron Age</div>
						<div class="ci-cta">↗</div>
					</div>
					<div class="ci-row">
						<div class="ci-num">03</div>
						<div class="ci-body">
							<div class="ci-title">Palimpsest: the <em>Scanned</em> Page</div>
							<div class="ci-curator">Dr. A. Okafor · British Library</div>
						</div>
						<div class="ci-count">9 objects</div>
						<div class="ci-span">4th — 15th c.</div>
						<div class="ci-cta">↗</div>
					</div>
					<div class="ci-row">
						<div class="ci-num">04</div>
						<div class="ci-body">
							<div class="ci-title">Teaching Casts of the <em>19th Century</em></div>
							<div class="ci-curator">Student survey · ETH Zürich</div>
						</div>
						<div class="ci-count">48 objects</div>
						<div class="ci-span">1820 — 1910</div>
						<div class="ci-cta">↗</div>
					</div>
				</div>
			</div>
		</section>

		<!-- ============== EDITIONS ============== -->
		<section id="editions" class="sec sec-paper2">
			<div class="shell">
				<div class="sec-head">
					<div class="sec-num">§ 10 — Editions &amp; Versions</div>
					<div>
						<h2 class="sec-title">Every capture, a <em>citable</em> edition.</h2>
						<p class="sec-sub">
							A 3D record is never finished. A new scan, a corrected annotation, a re-bake of textures — each becomes a numbered
							edition with its own permalink and DOI. Older editions remain citable forever; the current one is marked, and changes
							are legible in a quiet changelog.
						</p>
					</div>
				</div>

				<div class="ed-wrap">
					<div>
						<div class="plate ed-plate">
							<div class="plate-label plate-label-head"><span>Edition history</span><span class="pl-r">P3D-2026-0142</span></div>

							<div class="edition">
								<div class="ed-rail">
									<div class="ed-dot current"></div>
									<div class="ed-line"></div>
								</div>
								<div class="ed-body">
									<div class="ed-head">
										<div>
											<span class="ed-num">Ed. 03</span>
											<span class="ed-label current-tag">Current</span>
										</div>
										<div class="ed-date">2026-04-12</div>
									</div>
									<div class="ed-title">Inlay re-interpretation &amp; annotation cleanup</div>
									<div class="ed-meta">
										<span>doi:10.60131/p3d.0142.03</span>
										<span>· 240k △</span>
										<span>· 4k PBR</span>
										<span>· +3 annotations</span>
									</div>
									<div class="ed-note">
										Medallion inscription re-read with Dr. Haddad. Earlier solder joint re-annotated as restoration (was: damage).
									</div>
								</div>
							</div>

							<div class="edition">
								<div class="ed-rail"><div class="ed-dot"></div><div class="ed-line"></div></div>
								<div class="ed-body">
									<div class="ed-head">
										<div><span class="ed-num">Ed. 02</span></div>
										<div class="ed-date">2025-11-03</div>
									</div>
									<div class="ed-title">High-resolution re-scan</div>
									<div class="ed-meta">
										<span>doi:10.60131/p3d.0142.02</span>
										<span>· 240k △</span>
										<span>· 4k PBR</span>
									</div>
									<div class="ed-note">Photogrammetry recaptured with TRITOP; mesh reduced from 1.1M to 240k △ without visible loss.</div>
								</div>
							</div>

							<div class="edition">
								<div class="ed-rail"><div class="ed-dot"></div></div>
								<div class="ed-body">
									<div class="ed-head">
										<div><span class="ed-num">Ed. 01</span><span class="ed-label">Original</span></div>
										<div class="ed-date">2024-07-19</div>
									</div>
									<div class="ed-title">First publication</div>
									<div class="ed-meta">
										<span>doi:10.60131/p3d.0142.01</span>
										<span>· 180k △</span>
										<span>· 2k PBR</span>
									</div>
									<div class="ed-note">Initial record, imported from the museum's internal scan archive.</div>
								</div>
							</div>
						</div>
					</div>

					<div class="ed-side">
						<div class="plate">
							<div class="plate-label"><span>Cite this edition</span><span class="pl-r">Chicago · MLA · BibTeX</span></div>
							<div class="cite-body">
								Haddad, L. <em>Bronze Ewer, Khorasan, c. 1180.</em> Pure 3D, ed. 03 (2026). doi:10.60131/p3d.0142.03.
							</div>
							<div class="cite-actions">
								<button class="btn btn-secondary sm">Copy citation</button>
								<button class="btn btn-ghost sm">Download .bib</button>
							</div>
						</div>

						<div class="plate">
							<div class="plate-label"><span>Edition chip · inline</span><span class="pl-r">In running text</span></div>
							<div class="chip-body">
								"…the medallion's inscription (see <span class="ed-chip"><span class="ed-chip-n">Ed.</span> 03 <span class="ed-chip-dot"></span></span>) now reads as a dedication rather than a signature…"
							</div>
						</div>

						<div class="plate">
							<div class="plate-label"><span>Diff · what changed</span><span class="pl-r">Ed. 02 → 03</span></div>
							<div class="diff">
								<div class="diff-row add"><span>+</span><span class="serif">Annotation 3 · Foot, repaired c. 1890</span></div>
								<div class="diff-row mod"><span>~</span><span class="serif">Annotation 1 · Medallion re-transcribed</span></div>
								<div class="diff-row del"><span>−</span><span class="serif">Legacy mesh (180k △) retired</span></div>
							</div>
						</div>
					</div>
				</div>

				<div class="legend mt-6">
					<span><i class="i-dot-vermillion"></i> Current edition</span>
					<span><i class="i-dot-ink"></i> Prior edition · always citable</span>
					<span>DOIs are per-edition · never reused</span>
				</div>
			</div>
		</section>

		<!-- ============== FOOTER ============== -->
		<section>
			<div class="shell">
				<footer>
					<div>
						<div class="foot-mark">
							<span class="wm-inline"
								>Pure&nbsp;<span class="wm-3">3</span><svg class="wm-d-xs" aria-hidden="true"><use href="#p3d-mark-sm" /></svg></span
							>
						</div>
						<p class="colophon">
							A design system for a scholarly publishing platform of interactive 3D objects. The marks and measures above are a
							<em>working draft</em> — built to be interrogated, pressure-tested, and, in places, disagreed with.
						</p>
					</div>
					<dl class="meta">
						<div>
							<dt>System</dt><dd>Pure 3D · v0.1</dd>
							<dt>Released</dt><dd>April 2026</dd>
							<dt>Type</dt><dd>Inter Tight · Fraunces · JetBrains Mono</dd>
						</div>
						<div>
							<dt>Primary</dt><dd>Paper · Ink · Vermillion</dd>
							<dt>Grid</dt><dd>12 col · 16 gutter · 8px baseline</dd>
							<dt>Next</dt><dd>Dark mode · data viz · iconography</dd>
						</div>
					</dl>
				</footer>
			</div>
		</section>
	</main>

	<!-- ============== TWEAKS PANEL ============== -->
	<aside class="tweaks" class:open={tweaksOpen} aria-hidden={!tweaksOpen}>
		<div class="tw-head">
			<b>Tweaks</b>
			<span>Pure 3D · v0.1</span>
		</div>
		<div class="tw-body">
			<div class="tw-field">
				<div class="tw-lbl"><b>Accent</b><span>{ACCENT_NAMES[accentHue] ?? ''}</span></div>
				<div class="tw-swatches">
					{#each [35, 70, 145, 220, 300, 0] as hue (hue)}
						<button
							type="button"
							class="tw-sw"
							class:active={accentHue === hue}
							style:background={hue === 0 ? 'oklch(25% 0.01 80)' : `oklch(62% 0.19 ${hue})`}
							title={ACCENT_NAMES[hue]}
							aria-label={ACCENT_NAMES[hue]}
							onclick={() => (accentHue = hue)}
						></button>
					{/each}
				</div>
			</div>

			<div class="tw-field">
				<div class="tw-lbl"><b>Paper</b><span>{paper[0].toUpperCase() + paper.slice(1)}</span></div>
				<div class="tw-seg">
					{#each ['warm', 'cool', 'bright', 'ink'] as const as p (p)}
						<button type="button" class:active={paper === p} onclick={() => (paper = p)}>{p[0].toUpperCase() + p.slice(1)}</button>
					{/each}
				</div>
			</div>

			<div class="tw-field">
				<div class="tw-lbl"><b>Density</b><span>Spacing rhythm</span></div>
				<div class="tw-seg">
					{#each ['dense', 'default', 'airy'] as const as d (d)}
						<button type="button" class:active={density === d} onclick={() => (density = d)}>{d[0].toUpperCase() + d.slice(1)}</button>
					{/each}
				</div>
			</div>

			<div class="tw-field">
				<div class="tw-lbl"><b>Voice font</b><span>Italic emphasis</span></div>
				<div class="tw-seg">
					{#each ['Fraunces', 'EB Garamond', 'Playfair Display'] as const as s (s)}
						<button type="button" class:active={serif === s} onclick={() => (serif = s)}>{s.split(' ')[0]}</button>
					{/each}
				</div>
			</div>

			<div class="tw-field">
				<div class="tw-lbl"><b>Hero headline</b><span>Editable</span></div>
				<input class="tw-input" maxlength="80" bind:value={heroHeadline} />
			</div>

			<div class="tw-field">
				<div class="tw-lbl"><b>Italic emphasis</b><span>Editable word</span></div>
				<input class="tw-input" maxlength="32" bind:value={italicWord} />
			</div>
		</div>
	</aside>
</div>

<style>
	/* ---------- TOKENS (scoped) ---------- */
	.ds-root {
		/* paper + ink */
		--ds-paper: #f4f1eb;
		--ds-paper-2: #ece7dd;
		--ds-paper-3: #e2dccf;
		--ds-paper-bg: #fbfaf6;
		--ds-ink: #141413;
		--ds-ink-2: #2b2a27;
		--ds-ink-3: #555249;
		--ds-ink-4: #8a8579;
		--ds-rule: #1414131a;
		--ds-rule-strong: #14141333;

		/* accent — vermillion / archival red */
		--ds-vermillion: oklch(62% 0.19 35);
		--ds-vermillion-ink: oklch(40% 0.15 35);
		--ds-vermillion-wash: oklch(95% 0.035 35);

		/* type */
		--ds-sans: 'Inter Tight', 'Helvetica Neue', Helvetica, Arial, sans-serif;
		--ds-mono: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
		--ds-serif: 'Fraunces', 'Times New Roman', serif;

		/* scale (px on 1440 baseline) */
		--s-1: 4px;
		--s-2: 8px;
		--s-3: 12px;
		--s-4: 16px;
		--s-5: 24px;
		--s-6: 32px;
		--s-7: 48px;
		--s-8: 64px;
		--s-9: 96px;
		--s-10: 128px;

		/* radii */
		--r-1: 2px;
		--r-2: 4px;
		--r-3: 8px;

		/* shadow */
		--shadow-1: 0 1px 0 #14141314;
		--shadow-2:
			0 20px 40px -24px #14141333,
			0 2px 0 #1414130f;

		background: var(--ds-paper);
		color: var(--ds-ink);
		font-family: var(--ds-sans);
		font-size: 15px;
		line-height: 1.5;
		font-feature-settings: 'ss01', 'cv11';
		-webkit-font-smoothing: antialiased;
		text-rendering: optimizeLegibility;
		min-height: 100vh;
	}

	.ds-root :global(*) {
		box-sizing: border-box;
	}

	.ds-root[data-density='dense'] {
		--s-7: 32px;
		--s-8: 40px;
		--s-9: 60px;
		--s-10: 80px;
	}
	.ds-root[data-density='airy'] {
		--s-7: 64px;
		--s-8: 88px;
		--s-9: 128px;
		--s-10: 160px;
	}

	.ds-root a {
		color: inherit;
		text-decoration: none;
	}
	.ds-root button {
		font: inherit;
		color: inherit;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}

	/* ---------- LAYOUT SHELL ---------- */
	.shell {
		max-width: 1280px;
		margin: 0 auto;
		padding: 0 var(--s-7);
	}
	@media (max-width: 900px) {
		.shell {
			padding: 0 var(--s-5);
		}
	}

	/* ---------- TOP BAR ---------- */
	.topbar {
		position: sticky;
		top: 0;
		z-index: 50;
		background: color-mix(in srgb, var(--ds-paper) 82%, transparent);
		backdrop-filter: saturate(140%) blur(10px);
		-webkit-backdrop-filter: saturate(140%) blur(10px);
		border-bottom: 1px solid var(--ds-rule);
	}
	.topbar-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 56px;
	}
	.topbar .mark {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.topbar .mark svg {
		display: block;
		color: var(--ds-ink);
	}
	.topbar .mark span {
		font-family: var(--ds-sans);
		font-weight: 600;
		letter-spacing: -0.01em;
		font-size: 15px;
	}
	.topbar .mark small {
		font-family: var(--ds-mono);
		font-size: 11px;
		letter-spacing: 0.04em;
		color: var(--ds-ink-3);
		text-transform: uppercase;
		margin-left: var(--s-3);
		padding-left: var(--s-3);
		border-left: 1px solid var(--ds-rule);
	}
	.topbar nav {
		display: flex;
		gap: var(--s-6);
	}
	.topbar nav a {
		font-family: var(--ds-mono);
		font-size: 11.5px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ds-ink-3);
	}
	.topbar nav a:hover {
		color: var(--ds-ink);
	}
	.top-actions {
		display: flex;
		align-items: center;
		gap: var(--s-3);
	}
	.chip {
		font-family: var(--ds-mono);
		font-size: 10.5px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ds-vermillion-ink);
		padding: 4px 8px;
		border: 1px solid var(--ds-vermillion);
		border-radius: 2px;
		background: var(--ds-vermillion-wash);
	}
	.chip-btn {
		font-family: var(--ds-mono);
		font-size: 10.5px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ds-ink-3);
		padding: 4px 8px;
		border: 1px solid var(--ds-rule-strong);
		border-radius: 2px;
		background: transparent;
	}
	.chip-btn:hover {
		color: var(--ds-ink);
		border-color: var(--ds-ink);
	}
	@media (max-width: 900px) {
		.topbar nav {
			display: none;
		}
	}

	/* ---------- HERO ---------- */
	.hero {
		padding: var(--s-10) 0 var(--s-9);
		border-bottom: 1px solid var(--ds-rule);
		position: relative;
	}
	.hero .eyebrow {
		display: flex;
		align-items: center;
		gap: var(--s-3);
		font-family: var(--ds-mono);
		font-size: 11.5px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ds-ink-3);
		margin-bottom: var(--s-7);
	}
	.hero .eyebrow .dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--ds-vermillion);
	}
	.hero h1 {
		font-family: var(--ds-sans);
		font-weight: 500;
		font-size: clamp(48px, 8.4vw, 120px);
		line-height: 0.94;
		letter-spacing: -0.035em;
		margin: 0 0 var(--s-6);
		text-wrap: balance;
	}
	.hero h1 :global(em) {
		font-family: var(--ds-serif);
		font-style: italic;
		font-weight: 400;
		color: var(--ds-vermillion-ink);
	}
	.hero-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--s-9);
		align-items: end;
		margin-top: var(--s-8);
	}
	@media (max-width: 900px) {
		.hero-grid {
			grid-template-columns: 1fr;
			gap: var(--s-6);
		}
	}
	.hero-lede {
		font-family: var(--ds-serif);
		font-size: 22px;
		line-height: 1.4;
		color: var(--ds-ink-2);
		max-width: 48ch;
		font-weight: 400;
		text-wrap: pretty;
	}
	.hero-meta {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--s-5) var(--s-6);
		padding-top: var(--s-5);
		border-top: 1px solid var(--ds-rule);
	}
	.hero-meta dt {
		font-family: var(--ds-mono);
		font-size: 10.5px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ds-ink-4);
		margin-bottom: 4px;
	}
	.hero-meta dd {
		margin: 0;
		font-size: 14px;
		color: var(--ds-ink-2);
	}

	/* ---------- SECTION HEADER ---------- */
	.sec {
		padding: var(--s-10) 0;
		border-bottom: 1px solid var(--ds-rule);
		position: relative;
	}
	.sec-paper2 {
		background: var(--ds-paper-2);
	}
	.sec-head {
		display: grid;
		grid-template-columns: 120px 1fr;
		gap: var(--s-6);
		align-items: baseline;
		margin-bottom: var(--s-8);
	}
	@media (max-width: 700px) {
		.sec-head {
			grid-template-columns: 1fr;
			gap: var(--s-2);
		}
	}
	.sec-num {
		font-family: var(--ds-mono);
		font-size: 11px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ds-ink-4);
	}
	.sec-title {
		font-family: var(--ds-sans);
		font-weight: 500;
		font-size: clamp(28px, 3.8vw, 48px);
		line-height: 1.05;
		letter-spacing: -0.025em;
		margin: 0 0 var(--s-3);
	}
	.sec-title em {
		font-family: var(--ds-serif);
		font-style: italic;
		font-weight: 400;
		color: var(--ds-vermillion-ink);
	}
	.sec-sub {
		font-family: var(--ds-serif);
		font-size: 18px;
		line-height: 1.5;
		color: var(--ds-ink-2);
		max-width: 60ch;
		margin: 0;
		text-wrap: pretty;
	}

	/* ---------- CARD / PLATE ---------- */
	.plate {
		background: var(--ds-paper-bg);
		border: 1px solid var(--ds-rule);
		border-radius: var(--r-2);
		padding: var(--s-6);
		box-shadow: var(--shadow-1);
	}
	.plate-label {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-family: var(--ds-mono);
		font-size: 10.5px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ds-ink-4);
		margin-bottom: var(--s-5);
	}
	.plate-label .pl-r {
		color: var(--ds-ink-3);
	}

	/* ---------- PRINCIPLES ---------- */
	.principles {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0;
		border-top: 1px solid var(--ds-rule);
		border-bottom: 1px solid var(--ds-rule);
	}
	@media (max-width: 900px) {
		.principles {
			grid-template-columns: 1fr;
		}
	}
	.principle {
		padding: var(--s-6) var(--s-5);
		border-right: 1px solid var(--ds-rule);
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
	}
	.principle:last-child {
		border-right: none;
	}
	@media (max-width: 900px) {
		.principle {
			border-right: none;
			border-bottom: 1px solid var(--ds-rule);
		}
		.principle:last-child {
			border-bottom: none;
		}
	}
	.principle .n {
		font-family: var(--ds-mono);
		font-size: 11px;
		letter-spacing: 0.08em;
		color: var(--ds-vermillion-ink);
	}
	.principle h3 {
		font-family: var(--ds-sans);
		font-weight: 500;
		font-size: 20px;
		letter-spacing: -0.01em;
		margin: 0;
		line-height: 1.2;
	}
	.principle p {
		font-family: var(--ds-serif);
		font-size: 15px;
		line-height: 1.5;
		color: var(--ds-ink-2);
		margin: 0;
		text-wrap: pretty;
	}

	/* ---------- LOGO LOCKUP ---------- */
	.lockup-stage {
		display: grid;
		grid-template-columns: 1.2fr 1fr;
		gap: var(--s-6);
	}
	@media (max-width: 900px) {
		.lockup-stage {
			grid-template-columns: 1fr;
		}
	}
	.lockup-main {
		background: var(--ds-paper-bg);
		border: 1px solid var(--ds-rule);
		border-radius: var(--r-2);
		aspect-ratio: 16 / 10;
		display: grid;
		place-items: center;
		position: relative;
		overflow: hidden;
	}
	.lockup-main::before {
		content: '';
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(to right, var(--ds-rule) 1px, transparent 1px),
			linear-gradient(to bottom, var(--ds-rule) 1px, transparent 1px);
		background-size: 48px 48px;
		opacity: 0.5;
	}
	.lockup-main .crosshair {
		position: absolute;
		font-family: var(--ds-mono);
		font-size: 10px;
		letter-spacing: 0.06em;
		color: var(--ds-ink-4);
		text-transform: uppercase;
	}
	.lockup-main .crosshair.tl {
		top: 12px;
		left: 12px;
	}
	.lockup-main .crosshair.tr {
		top: 12px;
		right: 12px;
	}
	.lockup-main .crosshair.bl {
		bottom: 12px;
		left: 12px;
	}
	.lockup-main .crosshair.br {
		bottom: 12px;
		right: 12px;
	}
	.logo-hero {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		gap: 22px;
		color: var(--ds-ink);
	}
	/* Wordmark ("Pure 3D" where the D is the faceted-dome mark) */
	.wm-inline {
		display: inline-flex;
		align-items: baseline;
		gap: 0;
		font-family: var(--ds-sans);
		font-weight: 600;
		letter-spacing: -0.015em;
		font-size: 15px;
		color: var(--ds-ink);
	}
	.wm-inline .wm-3 {
		font-feature-settings: 'ss01';
	}
	.wm-d-xs {
		width: 15px;
		height: 15px;
		margin-left: 1px;
		align-self: center;
		flex: none;
	}

	.logo-wm {
		display: flex;
		align-items: center;
		gap: 4px;
		font-family: var(--ds-sans);
		font-weight: 500;
		font-size: 96px;
		letter-spacing: -0.045em;
		line-height: 0.9;
		color: var(--ds-ink);
	}
	.logo-wm .wm-num {
		font-feature-settings: 'ss01';
	}
	.logo-wm .wm-d-lg {
		width: 0.92em;
		height: 0.92em;
		color: var(--ds-ink);
		margin-left: 2px;
		align-self: center;
		filter: drop-shadow(0 6px 12px #14141320);
	}

	.lockup-variants {
		display: grid;
		grid-template-rows: repeat(3, 1fr);
		gap: var(--s-4);
	}
	.lvar {
		border: 1px solid var(--ds-rule);
		border-radius: var(--r-2);
		padding: var(--s-5);
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--ds-paper-bg);
		color: var(--ds-ink);
	}
	.lvar.ink {
		background: var(--ds-ink);
		color: var(--ds-paper);
		border-color: var(--ds-ink);
	}
	.lvar.vermillion {
		background: var(--ds-vermillion);
		color: var(--ds-paper);
		border-color: var(--ds-vermillion);
	}
	.lvar .lab {
		font-family: var(--ds-mono);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		opacity: 0.6;
	}
	.lvar .lg {
		display: flex;
		align-items: center;
		gap: 2px;
	}
	.lvar .lg .wm {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		font-family: var(--ds-sans);
		font-weight: 500;
		font-size: 24px;
		letter-spacing: -0.025em;
		color: var(--ds-ink);
	}
	.lvar.ink .lg .wm,
	.lvar.vermillion .lg .wm {
		color: #f4f1eb;
	}
	.lvar .lg .wm-num-sm {
		font-feature-settings: 'ss01';
	}
	.lvar .lg .wm-d-sm {
		width: 22px;
		height: 22px;
		color: currentColor;
		margin-left: 2px;
		align-self: center;
		flex: none;
	}

	.cat-mark {
		width: 40px;
		height: 40px;
		color: var(--ds-paper);
	}

	.construction {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--s-6);
		margin-top: var(--s-6);
	}
	@media (max-width: 900px) {
		.construction {
			grid-template-columns: 1fr;
		}
	}
	.constr-board {
		background: var(--ds-paper-bg);
		border: 1px solid var(--ds-rule);
		border-radius: var(--r-2);
		padding: var(--s-6);
		position: relative;
		min-height: 260px;
		display: grid;
		place-items: center;
	}
	.constr-board .grid-bg {
		position: absolute;
		inset: 24px;
		background-image:
			linear-gradient(to right, var(--ds-rule) 1px, transparent 1px),
			linear-gradient(to bottom, var(--ds-rule) 1px, transparent 1px);
		background-size: 16px 16px;
		opacity: 0.5;
		pointer-events: none;
	}
	.misuse-grid {
		position: relative;
		z-index: 1;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 18px;
		width: 100%;
		padding: 10px;
	}
	.misuse {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.misuse-sample {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--ds-ink);
	}
	.misuse-sample span {
		font-family: var(--ds-sans);
		font-weight: 500;
		font-size: 18px;
	}
	.misuse-sample.dim {
		opacity: 0.55;
		filter: saturate(0.4);
	}
	.misuse-sample.dim span {
		font-weight: 700;
		font-style: italic;
	}
	.misuse-sample.gradient {
		background: linear-gradient(90deg, #ff5e5e, #ffc371);
		padding: 6px 10px;
		border-radius: 20px;
		color: white;
	}
	.misuse-sample.gradient span {
		font-size: 16px;
	}
	.misuse-sample.rotated {
		transform: rotate(-8deg);
	}
	.misuse-sample.solid span {
		color: var(--ds-vermillion);
	}
	.misuse-lbl {
		font-family: var(--ds-mono);
		font-size: 10px;
		color: var(--ds-vermillion-ink);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	/* ---------- TYPE ---------- */
	.pairing {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: var(--s-4);
		margin-top: var(--s-6);
	}
	@media (max-width: 900px) {
		.pairing {
			grid-template-columns: 1fr;
		}
	}
	.pair-card {
		border: 1px solid var(--ds-rule);
		border-radius: var(--r-2);
		padding: var(--s-5);
		background: var(--ds-paper-bg);
	}
	.pair-card .name {
		font-family: var(--ds-mono);
		font-size: 10.5px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ds-ink-4);
		margin-bottom: var(--s-4);
		display: flex;
		justify-content: space-between;
	}
	.pair-card .sample {
		font-size: 32px;
		line-height: 1;
	}
	.pair-card .role {
		font-family: var(--ds-mono);
		font-size: 11px;
		color: var(--ds-ink-3);
		margin-top: var(--s-4);
	}
	.pc1 .sample {
		font-family: var(--ds-sans);
		font-weight: 500;
		letter-spacing: -0.02em;
	}
	.pc2 .sample {
		font-family: var(--ds-serif);
		font-style: italic;
		font-weight: 400;
		color: var(--ds-vermillion-ink);
	}
	.pc3 .sample {
		font-family: var(--ds-mono);
		font-weight: 500;
		font-size: 24px;
		letter-spacing: 0.02em;
	}

	.type-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0;
		border-top: 1px solid var(--ds-rule);
	}
	.type-row {
		display: grid;
		grid-template-columns: 140px 1fr 180px;
		gap: var(--s-6);
		padding: var(--s-6) 0;
		border-bottom: 1px solid var(--ds-rule);
		align-items: baseline;
	}
	@media (max-width: 900px) {
		.type-row {
			grid-template-columns: 1fr;
			gap: var(--s-2);
		}
	}
	.type-row .meta {
		font-family: var(--ds-mono);
		font-size: 11px;
		letter-spacing: 0.06em;
		color: var(--ds-ink-4);
		text-transform: uppercase;
	}
	.type-row .spec {
		font-family: var(--ds-mono);
		font-size: 11px;
		color: var(--ds-ink-4);
		text-align: right;
	}
	@media (max-width: 900px) {
		.type-row .spec {
			text-align: left;
		}
	}
	.t-display {
		font-family: var(--ds-sans);
		font-weight: 500;
		font-size: 72px;
		letter-spacing: -0.035em;
		line-height: 0.95;
	}
	.t-display em {
		font-family: var(--ds-serif);
		font-style: italic;
		color: var(--ds-vermillion-ink);
		font-weight: 400;
	}
	.t-h1 {
		font-family: var(--ds-sans);
		font-weight: 500;
		font-size: 48px;
		letter-spacing: -0.025em;
		line-height: 1.05;
	}
	.t-h2 {
		font-family: var(--ds-sans);
		font-weight: 500;
		font-size: 32px;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}
	.t-lede {
		font-family: var(--ds-serif);
		font-weight: 400;
		font-size: 22px;
		line-height: 1.45;
		color: var(--ds-ink-2);
	}
	.t-body {
		font-family: var(--ds-sans);
		font-weight: 400;
		font-size: 15px;
		line-height: 1.55;
		color: var(--ds-ink-2);
	}
	.t-caption {
		font-family: var(--ds-mono);
		font-size: 11.5px;
		letter-spacing: 0.06em;
		color: var(--ds-ink-3);
		text-transform: uppercase;
	}

	/* ---------- COLOR ---------- */
	.color-grid {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 1px;
		background: var(--ds-rule-strong);
		border: 1px solid var(--ds-rule-strong);
		border-radius: var(--r-2);
		overflow: hidden;
	}
	@media (max-width: 900px) {
		.color-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	@media (max-width: 500px) {
		.color-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	.sw {
		padding: var(--s-5);
		aspect-ratio: 1 / 1.1;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}
	.sw .name {
		font-family: var(--ds-sans);
		font-weight: 500;
		font-size: 14px;
		letter-spacing: -0.005em;
	}
	.sw .hex {
		font-family: var(--ds-mono);
		font-size: 11px;
		letter-spacing: 0.04em;
		opacity: 0.7;
		margin-top: 2px;
	}
	.sw .role {
		font-family: var(--ds-mono);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		opacity: 0.55;
	}

	.accent-plate {
		margin-top: var(--s-6);
		display: grid;
		grid-template-columns: 1.2fr 1fr;
		gap: var(--s-6);
	}
	@media (max-width: 900px) {
		.accent-plate {
			grid-template-columns: 1fr;
		}
	}
	.acc-hero {
		background: var(--ds-vermillion);
		color: var(--ds-paper);
		padding: var(--s-8);
		border-radius: var(--r-2);
		position: relative;
		overflow: hidden;
		min-height: 260px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}
	.acc-kicker {
		font-family: var(--ds-mono);
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		opacity: 0.7;
		margin-bottom: var(--s-4);
	}
	.acc-hero h4 {
		font-family: var(--ds-sans);
		font-weight: 500;
		font-size: 42px;
		letter-spacing: -0.025em;
		margin: 0;
		line-height: 1;
	}
	.acc-hero h4 em {
		font-family: var(--ds-serif);
		font-style: italic;
		font-weight: 400;
	}
	.acc-hero .meta-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--s-4);
		font-family: var(--ds-mono);
		font-size: 11px;
		letter-spacing: 0.05em;
		opacity: 0.88;
		border-top: 1px solid #ffffff33;
		padding-top: var(--s-5);
	}
	.acc-hero .meta-row div span {
		display: block;
		opacity: 0.7;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin-bottom: 2px;
	}
	.acc-notes ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
	}
	.acc-notes li {
		display: grid;
		grid-template-columns: 24px 1fr;
		gap: var(--s-3);
		font-family: var(--ds-serif);
		font-size: 16px;
		line-height: 1.5;
		color: var(--ds-ink-2);
		padding-bottom: var(--s-3);
		border-bottom: 1px solid var(--ds-rule);
	}
	.acc-notes li em {
		font-style: italic;
		color: var(--ds-vermillion-ink);
	}
	.acc-notes li span {
		font-family: var(--ds-mono);
		font-size: 10.5px;
		color: var(--ds-vermillion-ink);
		letter-spacing: 0.06em;
		padding-top: 4px;
	}

	/* ---------- GRID / SPACING ---------- */
	.grid-demo {
		position: relative;
		background: var(--ds-paper-bg);
		border: 1px solid var(--ds-rule);
		border-radius: var(--r-2);
		padding: var(--s-6);
		min-height: 320px;
		overflow: hidden;
	}
	.gd-cols {
		position: absolute;
		inset: var(--s-6);
		display: grid;
		grid-template-columns: repeat(12, 1fr);
		gap: 16px;
		pointer-events: none;
	}
	.gd-cols div {
		background: var(--ds-vermillion-wash);
		border-left: 1px dashed var(--ds-vermillion);
		border-right: 1px dashed var(--ds-vermillion);
		opacity: 0.55;
	}
	.gd-over {
		position: relative;
		z-index: 1;
		display: grid;
		grid-template-columns: repeat(12, 1fr);
		gap: 16px;
		height: 100%;
	}
	.gd-block {
		background: var(--ds-ink);
		color: var(--ds-paper);
		padding: var(--s-4);
		border-radius: var(--r-1);
		font-family: var(--ds-mono);
		font-size: 10.5px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		display: flex;
		align-items: flex-end;
	}
	.gd-b1 {
		grid-column: 1 / 6;
		min-height: 140px;
	}
	.gd-b2 {
		grid-column: 6 / 13;
		min-height: 140px;
		background: var(--ds-paper-3);
		color: var(--ds-ink-2);
	}
	.gd-b3 {
		grid-column: 1 / 9;
		min-height: 80px;
		background: var(--ds-vermillion);
		color: var(--ds-paper);
	}
	.gd-b4 {
		grid-column: 9 / 13;
		min-height: 80px;
		background: var(--ds-paper-2);
		color: var(--ds-ink-2);
	}

	.space-grid {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: var(--s-4);
		margin-top: var(--s-6);
	}
	@media (max-width: 700px) {
		.space-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	.sp {
		background: var(--ds-paper-bg);
		border: 1px solid var(--ds-rule);
		border-radius: var(--r-2);
		padding: var(--s-4);
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
		aspect-ratio: 1 / 1;
	}
	.sp .bar {
		background: var(--ds-ink);
		border-radius: 1px;
	}
	.sp .lbl {
		font-family: var(--ds-mono);
		font-size: 10.5px;
		letter-spacing: 0.06em;
		color: var(--ds-ink-3);
		display: flex;
		justify-content: space-between;
	}
	.sp .lbl b {
		font-weight: 500;
		color: var(--ds-ink);
	}

	/* ---------- VIEWER ---------- */
	.viewer-wrap {
		position: relative;
		background: var(--ds-ink);
		color: var(--ds-paper);
		border-radius: var(--r-3);
		overflow: hidden;
		aspect-ratio: 16 / 10;
		box-shadow: var(--shadow-2);
	}
	.viewer-bg {
		position: absolute;
		inset: 0;
		background: radial-gradient(ellipse at 50% 30%, #2d2a25 0%, #0f0e0d 60%, #080807 100%);
	}
	.viewer-bg::after {
		content: '';
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(to right, #ffffff08 1px, transparent 1px),
			linear-gradient(to bottom, #ffffff08 1px, transparent 1px);
		background-size: 80px 80px;
		mask-image: radial-gradient(ellipse at center, black 40%, transparent 75%);
	}
	.model {
		position: absolute;
		left: 50%;
		top: 54%;
		transform: translate(-50%, -50%);
		width: 46%;
		aspect-ratio: 1 / 1.15;
		display: grid;
		place-items: center;
	}
	.model svg {
		width: 100%;
		height: 100%;
		filter: drop-shadow(0 30px 40px #00000088);
	}
	.model-shadow {
		position: absolute;
		left: 50%;
		top: 88%;
		transform: translate(-50%, -50%);
		width: 42%;
		height: 6%;
		background: radial-gradient(ellipse at center, #00000099 0%, transparent 70%);
		filter: blur(6px);
	}
	.viewer-top {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 18px 22px;
		font-family: var(--ds-mono);
		font-size: 10.5px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #e9e3d3;
	}
	.viewer-top .l {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.viewer-top .l .dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--ds-vermillion);
	}
	.viewer-top .l .sep {
		opacity: 0.3;
	}
	.viewer-top .r {
		display: flex;
		gap: var(--s-5);
		opacity: 0.7;
	}
	.viewer-metadata {
		position: absolute;
		left: 22px;
		top: 60px;
		max-width: 260px;
	}
	.vm-title {
		font-family: var(--ds-sans);
		font-weight: 500;
		font-size: 22px;
		letter-spacing: -0.015em;
		line-height: 1.15;
		margin: 0 0 6px;
	}
	.vm-title em {
		font-family: var(--ds-serif);
		font-style: italic;
		font-weight: 400;
		color: #f4b5a0;
	}
	.vm-sub {
		font-family: var(--ds-serif);
		font-style: italic;
		font-size: 13.5px;
		color: #e9e3d3;
		opacity: 0.7;
		margin: 0 0 var(--s-5);
	}
	.vm-dl {
		display: grid;
		grid-template-columns: 72px 1fr;
		gap: 6px var(--s-4);
		font-family: var(--ds-mono);
		font-size: 10.5px;
		letter-spacing: 0.04em;
		color: #e9e3d3;
	}
	.vm-dl dt {
		opacity: 0.5;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.vm-dl dd {
		margin: 0;
		opacity: 0.92;
	}

	.pin {
		position: absolute;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--ds-vermillion);
		color: #fff;
		display: grid;
		place-items: center;
		font-family: var(--ds-mono);
		font-size: 10.5px;
		font-weight: 500;
		box-shadow:
			0 0 0 6px #ffffff12,
			0 0 0 1px #ffffff40;
		cursor: pointer;
	}
	.pin::before {
		content: '';
		position: absolute;
		inset: -14px;
		border-radius: 50%;
		border: 1px solid #ffffff40;
		animation: ping 2.4s ease-out infinite;
	}
	@keyframes ping {
		0% {
			transform: scale(0.5);
			opacity: 0.8;
		}
		100% {
			transform: scale(1.2);
			opacity: 0;
		}
	}
	.pin-label {
		position: absolute;
		left: 32px;
		top: -6px;
		background: #00000099;
		backdrop-filter: blur(8px);
		padding: 6px 10px;
		border-radius: 2px;
		font-family: var(--ds-mono);
		font-size: 10.5px;
		letter-spacing: 0.04em;
		color: #f4f1eb;
		white-space: nowrap;
		border: 1px solid #ffffff1a;
	}

	.viewer-toolbar {
		position: absolute;
		left: 50%;
		bottom: 22px;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 2px;
		background: #0e0d0cd9;
		backdrop-filter: blur(12px);
		border: 1px solid #ffffff1a;
		border-radius: 4px;
		padding: 4px;
	}
	.vt-btn {
		width: 36px;
		height: 32px;
		display: grid;
		place-items: center;
		color: #e9e3d3;
		border-radius: 2px;
		cursor: pointer;
	}
	.vt-btn:hover {
		background: #ffffff10;
	}
	.vt-btn.active {
		background: var(--ds-vermillion);
		color: #fff;
	}
	.vt-sep {
		width: 1px;
		height: 20px;
		background: #ffffff1a;
		margin: 0 4px;
	}
	.vt-scrub {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 var(--s-4);
		color: #e9e3d3;
		font-family: var(--ds-mono);
		font-size: 10.5px;
		letter-spacing: 0.06em;
	}
	.vt-track {
		width: 120px;
		height: 2px;
		background: #ffffff1a;
		position: relative;
		border-radius: 2px;
	}
	.vt-track::after {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 40%;
		background: var(--ds-vermillion);
		border-radius: 2px;
	}
	.vt-track::before {
		content: '';
		position: absolute;
		left: 40%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: 10px;
		height: 10px;
		background: #fff;
		border-radius: 50%;
	}

	.viewer-panel {
		position: absolute;
		right: 22px;
		top: 60px;
		bottom: 80px;
		width: 240px;
		background: #0e0d0cb3;
		backdrop-filter: blur(12px);
		border: 1px solid #ffffff14;
		border-radius: 4px;
		padding: var(--s-5);
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
		overflow: hidden;
	}
	.vp-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-family: var(--ds-mono);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #e9e3d3;
		opacity: 0.7;
	}
	.vp-ann {
		display: flex;
		flex-direction: column;
		gap: 8px;
		overflow: auto;
	}
	.vp-item {
		display: grid;
		grid-template-columns: 20px 1fr;
		gap: 10px;
		padding: 8px;
		border: 1px solid #ffffff0d;
		border-radius: 2px;
		font-family: var(--ds-sans);
		font-size: 12px;
		color: #e9e3d3;
		cursor: pointer;
	}
	.vp-item .pn {
		font-family: var(--ds-mono);
		font-size: 10.5px;
		color: var(--ds-vermillion);
	}
	.vp-item .pt {
		font-weight: 500;
		margin-bottom: 2px;
	}
	.vp-item .pd {
		font-family: var(--ds-serif);
		font-size: 11.5px;
		opacity: 0.6;
		font-style: italic;
	}
	.vp-item.active {
		border-color: var(--ds-vermillion);
		background: #ffffff08;
	}
	.vp-foot {
		margin-top: auto;
		padding-top: var(--s-4);
		border-top: 1px solid #ffffff14;
		font-family: var(--ds-mono);
		font-size: 10px;
		letter-spacing: 0.06em;
		color: #e9e3d3;
		opacity: 0.6;
		text-transform: uppercase;
		display: flex;
		justify-content: space-between;
	}

	/* ---------- COMPONENTS ---------- */
	.comp-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--s-4);
	}
	@media (max-width: 900px) {
		.comp-grid {
			grid-template-columns: 1fr;
		}
	}
	.row-wrap {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}
	.row-disabled {
		margin-top: var(--s-5);
		opacity: 0.6;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-family: var(--ds-sans);
		font-weight: 500;
		font-size: 14px;
		letter-spacing: -0.005em;
		padding: 10px 16px;
		border-radius: 2px;
		cursor: pointer;
		border: 1px solid transparent;
		background: transparent;
		transition:
			transform 0.08s ease,
			background 0.15s ease,
			border-color 0.15s ease;
	}
	.btn:active {
		transform: translateY(1px);
	}
	.btn[disabled] {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.btn-primary {
		background: var(--ds-ink);
		color: var(--ds-paper);
	}
	.btn-primary:hover {
		background: var(--ds-ink-2);
	}
	.btn-secondary {
		background: transparent;
		color: var(--ds-ink);
		border-color: var(--ds-rule-strong);
	}
	.btn-secondary:hover {
		border-color: var(--ds-ink);
	}
	.btn-ghost {
		background: transparent;
		color: var(--ds-ink-2);
	}
	.btn-ghost:hover {
		background: var(--ds-paper-2);
	}
	.btn-accent {
		background: var(--ds-vermillion);
		color: #fff;
	}
	.btn-accent:hover {
		background: var(--ds-vermillion-ink);
	}
	.btn.sm {
		padding: 8px 12px;
		font-size: 12.5px;
	}
	.btn .k {
		font-family: var(--ds-mono);
		font-size: 10.5px;
		letter-spacing: 0.06em;
		opacity: 0.55;
		padding: 2px 6px;
		border: 1px solid currentColor;
		border-radius: 2px;
		text-transform: uppercase;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--ds-mono);
		font-size: 10.5px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 4px 8px;
		border-radius: 2px;
		border: 1px solid var(--ds-rule-strong);
	}
	.badge.sm {
		font-size: 9.5px;
		padding: 2px 6px;
	}
	.badge .d {
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}
	.badge.verified {
		color: var(--ds-vermillion-ink);
		border-color: var(--ds-vermillion);
		background: var(--ds-vermillion-wash);
	}
	.badge.verified .d {
		background: var(--ds-vermillion);
	}
	.badge.draft {
		color: var(--ds-ink-3);
	}
	.badge.draft .d {
		background: var(--ds-ink-4);
	}
	.badge.open {
		color: #2f5d3a;
		border-color: #2f5d3a44;
		background: #eaf0e4;
	}
	.badge.open .d {
		background: #2f5d3a;
	}
	.badge.embargo {
		color: var(--ds-ink-2);
	}
	.badge.embargo .d {
		background: var(--ds-ink-2);
	}
	.badge.quiet {
		background: var(--ds-paper-2);
	}

	.input {
		display: block;
		width: 100%;
		font-family: var(--ds-sans);
		font-size: 14px;
		color: var(--ds-ink);
		padding: 12px 14px;
		background: var(--ds-paper-bg);
		border: 1px solid var(--ds-rule-strong);
		border-radius: 2px;
		outline: none;
		transition: border-color 0.15s;
	}
	.input:focus {
		border-color: var(--ds-ink);
	}
	.input-label {
		font-family: var(--ds-mono);
		font-size: 10.5px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ds-ink-3);
		margin-bottom: 6px;
		display: block;
	}
	.search-wrap {
		position: relative;
	}
	.search-kbd {
		position: absolute;
		right: 14px;
		top: 50%;
		transform: translateY(-50%);
		font-family: var(--ds-mono);
		font-size: 10.5px;
		color: var(--ds-ink-4);
		letter-spacing: 0.06em;
	}
	.chips {
		margin-top: var(--s-4);
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	.plate-note {
		margin-top: var(--s-5);
		font-family: var(--ds-serif);
		font-style: italic;
		font-size: 13px;
		color: var(--ds-ink-3);
	}

	.catalog-card {
		display: grid;
		grid-template-columns: 80px 1fr;
		gap: var(--s-4);
	}
	.cat-thumb {
		background: var(--ds-ink);
		aspect-ratio: 1;
		border-radius: 2px;
		display: grid;
		place-items: center;
	}
	.cat-row {
		display: flex;
		gap: 8px;
		align-items: center;
		margin-bottom: 6px;
	}
	.cat-acc {
		font-family: var(--ds-mono);
		font-size: 10.5px;
		color: var(--ds-ink-4);
		letter-spacing: 0.04em;
	}
	.cat-title {
		font-family: var(--ds-sans);
		font-weight: 500;
		font-size: 17px;
		letter-spacing: -0.01em;
		line-height: 1.2;
	}
	.cat-title em {
		font-family: var(--ds-serif);
		font-style: italic;
		font-weight: 400;
		color: var(--ds-vermillion-ink);
	}
	.cat-sub {
		font-family: var(--ds-serif);
		font-style: italic;
		font-size: 13px;
		color: var(--ds-ink-3);
		margin-top: 4px;
	}

	/* ---------- MOTION ---------- */
	.motion-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--s-4);
	}
	@media (max-width: 900px) {
		.motion-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	.m-card {
		background: var(--ds-paper-bg);
		border: 1px solid var(--ds-rule);
		border-radius: var(--r-2);
		padding: var(--s-5);
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
	}
	.m-card .head {
		display: flex;
		justify-content: space-between;
		font-family: var(--ds-mono);
		font-size: 10.5px;
		letter-spacing: 0.06em;
		color: var(--ds-ink-3);
		text-transform: uppercase;
	}
	.m-card .demo {
		aspect-ratio: 2 / 1;
		background: var(--ds-paper-2);
		border-radius: var(--r-1);
		position: relative;
		overflow: hidden;
	}
	.m-card .ball {
		position: absolute;
		top: 50%;
		left: 10%;
		transform: translateY(-50%);
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--ds-vermillion);
	}
	.m-card.m1 .ball {
		animation: slide 2.4s cubic-bezier(0.2, 0.7, 0.2, 1) infinite;
	}
	.m-card.m2 .ball {
		animation: slide 2.4s cubic-bezier(0.85, 0, 0.15, 1) infinite;
	}
	.m-card.m3 .ball {
		animation: slide 2.4s cubic-bezier(0.5, 1.6, 0.4, 1) infinite;
	}
	.m-card.m4 .ball {
		animation: slide 2.4s linear infinite;
	}
	@keyframes slide {
		0% {
			left: 10%;
		}
		50% {
			left: calc(90% - 18px);
		}
		100% {
			left: 10%;
		}
	}
	.m-card .name {
		font-family: var(--ds-sans);
		font-weight: 500;
		font-size: 14px;
	}
	.m-card .desc {
		font-family: var(--ds-serif);
		font-size: 13px;
		color: var(--ds-ink-3);
		font-style: italic;
		line-height: 1.4;
		margin: 0;
	}

	/* ---------- FOOTER ---------- */
	footer {
		padding: var(--s-9) 0 var(--s-8);
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--s-6);
		border-top: 1px solid var(--ds-rule);
	}
	@media (max-width: 900px) {
		footer {
			grid-template-columns: 1fr;
		}
	}
	.foot-mark {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: var(--s-5);
		color: var(--ds-ink);
	}
	.foot-mark span {
		font-family: var(--ds-sans);
		font-weight: 600;
		letter-spacing: -0.01em;
		font-size: 15px;
	}
	.colophon {
		font-family: var(--ds-serif);
		font-size: 16px;
		line-height: 1.5;
		color: var(--ds-ink-2);
		max-width: 50ch;
		text-wrap: pretty;
	}
	.colophon em {
		font-style: italic;
		color: var(--ds-vermillion-ink);
	}
	footer .meta {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--s-5);
	}
	footer .meta dt {
		font-family: var(--ds-mono);
		font-size: 10.5px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ds-ink-4);
		margin-bottom: 4px;
	}
	footer .meta dd {
		font-family: var(--ds-mono);
		font-size: 12px;
		color: var(--ds-ink-2);
		margin: 0 0 var(--s-3);
	}

	/* ---------- HR-LIKE RULE ---------- */
	.labeled-rule {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: var(--s-4);
		margin: var(--s-7) 0 var(--s-5);
	}
	.labeled-rule .lbl {
		font-family: var(--ds-mono);
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ds-ink-4);
	}
	.labeled-rule .rl {
		height: 1px;
		background: var(--ds-rule);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-5);
		margin-top: var(--s-5);
		font-family: var(--ds-mono);
		font-size: 11px;
		letter-spacing: 0.05em;
		color: var(--ds-ink-3);
	}
	.legend.mt-6 {
		margin-top: var(--s-6);
	}
	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.legend i {
		width: 10px;
		height: 10px;
		border-radius: 2px;
		display: inline-block;
		font-style: normal;
	}
	.i-wash {
		background: var(--ds-vermillion-wash);
		border: 1px dashed var(--ds-vermillion);
	}
	.i-ink {
		background: var(--ds-ink);
	}
	.i-vermillion {
		background: var(--ds-vermillion);
	}
	.i-italic-swatch {
		background: #f4b5a0;
		border: 1px solid #3f331f;
	}
	.i-chrome {
		background: #e9e3d3;
	}
	.i-dot-vermillion {
		background: var(--ds-vermillion);
		border-radius: 50% !important;
		width: 8px !important;
		height: 8px !important;
	}
	.i-dot-ink {
		background: var(--ds-ink-4);
		border-radius: 50% !important;
		width: 8px !important;
		height: 8px !important;
	}

	/* ---------- COLLECTIONS ---------- */
	.coll-header {
		display: grid;
		grid-template-columns: 1fr 320px;
		gap: var(--s-7);
		align-items: end;
		padding-bottom: var(--s-6);
		border-bottom: 1px solid var(--ds-rule);
		margin-bottom: var(--s-6);
	}
	@media (max-width: 900px) {
		.coll-header {
			grid-template-columns: 1fr;
		}
	}
	.coll-kicker {
		font-family: var(--ds-mono);
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ds-ink-4);
		margin-bottom: var(--s-3);
	}
	.coll-h {
		font-family: var(--ds-sans);
		font-weight: 500;
		font-size: 56px;
		letter-spacing: -0.03em;
		line-height: 1;
		margin: 0 0 var(--s-4);
	}
	.coll-h em {
		font-family: var(--ds-serif);
		font-style: italic;
		font-weight: 400;
		color: var(--ds-vermillion-ink);
	}
	.coll-lede {
		font-family: var(--ds-serif);
		font-size: 20px;
		line-height: 1.45;
		color: var(--ds-ink-2);
		max-width: 50ch;
		margin: 0;
	}
	.coll-stats {
		margin: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--s-4) var(--s-5);
		padding: var(--s-5);
		background: var(--ds-paper-bg);
		border: 1px solid var(--ds-rule);
		border-radius: 2px;
	}
	.coll-stats dt {
		font-family: var(--ds-mono);
		font-size: 10.5px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ds-ink-4);
		margin-bottom: 2px;
	}
	.coll-stats dd {
		margin: 0;
		font-family: var(--ds-sans);
		font-weight: 500;
		font-size: 22px;
	}
	.coll-stats dd.accented {
		color: var(--ds-vermillion-ink);
	}
	.coll-stats dd.mono {
		font-family: var(--ds-mono);
		font-size: 13px;
	}

	.coll-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		grid-auto-rows: 260px;
		gap: var(--s-4);
	}
	@media (max-width: 900px) {
		.coll-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (max-width: 500px) {
		.coll-grid {
			grid-template-columns: 1fr;
		}
	}
	.coll-card {
		border: 1px solid var(--ds-rule);
		border-radius: 2px;
		background: var(--ds-paper-bg);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		position: relative;
		transition:
			border-color 0.2s ease,
			transform 0.2s ease;
	}
	.coll-card:hover {
		border-color: var(--ds-ink-3);
	}
	.coll-card.feature {
		grid-column: span 2;
		grid-row: span 2;
		background: var(--ds-ink);
		color: var(--ds-paper);
		border-color: var(--ds-ink);
	}
	.coll-img {
		flex: 1;
		display: grid;
		place-items: center;
		position: relative;
		background: #0f0e0d;
	}
	.coll-card:not(.feature) .coll-img {
		background: var(--ds-paper-3);
	}
	.coll-img.dim {
		background: var(--ds-paper-3);
	}
	.coll-card.feature .coll-img {
		background: radial-gradient(ellipse at 50% 35%, #2d2a25 0%, #0f0e0d 70%);
	}
	.coll-tag {
		position: absolute;
		top: 12px;
		left: 12px;
		font-family: var(--ds-mono);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #e9e3d3;
		opacity: 0.7;
	}
	.coll-meta {
		padding: var(--s-4);
		display: flex;
		flex-direction: column;
		gap: 4px;
		border-top: 1px solid var(--ds-rule);
	}
	.coll-card.feature .coll-meta {
		border-top-color: #ffffff1a;
	}
	.coll-title {
		font-family: var(--ds-sans);
		font-weight: 500;
		font-size: 15px;
		letter-spacing: -0.01em;
		line-height: 1.2;
	}
	.coll-card.feature .coll-title {
		font-size: 22px;
	}
	.coll-title em {
		font-family: var(--ds-serif);
		font-style: italic;
		font-weight: 400;
		color: var(--ds-vermillion-ink);
	}
	.coll-card.feature .coll-title em {
		color: #f4b5a0;
	}
	.coll-sub {
		font-family: var(--ds-serif);
		font-style: italic;
		font-size: 12.5px;
		color: var(--ds-ink-3);
	}
	.coll-card.feature .coll-sub {
		color: #e9e3d3;
		opacity: 0.7;
	}
	.read-essay {
		color: var(--ds-vermillion-ink);
	}
	.coll-card.feature .read-essay {
		color: #f4b5a0;
	}

	/* collection index */
	.coll-index {
		border-top: 1px solid var(--ds-rule);
	}
	.ci-row {
		display: grid;
		grid-template-columns: 56px 1fr auto auto 40px;
		gap: var(--s-5);
		align-items: center;
		padding: var(--s-5) 0;
		border-bottom: 1px solid var(--ds-rule);
		cursor: pointer;
		transition: background 0.15s ease;
	}
	.ci-row:hover {
		background: var(--ds-paper-2);
		padding-left: var(--s-3);
		padding-right: var(--s-3);
	}
	.ci-num {
		font-family: var(--ds-mono);
		font-size: 11px;
		color: var(--ds-ink-4);
		letter-spacing: 0.06em;
	}
	.ci-title {
		font-family: var(--ds-sans);
		font-weight: 500;
		font-size: 26px;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}
	.ci-title em {
		font-family: var(--ds-serif);
		font-style: italic;
		font-weight: 400;
		color: var(--ds-vermillion-ink);
	}
	.ci-curator {
		font-family: var(--ds-serif);
		font-style: italic;
		font-size: 13px;
		color: var(--ds-ink-3);
		margin-top: 2px;
	}
	.ci-count,
	.ci-span {
		font-family: var(--ds-mono);
		font-size: 11.5px;
		color: var(--ds-ink-3);
		letter-spacing: 0.04em;
	}
	.ci-cta {
		font-family: var(--ds-sans);
		font-size: 22px;
		color: var(--ds-ink-4);
		text-align: right;
	}
	.ci-row:hover .ci-cta {
		color: var(--ds-vermillion);
	}

	/* ---------- EDITIONS ---------- */
	.ed-wrap {
		display: grid;
		grid-template-columns: 1.3fr 1fr;
		gap: var(--s-7);
	}
	@media (max-width: 900px) {
		.ed-wrap {
			grid-template-columns: 1fr;
		}
	}
	.ed-plate {
		padding: 0;
		overflow: hidden;
	}
	.plate-label-head {
		padding: var(--s-5) var(--s-6) 0;
		margin-bottom: 0;
	}
	.edition {
		display: grid;
		grid-template-columns: 32px 1fr;
		gap: var(--s-4);
		padding: var(--s-5) var(--s-6);
		border-top: 1px solid var(--ds-rule);
		position: relative;
	}
	.ed-rail {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding-top: 6px;
	}
	.ed-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--ds-ink-4);
		box-shadow: 0 0 0 4px var(--ds-paper-bg);
		z-index: 1;
	}
	.ed-dot.current {
		background: var(--ds-vermillion);
		box-shadow:
			0 0 0 4px var(--ds-paper-bg),
			0 0 0 6px var(--ds-vermillion-wash);
	}
	.ed-line {
		width: 1px;
		flex: 1;
		background: var(--ds-rule-strong);
		margin-top: 2px;
	}
	.ed-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 4px;
		flex-wrap: wrap;
		gap: 4px 10px;
	}
	.ed-num {
		font-family: var(--ds-mono);
		font-size: 12px;
		letter-spacing: 0.06em;
		color: var(--ds-ink);
		text-transform: uppercase;
		font-weight: 500;
	}
	.ed-label {
		font-family: var(--ds-mono);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ds-ink-4);
		margin-left: 10px;
	}
	.ed-label.current-tag {
		color: var(--ds-vermillion-ink);
		border: 1px solid var(--ds-vermillion);
		padding: 1px 5px;
		border-radius: 2px;
		background: var(--ds-vermillion-wash);
	}
	.ed-date {
		font-family: var(--ds-mono);
		font-size: 11px;
		color: var(--ds-ink-4);
		letter-spacing: 0.04em;
	}
	.ed-title {
		font-family: var(--ds-sans);
		font-weight: 500;
		font-size: 17px;
		letter-spacing: -0.01em;
		margin-bottom: 4px;
	}
	.ed-meta {
		font-family: var(--ds-mono);
		font-size: 10.5px;
		color: var(--ds-ink-3);
		letter-spacing: 0.04em;
		margin-bottom: 6px;
	}
	.ed-note {
		font-family: var(--ds-serif);
		font-style: italic;
		font-size: 13.5px;
		color: var(--ds-ink-2);
		line-height: 1.5;
	}
	.ed-side {
		display: flex;
		flex-direction: column;
		gap: var(--s-5);
	}

	.ed-chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		vertical-align: baseline;
		font-family: var(--ds-mono);
		font-size: 10.5px;
		letter-spacing: 0.06em;
		padding: 1px 5px;
		border: 1px solid var(--ds-vermillion);
		border-radius: 2px;
		color: var(--ds-vermillion-ink);
		background: var(--ds-vermillion-wash);
		text-transform: uppercase;
		font-style: normal;
	}
	.ed-chip-n {
		font-weight: 500;
	}
	.ed-chip-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--ds-vermillion);
	}
	.cite-body {
		font-family: var(--ds-serif);
		font-size: 14.5px;
		line-height: 1.55;
		color: var(--ds-ink-2);
		padding-bottom: var(--s-4);
		border-bottom: 1px solid var(--ds-rule);
	}
	.cite-body em {
		font-style: italic;
	}
	.cite-actions {
		display: flex;
		gap: 8px;
		margin-top: var(--s-4);
	}
	.chip-body {
		font-family: var(--ds-serif);
		font-size: 15.5px;
		line-height: 1.55;
		color: var(--ds-ink-2);
	}
	.diff {
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-family: var(--ds-mono);
		font-size: 11.5px;
		letter-spacing: 0.02em;
	}
	.diff-row {
		display: grid;
		grid-template-columns: 14px 1fr;
		gap: 10px;
	}
	.diff-row .serif {
		color: var(--ds-ink-2);
		font-family: var(--ds-serif);
		font-style: italic;
		font-size: 13.5px;
	}
	.diff-row.add {
		color: #2f5d3a;
	}
	.diff-row.mod {
		color: var(--ds-vermillion-ink);
	}
	.diff-row.del {
		color: var(--ds-ink-4);
	}

	/* ---------- TWEAKS PANEL ---------- */
	.tweaks {
		position: fixed;
		right: 20px;
		bottom: 20px;
		z-index: 100;
		width: 300px;
		background: var(--ds-paper-bg);
		border: 1px solid var(--ds-rule-strong);
		border-radius: 4px;
		box-shadow: var(--shadow-2);
		font-family: var(--ds-sans);
		display: none;
		overflow: hidden;
	}
	.tweaks.open {
		display: block;
	}
	.tw-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		border-bottom: 1px solid var(--ds-rule);
		font-family: var(--ds-mono);
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ds-ink-3);
		background: var(--ds-paper);
	}
	.tw-head b {
		color: var(--ds-ink);
		font-weight: 500;
	}
	.tw-body {
		padding: 12px 16px 16px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		max-height: 70vh;
		overflow: auto;
	}
	.tw-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.tw-lbl {
		font-family: var(--ds-mono);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ds-ink-4);
		display: flex;
		justify-content: space-between;
	}
	.tw-lbl b {
		color: var(--ds-ink);
		font-weight: 500;
	}
	.tw-swatches {
		display: flex;
		gap: 6px;
	}
	.tw-sw {
		width: 26px;
		height: 26px;
		border-radius: 2px;
		cursor: pointer;
		border: 1px solid var(--ds-rule-strong);
	}
	.tw-sw.active {
		outline: 2px solid var(--ds-ink);
		outline-offset: 2px;
	}
	.tw-seg {
		display: flex;
		border: 1px solid var(--ds-rule-strong);
		border-radius: 2px;
		overflow: hidden;
	}
	.tw-seg button {
		flex: 1;
		background: var(--ds-paper-bg);
		border: none;
		padding: 7px 8px;
		cursor: pointer;
		font-family: var(--ds-mono);
		font-size: 10.5px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ds-ink-3);
		border-right: 1px solid var(--ds-rule-strong);
	}
	.tw-seg button:last-child {
		border-right: none;
	}
	.tw-seg button.active {
		background: var(--ds-ink);
		color: var(--ds-paper);
	}
	.tw-input {
		font-family: var(--ds-sans);
		font-size: 13px;
		color: var(--ds-ink);
		padding: 8px 10px;
		background: #fff;
		border: 1px solid var(--ds-rule-strong);
		border-radius: 2px;
		outline: none;
		width: 100%;
	}
	.tw-input:focus {
		border-color: var(--ds-ink);
	}

	.ds-root ::selection {
		background: var(--ds-vermillion);
		color: #fff;
	}
</style>
