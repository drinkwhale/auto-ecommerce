import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

/**
 * 테스트용 JWT 토큰 생성
 */
export function generateTestToken(payload: {
  userId: string
  email: string
  role?: string
}) {
  return jwt.sign(
    {
      ...payload,
      role: payload.role || 'USER',
    },
    process.env.NEXTAUTH_SECRET || 'test-secret',
    { expiresIn: '1h' }
  )
}

/**
 * 테스트용 비밀번호 해싱
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12)
}

/**
 * 비밀번호 검증
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword)
}

/**
 * Authorization 헤더 생성
 */
export function createAuthHeader(token: string): { Authorization: string } {
  return {
    Authorization: `Bearer ${token}`,
  }
}

/**
 * 테스트용 관리자 토큰 생성
 */
export function generateAdminToken(userId: string, email: string) {
  return generateTestToken({
    userId,
    email,
    role: 'ADMIN',
  })
}