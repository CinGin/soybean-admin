declare namespace Api {
  namespace Weight {
    /** 单个 SKU 的重量评估结果 */
    type SkuWeightItem = {
      skuId: string;
      skuGroupName: string;
      netWeight: string; // "144g"
      logisticsWeight: string; // "185g"
      reasonableRange: string; // "148-222g"
      confidence: string; // "100 高" / "75 中高" / "60 中" / "40 低"
      reason: string;
      _debug?: Record<string, any>;
    };

    /** 内层数据 */
    type WeightEvaluateInner = {
      offerId: number;
      data: SkuWeightItem[];
    };

    /** 评估响应（Java 侧会再包一层 ApiResult，见下方说明） */
    type WeightEvaluateResponse = {
      code: number;
      msg: string;
      data: WeightEvaluateInner;
    };

    /** 评估请求 */
    type WeightEvaluateRequest = {
      /** 1688 商详的 result.result 对象（ProductDetailModel） */
      offer: Record<string, any>;
    };

    /** 员工录入实际称重请求 */
    type WeightFeedbackRequest = {
      offerId: number;
      skuId: string;
      skuGroupName?: string;
      /** 系统预测重量（g），用于自动计算偏差率 */
      predictedWeight?: number;
      /** 实际称重（g），必填且 > 0 */
      actualWeight: number;
      employeeId?: string;
      remark?: string;
    };

    /** 最近一次反馈 */
    type FeedbackLatest = {
      actual_weight: number;
      deviation_percent: number;
      create_time: string;
    };

    /** 员工反馈响应 */
    type WeightFeedbackResponse = {
      code: number;
      msg: string;
      affected: number;
      latest: FeedbackLatest | null;
    };

    type PageResult<T> = {
      total: number;
      page: number;
      size: number;
      records: T[];
    };

    type CalibrationQueueQuery = {
      pageNo: number;
      pageSize: number;
      feedbackStatus?: number | null;
      maxConfidence?: number | null;
      taskId?: number | null;
      clientId?: string | null;
      keyword?: string;
      days?: number;
    };

    type CalibrationQueueVO = {
      id: number;
      taskId: number;
      offerId: number;
      skuId: number;
      skuGroupName: string | null;
      subject: string | null;
      skuImageUrl: string | null;
      productImageUrl: string | null;
      productUrl: string | null; // ★ 1688 商品链接
      merchantWeightG: number | null; // ★ 商家标重
      merchantWeightFlag: string | null; // ★ NORMAL/SUSPICIOUS/MISSING
      weightG: number | null; // 模型推算
      reasonableRange: string | null;
      confidenceScore: number | null;
      confidenceText: string | null;
      weightSource: string | null;
      similarity: number | null;
      feedbackStatus: number;
      latestFeedbackWeight: number | null;
      latestFeedbackAt: string | null;
      latestFeedbackOperator: string | null;
      latestFeedbackRemark: string | null;
      feedbackDeviation: number | null; // ★ 如果加了
      createdAt: string;
    };

    type FeedbackByCandidateCmd = {
      candidateId: number;
      actualWeight: number;
      remark?: string;
      operator?: string; // ★ 新增
    };
    type FeedbackBatchByCandidateCmd = {
      candidateIds: number[];
      actualWeight: number;
      remark?: string;
      operator?: string;
    };

    type FeedbackBatchResult = {
      total: number;
      success: number;
      failed: number;
      uniqueSkuCount: number;
      errors: string[];
    };
  }
}
