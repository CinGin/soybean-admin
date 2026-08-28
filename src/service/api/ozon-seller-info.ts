import { request } from '@/service/request';

export interface SellerInfoVO {
  id: number;
  companyName: string;
  legalName: string;
  inn: string;
  currency: string;
  country: string;
  isPremium: boolean;
  subscriptionType: string;
  clientId: string;
  appKey: string;
}

export interface SellerInfoQuery {
  pageNo?: number;
  pageSize?: number;
  companyName?: string;
  inn?: string;
  country?: string;
  currency?: string;
  isPremium?: boolean;
  subscriptionType?: string;
  sortField?: string;
  sortDir?: string;
}

/**
 * 分页查询卖家信息（用于下拉选项，通常一次获取全部）
 */
export function fetchSellerInfoList(params: SellerInfoQuery = { pageNo: 1, pageSize: 100 }) {
  return request<{ records: SellerInfoVO[]; total: number }>({
    url: '/api/ozon/seller-info',
    method: 'get',
    params
  });
}
