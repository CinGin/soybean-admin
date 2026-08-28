import { request } from '@/service/request';
import type { OzonListingRecordQuery, OzonListingRecordVO, PageResult } from '@/typings/api/ozon-listing-record';

/**
 * 分页查询 Ozon 上架记录
 */
export function fetchOzonListingRecords(params: OzonListingRecordQuery) {
  return request<PageResult<OzonListingRecordVO>>({
    url: '/api/ozon/listing/records',
    method: 'get',
    params
  });
}

/**
 * 手动触发指定 taskId 的上架状态更新
 */
export function manualCheckStatus(taskId: string) {
  return request<void>({
    url: `/api/ozon/listing/check-status/${taskId}`,
    method: 'post'
  });
}
