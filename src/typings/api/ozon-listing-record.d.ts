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
  stockSet?: number;
  stockWarehouseId?: string | null;
  stockUpdatedAt?: string | null;
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
