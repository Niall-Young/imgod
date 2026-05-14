---
name: imgod
description: Convert UI screenshots into Figma-pasteable design captures by reconstructing the screenshot as a high-fidelity interactive HTML page, generating missing raster assets when needed, running Figma Code to Canvas capture, and returning copyable content for Figma. Use when the user provides a UI screenshot and asks to turn it into a Figma design, convert a screenshot to Figma, recreate UI for Figma, generate HTML-to-Figma paste content, or restore a screenshot as editable Figma layers.
---

# imgod

## Overview

Use this skill to turn a user-provided UI screenshot into an editable Figma design through a local HTML reconstruction and Figma Code to Canvas capture. Do not directly create or modify Figma files; deliver the capture through an HTML clipboard write or a paste helper page so Figma receives `text/html`, not plain text.

For detailed reconstruction standards, read `references/reconstruction-rules.md` before implementing the HTML.

## Required Workflow

1. Inspect the input screenshot and write a short implementation inventory: canvas size, layout grid, component hierarchy, text content, colors, typography, spacing, imagery, icons, and visible interaction affordances.
2. Build a single standalone HTML file that visually recreates the screenshot. Prefer inline CSS and minimal vanilla JavaScript unless the user explicitly asks for another stack.
3. Implement components as interactive UI, not static pixels. Include default, hover, active/click, focus where relevant, and disabled states for buttons, inputs, tabs, cards, nav items, toggles, menus, and other controls.
4. Use Hugeicons as the default icon source. Choose the closest matching Hugeicons SVG/icon for every icon-like glyph. Embed each icon as a complete inline SVG with its own `viewBox` and `<path>`/`<circle>`/`<rect>` nodes. Do not use SVG sprites (`<symbol>`/`<use>`), icon fonts, external icon scripts, or CDN-only references because Figma capture can import them as empty boxes.
5. For missing raster assets, generate or derive images rather than using blank placeholders:
   - Assume the user only provided the screenshot. Do not fetch the original website/app assets, inspect the live product, or rely on external brand files unless the user explicitly provides a URL/source asset or asks you to use external sources.
   - Treat logos, brand marks, customer marks, badges, mascots, illustrations, photos, and product shots as image assets, not DOM text or CSS-only approximations.
   - For logos/brand marks, create separate image files and insert them with `<img>`. Prefer a crop/cutout from the supplied screenshot when available; otherwise generate or rasterize a logo-like image asset that visually matches the screenshot.
   - Do not substitute brand marks, mascots, illustrations, thumbnails, product images, or brand-specific pictorial icons with rough hand-authored SVG. If a supplied/extracted source is SVG but contains embedded fonts/text or complex illustration, rasterize it to PNG/WebP before capture so Figma imports it as a faithful image asset instead of decomposed low-quality vectors or editable text.
   - Use image generation for mascots, IP characters, illustrations, banners, thumbnails, product imagery, or visual art that is present in the screenshot but not supplied as a cutout.
   - Keep mascots/IP as separate transparent-background assets and preserve the screenshot's pose, action, expression, proportions, and style as closely as possible.
6. Render the HTML in a browser, compare it against the screenshot, and revise until the layout, density, component treatment, and visual hierarchy are acceptably close.
7. Run the capture script from `assets/capture-for-design.js` in the page context after the HTML is loaded.
8. Deliver the result as Figma-pasteable HTML:
   - Save the captured `text/html` payload as `figma-capture.txt` beside the HTML for traceability.
   - Write that payload to the system clipboard as HTML before the final response when the environment allows it.
   - If direct clipboard writing is unavailable, create or copy an HTTP-served paste helper page that writes the payload with `ClipboardItem({"text/html": ...})`.
   - Always include a concrete copy route in the final response: either "the `text/html` payload is already on your clipboard; paste into Figma now" or a full `http://127.0.0.1:.../figma-paste-helper.html` URL with a button that copies the payload as `text/html`.
   - Never tell the user to open `figma-capture.txt` and manually copy its visible text; Figma will paste that as a giant text layer instead of editable design layers.

## Capture Procedure

Use `assets/capture-for-design.js` as the canonical script. Keep `selector: "body"` unless the user explicitly asks to capture a smaller root.

Recommended browser-console flow:

```javascript
// Paste the contents of assets/capture-for-design.js into the page console.
// The resolved value is the Figma-pasteable capture payload.
```

If browser automation is available, open the local HTML page, wait for fonts/images, then evaluate the same script in the page context. Do not rewrite the capture logic ad hoc.

## Clipboard Delivery

Figma Code to Canvas requires the payload to be on the clipboard with MIME type `text/html`. A raw chat message, a text file selection, or a normal plain-text copy is not enough.

After capture:

1. Extract the `text/html` clipboard payload. It should begin with `<span data-h2d="<!--(figh2d)`.
2. Save that exact payload to `figma-capture.txt`.
3. Prefer writing the payload directly to the system clipboard:

```bash
swift scripts/copy_figma_payload_to_clipboard.swift /path/to/figma-capture.txt
```

4. If direct clipboard writing is blocked, serve the output folder over HTTP and use an HTML paste helper page with `navigator.clipboard.write([new ClipboardItem({"text/html": blob})])`. Open it from `http://127.0.0.1:...`, not `file://`.
5. In the final response, say whether the clipboard was written. If it was written, tell the user to paste directly into Figma. If not, provide the HTTP helper URL and explicitly warn not to manually copy the text file contents.

Use `figma-capture.txt` as an artifact/debug file, not as the primary user copy workflow.

## Output Contract

Return these items at the end of the task:

- The standalone HTML file path.
- The generated asset paths, if any.
- Clipboard status: `text/html` copied, plus the HTTP paste helper URL when one exists. This is the user-facing copyable delivery surface.
- The local `figma-capture.txt` path as a backup artifact only.
- A concise note about any fidelity limitations that remain.

## References

- `references/reconstruction-rules.md` - detailed screenshot analysis, component-state, asset-generation, icon, and export rules.
- `assets/capture-for-design.js` - canonical Figma Code to Canvas capture script.
- `scripts/copy_figma_payload_to_clipboard.swift` - macOS helper for writing `figma-capture.txt` to the clipboard as `text/html`.
