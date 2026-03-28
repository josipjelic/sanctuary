```markdown
# Design System Strategy: The Serene Interface

## 1. Overview & Creative North Star: "The Digital Sanctuary"
This design system is built to transform a personal development assistant into a "Digital Sanctuary." We move away from the high-friction, "hustle-culture" aesthetics of traditional productivity apps. Instead, we embrace a high-end editorial approach characterized by **Breathtaking Whitespace** and **Intentional Asymmetry**. 

The "North Star" here is **Invisible Guidance**. The interface should feel like a high-quality linen journal—tactile, spacious, and quiet. We break the "app template" look by using a hyper-exaggerated typography scale and replacing rigid structural lines with tonal depth.

---

## 2. Colors: Tonal Atmosphere
Our palette is anchored in Sage Green and Deep Indigo, but its soul lies in the "Off-White" spectrum.

### The Palette (Material Design Tokens)
*   **Primary (Sage):** `#536253` — Used for grounding elements and primary intentions.
*   **Secondary (Slate):** `#576165` — For supportive, professional metadata.
*   **Surface (Parchment):** `#f9f9f8` — The canvas of the sanctuary.
*   **Error (Terracotta):** `#9e422c` — Softened to prevent alarm; it’s a gentle correction, not a siren.

### The "No-Line" Rule
**Strict Prohibition:** Do not use 1px solid borders to separate sections.
Boundaries must be defined through **Background Color Shifts**. For example, a `surface-container-low` (`#f1f4f3`) sidebar sitting against a `surface` (`#f9f9f8`) main content area. This creates a "soft edge" that feels architectural rather than digital.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the `surface-container` tiers to create depth:
1.  **Level 0 (Base):** `surface` (`#f9f9f8`)
2.  **Level 1 (Sections):** `surface-container-low` (`#f1f4f3`)
3.  **Level 2 (Active Cards):** `surface-container-lowest` (`#ffffff`) — This creates a "pop" of brightness that draws the eye without needing a shadow.

### The "Glass & Gradient" Rule
To add a premium, "Editorial" polish, use **Glassmorphism** for floating navigation or overlay modals. 
*   **Recipe:** `surface-container-lowest` at 70% opacity + 20px Backdrop Blur.
*   **Signature Textures:** Use a subtle linear gradient for Hero backgrounds transitioning from `primary_container` (`#d7e7d3`) to `surface` (`#f9f9f8`) at a 15-degree angle. This mimics natural morning light hitting a wall.

---

## 3. Typography: Editorial Authority
We utilize two distinct sans-serifs to create a sophisticated hierarchy: **Manrope** for structural authority and **Plus Jakarta Sans** for modern readability.

*   **Display (Manrope):** Use `display-lg` (3.5rem) with `-0.04em` letter spacing. These should be treated as hero elements, often placed with intentional asymmetry (e.g., left-aligned with a massive right margin).
*   **Headlines (Manrope):** `headline-md` (1.75rem) provides clear, calm signposting.
*   **Body (Plus Jakarta Sans):** `body-lg` (1rem) is our workhorse. Ensure a line-height of `1.6` to maintain the "peaceful" reading experience.
*   **Labels (Plus Jakarta Sans):** `label-md` (0.75rem) in `secondary` (`#576165`) for non-essential metadata.

**Design Note:** Use typography as a spatial tool. A single word in `display-lg` surrounded by `spacing-24` (8.5rem) conveys more "luxury" than any icon or illustration.

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows are too heavy for a "Sanctuary." We use **Ambient Light** principles.

*   **The Layering Principle:** Instead of shadows, stack `surface-container-lowest` cards on `surface-container-low` backgrounds. This creates a "Natural Lift."
*   **Ambient Shadows:** If an element must float (e.g., a FAB or Menu), use:
    *   `Y: 8px, Blur: 32px, Color: on-surface (4% opacity)`. 
    *   This mimics a soft, overcast day rather than a harsh spotlight.
*   **The Ghost Border:** If accessibility requires a stroke (e.g., Input fields), use `outline-variant` (`#abb4b3`) at **15% opacity**. It should be felt, not seen.

---

## 5. Components: The Softened Suite

### Buttons
*   **Primary:** Background: `primary` (`#536253`), Text: `on-primary` (`#ecfce8`). Corner Radius: `full`.
*   **Secondary:** Background: `secondary-container` (`#dae4e9`), Text: `on-secondary-container`.
*   **Interaction:** On hover, do not darken; instead, shift the elevation subtly using a 2% increase in shadow opacity.

### Input Fields
*   **Styling:** No bottom line. Use `surface-container-high` (`#e3e9e8`) as a solid background with `DEFAULT` (1rem) rounded corners.
*   **Focus State:** A "Ghost Border" of `primary` at 20% opacity.

### Cards & Lists
*   **Strict Rule:** No divider lines. 
*   **Separation:** Use `spacing-6` (2rem) of vertical whitespace between list items. Use a subtle background hover state (`surface-container-highest`) to indicate interactivity.
*   **Shape:** All cards must use `xl` (3rem) or `lg` (2rem) corner radius to reinforce the "Soft & Rounded" philosophy.

### Specialized Component: The Reflection Space
*   A large, `surface-container-lowest` container with a `4rem` (xl) padding. Used for journaling or daily quotes. It should occupy at least 60% of the viewport width to force focus and calm.

---

## 6. Do's and Don'ts

### Do:
*   **Embrace the Void:** Use `spacing-20` (7rem) and `spacing-24` (8.5rem) to separate major thematic sections.
*   **Asymmetric Balance:** Place a small label (`label-sm`) far to the right of a large headline to create a "High-End Magazine" feel.
*   **Subtle Motion:** Use long, slow transitions (400ms - 600ms) with `cubic-bezier(0.05, 0.7, 0.1, 1)` for a "drifting" feel.

### Don't:
*   **Don't use pure black:** Use `on-surface` (`#2c3433`) for all text. Pure black is too aggressive for this sanctuary.
*   **Don't use 100% opacity borders:** It breaks the "Soft Minimalism" and creates visual "stuttering."
*   **Don't crowd the edges:** Maintain a minimum global screen padding of `spacing-8` (2.75rem).
*   **Don't use "System Blue":** Use the `tertiary` (Deep Indigo) tokens for links to keep the palette sophisticated and intentional.

---
*This design system is a living philosophy. When in doubt, remove an element, increase the whitespace, and soften the corners.*```