# Dilag App Icon

## Design Concept

The Dilag icon uses the "Morph" concept - representing the transformation from prompt to design:

- **Ghost rectangle** (outline, left): The input state - a mobile screen waiting to be filled
- **Solid organic D-shape** (right): The output state - design materializing from AI

Together they form a stylized "D" for Dilag while telling the story of transformation.

## Colors

- **Background gradient**: Top `#1a1a22` to bottom `#111116` - matches the app's dark theme (`oklch(0.16 0.01 260)`)
- **Foreground**: `#f5f5f7` white with 35% opacity for the ghost rectangle

## Source Files

```
assets/
├── app-icon.png      # 1240x1240 PNG with padding
└── icon-source.svg   # Vector source for editing

resources/icons/
├── icon.icns         # macOS icon used by electron-builder
├── icon.ico          # Windows icon used by electron-builder
└── icon.png          # Linux icon used by electron-builder
```

## Regenerating Icons

To regenerate platform icons, export the source artwork and update the files in `resources/icons/` used by `electron-builder`.

At minimum, keep these files current:

- `resources/icons/icon.icns` for macOS
- `resources/icons/icon.ico` for Windows
- `resources/icons/icon.png` for Linux

## Editing the Icon

1. Edit `assets/icon-source.svg` in a vector editor
2. Export to PNG at 1024x1024
3. Add ~10% padding (extend canvas to ~1240x1240 with transparent background)
4. Save as `assets/app-icon.png`
5. Regenerate `resources/icons/icon.icns`, `resources/icons/icon.ico`, and `resources/icons/icon.png`
6. Restart Dock to clear icon cache when testing macOS icons: `killall Dock`

## macOS Icon Guidelines

- Icons should have transparent padding (~10%) for proper dock sizing
- The rounded rectangle and shadow are part of the icon (not applied by macOS for custom icons)
- Use `rsvg-convert` for accurate SVG-to-PNG conversion with gradients (ImageMagick may lose gradient data)

```bash
# Install rsvg-convert if needed
brew install librsvg

# Convert SVG to PNG
rsvg-convert icon-source.svg -w 1024 -h 1024 -o icon.png
```
