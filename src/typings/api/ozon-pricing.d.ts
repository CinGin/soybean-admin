export namespace Api {
  export namespace OzonPricing {
    /** 店铺类型 */
    type ShopType = 'CNY' | 'USD';
    type CommissionMode = 'manual' | 'category';
    type WeightUnit = 'g' | 'kg';

    /**佣金率表 */
    interface CommissionCategory {
      id: number;
      categoryId: number;
      categoryL1Cn: string;
      categoryL2Cn: string;
      categoryL3Cn: string;
      rfbsRate01500: number;
      rfbsRate15005000: number;
      rfbsRate5000Plus: number;
    }

    /** 计算请求参数 */
    interface CalcParams {
      purchasePrice: number;
      weightG: number;
      shopType: ShopType;
      commissionMode: CommissionMode;
      commissionRate?: number | null; // 原始佣金率，如 12 表示 12%
      categoryId?: number | null;
    }

    /** 计算响应明细 */
    interface CalcDetail {
      grossProfit: number; // 产品毛利（人民币）
      logisticsCost: number; // 物流成本（人民币）
      registrationFee: number; // 挂号费（人民币）
      inboundFee: number; // 入仓费用（人民币/公斤）
      commissionRate: number; // 总佣金率（小数）
      commissionAmount: number; // 佣金金额（人民币）
      finalPrice: number; // 原币种售价（人民币或美元）
      finalPriceRub: number; // 卢布售价（主显示）
      currency: string; // "CNY" 或 "USD"
      usdToRub: number;
      usdToCny: number;
      cnyToRub: number;
      purchasePrice: number; // 产品进货价
      baseCommissionRate: number; // 原始佣金率（不含4%）
    }

    /** 后端返回完整结构 */
    interface CalcResult {
      success: boolean;
      data: CalcDetail;
      message?: string;
    }
    interface ExchangeRates {
      usdToRub: number;
      usdToCny: number;
      cnyToRub: number;
    }
    // 毛利配置
    interface GrossProfitConfig {
      ratio0To30: number;
      ratio30To60: number;
      ratio60To100: number;
      ratio100To200: number;
      ratio200Plus: number;
    }
  }
}
