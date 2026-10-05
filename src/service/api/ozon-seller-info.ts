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
  shopAlias: string;
  enabled: number;
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

export interface ShopGroup {
  inn: string;
  companyName: string;
  shops: ShopItem[];
}

export interface ShopItem {
  id: number;
  clientId: string;
  shopAlias?: string;
  legalName?: string;
  country?: string;
  currency?: string;
  isPremium?: boolean;
  subscriptionType?: string;
  displayName: string;
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
// src/service/api/ozon-seller-info.ts

/** 修改店铺别名 */
export function updateSellerAlias(id: number, shopAlias: string) {
  return request<void>({
    url: `/api/ozon/seller-info/${id}/alias`,
    method: 'put',
    params: { shopAlias }
  });
}

/** 启用/禁用店铺 */
export function updateSellerEnabled(id: number, enabled: boolean) {
  return request<void>({
    url: `/api/ozon/seller-info/${id}/enabled`,
    method: 'put',
    params: { enabled }
  });
}

/** 按主体分组（级联下拉用） */
export function fetchSellerGroups() {
  return request<ShopGroup[]>({
    url: '/api/ozon/seller-info/groups',
    method: 'get'
  });
}
