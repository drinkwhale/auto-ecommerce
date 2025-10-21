import { pricingService } from '@/services/pricing.service'

describe('PricingService', () => {
  describe('calculateSalePrice', () => {
    it('환율, 배송비, 수수료를 반영해 판매가를 계산한다', () => {
      const result = pricingService.calculateSalePrice({
        baseCost: 98.5, // CNY
        baseCurrency: 'CNY',
        targetCurrency: 'KRW',
        exchangeRate: 182.5,
        marginRate: 0.3,
        commissionRate: 0.12,
        shippingCost: 4800,
        roundingUnit: 100,
        minimumPrice: 29000,
      })

      expect(result.salePrice).toBe(32100)
      expect(result.convertedCost).toBeCloseTo(17976.25, 2)
      expect(result.marginAmount).toBeCloseTo(5392.875, 3)
      expect(result.commissionAmount).toBeGreaterThan(0)
    })

    it('같은 통화일 경우 환율 없이 계산한다', () => {
      const result = pricingService.calculateSalePrice({
        baseCost: 25000,
        baseCurrency: 'KRW',
        targetCurrency: 'KRW',
        marginRate: 0.25,
        commissionRate: 0,
        shippingCost: 3000,
        roundingUnit: 10,
      })

      expect(result.salePrice).toBe(34250)
      expect(result.convertedCost).toBe(25000)
      expect(result.marginAmount).toBe(6250)
    })

    it('최소 판매가를 보장한다', () => {
      const result = pricingService.calculateSalePrice({
        baseCost: 10,
        baseCurrency: 'USD',
        targetCurrency: 'USD',
        marginRate: 0.2,
        commissionRate: 0.1,
        roundingUnit: 1,
        minimumPrice: 20,
      })

      expect(result.salePrice).toBe(20)
    })

    it('최대 판매가를 초과하면 오류를 발생시킨다', () => {
      expect(() =>
        pricingService.calculateSalePrice({
          baseCost: 100,
          baseCurrency: 'USD',
          targetCurrency: 'USD',
          marginRate: 0.5,
          commissionRate: 0.2,
          roundingUnit: 1,
          maximumPrice: 100,
        })
      ).toThrow('최대 허용 금액')
    })
  })

  describe('calculateMarginRate', () => {
    it('판매가 대비 실제 마진율을 계산한다', () => {
      const marginRate = pricingService.calculateMarginRate(20000, 32000, 5000, 0.1)
      expect(marginRate).toBeCloseTo(0.19, 2)
    })
  })

  describe('suggestMarginRate', () => {
    it('목표 이익을 달성하기 위한 마진율을 제안한다', () => {
      const suggested = pricingService.suggestMarginRate(7000, 18000, 4000, 0.1)
      expect(suggested).toBeGreaterThan(0.3)
    })
  })
})
