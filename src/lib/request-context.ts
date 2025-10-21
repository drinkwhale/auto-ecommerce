/**
 * Lightweight async context storage for inbound requests and background jobs.
 * Use `runWithRequestContext` or `enterRequestContext` to attach metadata that
 * downstream services (e.g. logger) can consume without manual parameter
 * threading.
 */
import { AsyncLocalStorage } from 'async_hooks'
import { randomUUID } from 'crypto'

export type RequestContext = {
  requestId: string
  userId?: string
  source?: string
  feature?: string
  metadata: Record<string, unknown>
  startedAt: number
}

export type RequestContextInit = Partial<Omit<RequestContext, 'metadata' | 'startedAt'>> & {
  metadata?: Record<string, unknown>
}

const storage = new AsyncLocalStorage<RequestContext>()

const createContext = (init: RequestContextInit = {}): RequestContext => ({
  requestId: init.requestId ?? randomUUID(),
  userId: init.userId,
  source: init.source,
  feature: init.feature,
  metadata: { ...(init.metadata ?? {}) },
  startedAt: Date.now(),
})

export const runWithRequestContext = async <T>(
  init: RequestContextInit,
  handler: () => Promise<T> | T
): Promise<T> => {
  const context = createContext(init)
  return storage.run(context, handler)
}

export const enterRequestContext = (init: RequestContextInit = {}): RequestContext => {
  const context = createContext(init)
  storage.enterWith(context)
  return context
}

export const getRequestContext = (): RequestContext | undefined => storage.getStore()

export const updateRequestContext = (patch: RequestContextInit): RequestContext | undefined => {
  const context = storage.getStore()

  if (!context) return undefined

  if (patch.userId !== undefined) context.userId = patch.userId
  if (patch.source !== undefined) context.source = patch.source
  if (patch.feature !== undefined) context.feature = patch.feature
  if (patch.requestId !== undefined) context.requestId = patch.requestId
  if (patch.metadata) {
    context.metadata = {
      ...context.metadata,
      ...patch.metadata,
    }
  }

  return context
}

export const getRequestId = (): string | undefined => storage.getStore()?.requestId

export const getRequestMetadata = (): Record<string, unknown> | undefined =>
  storage.getStore()?.metadata

export const withRequestContext = runWithRequestContext

export { storage as requestContextStorage }
