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
      growthRate?: number | null;
      salesDynamics?: number | null;
      updateDate?: string;
      /** 上架卖家Client-Id（本系统卖家账号标识） */
      listingClientId?: string;
      /** 上架卖家名称 */
      listingSellerName?: string;
      /** 上架来源及状态: 0-未上架, 1-自建(审核中), 2-自建(成功), 3-自建(失败), 4-跟卖(审核中), 5-跟卖(成功), 6-跟卖(失败) */
      listingSource?: number;
      listingTaskId?: string;
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
