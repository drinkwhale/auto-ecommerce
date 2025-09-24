// Jest 전역 설정
import '@testing-library/jest-dom'

// polyfills for Node.js
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Next.js 환경 변수 설정
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://postgres:password123@localhost:5432/auto_ecommerce'
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.NEXTAUTH_URL = 'http://localhost:3000'