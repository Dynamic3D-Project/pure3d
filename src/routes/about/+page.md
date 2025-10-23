# About This Project

This is a **SvelteKit** application with **PocketBase** as the backend, now enhanced with **MDsveX** for markdown-powered pages!

## Features

- 🚀 SvelteKit 5 with Svelte Runes
- 🗄️ PocketBase for backend and authentication
- 🎨 DaisyUI + Tailwind CSS for styling
- 📝 MDsveX for markdown content
- ✅ Todo management with real-time updates
- 📰 Blog posts system

## What is MDsveX?

MDsveX allows you to write Svelte components inside markdown files. You can use:

- Standard markdown syntax
- Frontmatter for metadata
- Svelte components inline

<div class="alert alert-info mt-6">
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
  </svg>
  <span>This page is written in Markdown! Check out <code>src/routes/about/+page.md</code></span>
</div>

## Navigation

<div class="flex gap-4 mt-6">
  <a href="/" class="btn btn-primary">Home (Todos)</a>
  <a href="/blog" class="btn btn-secondary">Blog</a>
</div>
