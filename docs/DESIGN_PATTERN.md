# Aria Polish Pattern (LOCKED — apply mechanically, do not redesign)

Reference pages: `app/(dashboard)/dashboard/today-client.tsx`, `app/(dashboard)/settings/page.tsx`, `app/(dashboard)/clients/[id]/client-detail.tsx`

## Page root

Wrap every page's outer div with:
- `className="min-h-screen pb-[130px]"`
- Inline style for gradient mesh background:
  ```ts
  background: `
    radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59,130,246,0.10), transparent),
    radial-gradient(ellipse 60% 50% at 80% 80%, rgba(167,139,250,0.06), transparent),
    #000000
  `,
  color: "#ffffff",
  ```

Inner content wrapper: `<div className="px-5 pt-6">`

## Containers

- **List rows** (preferred for any list of items): NO bubble container. Flat rows with `padding: 18px 4px` and `borderBottom: "0.5px solid rgba(255,255,255,0.06)"`.
- **Grouped cards** (use sparingly — only when grouping is needed): `rgba(20,20,22,0.6)` bg, `border-radius: 14`, `0.5px solid rgba(255,255,255,0.06)` border, `backdrop-filter: blur(20px)` + `-webkit-` prefix, `overflow: hidden`.
- **Bento tiles**: `rgba(20,20,22,0.7)` bg, `0.5px solid rgba(255,255,255,0.10)` border, `border-radius: 18`, `backdrop-filter: blur(20px)`.
- **Strip tiles** (briefing-style): `rgba(20,20,22,0.5)` bg, `0.5px solid rgba(255,255,255,0.06)` border, `border-radius: 12`, `padding: 10px 8px`.

## Typography

| Use | Size | Weight | Color | Other |
|-----|------|--------|-------|-------|
| Section labels | 11px | 600 | #6B7280 | uppercase, letter-spacing 0.08em |
| Primary headlines | 17-22px | 600-700 | #ffffff | letter-spacing -0.02em |
| Body | 13-16px | 400-500 | #ffffff | — |
| Secondary text | 13px | 400 | #9CA3AF | — |
| Tertiary text | 11px | 400 | #6B7280 | — |
| Muted small | 10px | 500 | #6B7280 | uppercase, letter-spacing 0.06em |
| Accent text | varies | 700 | gradient | `linear-gradient(135deg, #3B82F6, #06B6D4)` clipped to text via `WebkitBackgroundClip` |

## Semantic colors

| Color | Hex | Use |
|-------|-----|-----|
| Red | #EF4444 | Urgency, closings ≤3 days, destructive actions |
| Amber | #F59E0B | Hot leads, warnings |
| Blue | #3B82F6 | Primary CTAs, signatures, neutral active |
| Purple | #A78BFA | AI suggestions, past-client touches |
| Green | #10B981 | New matches, success |

## Buttons

**Solid primary** (action buttons in lists):
```ts
background: "#3B82F6"
color: "#ffffff"
padding: "10px 12px"
border-radius: 8
font-weight: 600
font-size: 14px
width: "calc(100% - 14px)"  // when in indented list rows
margin-left: 14
text-align: center
```

**Ghost secondary** (navigate-to actions):
```ts
background: transparent
color: "#ffffff"
padding: "9px 12px"
border-radius: 8
border: "0.5px solid rgba(255,255,255,0.15)"
font-weight: 500
font-size: 14px
```
Include `<ArrowRight size={14} style={{ color: "#6B7280" }} />` at the end via `justify-between`.

**Destructive:**
Color `#EF4444`, font-weight 500, NO chevron.

**All buttons:** `active:scale-[0.97] transition-transform duration-100` and trigger `navigator.vibrate(10)` on tap inside a `try/catch`.

## Spacing

- Page padding: `px-5 pt-6 pb-[130px]`
- Between major sections: 24-28px
- Between grouped cards: 24px
- Inside lists: 0 (separators provide visual gap)

## Already done globally (do not re-implement)

- `AppHeader` mounted on every non-`/dashboard` page via layout
- `BottomNav` mounted on every page via layout
- `BackButton` component with smart `router.back()` default
- Floating glass nav with center Aria voice button

## What NEVER to do

- ❌ Bubble cards with bright/full borders (old style)
- ❌ Yellow/gold accents (`#FACC15`, `#F59E0B` as primary — moved to blue→cyan)
- ❌ Emoji decorations on data rows
- ❌ Skip-for-today UI patterns
- ❌ "+N more — see all" overflow indicators
- ❌ Cardboard border: `1px solid #...` (we use `0.5px rgba`)
- ❌ Animations on list items (`cardIn` keyframes, etc.) — keep it static
- ❌ Numbered list indicators (1., 2., 3.) — use colored urgency dots instead

## Reference for new pages

When polishing a page, scan for these old patterns and replace:

| Old pattern | Replace with |
|-------------|-------------|
| `border: 1px solid #...` | `border: 0.5px solid rgba(255,255,255,0.06)` |
| `bg-gray-900` or solid card bg | `rgba(20,20,22,0.6)` + `backdrop-filter blur` |
| `text-yellow-` / `#FACC15` | `linear-gradient(135deg, #3B82F6, #06B6D4)` |
| Bordered list cards | Flat rows with bottom separator |
| `text-2xl` (24px) hero numbers | 18px gradient text in compact header |
