## Component ID Convention

Every Svelte component **must** have an `id` attribute on its root HTML element, using kebab-case derived from the component filename. This makes components identifiable in the DOM for debugging, testing, and programmatic access.

- `ProfileCard.svelte` → `<div id="profile-card">`
- `HearingTest.svelte` → `<div id="hearing-test">`
- `CreateProfileModal.svelte` → `<div id="create-profile-modal">`

If a component has multiple root elements (fragment), wrap them in a `<div id="component-name">...</div>`.