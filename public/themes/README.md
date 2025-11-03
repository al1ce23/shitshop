# Themes

This folder contains different color themes for the webshop. All themes share the same base layout from `base.css`.

## Available Themes

- **purple.css** - Smooth dark purple theme (default)
- **warm.css** - Warm brown/orange theme
- **black.css** - Pure black theme with white accents
- **gray.css** - Modern grayscale theme

## How to Change the Theme

To switch themes, edit the following files and change the theme CSS link:

### index.html
```html
<link rel="stylesheet" href="themes/base.css">
<link rel="stylesheet" href="themes/purple.css">  <!-- Change this line -->
```

### about.html
```html
<link rel="stylesheet" href="themes/base.css">
<link rel="stylesheet" href="themes/purple.css">  <!-- Change this line -->
```

Replace `purple.css` with any of the available themes:
- `themes/purple.css`
- `themes/warm.css`
- `themes/black.css`
- `themes/gray.css`

## Theme Structure

- **base.css** - Contains all layout and structure (required, don't change)
- **[theme].css** - Contains only colors, gradients, and theme-specific styling

## Creating Custom Themes

You can create your own theme by:
1. Copy one of the existing theme files (e.g., `purple.css`)
2. Rename it (e.g., `mytheme.css`)
3. Modify the colors and gradients
4. Update the `<link>` tag in both `index.html` and `about.html`

Keep the same CSS class names and structure as the existing themes.
