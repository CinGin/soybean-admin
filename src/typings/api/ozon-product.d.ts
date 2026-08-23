declare namespace Api {
  namespace Ozon {
    /** Ozon 商品查询参数 */
    interface OzonProductQuery {
      page?: number;
      size?: number;
      keyword?: string;
      name?: string;
      brand?: string;
      category1?: string;
      sellerName?: string;
      sortField?: string;
      sortDir?: string;
    }

    /** Ozon 商品 VO */
    interface OzonProductVO {
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
      previousSoldCount?: number;
      growthRate?: number | null; // 接口可能返回字符串或 null
      salesDynamics?: number | null; // 接口返回字符串，如 "-91.8"
      updateDate?: string;
    }

    /** 分页响应 */
    interface OzonProductPageResult {
      total: number;
      page: number;
      size: number;
      records: OzonProductVO[];
    }
  }
}
