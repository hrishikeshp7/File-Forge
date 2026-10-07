import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { AudioLines, Clapperboard, Film, Gauge, ImagePlay, Layers, Music, Rotate3d, Scaling as ScaleIcon, VolumeX, FileAudio, Camera, Combine, Hash, LayoutGrid, Lock, LockOpen, Stamp, FileImage, FileOutput, Image as ImageIcon, ImageDown, Images, Repeat2, RotateCw, Scaling, Scissors, Shrink, type LucideIcon } from 'lucide-react'

export type Category = 'pdf' | 'image' | 'convert' | 'video' | 'audio'

export interface ToolDef {
  id: string
  name: string
  desc: string
  category: Category
  icon: LucideIcon
  Component: LazyExoticComponent<ComponentType>
}

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'pdf', label: 'PDF' },
  { id: 'image', label: 'Image' },
  { id: 'convert', label: 'Convert' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Audio' },
]

const convert = lazy(() => import('./ImageConvert.tsx'))
const trimMedia = lazy(() => import('./TrimMedia.tsx'))
const mergeMedia = lazy(() => import('./MergeMedia.tsx'))
const audioConvert = lazy(() => import('./AudioTools.tsx').then((m) => ({ default: m.AudioConvert })))
const videoTool = (name: 'ResizeVideo' | 'RotateVideo' | 'SpeedVideo' | 'MuteVideo' | 'VideoGif' | 'VideoFrames') => lazy(() => import('./VideoTools.tsx').then((m) => ({ default: m[name] })))

// To add a tool: write a component in src/tools and add one line here.
export const TOOLS: ToolDef[] = [
  { id: 'pdf-merge', name: 'Merge PDF', desc: 'Combine PDFs in any order', category: 'pdf', icon: Combine, Component: lazy(() => import('./PdfMerge.tsx')) },
  { id: 'pdf-split', name: 'Split PDF', desc: 'Split by range, count or page', category: 'pdf', icon: Scissors, Component: lazy(() => import('./PdfSplit.tsx')) },
  { id: 'pdf-compress', name: 'Compress PDF', desc: 'Shrink file size', category: 'pdf', icon: Shrink, Component: lazy(() => import('./PdfCompress.tsx')) },
  { id: 'pdf-rotate', name: 'Rotate PDF', desc: 'Rotate pages with previews', category: 'pdf', icon: RotateCw, Component: lazy(() => import('./PdfRotate.tsx')) },
  { id: 'pdf-organize', name: 'Organize PDF', desc: 'Reorder, delete, duplicate pages', category: 'pdf', icon: LayoutGrid, Component: lazy(() => import('./PdfOrganize.tsx')) },
  { id: 'pdf-watermark', name: 'Watermark PDF', desc: 'Text or image on every page', category: 'pdf', icon: Stamp, Component: lazy(() => import('./PdfWatermark.tsx')) },
  { id: 'pdf-page-numbers', name: 'Page Numbers', desc: 'Number the pages of a PDF', category: 'pdf', icon: Hash, Component: lazy(() => import('./PdfPageNumbers.tsx')) },
  { id: 'pdf-protect', name: 'Protect PDF', desc: 'Password with AES-256', category: 'pdf', icon: Lock, Component: lazy(() => import('./PdfProtect.tsx')) },
  { id: 'pdf-unlock', name: 'Unlock PDF', desc: 'Remove password and restrictions', category: 'pdf', icon: LockOpen, Component: lazy(() => import('./PdfUnlock.tsx')) },
  { id: 'image-compress', name: 'Compress Image', desc: 'JPG, PNG, WebP — smaller files', category: 'image', icon: ImageDown, Component: lazy(() => import('./ImageCompress.tsx')) },
  { id: 'image-resize', name: 'Resize Image', desc: 'By percent or exact pixels', category: 'image', icon: Scaling, Component: lazy(() => import('./ImageResize.tsx')) },
  { id: 'image-convert', name: 'Image Converter', desc: 'HEIC, WebP, TIFF, SVG → JPG, PNG, WebP, BMP, ICO', category: 'convert', icon: Repeat2, Component: convert },
  { id: 'heic-to-jpg', name: 'HEIC to JPG', desc: 'iPhone photos to JPG', category: 'convert', icon: FileImage, Component: convert },
  { id: 'heic-to-png', name: 'HEIC to PNG', desc: 'iPhone photos to PNG', category: 'convert', icon: FileImage, Component: convert },
  { id: 'png-to-jpg', name: 'PNG to JPG', desc: 'Smaller photos, white background', category: 'convert', icon: ImageIcon, Component: convert },
  { id: 'jpg-to-png', name: 'JPG to PNG', desc: 'Lossless PNG output', category: 'convert', icon: ImageIcon, Component: convert },
  { id: 'webp-to-jpg', name: 'WebP to JPG', desc: 'Open WebP anywhere', category: 'convert', icon: ImageIcon, Component: convert },
  { id: 'webp-to-png', name: 'WebP to PNG', desc: 'Keeps transparency', category: 'convert', icon: ImageIcon, Component: convert },
  { id: 'svg-to-png', name: 'SVG to PNG', desc: 'Rasterize vector graphics', category: 'convert', icon: ImageIcon, Component: convert },
  { id: 'image-to-pdf', name: 'Image to PDF', desc: 'Photos and scans into one PDF', category: 'convert', icon: Images, Component: lazy(() => import('./ImageToPdf.tsx')) },
  { id: 'pdf-to-image', name: 'PDF to Image', desc: 'Pages as JPG or PNG', category: 'convert', icon: FileOutput, Component: lazy(() => import('./PdfToImage.tsx')) },
  { id: 'video-compress', name: 'Compress Video', desc: 'Shrink videos, fix phone clips', category: 'video', icon: Film, Component: lazy(() => import('./VideoCompress.tsx')) },
  { id: 'video-convert', name: 'Convert Video', desc: 'MP4, WebM, MKV, MOV, AVI', category: 'video', icon: Clapperboard, Component: lazy(() => import('./VideoConvert.tsx')) },
  { id: 'video-trim', name: 'Trim Video', desc: 'Cut a clip with a preview', category: 'video', icon: Scissors, Component: trimMedia },
  { id: 'video-merge', name: 'Merge Videos', desc: 'Join clips into one', category: 'video', icon: Layers, Component: mergeMedia },
  { id: 'video-resize', name: 'Resize Video', desc: '240p to 1080p', category: 'video', icon: ScaleIcon, Component: videoTool('ResizeVideo') },
  { id: 'video-rotate', name: 'Rotate Video', desc: 'Rotate, mirror, flip', category: 'video', icon: Rotate3d, Component: videoTool('RotateVideo') },
  { id: 'video-speed', name: 'Video Speed', desc: 'Slow motion or fast forward', category: 'video', icon: Gauge, Component: videoTool('SpeedVideo') },
  { id: 'video-mute', name: 'Mute Video', desc: 'Remove the sound, instantly', category: 'video', icon: VolumeX, Component: videoTool('MuteVideo') },
  { id: 'video-to-gif', name: 'Video to GIF', desc: 'Turn a clip into a GIF', category: 'video', icon: ImagePlay, Component: videoTool('VideoGif') },
  { id: 'video-frames', name: 'Video Frames', desc: 'Save frames as JPG or PNG', category: 'video', icon: Camera, Component: videoTool('VideoFrames') },
  { id: 'extract-audio', name: 'Extract Audio', desc: 'Video to MP3, M4A, WAV…', category: 'audio', icon: AudioLines, Component: lazy(() => import('./AudioTools.tsx').then((m) => ({ default: m.ExtractAudio }))) },
  { id: 'audio-convert', name: 'Audio Converter', desc: 'MP3, M4A, WAV, OGG, Opus, FLAC', category: 'audio', icon: Music, Component: audioConvert },
  { id: 'audio-compress', name: 'Compress Audio', desc: 'Smaller audio files', category: 'audio', icon: FileAudio, Component: audioConvert },
  { id: 'audio-trim', name: 'Trim Audio', desc: 'Cut an audio clip', category: 'audio', icon: Scissors, Component: trimMedia },
  { id: 'audio-merge', name: 'Merge Audio', desc: 'Join audio files', category: 'audio', icon: Layers, Component: mergeMedia },
]

export const toolById = (id: string) => TOOLS.find((t) => t.id === id)
