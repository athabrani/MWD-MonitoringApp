import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js'
import * as historicalDataService from '../services/historical-data.service.js'
import * as sessionService from '../services/mwd-session.service.js'
import * as exportRecordService from '../services/export-record.service.js'
import { createAuditLog } from '../services/audit-log.service.js'
import * as surveyService from '../services/survey.service.js'
import * as witsConfigService from '../services/wits-config.service.js'
import * as witsDataService from '../services/wits-data.service.js'
import { buildLasExport } from '../services/las-export.service.js'
import { buildPdfPlot } from '../services/pdf-plot.service.js'
import { buildSurveyExcelExport } from '../services/survey-excel-export.service.js'
import { buildSurveyPdfExport } from '../services/survey-pdf-export.service.js'
import {
  buildExportFileName,
  buildSurveyExportFileName,
  buildWitsExportFileName,
  serializeHistoricalDataAsCsv,
  serializeHistoricalDataAsJson,
  serializeSurveyStationsAsCsv,
  serializeWitsValuesAsCsv,
} from '../services/export.service.js'
import { normalizeWitsId } from '../utils/mwd-measurements.js'

const parsePositiveInt = (value: unknown) => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  }

  return null
}

const parsePositiveNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
  }

  return null
}

const parseOptionalDate = (value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  if (typeof value !== 'string') {
    return 'invalid' as const
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? ('invalid' as const) : date
}

const parseOptionalBoolean = (value: unknown, fallback: boolean) => {
  if (value === undefined || value === null || value === '') {
    return fallback
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()

    if (normalized === 'true' || normalized === '1') {
      return true
    }

    if (normalized === 'false' || normalized === '0') {
      return false
    }
  }

  return null
}

const parseOptionalSignedNumber = (value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 'invalid'
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 'invalid'
  }

  return 'invalid' as const
}

const parseOptionalInteger = (value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : NaN

  return Number.isInteger(parsed) ? parsed : 'invalid'
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const parseWitsId = (value: unknown) => {
  const witsId = normalizeWitsId(value)
  return witsId && /^\d{4}$/.test(witsId) ? witsId : null
}

const auditExport = async (input: {
  userId: number
  action: string
  sessionId: number
  fileName: string
  fileType: string
  rowCount?: number
}) => {
  await createAuditLog({
    userId: input.userId,
    action: input.action,
    details: `Exported ${input.fileType} ${input.fileName}`,
    metadata: {
      sessionId: input.sessionId,
      fileName: input.fileName,
      fileType: input.fileType,
      rowCount: input.rowCount ?? null,
    },
  })
}

const parseExportFormat = (value: unknown): 'csv' | 'json' | null => {
  if (value === undefined || value === null || value === '') {
    return 'csv'
  }

  return value === 'csv' || value === 'json' ? value : null
}

export const exportHistoricalData = async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthenticatedRequest).user

    if (!authUser) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const sessionId = parsePositiveInt(req.body?.sessionId)
    const format = req.body?.format
    const measuredFrom = parseOptionalDate(req.body?.measuredFrom)
    const measuredTo = parseOptionalDate(req.body?.measuredTo)
    const depthMin = parsePositiveNumber(req.body?.depthMin)
    const depthMax = parsePositiveNumber(req.body?.depthMax)

    if (sessionId === null) {
      return res.status(400).json({ message: 'Valid sessionId is required' })
    }

    if (format !== 'json' && format !== 'csv') {
      return res
        .status(400)
        .json({ message: 'Format must be either json or csv' })
    }

    if (measuredFrom === 'invalid') {
      return res
        .status(400)
        .json({ message: 'measuredFrom must be a valid date' })
    }

    if (measuredTo === 'invalid') {
      return res
        .status(400)
        .json({ message: 'measuredTo must be a valid date' })
    }

    if (req.body?.depthMin !== undefined && depthMin === null) {
      return res
        .status(400)
        .json({ message: 'depthMin must be a non-negative number' })
    }

    if (req.body?.depthMax !== undefined && depthMax === null) {
      return res
        .status(400)
        .json({ message: 'depthMax must be a non-negative number' })
    }

    const session = await sessionService.getSessionById(sessionId)

    if (!session) {
      return res.status(404).json({ message: 'Session not found' })
    }

    const historicalQuery: {
      sessionId: number
      measuredFrom?: Date
      measuredTo?: Date
      depthMin?: number
      depthMax?: number
    } = {
      sessionId,
    }

    if (measuredFrom !== undefined) {
      historicalQuery.measuredFrom = measuredFrom
    }

    if (measuredTo !== undefined) {
      historicalQuery.measuredTo = measuredTo
    }

    if (depthMin !== null) {
      historicalQuery.depthMin = depthMin
    }

    if (depthMax !== null) {
      historicalQuery.depthMax = depthMax
    }

    const historicalData =
      await historicalDataService.getHistoricalData(historicalQuery)

    const fileName = buildExportFileName(session.sessionCode, format)
    const body =
      format === 'json'
        ? serializeHistoricalDataAsJson(historicalData.data)
        : serializeHistoricalDataAsCsv(historicalData.data)

    await exportRecordService.createExportRecord({
      sessionId,
      exportedById: authUser.userId,
      fileName,
      fileType: format,
      rowCount: historicalData.count,
    })
    await auditExport({
      userId: authUser.userId,
      action: 'export.historical',
      sessionId,
      fileName,
      fileType: format,
      rowCount: historicalData.count,
    })

    res.setHeader(
      'Content-Type',
      format === 'json'
        ? 'application/json; charset=utf-8'
        : 'text/csv; charset=utf-8',
    )
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.status(200).send(body)
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ message })
  }
}

export const exportHistoricalLast24Hours = async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthenticatedRequest).user

    if (!authUser) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const parsedSessionId =
      req.query.sessionId === undefined
        ? undefined
        : parsePositiveInt(req.query.sessionId)
    const format = parseExportFormat(req.query.format)

    if (req.query.sessionId !== undefined && parsedSessionId === null) {
      return res.status(400).json({ message: 'sessionId must be a positive integer' })
    }

    if (format === null) {
      return res.status(400).json({ message: 'format must be csv or json' })
    }

    let session: Awaited<ReturnType<typeof sessionService.getSessionById>> | null = null
    const sessionId =
      typeof parsedSessionId === 'number' ? parsedSessionId : undefined

    if (sessionId !== undefined) {
      session = await sessionService.getSessionById(sessionId)

      if (!session) {
        return res.status(404).json({ message: 'Session not found' })
      }
    }

    const measuredTo = new Date()
    const measuredFrom = new Date(measuredTo.getTime() - 24 * 60 * 60 * 1000)
    const historicalData = await historicalDataService.getHistoricalData({
      ...(sessionId !== undefined ? { sessionId } : {}),
      measuredFrom,
      measuredTo,
    })
    const safeSessionCode = session?.sessionCode ?? 'all_sessions'
    const fileName = buildExportFileName(safeSessionCode, format).replace(
      '_historical_',
      '_historical_last_24_hours_',
    )
    const body =
      format === 'json'
        ? serializeHistoricalDataAsJson(historicalData.data)
        : serializeHistoricalDataAsCsv(historicalData.data)

    if (sessionId !== undefined) {
      await exportRecordService.createExportRecord({
        sessionId,
        exportedById: authUser.userId,
        fileName,
        fileType: `historical_last_24h_${format}`,
        rowCount: historicalData.count,
      })
    }

    await createAuditLog({
      userId: authUser.userId,
      action: 'export.historical_last_24h',
      details: `Exported historical last 24 hours ${fileName}`,
      metadata: {
        sessionId: sessionId ?? null,
        fileName,
        fileType: format,
        rowCount: historicalData.count,
        measuredFrom: measuredFrom.toISOString(),
        measuredTo: measuredTo.toISOString(),
      },
    })

    res.setHeader(
      'Content-Type',
      format === 'json'
        ? 'application/json; charset=utf-8'
        : 'text/csv; charset=utf-8',
    )
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.status(200).send(body)
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ message })
  }
}

export const exportWitsData = async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthenticatedRequest).user

    if (!authUser) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const sessionId = parsePositiveInt(req.body?.sessionId)
    const witsId = parseWitsId(req.body?.witsId)
    const measuredFrom = parseOptionalDate(req.body?.measuredFrom)
    const measuredTo = parseOptionalDate(req.body?.measuredTo)
    const depthMin = parsePositiveNumber(
      req.body?.depthMin ?? req.body?.startDepth,
    )
    const depthMax = parsePositiveNumber(
      req.body?.depthMax ?? req.body?.endDepth,
    )
    const sampleMode =
      req.body?.sampleMode === 'first_per_depth' ? 'first_per_depth' : 'all'

    if (sessionId === null) {
      return res.status(400).json({ message: 'Valid sessionId is required' })
    }

    if (witsId === null) {
      return res.status(400).json({ message: 'witsId must be a 4 digit WITS ID' })
    }

    if (measuredFrom === 'invalid') {
      return res
        .status(400)
        .json({ message: 'measuredFrom must be a valid date' })
    }

    if (measuredTo === 'invalid') {
      return res
        .status(400)
        .json({ message: 'measuredTo must be a valid date' })
    }

    if (
      (req.body?.depthMin !== undefined || req.body?.startDepth !== undefined) &&
      depthMin === null
    ) {
      return res
        .status(400)
        .json({ message: 'startDepth/depthMin must be a non-negative number' })
    }

    if (
      (req.body?.depthMax !== undefined || req.body?.endDepth !== undefined) &&
      depthMax === null
    ) {
      return res
        .status(400)
        .json({ message: 'endDepth/depthMax must be a non-negative number' })
    }

    const session = await sessionService.getSessionById(sessionId)

    if (!session) {
      return res.status(404).json({ message: 'Session not found' })
    }

    const config = await witsConfigService.getWitsConfigByWitsId(witsId)
    const rows = await witsDataService.getWitsDataValuesForExport({
      sessionId,
      witsId,
      sampleMode,
      ...(measuredFrom !== undefined ? { measuredFrom } : {}),
      ...(measuredTo !== undefined ? { measuredTo } : {}),
      ...(depthMin !== null ? { depthMin } : {}),
      ...(depthMax !== null ? { depthMax } : {}),
    })
    const configName =
      isRecord(config) && typeof config.name === 'string'
        ? config.name
        : undefined
    const valueLabel = configName ?? rows[0]?.witsConfig?.name ?? witsId
    const body = serializeWitsValuesAsCsv(rows, valueLabel)
    const fileName = buildWitsExportFileName(session.sessionCode, witsId, valueLabel)

    await exportRecordService.createExportRecord({
      sessionId,
      exportedById: authUser.userId,
      fileName,
      fileType: 'wits_csv',
      rowCount: rows.length,
    })
    await auditExport({
      userId: authUser.userId,
      action: 'export.wits',
      sessionId,
      fileName,
      fileType: 'wits_csv',
      rowCount: rows.length,
    })

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.status(200).send(body)
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ message })
  }
}

export const exportLasData = async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthenticatedRequest).user

    if (!authUser) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const sessionId = parsePositiveInt(req.body?.sessionId)
    const measuredFrom = parseOptionalDate(req.body?.measuredFrom)
    const measuredTo = parseOptionalDate(req.body?.measuredTo)
    const depthMin = parsePositiveNumber(
      req.body?.depthMin ?? req.body?.startDepth,
    )
    const depthMax = parsePositiveNumber(
      req.body?.depthMax ?? req.body?.endDepth,
    )
    const includeWits = parseOptionalBoolean(req.body?.includeWits, true)
    const includeSurvey = parseOptionalBoolean(
      req.body?.includeSurvey ?? req.body?.includeProjectedSurvey,
      true,
    )
    const nullValue = parseOptionalSignedNumber(req.body?.nullValue)
    const stepDepth = parsePositiveNumber(req.body?.stepDepth)
    const maxGap = parsePositiveNumber(req.body?.maxGap)
    const depthPrecision = parseOptionalInteger(req.body?.depthPrecision)
    const stopAtLastSurveyDepth = parseOptionalBoolean(
      req.body?.stopAtLastSurveyDepth,
      false,
    )
    const dateTimeInFirstColumn = parseOptionalBoolean(
      req.body?.dateTimeInFirstColumn,
      false,
    )
    const correctDepthColumnForTvd = parseOptionalBoolean(
      req.body?.correctDepthColumnForTvd,
      false,
    )
    const interpolateSurvey = parseOptionalBoolean(
      req.body?.interpolateSurvey,
      false,
    )
    const includeSurveysInOtherSection = parseOptionalBoolean(
      req.body?.includeSurveysInOtherSection,
      false,
    )
    const columns =
      req.body?.columns === undefined
        ? undefined
        : Array.isArray(req.body.columns)
          ? req.body.columns
          : 'invalid'
    const wellInfo =
      req.body?.wellInfo === undefined
        ? undefined
        : Array.isArray(req.body.wellInfo)
          ? req.body.wellInfo
          : 'invalid'
    const depthUnit =
      typeof req.body?.depthUnit === 'string' && req.body.depthUnit.trim()
        ? req.body.depthUnit.trim()
        : undefined
    const surveyStationType =
      typeof req.body?.surveyStationType === 'string' &&
      req.body.surveyStationType.trim()
        ? req.body.surveyStationType.trim()
        : undefined

    if (sessionId === null) {
      return res.status(400).json({ message: 'Valid sessionId is required' })
    }

    if (measuredFrom === 'invalid') {
      return res
        .status(400)
        .json({ message: 'measuredFrom must be a valid date' })
    }

    if (measuredTo === 'invalid') {
      return res
        .status(400)
        .json({ message: 'measuredTo must be a valid date' })
    }

    if (
      (req.body?.depthMin !== undefined ||
        req.body?.startDepth !== undefined) &&
      depthMin === null
    ) {
      return res
        .status(400)
        .json({ message: 'startDepth/depthMin must be a non-negative number' })
    }

    if (
      (req.body?.depthMax !== undefined || req.body?.endDepth !== undefined) &&
      depthMax === null
    ) {
      return res
        .status(400)
        .json({ message: 'endDepth/depthMax must be a non-negative number' })
    }

    if (includeWits === null) {
      return res
        .status(400)
        .json({ message: 'includeWits must be true or false' })
    }

    if (includeSurvey === null) {
      return res
        .status(400)
        .json({ message: 'includeSurvey must be true or false' })
    }

    if (nullValue === 'invalid') {
      return res
        .status(400)
        .json({ message: 'nullValue must be a valid number' })
    }

    if (req.body?.stepDepth !== undefined && stepDepth === null) {
      return res
        .status(400)
        .json({ message: 'stepDepth must be a non-negative number' })
    }

    if (req.body?.maxGap !== undefined && maxGap === null) {
      return res
        .status(400)
        .json({ message: 'maxGap must be a non-negative number' })
    }

    if (
      depthPrecision === 'invalid' ||
      (typeof depthPrecision === 'number' &&
        (depthPrecision < 0 || depthPrecision > 8))
    ) {
      return res
        .status(400)
        .json({ message: 'depthPrecision must be an integer between 0 and 8' })
    }

    for (const [fieldName, value] of [
      ['stopAtLastSurveyDepth', stopAtLastSurveyDepth],
      ['dateTimeInFirstColumn', dateTimeInFirstColumn],
      ['correctDepthColumnForTvd', correctDepthColumnForTvd],
      ['interpolateSurvey', interpolateSurvey],
      ['includeSurveysInOtherSection', includeSurveysInOtherSection],
    ] as const) {
      if (value === null) {
        return res
          .status(400)
          .json({ message: `${fieldName} must be true or false` })
      }
    }

    if (columns === 'invalid') {
      return res.status(400).json({ message: 'columns must be an array' })
    }

    if (wellInfo === 'invalid') {
      return res.status(400).json({ message: 'wellInfo must be an array' })
    }

    const session = await sessionService.getSessionById(sessionId)

    if (!session) {
      return res.status(404).json({ message: 'Session not found' })
    }

    const lasInput: Parameters<typeof buildLasExport>[0] = {
      sessionId,
      sessionCode: session.sessionCode,
      wellName: session.wellName,
      rigName: session.rigName,
      includeWits,
      includeSurvey,
      stopAtLastSurveyDepth: stopAtLastSurveyDepth ?? false,
      dateTimeInFirstColumn: dateTimeInFirstColumn ?? false,
      correctDepthColumnForTvd: correctDepthColumnForTvd ?? false,
      interpolateSurvey: interpolateSurvey ?? false,
      includeSurveysInOtherSection: includeSurveysInOtherSection ?? false,
    }

    if (measuredFrom !== undefined) {
      lasInput.measuredFrom = measuredFrom
    }

    if (measuredTo !== undefined) {
      lasInput.measuredTo = measuredTo
    }

    if (depthMin !== null) {
      lasInput.depthMin = depthMin
    }

    if (depthMax !== null) {
      lasInput.depthMax = depthMax
    }

    if (nullValue !== undefined) {
      lasInput.nullValue = nullValue
    }

    if (stepDepth !== null && stepDepth !== undefined) {
      lasInput.stepDepth = stepDepth
    }

    if (maxGap !== null && maxGap !== undefined) {
      lasInput.maxGap = maxGap
    }

    if (typeof depthPrecision === 'number') {
      lasInput.depthPrecision = depthPrecision
    }

    if (depthUnit !== undefined) {
      lasInput.depthUnit = depthUnit
    }

    if (surveyStationType !== undefined) {
      lasInput.surveyStationType = surveyStationType
    }

    if (columns !== undefined && columns !== 'invalid') {
      lasInput.columns = columns as NonNullable<
        Parameters<typeof buildLasExport>[0]['columns']
      >
    }

    if (wellInfo !== undefined && wellInfo !== 'invalid') {
      lasInput.wellInfo = wellInfo as NonNullable<
        Parameters<typeof buildLasExport>[0]['wellInfo']
      >
    }

    const lasExport = await buildLasExport(lasInput)

    await exportRecordService.createExportRecord({
      sessionId,
      exportedById: authUser.userId,
      fileName: lasExport.fileName,
      fileType: 'las',
      rowCount: lasExport.rowCount,
    })
    await auditExport({
      userId: authUser.userId,
      action: 'export.las',
      sessionId,
      fileName: lasExport.fileName,
      fileType: 'las',
      rowCount: lasExport.rowCount,
    })

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${lasExport.fileName}"`,
    )
    res.status(200).send(lasExport.content)
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ message })
  }
}

export const exportSurveyData = async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthenticatedRequest).user

    if (!authUser) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const sessionId = parsePositiveInt(req.body?.sessionId)
    const format = req.body?.format ?? 'csv'
    const stationType =
      typeof req.body?.stationType === 'string' && req.body.stationType.trim()
        ? req.body.stationType.trim()
        : 'actual'

    if (sessionId === null) {
      return res.status(400).json({ message: 'Valid sessionId is required' })
    }

    if (format !== 'csv') {
      return res.status(400).json({ message: 'Format must be csv' })
    }

    const session = await sessionService.getSessionById(sessionId)

    if (!session) {
      return res.status(404).json({ message: 'Session not found' })
    }

    const stations = await surveyService.getSurveyStations({
      sessionId,
      stationType,
    })
    const fileName = buildSurveyExportFileName(session.sessionCode, stationType)
    const body = serializeSurveyStationsAsCsv(
      stations as Parameters<typeof serializeSurveyStationsAsCsv>[0],
    )

    await exportRecordService.createExportRecord({
      sessionId,
      exportedById: authUser.userId,
      fileName,
      fileType: 'survey_csv',
      rowCount: stations.length,
    })
    await auditExport({
      userId: authUser.userId,
      action: 'export.survey_csv',
      sessionId,
      fileName,
      fileType: 'survey_csv',
      rowCount: stations.length,
    })

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.status(200).send(body)
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ message })
  }
}

export const exportSurveyDataAsExcel = async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthenticatedRequest).user

    if (!authUser) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const sessionId = parsePositiveInt(req.body?.sessionId)
    const stationType =
      typeof req.body?.stationType === 'string' && req.body.stationType.trim()
        ? req.body.stationType.trim()
        : 'actual'

    if (sessionId === null) {
      return res.status(400).json({ message: 'Valid sessionId is required' })
    }

    const session = await sessionService.getSessionById(sessionId)

    if (!session) {
      return res.status(404).json({ message: 'Session not found' })
    }

    const stations = await surveyService.getSurveyStations({
      sessionId,
      stationType,
    })

    const fileName = buildSurveyExportFileName(
      session.sessionCode,
      stationType,
    ).replace('.csv', '.xlsx')
    const excelExport = await buildSurveyExcelExport(
      stations as Parameters<typeof buildSurveyExcelExport>[0],
      fileName,
    )

    await exportRecordService.createExportRecord({
      sessionId,
      exportedById: authUser.userId,
      fileName: excelExport.fileName,
      fileType: 'survey_excel',
      rowCount: stations.length,
    })
    await auditExport({
      userId: authUser.userId,
      action: 'export.survey_excel',
      sessionId,
      fileName: excelExport.fileName,
      fileType: 'survey_excel',
      rowCount: stations.length,
    })

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${excelExport.fileName}"`,
    )
    res.status(200).send(excelExport.buffer)
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ message })
  }
}

export const exportSurveyDataAsPdf = async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthenticatedRequest).user

    if (!authUser) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const sessionId = parsePositiveInt(req.body?.sessionId)
    const stationType =
      typeof req.body?.stationType === 'string' && req.body.stationType.trim()
        ? req.body.stationType.trim()
        : 'actual'

    if (sessionId === null) {
      return res.status(400).json({ message: 'Valid sessionId is required' })
    }

    const session = await sessionService.getSessionById(sessionId)

    if (!session) {
      return res.status(404).json({ message: 'Session not found' })
    }

    const stations = await surveyService.getSurveyStations({
      sessionId,
      stationType,
    })

    const fileName = buildSurveyExportFileName(
      session.sessionCode,
      stationType,
    ).replace('.csv', '.pdf')
    
    const sessionInfo: { wellName?: string; rigName?: string } = {}

    if (session.wellName) {
      sessionInfo.wellName = session.wellName
    }

    if (session.rigName) {
      sessionInfo.rigName = session.rigName
    }

    const pdfExport = await buildSurveyPdfExport(
      stations as Parameters<typeof buildSurveyPdfExport>[0],
      fileName,
      sessionInfo,
    )
    await exportRecordService.createExportRecord({
      sessionId,
      exportedById: authUser.userId,
      fileName: pdfExport.fileName,
      fileType: 'survey_pdf',
      rowCount: stations.length,
    })
    await auditExport({
      userId: authUser.userId,
      action: 'export.survey_pdf',
      sessionId,
      fileName: pdfExport.fileName,
      fileType: 'survey_pdf',
      rowCount: stations.length,
    })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${pdfExport.fileName}"`,
    )
    res.status(200).send(pdfExport.buffer)
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ message })
  }
}

export const exportPdfPlot = async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthenticatedRequest).user

    if (!authUser) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const sessionId = parsePositiveInt(req.body?.sessionId)
    const templateId =
      req.body?.templateId === undefined
        ? undefined
        : parsePositiveInt(req.body.templateId)
    const depthMin = parsePositiveNumber(
      req.body?.depthMin ?? req.body?.startDepth,
    )
    const depthMax = parsePositiveNumber(
      req.body?.depthMax ?? req.body?.endDepth,
    )
    const template =
      req.body?.template === undefined
        ? undefined
        : isRecord(req.body.template)
          ? req.body.template
          : 'invalid'

    if (sessionId === null) {
      return res.status(400).json({ message: 'Valid sessionId is required' })
    }

    if (req.body?.templateId !== undefined && templateId === null) {
      return res
        .status(400)
        .json({ message: 'templateId must be a positive integer' })
    }

    if (
      (req.body?.depthMin !== undefined ||
        req.body?.startDepth !== undefined) &&
      depthMin === null
    ) {
      return res
        .status(400)
        .json({ message: 'startDepth/depthMin must be a non-negative number' })
    }

    if (
      (req.body?.depthMax !== undefined || req.body?.endDepth !== undefined) &&
      depthMax === null
    ) {
      return res
        .status(400)
        .json({ message: 'endDepth/depthMax must be a non-negative number' })
    }

    if (template === 'invalid') {
      return res.status(400).json({ message: 'template must be an object' })
    }

    const session = await sessionService.getSessionById(sessionId)

    if (!session) {
      return res.status(404).json({ message: 'Session not found' })
    }

    const pdfInput: Parameters<typeof buildPdfPlot>[0] = {
      sessionId,
      sessionCode: session.sessionCode,
    }

    if (session.wellName !== undefined) {
      pdfInput.wellName = session.wellName
    }

    if (session.rigName !== undefined) {
      pdfInput.rigName = session.rigName
    }

    if (templateId !== undefined && templateId !== null) {
      pdfInput.templateId = templateId
    }

    if (depthMin !== null) {
      pdfInput.depthMin = depthMin
    }

    if (depthMax !== null) {
      pdfInput.depthMax = depthMax
    }

    if (template !== undefined && template !== 'invalid') {
      pdfInput.template = template
    }

    const pdfExport = await buildPdfPlot(pdfInput)

    await exportRecordService.createExportRecord({
      sessionId,
      exportedById: authUser.userId,
      fileName: pdfExport.fileName,
      fileType: 'pdf_plot',
      rowCount: pdfExport.rowCount,
    })
    await auditExport({
      userId: authUser.userId,
      action: 'export.pdf_plot',
      sessionId,
      fileName: pdfExport.fileName,
      fileType: 'pdf_plot',
      rowCount: pdfExport.rowCount,
    })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${pdfExport.fileName}"`,
    )
    res.status(200).send(pdfExport.content)
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ message })
  }
}

export const getExportRecords = async (_req: Request, res: Response) => {
  try {
    const records = await exportRecordService.getAllExportRecords()
    res.json(records)
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ message })
  }
}
