# Omni Converter

Omni Converter is a browser-based file conversion and editing application. Files are inspected, transformed, previewed, and packaged on the user's device without an upload or cloud conversion service.

## Verified Conversions

- Images: raster formats, resizing, compression, PDF, animation, thumbnails, social packs, and icon bundles.
- PDFs: page images, text, Markdown, HTML, DOCX, PPTX outlines, metadata, handouts, carousels, splitting, rotation, and bounded compression.
- Data: XLSX, CSV, TSV, JSON, JSON Lines, HTML, Markdown, and PDF derivatives.
- Documents: verified DOCX and PPTX semantic extraction plus media bundles.
- Archives and ebooks: bounded ZIP operations and verified EPUB conversions.
- Media: MP4/WebM transcoding, frame and contact-sheet exports, audio extraction, audio transcoding, waveforms, and audio-to-video.

Every selectable route is backed by a registered browser engine and executable fixture coverage. Unsupported or misleading routes stay unavailable.

## Development

```powershell
npm install
npm run dev
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-omni.ps1 -Public
```

The public verification command runs a sensitive-content scan, typecheck, production build, entry-bundle budget, unit contracts, browser workflows, and offline PWA checks.

## Live App

[mayowa-007.github.io/omni-converter](https://mayowa-007.github.io/omni-converter/)
