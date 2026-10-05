import type { SelectOption } from 'naive-ui';

type StatusMeta = {
  label: string;
  type: 'default' | 'info' | 'success' | 'warning' | 'error';
  desc: string;
};

export const TASK_STATUS_MAP: Record<Api.AutoListing.TaskStatus, StatusMeta> = {
  PENDING: { label: '待处理', type: 'default', desc: '任务已创建' },
  SEARCHED: { label: '已图搜', type: 'info', desc: '图搜完成' },
  FIRST_PRICED: { label: '首定价完成', type: 'info', desc: '首次定价完成' },
  FIRST_PENDING_MANUAL: { label: '待人工选品', type: 'warning', desc: '首次多候选并列' },
  FAILED_NO_MATCH: { label: '无匹配', type: 'error', desc: '所有SKU相似度低于阈值' },
  FAILED_PRICING: { label: '定价异常', type: 'error', desc: '未找到佣金类目或定价失败' },
  FAILED_NO_WEIGHT: { label: '无重量', type: 'error', desc: '选中SKU无有效重量' },
  LISTING: { label: '跟卖中', type: 'info', desc: '等待Ozon审核' },
  LISTED: { label: '跟卖成功', type: 'success', desc: '跟卖审核通过' },
  FAILED_LISTING: { label: '跟卖失败', type: 'error', desc: '跟卖审核未通过' },
  SECOND_PRICED: { label: '二定价完成', type: 'info', desc: '属性匹配完成' },
  SECOND_PENDING_MANUAL: { label: '待人工二选', type: 'warning', desc: '二次多候选并列' },
  FAILED_ATTR_MATCH: { label: '属性匹配异常', type: 'error', desc: '属性匹配异常' },
  PRICE_UPDATED: { label: '改价完成', type: 'success', desc: 'Ozon价格已修改' },
  COMPLETED: { label: '已完成', type: 'success', desc: '全流程完成' },
  FAILED_PRICE_UPDATE: { label: '改价失败', type: 'error', desc: '改价失败' },
  FAILED_STOCK_UPDATE: { label: '库存失败', type: 'error', desc: '库存更新失败' },
  FAILED_UNKNOWN: { label: '未知异常', type: 'error', desc: '未知异常' }
};

export const TASK_STATUS_OPTIONS: SelectOption[] = Object.entries(TASK_STATUS_MAP).map(([value, { label }]) => ({
  label,
  value
}));

/** 允许人工选品的状态 */
export const MANUAL_PICK_STATUSES: Api.AutoListing.TaskStatus[] = ['FIRST_PENDING_MANUAL', 'SECOND_PENDING_MANUAL'];

/** 允许补佣金的状态 */
export const COMMISSION_FIXABLE_STATUSES: Api.AutoListing.TaskStatus[] = ['FAILED_PRICING'];

/** 允许重置重跑的状态 */
export const RETRYABLE_STATUSES: Api.AutoListing.TaskStatus[] = [
  'FAILED_NO_MATCH',
  'FAILED_PRICING',
  'FAILED_NO_WEIGHT',
  'FAILED_UNKNOWN'
];
