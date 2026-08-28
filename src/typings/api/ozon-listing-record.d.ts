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
}

export interface OzonListingRecordQuery {
  pageNo?: number;
  pageSize?: number;
  productId?: string;
  shopId?: string;
  listingType?: number;
  ozonTaskId?: string;
  offerId?: string;
  status?: string;
  operator?: string;
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
