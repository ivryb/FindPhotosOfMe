# FindPhotosOfMe brand kit

The logo is a six-blade camera aperture. Every file here and every web icon in `apps/web/public/` comes from `generate.py`, so change the design there and regenerate:

```bash
uv run design/brand/generate.py
```

## Colors

| Name   | Hex       | Use                                   |
| ------ | --------- | ------------------------------------- |
| Yellow | `#FFD21F` | Brand surfaces, icon tile, highlights |
| Ink    | `#151515` | Text, the aperture, dark surfaces     |
| White  | `#FFFFFF` | Text and marks on ink                 |

The wordmark is Archivo Black at 118% width, outlined, so it needs no font installed.

## Files

Every asset comes as `svg/` (preferred) and `png/` (1024px tall for square files, 256px tall for wide ones).

| File                | Use it on                                                   |
| ------------------- | ----------------------------------------------------------- |
| `icon-yellow`       | The app icon. Avatars, social profiles, anywhere square     |
| `icon-ink`          | The app icon where yellow clashes with the surroundings     |
| `mark-ink`          | The aperture alone on white or yellow                       |
| `mark-yellow`       | The aperture alone on ink or dark photos                    |
| `mark-white`        | The aperture alone on ink or busy dark photos               |
| `lockup-ink`        | Icon and name on white or light backgrounds                 |
| `lockup-white`      | Icon and name on ink or dark backgrounds                    |
| `lockup-mono-ink`   | One-color logo on yellow (the site header) or for print     |
| `lockup-mono-white` | One-color logo on dark photos                               |
| `wordmark-ink`      | The name alone, light backgrounds                           |
| `wordmark-white`    | The name alone, dark backgrounds                            |

Don't put `icon-yellow` or `lockup-ink` on a yellow background; the tile disappears. Use the mono versions there.
