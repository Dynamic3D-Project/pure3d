# Feature Request: Runtime Lighting and Rendering Controls in Explorer API

## Summary
Add runtime API methods to control scene lighting and rendering parameters in Voyager Explorer, enabling developers to dynamically adjust visual presentation without modifying document files.

## Use Cases

**1. Educational Applications**
- Demonstrate how lighting affects artifact appearance
- Show objects under different lighting conditions (museum lighting vs. natural light)
- Interactive learning modules about materials and illumination

**2. Accessibility**
- Adjust brightness/contrast for users with visual impairments
- Provide high-contrast modes for better visibility
- Customize visual presentation per user preferences

**3. Comparative Analysis**
- Standardize lighting across multiple artifacts for accurate comparison
- Toggle between different lighting setups dynamically
- A/B testing of presentation styles

**4. Dynamic Presentations**
- Create guided tours with lighting that changes per stop
- Dramatic reveals by adjusting exposure
- Storytelling through visual atmosphere changes

**5. Integration Flexibility**
- Match 3D viewer lighting to surrounding web application theme
- Synchronize with external controls (sliders, presets)
- Real-time adjustments during live presentations

## Current Limitation

Lighting and rendering parameters can only be configured in `document.json` during authoring:

```json
{
  "viewer": {
    "shader": "Default",
    "exposure": 1.0,
    "gamma": 2.0,
    "annotationsVisible": true
  }
}
```

There is **no way to modify these at runtime** through the API, limiting dynamic control and requiring separate document files for different lighting scenarios.

## Proposed API Methods

Following the existing API patterns (e.g., `setBackgroundColor()`, `setCameraOrbit()`):

### Lighting Controls
```typescript
/**
 * Sets the scene exposure (brightness)
 * @param value - Exposure multiplier (0.1 - 5.0, default: 1.0)
 */
setExposure(value: number): void

/**
 * Gets the current scene exposure
 * @returns Current exposure value
 */
getExposure(): number

/**
 * Sets gamma correction
 * @param value - Gamma value (1.0 - 3.0, default: 2.2)
 */
setGamma(value: number): void

/**
 * Gets the current gamma correction
 * @returns Current gamma value
 */
getGamma(): number
```

### Shader Controls
```typescript
/**
 * Sets the rendering shader mode
 * @param mode - Shader mode: "Default" | "Clay" | "Normals" | "XRay"
 */
setShaderMode(mode: string): void

/**
 * Gets the current shader mode
 * @returns Current shader mode
 */
getShaderMode(): string
```

### Shadow Controls
```typescript
/**
 * Toggles shadow rendering
 * @param enabled - Enable/disable shadows
 */
setShadows(enabled: boolean): void

/**
 * Gets shadow state
 * @returns Whether shadows are enabled
 */
getShadows(): boolean
```

### Optional: Advanced Controls
```typescript
/**
 * Sets environment map for image-based lighting
 * @param url - URL to environment map image (HDR/LDR)
 */
setEnvironmentMap(url: string): void

/**
 * Toggles wireframe rendering
 */
toggleWireframe(): void
```

## Implementation Notes

**Architecture:**
- Methods would be added to `ExplorerApplication.ts` (public API)
- Connect to existing `CVViewer` component properties
- Mirror document schema structure for consistency
- Emit events on changes (e.g., `lighting-changed`)

**Backward Compatibility:**
- Document-defined settings remain default values
- API changes override document values temporarily
- No breaking changes to existing documents

**Validation:**
- Clamp values to safe ranges
- Provide sensible defaults
- Handle invalid inputs gracefully

**Documentation:**
- Update API reference
- Add interactive examples
- Include in official demos

## Example Usage

```javascript
// Get the voyager element
const voyager = document.querySelector('voyager-explorer');

// Adjust lighting for presentation
voyager.setExposure(1.5);  // Brighter
voyager.setGamma(2.4);     // Adjust midtones

// Show technical view
voyager.setShaderMode('Normals');  // Visualize surface normals

// Create dramatic effect
voyager.setExposure(0.3);  // Dark
voyager.setShadows(true);  // Strong shadows

// Reset to defaults
voyager.setExposure(1.0);
voyager.setGamma(2.2);
```

## Benefits

✅ **Enhanced Developer Experience** - Full control over visual presentation
✅ **Improved Accessibility** - Users can customize to their needs
✅ **Educational Value** - Demonstrate lighting concepts interactively
✅ **Consistency** - Match existing API patterns (get/set pairs)
✅ **No Breaking Changes** - Fully backward compatible
✅ **Reduced Document Complexity** - One document, multiple presentations

## Alternative Considered

**Status Quo:** Create multiple document files with different lighting settings
- ❌ Multiplies storage requirements
- ❌ Complicates asset management
- ❌ No smooth transitions between states
- ❌ Poor user experience

## Questions for Maintainers

1. Does this align with Smithsonian's strategic goals for Voyager?
2. Are there existing plans for runtime rendering controls?
3. Would you prefer a gradual rollout (exposure/gamma first) or comprehensive implementation?
4. Should these controls be available in both Explorer and Story applications?

## Willingness to Contribute

I'm willing to implement this feature and submit a PR if it aligns with the project's direction. Happy to discuss implementation approach and scope.

---

**Environment:**
- Voyager Version: 0.56.1
- Use Case: Interactive museum exhibitions and educational web applications

---

**To Submit:**
1. Go to: https://github.com/Smithsonian/dpo-voyager/issues/new
2. Title: `Feature Request: Runtime Lighting and Rendering Controls in Explorer API`
3. Copy/paste this content
4. Add label: `enhancement` (if available)
