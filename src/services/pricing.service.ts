/**
 * PricingService - 상품 가격 산식 계산 로직
 *
 * Taobao 등 해외 소싱 상품의 원가 정보를 기준으로
 * 마진, 수수료, 배송비, 환율 등을 반영한 판매가를 산출합니다.
 * Phase 3A.2: 가격 산식 모듈 구현 - T211
 */

import { z } from 'zod'

export type SupportedCurrency = 'CNY' | 'KRW' | 'USD' | 'JPY' | 'EUR'

export interface PriceCalculationResult {
  salePrice: number
  subtotal: number
  convertedCost: number
  marginAmount: number
  commissionAmount: number
  shippingCost: number
  roundingUnit: number
}

const PriceCalculationInputSchema = z.object({
  baseCost: z.number().positive({ message: '원가는 0보다 커야 합니다.' }),
  baseCurrency: z.enum(['CNY', 'KRW', 'USD', 'JPY', 'EUR']),
  targetCurrency: z.enum(['CNY', 'KRW', 'USD', 'JPY', 'EUR']).default('KRW'),
  exchangeRate: z
    .number()
    .positive({ message: '환율은 0보다 커야 합니다.' })
    .optional(),
  marginRate: z
    .number()
    .min(0, { message: '마진율은 0 이상이어야 합니다.' })
    .max(1, { message: '마진율은 1(100%) 이하여야 합니다.' }),
  commissionRate: z
    .number()
    .min(0, { message: '수수료율은 0 이상이어야 합니다.' })
    .max(0.3, { message: '수수료율은 30%를 초과할 수 없습니다.' })
    .default(0),
  shippingCost: z.number().min(0).default(0),
  roundingUnit: z.number().min(1).default(10),
  minimumPrice: z.number().min(0).optional(),
  maximumPrice: z.number().min(0).optional(),
})

export type PriceCalculationInput = z.infer<typeof PriceCalculationInputSchema>

export class PricingService {
  private convertCurrency(base: number, baseCurrency: SupportedCurrency, target: SupportedCurrency, exchangeRate?: number): number {
    if (baseCurrency === target) {
      return base
    }

    if (!exchangeRate) {
      throw new Error('환율 정보가 필요합니다.')
    }

    return base * exchangeRate
  }

  private applyCommission(subtotal: number, commissionRate: number): { commissionAmount: number; priceWithCommission: number } {
    if (commissionRate <= 0) {
      return { commissionAmount: 0, priceWithCommission: subtotal }
    }

    const priceWithCommission = subtotal / (1 - commissionRate)
    const commissionAmount = priceWithCommission - subtotal
    return { commissionAmount, priceWithCommission }
  }

  private roundPrice(value: number, roundingUnit: number): number {
    return Math.ceil(value / roundingUnit) * roundingUnit
  }

  public calculateSalePrice(rawInput: PriceCalculationInput): PriceCalculationResult {
    const input = PriceCalculationInputSchema.parse(rawInput)

    const convertedCost = this.convertCurrency(
      input.baseCost,
      input.baseCurrency,
      input.targetCurrency,
      input.exchangeRate
    )

    const marginAmount = convertedCost * input.marginRate
    const subtotal = convertedCost + marginAmount + input.shippingCost
    const { commissionAmount, priceWithCommission } = this.applyCommission(subtotal, input.commissionRate)

    const roundedPrice = this.roundPrice(priceWithCommission, input.roundingUnit)

    if (input.minimumPrice && roundedPrice < input.minimumPrice) {
      return {
        salePrice: input.minimumPrice,
        subtotal,
        convertedCost,
        marginAmount: input.minimumPrice - (convertedCost + commissionAmount + input.shippingCost),
        commissionAmount,
        shippingCost: input.shippingCost,
        roundingUnit: input.roundingUnit,
      }
    }

    if (input.maximumPrice && roundedPrice > input.maximumPrice) {
      throw new Error('요청한 조건으로 계산된 판매가가 최대 허용 금액을 초과했습니다.')
    }

    return {
      salePrice: roundedPrice,
      subtotal,
      convertedCost,
      marginAmount,
      commissionAmount,
      shippingCost: input.shippingCost,
      roundingUnit: input.roundingUnit,
    }
  }

  public calculateMarginRate(cost: number, salePrice: number, shippingCost = 0, commissionRate = 0): number {
    if (salePrice <= 0) {
      throw new Error('판매가는 0보다 커야 합니다.')
    }

    const commission = salePrice * commissionRate
    const profit = salePrice - commission - shippingCost - cost
    return profit / cost
  }

  public suggestMarginRate(targetProfit: number, cost: number, shippingCost = 0, commissionRate = 0): number {
    if (cost <= 0) {
      throw new Error('원가는 0보다 커야 합니다.')
    }

    const effectiveCost = cost + shippingCost
    const requiredRevenue = (effectiveCost + targetProfit) / (1 - commissionRate)
    const marginAmount = requiredRevenue - cost
    return marginAmount / cost
  }
}

export const pricingService = new PricingService()
