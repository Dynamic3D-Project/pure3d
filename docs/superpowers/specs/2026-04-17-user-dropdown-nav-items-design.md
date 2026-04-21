# User Dropdown Navigation Items

## Goal

Declutter the top navigation by moving role-gated items (`My Work`, `Admin`) out of the desktop header and into the user avatar dropdown in `LoginButton.svelte`.

## Scope

**In scope**

- `src/lib/components/ui/Header.svelte` — remove `My Work` and `Admin` links from the desktop nav (`sm:flex` block).
- `src/lib/components/ui/Login/LoginButton.svelte` — add `My Work` and `Admin` menu items inside the existing authenticated dropdown, above `Profile`, separated by the existing divider pattern.

**Out of scope**

- `Demo` link stays in the header (it is dev-only and must remain accessible to logged-out developers).
- Top-level public links (`Collections`, `Editions`, `Documentation`, `About`) stay in the header.
- Mobile `SideMenu.svelte` — currently a placeholder (`Content here`), not touched by this change.

## Behavior

### My Work

- Shown in the dropdown whenever the user is authenticated (the dropdown itself only opens for authenticated users, so no extra guard needed beyond the existing `{#if authStore.isAuthenticated}` wrapper around the dropdown).
- Links to `{base}/reviews`.

### Admin

- Shown in the dropdown only when `authStore.globalRole === GlobalRole.Admin`.
- Links to `{base}/admin`.

### Active state

- The header's `btn-active` treatment is dropped when moving into the dropdown. `menu-active` or equivalent daisyUI styling on the `<li>` can be used if active highlighting is desired; otherwise the dropdown list items render plainly.

## Dropdown order

1. Email header (unchanged)
2. Divider (unchanged)
3. **My Work** (new, authenticated users)
4. **Admin** (new, Admin role only)
5. Divider (new, only if any of the above rendered)
6. Profile (unchanged)
7. Divider (unchanged)
8. Logout (unchanged)

## Icons

Use simple inline SVGs in the existing style (size-5, stroke currentColor), matching the Profile/Logout items already in the dropdown.

## Non-goals

- No changes to permissions logic or routes.
- No refactor of the dropdown into a separate component.
- No mobile menu changes.
