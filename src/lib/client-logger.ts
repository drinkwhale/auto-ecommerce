'use client'

/* eslint-disable no-console */

type LogMethod = (...args: unknown[]) => void

const shouldLog = () => process.env.NODE_ENV !== 'production'

const makeMethod =
  (method: 'error' | 'warn' | 'info' | 'debug'): LogMethod =>
  (...args) => {
    if (!shouldLog()) return

    console[method](...args)
  }

export const clientLogger = {
  error: makeMethod('error'),
  warn: makeMethod('warn'),
  info: makeMethod('info'),
  debug: makeMethod('debug'),
}
