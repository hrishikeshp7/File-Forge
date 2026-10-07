import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { Combine, FileImage, FileOutput, Image as ImageIcon, ImageDown, Images, Repeat2, RotateCw, Scaling, Scissors, Shrink, type LucideIcon } from 'lucide-react'

export type Category = 'pdf' | 'image' | 'convert'

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
]

const convert = lazy(() => import('./ImageConvert.tsx'))

// To add a tool: write a component in src/tools and add one line here.
export const TOOLS: ToolDef[] = [
  { id: 'pdf-merge', name: 'Merge PDF', desc: 'Combine PDFs in any order', category: 'pdf', icon: Combine, Component: lazy(() => import('./PdfMerge.tsx')) },
  { id: 'pdf-split', name: 'Split PDF', desc: 'Split by range, count or page', category: 'pdf', icon: Scissors, Component: lazy(() => import('./PdfSplit.tsx')) },
  { id: 'pdf-compress', name: 'Compress PDF', desc: 'Shrink file size', category: 'pdf', icon: Shrink, Component: lazy(() => import('./PdfCompress.tsx')) },
  { id: 'pdf-rotate', name: 'Rotate PDF', desc: 'Rotate pages with previews', category: 'pdf', icon: RotateCw, Component: lazy(() => import('./PdfRotate.tsx')) },
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
]

export const toolById = (id: string) => TOOLS.find((t) => t.id === id)
