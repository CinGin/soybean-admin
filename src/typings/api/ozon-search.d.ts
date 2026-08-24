//@typings/api/ozon-search.d.ts
declare namespace Api {
  namespace Ozon {
    /** 热搜词查询参数 */
    interface OzonSearchQueryParams {
      page: number;
      size: number;
      keyword?: string;
      minCount?: number;
      maxCount?: number;
      minCa?: number;
      minGmv?: number;
      sortField?: string;
      sortDir?: string;
    }
    /** 热搜词 VO */
    interface OzonSearchQueryVO {
      queryText: string;
      queryTextZh: string;
      count: number | null;
      ca: number | null;
      avgCaRub: number | null;
      avgCountItems: number | null;
      itemsViews: number | null;
      softQueryCount: number | null;
      softQueryShare: number | null;
      uniqQueriesWCa: number | null;
      uniqSellers: number | null;
      usersWithoutInterectionCount: number | null;
      usersWithoutInterectionShare: number | null;
      zrCount: number | null;
      zrShare: number | null;
      ord: number | null;
      gmv: number | null;
      searchUsersToOrdUsers: number | null;
    }

    /** 分页响应 */
    interface OzonSearchPageResult {
      total: number;
      page: number;
      size: number;
      totalPages: number;
      records: OzonSearchQueryVO[];
    }
  }
}
