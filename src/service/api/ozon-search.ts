import { request } from '@/service/request';

// ========== 查询参数 ==========
export interface OzonSearchQueryParams {
  /** 页码，从1开始 */
  page?: number;
  /** 每页条数，最大100 */
  size?: number;
  /** 关键字模糊搜索（匹配俄语原文或中文翻译） */
  keyword?: string;
  /** 最小搜索次数 */
  minCount?: number;
  /** 最大搜索次数 */
  maxCount?: number;
  /** 最低转化率(%) */
  minCa?: number;
  /** 最低 GMV */
  minGmv?: number;
  /** 排序字段 */
  sortField?: string;
  /** 排序方向 asc/desc */
  sortDir?: string;
}

// ========== 热搜词 VO ==========
export interface OzonSearchQueryVO {
  queryText?: string;
  queryTextZh?: string;
  count?: number;
  ca?: number;
  avgCaRub?: number;
  avgCountItems?: number;
  itemsViews?: number;
  softQueryCount?: number;
  softQueryShare?: number;
  uniqQueriesWCa?: number;
  uniqSellers?: number;
  usersWithoutInterectionCount?: number;
  usersWithoutInterectionShare?: number;
  zrCount?: number;
  zrShare?: number;
  ord?: number;
  gmv?: number;
  searchUsersToOrdUsers?: number;
}

// ========== 分页响应 ==========
export interface OzonSearchPageResult {
  total: number;
  page: number;
  size: number;
  totalPages: number;
  records: OzonSearchQueryVO[];
}

// ========== API 方法 ==========

/**
 * 分页查询 Ozon 热搜搜索词
 */
export function fetchOzonSearchQueries(params: OzonSearchQueryParams) {
  return request<OzonSearchPageResult>({
    url: '/api/ozon/search-queries',
    method: 'get',
    params
  });
}
