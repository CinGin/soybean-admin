import { request } from '@/service/request';

// ========== 查询参数 ==========
export interface OzonProductQuery {
  /** 页码，从1开始 */
  page?: number;
  /** 每页条数 */
  size?: number;
  /** 全局模糊搜索（匹配名称/品牌/货号/卖家） */
  keyword?: string;
  /** 商品名称模糊 */
  name?: string;
  /** 品牌模糊 */
  brand?: string;
  /** 一级类目模糊 */
  category1?: string;
  /** 卖家名称模糊 */
  sellerName?: string;
  /** 排序字段 */
  sortField?: string;
  /** 排序方向 asc/desc */
  sortDir?: string;
}

// ========== Ozon 商品 VO ==========
export interface OzonProductVO {
  variantId?: string;
  sku?: string;
  name?: string;
  brand?: string;
  article?: string;
  link?: string;
  photo?: string;
  category1?: string;
  category2?: string;
  category3?: string;
  category1Id?: string;
  category2Id?: string;
  category3Id?: string;
  brandId?: string;
  sellerId?: string;
  sellerName?: string;
  salesSchema?: string;
  binStatus?: string;
  soldSum?: number;
  latestSoldCount?: number;
  previousSoldCount?: number | null;
  salesDynamics?: number | null;
  growthRate?: number | null;
  updateDate?: string;
}

// ========== 分页响应 ==========
export interface OzonProductPageResult {
  total: number;
  page: number;
  size: number;
  records: OzonProductVO[];
}

// ========== API 方法 ==========

/**
 * 分页查询 Ozon 商品明细（含两期销量对比）
 * @param params 查询参数
 * @param signal 可选，用于取消请求的 AbortSignal
 */
export function fetchOzonProducts(params: OzonProductQuery, signal?: AbortSignal) {
  return request<OzonProductPageResult>({
    url: '/api/ozon/products',
    method: 'get',
    params,
    signal, // 传递取消信号
    timeout: 300000 // 可选：设置 300 秒超时，可根据实际情况调整
  });
}

/**
 * 获取单个商品详情（按 variantId）
 */
export function fetchOzonProductDetail(variantId: string) {
  return request<OzonProductVO>({
    url: `/api/ozon/products/${variantId}`,
    method: 'get'
  });
}
