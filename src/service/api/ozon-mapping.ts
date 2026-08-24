import { request } from '@/service/request';
import type { Api } from '@/typings/api/ozon-mapping';

/**
 * 分页查询 Ozon 热搜词与类目映射
 * 注意：直接返回 data 字段（PageResult），而非整个响应对象
 */
export function fetchCategoryMappings(params: Api.OzonMapping.QueryParams) {
  return request<Api.OzonMapping.PageResult>({
    url: '/api/ozon/category-search-mappings',
    method: 'get',
    params
  }).then(res => res.data); // 提取真实数据
}
