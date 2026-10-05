import { request } from '@/service/request';
import type { Api } from '@/typings/api/ozon-pricing';

/**
 * 计算产品建议售价，直接返回明细数据
 */
export function calculatePrice(params: Api.OzonPricing.CalcParams): Promise<Api.OzonPricing.CalcDetail> {
  return request<Api.OzonPricing.CalcResult>({
    url: '/api/pricing/calculate',
    method: 'post',
    data: params
  }).then((res: any) => {
    if (res?.data?.success && res?.data?.data) {
      return res.data.data as Api.OzonPricing.CalcDetail;
    }
    throw new Error(res?.data?.message || '计算失败');
  });
}

/**
 * 获取三种汇率
 */
export function fetchExchangeRates(): Promise<Api.OzonPricing.ExchangeRates | null> {
  return request<Api.OzonPricing.ExchangeRates>({
    url: '/api/pricing/rates',
    method: 'get'
  })
    .then((res: any) => {
      return res?.data ?? null;
    })
    .catch(() => null);
}
/**
 * 获取类目列表方法
 */
export function fetchCommissionCategories(): Promise<Api.OzonPricing.CommissionCategory[]> {
  return request<Api.OzonPricing.CommissionCategory[]>({
    url: '/api/pricing/commission-categories',
    method: 'get'
  }).then((res: any) => {
    return res?.data ?? [];
  });
}
/**获取毛利配置 */
export function fetchGrossProfitConfig(): Promise<Api.OzonPricing.GrossProfitConfig | null> {
  return request<Api.OzonPricing.GrossProfitConfig>({
    url: '/api/pricing/gross-profit-config',
    method: 'get'
  })
    .then((res: any) => {
      console.log('毛利率配置原始响应:', res);
      // 优先尝试 res.data.data，如果不存在则尝试 res.data
      const config = res?.data?.data ?? res?.data;
      return config as Api.OzonPricing.GrossProfitConfig | null;
    })
    .catch(e => {
      console.error('获取毛利率配置失败:', e);
      return null;
    });
}
/**
 * 毛利配置更新
 */
export function updateGrossProfitConfig(
  config: Api.OzonPricing.GrossProfitConfig
): Promise<Api.OzonPricing.GrossProfitConfig | null> {
  return request<Api.OzonPricing.GrossProfitConfig>({
    url: '/api/pricing/gross-profit-config',
    method: 'post',
    data: config
  })
    .then((res: any) => {
      return res?.data?.data ?? null; // 现在 data 直接是配置对象
    })
    .catch(() => null);
}
