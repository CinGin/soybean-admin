import { request } from '../request';

// ==================== 重量评估 ====================

/**
 * 根据 1688 商详评估每个 SKU 的重量
 * Java 端接口：POST /api/weight/evaluate
 *   Body: { offer: ProductDetailModel }
 *   Resp: ApiResult<WeightEvaluateResponse>
 */
export function fetchEvaluateWeight(data: Api.Weight.WeightEvaluateRequest) {
  return request<Api.Weight.WeightEvaluateResponse>({
    url: '/api/weight/evaluate',
    method: 'post',
    data
  });
}

/**
 * 筛选低置信度的 SKU（供人工复核）
 * Java 端接口：POST /api/weight/low-confidence?scoreThreshold=60
 */
export function fetchLowConfidenceSkus(data: Api.Weight.WeightEvaluateRequest, scoreThreshold = 60) {
  return request<Api.Weight.SkuWeightItem[]>({
    url: '/api/weight/low-confidence',
    method: 'post',
    params: { scoreThreshold },
    data
  });
}

// ==================== 员工反馈 ====================

/**
 * 员工录入实际称重
 * Java 端接口：POST /api/weight/feedback
 */
export function fetchSubmitWeightFeedback(data: Api.Weight.WeightFeedbackRequest) {
  return request<Api.Weight.WeightFeedbackResponse>({
    url: '/api/weight/feedback',
    method: 'post',
    data
  });
}

/**
 * 查询某 SKU 最近一次员工反馈
 * Java 端接口：GET /api/weight/feedback/{skuId}
 */
export function fetchLatestWeightFeedback(skuId: string) {
  return request<Api.Weight.FeedbackLatest>({
    url: `/api/weight/feedback/${skuId}`,
    method: 'get'
  });
}

/** 待校准队列（分页） */
export function fetchCalibrationQueue(params: Api.Weight.CalibrationQueueQuery) {
  return request<Api.Weight.PageResult<Api.Weight.CalibrationQueueVO>>({
    url: '/api/weight/calibration-queue',
    method: 'get',
    params
  });
}

/** 通过候选ID提交实际称重 */
export function fetchFeedbackByCandidate(data: Api.Weight.FeedbackByCandidateCmd) {
  return request<Api.Weight.WeightFeedbackResponse>({
    url: '/api/weight/feedback-by-candidate',
    method: 'post',
    data
  });
}
/** 批量提交反馈 */
export function fetchBatchFeedbackByCandidate(data: Api.Weight.FeedbackBatchByCandidateCmd) {
  return request<Api.Weight.FeedbackBatchResult>({
    url: '/api/weight/feedback-batch-by-candidates',
    method: 'post',
    data
  });
}
