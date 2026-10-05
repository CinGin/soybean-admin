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
// ========== 上架命令 DTO ==========
export interface CreateListingCommand {
  /** 源商品ID（可选，仅用于关联记录） */
  productId?: string;
  offerId?: string;
  /** 商品名称（自建必填） */
  name: string;
  /** 商品描述（可选） */
  description?: string;
  /** 类目ID（自建必填） */
  descriptionCategoryId: string;
  /** 类型ID（自建必填） */
  typeId: string;
  /** 售价 */
  price: string;
  /** 原价（可选） */
  oldPrice?: string;
  /** 增值税率（默认0） */
  vat?: string;
  /** 货币代码（默认RUB） */
  currencyCode?: string;
  /** 包装长（单位同dimensionUnit） */
  depth: string;
  /** 包装高 */
  height: string;
  /** 包装宽 */
  width: string;
  /** 重量（单位同weightUnit） */
  weight: string;
  /** 尺寸单位，如 mm */
  dimensionUnit: string;
  /** 重量单位，如 g */
  weightUnit: string;
  /** 图片URL列表 */
  images: string[];
  /** 主图URL（可选） */
  primaryImage?: string;
  /** 条码（可选） */
  barcode?: string;
  /** 属性数组（结构同Ozon接口） */
  attributes: any[];
  /** 复合属性（可选） */
  complexAttributes?: any[];
  /** 操作人 */
  operator: string;
  /** 卖家Client-Id */
  clientId: string;
  /** 卖家名称 */
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
    timeout: 1800000, // 设置等待时长为30秒
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
