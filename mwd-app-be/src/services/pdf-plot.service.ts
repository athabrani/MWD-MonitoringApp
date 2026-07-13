import { deflateSync, inflateSync } from 'node:zlib'
import { prisma } from '../lib/prisma.js'
import {
  MWD_MEASUREMENT_FIELDS,
  type MeasurementField,
} from '../utils/mwd-measurements.js'
import * as plotTemplateService from './plot-template.service.js'
import { PDF_STYLE, type PdfFontWeight } from './export/templates/pdfStyle.js'

type PdfPlotInput = {
  sessionId: number
  sessionCode: string
  wellName?: string | null
  rigName?: string | null
  templateId?: number
  template?: Record<string, unknown>
  depthMin?: number
  depthMax?: number
}

type SessionMetadata = {
  sessionCode: string
  company: string | null
  wellName: string | null
  wellId: string | null
  rigName: string | null
  fieldName: string | null
  jobNumber: string | null
  province: string | null
  countyParish: string | null
  country: string | null
  location: string | null
  latitude: number | null
  longitude: number | null
  northReference: string | null
  declination: number | null
  proposedAzimuth: number | null
  elevationKb: number | null
  elevationDf: number | null
  elevationGl: number | null
  startedAt: Date | null
  endedAt: Date | null
}

type PlotCurve = {
  key: string
  label?: string
  unit?: string
  min?: number
  max?: number
  color?: string
  lineWidth?: number
  lineStyle?: 'solid' | 'dashed' | 'dotted'
}

type PlotTrack = {
  title: string
  unit?: string
  min: number
  max: number
  curves: PlotCurve[]
}

type HeaderField = {
  label: string
  value?: string | number | null
  source?: 'sessionCode' | 'wellName' | 'rigName'
}

type PlotPageSettings = {
  size: 'a4'
  orientation: 'portrait' | 'landscape'
  marginTop: number
  marginRight: number
  marginBottom: number
  marginLeft: number
  headerHeightFirstPage: number
  headerHeightOtherPages: number
  trackHeaderHeight: number
}

type PlotLogoConfig = {
  dataUrl: string
  width?: number
  height?: number
  x?: number
  y?: number
}

type PlotTemplateConfig = {
  title: string
  scaleRatio: number
  depthPerPage: number
  depthStep: number
  minorDepthStep: number
  page: PlotPageSettings
  logo?: PlotLogoConfig
  headerFields: HeaderField[]
  tracks: PlotTrack[]
}

type PlotRow = {
  depth: number
  measuredAt: Date | null
  values: Record<string, number | null>
}

type SurveyTableRow = {
  isTieIn: boolean
  measuredDepth: number
  inclination: number
  azimuth: number
  tvd: number | null
  northing: number | null
  easting: number | null
  verticalSection: number | null
  closureDistance: number | null
  closureAzimuth: number | null
  doglegSeverity: number | null
  courseLength: number | null
}

type PdfPoint = {
  x: number
  y: number
}

type PdfPageContent = {
  content: string
  width: number
  height: number
}

type HeaderScaleRow = {
  left: string
  center?: string
  right: string
}

type CurveHeaderConfig = {
  key: string
  label: string
  unit?: string
  color: string
  lineWidth?: number
  lineStyle?: 'solid' | 'dashed' | 'dotted'
  headerLineCount?: 1 | 2
  scaleRows: HeaderScaleRow[]
}

type PdfImageResource = {
  name: string
  width: number
  height: number
  colorSpace: 'DeviceRGB' | 'DeviceGray'
  bitsPerComponent: number
  filter: 'DCTDecode' | 'FlateDecode'
  data: Buffer
}

type RenderedLogo = {
  resource: PdfImageResource
  x: number
  y: number
  width: number
  height: number
}

const DEFAULT_TEMPLATE: PlotTemplateConfig = {
  title: 'MD 1:500',
  scaleRatio: 500,
  depthPerPage: 150,
  depthStep: 50,
  minorDepthStep: 10,
  page: {
    size: 'a4',
    orientation: 'portrait',
    marginTop: PDF_STYLE.page.marginTop,
    marginRight: PDF_STYLE.page.marginRight,
    marginBottom: PDF_STYLE.page.marginBottom,
    marginLeft: PDF_STYLE.page.marginLeft,
    headerHeightFirstPage: 132,
    headerHeightOtherPages: 18,
    trackHeaderHeight: 172,
  },
  headerFields: [
    { label: 'Company', value: '' },
    { label: 'Well Name', source: 'wellName' },
    { label: 'Field', value: '' },
    { label: 'Rig Id', source: 'rigName' },
    { label: 'Well ID', value: '' },
    { label: 'Job number', value: '' },
    { label: 'Province', value: '' },
    { label: 'County/Parish', value: '' },
    { label: 'Country', value: '' },
    { label: 'Location', value: '' },
    { label: 'Start Date', value: '' },
    { label: 'End Date', value: '' },
  ],
  tracks: [
    {
      title: 'Pressure',
      min: 0,
      max: 4000,
      curves: [
        {
          key: 'annularPressure',
          label: 'Pressure - Anular',
          unit: '',
          min: 0,
          max: 4000,
          color: '#008000',
        },
        {
          key: 'borePressure',
          label: 'Pressure - Bore',
          unit: 'psi',
          min: 0,
          max: 4000,
          color: '#3333ff',
        },
        {
          key: 'standpipePressure',
          label: 'Pump Press',
          unit: 'PSI',
          min: 0,
          max: 4000,
          color: '#a00000',
        },
        {
          key: 'mwdPressure',
          label: 'APWD - memory',
          unit: '',
          min: 0,
          max: 4000,
          color: '#000000',
        },
      ],
    },
    {
      title: 'Density Depth',
      min: 0,
      max: 2000,
      curves: [
        {
          key: 'mudWeight',
          label: 'Mud Weight (SG)',
          unit: 'SG',
          min: 0,
          max: 2,
          color: '#008000',
        },
        {
          key: 'ecd',
          label: 'ECD from Annular Pressure - SG',
          unit: 'SG',
          min: 0,
          max: 2,
          color: '#a00000',
        },
        {
          key: 'hole_depth',
          label: 'Hole Depth',
          unit: 'm',
          min: 0,
          max: 2000,
          color: '#111111',
        },
        {
          key: 'ecd2',
          label: 'ECD - calc from memory',
          unit: '',
          min: 0,
          max: 2,
          color: '#cc8a00',
        },
      ],
    },
    {
      title: 'Dynamics',
      min: 0,
      max: 100,
      curves: [
        {
          key: 'shockAxial',
          label: 'Shock (ax,lat)',
          unit: 'g',
          min: 0,
          max: 90,
          color: '#cc3333',
        },
        {
          key: 'vibrationAxial',
          label: 'Vib (ax,lat)',
          unit: 'g',
          min: 0,
          max: 25,
          color: '#111111',
        },
        {
          key: 'ssi',
          label: 'SSI',
          unit: '',
          min: 0,
          max: 5,
          color: '#3333ff',
        },
        {
          key: 'downholeRpm',
          label: 'RPM Downhole',
          unit: '',
          min: 0,
          max: 100,
          color: '#111111',
        },
        {
          key: 'temperature',
          label: 'Temp',
          unit: '',
          min: 0,
          max: 100,
          color: '#008000',
        },
      ],
    },
    {
      title: 'Surface',
      min: 0,
      max: 30,
      curves: [
        {
          key: 'rop',
          label: 'ROP',
          unit: '',
          min: 0,
          max: 10,
          color: '#ff0000',
        },
        {
          key: 'hookLoad',
          label: 'WOB',
          unit: 'klbs',
          min: 0,
          max: 20,
          color: '#111111',
        },
        {
          key: 'hookPosition',
          label: 'hookpos',
          unit: 'm',
          min: 0,
          max: 30,
          color: '#008000',
        },
        {
          key: 'avo',
          label: 'AVO',
          unit: '',
          min: 0,
          max: 10,
          color: '#3333ff',
        },
      ],
    },
  ],
}

const db = prisma as unknown as {
  mWDSession: {
    findUnique: (args: unknown) => Promise<Record<string, unknown> | null>
  }
  mWDData: { findMany: (args: unknown) => Promise<Record<string, unknown>[]> }
  surveyStation: {
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>
  }
  witsConfig: {
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>
  }
  surveyConfig: {
    findUnique: (args: unknown) => Promise<Record<string, unknown> | null>
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const toFiniteNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  if (typeof value === 'object' && 'toString' in value) {
    const parsed = Number(value.toString())
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

const toPositiveNumber = (value: unknown, fallback: number) => {
  const parsed = toFiniteNumber(value)
  return parsed !== null && parsed > 0 ? parsed : fallback
}

const toNumberWithFallback = (value: unknown, fallback: number) => {
  const parsed = toFiniteNumber(value)
  return parsed !== null ? parsed : fallback
}

const normalizeHeaderFields = (value: unknown, fallback: HeaderField[]) => {
  if (!Array.isArray(value)) {
    return fallback
  }

  const fields = value
    .filter(isRecord)
    .map((item) => {
      const label = typeof item.label === 'string' ? item.label.trim() : ''
      const source =
        item.source === 'sessionCode' ||
        item.source === 'wellName' ||
        item.source === 'rigName'
          ? item.source
          : undefined
      const field: HeaderField = { label }

      if (source !== undefined) {
        field.source = source
      }

      if (item.value !== undefined && item.value !== null) {
        field.value = String(item.value)
      }

      return field
    })
    .filter((item) => item.label)

  return fields.length > 0 ? fields : fallback
}

const normalizeTracks = (value: unknown, fallback: PlotTrack[]) => {
  if (!Array.isArray(value)) {
    return fallback
  }

  const tracks = value
    .filter(isRecord)
    .map((item) => {
      const title = typeof item.title === 'string' ? item.title.trim() : ''
      const min = toFiniteNumber(item.min)
      const max = toFiniteNumber(item.max)
      const curves = Array.isArray(item.curves)
        ? item.curves
            .filter(isRecord)
            .map((curve) => {
              const key = typeof curve.key === 'string' ? curve.key.trim() : ''
              const parsed: PlotCurve = { key }

              if (typeof curve.label === 'string' && curve.label.trim()) {
                parsed.label = curve.label.trim()
              }

              if (typeof curve.unit === 'string') {
                parsed.unit = curve.unit.trim()
              }

              const min = toFiniteNumber(curve.min)
              const max = toFiniteNumber(curve.max)

              if (min !== null && max !== null && min !== max) {
                parsed.min = Math.min(min, max)
                parsed.max = Math.max(min, max)
              }

              if (typeof curve.color === 'string' && curve.color.trim()) {
                parsed.color = curve.color.trim()
              }

              if (
                curve.lineStyle === 'solid' ||
                curve.lineStyle === 'dashed' ||
                curve.lineStyle === 'dotted'
              ) {
                parsed.lineStyle = curve.lineStyle
              }

              const lineWidth = toFiniteNumber(curve.lineWidth)

              if (lineWidth !== null && lineWidth > 0) {
                parsed.lineWidth = lineWidth
              }

              return parsed
            })
            .filter((curve) => curve.key)
        : []

      if (
        !title ||
        min === null ||
        max === null ||
        min === max ||
        curves.length === 0
      ) {
        return null
      }

      const track: PlotTrack = {
        title,
        min: Math.min(min, max),
        max: Math.max(min, max),
        curves,
      }

      if (typeof item.unit === 'string') {
        track.unit = item.unit.trim()
      }

      return track
    })
    .filter((track): track is PlotTrack => track !== null)

  return tracks.length > 0 ? groupMwdTracks(tracks) : fallback
}

const toCurveFromTrack = (
  track: PlotTrack | undefined,
  fallbackKey: string,
  fallbackLabel: string,
  fallbackColor: string,
) => {
  const curve = track?.curves[0]
  const parsed: PlotCurve = {
    key: curve?.key ?? fallbackKey,
    label: curve?.label ?? track?.title ?? fallbackLabel,
    color: curve?.color ?? fallbackColor,
  }
  const min = curve?.min ?? track?.min
  const max = curve?.max ?? track?.max

  if (min !== undefined) {
    parsed.min = min
  }

  if (max !== undefined) {
    parsed.max = max
  }

  const unit = curve?.unit ?? track?.unit

  if (unit !== undefined) {
    parsed.unit = unit
  }

  if (curve?.lineWidth !== undefined) {
    parsed.lineWidth = curve.lineWidth
  }

  return parsed
}

const findTrackByCurveKey = (tracks: PlotTrack[], key: string) => {
  return tracks.find((track) => track.curves.some((curve) => curve.key === key))
}

const groupMwdTracks = (tracks: PlotTrack[]) => {
  if (tracks.length <= 4) {
    return tracks
  }

  const pressureTracks = [
    findTrackByCurveKey(tracks, 'annularPressure'),
    findTrackByCurveKey(tracks, 'borePressure'),
    findTrackByCurveKey(tracks, 'standpipePressure'),
    findTrackByCurveKey(tracks, 'mwdPressure'),
  ]
  const densityTracks = [
    findTrackByCurveKey(tracks, 'mudWeight'),
    findTrackByCurveKey(tracks, 'ecd'),
    findTrackByCurveKey(tracks, 'depthMd'),
    findTrackByCurveKey(tracks, 'ecd2'),
  ]
  const dynamicsTracks = [
    findTrackByCurveKey(tracks, 'shockAxial') ??
      findTrackByCurveKey(tracks, 'shock'),
    findTrackByCurveKey(tracks, 'vibrationAxial') ??
      findTrackByCurveKey(tracks, 'vibration'),
    findTrackByCurveKey(tracks, 'ssi'),
    findTrackByCurveKey(tracks, 'downholeRpm'),
    findTrackByCurveKey(tracks, 'temperature'),
  ]
  const surfaceTracks = [
    findTrackByCurveKey(tracks, 'rop'),
    findTrackByCurveKey(tracks, 'hookLoad'),
    findTrackByCurveKey(tracks, 'hookPosition'),
    findTrackByCurveKey(tracks, 'avo'),
  ]

  if (
    pressureTracks.filter(Boolean).length < 2 ||
    densityTracks.filter(Boolean).length < 2 ||
    dynamicsTracks.filter(Boolean).length < 2 ||
    surfaceTracks.filter(Boolean).length < 2
  ) {
    return tracks
  }

  return [
    {
      title: 'Pressure',
      min: 0,
      max: 4000,
      curves: [
        toCurveFromTrack(
          pressureTracks[0],
          'annularPressure',
          'Pressure - Annular',
          '#008000',
        ),
        toCurveFromTrack(
          pressureTracks[1],
          'borePressure',
          'Pressure - Bore',
          '#1f77b4',
        ),
        toCurveFromTrack(
          pressureTracks[2],
          'standpipePressure',
          'Pump Press',
          '#ff7f0e',
        ),
        toCurveFromTrack(
          pressureTracks[3],
          'mwdPressure',
          'APWD - memory',
          '#2ca02c',
        ),
      ],
    },
    {
      title: 'Density Depth',
      min: 0,
      max: 2000,
      curves: [
        toCurveFromTrack(
          densityTracks[0],
          'mudWeight',
          'Mud Weight (SG)',
          '#8c564b',
        ),
        toCurveFromTrack(
          densityTracks[1],
          'ecd',
          'ECD from Annular Pressure - SG',
          '#9467bd',
        ),
        toCurveFromTrack(
          densityTracks[2],
          'hole_depth',
          'Hole Depth',
          '#111111',
        ),
        toCurveFromTrack(
          densityTracks[3],
          'ecd2',
          'ECD - calc from memory',
          '#17becf',
        ),
      ],
    },
    {
      title: 'Dynamics',
      min: 0,
      max: 100,
      curves: [
        toCurveFromTrack(
          dynamicsTracks[0],
          'shockAxial',
          'Shock (ax,lat)',
          '#d62728',
        ),
        toCurveFromTrack(
          dynamicsTracks[1],
          'vibrationAxial',
          'Vib (ax,lat)',
          '#2ca02c',
        ),
        toCurveFromTrack(dynamicsTracks[2], 'ssi', 'SSI', '#17becf'),
        toCurveFromTrack(
          dynamicsTracks[3],
          'downholeRpm',
          'RPM Downhole',
          '#bcbd22',
        ),
        toCurveFromTrack(dynamicsTracks[4], 'temperature', 'Temp', '#e377c2'),
      ],
    },
    {
      title: 'Surface',
      min: 0,
      max: 30,
      curves: [
        toCurveFromTrack(surfaceTracks[0], 'rop', 'ROP', '#7f7f7f'),
        toCurveFromTrack(surfaceTracks[1], 'hookLoad', 'WOB', '#aec7e8'),
        toCurveFromTrack(
          surfaceTracks[2],
          'hookPosition',
          'hookpos',
          '#ff7f0e',
        ),
        toCurveFromTrack(surfaceTracks[3], 'avo', 'AVO', '#9467bd'),
      ],
    },
  ]
}

const normalizePageSettings = (
  value: unknown,
  fallback: PlotPageSettings,
): PlotPageSettings => {
  const page = isRecord(value) ? value : {}
  const orientation =
    page.orientation === 'landscape' ? 'landscape' : 'portrait'

  return {
    size: 'a4',
    orientation,
    marginTop: toPositiveNumber(page.marginTop, fallback.marginTop),
    marginRight: toPositiveNumber(page.marginRight, fallback.marginRight),
    marginBottom: toPositiveNumber(page.marginBottom, fallback.marginBottom),
    marginLeft: toPositiveNumber(page.marginLeft, fallback.marginLeft),
    headerHeightFirstPage: toPositiveNumber(
      page.headerHeightFirstPage,
      fallback.headerHeightFirstPage,
    ),
    headerHeightOtherPages: toPositiveNumber(
      page.headerHeightOtherPages,
      fallback.headerHeightOtherPages,
    ),
    trackHeaderHeight: toPositiveNumber(
      page.trackHeaderHeight,
      fallback.trackHeaderHeight,
    ),
  }
}

const normalizeLogo = (value: unknown, fallback?: PlotLogoConfig) => {
  if (value === null) {
    return undefined
  }

  if (!isRecord(value)) {
    return fallback
  }

  const dataUrl =
    typeof value.dataUrl === 'string' && value.dataUrl.trim()
      ? value.dataUrl.trim()
      : fallback?.dataUrl

  if (!dataUrl) {
    return undefined
  }

  const logo: PlotLogoConfig = { dataUrl }
  const width = toFiniteNumber(value.width)
  const height = toFiniteNumber(value.height)
  const x = toFiniteNumber(value.x)
  const y = toFiniteNumber(value.y)

  if (width !== null && width > 0) {
    logo.width = width
  } else if (fallback?.width !== undefined) {
    logo.width = fallback.width
  }

  if (height !== null && height > 0) {
    logo.height = height
  } else if (fallback?.height !== undefined) {
    logo.height = fallback.height
  }

  if (x !== null) {
    logo.x = x
  } else if (fallback?.x !== undefined) {
    logo.x = fallback.x
  }

  if (y !== null) {
    logo.y = y
  } else if (fallback?.y !== undefined) {
    logo.y = fallback.y
  }

  return logo
}

const mergeTemplateConfig = (
  fallback: PlotTemplateConfig,
  override?: unknown,
) => {
  if (!isRecord(override)) {
    return fallback
  }

  const logo = normalizeLogo(override.logo, fallback.logo)
  const config: PlotTemplateConfig = {
    title:
      typeof override.title === 'string' && override.title.trim()
        ? override.title.trim()
        : fallback.title,
    scaleRatio: toPositiveNumber(override.scaleRatio, fallback.scaleRatio),
    depthPerPage: toPositiveNumber(
      override.depthPerPage,
      fallback.depthPerPage,
    ),
    depthStep: toPositiveNumber(override.depthStep, fallback.depthStep),
    minorDepthStep: toPositiveNumber(
      override.minorDepthStep,
      fallback.minorDepthStep,
    ),
    page: normalizePageSettings(override.page, fallback.page),
    headerFields: normalizeHeaderFields(
      override.headerFields,
      fallback.headerFields,
    ),
    tracks: normalizeTracks(override.tracks, fallback.tracks),
  }

  if (logo) {
    config.logo = logo
  }

  return config
}

const escapePdfText = (value: unknown) => {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\x7e]/g, '')
}

const colorToRgb = (value: string | undefined, fallback: string) => {
  const color = /^#[0-9a-fA-F]{6}$/.test(value ?? '')
    ? (value ?? fallback)
    : fallback
  const r = Number.parseInt(color.slice(1, 3), 16) / 255
  const g = Number.parseInt(color.slice(3, 5), 16) / 255
  const b = Number.parseInt(color.slice(5, 7), 16) / 255

  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`
}

const formatNumber = (value: number) => {
  if (Number.isInteger(value)) {
    return String(value)
  }

  return value.toFixed(4).replace(/0+$/g, '').replace(/\.$/g, '')
}

const chooseDepthStep = (
  preferredStep: number,
  depthSpan: number,
  maxLines: number,
) => {
  if (
    depthSpan <= 0 ||
    preferredStep <= 0 ||
    depthSpan / preferredStep <= maxLines
  ) {
    return preferredStep
  }

  const rawStep = depthSpan / maxLines
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const normalized = rawStep / magnitude
  const multiplier =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10

  return multiplier * magnitude
}

const formatDateTime = (value: Date | null) => {
  if (!value) {
    return ''
  }

  const pad = (input: number) => String(input).padStart(2, '0')

  return `${pad(value.getUTCDate())}/${pad(value.getUTCMonth() + 1)}/${value.getUTCFullYear()} ${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`
}

const truncate = (value: string, maxLength: number) => {
  return value.length > maxLength
    ? `${value.slice(0, Math.max(0, maxLength - 1))}.`
    : value
}

const estimateTextWidth = (value: string, size: number) => {
  return value.length * size * 0.48
}

const readUInt32 = (buffer: Buffer, offset: number) => {
  return buffer.readUInt32BE(offset)
}

const parseDataUrl = (value: string) => {
  const match = value.match(/^data:([^;,]+);base64,(.+)$/i)

  if (!match) {
    return null
  }

  const [, mimeType, data] = match

  if (!mimeType || !data) {
    return null
  }

  return {
    mimeType: mimeType.toLowerCase(),
    data: Buffer.from(data, 'base64'),
  }
}

const parseJpegImage = (
  data: Buffer,
  name: string,
): PdfImageResource | null => {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) {
    return null
  }

  let offset = 2

  while (offset < data.length - 1) {
    if (data[offset] !== 0xff) {
      offset += 1
      continue
    }

    while (data[offset] === 0xff) {
      offset += 1
    }

    const marker = data[offset]
    offset += 1

    if (marker === undefined || marker === 0xd9 || marker === 0xda) {
      break
    }

    if (offset + 2 > data.length) {
      break
    }

    const length = data.readUInt16BE(offset)

    if (length < 2 || offset + length > data.length) {
      break
    }

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)

    if (isStartOfFrame && offset + 8 <= data.length) {
      const bitsPerComponent = data[offset + 2] ?? 8
      const height = data.readUInt16BE(offset + 3)
      const width = data.readUInt16BE(offset + 5)
      const components = data[offset + 7] ?? 3

      return {
        name,
        width,
        height,
        colorSpace: components === 1 ? 'DeviceGray' : 'DeviceRGB',
        bitsPerComponent,
        filter: 'DCTDecode',
        data,
      }
    }

    offset += length
  }

  return null
}

const paethPredictor = (left: number, above: number, upperLeft: number) => {
  const estimate = left + above - upperLeft
  const leftDistance = Math.abs(estimate - left)
  const aboveDistance = Math.abs(estimate - above)
  const upperLeftDistance = Math.abs(estimate - upperLeft)

  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) {
    return left
  }

  if (aboveDistance <= upperLeftDistance) {
    return above
  }

  return upperLeft
}

const unfilterPngScanlines = (
  inflated: Buffer,
  width: number,
  height: number,
  bytesPerPixel: number,
) => {
  const rowLength = width * bytesPerPixel
  const output = Buffer.alloc(rowLength * height)
  let inputOffset = 0

  for (let row = 0; row < height; row += 1) {
    const filterType = inflated[inputOffset]
    inputOffset += 1

    const outputOffset = row * rowLength
    const previousOffset = outputOffset - rowLength

    for (let column = 0; column < rowLength; column += 1) {
      const raw = inflated[inputOffset + column] ?? 0
      const left =
        column >= bytesPerPixel
          ? (output[outputOffset + column - bytesPerPixel] ?? 0)
          : 0
      const above = row > 0 ? (output[previousOffset + column] ?? 0) : 0
      const upperLeft =
        row > 0 && column >= bytesPerPixel
          ? (output[previousOffset + column - bytesPerPixel] ?? 0)
          : 0
      let value = raw

      if (filterType === 1) {
        value = raw + left
      } else if (filterType === 2) {
        value = raw + above
      } else if (filterType === 3) {
        value = raw + Math.floor((left + above) / 2)
      } else if (filterType === 4) {
        value = raw + paethPredictor(left, above, upperLeft)
      } else if (filterType !== 0) {
        return null
      }

      output[outputOffset + column] = value & 0xff
    }

    inputOffset += rowLength
  }

  return output
}

const parsePngImage = (data: Buffer, name: string): PdfImageResource | null => {
  const signature = '89504e470d0a1a0a'

  if (data.length < 8 || data.subarray(0, 8).toString('hex') !== signature) {
    return null
  }

  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlaceMethod = 0
  const idatChunks: Buffer[] = []

  while (offset + 12 <= data.length) {
    const length = readUInt32(data, offset)
    const type = data.subarray(offset + 4, offset + 8).toString('ascii')
    const chunkStart = offset + 8
    const chunkEnd = chunkStart + length

    if (chunkEnd + 4 > data.length) {
      return null
    }

    const chunkData = data.subarray(chunkStart, chunkEnd)

    if (type === 'IHDR') {
      width = readUInt32(chunkData, 0)
      height = readUInt32(chunkData, 4)
      bitDepth = chunkData[8] ?? 0
      colorType = chunkData[9] ?? 0
      interlaceMethod = chunkData[12] ?? 0
    } else if (type === 'IDAT') {
      idatChunks.push(chunkData)
    } else if (type === 'IEND') {
      break
    }

    offset = chunkEnd + 4
  }

  if (
    width <= 0 ||
    height <= 0 ||
    bitDepth !== 8 ||
    interlaceMethod !== 0 ||
    idatChunks.length === 0
  ) {
    return null
  }

  const bytesPerPixel =
    colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 6 ? 4 : 0

  if (bytesPerPixel === 0) {
    return null
  }

  const inflated = inflateSync(Buffer.concat(idatChunks))
  const unfiltered = unfilterPngScanlines(
    inflated,
    width,
    height,
    bytesPerPixel,
  )

  if (!unfiltered) {
    return null
  }

  if (colorType === 0) {
    return {
      name,
      width,
      height,
      colorSpace: 'DeviceGray',
      bitsPerComponent: 8,
      filter: 'FlateDecode',
      data: deflateSync(unfiltered),
    }
  }

  if (colorType === 2) {
    return {
      name,
      width,
      height,
      colorSpace: 'DeviceRGB',
      bitsPerComponent: 8,
      filter: 'FlateDecode',
      data: deflateSync(unfiltered),
    }
  }

  const rgb = Buffer.alloc(width * height * 3)

  for (
    let source = 0, target = 0;
    source < unfiltered.length;
    source += 4, target += 3
  ) {
    const alpha = (unfiltered[source + 3] ?? 255) / 255
    rgb[target] = Math.round(
      (unfiltered[source] ?? 255) * alpha + 255 * (1 - alpha),
    )
    rgb[target + 1] = Math.round(
      (unfiltered[source + 1] ?? 255) * alpha + 255 * (1 - alpha),
    )
    rgb[target + 2] = Math.round(
      (unfiltered[source + 2] ?? 255) * alpha + 255 * (1 - alpha),
    )
  }

  return {
    name,
    width,
    height,
    colorSpace: 'DeviceRGB',
    bitsPerComponent: 8,
    filter: 'FlateDecode',
    data: deflateSync(rgb),
  }
}

const parseImageResource = (dataUrl: string, name: string) => {
  const parsed = parseDataUrl(dataUrl)

  if (!parsed) {
    return null
  }

  if (parsed.mimeType === 'image/jpeg' || parsed.mimeType === 'image/jpg') {
    return parseJpegImage(parsed.data, name)
  }

  if (parsed.mimeType === 'image/png') {
    return parsePngImage(parsed.data, name)
  }

  return null
}

const buildLogo = (logo?: PlotLogoConfig): RenderedLogo | null => {
  if (!logo) {
    return null
  }

  const resource = parseImageResource(logo.dataUrl, 'Logo1')

  if (!resource) {
    return null
  }

  // BJG/Polaris-style logo: small, fixed, and never stretched.
  const maxWidth = 70
  const maxHeight = 28
  const aspectRatio = resource.width / resource.height
  const requestedWidth = Math.min(logo.width ?? maxWidth, maxWidth)
  const requestedHeight = logo.height
    ? Math.min(logo.height, maxHeight)
    : requestedWidth / aspectRatio
  const scale = Math.min(
    maxWidth / requestedWidth,
    maxHeight / requestedHeight,
    1,
  )
  const width = requestedWidth * scale
  const height = requestedHeight * scale

  return {
    resource,
    x: logo.x ?? PDF_STYLE.page.marginLeft,
    y: logo.y ?? PDF_STYLE.page.marginTop,
    width,
    height,
  }
}

class PdfPageBuilder {
  private readonly parts: string[] = []

  constructor(
    private readonly width: number,
    private readonly height: number,
  ) {}

  private y(top: number) {
    return this.height - top
  }

  line(
    x1: number,
    topY1: number,
    x2: number,
    topY2: number,
    color = '#000000',
    width = 0.5,
  ) {
    this.parts.push(
      `q ${colorToRgb(color, '#000000')} RG ${width} w ${x1.toFixed(2)} ${this.y(topY1).toFixed(2)} m ${x2.toFixed(2)} ${this.y(topY2).toFixed(2)} l S Q`,
    )
  }

  rect(
    x: number,
    topY: number,
    width: number,
    height: number,
    color = '#000000',
    lineWidth = 0.5,
  ) {
    this.parts.push(
      `q ${colorToRgb(color, '#000000')} RG ${lineWidth} w ${x.toFixed(2)} ${(this.y(topY) - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S Q`,
    )
  }

  fillRect(
    x: number,
    topY: number,
    width: number,
    height: number,
    color = '#f2f2f2',
  ) {
    this.parts.push(
      `q ${colorToRgb(color, '#f2f2f2')} rg ${x.toFixed(2)} ${(this.y(topY) - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f Q`,
    )
  }

  text(
    value: unknown,
    x: number,
    topY: number,
    size = 12,
    color = '#000000',
    weight: PdfFontWeight = 'regular',
  ) {
    const fontResource = weight === 'bold' ? 'F2' : 'F1'

    this.parts.push(
      `q ${colorToRgb(color, '#000000')} rg BT /${fontResource} ${size} Tf ${x.toFixed(2)} ${(this.y(topY) - size).toFixed(2)} Td (${escapePdfText(value)}) Tj ET Q`,
    )
  }

  textCenter(
    value: unknown,
    centerX: number,
    topY: number,
    size = 12,
    color = '#000000',
    weight: PdfFontWeight = 'regular',
  ) {
    const text = String(value ?? '')
    const x = centerX - estimateTextWidth(text, size) / 2
    this.text(text, x, topY, size, color, weight)
  }

  image(name: string, x: number, topY: number, width: number, height: number) {
    this.parts.push(
      `q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${(this.y(topY) - height).toFixed(2)} cm /${name} Do Q`,
    )
  }

  polyline(points: PdfPoint[], color = '#000000', lineWidth = 0.8) {
    const firstPoint = points[0]

    if (!firstPoint || points.length < 2) {
      return
    }

    const path = [
      `${firstPoint.x.toFixed(2)} ${firstPoint.y.toFixed(2)} m`,
      ...points
        .slice(1)
        .map((point) => `${point.x.toFixed(2)} ${point.y.toFixed(2)} l`),
    ].join(' ')

    this.parts.push(
      `q ${colorToRgb(color, '#000000')} RG ${lineWidth} w ${path} S Q`,
    )
  }

  dashedPolyline(
    points: PdfPoint[],
    color = '#000000',
    lineWidth = 0.8,
    dash = 4,
    gap = 5,
  ) {
    const firstPoint = points[0]

    if (!firstPoint || points.length < 2) {
      return
    }

    const path = [
      `${firstPoint.x.toFixed(2)} ${firstPoint.y.toFixed(2)} m`,
      ...points
        .slice(1)
        .map((point) => `${point.x.toFixed(2)} ${point.y.toFixed(2)} l`),
    ].join(' ')

    this.parts.push(
      `q ${colorToRgb(color, '#000000')} RG ${lineWidth} w [${dash} ${gap}] 0 d ${path} S Q`,
    )
  }

  build() {
    return this.parts.join('\n')
  }
}

class SimplePdfDocument {
  private readonly pages: PdfPageContent[] = []

  constructor(private readonly images: PdfImageResource[] = []) {}

  addPage(content: string, width: number, height: number) {
    this.pages.push({ content, width, height })
  }

  build() {
    const objects: Buffer[] = []
    const imageStartObjectId = 5
    const pageStartObjectId = imageStartObjectId + this.images.length
    const kids = this.pages
      .map((_page, index) => `${pageStartObjectId + index * 2} 0 R`)
      .join(' ')

    objects.push(Buffer.from('<< /Type /Catalog /Pages 2 0 R >>', 'utf8'))
    objects.push(
      Buffer.from(
        `<< /Type /Pages /Count ${this.pages.length} /Kids [${kids}] >>`,
        'utf8',
      ),
    )
    objects.push(
      Buffer.from(
        `<< /Type /Font /Subtype /Type1 /BaseFont /${PDF_STYLE.font.regular} >>`,
        'utf8',
      ),
    )
    objects.push(
      Buffer.from(
        `<< /Type /Font /Subtype /Type1 /BaseFont /${PDF_STYLE.font.bold} >>`,
        'utf8',
      ),
    )

    for (const image of this.images) {
      const imageDictionary =
        `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ` +
        `/ColorSpace /${image.colorSpace} /BitsPerComponent ${image.bitsPerComponent} ` +
        `/Filter /${image.filter} /Length ${image.data.length} >>\nstream\n`
      objects.push(
        Buffer.concat([
          Buffer.from(imageDictionary, 'utf8'),
          image.data,
          Buffer.from('\nendstream', 'utf8'),
        ]),
      )
    }

    const xObjectEntries = this.images
      .map((image, index) => `/${image.name} ${imageStartObjectId + index} 0 R`)
      .join(' ')
    const xObjectResource = xObjectEntries
      ? `/XObject << ${xObjectEntries} >>`
      : ''

    for (const [index, page] of this.pages.entries()) {
      const pageObjectId = pageStartObjectId + index * 2
      const contentObjectId = pageObjectId + 1

      objects.push(
        Buffer.from(
          `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width.toFixed(2)} ${page.height.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${xObjectResource} >> /Contents ${contentObjectId} 0 R >>`,
          'utf8',
        ),
      )
      objects.push(
        Buffer.from(
          `<< /Length ${Buffer.byteLength(page.content, 'utf8')} >>\nstream\n${page.content}\nendstream`,
          'utf8',
        ),
      )
    }

    const chunks = [Buffer.from('%PDF-1.4\n', 'utf8')]
    const offsets = [0]
    let byteLength = chunks[0]?.length ?? 0

    for (const [index, object] of objects.entries()) {
      offsets[index + 1] = byteLength
      const objectBuffer = Buffer.concat([
        Buffer.from(`${index + 1} 0 obj\n`, 'utf8'),
        object,
        Buffer.from('\nendobj\n', 'utf8'),
      ])
      chunks.push(objectBuffer)
      byteLength += objectBuffer.length
    }

    const xrefOffset = byteLength
    let trailer = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`

    for (let index = 1; index <= objects.length; index += 1) {
      const offset = offsets[index] ?? 0
      trailer += `${String(offset).padStart(10, '0')} 00000 n \n`
    }

    trailer += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
    chunks.push(Buffer.from(trailer, 'utf8'))

    return Buffer.concat(chunks)
  }
}

const resolveHeaderValue = (field: HeaderField, input: PdfPlotInput) => {
  if (field.source === 'sessionCode') {
    return input.sessionCode
  }

  if (field.source === 'wellName') {
    return input.wellName ?? ''
  }

  if (field.source === 'rigName') {
    return input.rigName ?? ''
  }

  return field.value ?? ''
}

const withSessionHeaderValues = (
  config: PlotTemplateConfig,
  metadata: SessionMetadata,
) => {
  const valuesByLabel = new Map<string, string>([
    ['company', formatSurveyText(metadata.company)],
    ['well name', formatSurveyText(metadata.wellName)],
    ['field', formatSurveyText(metadata.fieldName)],
    ['rig id', formatSurveyText(metadata.rigName)],
    ['rig name', formatSurveyText(metadata.rigName)],
    ['well id', formatSurveyText(metadata.wellId)],
    ['api', formatSurveyText(metadata.wellId)],
    ['api / well id', formatSurveyText(metadata.wellId)],
    ['job number', formatSurveyText(metadata.jobNumber)],
    ['province', formatSurveyText(metadata.province)],
    ['state/province', formatSurveyText(metadata.province)],
    ['county/parish', formatSurveyText(metadata.countyParish)],
    ['county', formatSurveyText(metadata.countyParish)],
    ['country', formatSurveyText(metadata.country)],
    ['location', formatSurveyText(metadata.location)],
    ['start date', formatSurveyDate(metadata.startedAt)],
    ['end date', formatSurveyDate(metadata.endedAt)],
  ])

  return {
    ...config,
    headerFields: config.headerFields.map((field) => {
      if (field.value || field.source) {
        return field
      }

      const value = valuesByLabel.get(field.label.trim().toLowerCase())

      return value ? { ...field, value } : field
    }),
  }
}

const getPageSize = (settings: PlotPageSettings) => {
  const portrait = { width: 595.44, height: 841.68 }

  if (settings.orientation === 'landscape') {
    return { width: portrait.height, height: portrait.width }
  }

  return portrait
}

const MM_TO_PT = 72 / 25.4
const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297
const MIN_LONG_LOG_HEIGHT_MM = 2344

const mmToPoints = (value: number) => value * MM_TO_PT

const getReportPageSize = () => ({
  width: mmToPoints(A4_WIDTH_MM),
  height: mmToPoints(A4_HEIGHT_MM),
})

const getLongLogPlotPageSize = (
  config: PlotTemplateConfig,
  startDepth: number,
  endDepth: number,
) => {
  const width = mmToPoints(A4_WIDTH_MM)
  const depthSpan = Math.max(1, endDepth - startDepth)
  const plottedDepthMm = (depthSpan * 1000) / Math.max(1, config.scaleRatio)
  const fixedChromeHeightPt =
    config.page.marginTop +
    config.page.headerHeightFirstPage +
    config.page.trackHeaderHeight +
    config.page.marginBottom +
    18
  const height = Math.max(
    mmToPoints(MIN_LONG_LOG_HEIGHT_MM),
    fixedChromeHeightPt + mmToPoints(plottedDepthMm),
  )

  return { width, height }
}

const toPolarisLogPageSettings = (
  settings: PlotPageSettings,
): PlotPageSettings => ({
  ...settings,
  marginTop: Math.min(settings.marginTop, 20),
  marginRight: Math.min(settings.marginRight, 20),
  marginBottom: Math.min(settings.marginBottom, 20),
  marginLeft: Math.min(settings.marginLeft, 20),
  headerHeightFirstPage: Math.min(settings.headerHeightFirstPage, 140),
  headerHeightOtherPages: Math.min(settings.headerHeightOtherPages, 20),
  trackHeaderHeight: Math.min(settings.trackHeaderHeight, 172),
})

const toPolarisLogTemplate = (
  config: PlotTemplateConfig,
): PlotTemplateConfig => ({
  ...config,
  depthPerPage: Math.max(config.depthPerPage, 1),
  page: toPolarisLogPageSettings(config.page),
})

const POLARIS_CURVE_STYLES: Record<
  string,
  Partial<Pick<PlotCurve, 'label' | 'unit' | 'color' | 'lineWidth' | 'lineStyle' | 'min' | 'max'>>
> = {
  annularPressure: {
    label: 'Pressure - Anular',
    unit: '',
    color: '#008000',
    lineWidth: 2,
    lineStyle: 'solid',
    min: 0,
    max: 4000,
  },
  borePressure: {
    label: 'Pressure - Bore',
    unit: 'psi',
    color: '#3333ff',
    lineWidth: 2,
    lineStyle: 'solid',
    min: 0,
    max: 4000,
  },
  standpipePressure: {
    label: 'Pump Press',
    unit: 'PSI',
    color: '#a00000',
    lineWidth: 2,
    lineStyle: 'solid',
    min: 0,
    max: 4000,
  },
  mwdPressure: {
    label: 'APWD - memory',
    unit: '',
    color: '#000000',
    lineWidth: 2,
    lineStyle: 'dashed',
    min: 0,
    max: 4000,
  },
  mudWeight: {
    label: 'Mud Weight (SG)',
    unit: 'SG',
    color: '#008000',
    lineWidth: 2,
    lineStyle: 'solid',
    min: 0,
    max: 2,
  },
  ecd: {
    label: 'ECD from Annular Pressure - SG',
    unit: 'SG',
    color: '#a00000',
    lineWidth: 2,
    lineStyle: 'solid',
    min: 0,
    max: 2,
  },
  hole_depth: {
    label: 'Hole Depth',
    unit: 'm',
    color: '#111111',
    lineWidth: 2,
    lineStyle: 'solid',
    min: 0,
    max: 2000,
  },
  ecd2: {
    label: 'ECD - calc from memory',
    unit: '',
    color: '#cc8a00',
    lineWidth: 2,
    lineStyle: 'dashed',
    min: 0,
    max: 2,
  },
  shockAxial: {
    label: 'Shock (ax,lat)',
    unit: 'g',
    color: '#cc3333',
    lineWidth: 1,
    lineStyle: 'solid',
    min: 0,
    max: 90,
  },
  vibrationAxial: {
    label: 'Vib (ax,lat)',
    unit: '',
    color: '#111111',
    lineWidth: 1,
    lineStyle: 'solid',
    min: 0,
    max: 25,
  },
  ssi: {
    label: 'SSI',
    unit: '',
    color: '#3333ff',
    lineWidth: 1,
    lineStyle: 'solid',
    min: 0,
    max: 5,
  },
  downholeRpm: {
    label: 'RPM Downhole',
    unit: '',
    color: '#111111',
    lineWidth: 1,
    lineStyle: 'solid',
    min: 0,
    max: 100,
  },
  temperature: {
    label: 'Temp',
    unit: '',
    color: '#008000',
    lineWidth: 1,
    lineStyle: 'solid',
    min: 0,
    max: 100,
  },
  rop: {
    label: 'ROP',
    unit: '',
    color: '#ff0000',
    lineWidth: 1,
    lineStyle: 'solid',
    min: 0,
    max: 10,
  },
  hookLoad: {
    label: 'WOB',
    unit: 'klbs',
    color: '#111111',
    lineWidth: 1,
    lineStyle: 'solid',
    min: 0,
    max: 20,
  },
  hookPosition: {
    label: 'hookpos',
    unit: 'm',
    color: '#008000',
    lineWidth: 1,
    lineStyle: 'solid',
    min: 0,
    max: 30,
  },
  avo: {
    label: 'AVO',
    unit: '',
    color: '#3333ff',
    lineWidth: 2,
    lineStyle: 'dashed',
    min: 0,
    max: 10,
  },
}

const BJG_CURVE_HEADER_CONFIGS: Record<string, CurveHeaderConfig> = {
  annularPressure: {
    key: 'annularPressure',
    label: 'Pressure - Anular',
    unit: '',
    color: '#008000',
    lineWidth: 2,
    lineStyle: 'solid',
    headerLineCount: 2,
    scaleRows: [
      { left: '0', right: '2000' },
      { left: '2000', right: '4000' },
    ],
  },
  borePressure: {
    key: 'borePressure',
    label: 'Pressure - Bore',
    unit: 'psi',
    color: '#3333ff',
    lineWidth: 2,
    lineStyle: 'solid',
    headerLineCount: 2,
    scaleRows: [
      { left: '0', right: '2000' },
      { left: '2000', right: '4000' },
    ],
  },
  standpipePressure: {
    key: 'standpipePressure',
    label: 'Pump Press',
    unit: 'PSI',
    color: '#a00000',
    lineWidth: 2,
    lineStyle: 'solid',
    headerLineCount: 2,
    scaleRows: [
      { left: '0', right: '2000' },
      { left: '2000', right: '4000' },
    ],
  },
  mwdPressure: {
    key: 'mwdPressure',
    label: 'APWD - memory',
    color: '#000000',
    lineWidth: 2,
    lineStyle: 'dashed',
    headerLineCount: 2,
    scaleRows: [
      { left: '0', right: '2000' },
      { left: '2000', right: '4000' },
    ],
  },
  mudWeight: {
    key: 'mudWeight',
    label: 'Mud Weight (SG)',
    unit: 'SG',
    lineWidth: 2,
    color: '#008000',
    lineStyle: 'solid',
    scaleRows: [{ left: '0', right: '2' }],
  },
  ecd: {
    key: 'ecd',
    label: 'ECD from Annular Pressure - SG',
    unit: 'SG',
    lineWidth: 2,
    color: '#a00000',
    lineStyle: 'solid',
    scaleRows: [{ left: '0', right: '2' }],
  },
  hole_depth: {
    key: 'hole_depth',
    label: 'Hole Depth',
    unit: 'm',
    lineWidth: 2,
    color: '#111111',
    lineStyle: 'solid',
    headerLineCount: 2,
    scaleRows: [
      { left: '0', right: '1000' },
      { left: '1000', right: '2000' },
    ],
  },
  ecd2: {
    key: 'ecd2',
    label: 'ECD - calc from memory',
    lineWidth: 2,
    color: '#cc8a00',
    lineStyle: 'dashed',
    scaleRows: [{ left: '0', right: '2' }],
  },
  shockAxial: {
    key: 'shockAxial',
    label: 'Shock (ax,lat)',
    lineWidth: 1,
    color: '#cc3333',
    lineStyle: 'solid',
    headerLineCount: 2,
    scaleRows: [
      { left: '0', right: '45' },
      { left: '45', right: '90' },
    ],
  },
  vibrationAxial: {
    key: 'vibrationAxial',
    label: 'Vib (ax,lat)',
    color: '#111111',
    lineWidth: 1,
    lineStyle: 'solid',
    scaleRows: [{ left: '0.01', right: '25' }],
  },
  ssi: {
    key: 'ssi',
    label: 'SSI',
    color: '#3333ff',
    lineWidth: 1,
    lineStyle: 'solid',
    scaleRows: [{ left: '0.01', right: '5' }],
  },
  downholeRpm: {
    key: 'downholeRpm',
    label: 'RPM Downhole',
    unit: '',
    color: '#111111',
    lineWidth: 1,
    lineStyle: 'solid',
    headerLineCount: 2,
    scaleRows: [
      { left: '0.01', right: '50' },
      { left: '50', right: '99.99' },
    ],
  },
  temperature: {
    key: 'temperature',
    label: 'Temp',
    unit: '',
    color: '#008000',
    lineWidth: 1,
    lineStyle: 'solid',
    scaleRows: [{ left: '0.01', right: '100' }],
  },
  rop: {
    key: 'rop',
    label: 'ROP',
    color: '#ff0000',
    lineWidth: 1,
    lineStyle: 'solid',
    scaleRows: [{ left: '0', right: '10' }],
  },
  hookLoad: {
    key: 'hookLoad',
    label: 'WOB',
    unit: 'klbs',
    color: '#111111',
    lineWidth: 1,
    lineStyle: 'solid',
    headerLineCount: 2,
    scaleRows: [
      { left: '0.01', right: '10' },
      { left: '10', right: '19.99' },
    ],
  },
  hookPosition: {
    key: 'hookPosition',
    label: 'hookpos',
    unit: 'm',
    color: '#008000',
    lineWidth: 1,
    lineStyle: 'solid',
    scaleRows: [{ left: '0.01', right: '30' }],
  },
  avo: {
    key: 'avo',
    label: 'AVO',
    color: '#3333ff',
    lineWidth: 1,
    lineStyle: 'dashed',
    headerLineCount: 2,
    scaleRows: [
      { left: '0.01', right: '5' },
      { left: '5', right: '9.99' },
    ],
  },
}

const applyPolarisCurveStyles = (config: PlotTemplateConfig): PlotTemplateConfig => ({
  ...config,
  tracks: config.tracks.map((track) => ({
    ...track,
    curves: track.curves.map((curve) => ({
      ...curve,
      ...(POLARIS_CURVE_STYLES[curve.key] ?? {}),
    })),
  })),
})

const collectCurveKeys = (tracks: PlotTrack[]) => {
  const fieldNames = new Set<string>(MWD_MEASUREMENT_FIELDS)

  return Array.from(
    new Set(
      tracks.flatMap((track) =>
        track.curves
          .map((curve) => curve.key)
          .filter((key) => fieldNames.has(key)),
      ),
    ),
  ) as MeasurementField[]
}

const isWitsIdKey = (value: string) => {
  return /^\d{4}$/.test(value.trim())
}

const resolveWitsCurveKeys = async (config: PlotTemplateConfig) => {
  const fieldNames = new Set<string>(MWD_MEASUREMENT_FIELDS)
  const witsIds = Array.from(
    new Set(
      config.tracks.flatMap((track) =>
        track.curves.map((curve) => curve.key.trim()).filter(isWitsIdKey),
      ),
    ),
  )

  if (witsIds.length === 0) {
    return config
  }

  const configs = await db.witsConfig.findMany({
    where: {
      witsId: { in: witsIds },
    },
    select: {
      witsId: true,
      name: true,
      units: true,
      mappedField: true,
      plotScaleLeft: true,
      plotScaleRight: true,
      lineColor: true,
    },
  })
  const configByWitsId = new Map(
    configs.map((item) => [String(item.witsId), item]),
  )

  return {
    ...config,
    tracks: config.tracks.map((track) => ({
      ...track,
      curves: track.curves.map((curve) => {
        const witsConfig = configByWitsId.get(curve.key)
        const mappedField =
          typeof witsConfig?.mappedField === 'string'
            ? witsConfig.mappedField
            : ''

        if (!fieldNames.has(mappedField)) {
          return curve
        }

        const nextCurve: PlotCurve = {
          ...curve,
          key: mappedField,
        }
        const label =
          curve.label ??
          (typeof witsConfig?.name === 'string' ? witsConfig.name : curve.key)
        const unit =
          curve.unit ??
          (typeof witsConfig?.units === 'string' ? witsConfig.units : undefined)
        const min = curve.min ?? toFiniteNumber(witsConfig?.plotScaleLeft)
        const max = curve.max ?? toFiniteNumber(witsConfig?.plotScaleRight)
        const color =
          curve.color ??
          (typeof witsConfig?.lineColor === 'string'
            ? witsConfig.lineColor
            : undefined)

        if (label !== undefined) {
          nextCurve.label = label
        }

        if (unit !== undefined) {
          nextCurve.unit = unit
        }

        if (min !== null && min !== undefined) {
          nextCurve.min = min
        }

        if (max !== null && max !== undefined) {
          nextCurve.max = max
        }

        if (color !== undefined) {
          nextCurve.color = color
        }

        return nextCurve
      }),
    })),
  }
}

const fetchPlotRows = async (
  input: PdfPlotInput,
  curveKeys: MeasurementField[],
) => {
  const select: Record<string, boolean> = {
    measuredAt: true,
    depthMd: true,
  }

  for (const key of curveKeys) {
    select[key] = true
  }

  const depthFilter: Record<string, number> = {}

  if (input.depthMin !== undefined) {
    depthFilter.gte = input.depthMin
  }

  if (input.depthMax !== undefined) {
    depthFilter.lte = input.depthMax
  }

  const rows = await db.mWDData.findMany({
    where: {
      sessionId: input.sessionId,
      isHidden: false,
      ...(Object.keys(depthFilter).length > 0 ? { depthMd: depthFilter } : {}),
    },
    orderBy: [{ depthMd: 'asc' }, { measuredAt: 'asc' }],
    select,
  })

  return rows
    .map((row) => {
      const depth = toFiniteNumber(row.depthMd)

      if (depth === null) {
        return null
      }

      const values: Record<string, number | null> = {}

      for (const key of curveKeys) {
        values[key] = toFiniteNumber(row[key])
      }

      return {
        depth,
        measuredAt: row.measuredAt instanceof Date ? row.measuredAt : null,
        values,
      }
    })
    .filter((row): row is PlotRow => row !== null)
    .sort((left, right) => left.depth - right.depth)
}

const resolvePlotDepthRange = (
  input: PdfPlotInput,
  config: PlotTemplateConfig,
  rows: PlotRow[],
) => {
  const depthValues = rows.map((row) => row.depth)
  const dataStart = depthValues[0]
  const dataEnd = depthValues[depthValues.length - 1]
  const defaultStartDepth = dataStart ?? 100
  const defaultEndDepth = dataEnd ?? defaultStartDepth + config.depthPerPage
  const firstDepth = input.depthMin ?? defaultStartDepth
  const lastDepth =
    input.depthMax ?? defaultEndDepth ?? dataEnd ?? firstDepth + config.depthPerPage
  let startDepth = Math.min(firstDepth, lastDepth)
  let endDepth = Math.max(firstDepth, lastDepth)

  if (endDepth <= startDepth) {
    const padding = Math.max(1, config.minorDepthStep || 1)
    startDepth -= padding / 2
    endDepth += padding / 2
  }

  return { startDepth, endDepth }
}

const fetchSurveyConfigMetadata = async (sessionId: number) => {
  try {
    return await db.surveyConfig.findUnique({
      where: { sessionId },
      select: {
        wellName: true,
        rigName: true,
        companyName: true,
        fieldName: true,
        location: true,
        northReference: true,
        declination: true,
        proposedAzimuth: true,
        latitude: true,
        longitude: true,
        elevationKb: true,
        elevationDf: true,
        elevationGl: true,
      },
    })
  } catch (error) {
    const code = isRecord(error) ? error.code : undefined
    if (code === 'P2021') {
      return null
    }

    throw error
  }
}

const fetchSessionMetadata = async (
  input: PdfPlotInput,
): Promise<SessionMetadata> => {
  const [session, surveyConfig] = await Promise.all([
    db.mWDSession.findUnique({
      where: { id: input.sessionId },
      select: {
        sessionCode: true,
        company: true,
        wellName: true,
        wellId: true,
        rigName: true,
        fieldName: true,
        jobNumber: true,
        province: true,
        countyParish: true,
        country: true,
        location: true,
        latitude: true,
        longitude: true,
        startedAt: true,
        endedAt: true,
      },
    }),
    fetchSurveyConfigMetadata(input.sessionId),
  ])

  const readText = (key: string, fallback?: string | null) => {
    const value = session?.[key]

    return typeof value === 'string' && value.trim()
      ? value.trim()
      : (fallback ?? null)
  }

  const readConfigText = (key: string, fallback?: string | null) => {
    const value = surveyConfig?.[key]

    return typeof value === 'string' && value.trim()
      ? value.trim()
      : (fallback ?? null)
  }

  const readConfigNumber = (key: string, fallback: number | null = null) => {
    const parsed = toFiniteNumber(surveyConfig?.[key])
    return parsed !== null ? parsed : fallback
  }

  return {
    sessionCode:
      readText('sessionCode', input.sessionCode) ?? input.sessionCode,
    company: readConfigText('companyName', readText('company')),
    wellName: readConfigText(
      'wellName',
      readText('wellName', input.wellName ?? null),
    ),
    wellId: readText('wellId'),
    rigName: readConfigText(
      'rigName',
      readText('rigName', input.rigName ?? null),
    ),
    fieldName: readConfigText('fieldName', readText('fieldName')),
    jobNumber: readText('jobNumber'),
    province: readText('province'),
    countyParish: readText('countyParish'),
    country: readText('country'),
    location: readConfigText('location', readText('location')),
    latitude: readConfigNumber('latitude', toFiniteNumber(session?.latitude)),
    longitude: readConfigNumber(
      'longitude',
      toFiniteNumber(session?.longitude),
    ),
    northReference: readConfigText('northReference'),
    declination: readConfigNumber('declination'),
    proposedAzimuth: readConfigNumber('proposedAzimuth'),
    elevationKb: readConfigNumber('elevationKb'),
    elevationDf: readConfigNumber('elevationDf'),
    elevationGl: readConfigNumber('elevationGl'),
    startedAt: session?.startedAt instanceof Date ? session.startedAt : null,
    endedAt: session?.endedAt instanceof Date ? session.endedAt : null,
  }
}

const fetchSurveyTableRows = async (input: PdfPlotInput) => {
  const depthFilter: Record<string, number> = {}

  if (input.depthMin !== undefined) {
    depthFilter.gte = input.depthMin
  }

  if (input.depthMax !== undefined) {
    depthFilter.lte = input.depthMax
  }

  const rows = await db.surveyStation.findMany({
    where: {
      sessionId: input.sessionId,
      stationType: 'actual',
      ...(Object.keys(depthFilter).length > 0
        ? { measuredDepth: depthFilter }
        : {}),
    },
    orderBy: [{ measuredDepth: 'asc' }, { id: 'asc' }],
    select: {
      measuredDepth: true,
      inclination: true,
      azimuth: true,
      tvd: true,
      northing: true,
      easting: true,
      verticalSection: true,
      closureDistance: true,
      closureAzimuth: true,
      doglegSeverity: true,
      courseLength: true,
      source: true,
      notes: true,
    },
  })

  return rows
    .map((row): SurveyTableRow | null => {
      const measuredDepth = toFiniteNumber(row.measuredDepth)
      const inclination = toFiniteNumber(row.inclination)
      const azimuth = toFiniteNumber(row.azimuth)

      if (measuredDepth === null || inclination === null || azimuth === null) {
        return null
      }

      const source =
        typeof row.source === 'string' ? row.source.toLowerCase() : ''
      const notes = typeof row.notes === 'string' ? row.notes.toLowerCase() : ''

      return {
        isTieIn:
          source.includes('tie') ||
          notes.includes('tie') ||
          notes.includes('tie-in'),
        measuredDepth,
        inclination,
        azimuth,
        tvd: toFiniteNumber(row.tvd),
        northing: toFiniteNumber(row.northing),
        easting: toFiniteNumber(row.easting),
        verticalSection: toFiniteNumber(row.verticalSection),
        closureDistance: toFiniteNumber(row.closureDistance),
        closureAzimuth: toFiniteNumber(row.closureAzimuth),
        doglegSeverity: toFiniteNumber(row.doglegSeverity),
        courseLength: toFiniteNumber(row.courseLength),
      }
    })
    .filter((row): row is SurveyTableRow => row !== null)
}

const findNearestRow = (rows: PlotRow[], depth: number) => {
  let nearest: PlotRow | null = null
  let distance = Number.POSITIVE_INFINITY

  for (const row of rows) {
    const nextDistance = Math.abs(row.depth - depth)

    if (nextDistance < distance) {
      nearest = row
      distance = nextDistance
    }
  }

  return nearest
}

const drawHeader = (
  page: PdfPageBuilder,
  input: PdfPlotInput,
  metadata: SessionMetadata,
  config: PlotTemplateConfig,
  width: number,
  logo: RenderedLogo | null,
) => {
  const marginLeft = PDF_STYLE.page.marginLeft
  const marginRight = PDF_STYLE.page.marginRight
  const title = metadata.wellName || input.wellName || input.sessionCode
  const titleSize = 20
  const titleX = width / 2 - estimateTextWidth(title, titleSize) / 2
  const headerBoxTop = 18
  const headerBoxHeight = 116

  page.rect(
    marginLeft,
    headerBoxTop,
    width - marginLeft - marginRight,
    headerBoxHeight,
    PDF_STYLE.color.black,
    PDF_STYLE.line.trackSeparator,
  )

  // Header dibuat fixed supaya tidak berubah-ubah seperti auto-generated report.
  if (logo) {
    page.image(
      logo.resource.name,
      marginLeft + 10,
      headerBoxTop + 8,
      logo.width,
      logo.height,
    )
  }

  page.text(
    title,
    Math.max(marginLeft + 72, titleX),
    35,
    titleSize,
    PDF_STYLE.color.black,
    'bold',
  )

  const scaleX = width - marginRight - 42
  page.text('MD', scaleX + 16, 24, 12, PDF_STYLE.color.black, 'bold')
  page.text(
    `1:${formatNumber(config.scaleRatio)}`,
    scaleX + 8,
    40,
    8,
    PDF_STYLE.color.black,
    'bold',
  )

  const drawMetadata = (
    items: [string, string][],
    x: number,
    labelWidth: number,
  ) => {
    const yStart = 62
    const lineHeight = 8.9

    for (const [index, item] of items.entries()) {
      const y = yStart + index * lineHeight
      page.text(`${item[0]}:`, x, y, 7, PDF_STYLE.color.black, 'bold')
      page.text(
        truncate(item[1], 34),
        x + labelWidth,
        y,
        7,
        PDF_STYLE.color.black,
      )
    }
  }

  drawMetadata(
    [
      ['Company', formatSurveyText(metadata.company)],
      ['Well Name', formatSurveyText(metadata.wellName ?? input.wellName)],
      ['Field', formatSurveyText(metadata.fieldName)],
      ['Rig Id', formatSurveyText(metadata.rigName ?? input.rigName)],
      ['Well ID', formatSurveyText(metadata.wellId)],
      ['Job number', formatSurveyText(metadata.jobNumber)],
    ],
    marginLeft + 18,
    48,
  )

  drawMetadata(
    [
      ['Province', formatSurveyText(metadata.province)],
      ['County/Parish', formatSurveyText(metadata.countyParish)],
      ['Country', formatSurveyText(metadata.country)],
      ['Location', formatSurveyText(metadata.location)],
      ['Start Date', formatSurveyDate(metadata.startedAt)],
      ['End Date', formatSurveyDate(metadata.endedAt)],
    ],
    width * 0.62,
    54,
  )

}

const drawTrackHeaders = (
  page: PdfPageBuilder,
  tracks: PlotTrack[],
  getTrackX: (index: number) => number,
  getTrackWidth: (index: number) => number,
  topY: number,
  headerHeight: number,
) => {
  const drawCurveSample = (
    headerConfig: CurveHeaderConfig,
    x1: number,
    y: number,
    x2: number,
  ) => {
    const color = headerConfig.color
    const width = headerConfig.lineWidth
    const style = headerConfig.lineStyle ?? 'solid'
    const dashCount = 9
    const lineCount = headerConfig.headerLineCount ?? 1

    const drawDashedLine = (topY: number) => {
      const segmentWidth = (x2 - x1) / (dashCount * 2 - 1)

      for (let index = 0; index < dashCount; index += 1) {
        const startX = x1 + index * segmentWidth * 2
        page.line(startX, topY, startX + segmentWidth, topY, color, width)
      }
    }

    const drawSolidLine = (topY: number) => {
      page.line(x1, topY, x2, topY, color, width)
    }

    const drawLine = style === 'dashed'
      ? drawDashedLine
      : style === 'dotted'
        ? (topY: number) => {
            for (let x = x1; x <= x2; x += 8) {
              page.line(x, topY, x + 1.2, topY, color, width)
            }
          }
        : drawSolidLine

    if (lineCount === 2) {
      drawLine(y - 2)
      drawLine(y + 2)
      return
    }

    drawLine(y)
  }

  for (const [index, track] of tracks.entries()) {
    const trackX = getTrackX(index)
    const trackWidth = getTrackWidth(index)
    const rowHeight = (headerHeight - 10) / Math.max(1, track.curves.length)
    const maxTitleChars = Math.max(10, Math.floor((trackWidth - 6) / 4.5))

    page.rect(
      trackX,
      topY,
      trackWidth,
      headerHeight,
      PDF_STYLE.color.black,
      PDF_STYLE.line.trackSeparator,
    )

    for (const [curveIndex, curve] of track.curves.entries()) {
      const curveTop = topY + 5 + curveIndex * rowHeight
      const fallbackHeaderConfig: CurveHeaderConfig = {
        key: curve.key,
        label: curve.label ?? curve.key,
        color: curve.color ?? PDF_STYLE.color.black,
        lineStyle: curve.lineStyle ?? 'solid',
        scaleRows: [
          {
            left: formatNumber(curve.min ?? track.min),
            right: formatNumber(curve.max ?? track.max),
          },
        ],
      }
      const fallbackUnit = curve.unit ?? track.unit
      if (fallbackUnit !== undefined) {
        fallbackHeaderConfig.unit = fallbackUnit
      }
      const headerConfig = BJG_CURVE_HEADER_CONFIGS[curve.key] ?? fallbackHeaderConfig
      const unit = headerConfig.unit ?? ''
      const label = truncate(headerConfig.label, maxTitleChars)
      const labelX =
        trackX + Math.max(2, (trackWidth - estimateTextWidth(label, 8.4)) / 2)

      if (curveTop + rowHeight > topY + headerHeight) {
        continue
      }

      page.text(label, labelX, curveTop, 8.4, PDF_STYLE.color.black)

      if (unit) {
        const unitText = truncate(unit, 8)
        const unitX =
          trackX +
          Math.max(2, (trackWidth - estimateTextWidth(unitText, 5)) / 2)
        page.text(
          unitText,
          unitX,
          curveTop + 10.4,
          5,
          PDF_STYLE.color.darkGray,
        )
      }

      const sampleY = curveTop + rowHeight - 17
      drawCurveSample(
        headerConfig,
        trackX + trackWidth * 0.27,
        sampleY,
        trackX + trackWidth * 0.73,
      )

      const scaleTop = sampleY - (headerConfig.scaleRows.length > 1 ? 8 : 5)

      for (const [rowIndex, row] of headerConfig.scaleRows.entries()) {
        const scaleY = scaleTop + rowIndex * 6
        page.text(row.left, trackX + 4, scaleY, 5, PDF_STYLE.color.black)
        if (row.center) {
          page.textCenter(
            row.center,
            trackX + trackWidth / 2,
            scaleY,
            5,
            PDF_STYLE.color.black,
          )
        }
        page.text(
          row.right,
          trackX + trackWidth - estimateTextWidth(row.right, 5) - 4,
          scaleY,
          5,
          PDF_STYLE.color.black,
        )
      }
    }
  }
}

const drawMdColumn = (
  builder: PdfPageBuilder,
  options: {
    x: number
    width: number
    headerTop: number
    headerHeight: number
    plotTop: number
    plotBottom: number
    minDepth: number
    maxDepth: number
    majorStep: number
    rows: PlotRow[]
    depthToTopY: (depth: number) => number
  },
) => {
  const centerX = options.x + options.width / 2

  builder.rect(
    options.x,
    options.headerTop,
    options.width,
    options.headerHeight,
    PDF_STYLE.color.black,
    PDF_STYLE.line.trackSeparator,
  )
  builder.textCenter(
    'MD',
    centerX,
    options.headerTop + 12,
    12,
    PDF_STYLE.color.black,
    'bold',
  )

  builder.line(
    options.x,
    options.plotTop,
    options.x,
    options.plotBottom,
    PDF_STYLE.color.black,
    PDF_STYLE.line.trackSeparator,
  )
  builder.line(
    options.x + options.width,
    options.plotTop,
    options.x + options.width,
    options.plotBottom,
    PDF_STYLE.color.black,
    PDF_STYLE.line.trackSeparator,
  )

  const firstMajor =
    Math.ceil(options.minDepth / options.majorStep) * options.majorStep

  for (
    let depth = firstMajor;
    depth <= options.maxDepth + 0.0001;
    depth += options.majorStep
  ) {
    const topY = options.depthToTopY(depth)
    const labelTop = Math.min(
      options.plotBottom - 18,
      Math.max(options.plotTop + 2, topY - 7),
    )
    const depthText = formatNumber(depth)

    builder.textCenter(
      depthText,
      centerX,
      labelTop,
      7.2,
      PDF_STYLE.color.black,
      'bold',
    )

    if (Math.abs(depth / 100 - Math.round(depth / 100)) > 0.0001) {
      continue
    }

    const nearestRow = findNearestRow(options.rows, depth)
    const timestamp = formatDateTime(nearestRow?.measuredAt ?? null)

    if (!timestamp) {
      continue
    }

    const [datePart, timePart] = timestamp.split(' ')
    const timestampTop = Math.min(
      options.plotBottom - 10,
      Math.max(options.plotTop + 11, labelTop + 12),
    )

    builder.textCenter(
      datePart ?? '',
      centerX,
      timestampTop,
      5.1,
      PDF_STYLE.color.darkGray,
    )
    builder.textCenter(
      timePart ?? '',
      centerX,
      timestampTop + 6,
      5.1,
      PDF_STYLE.color.darkGray,
    )
  }
}

const drawPlotPage = (
  input: PdfPlotInput,
  metadata: SessionMetadata,
  config: PlotTemplateConfig,
  logo: RenderedLogo | null,
  pageIndex: number,
  pageCount: number,
  pageStartDepth: number,
  pageEndDepth: number,
  rows: PlotRow[],
  width: number,
  height: number,
) => {
  const builder = new PdfPageBuilder(width, height)
  const settings = config.page
  const headerHeight =
    pageIndex === 0
      ? settings.headerHeightFirstPage
      : settings.headerHeightOtherPages
  const headerTop = settings.marginTop
  const trackHeaderTop = settings.marginTop + headerHeight
  const trackHeaderHeight = pageIndex === 0 ? settings.trackHeaderHeight : 0
  const plotTop = trackHeaderTop + trackHeaderHeight
  const footerTrackHeaderHeight = pageIndex === 0 ? settings.trackHeaderHeight : 0
  const footerTrackHeaderTop =
    height - settings.marginBottom - footerTrackHeaderHeight
  const footerTop = footerTrackHeaderTop - 10
  const plotBottom = footerTop - 4
  const plotHeight = plotBottom - plotTop
  const trackStartX = settings.marginLeft
  const plotRight = width - settings.marginRight
  const trackAreaWidth = plotRight - trackStartX
  const mdColumnWidth =
    config.tracks.length >= 4 ? Math.min(42, trackAreaWidth * 0.072) : 0
  const baseTrackWeights = [22, 25, 25, 25]
  const trackWeights = config.tracks.map(
    (_, index) => baseTrackWeights[index] ?? 23,
  )
  const totalTrackWeight = trackWeights.reduce(
    (total, value) => total + value,
    0,
  )
  const trackWidths = trackWeights.map(
    (weight) => ((trackAreaWidth - mdColumnWidth) * weight) / totalTrackWeight,
  )
  const getTrackWidth = (index: number) =>
    trackWidths[index] ??
    (trackAreaWidth - mdColumnWidth) / Math.max(1, config.tracks.length)
  const getTrackX = (index: number) => {
    let x = trackStartX

    for (let i = 0; i < index; i += 1) {
      x += getTrackWidth(i)
    }

    return x + (index > 0 ? mdColumnWidth : 0)
  }
  const mdColumnX = trackStartX + getTrackWidth(0)
  const depthSpan = Math.max(1, pageEndDepth - pageStartDepth)
  const depthStep = 50
  const minorDepthStep = 10
  const depthToTopY = (depth: number) =>
    plotTop + ((depth - pageStartDepth) / depthSpan) * plotHeight

  builder.rect(
    settings.marginLeft,
    plotTop,
    plotRight - settings.marginLeft,
    plotHeight,
    PDF_STYLE.color.black,
    PDF_STYLE.line.normal,
  )

  if (pageIndex === 0) {
    drawHeader(builder, input, metadata, config, width, logo)
  } else {
    builder.text('MD', mdColumnX + 8, headerTop, 8)
  }

  if (pageIndex === 0) {
    drawTrackHeaders(
      builder,
      config.tracks,
      getTrackX,
      getTrackWidth,
      trackHeaderTop,
      settings.trackHeaderHeight,
    )
  }

  const firstMinorDepth =
    Math.ceil(pageStartDepth / minorDepthStep) * minorDepthStep

  for (
    let depth = firstMinorDepth;
    depth <= pageEndDepth + 0.0001;
    depth += minorDepthStep
  ) {
    const topY = depthToTopY(depth)
    const isMajor =
      Math.abs(depth / depthStep - Math.round(depth / depthStep)) < 0.0001

    builder.line(
      settings.marginLeft,
      topY,
      plotRight,
      topY,
      isMajor ? PDF_STYLE.color.lightGray : PDF_STYLE.color.veryLightGray,
      isMajor ? 0.65 : 0.22,
    )

    if (isMajor && mdColumnWidth === 0) {
      builder.text(formatNumber(depth), settings.marginLeft + 5, topY - 4, 7)
    }
  }

  for (let index = 0; index < config.tracks.length; index += 1) {
    const x = getTrackX(index)
    const trackWidth = getTrackWidth(index)
    builder.line(
      x,
      plotTop,
      x,
      plotBottom,
      PDF_STYLE.color.black,
      PDF_STYLE.line.trackSeparator,
    )

    for (let gridIndex = 1; gridIndex < 10; gridIndex += 1) {
      const gridX = x + (trackWidth / 10) * gridIndex
      const isMajorGrid = gridIndex === 5
      builder.line(
        gridX,
        plotTop,
        gridX,
        plotBottom,
        isMajorGrid ? PDF_STYLE.color.gray : PDF_STYLE.color.lightGray,
        isMajorGrid ? 0.55 : 0.25,
      )
    }
  }

  builder.line(
    plotRight,
    plotTop,
    plotRight,
    plotBottom,
    PDF_STYLE.color.black,
    PDF_STYLE.line.trackSeparator,
  )

  if (mdColumnWidth > 0) {
    drawMdColumn(builder, {
      x: mdColumnX,
      width: mdColumnWidth,
      headerTop: trackHeaderTop,
      headerHeight: settings.trackHeaderHeight,
      plotTop,
      plotBottom,
      minDepth: pageStartDepth,
      maxDepth: pageEndDepth,
      majorStep: depthStep,
      rows,
      depthToTopY,
    })
  }

  for (const [trackIndex, track] of config.tracks.entries()) {
    const trackX = getTrackX(trackIndex)
    const currentTrackWidth = getTrackWidth(trackIndex)

    for (const curve of track.curves) {
      const segments: PdfPoint[][] = []
      let activeSegment: PdfPoint[] = []

      for (const row of rows) {
        if (row.depth < pageStartDepth || row.depth > pageEndDepth) {
          continue
        }

        const value = row.values[curve.key]
        const min = curve.min ?? track.min
        const max = curve.max ?? track.max
        const range = max - min

        if (value === null || value === undefined || range <= 0) {
          if (activeSegment.length > 1) {
            segments.push(activeSegment)
          }

          activeSegment = []
          continue
        }

        const normalized = Math.max(0, Math.min(1, (value - min) / range))
        const x = trackX + normalized * currentTrackWidth
        const topY = depthToTopY(row.depth)

        activeSegment.push({ x, y: height - topY })
      }

      if (activeSegment.length > 1) {
        segments.push(activeSegment)
      }

      for (const segment of segments) {
        const color = curve.color ?? PDF_STYLE.color.black
        const lineWidth = curve.lineWidth ?? 0.75
        const style = curve.lineStyle ?? 'single'

        if (style === 'dashed') {
          builder.dashedPolyline(segment, color, lineWidth)
          continue
        }

        if (style === 'dotted') {
          builder.dashedPolyline(segment, color, lineWidth, 1.2, 5)
          continue
        }

        builder.polyline(segment, color, lineWidth)
      }
    }
  }

  if (footerTrackHeaderHeight > 0) {
    drawTrackHeaders(
      builder,
      config.tracks,
      getTrackX,
      getTrackWidth,
      footerTrackHeaderTop,
      footerTrackHeaderHeight,
    )

    if (mdColumnWidth > 0) {
      builder.rect(
        mdColumnX,
        footerTrackHeaderTop,
        mdColumnWidth,
        footerTrackHeaderHeight,
        PDF_STYLE.color.black,
        PDF_STYLE.line.trackSeparator,
      )
      builder.textCenter(
        'MD',
        mdColumnX + mdColumnWidth / 2,
        footerTrackHeaderTop + 12,
        12,
        PDF_STYLE.color.black,
        'bold',
      )
    }
  }

  builder.text(
    `MD ${formatNumber(pageStartDepth)} - ${formatNumber(pageEndDepth)} | Page ${pageIndex + 1}/${pageCount} | Scale 1:${config.scaleRatio}`,
    settings.marginLeft,
    footerTop,
    7,
    PDF_STYLE.color.darkGray,
  )

  return builder.build()
}

const formatSurveyValue = (value: number | null, decimals = 2) => {
  if (value === null) {
    return '-'
  }

  return value.toFixed(decimals).replace(/0+$/g, '').replace(/\.$/g, '')
}

const formatSurveyDate = (value: Date | null) => {
  if (!value) {
    return '-'
  }

  const pad = (input: number) => String(input).padStart(2, '0')

  return `${pad(value.getUTCDate())}/${pad(value.getUTCMonth() + 1)}/${value.getUTCFullYear()}`
}

const formatSurveyText = (value: unknown) => {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}

const formatLatLong = (metadata: SessionMetadata) => {
  const latitude =
    metadata.latitude !== null ? formatSurveyValue(metadata.latitude, 7) : '-'
  const longitude =
    metadata.longitude !== null ? formatSurveyValue(metadata.longitude, 7) : '-'

  return `${latitude} / ${longitude}`
}

const drawSurveyCell = (
  builder: PdfPageBuilder,
  value: string,
  x: number,
  topY: number,
  width: number,
  height: number,
  options: {
    fontSize?: number
    bold?: boolean
    align?: 'left' | 'center'
  } = {},
) => {
  const fontSize = options.fontSize ?? 6.5
  const text = truncate(
    value,
    Math.max(4, Math.floor((width - 4) / (fontSize * 0.45))),
  )
  const textWidth = estimateTextWidth(text, fontSize)
  const textX =
    options.align === 'center'
      ? x + Math.max(2, (width - textWidth) / 2)
      : x + 3

  if (options.bold) {
    builder.fillRect(x, topY, width, height, PDF_STYLE.color.tableHeaderBg)
  }

  builder.rect(
    x,
    topY,
    width,
    height,
    options.bold ? PDF_STYLE.color.gray : PDF_STYLE.color.lightGray,
    options.bold ? PDF_STYLE.line.thin : 0.18,
  )
  builder.text(
    text,
    textX,
    topY + Math.max(2.2, (height - fontSize) / 2 + 0.6),
    fontSize,
    PDF_STYLE.color.black,
    options.bold ? 'bold' : 'regular',
  )
}

const drawSurveyInfoCell = (
  builder: PdfPageBuilder,
  label: string,
  value: string,
  x: number,
  topY: number,
  width: number,
) => {
  const labelWidth = Math.min(62, width * 0.42)
  builder.text(
    `${truncate(label, 18)}:`,
    x,
    topY,
    6.3,
    PDF_STYLE.color.black,
    'bold',
  )
  builder.text(
    truncate(value, Math.max(8, Math.floor((width - labelWidth - 4) / 2.7))),
    x + labelWidth,
    topY,
    6.3,
    PDF_STYLE.color.black,
  )
}

const drawDirectionalSurveyHeader = (
  builder: PdfPageBuilder,
  input: PdfPlotInput,
  metadata: SessionMetadata,
  logo: RenderedLogo | null,
  pageIndex: number,
  pageCount: number,
  width: number,
) => {
  const marginLeft = PDF_STYLE.page.marginLeft
  const marginRight = PDF_STYLE.page.marginRight
  const wellTitle = metadata.wellName ?? input.wellName ?? input.sessionCode
  const title = 'Directional Survey Report'
  const titleX = width / 2 - estimateTextWidth(wellTitle, 16) / 2
  const subtitleX = width / 2 - estimateTextWidth(title, 10) / 2

  if (logo) {
    const logoWidth = 70
    const logoHeight = Math.min(
      30,
      logoWidth / (logo.resource.width / logo.resource.height),
    )
    builder.image(
      logo.resource.name,
      marginLeft,
      PDF_STYLE.page.marginTop,
      logoWidth,
      logoHeight,
    )
  }

  builder.text(
    wellTitle,
    Math.max(marginLeft + 80, titleX),
    17,
    16,
    PDF_STYLE.color.black,
    'bold',
  )
  builder.text(
    title,
    Math.max(marginLeft + 80, subtitleX),
    35,
    10,
    PDF_STYLE.color.black,
  )
  builder.text('Start date:', width - 116, 17, 7, PDF_STYLE.color.black, 'bold')
  builder.text(
    formatSurveyDate(metadata.startedAt),
    width - 68,
    17,
    7,
    PDF_STYLE.color.black,
  )
  builder.text('End date:', width - 116, 27, 7, PDF_STYLE.color.black, 'bold')
  builder.text(
    formatSurveyDate(metadata.endedAt),
    width - 68,
    27,
    7,
    PDF_STYLE.color.black,
  )

  if (pageCount > 1) {
    builder.text(
      `Page ${pageIndex + 1}/${pageCount}`,
      width - 64,
      40,
      6,
      PDF_STYLE.color.darkGray,
    )
  }

  builder.line(
    marginLeft,
    50,
    width - marginRight,
    50,
    PDF_STYLE.color.black,
    PDF_STYLE.line.normal,
  )

  // Metadata dibuat 3 kolom vertikal seperti template BJG, bukan distribusi modulo.
  const columns: [string, string][][] = [
    [
      ['Company', formatSurveyText(metadata.company)],
      ['Well Name', formatSurveyText(metadata.wellName ?? input.wellName)],
      ['Field', formatSurveyText(metadata.fieldName)],
      ['Rig ID', formatSurveyText(metadata.rigName ?? input.rigName)],
      ['API', formatSurveyText(metadata.wellId)],
      ['Location', formatSurveyText(metadata.location)],
    ],
    [
      ['State/Province', formatSurveyText(metadata.province)],
      ['County', formatSurveyText(metadata.countyParish)],
      ['Country', formatSurveyText(metadata.country)],
      ['Declination', formatSurveyValue(metadata.declination)],
      ['North Reference', formatSurveyText(metadata.northReference)],
      ['Latitude/Longitude', formatLatLong(metadata)],
    ],
    [
      ['Survey Company', formatSurveyText(metadata.company)],
      ['Job Number', formatSurveyText(metadata.jobNumber)],
      ['Direction', formatSurveyValue(metadata.proposedAzimuth)],
      ['Elevation KB', formatSurveyValue(metadata.elevationKb)],
      ['DF', formatSurveyValue(metadata.elevationDf)],
      ['GL', formatSurveyValue(metadata.elevationGl)],
    ],
  ]

  const columnXs = [25, width * 0.35, width * 0.67]
  const columnWidths = [width * 0.28, width * 0.29, width * 0.26]
  const topY = 62
  const rowGap = 10

  for (const [columnIndex, column] of columns.entries()) {
    const x = columnXs[columnIndex] ?? marginLeft
    const columnWidth = columnWidths[columnIndex] ?? 160

    for (const [rowIndex, field] of column.entries()) {
      drawSurveyInfoCell(
        builder,
        field[0],
        field[1],
        x,
        topY + rowIndex * rowGap,
        columnWidth,
      )
    }
  }
}

const drawSurveyTablePage = (
  input: PdfPlotInput,
  metadata: SessionMetadata,
  logo: RenderedLogo | null,
  rows: SurveyTableRow[],
  pageRows: SurveyTableRow[],
  pageStartRowIndex: number,
  pageIndex: number,
  pageCount: number,
  width: number,
  height: number,
) => {
  const builder = new PdfPageBuilder(width, height)
  const marginLeft = PDF_STYLE.page.marginLeft
  const marginRight = PDF_STYLE.page.marginRight
  const tableTop = 134
  const rowHeight = 10.2
  const tableWidth = width - marginLeft - marginRight
  const headers = [
    'Svy',
    'Depth',
    'Inc',
    'Azm',
    'TVD',
    'NS',
    'EW',
    'VS',
    'CD',
    'CA',
    'DLS',
    'CL',
  ]
  const columnWeights = [7, 10, 8, 8, 10, 8, 8, 8, 8, 9, 8, 8]
  const totalWeight = columnWeights.reduce((total, value) => total + value, 0)
  const columnWidths = columnWeights.map(
    (weight) => (tableWidth * weight) / totalWeight,
  )

  drawDirectionalSurveyHeader(
    builder,
    input,
    metadata,
    logo,
    pageIndex,
    pageCount,
    width,
  )

  let x = marginLeft

  for (const [index, header] of headers.entries()) {
    const columnWidth = columnWidths[index] ?? 48
    drawSurveyCell(builder, header, x, tableTop, columnWidth, rowHeight, {
      fontSize: PDF_STYLE.font.tableHeaderSize,
      bold: true,
      align: 'center',
    })
    x += columnWidth
  }

  for (const [rowIndex, row] of pageRows.entries()) {
    const y = tableTop + rowHeight * (rowIndex + 1)
    if (rowIndex % 2 === 1) {
      builder.fillRect(marginLeft, y, tableWidth, rowHeight, '#F7F6EE')
    }
    const absoluteRowIndex = pageStartRowIndex + rowIndex
    const tieInOffset = rows[0]?.isTieIn ? 1 : 0
    const surveyNumber =
      row.isTieIn && absoluteRowIndex === 0
        ? 'TieIn'
        : String(Math.max(1, absoluteRowIndex + 1 - tieInOffset))
    const values = [
      surveyNumber,
      formatSurveyValue(row.measuredDepth, 2),
      formatSurveyValue(row.inclination, 2),
      formatSurveyValue(row.azimuth, 2),
      formatSurveyValue(row.tvd, 2),
      formatSurveyValue(row.northing, 2),
      formatSurveyValue(row.easting, 2),
      formatSurveyValue(row.verticalSection, 2),
      formatSurveyValue(row.closureDistance, 2),
      formatSurveyValue(row.closureAzimuth, 2),
      formatSurveyValue(row.doglegSeverity, 2),
      formatSurveyValue(row.courseLength, 2),
    ]

    x = marginLeft

    for (const [columnIndex, value] of values.entries()) {
      const columnWidth = columnWidths[columnIndex] ?? 48
      drawSurveyCell(builder, value, x, y, columnWidth, rowHeight, {
        fontSize: PDF_STYLE.font.tableBodySize,
        align: 'center',
      })
      x += columnWidth
    }
  }

  if (rows.length === 0) {
    builder.text(
      'No actual survey station data available for this depth range.',
      marginLeft,
      tableTop + rowHeight + 12,
      8,
    )
  }

  builder.text(
    'Directional Survey Report',
    marginLeft,
    height - 30,
    6.5,
    PDF_STYLE.color.darkGray,
  )

  return builder.build()
}

const sanitizeFileName = (value: string) => {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '')
}

export const buildPdfPlot = async (input: PdfPlotInput) => {
  let config = DEFAULT_TEMPLATE

  if (input.templateId !== undefined) {
    const template = await plotTemplateService.getPlotTemplateById(
      input.templateId,
    )

    if (!template || !isRecord(template) || !isRecord(template.config)) {
      throw new Error('Plot template not found')
    }

    config = mergeTemplateConfig(config, template.config)
  } else {
    const template = await plotTemplateService.getDefaultPlotTemplate()

    if (template && isRecord(template) && isRecord(template.config)) {
      config = mergeTemplateConfig(config, template.config)
    }
  }

  config = mergeTemplateConfig(config, input.template)
  config = await resolveWitsCurveKeys(config)
  config = applyPolarisCurveStyles(config)
  config = toPolarisLogTemplate(config)

  const curveKeys = collectCurveKeys(config.tracks)
  const rows = await fetchPlotRows(input, curveKeys)
  const surveyRows = await fetchSurveyTableRows(input)
  const sessionMetadata = await fetchSessionMetadata(input)
  config = withSessionHeaderValues(config, sessionMetadata)
  const { startDepth, endDepth } = resolvePlotDepthRange(input, config, rows)
  const plotPageSize = getLongLogPlotPageSize(config, startDepth, endDepth)
  const reportPageSize = getReportPageSize()
  const logo = buildLogo(config.logo)
  const plotPageCount = 1
  const document = new SimplePdfDocument(logo ? [logo.resource] : [])

  document.addPage(
    drawPlotPage(
      input,
      sessionMetadata,
      config,
      logo,
      0,
      plotPageCount,
      startDepth,
      endDepth,
      rows,
      plotPageSize.width,
      plotPageSize.height,
    ),
    plotPageSize.width,
    plotPageSize.height,
  )

  const surveyRowsPerPage = Math.max(
    1,
    Math.floor((reportPageSize.height - 148) / 10.2),
  )
  const surveyPageCount =
    surveyRows.length > 0 ? Math.ceil(surveyRows.length / surveyRowsPerPage) : 1

  for (let pageIndex = 0; pageIndex < surveyPageCount; pageIndex += 1) {
    const startRow = pageIndex * surveyRowsPerPage
    const pageRows = surveyRows.slice(
      startRow,
      (pageIndex + 1) * surveyRowsPerPage,
    )

    document.addPage(
      drawSurveyTablePage(
        input,
        sessionMetadata,
        logo,
        surveyRows,
        pageRows,
        startRow,
        pageIndex,
        surveyPageCount,
        reportPageSize.width,
        reportPageSize.height,
      ),
      reportPageSize.width,
      reportPageSize.height,
    )
  }

  const fileName = `${sanitizeFileName(input.sessionCode)}_pdf_plot.pdf`

  return {
    content: document.build(),
    fileName,
    rowCount: rows.length,
    surveyRowCount: surveyRows.length,
    pageCount: plotPageCount + surveyPageCount,
  }
}
