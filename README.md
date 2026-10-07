# File-Forge
A vibecoded app that aims to have all Document functionalities

Offline file tools for web and Android (PDF + image today; video/audio planned). Everything runs on-device. Nothing is uploaded.

**Stack:** React + TypeScript + Vite, Capacitor for Android. `pdf-lib` and `pdf.js` for PDFs, Canvas for images, `fflate` for ZIP.

## Tools

- **PDF:** Merge, Split (range / every N / each page), Compress (Ghostscript: 4 levels), Rotate (page previews)
- **Image:** Compress, Resize (percent / pixels / presets)
- **Convert:** Image Converter (JPG, PNG, WebP, BMP, ICO), HEIC to JPG/PNG, PNG to JPG, JPG to PNG, WebP to JPG/PNG, SVG to PNG, Image to PDF, PDF to Image

Every image tool also accepts HEIC/HEIF and TIFF input (decoded with libheif / UTIF).

## Develop

```bash
npm install
npm run dev        # web dev server
npm run build      # typecheck + production build into dist/
npm run check      # logic self-check (merge/split/rotate/compress/sizing)
```

## Android

Needs JDK 21 and Android SDK 36 (Android Studio installs both).

```bash
npm run android:sync   # build web + copy into android/
npm run android:open   # open in Android Studio, then Run / Build APK
```

On Android, saved files go through the system share sheet (Drive, Files app, etc. — whatever the device offers). See `src/platform/saveOutput.ts`.

## Add a tool

Write a component in `src/tools/`, add one line to `src/tools/registry.ts`. Shared pieces: `FileDrop`, `FileList`, `ToolShell` (run button, progress, results), `useRunner`, `useFiles`; image tools can reuse `ImageBatch`.

## Notes

- PDF compress runs Ghostscript (WebAssembly, ~15 MB) in a throwaway Web Worker: downsamples and re-encodes all image types, dedupes images, subsets fonts. Text stays selectable.
- Android save path (share sheet) is unverified on a real device. Direct save to Downloads may need a SAF create-document flow.
- Password-protected PDFs are rejected with a message (unlock tool not built yet; MuPDF is the plan for protect / unlock / repair).
- AVIF output is not offered (browsers cannot encode it from canvas); AVIF input works where the WebView decodes it.

## License and AGPL obligations

AGPL-3.0-or-later (see `LICENSE`), because the app bundles Ghostscript (AGPL). What that means in practice:

- **Source offer:** the About screen (and footer) link to the exact commit each build was made from (`vite.config.ts` injects it). Keep the GitHub repo public and push the commit before releasing a build. Tag releases (`git tag v0.x`).
- **Notices:** the app shows the license, no-warranty text and copyright on the About screen. `npm run build` generates `public/notices/` (third-party list + full license texts, shipped inside the web build and the APK).
- **Stores:** link this repository in the Play Store listing. Do not add DRM or terms that restrict AGPL rights. Ads/paid editions are possible only if the full source (including your ad/billing code) is also published under AGPL, or you obtain a commercial license from Artifex for Ghostscript.
- **LGPL (libheif):** it is bundled unmodified; because the whole app is open source, anyone can rebuild with a different libheif.
- **Contributors:** by contributing you agree your code is AGPL-3.0-or-later.
