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
  updatedAt?: string; // ★ 新增字段
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

/**
 * 添加店铺
 */
export function addSeller(data: { clientId: string; apiKey: string }) {
  return request<void>({
    url: '/api/ozon/seller-info/add',
    method: 'post',
    data
  });
}

/**
 * 修改店铺名称
 */
export function updateSellerName(id: number, companyName: string) {
  return request<void>({
    url: `/api/ozon/seller-info/${id}/name`,
    method: 'put',
    data: { companyName }
  });
}

/**
 * 删除店铺
 */
export function deleteSeller(id: number) {
  return request<void>({
    url: `/api/ozon/seller-info/${id}`,
    method: 'delete'
  });
}
