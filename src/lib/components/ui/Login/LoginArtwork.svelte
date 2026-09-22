<script lang="ts">
	import { onMount } from 'svelte';
	import Logo from '$lib/assets/icons/Logo.svelte';

	let canvas: HTMLCanvasElement;
	let paused = $state(false);
	let synchronize = () => {};

	onMount(() => {
		const context = canvas.getContext('2d');
		if (!context) return;
		const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
		const desktop = matchMedia('(min-width: 768px)');
		let frame = 0;
		let phase = 0;
		let lastTime = 0;
		let width = 0;
		let height = 0;

		// ponytail: project a small 3D point field onto canvas; no WebGL dependency needed.
		function draw() {
			if (!context) return;
			context.clearRect(0, 0, width, height);
			const scale = Math.min(width / 2.8, height / 3.9);
			const points = [];
			for (let row = 0; row <= 180; row++) {
				const u = row / 180;
				const angle = u * Math.PI * 3.4 + phase;
				for (let column = 0; column <= 24; column++) {
					const v = column / 24 - 0.5;
					const radius = 0.72 + v * 0.7;
					const x = Math.sin(angle) * radius;
					const z = Math.cos(angle) * radius;
					const y = (u - 0.5) * 3.25 + Math.sin(angle + 0.8) * v * 0.42;
					const perspective = 3.8 / (3.8 - z);
					points.push({
						x: width / 2 + (x + y * 0.12) * scale * perspective,
						y: height / 2 + y * scale * perspective,
						z,
						size: (0.6 + perspective * 0.35) * Math.sin(Math.PI * u) ** 0.3,
						light: (z + 1.1) / 2.2,
						edge: column === 0 || column === 24
					});
				}
			}
			points.sort((a, b) => a.z - b.z);
			for (const point of points) {
				context.fillStyle = `hsla(${18 + point.light * 12}, ${point.edge ? 65 : 58}%, ${30 + point.light * 43 + (point.edge ? 12 : 0)}%, ${0.25 + point.light * 0.75})`;
				context.beginPath();
				context.arc(point.x, point.y, point.size, 0, Math.PI * 2);
				context.fill();
			}
		}

		function animate(time: number) {
			if (time - lastTime >= 1000 / 30) {
				phase += Math.min(time - lastTime, 50) * 0.00018;
				lastTime = time;
				draw();
			}
			frame = requestAnimationFrame(animate);
		}

		synchronize = () => {
			cancelAnimationFrame(frame);
			const rect = canvas.getBoundingClientRect();
			width = rect.width;
			height = rect.height;
			const ratio = Math.min(devicePixelRatio, 2);
			canvas.width = Math.round(width * ratio);
			canvas.height = Math.round(height * ratio);
			context.setTransform(ratio, 0, 0, ratio, 0, 0);
			if (!desktop.matches || document.hidden) return;
			draw();
			if (!paused && !reducedMotion.matches) {
				lastTime = performance.now();
				frame = requestAnimationFrame(animate);
			}
		};
		const resize = new ResizeObserver(synchronize);
		resize.observe(canvas);
		reducedMotion.addEventListener('change', synchronize);
		desktop.addEventListener('change', synchronize);
		document.addEventListener('visibilitychange', synchronize);
		return () => {
			cancelAnimationFrame(frame);
			resize.disconnect();
			reducedMotion.removeEventListener('change', synchronize);
			desktop.removeEventListener('change', synchronize);
			document.removeEventListener('visibilitychange', synchronize);
		};
	});
</script>

<div id="login-artwork">
	<canvas bind:this={canvas} aria-hidden="true"></canvas>
	<div class="brand"><Logo /></div>
	<div class="caption">
		<p>Research in<br /><em>every dimension.</em></p>
	</div>
	<button
		type="button"
		class="motion-control"
		aria-label={paused ? 'Play ribbon animation' : 'Pause ribbon animation'}
		aria-pressed={paused}
		onclick={() => {
			paused = !paused;
			synchronize();
		}}>{paused ? '▶' : 'Ⅱ'}</button
	>
</div>

<style>
	#login-artwork {
		position: absolute;
		inset: 0;
		overflow: hidden;
		color: #f4f1e9;
		background: radial-gradient(ellipse at 55% 45%, #3a231c 0%, #1e1c19 48%, #141412 100%);
	}
	canvas {
		position: absolute;
		top: 65px;
		width: 100%;
		height: calc(100% - 175px);
		display: block;
	}
	.brand {
		position: absolute;
		top: 28px;
		left: 28px;
		--color-ink: #f4f1e9;
	}
	.caption {
		position: absolute;
		bottom: 28px;
		left: 28px;
	}
	.caption p {
		color: #f4f1e9;
		font-family: 'Crimson Pro', Georgia, serif;
		font-size: 29px;
		line-height: 1.05;
	}
	.caption em {
		color: #dba483;
	}
	.motion-control {
		position: absolute;
		right: 16px;
		bottom: 16px;
		width: 36px;
		height: 36px;
		border: 1px solid #f4f1e926;
		border-radius: 50%;
		color: #dba483;
		font-size: 11px;
		cursor: pointer;
	}
	.motion-control:hover {
		background: #f4f1e910;
	}
	.motion-control:focus-visible {
		outline: 2px solid #dba483;
		outline-offset: 3px;
	}
	@media (prefers-reduced-motion: reduce) {
		.motion-control {
			display: none;
		}
	}
</style>
