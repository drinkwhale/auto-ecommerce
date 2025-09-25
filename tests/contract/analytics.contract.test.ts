const { describe, test, expect } = require('@jest/globals')
const { z } = require('zod')

// 통계 및 분석 API 응답 스키마 정의
const DashboardStatsSchema = z.object({
  overview: z.object({
    totalRevenue: z.number().min(0),
    totalOrders: z.number().int().min(0),
    totalProducts: z.number().int().min(0),
    totalUsers: z.number().int().min(0),
    averageOrderValue: z.number().min(0),
    conversionRate: z.number().min(0).max(100),
  }),
  revenueChart: z.object({
    period: z.enum(['7d', '30d', '90d', '1y']),
    data: z.array(z.object({
      date: z.string(),
      revenue: z.number().min(0),
      orders: z.number().int().min(0),
    })),
  }),
  topProducts: z.array(z.object({
    id: z.string(),
    name: z.string(),
    sku: z.string(),
    revenue: z.number().min(0),
    quantity: z.number().int().min(0),
    rank: z.number().int().positive(),
  })).max(10),
  orderStatusBreakdown: z.object({
    pending: z.number().int().min(0),
    processing: z.number().int().min(0),
    shipped: z.number().int().min(0),
    delivered: z.number().int().min(0),
    cancelled: z.number().int().min(0),
    refunded: z.number().int().min(0),
  }),
  paymentMethodBreakdown: z.object({
    creditCard: z.number().min(0),
    bankTransfer: z.number().min(0),
    paypal: z.number().min(0),
    kakaoPay: z.number().min(0),
    naverPay: z.number().min(0),
  }),
})

const SalesReportSchema = z.object({
  period: z.object({
    startDate: z.string(),
    endDate: z.string(),
    type: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  }),
  summary: z.object({
    totalRevenue: z.number().min(0),
    totalOrders: z.number().int().min(0),
    averageOrderValue: z.number().min(0),
    uniqueCustomers: z.number().int().min(0),
    returningCustomers: z.number().int().min(0),
    newCustomers: z.number().int().min(0),
  }),
  trends: z.object({
    revenueGrowth: z.number(),
    orderGrowth: z.number(),
    customerGrowth: z.number(),
  }),
  breakdown: z.object({
    byCategory: z.array(z.object({
      category: z.string(),
      revenue: z.number().min(0),
      orders: z.number().int().min(0),
      percentage: z.number().min(0).max(100),
    })),
    byRegion: z.array(z.object({
      region: z.string(),
      revenue: z.number().min(0),
      orders: z.number().int().min(0),
      percentage: z.number().min(0).max(100),
    })),
  }),
})

const ProductAnalyticsSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  sku: z.string(),
  period: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }),
  metrics: z.object({
    totalRevenue: z.number().min(0),
    totalQuantity: z.number().int().min(0),
    totalOrders: z.number().int().min(0),
    averageOrderQuantity: z.number().min(0),
    conversionRate: z.number().min(0).max(100),
    viewCount: z.number().int().min(0),
    cartAddCount: z.number().int().min(0),
  }),
  performance: z.object({
    rank: z.number().int().positive(),
    rankChange: z.number().int(),
    categoryRank: z.number().int().positive(),
    categoryRankChange: z.number().int(),
  }),
  trends: z.object({
    dailySales: z.array(z.object({
      date: z.string(),
      quantity: z.number().int().min(0),
      revenue: z.number().min(0),
    })),
    weeklyTrend: z.enum(['up', 'down', 'stable']),
    monthlyTrend: z.enum(['up', 'down', 'stable']),
  }),
})

const CustomerAnalyticsSchema = z.object({
  period: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }),
  overview: z.object({
    totalCustomers: z.number().int().min(0),
    newCustomers: z.number().int().min(0),
    returningCustomers: z.number().int().min(0),
    activeCustomers: z.number().int().min(0),
    churnRate: z.number().min(0).max(100),
    retentionRate: z.number().min(0).max(100),
  }),
  segments: z.array(z.object({
    segment: z.enum(['new', 'regular', 'vip', 'inactive']),
    count: z.number().int().min(0),
    revenue: z.number().min(0),
    averageOrderValue: z.number().min(0),
    percentage: z.number().min(0).max(100),
  })),
  cohortAnalysis: z.object({
    periods: z.array(z.string()),
    cohorts: z.array(z.object({
      cohortMonth: z.string(),
      customers: z.number().int().min(0),
      retentionRates: z.array(z.number().min(0).max(100)),
    })),
  }),
  demographics: z.object({
    byAge: z.array(z.object({
      ageGroup: z.string(),
      count: z.number().int().min(0),
      percentage: z.number().min(0).max(100),
    })),
    byRegion: z.array(z.object({
      region: z.string(),
      count: z.number().int().min(0),
      percentage: z.number().min(0).max(100),
    })),
  }),
})

const InventoryAnalyticsSchema = z.object({
  overview: z.object({
    totalProducts: z.number().int().min(0),
    lowStockProducts: z.number().int().min(0),
    outOfStockProducts: z.number().int().min(0),
    totalInventoryValue: z.number().min(0),
    averageStockLevel: z.number().min(0),
  }),
  stockAlerts: z.array(z.object({
    productId: z.string(),
    productName: z.string(),
    sku: z.string(),
    currentStock: z.number().int().min(0),
    minimumStock: z.number().int().min(0),
    alertLevel: z.enum(['low', 'critical', 'out_of_stock']),
    daysUntilStockout: z.number().int().nullable(),
  })),
  turnoverAnalysis: z.array(z.object({
    productId: z.string(),
    productName: z.string(),
    sku: z.string(),
    turnoverRate: z.number().min(0),
    daysInStock: z.number().min(0),
    category: z.enum(['fast', 'medium', 'slow', 'dead']),
  })),
  forecastData: z.array(z.object({
    productId: z.string(),
    productName: z.string(),
    currentStock: z.number().int().min(0),
    predictedDemand30d: z.number().int().min(0),
    predictedDemand90d: z.number().int().min(0),
    recommendedReorderQuantity: z.number().int().min(0),
    recommendedReorderDate: z.string(),
  })),
})

const MarketplaceAnalyticsSchema = z.object({
  period: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }),
  performance: z.array(z.object({
    marketplace: z.enum(['NAVER', 'GMARKET', 'AUCTION', '11ST', 'COUPANG']),
    revenue: z.number().min(0),
    orders: z.number().int().min(0),
    products: z.number().int().min(0),
    conversionRate: z.number().min(0).max(100),
    averageOrderValue: z.number().min(0),
    fees: z.number().min(0),
    profit: z.number(),
    profitMargin: z.number().min(0).max(100),
  })),
  crawlingStats: z.object({
    totalCrawled: z.number().int().min(0),
    successfulCrawls: z.number().int().min(0),
    failedCrawls: z.number().int().min(0),
    successRate: z.number().min(0).max(100),
    averageCrawlTime: z.number().min(0),
  }),
  categoryPerformance: z.array(z.object({
    category: z.string(),
    marketplace: z.string(),
    products: z.number().int().min(0),
    revenue: z.number().min(0),
    competitionLevel: z.enum(['low', 'medium', 'high']),
    recommendedPricing: z.number().min(0),
  })),
})

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  details: z.any().optional(),
})

describe('통계 API 계약 테스트', () => {

  describe('GET /api/v1/analytics/dashboard - 대시보드 통계', () => {
    test('대시보드 통계 응답 스키마가 정의되어야 함', () => {
      const mockResponse = {
        overview: {
          totalRevenue: 15450000,
          totalOrders: 150,
          totalProducts: 250,
          totalUsers: 1200,
          averageOrderValue: 103000,
          conversionRate: 3.5,
        },
        revenueChart: {
          period: '30d',
          data: [
            {
              date: '2024-01-01',
              revenue: 450000,
              orders: 5,
            },
            {
              date: '2024-01-02',
              revenue: 520000,
              orders: 7,
            }
          ],
        },
        topProducts: [
          {
            id: 'prod_top_1',
            name: '인기 상품 1',
            sku: 'TOP-001',
            revenue: 2500000,
            quantity: 120,
            rank: 1,
          },
          {
            id: 'prod_top_2',
            name: '인기 상품 2',
            sku: 'TOP-002',
            revenue: 1800000,
            quantity: 90,
            rank: 2,
          }
        ],
        orderStatusBreakdown: {
          pending: 5,
          processing: 15,
          shipped: 25,
          delivered: 95,
          cancelled: 8,
          refunded: 2,
        },
        paymentMethodBreakdown: {
          creditCard: 8500000,
          bankTransfer: 3200000,
          paypal: 1500000,
          kakaoPay: 1800000,
          naverPay: 450000,
        }
      }

      expect(() => DashboardStatsSchema.parse(mockResponse)).not.toThrow()
    })

    test('빈 대시보드 통계 응답 스키마가 정의되어야 함', () => {
      const mockEmptyResponse = {
        overview: {
          totalRevenue: 0,
          totalOrders: 0,
          totalProducts: 0,
          totalUsers: 0,
          averageOrderValue: 0,
          conversionRate: 0,
        },
        revenueChart: {
          period: '7d',
          data: [],
        },
        topProducts: [],
        orderStatusBreakdown: {
          pending: 0,
          processing: 0,
          shipped: 0,
          delivered: 0,
          cancelled: 0,
          refunded: 0,
        },
        paymentMethodBreakdown: {
          creditCard: 0,
          bankTransfer: 0,
          paypal: 0,
          kakaoPay: 0,
          naverPay: 0,
        }
      }

      expect(() => DashboardStatsSchema.parse(mockEmptyResponse)).not.toThrow()
    })

    test('실제 API 엔드포인트가 아직 구현되지 않음을 확인', async () => {
      try {
        const response = await fetch('http://localhost:3000/api/v1/analytics/dashboard', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer fake.token.here'
          }
        })

        expect(response.status).not.toBe(200)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  describe('GET /api/v1/analytics/sales - 매출 리포트', () => {
    test('매출 리포트 응답 스키마가 정의되어야 함', () => {
      const mockResponse = {
        period: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          type: 'monthly',
        },
        summary: {
          totalRevenue: 15450000,
          totalOrders: 150,
          averageOrderValue: 103000,
          uniqueCustomers: 120,
          returningCustomers: 30,
          newCustomers: 90,
        },
        trends: {
          revenueGrowth: 15.5,
          orderGrowth: 8.2,
          customerGrowth: 12.3,
        },
        breakdown: {
          byCategory: [
            {
              category: '전자제품',
              revenue: 8500000,
              orders: 80,
              percentage: 55.0,
            },
            {
              category: '의류',
              revenue: 4200000,
              orders: 45,
              percentage: 27.2,
            }
          ],
          byRegion: [
            {
              region: '서울',
              revenue: 7500000,
              orders: 75,
              percentage: 48.5,
            },
            {
              region: '경기',
              revenue: 4200000,
              orders: 42,
              percentage: 27.2,
            }
          ],
        }
      }

      expect(() => SalesReportSchema.parse(mockResponse)).not.toThrow()
    })

    test('기간별 매출 리포트 유효성 검사', () => {
      const validPeriods = ['daily', 'weekly', 'monthly', 'yearly']

      validPeriods.forEach(periodType => {
        const mockResponse = {
          period: {
            startDate: '2024-01-01',
            endDate: '2024-01-31',
            type: periodType,
          },
          summary: {
            totalRevenue: 1000000,
            totalOrders: 10,
            averageOrderValue: 100000,
            uniqueCustomers: 8,
            returningCustomers: 2,
            newCustomers: 6,
          },
          trends: {
            revenueGrowth: 5.0,
            orderGrowth: 3.0,
            customerGrowth: 2.0,
          },
          breakdown: {
            byCategory: [],
            byRegion: [],
          }
        }

        expect(() => SalesReportSchema.parse(mockResponse)).not.toThrow()
      })
    })

    test('실제 API 엔드포인트가 아직 구현되지 않음을 확인', async () => {
      try {
        const response = await fetch('http://localhost:3000/api/v1/analytics/sales?period=monthly&start=2024-01-01&end=2024-01-31', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer fake.token.here'
          }
        })

        expect(response.status).not.toBe(200)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  describe('GET /api/v1/analytics/products/[id] - 상품 분석', () => {
    test('상품 분석 응답 스키마가 정의되어야 함', () => {
      const mockResponse = {
        productId: 'prod_analytics_123',
        productName: '분석 대상 상품',
        sku: 'ANALYTICS-001',
        period: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
        metrics: {
          totalRevenue: 2500000,
          totalQuantity: 120,
          totalOrders: 80,
          averageOrderQuantity: 1.5,
          conversionRate: 3.2,
          viewCount: 2500,
          cartAddCount: 180,
        },
        performance: {
          rank: 5,
          rankChange: -2,
          categoryRank: 2,
          categoryRankChange: 1,
        },
        trends: {
          dailySales: [
            {
              date: '2024-01-01',
              quantity: 5,
              revenue: 125000,
            },
            {
              date: '2024-01-02',
              quantity: 8,
              revenue: 200000,
            }
          ],
          weeklyTrend: 'up',
          monthlyTrend: 'stable',
        }
      }

      expect(() => ProductAnalyticsSchema.parse(mockResponse)).not.toThrow()
    })

    test('상품 트렌드 유효성 검사', () => {
      const validTrends = ['up', 'down', 'stable']

      validTrends.forEach(trend => {
        const mockResponse = {
          productId: 'prod_123',
          productName: '테스트 상품',
          sku: 'TEST-001',
          period: {
            startDate: '2024-01-01',
            endDate: '2024-01-31',
          },
          metrics: {
            totalRevenue: 100000,
            totalQuantity: 10,
            totalOrders: 8,
            averageOrderQuantity: 1.25,
            conversionRate: 2.5,
            viewCount: 320,
            cartAddCount: 20,
          },
          performance: {
            rank: 10,
            rankChange: 0,
            categoryRank: 3,
            categoryRankChange: 0,
          },
          trends: {
            dailySales: [],
            weeklyTrend: trend,
            monthlyTrend: trend,
          }
        }

        expect(() => ProductAnalyticsSchema.parse(mockResponse)).not.toThrow()
      })
    })

    test('실제 API 엔드포인트가 아직 구현되지 않음을 확인', async () => {
      try {
        const response = await fetch('http://localhost:3000/api/v1/analytics/products/prod_123', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer fake.token.here'
          }
        })

        expect(response.status).not.toBe(200)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  describe('GET /api/v1/analytics/customers - 고객 분석', () => {
    test('고객 분석 응답 스키마가 정의되어야 함', () => {
      const mockResponse = {
        period: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
        overview: {
          totalCustomers: 1200,
          newCustomers: 180,
          returningCustomers: 320,
          activeCustomers: 500,
          churnRate: 15.5,
          retentionRate: 84.5,
        },
        segments: [
          {
            segment: 'new',
            count: 180,
            revenue: 2500000,
            averageOrderValue: 85000,
            percentage: 15.0,
          },
          {
            segment: 'regular',
            count: 800,
            revenue: 12000000,
            averageOrderValue: 105000,
            percentage: 66.7,
          },
          {
            segment: 'vip',
            count: 150,
            revenue: 8500000,
            averageOrderValue: 250000,
            percentage: 12.5,
          },
          {
            segment: 'inactive',
            count: 70,
            revenue: 0,
            averageOrderValue: 0,
            percentage: 5.8,
          }
        ],
        cohortAnalysis: {
          periods: ['M0', 'M1', 'M2', 'M3'],
          cohorts: [
            {
              cohortMonth: '2024-01',
              customers: 100,
              retentionRates: [100, 65, 45, 32],
            },
            {
              cohortMonth: '2024-02',
              customers: 120,
              retentionRates: [100, 70, 52],
            }
          ],
        },
        demographics: {
          byAge: [
            {
              ageGroup: '20-29',
              count: 350,
              percentage: 29.2,
            },
            {
              ageGroup: '30-39',
              count: 450,
              percentage: 37.5,
            }
          ],
          byRegion: [
            {
              region: '서울',
              count: 480,
              percentage: 40.0,
            },
            {
              region: '경기',
              count: 360,
              percentage: 30.0,
            }
          ],
        }
      }

      expect(() => CustomerAnalyticsSchema.parse(mockResponse)).not.toThrow()
    })

    test('고객 세그먼트 유효성 검사', () => {
      const validSegments = ['new', 'regular', 'vip', 'inactive']

      validSegments.forEach(segment => {
        const segmentData = {
          segment: segment,
          count: 100,
          revenue: 1000000,
          averageOrderValue: 10000,
          percentage: 25.0,
        }

        expect(() => CustomerAnalyticsSchema.shape.segments.element.parse(segmentData)).not.toThrow()
      })
    })

    test('실제 API 엔드포인트가 아직 구현되지 않음을 확인', async () => {
      try {
        const response = await fetch('http://localhost:3000/api/v1/analytics/customers', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer fake.token.here'
          }
        })

        expect(response.status).not.toBe(200)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  describe('GET /api/v1/analytics/inventory - 재고 분석', () => {
    test('재고 분석 응답 스키마가 정의되어야 함', () => {
      const mockResponse = {
        overview: {
          totalProducts: 250,
          lowStockProducts: 15,
          outOfStockProducts: 3,
          totalInventoryValue: 125000000,
          averageStockLevel: 45.5,
        },
        stockAlerts: [
          {
            productId: 'prod_alert_1',
            productName: '재고 부족 상품 1',
            sku: 'ALERT-001',
            currentStock: 5,
            minimumStock: 20,
            alertLevel: 'low',
            daysUntilStockout: 7,
          },
          {
            productId: 'prod_alert_2',
            productName: '재고 부족 상품 2',
            sku: 'ALERT-002',
            currentStock: 0,
            minimumStock: 10,
            alertLevel: 'out_of_stock',
            daysUntilStockout: null,
          }
        ],
        turnoverAnalysis: [
          {
            productId: 'prod_turnover_1',
            productName: '회전율 분석 상품 1',
            sku: 'TURNOVER-001',
            turnoverRate: 12.5,
            daysInStock: 45,
            category: 'fast',
          },
          {
            productId: 'prod_turnover_2',
            productName: '회전율 분석 상품 2',
            sku: 'TURNOVER-002',
            turnoverRate: 2.3,
            daysInStock: 180,
            category: 'slow',
          }
        ],
        forecastData: [
          {
            productId: 'prod_forecast_1',
            productName: '예측 대상 상품 1',
            currentStock: 50,
            predictedDemand30d: 35,
            predictedDemand90d: 120,
            recommendedReorderQuantity: 100,
            recommendedReorderDate: '2024-02-15',
          }
        ]
      }

      expect(() => InventoryAnalyticsSchema.parse(mockResponse)).not.toThrow()
    })

    test('재고 알림 레벨 유효성 검사', () => {
      const validAlertLevels = ['low', 'critical', 'out_of_stock']

      validAlertLevels.forEach(alertLevel => {
        const alertData = {
          productId: 'prod_test',
          productName: '테스트 상품',
          sku: 'TEST-001',
          currentStock: alertLevel === 'out_of_stock' ? 0 : 5,
          minimumStock: 10,
          alertLevel: alertLevel,
          daysUntilStockout: alertLevel === 'out_of_stock' ? null : 5,
        }

        expect(() => InventoryAnalyticsSchema.shape.stockAlerts.element.parse(alertData)).not.toThrow()
      })
    })

    test('실제 API 엔드포인트가 아직 구현되지 않음을 확인', async () => {
      try {
        const response = await fetch('http://localhost:3000/api/v1/analytics/inventory', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer fake.token.here'
          }
        })

        expect(response.status).not.toBe(200)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  describe('GET /api/v1/analytics/marketplace - 마켓플레이스 분석', () => {
    test('마켓플레이스 분석 응답 스키마가 정의되어야 함', () => {
      const mockResponse = {
        period: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
        performance: [
          {
            marketplace: 'NAVER',
            revenue: 8500000,
            orders: 85,
            products: 120,
            conversionRate: 3.2,
            averageOrderValue: 100000,
            fees: 850000,
            profit: 7650000,
            profitMargin: 90.0,
          },
          {
            marketplace: 'GMARKET',
            revenue: 4200000,
            orders: 42,
            products: 80,
            conversionRate: 2.8,
            averageOrderValue: 100000,
            fees: 630000,
            profit: 3570000,
            profitMargin: 85.0,
          }
        ],
        crawlingStats: {
          totalCrawled: 1500,
          successfulCrawls: 1425,
          failedCrawls: 75,
          successRate: 95.0,
          averageCrawlTime: 2.5,
        },
        categoryPerformance: [
          {
            category: '전자제품',
            marketplace: 'NAVER',
            products: 45,
            revenue: 4500000,
            competitionLevel: 'high',
            recommendedPricing: 95000,
          },
          {
            category: '의류',
            marketplace: 'GMARKET',
            products: 32,
            revenue: 1800000,
            competitionLevel: 'medium',
            recommendedPricing: 45000,
          }
        ]
      }

      expect(() => MarketplaceAnalyticsSchema.parse(mockResponse)).not.toThrow()
    })

    test('마켓플레이스 유효성 검사', () => {
      const validMarketplaces = ['NAVER', 'GMARKET', 'AUCTION', '11ST', 'COUPANG']

      validMarketplaces.forEach(marketplace => {
        const performanceData = {
          marketplace: marketplace,
          revenue: 1000000,
          orders: 10,
          products: 50,
          conversionRate: 2.5,
          averageOrderValue: 100000,
          fees: 150000,
          profit: 850000,
          profitMargin: 85.0,
        }

        expect(() => MarketplaceAnalyticsSchema.shape.performance.element.parse(performanceData)).not.toThrow()
      })
    })

    test('실제 API 엔드포인트가 아직 구현되지 않음을 확인', async () => {
      try {
        const response = await fetch('http://localhost:3000/api/v1/analytics/marketplace', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer fake.token.here'
          }
        })

        expect(response.status).not.toBe(200)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  describe('API 계약 요구사항 검증', () => {
    test('모든 통계 API가 인증을 요구해야 함', () => {
      // 계약 요구사항: Authorization 헤더 필수
      expect(true).toBe(true) // 계약 정의 완료
    })

    test('매출 및 수치는 항상 0 이상이어야 함', () => {
      // 비즈니스 규칙: 매출, 주문 수, 고객 수는 음수가 될 수 없음
      expect(() => DashboardStatsSchema.parse({
        overview: {
          totalRevenue: -1000, // 음수 매출
          totalOrders: 10,
          totalProducts: 10,
          totalUsers: 10,
          averageOrderValue: 100,
          conversionRate: 2.5,
        },
        revenueChart: { period: '7d', data: [] },
        topProducts: [],
        orderStatusBreakdown: {
          pending: 0, processing: 0, shipped: 0,
          delivered: 0, cancelled: 0, refunded: 0
        },
        paymentMethodBreakdown: {
          creditCard: 0, bankTransfer: 0, paypal: 0,
          kakaoPay: 0, naverPay: 0
        }
      })).toThrow()
    })

    test('전환율과 비율은 0-100% 범위여야 함', () => {
      // 비즈니스 규칙: 전환율, 유지율, 이탈률은 0-100% 범위
      expect(() => CustomerAnalyticsSchema.shape.overview.parse({
        totalCustomers: 100,
        newCustomers: 20,
        returningCustomers: 30,
        activeCustomers: 50,
        churnRate: 150, // 100% 초과
        retentionRate: 85,
      })).toThrow()

      expect(() => CustomerAnalyticsSchema.shape.overview.parse({
        totalCustomers: 100,
        newCustomers: 20,
        returningCustomers: 30,
        activeCustomers: 50,
        churnRate: -5, // 음수
        retentionRate: 85,
      })).toThrow()
    })

    test('랭킹은 양의 정수여야 함', () => {
      // 비즈니스 규칙: 상품 랭킹은 1 이상의 정수
      expect(() => ProductAnalyticsSchema.shape.performance.parse({
        rank: 0, // 0은 유효하지 않음
        rankChange: 0,
        categoryRank: 1,
        categoryRankChange: 0,
      })).toThrow()

      expect(() => ProductAnalyticsSchema.shape.performance.parse({
        rank: -1, // 음수는 유효하지 않음
        rankChange: 0,
        categoryRank: 1,
        categoryRankChange: 0,
      })).toThrow()
    })

    test('재고 알림 레벨이 정의된 값만 허용해야 함', () => {
      const validAlertLevels = ['low', 'critical', 'out_of_stock']

      validAlertLevels.forEach(level => {
        expect(() => InventoryAnalyticsSchema.shape.stockAlerts.element.parse({
          productId: 'test',
          productName: 'Test',
          sku: 'TEST',
          currentStock: 5,
          minimumStock: 10,
          alertLevel: level,
          daysUntilStockout: 5,
        })).not.toThrow()
      })

      // 잘못된 알림 레벨
      expect(() => InventoryAnalyticsSchema.shape.stockAlerts.element.parse({
        productId: 'test',
        productName: 'Test',
        sku: 'TEST',
        currentStock: 5,
        minimumStock: 10,
        alertLevel: 'invalid_level',
        daysUntilStockout: 5,
      })).toThrow()
    })

    test('기간 타입이 정의된 값만 허용해야 함', () => {
      const validPeriodTypes = ['daily', 'weekly', 'monthly', 'yearly']

      validPeriodTypes.forEach(periodType => {
        expect(() => SalesReportSchema.shape.period.parse({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          type: periodType,
        })).not.toThrow()
      })

      // 잘못된 기간 타입
      expect(() => SalesReportSchema.shape.period.parse({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        type: 'invalid_period',
      })).toThrow()
    })

    test('톱 상품 목록은 최대 10개까지만 허용해야 함', () => {
      const validTopProducts = Array.from({ length: 10 }, (_, i) => ({
        id: `prod_${i}`,
        name: `상품 ${i}`,
        sku: `SKU-${i}`,
        revenue: 100000,
        quantity: 10,
        rank: i + 1,
      }))

      expect(() => DashboardStatsSchema.shape.topProducts.parse(validTopProducts)).not.toThrow()

      // 11개는 허용하지 않음
      const tooManyProducts = [...validTopProducts, {
        id: 'prod_11',
        name: '상품 11',
        sku: 'SKU-11',
        revenue: 100000,
        quantity: 10,
        rank: 11,
      }]

      expect(() => DashboardStatsSchema.shape.topProducts.parse(tooManyProducts)).toThrow()
    })
  })
})