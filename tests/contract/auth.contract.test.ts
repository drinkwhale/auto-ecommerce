import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import request from 'supertest'
import { z } from 'zod'
import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { clearDatabase, createTestUser, testDatabaseConnection } from '../helpers/database'
import { hashPassword, verifyPassword, generateTestToken } from '../helpers/auth'

// Next.js 앱 초기화
const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = 3001 // 테스트용 포트
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

let server: any

// API 응답 스키마 정의
const RegisterResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string().nullable(),
    role: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  token: z.string(),
  message: z.string(),
})

const LoginResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string().nullable(),
    role: z.string(),
  }),
  token: z.string(),
  message: z.string(),
})

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  details: z.any().optional(),
})

describe('인증 API 계약 테스트', () => {
  beforeAll(async () => {
    // 데이터베이스 연결 확인
    const isConnected = await testDatabaseConnection()
    expect(isConnected).toBe(true)

    // Next.js 앱 준비
    await app.prepare()

    // 테스트 서버 시작
    server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url!, true)
        await handle(req, res, parsedUrl)
      } catch (err) {
        console.error('Error occurred handling', req.url, err)
        res.statusCode = 500
        res.end('internal server error')
      }
    })

    await new Promise<void>((resolve) => {
      server.listen(port, () => {
        console.log(`Test server running on http://${hostname}:${port}`)
        resolve()
      })
    })
  })

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve())
      })
    }
    await app.close()
  })

  beforeEach(async () => {
    await clearDatabase()
  })

  describe('POST /api/auth/register - 회원가입', () => {
    test('유효한 데이터로 회원가입 시 성공해야 함', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
      }

      const response = await request(server)
        .post('/api/auth/register')
        .send(userData)
        .expect(201)

      // 응답 스키마 검증
      const result = RegisterResponseSchema.parse(response.body)

      // 응답 데이터 검증
      expect(result.user.email).toBe(userData.email)
      expect(result.user.name).toBe(userData.name)
      expect(result.user.role).toBe('USER')
      expect(result.token).toBeDefined()
      expect(result.message).toBe('회원가입이 성공적으로 완료되었습니다.')

      // 비밀번호는 응답에 포함되지 않아야 함
      expect(response.body.user.password).toBeUndefined()
    })

    test('중복된 이메일로 회원가입 시 실패해야 함', async () => {
      // 먼저 사용자 생성
      const hashedPassword = await hashPassword('password123')
      await createTestUser({
        email: 'existing@example.com',
        name: 'Existing User',
        password: hashedPassword,
      })

      const userData = {
        email: 'existing@example.com',
        name: 'New User',
        password: 'password123',
      }

      const response = await request(server)
        .post('/api/auth/register')
        .send(userData)
        .expect(400)

      // 에러 응답 스키마 검증
      const result = ErrorResponseSchema.parse(response.body)
      expect(result.error).toBe('이미 존재하는 이메일입니다.')
    })

    test('유효하지 않은 이메일 형식으로 회원가입 시 실패해야 함', async () => {
      const userData = {
        email: 'invalid-email',
        name: 'Test User',
        password: 'password123',
      }

      const response = await request(server)
        .post('/api/auth/register')
        .send(userData)
        .expect(400)

      const result = ErrorResponseSchema.parse(response.body)
      expect(result.error).toContain('유효하지 않은 이메일 형식입니다.')
    })

    test('비밀번호가 너무 짧을 때 실패해야 함', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        password: '123',
      }

      const response = await request(server)
        .post('/api/auth/register')
        .send(userData)
        .expect(400)

      const result = ErrorResponseSchema.parse(response.body)
      expect(result.error).toContain('비밀번호는 최소 8자 이상이어야 합니다.')
    })
  })

  describe('POST /api/auth/login - 로그인', () => {
    test('유효한 자격증명으로 로그인 시 성공해야 함', async () => {
      // 테스트 사용자 생성
      const hashedPassword = await hashPassword('password123')
      const testUser = await createTestUser({
        email: 'login@example.com',
        name: 'Login User',
        password: hashedPassword,
      })

      const loginData = {
        email: 'login@example.com',
        password: 'password123',
      }

      const response = await request(server)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200)

      // 응답 스키마 검증
      const result = LoginResponseSchema.parse(response.body)

      expect(result.user.id).toBe(testUser.id)
      expect(result.user.email).toBe(testUser.email)
      expect(result.user.name).toBe(testUser.name)
      expect(result.token).toBeDefined()
      expect(result.message).toBe('로그인이 성공적으로 완료되었습니다.')
    })

    test('존재하지 않는 이메일로 로그인 시 실패해야 함', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'password123',
      }

      const response = await request(server)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401)

      const result = ErrorResponseSchema.parse(response.body)
      expect(result.error).toBe('이메일 또는 비밀번호가 올바르지 않습니다.')
    })

    test('잘못된 비밀번호로 로그인 시 실패해야 함', async () => {
      // 테스트 사용자 생성
      const hashedPassword = await hashPassword('password123')
      await createTestUser({
        email: 'wrongpw@example.com',
        name: 'Wrong Password User',
        password: hashedPassword,
      })

      const loginData = {
        email: 'wrongpw@example.com',
        password: 'wrongpassword',
      }

      const response = await request(server)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401)

      const result = ErrorResponseSchema.parse(response.body)
      expect(result.error).toBe('이메일 또는 비밀번호가 올바르지 않습니다.')
    })
  })

  describe('POST /api/auth/logout - 로그아웃', () => {
    test('인증된 사용자 로그아웃 시 성공해야 함', async () => {
      // 테스트 사용자 생성
      const hashedPassword = await hashPassword('password123')
      const testUser = await createTestUser({
        email: 'logout@example.com',
        name: 'Logout User',
        password: hashedPassword,
      })

      // JWT 토큰 생성
      const token = generateTestToken({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
      })

      const response = await request(server)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      expect(response.body.message).toBe('로그아웃이 성공적으로 완료되었습니다.')
    })

    test('인증 토큰 없이 로그아웃 시 실패해야 함', async () => {
      const response = await request(server)
        .post('/api/auth/logout')
        .expect(401)

      const result = ErrorResponseSchema.parse(response.body)
      expect(result.error).toBe('인증 토큰이 필요합니다.')
    })
  })

  describe('GET /api/auth/me - 현재 사용자 정보', () => {
    test('인증된 사용자의 정보를 반환해야 함', async () => {
      // 테스트 사용자 생성
      const hashedPassword = await hashPassword('password123')
      const testUser = await createTestUser({
        email: 'me@example.com',
        name: 'Me User',
        password: hashedPassword,
      })

      // JWT 토큰 생성
      const token = generateTestToken({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
      })

      const response = await request(server)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      expect(response.body.user.id).toBe(testUser.id)
      expect(response.body.user.email).toBe(testUser.email)
      expect(response.body.user.name).toBe(testUser.name)
      // 비밀번호는 포함되지 않아야 함
      expect(response.body.user.password).toBeUndefined()
    })

    test('인증 토큰 없이 요청 시 실패해야 함', async () => {
      const response = await request(server)
        .get('/api/auth/me')
        .expect(401)

      const result = ErrorResponseSchema.parse(response.body)
      expect(result.error).toBe('인증 토큰이 필요합니다.')
    })

    test('유효하지 않은 토큰으로 요청 시 실패해야 함', async () => {
      const response = await request(server)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)

      const result = ErrorResponseSchema.parse(response.body)
      expect(result.error).toBe('유효하지 않은 인증 토큰입니다.')
    })
  })
})