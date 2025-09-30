/**
 * GraphQL 스키마 정의
 *
 * GraphQL 타입 정의 및 쿼리/뮤테이션 스키마
 * Phase 3.5: API 엔드포인트 구현 - T043
 */

export const typeDefs = `#graphql
  # 사용자 타입
  type User {
    id: ID!
    email: String!
    name: String!
    role: UserRole!
    status: UserStatus!
    createdAt: String!
  }

  enum UserRole {
    ADMIN
    SELLER
    VIEWER
  }

  enum UserStatus {
    ACTIVE
    INACTIVE
    SUSPENDED
  }

  # 상품 타입
  type Product {
    id: ID!
    userId: String!
    sourceInfo: JSON!
    originalData: JSON!
    translatedData: JSON
    salesSettings: JSON!
    monitoring: JSON
    statistics: JSON
    status: ProductStatus!
    createdAt: String!
    updatedAt: String!
    user: User
    images: [ProductImage!]
    registrations: [ProductRegistration!]
  }

  enum ProductStatus {
    DRAFT
    PROCESSING
    READY
    REGISTERED
    ERROR
    ARCHIVED
  }

  # 상품 이미지 타입
  type ProductImage {
    id: ID!
    productId: String!
    originalUrl: String!
    processedImages: JSON
    metadata: JSON
    status: ImageStatus!
    createdAt: String!
  }

  enum ImageStatus {
    PENDING
    PROCESSING
    PROCESSED
    FAILED
  }

  # 상품 등록 정보 타입
  type ProductRegistration {
    id: ID!
    productId: String!
    platform: OpenMarketPlatform!
    platformProductId: String
    status: RegistrationStatus!
    registeredAt: String
  }

  enum OpenMarketPlatform {
    ELEVENST
    GMARKET
    AUCTION
    COUPANG
    NAVER
  }

  enum RegistrationStatus {
    PENDING
    PROCESSING
    SUCCESS
    FAILED
    UPDATING
  }

  # 주문 타입
  type Order {
    id: ID!
    productId: String!
    userId: String!
    marketOrder: JSON!
    sourcePurchase: JSON
    customer: JSON!
    shipping: JSON!
    payment: JSON!
    status: OrderStatus!
    createdAt: String!
    updatedAt: String!
    completedAt: String
    product: Product
    user: User
  }

  enum OrderStatus {
    RECEIVED
    CONFIRMED
    PURCHASING
    PURCHASED
    SHIPPING
    DELIVERED
    CANCELLED
    REFUNDED
  }

  # 페이지네이션 정보
  type PageInfo {
    page: Int!
    limit: Int!
    total: Int!
    totalPages: Int!
  }

  # 상품 목록 응답
  type ProductList {
    products: [Product!]!
    pageInfo: PageInfo!
  }

  # 주문 목록 응답
  type OrderList {
    orders: [Order!]!
    pageInfo: PageInfo!
  }

  # JSON 스칼라 타입
  scalar JSON

  # 쿼리 정의
  type Query {
    # 사용자 쿼리
    me: User

    # 상품 쿼리
    products(
      page: Int
      limit: Int
      status: ProductStatus
      search: String
      sortBy: String
      sortOrder: String
    ): ProductList!

    product(id: ID!): Product

    # 주문 쿼리
    orders(
      page: Int
      limit: Int
      status: OrderStatus
      search: String
      sortBy: String
      sortOrder: String
      startDate: String
      endDate: String
    ): OrderList!

    order(id: ID!): Order

    # 통계 쿼리
    dashboard(period: Int): JSON!
  }

  # 뮤테이션 정의
  type Mutation {
    # 상품 뮤테이션
    createProduct(input: CreateProductInput!): Product!
    updateProduct(id: ID!, input: UpdateProductInput!): Product!
    deleteProduct(id: ID!, hard: Boolean): JSON!

    # 주문 뮤테이션
    updateOrderStatus(id: ID!, input: UpdateOrderStatusInput!): Order!

    # 크롤링 뮤테이션
    crawlProduct(input: CrawlProductInput!): JSON!
  }

  # 입력 타입 정의
  input CreateProductInput {
    sourceUrl: String!
    sourcePlatform: String!
    originalData: JSON!
    salesSettings: JSON!
  }

  input UpdateProductInput {
    originalData: JSON
    translatedData: JSON
    salesSettings: JSON
    monitoring: JSON
    status: ProductStatus
  }

  input UpdateOrderStatusInput {
    status: OrderStatus!
    sourcePurchase: JSON
    shipping: JSON
    note: String
  }

  input CrawlProductInput {
    url: String!
    platform: String!
    options: JSON
  }
`;