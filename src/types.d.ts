declare module 'libheif-js/libheif-wasm/libheif-bundle.mjs' {
  const factory: () => Promise<{
    HeifDecoder: new () => {
      decode(data: Uint8Array): {
        get_width(): number
        get_height(): number
        display(target: { data: Uint8ClampedArray; width: number; height: number }, cb: (r: unknown) => void): void
      }[]
    }
  }>
  export default factory
}

declare const __COMMIT__: string
declare const __DIRTY__: boolean
