import { prisma } from '@/lib/prisma'

/**
 * 테스트 데이터베이스 초기화
 */
export async function clearDatabase() {
  try {
    // 순서가 중요함 - 외래키 제약조건 때문에
    await prisma.orderItem.deleteMany()
    await prisma.order.deleteMany()
    await prisma.product.deleteMany()
    await prisma.user.deleteMany()
  } catch (error) {
    console.error('Database clear error:', error)
    throw error
  }
}

/**
 * 테스트용 사용자 생성
 */
export async function createTestUser(userData: {
  email: string
  name?: string
  password: string
  role?: string
}) {
  return await prisma.user.create({
    data: {
      email: userData.email,
      name: userData.name || 'Test User',
      password: userData.password,
      role: userData.role || 'USER',
    },
  })
}

/**
 * 테스트용 상품 생성
 */
export async function createTestProduct(productData: {
  name: string
  description?: string
  price: number
  stock?: number
  sku: string
}) {
  return await prisma.product.create({
    data: {
      name: productData.name,
      description: productData.description || 'Test product description',
      price: productData.price,
      stock: productData.stock || 10,
      sku: productData.sku,
      status: 'ACTIVE',
    },
  })
}

/**
 * 데이터베이스 연결 테스트
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$connect()
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    console.error('Database connection test failed:', error)
    return false
  } finally {
    await prisma.$disconnect()
  }
}