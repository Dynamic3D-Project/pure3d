# Pure3D Features

## 3D Viewer (Voyager Integration)

- [x] Smithsonian Voyager Explorer integration
- [x] Direct embedding mode with full API control
- [x] Iframe mode for cross-origin content
- [x] Camera orbit and offset controls via API
- [x] Toggle annotations, reader, tours, tools programmatically
- [x] Measurement tool support
- [x] Multi-language support (8 languages)
- [x] Background style/color customization
- [x] Model loading progress bar with byte tracking
- [x] Full window/expand mode for immersive viewing
- [x] Configurable height and aspect ratio
- [x] Option to show/hide Voyager's built-in menu
- [x] Custom floating control buttons (annotations, reader, tours, tools)
- [x] Reset camera functionality
- [x] AR mode support
- [ ] Next/previous navigation between editions
- [ ] Edition comparison view (side-by-side)
- [ ] Keyboard shortcuts for viewer navigation

## Navigation & Layout

- [x] Sticky frosted glass navigation header
- [x] Responsive mobile/desktop layout
- [x] Mobile hamburger menu
- [x] Active route highlighting in navigation
- [x] SvelteKit prefetching on link hover
- [x] Breadcrumb navigation on edition pages
- [x] Collapsible sidebar on edition detail page

## Search

- [x] Global search across editions and collections
- [x] Real-time search with debouncing
- [x] Floating-ui powered dropdown positioning
- [x] Keyboard navigation (arrows, enter, escape)
- [x] Grouped results by type (editions, collections)
- [x] Thumbnail previews in search results

## Theming & Styling

- [x] Dark/light theme toggle
- [x] DaisyUI component library integration
- [x] TailwindCSS 4 styling
- [x] Consistent frosted glass effects

## Content Display

- [x] Edition cards with thumbnails
- [x] Collection cards with edition counts
- [x] Home page featured editions carousel
- [x] Projects/collections grid section
- [x] Statistics display (edition/collection counts)
- [x] Tabbed content panel (description, metadata, peer review, printables)
- [x] Peer review badge and content display
- [x] Tags display on edition pages
- [x] View presets with description links (`[[view:name|text]]` syntax)

## Data Management

- [x] PocketBase backend integration
- [x] Persisted stores with localStorage caching
- [x] Stale-while-revalidate data fetching pattern
- [x] Dublin Core metadata support
- [x] Image preloading during browser idle time
- [x] Edition/collection thumbnail fallbacks

## Authentication

- [x] Login button with modal
- [x] Email/password login form
- [x] Google OAuth login
- [x] Magic link authentication
- [x] User registration form
- [x] Logout functionality
- [x] Profile page
- [x] Profile picture display
- [ ] Password reset flow
- [ ] Email verification

## UX Enhancements

- [x] Toast notifications (svelte-french-toast)
- [x] Loading skeletons for content
- [x] Smooth scroll carousel with arrow buttons
- [x] Help modal with video embed support
- [x] Escape key to exit full window mode
- [x] Voyager background gradient during loading
- [ ] Scrollbar layout shift fix (in progress)

## SEO & Analytics

- [x] SEO component with meta tags
- [x] Page titles per route
- [x] Analytics component (Plausible/Umami ready)
- [x] Preconnect hints for external resources

## Infrastructure

- [x] Docker Compose setup
- [x] SvelteKit 2 + Svelte 5 framework
- [x] Bun runtime support
- [x] Environment variable configuration
- [x] Static asset serving from `/static`
- [x] CDN-ready asset URL configuration
- [x] Auto-migration on first run
- [ ] Production deployment documentation

## Developer Experience

- [x] TypeScript strict mode
- [x] Dev environment banner
- [x] Debug overlay component
- [x] Voyager API demo page (dev only)
- [x] Test voyager page
- [ ] Unit tests
- [ ] E2E tests

## Planned Features

- [ ] Blog/news section (routes exist, content pending)
- [ ] About page content
- [ ] Feedback submission system
- [ ] Filter sidebar for editions/collections
- [ ] Printables/downloads section
- [ ] Deep linking to specific scenes/annotations
- [ ] Social sharing functionality
- [ ] Internationalization (i18n) - Paraglide setup exists
