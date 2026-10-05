import { request } from '@/service/request';
import type {
  OzonListingRecordQuery,
  OzonListingRecordVO,
  PageResult,
  RebuildDataVO,
  ManualRebuildCommand,
  AttributeValuesRequest,
  SearchAttributeValuesRequest
} from '@/typings/api/ozon-listing-record';

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

/**
 * 手动触发跟卖失败重建
 */
export function manualRebuild(recordId: number) {
  return request<void>({
    url: `/api/ozon/listing/rebuild/${recordId}`,
    method: 'post'
  });
}

/**
 * 手动重试设置库存
 */
export function retryStock(recordId: number) {
  return request<void>({
    url: `/api/ozon/listing/retry-stock/${recordId}`,
    method: 'post'
  });
}

/**
 * 获取重建失败记录的当前商品信息
 */
export function fetchRebuildData(recordId: number) {
  return request<RebuildDataVO>({
    url: `/api/ozon/listing/rebuild-data/${recordId}`,
    method: 'get'
  });
}

/**
 * 手动二次重建
 */
export function submitManualRebuild(data: ManualRebuildCommand) {
  return request<string>({
    url: '/api/ozon/listing/manual-rebuild',
    method: 'post',
    data
  });
}

/**
 * 获取字典属性值分页
 */
export function fetchAttributeValues(params: AttributeValuesRequest) {
  return request<{ result: Array<{ id: number; value: string; picture?: string }>; hasNext: boolean }>({
    url: '/api/ozon/listing/attribute-values',
    method: 'post',
    data: params
  });
}

/**
 * 搜索字典属性值
 */
export function searchAttributeValues(params: SearchAttributeValuesRequest) {
  return request<{ result: Array<{ id: number; value: string; picture?: string }> }>({
    url: '/api/ozon/listing/attribute-values/search',
    method: 'post',
    data: params
  });
}
