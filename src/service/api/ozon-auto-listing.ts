import { request } from '../request';

// ==================== 任务 ====================

/** 任务分页 */
export function fetchAutoListingTaskPage(params: Api.AutoListing.TaskQuery) {
  return request<Api.AutoListing.PageResult<Api.AutoListing.TaskItem>>({
    url: '/api/ozon/auto-listing/page',
    method: 'get',
    params
  });
}

/** 任务详情 */
export function fetchAutoListingTaskDetail(taskId: number) {
  return request<Api.AutoListing.TaskItem>({
    url: `/api/ozon/auto-listing/${taskId}`,
    method: 'get'
  });
}

/** 候选列表 */
export function fetchAutoListingCandidates(taskId: number, stage: 'FIRST' | 'SECOND' = 'FIRST') {
  return request<Api.AutoListing.CandidateItem[]>({
    url: `/api/ozon/auto-listing/${taskId}/candidates`,
    method: 'get',
    params: { stage }
  });
}

/** 人工选择 */
export function fetchPickCandidate(data: Api.AutoListing.ManualPickReq) {
  return request<Api.AutoListing.FirstPricingResult>({
    url: '/api/ozon/auto-listing/pick',
    method: 'post',
    data
  });
}

/** 重置任务 */
export function fetchResetTask(taskId: number, data: Api.AutoListing.ResetReq) {
  return request<void>({
    url: `/api/ozon/auto-listing/${taskId}/reset`,
    method: 'post',
    data
  });
}

// ==================== 佣金费率 ====================

/** 佣金费率分页 */
export function fetchCommissionRatePage(params: Api.AutoListing.CommissionRateQuery) {
  return request<Api.AutoListing.PageResult<Api.AutoListing.CommissionRate>>({
    url: '/api/ozon/commission-rate/page',
    method: 'get',
    params
  });
}
/** 新增佣金费率 */
export function fetchAddCommissionRate(data: Api.AutoListing.CommissionRate) {
  return request<void>({
    url: '/api/ozon/commission-rate',
    method: 'post',
    data
  });
}

/** 更新佣金费率 */
export function fetchUpdateCommissionRate(id: number, data: Api.AutoListing.CommissionRate) {
  return request<void>({
    url: `/api/ozon/commission-rate/${id}`,
    method: 'put',
    data
  });
}

/** 删除佣金费率 */
export function fetchDeleteCommissionRate(id: number) {
  return request<void>({
    url: `/api/ozon/commission-rate/${id}`,
    method: 'delete'
  });
}

/** 给任务指定店铺 */
export function fetchAssignShop(
  taskId: number,
  clientId: string,
  targetStatus: Api.AutoListing.TaskStatus = 'FIRST_PRICED'
) {
  return request<void>({
    url: `/api/ozon/auto-listing/${taskId}/assign-shop`,
    method: 'post',
    params: { clientId, targetStatus }
  });
}
/** 候选运费 */
export function fetchCandidateFreight(taskId: number, candidateId: number) {
  return request<Api.AutoListing.CandidateFreight>({
    url: `/api/ozon/auto-listing/${taskId}/candidates/${candidateId}/freight`,
    method: 'get'
  });
}
// ==================== 补佣金后触发重跑 ====================

/**
 * 补佣金费率后，回退任务到 SEARCHED 并触发首定价
 * Java 端：POST /api/ozon/auto-listing/{taskId}/retry-after-commission-fix
 */
export function fetchRetryAfterCommissionFix(taskId: number) {
  return request<void>({
    url: `/api/ozon/auto-listing/${taskId}/retry-after-commission-fix`,
    method: 'post'
  });
}

/**
 * 临时用指定 rFBS 费率重算价格（不写库）
 * Java 端：POST /api/ozon/auto-listing/{taskId}/reprice-temporary
 */
export function fetchRepriceTemporary(taskId: number, data: Api.AutoListing.TemporaryRepriceRequest) {
  return request<Api.AutoListing.TemporaryRepriceResult>({
    url: `/api/ozon/auto-listing/${taskId}/reprice-temporary`,
    method: 'post',
    data
  });
}

/**
 * 用临时选择的佣金费率计算并应用到任务（写回 task）
 * Java 端：POST /api/ozon/auto-listing/{taskId}/apply-temporary-rate
 */
export function fetchApplyTemporaryRate(taskId: number, data: Api.AutoListing.TemporaryRepriceRequest) {
  return request<Api.AutoListing.TemporaryRepriceResult>({
    url: `/api/ozon/auto-listing/${taskId}/apply-temporary-rate`,
    method: 'post',
    data
  });
}
