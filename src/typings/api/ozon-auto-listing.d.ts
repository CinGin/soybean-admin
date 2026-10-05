declare namespace Api {
  namespace AutoListing {
    /** 任务状态（与后端 AutoListingStatus + FirstPricingService 抛出的字符串对齐） */
    type TaskStatus =
      | 'PENDING'
      | 'SEARCHED'
      | 'FIRST_PRICED'
      | 'FIRST_PENDING_MANUAL'
      | 'FAILED_NO_MATCH'
      | 'FAILED_PRICING' // ★ FirstPricingService 里抛出的字符串状态
      | 'FAILED_NO_WEIGHT' // ★ 同上
      | 'LISTING'
      | 'LISTED'
      | 'FAILED_LISTING'
      | 'SECOND_PRICED'
      | 'SECOND_PENDING_MANUAL'
      | 'FAILED_ATTR_MATCH'
      | 'PRICE_UPDATED'
      | 'COMPLETED'
      | 'FAILED_PRICE_UPDATE'
      | 'FAILED_STOCK_UPDATE'
      | 'FAILED_UNKNOWN';

    /** 与后端 AutoListingTask 实体字段一一对应 */
    type TaskItem = {
      id: number;
      variantId: string;
      ozonProductId: number | null;
      clientId: string | null;
      sellerName: string | null;
      shopSettlementCurrency: string | null;
      ozonCategoryId: string | null;
      status: TaskStatus;
      currentStage: string | null;
      retryCount: number | null;
      errorMsg: string | null;

      ozonPhotoUrl: string | null;
      alibabaImageId: string | null;
      candidateCount: number | null;

      firstOfferId: number | null;
      firstSpecId: string | null;
      firstSimilarity: number | null;
      firstMatchMethod: string | null;
      firstPurchasePrice: number | null;
      firstWeightG: number | null;
      firstCarriageCny: number | null;
      firstCommissionRate: number | null;
      firstFinalPrice: number | null;
      firstOriginalPrice: number | null;
      firstPricingCurrency: string | null;
      firstPricingDetail: string | null;
      firstCandidateCount: number | null;
      companyInn: string | null;
      companyName: string | null;

      listingRecordId: number | null;
      ozonTaskId: string | null;
      newProductId: number | null;
      newSku: number | null;
      offerId: string | null;

      secondOfferId: number | null;
      secondSpecId: string | null;
      secondAttrMatchScore: number | null;
      secondPurchasePrice: number | null;
      secondWeightG: number | null;
      secondCarriageCny: number | null;
      secondCommissionRate: number | null;
      secondFinalPrice: number | null;
      secondOriginalPrice: number | null;
      secondPricingCurrency: string | null;
      secondPricingDetail: string | null;
      secondCandidateCount: number | null;

      needManual: number | null;
      manualStage: string | null;
      manualSelectedItemId: number | null;
      manualOperator: string | null;
      manualSelectedAt: string | null;
      manualRemark: string | null;
      autoContinue: number | null;

      nextRetryAt: string | null;
      createdAt: string;
      updatedAt: string;
    };

    /** 任务分页查询 */
    type TaskQuery = {
      pageNo: number;
      pageSize: number;
      status?: TaskStatus | null;
      variantId?: string;
      clientId?: string;
      sellerName?: string;
      companyInn?: string;
    };

    /** 与后端 PageResult 对齐 */
    type PageResult<T> = {
      total: number;
      page: number;
      size: number;
      records: T[];
    };

    /** 候选（对应 AutoListingCandidate 实体） */
    type CandidateItem = {
      id: number;
      taskId: number;
      stage: string;
      offerId: number;
      productUrl: string | null;
      productImageUrl: string | null;
      subject: string | null;
      specId: string | null;
      skuId: number | null;
      skuImageUrl: string | null;
      skuAttrsJson: string | null;
      price: number | null;
      weightG: number | null;
      amountOnSale: number | null;
      similarity: number | null;
      attrMatchScore: number | null;
      attrMatchDetail: string | null;
      rankInCandidate: number | null;
      rankInSku: number | null;
      isSelected: number | null;
      isCandidate: number | null;
      manualPicked: number | null;
      createdAt: string | null; // ★ 实体里只有 createdAt，没有 updatedAt
    };

    /** 人工选择请求 */
    type ManualPickReq = {
      taskId: number;
      itemId: number;
      operator?: string;
      remark?: string;
      autoContinue?: boolean;
      clientId?: string; // ★ 新增
    };

    /** 任务重置请求 */
    type ResetReq = {
      targetStatus: TaskStatus;
      clearError?: boolean;
      clearCandidates?: boolean;
    };

    /** 佣金费率（对应 ozon_commission_rates 表） */
    type CommissionRate = {
      id?: number;
      categoryId: number | null;
      categoryL1Ru?: string | null;
      categoryL1Cn?: string | null;
      categoryL2Ru?: string | null;
      categoryL2Cn?: string | null;
      categoryL3Ru: string;
      categoryL3Cn?: string | null;
      brand?: string;
      creator?: string | null; // ★ 新增
      rfbsRate01500?: number | null;
      rfbsRate15005000?: number | null;
      rfbsRate5000Plus?: number | null;
      fbpRate01500?: number | null;
      fbpRate15005000?: number | null;
      fbpRate5000Plus?: number | null;
      createdAt?: string;
      updatedAt?: string;
    };

    type CommissionRateQuery = {
      pageNo: number;
      pageSize: number;
      categoryId?: number | null;
      categoryL1Cn?: string;
      categoryL2Cn?: string;
      keyword?: string;
    };
    /** 首次定价返回（对应 FirstPricingResult） */
    type FirstPricingResult = {
      taskId: number;
      status: string;
      offerId?: number;
      specId?: string;
      similarity?: number;
      purchasePrice?: number;
      carriageCny?: number;
      weightG?: number;
      finalPrice?: number;
      originalPrice?: number;
      currency?: string;
      commissionRate?: number;
      candidateCount?: number;
      errorMsg?: string;
    };
    type CandidateFreight = {
      candidateId: number;
      carriageCny: number | null;
      success: boolean;
      errorMsg: string | null;
    };
    /** ★ 新增：临时算价请求 */
    type TemporaryRepriceRequest = {
      categoryId?: number | null;
      rfbsRate: number;
      operator?: string;
    };

    /** ★ 新增：临时算价响应 */
    type TemporaryRepriceResult = {
      taskId: number;
      finalPrice: number;
      originalPrice: number;
      commissionRate: number;
      currency: string;
      pricingDetail?: string;
    };
  }
}
