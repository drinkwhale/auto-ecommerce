import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || undefined

  return logger.withContext(
    {
      requestId,
      source: 'api/health',
      metadata: {
        method: 'GET',
        path: '/api/health',
      },
    },
    async () => {
      try {
        // 데이터베이스 연결 테스트
        await prisma.$connect()

        // 간단한 쿼리 실행으로 연결 확인
        const result = await prisma.$queryRaw`SELECT 1 as test`

        logger.info('Health check succeeded')

        return NextResponse.json({
          status: 'ok',
          database: 'connected',
          timestamp: new Date().toISOString(),
          result,
        })
      } catch (error) {
        logger.error('Database connection error', { error })

        return NextResponse.json(
          {
            status: 'error',
            database: 'disconnected',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          },
          { status: 500 }
        )
      } finally {
        await prisma.$disconnect()
      }
    }
  )
}
