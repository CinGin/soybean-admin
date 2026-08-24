// src/typings/api/ozon-mapping.d.ts

export namespace Api {
  export namespace OzonMapping {
    /** 查询参数 */
    export interface QueryParams {
      page: number;
      size: number;
      keyword?: string;
      rank?: number;
      matchType?: string;
      sortField?: string;
      sortDir?: string;
    }

    /** 单条记录 */
    export interface Record {
      id: number;
      queryText: string;
      queryTextZh: string | null;
      categoryId: string;
      categoryNameZh: string | null; // ★ 新增
      score: number;
      matchType: 'rule' | 'vector';
      rank: number;
      createdAt: string;
      updatedAt: string;
    }

    /** 分页结果 */
    export interface PageResult {
      total: number;
      page: number;
      size: number;
      records: Record[];
    }
  }
}
