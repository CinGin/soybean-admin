import { request } from '@/service/request';

// ========== 查询参数（保持不变） ==========
export interface OzonProductQuery {
  page?: number;
  size?: number;
  keyword?: string;
  name?: string;
  brand?: string;
  category1?: string;
  sellerName?: string;
  sortField?: string;
  sortDir?: string;
  listingSource?: number; // ★ 新增上架状态筛选
}

// ========== Ozon 商品 VO（保持不变） ==========
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
  /** 上架卖家Client-Id（本系统卖家账号标识） */
  listingClientId?: string;
  /** 上架卖家名称 */
  listingSellerName?: string;
  /** 新增：上架来源及状态 */
  listingSource?: number;
  listingTaskId?: string;
}

// ========== 分页响应（保持不变） ==========
export interface OzonProductPageResult {
  total: number;
  page: number;
  size: number;
  records: OzonProductVO[];
}

// ========== 上架命令 DTO ==========
export interface CreateListingCommand {
  productId: string;
  offerId?: string;
  price: string;
  oldPrice?: string;
  operator: string;
  // ★ 新增
  clientId: string;
  sellerName: string;
}

export interface FollowListingCommand {
  productId: string;
  offerId?: string;
  price: string;
  oldPrice?: string;
  operator: string;
  clientId: string;
  sellerName: string;
}

// ========== API 方法 ==========
/**
 * 分页查询 Ozon 商品明细
 */
export function fetchOzonProducts(params: OzonProductQuery, signal?: AbortSignal) {
  const { page, size, ...rest } = params;
  return request({
    url: '/api/ozon/products',
    method: 'get',
    params: {
      ...rest,
      pageNo: page, // 后端期望 pageNo
      pageSize: size // 后端期望 pageSize
    },
    signal
  });
}

/**
 * 获取单个商品详情
 */
export function fetchOzonProductDetail(variantId: string) {
  return request<OzonProductVO>({
    url: `/api/ozon/products/detail/${variantId}`,
    method: 'get'
  });
}

/**
 * 自建商品上架
 */
export function createListing(data: CreateListingCommand) {
  return request<string>({
    url: '/api/ozon/listing/create',
    method: 'post',
    data
  });
}

/**
 * SKU跟卖商品上架
 */
export function followListing(data: FollowListingCommand) {
  return request<string>({
    url: '/api/ozon/listing/follow',
    method: 'post',
    data
  });
}
