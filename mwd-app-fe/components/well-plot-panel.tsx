'use client'

import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useApp } from '@/context/AppContext'
import {
  getValidTrackValueRange,
  getRenderableTracksFromPlotConfig,
  getWrappedTrackValue,
  getTrackWindow,
  RenderablePlotCurve,
  TrackValueRange,
  WrappedTrackValue,
} from '@/lib/plot-track-config'
import { cn } from '@/lib/utils'
import { ChartDataPoint } from '@/types'
import { TrackScaleType } from '@/types/plotting'
import type { PlotConfiguration } from '@/types/plotting'

type DepthRow = {
  depth: number
  time: string
  metrics: Record<string, number>
}

type MetricConfig = {
  id: string
  label: string
  color: string
  min?: number
  max?: number
  dataSource?: string
}

type PlotTrack = {
  id: string
  title: string
  scaleType: TrackScaleType
  densityTicMarks?: boolean
  metrics: MetricConfig[]
}

function formatMetricValue(value: number) {
  if (Math.abs(value) >= 1000) {
    return value.toFixed(2)
  }

  if (Math.abs(value) >= 100) {
    return value.toFixed(1)
  }

  return value.toFixed(2)
}

function normalizeMetricLookupKey(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
}

function addMetricAlias(keys: Set<string>, key: string) {
  keys.add(key)
  keys.add(normalizeMetricLookupKey(key))
}

function buildMetricLookupKeys(metric: MetricConfig) {
  const keys = new Set<string>()
  const sourceValues = [metric.id, metric.label, metric.dataSource].filter(
    (value): value is string => Boolean(value),
  )

  for (const value of sourceValues) {
    addMetricAlias(keys, value)
  }

  const compactSource = sourceValues.map(normalizeMetricLookupKey).join(' ')

  if (
    compactSource.includes('0713') ||
    compactSource.includes('inclination') ||
    compactSource.includes('incl')
  ) {
    ;['inc', 'inclination'].forEach((key) => addMetricAlias(keys, key))
  }

  if (
    compactSource.includes('0714') ||
    compactSource.includes('azimuth') ||
    compactSource.includes('azi')
  ) {
    ;['azi', 'azimuth'].forEach((key) => addMetricAlias(keys, key))
  }

  if (
    compactSource.includes('0823') ||
    compactSource.includes('0824') ||
    compactSource.includes('gamma')
  ) {
    ;['gamma', 'gammaRay'].forEach((key) => addMetricAlias(keys, key))
  }

  if (
    compactSource.includes('0836') ||
    compactSource.includes('temperature') ||
    compactSource.includes('temp')
  ) {
    ;['temp', 'temperature'].forEach((key) => addMetricAlias(keys, key))
  }

  if (
    compactSource.includes('0121') ||
    compactSource.includes('standpipe') ||
    compactSource.includes('pressure') ||
    compactSource.includes('spp')
  ) {
    ;['spp', 'standpipePressure', 'pressure', 'pumpPressure'].forEach((key) =>
      addMetricAlias(keys, key),
    )
  }

  if (
    compactSource.includes('0110') ||
    compactSource.includes('depthmd') ||
    compactSource.includes('holedepth')
  ) {
    ;['depth', 'depthMd', 'depth_md', 'holeDepth', 'hole_depth', 'md'].forEach(
      (key) => addMetricAlias(keys, key),
    )
  }

  if (compactSource.includes('bitdepth')) {
    ;['bitDepth', 'bit_depth'].forEach((key) => addMetricAlias(keys, key))
  }

  if (
    compactSource.includes('tvd') ||
    compactSource.includes('trueverticaldepth')
  ) {
    ;['tvd', 'trueVerticalDepth'].forEach((key) => addMetricAlias(keys, key))
  }

  if (
    compactSource.includes('north') ||
    compactSource.includes('northsouth') ||
    compactSource.includes('ns')
  ) {
    ;['ns', 'northing', 'northSouth'].forEach((key) =>
      addMetricAlias(keys, key),
    )
  }

  if (
    compactSource.includes('east') ||
    compactSource.includes('eastwest') ||
    compactSource.includes('ew')
  ) {
    ;['ew', 'easting', 'eastWest'].forEach((key) =>
      addMetricAlias(keys, key),
    )
  }

  if (
    compactSource.includes('verticalsection') ||
    compactSource.includes('vs')
  ) {
    ;['vs', 'verticalSection'].forEach((key) => addMetricAlias(keys, key))
  }

  if (
    compactSource.includes('dogleg') ||
    compactSource.includes('dls')
  ) {
    ;['dls', 'doglegSeverity'].forEach((key) => addMetricAlias(keys, key))
  }

  if (
    compactSource.includes('0113') ||
    compactSource.includes('rop') ||
    compactSource.includes('rateofpenetration')
  ) {
    ;['rop', 'rateOfPenetration'].forEach((key) => addMetricAlias(keys, key))
  }

  if (compactSource.includes('0130') || compactSource.includes('flow')) {
    ;['flowrate', 'flowRate', 'flow_rate'].forEach((key) =>
      addMetricAlias(keys, key),
    )
  }

  return Array.from(keys)
}

function getMetricValueFromRow(metric: MetricConfig, row: DepthRow) {
  const compactSource = [metric.id, metric.label, metric.dataSource]
    .filter((value): value is string => Boolean(value))
    .map(normalizeMetricLookupKey)
    .join(' ')

  if (
    compactSource.includes('depthmd') ||
    compactSource.includes('holedepth')
  ) {
    return row.depth
  }

  for (const key of buildMetricLookupKeys(metric)) {
    const value = row.metrics[key]
    if (Number.isFinite(value)) return value
  }

  return undefined
}

function readNumericValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    const numericValue =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value)
          : NaN

    if (Number.isFinite(numericValue)) return numericValue
  }

  return undefined
}

function chartPointToDepthRow(point: Record<string, unknown>): DepthRow | null {
  const depth = readNumericValue(point, [
    'depth',
    'depthMd',
    'depth_md',
    'measuredDepth',
    'measured_depth',
    'md',
    'holeDepth',
    'hole_depth',
    'bitDepth',
    'bit_depth',
    '0110',
  ])

  if (depth === undefined || !Number.isFinite(depth)) return null
  const roundedDepth = Math.round(depth * 100) / 100

  const timestamp =
    point.timestamp instanceof Date
      ? point.timestamp
      : typeof point.timestamp === 'string' ||
          typeof point.timestamp === 'number'
        ? new Date(point.timestamp)
        : null
  const metrics: Record<string, number> = {}

  for (const [key, value] of Object.entries(point)) {
    if (key === 'timestamp' || key === 'depth') continue
    const numericValue =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value)
          : NaN
    if (!Number.isFinite(numericValue)) continue

    metrics[key] = numericValue
    metrics[normalizeMetricLookupKey(key)] = numericValue
  }

  return {
    depth: roundedDepth,
    time:
      timestamp && !Number.isNaN(timestamp.getTime())
        ? timestamp.toLocaleTimeString()
        : '-',
    metrics,
  }
}

function getMetricIdFromCurve(curve: RenderablePlotCurve) {
  const source = curve.dataSource.toLowerCase()

  if (source.includes('0713') || source.includes('inclination')) return 'inc'
  if (source.includes('0714') || source.includes('azimuth')) return 'azi'
  if (source.includes('tvd') || source.includes('trueverticaldepth'))
    return 'tvd'
  if (source.includes('north') || source.includes('northsouth')) return 'ns'
  if (source.includes('east') || source.includes('eastwest')) return 'ew'
  if (source.includes('verticalsection')) return 'vs'
  if (source.includes('dogleg') || source.includes('dls')) return 'dls'
  if (source.includes('0824') || source.includes('gamma')) return 'gamma'
  if (source.includes('0836') || source.includes('temperature')) return 'temp'
  if (source.includes('0110') || source.includes('hole depth'))
    return 'holeDepth'
  if (source.includes('annularpressure')) return 'annularPressure'
  if (source.includes('borepressure')) return 'borePressure'
  if (source.includes('mwdpressure')) return 'mwdPressure'
  if (
    source.includes('0121') ||
    source.includes('standpipe') ||
    source.includes('pressure')
  )
    return 'spp'

  return curve.id
}

function mapCurveToMetric(curve: RenderablePlotCurve): MetricConfig {
  return {
    id: getMetricIdFromCurve(curve),
    label: curve.label,
    color: curve.lineColor,
    min: curve.min,
    max: curve.max,
    dataSource: curve.dataSource,
  }
}

const PLOT_X_MIN = 12
const PLOT_X_MAX = 88
const PLOT_X_WIDTH = PLOT_X_MAX - PLOT_X_MIN

type PlotPoint = WrappedTrackValue & {
  x: number
  y: number
}

type PlotSegment = {
  d: string
  isWrapped: boolean
  originalStart: number
  originalEnd: number
  displayStart: number
  displayEnd: number
}

function scaleValueToX(value: number, bounds: TrackValueRange) {
  return (
    PLOT_X_MIN +
    ((value - bounds.min) / (bounds.max - bounds.min)) * PLOT_X_WIDTH
  )
}

function createSegment(
  start: PlotPoint,
  end: PlotPoint,
  isWrapped: boolean,
): PlotSegment | null {
  if (![start.x, start.y, end.x, end.y].every(Number.isFinite)) {
    return null
  }

  return {
    d: `M ${start.x.toFixed(2)},${start.y.toFixed(2)} L ${end.x.toFixed(2)},${end.y.toFixed(2)}`,
    isWrapped,
    originalStart: start.originalValue,
    originalEnd: end.originalValue,
    displayStart: start.displayValue,
    displayEnd: end.displayValue,
  }
}

function interpolateYAtValue(start: PlotPoint, end: PlotPoint, value: number) {
  const span = end.originalValue - start.originalValue

  if (!Number.isFinite(span) || span === 0) {
    return (start.y + end.y) / 2
  }

  const ratio = (value - start.originalValue) / span

  if (!Number.isFinite(ratio)) {
    return (start.y + end.y) / 2
  }

  return start.y + Math.min(Math.max(ratio, 0), 1) * (end.y - start.y)
}

function getTransitionBoundaryValue(
  start: PlotPoint,
  end: PlotPoint,
  bounds: TrackValueRange,
) {
  const wrappedPoint = start.isWrapped ? start : end

  return wrappedPoint.direction === 'left' ? bounds.min : bounds.max
}

function makeEdgePoint(
  source: PlotPoint,
  y: number,
  bounds: TrackValueRange,
  isWrapped: boolean,
  direction: WrappedTrackValue['direction'],
): PlotPoint {
  const edgeValue =
    direction === 'left'
      ? isWrapped
        ? bounds.max
        : bounds.min
      : isWrapped
        ? bounds.min
        : bounds.max

  return {
    ...source,
    x: scaleValueToX(edgeValue, bounds),
    y,
    displayValue: edgeValue,
    isWrapped,
  }
}

function makeWrappedCycleEdgePoint(
  source: PlotPoint,
  y: number,
  bounds: TrackValueRange,
  direction: WrappedTrackValue['direction'],
  side: 'before' | 'after',
): PlotPoint {
  const edgeValue =
    direction === 'left'
      ? side === 'before'
        ? bounds.min
        : bounds.max
      : side === 'before'
        ? bounds.max
        : bounds.min

  return {
    ...source,
    x: scaleValueToX(edgeValue, bounds),
    y,
    displayValue: edgeValue,
    isWrapped: true,
  }
}

function getWrappedCycleBoundaryValue(
  start: PlotPoint,
  end: PlotPoint,
  bounds: TrackValueRange,
) {
  const range = bounds.max - bounds.min
  const wrapCount = Math.max(start.wrapCount, end.wrapCount)

  if (start.direction === 'left' || end.direction === 'left') {
    return bounds.min - range * Math.max(wrapCount - 1, 1)
  }

  return bounds.min + range * wrapCount
}

function appendSegment(
  segments: PlotSegment[],
  start: PlotPoint,
  end: PlotPoint,
  isWrapped: boolean,
) {
  const segment = createSegment(start, end, isWrapped)

  if (segment) {
    segments.push(segment)
  }
}

function buildWrappedSegments(points: PlotPoint[], bounds: TrackValueRange) {
  const segments: PlotSegment[] = []

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]
    const end = points[index + 1]

    if (start.isWrapped === end.isWrapped) {
      const hasWrappedCycleBreak =
        start.isWrapped &&
        end.isWrapped &&
        (start.wrapCount !== end.wrapCount || start.direction !== end.direction)

      if (!hasWrappedCycleBreak) {
        appendSegment(segments, start, end, start.isWrapped)
        continue
      }

      if (start.direction !== end.direction) {
        continue
      }

      const boundaryValue = getWrappedCycleBoundaryValue(start, end, bounds)
      const boundaryY = interpolateYAtValue(start, end, boundaryValue)
      const direction = start.direction

      appendSegment(
        segments,
        start,
        makeWrappedCycleEdgePoint(
          start,
          boundaryY,
          bounds,
          direction,
          'before',
        ),
        true,
      )
      appendSegment(
        segments,
        makeWrappedCycleEdgePoint(end, boundaryY, bounds, direction, 'after'),
        end,
        true,
      )
      continue
    }

    const direction = start.isWrapped ? start.direction : end.direction
    const boundaryValue = getTransitionBoundaryValue(start, end, bounds)
    const boundaryY = interpolateYAtValue(start, end, boundaryValue)

    appendSegment(
      segments,
      start,
      makeEdgePoint(start, boundaryY, bounds, start.isWrapped, direction),
      start.isWrapped,
    )
    appendSegment(
      segments,
      makeEdgePoint(end, boundaryY, bounds, end.isWrapped, direction),
      end,
      end.isWrapped,
    )
  }

  return segments
}

function buildMetricSegments(
  metric: MetricConfig,
  rows: DepthRow[],
  plotHeightPx: number,
) {
  const values = rows.map((row) => getMetricValueFromRow(metric, row))
  const configuredBounds = getValidTrackValueRange(metric.min, metric.max)
  const finiteValues = values.filter(
    (value): value is number =>
      typeof value === 'number' && Number.isFinite(value),
  )
  const fallbackBounds = finiteValues.length
    ? getValidTrackValueRange(
        Math.min(...finiteValues),
        Math.max(...finiteValues),
      )
    : null
  const bounds = configuredBounds ?? fallbackBounds

  if (!bounds) return []

  const points = rows
    .map((row, index) => {
      const value = values[index]
      if (typeof value !== 'number' || !Number.isFinite(value)) return null
      const y =
        12 + (index / Math.max(rows.length - 1, 1)) * (plotHeightPx - 24)
      const wrappedValue = configuredBounds
        ? getWrappedTrackValue({ value, min: bounds.min, max: bounds.max })
        : null
      const displayValue = wrappedValue?.displayValue ?? value

      if (!Number.isFinite(displayValue)) return null

      return {
        originalValue: value,
        displayValue,
        isWrapped: wrappedValue?.isWrapped ?? false,
        wrapCount: wrappedValue?.wrapCount ?? 0,
        direction: wrappedValue?.direction ?? 'none',
        x: scaleValueToX(displayValue, bounds),
        y,
      } satisfies PlotPoint
    })
    .filter((point): point is PlotPoint => Boolean(point))

  if (points.length < 2) return []

  if (!configuredBounds) {
    const segments: PlotSegment[] = []

    for (let index = 0; index < points.length - 1; index += 1) {
      appendSegment(segments, points[index], points[index + 1], false)
    }

    return segments
  }

  return buildWrappedSegments(points, bounds)
}

function metricHasWrappedValues(metric: MetricConfig, rows: DepthRow[]) {
  if (!getValidTrackValueRange(metric.min, metric.max)) return false

  return rows.some((row) => {
    const value = getMetricValueFromRow(metric, row)
    const wrappedValue = getWrappedTrackValue({
      value,
      min: metric.min,
      max: metric.max,
    })

    return Boolean(wrappedValue?.isWrapped)
  })
}

function MetricHeader({
  metric,
  compact = false,
  dense = false,
}: {
  metric: MetricConfig
  compact?: boolean
  dense?: boolean
}) {
  return (
    <div
      className={
        compact
          ? 'grid grid-cols-[22px_1fr_32px] items-start gap-1 text-[8px] leading-tight'
          : dense
            ? 'grid grid-cols-[18px_1fr_28px] items-start gap-1 text-[7px] leading-tight sm:grid-cols-[20px_1fr_32px] sm:text-[10px] lg:grid-cols-[22px_1fr_34px]'
            : 'grid grid-cols-[28px_1fr_40px] items-start gap-1 text-[9px] leading-tight sm:grid-cols-[32px_1fr_48px] sm:text-[11px] lg:grid-cols-[36px_1fr_54px] lg:text-[11px]'
      }
    >
      <span className="tabular-nums text-slate-500 dark:text-slate-400">
        {metric.min ?? 0}
      </span>
      <span
        className="min-w-0 whitespace-normal break-words text-center font-medium [overflow-wrap:anywhere]"
        style={{ color: metric.color }}
        title={metric.label}
      >
        {metric.label}
      </span>
      <span className="tabular-nums text-right text-slate-500 dark:text-slate-400">
        {metric.max ?? '-'}
      </span>
    </div>
  )
}

function getMetricHeaderLineCount(
  metric: MetricConfig,
  compact: boolean,
  dense: boolean,
) {
  const labelCharsPerLine = compact ? 16 : dense ? 16 : 22
  const scaleCharsPerLine = compact ? 7 : dense ? 7 : 8
  const labelLines = Math.ceil(metric.label.length / labelCharsPerLine)
  const minLines = Math.ceil(String(metric.min ?? 0).length / scaleCharsPerLine)
  const maxLines = Math.ceil(
    String(metric.max ?? '-').length / scaleCharsPerLine,
  )

  return Math.max(1, labelLines, minLines, maxLines)
}

function getTrackHeaderHeightPx(
  track: PlotTrack,
  compact: boolean,
  dense: boolean,
) {
  const baseHeight = compact ? 56 : dense ? 68 : 80
  const titleHeight = compact ? 10 : dense ? 11 : 12
  const verticalPadding = dense ? 8 : 16
  const rowGap = dense ? 3 : 4
  const lineHeight = compact ? 9 : dense ? 9 : 11
  const metricRowsHeight = track.metrics.reduce((total, metric) => {
    return total + getMetricHeaderLineCount(metric, compact, dense) * lineHeight
  }, 0)
  const contentHeight =
    verticalPadding +
    titleHeight +
    (track.metrics.length > 0 ? rowGap : 0) +
    metricRowsHeight +
    Math.max(track.metrics.length - 1, 0) * rowGap

  return Math.max(baseHeight, Math.ceil(contentHeight))
}

function getSharedTrackHeaderHeightPx(
  tracks: PlotTrack[],
  compact: boolean,
  dense: boolean,
) {
  return Math.max(
    compact ? 56 : dense ? 68 : 80,
    ...tracks.map((track) => getTrackHeaderHeightPx(track, compact, dense)),
  )
}

function DepthScale({
  rows,
  compact = false,
  dense = false,
}: {
  rows: DepthRow[]
  compact?: boolean
  dense?: boolean
}) {
  const widthClass = compact
    ? 'w-[52px]'
    : dense
      ? 'w-[46px] sm:w-[48px] lg:w-[52px]'
      : 'w-[64px] sm:w-[72px] lg:w-[84px]'

  return (
    <div
      className={`absolute inset-y-0 left-0 border-r border-slate-200/80 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/70 ${widthClass}`}
    >
      <div
        className={`absolute inset-0 flex flex-col justify-between py-3 ${compact ? 'px-1' : 'px-1.5 sm:px-2'}`}
      >
        {rows.map((row) => (
          <div key={`${row.depth}-${row.time}-scale`} className="leading-tight">
            <div
              className={
                compact
                  ? 'text-[9px] font-semibold tabular-nums text-slate-700 dark:text-slate-200'
                  : dense
                    ? 'text-[8px] font-semibold tabular-nums text-slate-700 sm:text-[9px] dark:text-slate-200'
                    : 'text-[10px] font-semibold tabular-nums text-slate-700 sm:text-[11px] lg:text-[12px] dark:text-slate-200'
              }
            >
              {row.depth}
            </div>
            <div
              className={
                compact
                  ? 'text-[8px] tabular-nums text-slate-500 dark:text-slate-400'
                  : dense
                    ? 'text-[7px] tabular-nums text-slate-500 sm:text-[9px] dark:text-slate-400'
                    : 'text-[9px] tabular-nums text-slate-500 sm:text-[10px] lg:text-[11px] dark:text-slate-400'
              }
            >
              {row.time}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MajorMinorGrid({ rows }: { rows: DepthRow[] }) {
  const majorRowCount = rows.length
  const minorPerMajor = 4
  const totalMinorLines = (majorRowCount - 1) * minorPerMajor

  return (
    <>
      <div
        className="absolute inset-0 bg-slate-50/45 [--grid-major:rgba(71,85,105,0.14)] [--grid-minor:rgba(100,116,139,0.07)] dark:bg-slate-950 dark:[--grid-major:rgba(148,163,184,0.12)] dark:[--grid-minor:rgba(148,163,184,0.05)]"
        style={{
          backgroundImage: `
            linear-gradient(to bottom, var(--grid-major) 1px, transparent 1px),
            linear-gradient(to right, var(--grid-minor) 1px, transparent 1px)
          `,
          backgroundSize: `100% calc(100% / ${majorRowCount - 1}), 56px 100%`,
        }}
      />
      <div className="absolute inset-0">
        {Array.from({ length: totalMinorLines }).map((_, index) => {
          const top = ((index + 1) / (totalMinorLines + 1)) * 100
          return (
            <div
              key={index}
              className="absolute left-0 right-0 border-t border-slate-300/20 dark:border-slate-700/25"
              style={{ top: `${top}%` }}
            />
          )
        })}
      </div>
      <div className="absolute inset-y-0 left-1/4 w-px bg-slate-300/35 dark:bg-slate-700/35" />
      <div className="absolute inset-y-0 left-2/4 w-px bg-slate-400/45 dark:bg-slate-600/45" />
      <div className="absolute inset-y-0 left-3/4 w-px bg-slate-300/35 dark:bg-slate-700/35" />
    </>
  )
}

function WellPlotTrack({
  track,
  rows,
  plotHeightPx,
  plotHeightCss,
  compact = false,
  fullWidth = false,
  dense = false,
  headerHeightPx,
  onHeaderHeightChange,
}: {
  track: PlotTrack
  rows: DepthRow[]
  plotHeightPx: number
  plotHeightCss: string
  compact?: boolean
  fullWidth?: boolean
  dense?: boolean
  headerHeightPx?: number
  onHeaderHeightChange?: (trackId: string, height: number) => void
}) {
  const resolvedHeaderHeightPx =
    headerHeightPx ?? getTrackHeaderHeightPx(track, compact, dense)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const headerContentRef = useRef<HTMLDivElement | null>(null)
  const footerHeightClass = compact
    ? 'min-h-[34px]'
    : dense
      ? 'min-h-[48px]'
      : 'min-h-[64px]'
  const depthOffsetClass = compact
    ? 'left-[52px]'
    : dense
      ? 'left-[46px] sm:left-[48px] lg:left-[52px]'
      : 'left-[64px] sm:left-[72px] lg:left-[84px]'
  const hasWrappedData = track.metrics.some((metric) =>
    metricHasWrappedValues(metric, rows),
  )

  useLayoutEffect(() => {
    if (
      !onHeaderHeightChange ||
      !headerRef.current ||
      !headerContentRef.current
    )
      return

    const measureHeader = () => {
      if (
        !headerRef.current ||
        !headerContentRef.current ||
        headerRef.current.offsetParent === null
      )
        return

      const headerStyle = window.getComputedStyle(headerRef.current!)
      const paddingY =
        Number.parseFloat(headerStyle.paddingTop || '0') +
        Number.parseFloat(headerStyle.paddingBottom || '0')
      const measuredHeight = Math.ceil(
        headerContentRef.current!.scrollHeight + paddingY + 2,
      )

      onHeaderHeightChange(track.id, measuredHeight)
    }

    measureHeader()

    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(measureHeader)
    observer.observe(headerContentRef.current)

    return () => observer.disconnect()
  }, [compact, dense, onHeaderHeightChange, track.id, track.metrics])

  return (
    <div
      className={
        fullWidth
          ? 'w-full bg-white dark:bg-slate-950'
          : 'w-full border-r border-slate-300 bg-white last:border-r-0 dark:border-slate-700 dark:bg-slate-950'
      }
    >
      <div
        ref={headerRef}
        className={`border-b border-slate-300 bg-slate-100 ${dense ? 'px-1 py-1' : 'px-2 py-2'} dark:border-slate-700 dark:bg-slate-900`}
        style={{ height: `${resolvedHeaderHeightPx}px` }}
      >
        <div
          ref={headerContentRef}
          className="flex flex-col justify-start space-y-1"
        >
          <div className="flex min-w-0 items-center justify-between gap-2 text-[8px] font-semibold uppercase leading-none text-slate-600 dark:text-slate-300 sm:text-[10px]">
            <span className="truncate" title={track.title}>
              {track.title}
            </span>
            <span className="shrink-0 text-[7px] font-medium text-slate-500 dark:text-slate-400 sm:text-[9px]">
              {track.scaleType}
            </span>
          </div>
          {track.metrics.map((metric, metricIndex) => (
            <MetricHeader
              key={`${track.id}-${metric.id}-${metric.dataSource ?? metric.label}-${metricIndex}-header`}
              metric={metric}
              compact={compact}
              dense={dense}
            />
          ))}
        </div>
      </div>

      <div
        className="relative overflow-hidden"
        style={{ height: plotHeightCss }}
      >
        <DepthScale rows={rows} compact={compact} dense={dense} />

        <div className={`absolute inset-y-0 right-0 ${depthOffsetClass}`}>
          <MajorMinorGrid rows={rows} />

          {track.metrics.map((metric, idx) => (
            <svg
              key={`${track.id}-${metric.id}-${metric.dataSource ?? metric.label}-${idx}-curve`}
              viewBox={`0 0 100 ${plotHeightPx}`}
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
              style={{ zIndex: idx + 2 }}
            >
              {buildMetricSegments(metric, rows, plotHeightPx).map(
                (segment, segmentIndex) => (
                  <path
                    key={`${metric.id}-segment-${segmentIndex}`}
                    d={segment.d}
                    stroke={metric.color}
                    strokeWidth={compact ? '1.35' : dense ? '1.6' : '1.8'}
                    strokeDasharray={segment.isWrapped ? '5 4' : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={segment.isWrapped ? 0.85 : 1}
                    fill="none"
                  >
                    <title>
                      {segment.isWrapped
                        ? `Wrapped overflow: original ${formatMetricValue(segment.originalStart)}-${formatMetricValue(segment.originalEnd)}, displayed ${formatMetricValue(segment.displayStart)}-${formatMetricValue(segment.displayEnd)}`
                        : `${metric.label}: ${formatMetricValue(segment.originalStart)}-${formatMetricValue(segment.originalEnd)}`}
                    </title>
                  </path>
                ),
              )}
            </svg>
          ))}
        </div>
      </div>

      <div
        className={`border-t border-slate-300 ${dense ? 'px-1 py-1' : 'px-2 py-2'} dark:border-slate-700 ${footerHeightClass}`}
      >
        <div
          className={cn(
            'flex h-full flex-col justify-start',
            compact
              ? 'gap-y-1 text-[8px]'
              : dense
                ? 'gap-y-1 text-[7px] sm:text-[9px]'
                : 'gap-y-1.5 text-[9px] sm:text-[10px] lg:text-[11px]',
            'text-slate-500 dark:text-slate-400',
          )}
        >
          {track.metrics.map((metric, metricIndex) => {
            const lastValue =
              [...rows]
                .reverse()
                .map((row) => getMetricValueFromRow(metric, row))
                .find((value) => Number.isFinite(value)) ?? NaN

            return (
              <div
                key={`${track.id}-${metric.id}-${metric.dataSource ?? metric.label}-${metricIndex}-footer`}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 leading-tight"
              >
                <div
                  className="truncate font-medium"
                  style={{ color: metric.color }}
                  title={metric.label}
                >
                  {metric.label}
                </div>
                <div className="tabular-nums text-right text-slate-600 dark:text-slate-300">
                  {Number.isFinite(lastValue)
                    ? formatMetricValue(lastValue)
                    : '-'}
                </div>
              </div>
            )
          })}
          {hasWrappedData ? (
            <div className="mt-0.5 flex items-center gap-1.5 text-[7px] font-medium uppercase tracking-[0.04em] text-slate-500 dark:text-slate-400 sm:text-[8px]">
              <span className="h-px w-5 border-t border-dashed border-current" />
              <span className="truncate">wrapped overflow</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function PlotTabs({
  tracks,
  activePlotId,
  onChange,
  compact = false,
}: {
  tracks: PlotTrack[]
  activePlotId: string
  onChange: (id: string) => void
  compact?: boolean
}) {
  return (
    <div
      className={
        compact
          ? 'grid grid-cols-2 gap-2 md:grid-cols-4'
          : 'grid grid-cols-2 gap-2 sm:hidden'
      }
    >
      {tracks.map((track) => (
        <Button
          key={track.id}
          type="button"
          variant={activePlotId === track.id ? 'default' : 'outline'}
          size="sm"
          className="min-w-0 justify-center"
          onClick={() => onChange(track.id)}
          title={track.title}
        >
          <span className="truncate">{track.title}</span>
        </Button>
      ))}
    </div>
  )
}

function getResponsiveTracksPerView(
  containerWidth: number | null,
  maxTracks: number,
) {
  const cappedMax = Math.max(1, maxTracks)

  if (!containerWidth) return cappedMax
  if (containerWidth >= 1100) return Math.min(cappedMax, 4)
  if (containerWidth >= 840) return Math.min(cappedMax, 3)
  if (containerWidth >= 560) return Math.min(cappedMax, 2)

  return 1
}

function TrackWindowControls({
  tracks,
  startIndex,
  visibleCount,
  onStartChange,
}: {
  tracks: PlotTrack[]
  startIndex: number
  visibleCount: number
  onStartChange: (startIndex: number) => void
}) {
  const windowState = getTrackWindow(tracks, startIndex, visibleCount)

  if (tracks.length <= visibleCount) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0 text-xs text-muted-foreground">
        Showing tracks {windowState.startIndex + 1}-{windowState.endIndex} of{' '}
        {tracks.length}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!windowState.hasPrevious}
          onClick={() =>
            onStartChange(Math.max(windowState.startIndex - visibleCount, 0))
          }
        >
          Previous
        </Button>
        {Array.from({ length: windowState.pageCount }).map((_, pageIndex) => {
          const pageStart = Math.min(
            pageIndex * visibleCount,
            windowState.maxStart,
          )

          return (
            <Button
              key={`track-window-${pageIndex}`}
              type="button"
              variant={
                windowState.pageIndex === pageIndex ? 'default' : 'outline'
              }
              size="sm"
              className="h-8 min-w-8 px-2"
              onClick={() => onStartChange(pageStart)}
            >
              {pageIndex + 1}
            </Button>
          )
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!windowState.hasNext}
          onClick={() =>
            onStartChange(
              Math.min(
                windowState.startIndex + visibleCount,
                windowState.maxStart,
              ),
            )
          }
        >
          Next
        </Button>
      </div>
    </div>
  )
}

export function WellPlotPanel({
  compact = false,
  showHeader = true,
  showAllTracks = false,
  dashboardStretch = false,
  compactDashboardHeightPx,
  compactDashboardHeightCss,
  dashboardHeightPx,
  dashboardHeightCss,
  allTracksMinWidth,
  maxVisibleTracks,
  responsiveTrackWindow = false,
  plotConfig,
  chartDataOverride,
  mwdDataLoading = false,
  mwdDataError,
}: {
  compact?: boolean
  showHeader?: boolean
  showAllTracks?: boolean
  dashboardStretch?: boolean
  compactDashboardHeightPx?: number
  compactDashboardHeightCss?: string
  dashboardHeightPx?: number
  dashboardHeightCss?: string
  allTracksMinWidth?: number
  maxVisibleTracks?: number
  responsiveTrackWindow?: boolean
  plotConfig?: PlotConfiguration | null
  chartDataOverride?: ChartDataPoint[]
  mwdDataLoading?: boolean
  mwdDataError?: string
}) {
  const { activePlotConfig, activeMwdSession, chartData } =
    useApp()
  const panelRef = useRef<HTMLDivElement>(null)
  const selectedPlotConfig =
    plotConfig !== undefined ? plotConfig : activePlotConfig
  const selectedChartData = chartDataOverride ?? chartData
  const tracks = useMemo<PlotTrack[]>(() => {
    return getRenderableTracksFromPlotConfig(selectedPlotConfig).map(
      (track) => ({
        id: track.id,
        title: track.label,
        scaleType: track.scaleType,
        densityTicMarks: track.densityTicMarks,
        metrics: track.curves.map(mapCurveToMetric),
      }),
    )
  }, [selectedPlotConfig])
  const backendDepthRows = useMemo<DepthRow[]>(() => {
    return selectedChartData
      .map((point) => chartPointToDepthRow(point as Record<string, unknown>))
      .filter((row): row is DepthRow => Boolean(row))
      .sort((left, right) => left.depth - right.depth)
  }, [selectedChartData])
  const plotDepthRows = backendDepthRows
  const plotDataLoading = mwdDataLoading
  const plotDataError = mwdDataError
  const emptyPlotDataMessage = 'Belum ada data MWD untuk session ini.'
  const activeGeneral = selectedPlotConfig?.general
  const activeDepthCorrection = activeGeneral?.depthCorrection ?? 'MD'
  const activeDepthScale =
    activeGeneral?.grid?.depthScale ?? activeGeneral?.depthScale ?? '1:500'
  const [activePlotId, setActivePlotId] = useState<string>(tracks[0]?.id ?? '')
  const [trackWindowStart, setTrackWindowStart] = useState(0)
  const [panelWidth, setPanelWidth] = useState<number | null>(null)
  const [measuredHeaderHeights, setMeasuredHeaderHeights] = useState<
    Record<string, number>
  >({})

  const compactDashboardMode = compact && !showHeader
  const plotHeightPx = compact
    ? compactDashboardMode
      ? (compactDashboardHeightPx ?? 760)
      : 640
    : dashboardStretch
      ? (dashboardHeightPx ?? 1500)
      : 1320
  const plotHeightCss = compact
    ? compactDashboardMode
      ? (compactDashboardHeightCss ?? 'clamp(520px, 72dvh, 820px)')
      : 'clamp(420px, 60dvh, 640px)'
    : dashboardStretch
      ? (dashboardHeightCss ?? 'clamp(980px, calc(100dvh - 120px), 1480px)')
      : 'clamp(720px, calc(100dvh - 180px), 1280px)'

  const activeTrack = useMemo(
    () => tracks.find((track) => track.id === activePlotId) ?? tracks[0],
    [activePlotId, tracks],
  )
  const dashboardDense = dashboardStretch && showAllTracks
  const configuredMultiTrackLimit = Math.max(
    1,
    maxVisibleTracks ?? (dashboardStretch ? 3 : 4),
  )
  const multiTrackLimit = responsiveTrackWindow
    ? getResponsiveTracksPerView(panelWidth, configuredMultiTrackLimit)
    : configuredMultiTrackLimit
  const visibleTrackWindow = getTrackWindow(
    tracks,
    trackWindowStart,
    multiTrackLimit,
  )
  const trackHeaderSignature = useMemo(
    () =>
      tracks
        .map(
          (track) =>
            `${track.id}:${track.title}:${track.scaleType}:${track.metrics.map((metric) => `${metric.label}:${metric.min ?? ''}:${metric.max ?? ''}`).join(',')}`,
        )
        .join('|'),
    [tracks],
  )
  const handleHeaderHeightChange = React.useCallback(
    (trackId: string, height: number) => {
      setMeasuredHeaderHeights((current) => {
        if (current[trackId] === height) return current

        return {
          ...current,
          [trackId]: height,
        }
      })
    },
    [],
  )
  const getMeasuredSharedHeaderHeight = React.useCallback(
    (targetTracks: PlotTrack[], compactMode: boolean, denseMode: boolean) => {
      const estimatedHeight = getSharedTrackHeaderHeightPx(
        targetTracks,
        compactMode,
        denseMode,
      )
      const measuredHeight = Math.max(
        0,
        ...targetTracks.map((track) => measuredHeaderHeights[track.id] ?? 0),
      )

      return Math.max(estimatedHeight, measuredHeight)
    },
    [measuredHeaderHeights],
  )
  const compactActiveHeaderHeightPx = activeTrack
    ? getMeasuredSharedHeaderHeight([activeTrack], true, false)
    : undefined
  const activeHeaderHeightPx = activeTrack
    ? getMeasuredSharedHeaderHeight([activeTrack], false, false)
    : undefined
  const visibleDenseHeaderHeightPx = getMeasuredSharedHeaderHeight(
    visibleTrackWindow.tracks,
    false,
    dashboardDense,
  )
  const visibleHeaderHeightPx = getMeasuredSharedHeaderHeight(
    visibleTrackWindow.tracks,
    false,
    false,
  )

  useEffect(() => {
    if (!responsiveTrackWindow) return

    const panel = panelRef.current
    if (!panel) return

    const updateWidth = () => setPanelWidth(panel.clientWidth)
    updateWidth()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth)
      return () => window.removeEventListener('resize', updateWidth)
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      setPanelWidth(entry?.contentRect.width ?? panel.clientWidth)
    })
    observer.observe(panel)

    return () => observer.disconnect()
  }, [responsiveTrackWindow])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setMeasuredHeaderHeights({})
    })

    return () => {
      cancelled = true
    }
  }, [trackHeaderSignature])

  useEffect(() => {
    let nextActivePlotId = activePlotId

    if (!tracks.length) {
      nextActivePlotId = ''
    } else if (!tracks.some((track) => track.id === activePlotId)) {
      nextActivePlotId = tracks[0].id
    }

    if (nextActivePlotId === activePlotId) return

    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setActivePlotId(nextActivePlotId)
    })

    return () => {
      cancelled = true
    }
  }, [activePlotId, tracks])

  useEffect(() => {
    const nextWindow = getTrackWindow(tracks, trackWindowStart, multiTrackLimit)
    if (nextWindow.startIndex === trackWindowStart) return

    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setTrackWindowStart(nextWindow.startIndex)
    })

    return () => {
      cancelled = true
    }
  }, [multiTrackLimit, trackWindowStart, tracks])

  if (!tracks.length || !activeTrack) {
    return (
      <div className={compact ? 'space-y-3' : 'space-y-4 sm:space-y-5'}>
        {showHeader ? (
          <div className="flex flex-wrap items-start justify-between gap-3 sm:items-center">
            <div>
              <Badge variant="outline">Trajectory / Well Plot</Badge>
              <Badge variant="secondary">{activeDepthCorrection}</Badge>
              <Badge variant="outline">{activeDepthScale}</Badge>
              {selectedPlotConfig ? (
                <Badge variant="outline">
                  Plot config: {selectedPlotConfig.name}
                </Badge>
              ) : null}
              {activeMwdSession ? (
                <Badge variant="secondary">
                  Session: {activeMwdSession.name}
                </Badge>
              ) : null}
              <h1 className="mt-3 text-xl font-bold sm:text-3xl">
                Well Plot Viewer
              </h1>
              <p className="text-[11px] text-muted-foreground sm:text-base">
                Active tracks come from the selected Plotting configuration.
              </p>
            </div>
          </div>
        ) : null}
        <Card className="rounded-2xl border-dashed p-5 text-sm text-muted-foreground">
          No active tracks configured in the selected Plotting configuration.
        </Card>
      </div>
    )
  }

  if (plotDataLoading || !plotDepthRows.length || plotDataError) {
    return (
      <div className={compact ? 'space-y-3' : 'space-y-4 sm:space-y-5'}>
        {showHeader ? (
          <div className="flex flex-wrap items-start justify-between gap-3 sm:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <Badge variant="outline">Trajectory / Well Plot</Badge>
                <Badge variant="secondary">{activeDepthCorrection}</Badge>
                <Badge variant="outline">{activeDepthScale}</Badge>
                {selectedPlotConfig ? (
                  <Badge variant="outline">
                    Plot config: {selectedPlotConfig.name}
                  </Badge>
                ) : null}
                {activeMwdSession ? (
                  <Badge variant="secondary">
                    Session: {activeMwdSession.name}
                  </Badge>
                ) : null}
              </div>
              <h1 className="mt-3 text-xl font-bold sm:text-3xl">
                Well Plot Viewer
              </h1>
            </div>
          </div>
        ) : null}
        <Card className="rounded-2xl border-dashed p-5 text-sm text-muted-foreground">
          {plotDataLoading
            ? 'Memuat data untuk plot...'
            : plotDataError || emptyPlotDataMessage}
        </Card>
      </div>
    )
  }

  return (
    <div
      ref={panelRef}
      className={compact ? 'space-y-3' : 'space-y-4 sm:space-y-5'}
    >
      {showHeader ? (
        <div className="flex flex-wrap items-start justify-between gap-3 sm:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Badge variant="outline">Trajectory / Well Plot</Badge>
              <Badge variant="secondary">{activeDepthCorrection}</Badge>
              <Badge variant="outline">{activeDepthScale}</Badge>
              {selectedPlotConfig ? (
                <Badge variant="outline">
                  Plot config: {selectedPlotConfig.name}
                </Badge>
              ) : null}
              {activeMwdSession ? (
                <Badge variant="secondary">
                  Session: {activeMwdSession.name}
                </Badge>
              ) : null}
            </div>
            <h1 className="mt-3 text-xl font-bold sm:text-3xl">
              Well Plot Viewer
            </h1>
          </div>
        </div>
      ) : null}

      {compact ? (
        <PlotTabs
          tracks={tracks}
          activePlotId={activePlotId}
          onChange={setActivePlotId}
          compact
        />
      ) : showAllTracks ? null : (
        <>
          <PlotTabs
            tracks={tracks}
            activePlotId={activePlotId}
            onChange={setActivePlotId}
          />

          <div className="hidden sm:grid sm:grid-cols-2 sm:gap-2 xl:hidden">
            {tracks.map((track) => (
              <Button
                key={track.id}
                type="button"
                variant={activePlotId === track.id ? 'default' : 'outline'}
                size="sm"
                className="min-w-0 justify-center"
                onClick={() => setActivePlotId(track.id)}
                title={track.title}
              >
                <span className="truncate">{track.title}</span>
              </Button>
            ))}
          </div>
        </>
      )}

      {compact ? (
        <Card className="overflow-hidden p-0">
          <WellPlotTrack
            track={activeTrack}
            rows={plotDepthRows}
            plotHeightPx={plotHeightPx}
            plotHeightCss={plotHeightCss}
            compact
            fullWidth
            headerHeightPx={compactActiveHeaderHeightPx}
            onHeaderHeightChange={handleHeaderHeightChange}
          />
        </Card>
      ) : showAllTracks ? (
        <>
          <TrackWindowControls
            tracks={tracks}
            startIndex={trackWindowStart}
            visibleCount={multiTrackLimit}
            onStartChange={setTrackWindowStart}
          />
          <Card className="overflow-hidden p-0">
            <div
              className="grid divide-x divide-slate-300 dark:divide-slate-700"
              style={{
                minWidth: allTracksMinWidth
                  ? `${allTracksMinWidth}px`
                  : undefined,
                gridTemplateColumns: `repeat(${visibleTrackWindow.tracks.length}, minmax(0, 1fr))`,
              }}
            >
              {visibleTrackWindow.tracks.map((track) => (
                <WellPlotTrack
                  key={track.id}
                  track={track}
                  rows={plotDepthRows}
                  plotHeightPx={plotHeightPx}
                  plotHeightCss={plotHeightCss}
                  fullWidth
                  dense={dashboardDense}
                  headerHeightPx={visibleDenseHeaderHeightPx}
                  onHeaderHeightChange={handleHeaderHeightChange}
                />
              ))}
            </div>
          </Card>
        </>
      ) : (
        <>
          <div className="2xl:hidden">
            <Card className="overflow-hidden p-0">
              <WellPlotTrack
                track={activeTrack}
                rows={plotDepthRows}
                plotHeightPx={plotHeightPx}
                plotHeightCss={plotHeightCss}
                fullWidth
                headerHeightPx={activeHeaderHeightPx}
                onHeaderHeightChange={handleHeaderHeightChange}
              />
            </Card>
          </div>

          <div className="hidden space-y-3 2xl:block">
            <TrackWindowControls
              tracks={tracks}
              startIndex={trackWindowStart}
              visibleCount={multiTrackLimit}
              onStartChange={setTrackWindowStart}
            />
            <Card className="overflow-hidden p-0">
              <div
                className="grid divide-y divide-slate-300 sm:grid-cols-1 lg:divide-x lg:divide-y-0 dark:divide-slate-700"
                style={{
                  gridTemplateColumns: `repeat(${visibleTrackWindow.tracks.length}, minmax(0, 1fr))`,
                }}
              >
                {visibleTrackWindow.tracks.map((track) => (
                  <WellPlotTrack
                    key={track.id}
                    track={track}
                    rows={plotDepthRows}
                    plotHeightPx={plotHeightPx}
                    plotHeightCss={plotHeightCss}
                    fullWidth
                    headerHeightPx={visibleHeaderHeightPx}
                    onHeaderHeightChange={handleHeaderHeightChange}
                  />
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
