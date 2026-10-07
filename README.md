# File-Forge
A vibecoded app that aims to have all Document functionalities

Offline file tools for web and Android (PDF + image today; video/audio planned). Everything runs on-device. Nothing is uploaded.

**Stack:** React + TypeScript + Vite, Capacitor for Android. `pdf-lib` and `pdf.js` for PDFs, Canvas for images, `fflate` for ZIP.

## Tools

- **PDF:** Merge, Split (range / every N / each page), Compress (Ghostscript: 4 levels), Rotate and Organize (page previews: reorder, delete, duplicate), Sign (draw / type / upload a signature picture), Crop, Watermark (text in any script, or image), Page Numbers, Properties (edit or strip title/author/XMP), Flatten (lock forms and annotations), Protect (AES-256, permissions), Unlock
- **Image:** Compress, Resize (percent / pixels / presets), Crop (free or fixed ratio, mouse and touch), Rotate & Flip, Watermark (text or logo), Remove Photo Metadata (lossless for JPEG/PNG)
- **Convert:** Image Converter (JPG, PNG, WebP, BMP, ICO), HEIC to JPG/PNG, PNG to JPG, JPG to PNG, WebP to JPG/PNG, SVG to PNG, Image to PDF, PDF to Image

- **Video:** Compress, Convert (MP4/WebM/MKV/MOV/AVI), Trim (with preview), Merge, Resize, Rotate/Mirror, Speed, Mute, Video to GIF, Video Frames
- **Audio:** Extract Audio, Audio Converter (MP3/M4A/WAV/OGG/Opus/FLAC), Compress, Trim, Merge

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
- Protect / Unlock / Organize run on MuPDF (WebAssembly, ~10 MB) in a worker. Passwords cannot contain a comma (MuPDF option-string limit). Unlock needs the password; it does not crack anything.
- Video/audio run on FFmpeg compiled to WebAssembly (`@ffmpeg/core`, single-threaded, ~31 MB) in a worker, with a Cancel button. Inputs are mounted (not copied); outputs are held in memory. Measured in desktop Chromium: 720p30 H.264 compresses at ~3× realtime; a 1.5 GB stream copy still succeeds. **Phones will be slower and have less memory.** Android uses this same path (no native FFmpeg yet).
- Not offered: HEVC/H.265 output (libx265 hangs in the single-threaded build), VP9 (too slow; WebM uses VP8), JPEG frames straight from ffmpeg (its MJPEG encoder crashes in this build; frames are PNG, JPG is made with the canvas). HEVC *input* decoding is untested here (no sample file).
- H.264/AAC/MP3 encoders may need patent licenses when you distribute commercially in some countries; this is not legal advice.
- **Sign PDF places a picture of your signature. It is not a certified/cryptographic digital signature** and carries no legal verification. **Crop PDF** can permanently delete the content outside the box (text character by character, image pixels, drawings fully outside; via MuPDF redaction. Drawings that cross the edge stay). Untick that option and it only sets the crop box, leaving the hidden area recoverable.
- Remove Photo Metadata cuts Exif/XMP/IPTC/comments out of JPEG and PNG without re-encoding (colour profile kept, rotated photos stay upright); other formats are re-encoded.
- Other PDF tools reject encrypted files with a link to Unlock.
- Watermark text is rendered on a canvas, so any script works but the mark is an image, not selectable text. Page numbers use Helvetica (Latin only).
- AVIF output is not offered (browsers cannot encode it from canvas); AVIF input works where the WebView decodes it.

## License and AGPL obligations

AGPL-3.0-or-later (see `LICENSE`), because the app bundles Ghostscript (AGPL). What that means in practice:

- **Source offer:** the About screen (and footer) link to the exact commit each build was made from (`vite.config.ts` injects it). Keep the GitHub repo public and push the commit before releasing a build. Tag releases (`git tag v0.x`).
- **Notices:** the app shows the license, no-warranty text and copyright on the About screen. `npm run build` generates `public/notices/` (third-party list + full license texts, shipped inside the web build and the APK).
- **Stores:** link this repository in the Play Store listing. Do not add DRM or terms that restrict AGPL rights. Ads/paid editions are possible only if the full source (including your ad/billing code) is also published under AGPL, or you obtain a commercial license from Artifex for Ghostscript.
- **LGPL (libheif):** it is bundled unmodified; because the whole app is open source, anyone can rebuild with a different libheif.
- **Contributors:** by contributing you agree your code is AGPL-3.0-or-later.
