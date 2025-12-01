# SwapRunn Design System Guide

## Visual Consistency Updates for All Pages

This guide outlines the specific CSS class changes needed to match the homepage design aesthetic across all dashboard and authentication pages.

---

## Color Palette

### Primary Colors
- **Red Gradient**: `from-red-600 to-red-700` (buttons, accents)
- **Red Hover**: `from-red-700 to-red-800`
- **Red Text**: `text-red-600` for links and highlights

### Background Colors
- **Page Background**: `bg-gradient-to-br from-gray-50 via-white to-gray-100`
- **Card Background**: `bg-white` with shadows
- **Secondary Background**: `bg-gradient-to-br from-gray-50 to-white`

### Text Colors
- **Headings**: `text-gray-900`
- **Body**: `text-gray-600`
- **Labels**: `text-gray-700`

---

## Typography

### Headings
- **Page Titles (h1)**: `text-4xl md:text-5xl font-bold text-gray-900`
- **Section Titles (h2)**: `text-2xl md:text-3xl font-bold text-gray-900`
- **Card Titles (h3)**: `text-xl md:text-2xl font-bold text-gray-900`
- **Subtitles**: `text-lg md:text-xl text-gray-600`

### Body Text
- **Regular**: `text-base text-gray-600`
- **Small**: `text-sm text-gray-600`
- **Extra Small**: `text-xs text-gray-500`

### Font Weights
- **Bold headings**: `font-bold`
- **Semibold labels**: `font-semibold`
- **Medium links**: `font-medium`

---

## Spacing

### Container Padding
- **Page Container**: `py-20 md:py-28` (instead of py-12)
- **Section Spacing**: `space-y-8` or `gap-8`
- **Card Padding**: `p-8` (instead of p-6)

### Margins
- **Section Margins**: `mb-10` or `mb-12` (instead of mb-6)
- **Element Margins**: `mb-6` (instead of mb-4)

---

## Border Radius

### Standard Sizes
- **Large Cards**: `rounded-2xl` (instead of rounded-lg)
- **Buttons**: `rounded-xl` (instead of rounded-lg)
- **Small Elements**: `rounded-lg` (instead of rounded-md)

---

## Shadows

### Card Shadows
- **Default Card**: `shadow-2xl` (instead of shadow-lg or shadow-md)
- **Hover State**: `hover:shadow-2xl` with transition

### Button Shadows
- **Default**: `shadow-lg`
- **Hover**: `hover:shadow-xl`

### Border Combinations
- Cards should have: `shadow-2xl border border-gray-100` or `border-2 border-gray-200`

---

## Button Styles

### Primary Buttons
```css
bg-gradient-to-r from-red-600 to-red-700
text-white
py-4
px-8
rounded-xl
font-bold
text-lg
hover:from-red-700 hover:to-red-800
transition-all
shadow-lg
hover:shadow-xl
transform hover:-translate-y-0.5
```

### Secondary Buttons
```css
border-2 border-gray-300
text-gray-700
py-3
px-6
rounded-xl
font-semibold
hover:border-gray-400 hover:bg-gray-50
transition-all
shadow-sm
```

### Button Sizes
- **Large**: `py-4 px-8 text-lg`
- **Medium**: `py-3 px-6 text-base`
- **Small**: `py-2 px-4 text-sm`

---

## Form Elements

### Input Fields
```css
w-full
px-4
py-3.5
border-2 border-gray-300
rounded-xl
focus:ring-2 focus:ring-red-600 focus:border-red-600
transition
shadow-sm
```

### Labels
```css
block
text-sm
font-semibold
text-gray-700
mb-2
```

### Select Dropdowns
```css
w-full
px-4
py-3
border-2 border-gray-300
rounded-xl
focus:ring-2 focus:ring-red-600 focus:border-transparent
transition
shadow-sm
bg-white
```

---

## Cards

### Standard Card
```css
bg-white
rounded-2xl
shadow-2xl
p-8
border border-gray-100
```

### Hover Card
```css
bg-white
rounded-2xl
shadow-lg
p-6
border-2 border-gray-200
hover:shadow-2xl
hover:border-red-600
transition-all
transform hover:-translate-y-2
```

### Info Cards (Alerts/Notices)
```css
bg-gradient-to-br from-blue-50 to-white
rounded-xl
p-6
border-2 border-blue-200
shadow-sm
```

---

## Layout Structure

### Page Container
```css
min-h-screen
bg-gradient-to-br from-gray-50 via-white to-gray-100
py-20
px-4
```

### Content Container
```css
container
mx-auto
px-4
py-8
max-w-7xl
```

### Grid Layouts
- **Two Columns**: `grid md:grid-cols-2 gap-6`
- **Three Columns**: `grid md:grid-cols-3 gap-6`
- **Four Columns**: `grid md:grid-cols-2 lg:grid-cols-4 gap-6`

---

## Special Elements

### Status Badges
- **Pending**: `bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold`
- **Completed**: `bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold`
- **Active**: `bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold`

### Empty States
- Icon container: `w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-6`
- Title: `text-2xl font-bold text-gray-900 mb-3`
- Description: `text-gray-600 text-lg`

### Loading Skeletons
- `bg-gray-200 rounded-lg animate-pulse`

---

## Transitions & Animations

### Standard Transition
```css
transition-all duration-200
```

### Hover Effects
- **Lift**: `transform hover:-translate-y-1`
- **Slight Lift**: `transform hover:-translate-y-0.5`
- **Scale**: `transform hover:scale-105`

---

## Specific Page Patterns

### Dashboard Headers
```css
bg-white
shadow-md
sticky top-16 z-40
py-6
(instead of py-4)
```

### Tab Navigation
- Active tab: `text-red-600 border-b-2 border-red-600 font-semibold`
- Inactive tab: `text-gray-600 hover:text-gray-900 font-medium`

### Navigation Buttons
- Use icon + text pattern: `<Icon size={20} className="mr-2" />Label`
- Consistent sizing: Icons at 20px for nav, 24-28px for section headers

---

## Implementation Checklist

For each page, systematically update:

1. ✓ Page container background and padding
2. ✓ Main card shadows and border radius
3. ✓ All button styles (primary and secondary)
4. ✓ Form input fields and labels
5. ✓ Typography (headings, body text, labels)
6. ✓ Spacing (margins, padding, gaps)
7. ✓ Border radius on all elements
8. ✓ Hover effects and transitions
9. ✓ Card styles and shadows
10. ✓ Info/alert boxes styling

---

## Before & After Examples

### BEFORE (Old Style):
```html
<button className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition">
  Submit
</button>
```

### AFTER (New Style):
```html
<button className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white py-4 rounded-xl font-bold text-lg hover:from-red-700 hover:to-red-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
  Submit
</button>
```

---

## Notes

- All changes are **purely visual** - no functionality should be affected
- Maintain existing class structure, just upgrade the values
- Test responsiveness after changes (check mobile views)
- Ensure adequate color contrast for accessibility
- Keep consistent spacing throughout each page
