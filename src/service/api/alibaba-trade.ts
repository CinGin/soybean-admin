import { request } from '@/service/request';
import type {
  AlibabaOrderListResponse,
  AlibabaOrderDetailResponse,
  AlibabaPayWayQueryResponse,
  AlibabaPayUrlResponse,
  AlibabaLogisticsInfosResponse,
  AlibabaLogisticsTraceResponse,
  AlibabaReceiveAddressResponse,
  AlibabaParseAddressResponse,
  AlibabaCouponClaimResponse,
  AlibabaPreviewOrderResponse,
  AlibabaCreateOrderResponse,
  AlibabaCancelOrderResponse
} from '@/typings/api/alibaba-trade';
/**
 * 查询买家订单列表
 */
export function fetchAlibabaOrderList(params: {
  page: number;
  pageSize: number;
  orderStatus?: string;
  bizTypes?: string[];
}) {
  return request<AlibabaOrderListResponse>({
    url: '/api/alibaba/trade/order-list',
    method: 'post',
    data: params
  });
}

/**
 * 查询买家订单详情
 */
export function fetchAlibabaOrderDetail(orderId: string | number) {
  return request<AlibabaOrderDetailResponse>({
    url: `/api/alibaba/trade/order-detail/${orderId}`,
    method: 'get'
  });
}

/**
 * 查询订单支持的支付渠道
 */
export function fetchAlibabaPayWays(orderId: string) {
  return request<AlibabaPayWayQueryResponse>({
    url: `/api/alibaba/trade/pay-ways/${orderId}`,
    method: 'get'
  });
}

/**
 * 获取订单支付链接
 */
export function fetchAlibabaPayUrl(orderId: string | number) {
  return request<AlibabaPayUrlResponse>({
    url: `/api/alibaba/trade/pay-url/${orderId}`,
    method: 'get'
  });
}

/**
 * 获取订单物流信息（运单号、物流公司、状态等）
 */
export function fetchAlibabaLogisticsInfos(orderId: string | number) {
  return request<AlibabaLogisticsInfosResponse>({
    url: `/api/alibaba/trade/logistics/infos/${orderId}`,
    method: 'get'
  });
}

/**
 * 获取订单物流跟踪信息（时间轴）
 */
export function fetchAlibabaLogisticsTrace(orderId: string | number, logisticsId?: string) {
  return request<AlibabaLogisticsTraceResponse>({
    url: `/api/alibaba/trade/logistics/trace/${orderId}`,
    method: 'get',
    params: logisticsId ? { logisticsId } : {}
  });
}

// 订单创建

/**
 * 获取收货地址列表
 */
export function fetchAlibabaReceiveAddress() {
  return request<AlibabaReceiveAddressResponse>({
    url: '/api/alibaba/trade/receive-address',
    method: 'get'
  });
}

/**
 * 地址标准化解析
 */
export function fetchAlibabaParseAddress(addressInfo: string) {
  return request<AlibabaParseAddressResponse>({
    url: '/api/alibaba/trade/parse-address',
    method: 'post',
    params: { addressInfo }
  });
}

/**
 * 领取最优优惠券
 */
export function fetchAlibabaClaimOptimalCoupon(offerIds: number[]) {
  return request<AlibabaCouponClaimResponse>({
    url: '/api/alibaba/trade/claim-optimal-coupon',
    method: 'post',
    data: offerIds
  });
}

/**
 * 下单预览
 */
export function fetchAlibabaPreviewOrder(data: any) {
  return request<AlibabaPreviewOrderResponse>({
    url: '/api/alibaba/trade/preview-order',
    method: 'post',
    data
  });
}

/**
 * 创建跨境订单
 */
export function fetchAlibabaCreateOrder(data: any) {
  return request<AlibabaCreateOrderResponse>({
    url: '/api/alibaba/trade/create-cross-order',
    method: 'post',
    data
  });
}
/**
 * 取消订单
 */
export function fetchAlibabaCancelOrder(orderId: string | number, cancelReason = 'buyerCancel', remark?: string) {
  return request<AlibabaCancelOrderResponse>({
    url: `/api/alibaba/trade/cancel-order/${orderId}`,
    method: 'post',
    params: { cancelReason, remark }
  });
}
