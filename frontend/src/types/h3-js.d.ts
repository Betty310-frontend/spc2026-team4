// h3-js ambient declaration for moduleResolution: "bundler" compatibility
declare module 'h3-js' {
  type H3Index = string
  type CoordPair = [number, number]
  type H3IndexInput = H3Index | bigint

  export function latLngToCell(lat: number, lng: number, res: number): H3Index
  export function cellToLatLng(h3Index: H3IndexInput): CoordPair
  export function cellToBoundary(h3Index: H3IndexInput, formatAsGeoJson?: boolean): CoordPair[]
}
