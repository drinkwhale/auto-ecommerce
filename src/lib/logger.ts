/**
 * Structured JSON logger that automatically enriches log entries with request
 * context pulled from AsyncLocalStorage. Supports pretty-printing in
 * development and child loggers for component-level metadata.
 */
import { inspect } from 'util'

import {
  getRequestContext,
  RequestContext,
  RequestContextInit,
  runWithRequestContext,
} from '@/lib/request-context'

type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace'

type LogPayload = Record<string, unknown>

export type LogMeta = Record<string, unknown>

const levelWeights: Record<LogLevel, number> = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10,
}

const stringToLevel = (value: string | undefined): LogLevel => {
  if (!value) return 'info'

  const normalized = value.toLowerCase() as LogLevel
  return normalized in levelWeights ? normalized : 'info'
}

const envLevel = stringToLevel(process.env.LOG_LEVEL)
const prettyOutput = process.env.LOG_PRETTY === 'true' && process.env.NODE_ENV !== 'production'

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const normalizeError = (error: unknown): LogPayload | undefined => {
  if (!error) return undefined

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  return { payload: error }
}

const buildContextPayload = (context?: RequestContext): LogPayload => {
  if (!context) return {}

  const payload: LogPayload = {
    requestId: context.requestId,
  }

  if (context.userId) payload.userId = context.userId
  if (context.source) payload.source = context.source
  if (context.feature) payload.feature = context.feature
  if (context.metadata && Object.keys(context.metadata).length > 0) {
    payload.context = context.metadata
  }

  payload.elapsedMs = Date.now() - context.startedAt

  return payload
}

const serializeForPretty = (record: LogPayload): string => {
  const { level, message, error, ...rest } = record
  const parts: string[] = []

  parts.push(`[${record.timestamp}]`)
  parts.push(`[${String(level).toUpperCase()}]`)

  if (record.requestId) {
    parts.push(`[req:${record.requestId}]`)
  }

  parts.push(String(message))

  if (error && isObject(error)) {
    parts.push(`error=${error.name ?? 'Error'}:${error.message ?? ''}`)
  }

  const meta: LogPayload = { ...rest }
  delete meta.timestamp
  delete meta.requestId
  delete meta.elapsedMs

  if (Object.keys(meta).length > 0) {
    parts.push(inspect(meta, { colors: true, depth: 5, compact: true }))
  }

  if (error && isObject(error) && error.stack) {
    parts.push(`\n${error.stack}`)
  }

  return parts.join(' ')
}

const writeLog = (level: LogLevel, record: LogPayload): void => {
  const consoleMethod =
    level === 'fatal' || level === 'error'
      ? console.error
      : level === 'warn'
      ? console.warn
      : console.log

  if (prettyOutput) {
    consoleMethod(serializeForPretty(record))
    return
  }

  consoleMethod(JSON.stringify(record))
}

class StructuredLogger {
  private readonly defaultMeta: LogMeta
  private readonly environment: string
  private readonly level: LogLevel

  constructor(options?: { level?: LogLevel; meta?: LogMeta }) {
    this.environment = process.env.NODE_ENV ?? 'development'
    this.level = options?.level ?? envLevel
    this.defaultMeta = options?.meta ? { ...options.meta } : {}
  }

  child(meta: LogMeta): StructuredLogger {
    return new StructuredLogger({
      level: this.level,
      meta: { ...this.defaultMeta, ...meta },
    })
  }

  withContext<T>(context: RequestContextInit, handler: () => Promise<T> | T): Promise<T> | T {
    return runWithRequestContext(context, handler)
  }

  fatal(message: unknown, meta?: LogMeta): void {
    this.log('fatal', message, meta)
  }

  error(message: unknown, meta?: LogMeta): void {
    this.log('error', message, meta)
  }

  warn(message: unknown, meta?: LogMeta): void {
    this.log('warn', message, meta)
  }

  info(message: unknown, meta?: LogMeta): void {
    this.log('info', message, meta)
  }

  debug(message: unknown, meta?: LogMeta): void {
    this.log('debug', message, meta)
  }

  trace(message: unknown, meta?: LogMeta): void {
    this.log('trace', message, meta)
  }

  private log(level: LogLevel, message: unknown, meta?: LogMeta): void {
    if (levelWeights[level] < levelWeights[this.level]) return

    const context = getRequestContext()
    const timestamp = new Date().toISOString()

    const record: LogPayload = {
      level,
      timestamp,
      environment: this.environment,
      ...this.defaultMeta,
      ...buildContextPayload(context),
    }

    const normalized = this.normalizeMessage(message)
    record.message = normalized.message

    if (normalized.error) {
      record.error = normalized.error
    }

    const combinedMeta: LogMeta = {}

    if (normalized.extraMeta && Object.keys(normalized.extraMeta).length > 0) {
      Object.assign(combinedMeta, normalized.extraMeta)
    }

    if (meta && Object.keys(meta).length > 0) {
      Object.assign(combinedMeta, meta)
    }

    if (Object.keys(combinedMeta).length > 0) {
      record.meta = combinedMeta
    }

    writeLog(level, record)
  }

  private normalizeMessage(input: unknown): {
    message: string
    error?: LogPayload
    extraMeta?: LogMeta
  } {
    if (input instanceof Error) {
      return {
        message: input.message,
        error: normalizeError(input),
      }
    }

    if (typeof input === 'string') {
      return { message: input }
    }

    if (isObject(input)) {
      const { message, error, ...rest } = input as {
        message?: unknown
        error?: unknown
      } & Record<string, unknown>

      return {
        message: message ? String(message) : JSON.stringify(rest),
        error: normalizeError(error),
        extraMeta: rest,
      }
    }

    return { message: inspect(input) }
  }
}

export const logger = new StructuredLogger()

export const createLogger = (meta?: LogMeta, level?: LogLevel): StructuredLogger =>
  new StructuredLogger({ meta, level })
