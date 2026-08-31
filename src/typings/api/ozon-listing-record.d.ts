export interface OzonListingRecordVO {
  id: number;
  productId: string;
  shopId: string;
  listingType: number;
  ozonTaskId: string;
  offerId: string;
  sourceSku: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  errorMsg: string | null;
  operator: string;
  createdAt: string;
  updatedAt: string;
  newProductId?: number | null;
  newSku?: number | null; // ★ 平台生成的商品SKU
  stockSet?: number;
  stockWarehouseId?: string | null;
  stockUpdatedAt?: string | null;
  rebuildStatus?: string | null; // ★ 重建状态
  rebuildTaskId?: string | null; // 重建任务ID
  rebuildOfferId?: string | null; // 重建使用的offer_id
  rebuildNewProductId?: number | null; // 重建成功后新商品ID
  rebuildErrorMsg?: string | null; // 重建失败原因
  rebuildAttemptCount?: number | null; // 重建尝试次数
  originalArchived?: boolean | null; // 原商品是否归档
  originalDeleted?: boolean | null; // 原商品是否删除
}

export interface OzonListingRecordQuery {
  pageNo?: number;
  pageSize?: number;
  productId?: string;
  listingType?: number;
  ozonTaskId?: string;
  offerId?: string;
  status?: string;
  operator?: string;
  /** 新商品SKU，注意类型为string，实际传数字字符串 */
  newProductId?: string;
  startTime?: string;
  endTime?: string;
  sortField?: string;
  sortDir?: 'asc' | 'desc';
}

export interface PageResult<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
}
