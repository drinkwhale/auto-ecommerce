const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Next.js 앱의 경로
  dir: './',
})

// Jest에 전달할 커스텀 설정
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    // tsconfig.json의 paths와 매칭
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.test.tsx',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/layout.tsx',
  ],
  moduleDirectories: ['node_modules', '<rootDir>/'],
  testEnvironmentOptions: {
    customExportConditions: [''],
  },
}

// createJestConfig는 next/jest가 비동기로 Next.js 설정을 로드할 수 있도록 해줌
module.exports = createJestConfig(customJestConfig)