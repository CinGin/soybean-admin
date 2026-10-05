// ============ 订单列表 ============

export interface AlibabaOrderBaseInfo {
  id?: number;
  idOfStr?: string;
  status?: string;
  totalAmount?: number;
  sumProductPayment?: number;
  shippingFee?: number;
  discount?: number;
  couponFee?: number;
  createTime?: string;
  payTime?: string;
  modifyTime?: string;
  payTimeout?: number;
  buyerLoginId?: string;
  sellerLoginId?: string;
  shopName?: string;
  tradeTypeDesc?: string;
  buyerFeedback?: string;
  receiverInfo?: {
    toFullName?: string;
    toMobile?: string;
    toPhone?: string;
    toArea?: string;
    toPost?: string;
    toDivisionCode?: string;
  };
}

export interface AlibabaProductItem {
  productID?: number;
  name?: string;
  price?: number;
  quantity?: number;
  unit?: string;
  itemAmount?: number;
  productImgUrl?: string[];
  productSnapshotUrl?: string;
  skuID?: number;
  specId?: string;
  status?: string;
  statusStr?: string;
  skuInfos?: { name: string; value: string }[];
}

export interface AlibabaTradeInfo {
  baseInfo?: AlibabaOrderBaseInfo;
  productItems?: AlibabaProductItem[];
}

/**
 * 订单列表业务数据
 * 对应后端 AlibabaTradeGetBuyerOrderListResult
 */
export interface AlibabaOrderListData {
  result?: AlibabaTradeInfo[];
  totalRecord?: number;
  errorCode?: string;
  errorMessage?: string;
}

/** request 库会自动拆出后端的 data 字段，这里直接就是业务数据 */
export type AlibabaOrderListResponse = AlibabaOrderListData;

// ============ 订单详情 ============

/**
 * 订单详情业务数据
 * 对应后端 AlibabaTradeGetBuyerViewResult
 */
export interface AlibabaOrderDetailData {
  success?: string;
  result?: AlibabaTradeInfo;
  errorCode?: string;
  errorMessage?: string;
}

export type AlibabaOrderDetailResponse = AlibabaOrderDetailData;

// ============ 支付 ============

export interface AlibabaPayChannel {
  code?: number;
  name?: string;
}

export interface AlibabaPayWayResult {
  channels?: AlibabaPayChannel[];
  orderId?: string;
  payFee?: number;
  timeout?: string;
}

export interface AlibabaPayWayData {
  success?: string;
  errorCode?: string;
  errorMsg?: string;
  resultList?: AlibabaPayWayResult;
}

export type AlibabaPayWayQueryResponse = AlibabaPayWayData;

/**
 * 支付链接业务数据
 * 对应后端 AlibabaAlipayUrlGetResult
 */
export interface AlibabaPayUrlData {
  success?: boolean;
  payUrl?: string;
  erroMsg?: string;
  errorCode?: string;
  payFailureOrderList?: number[];
}

export type AlibabaPayUrlResponse = AlibabaPayUrlData;

// ============ 物流信息 ============

export interface AlibabaLogisticsReceiver {
  receiverName?: string;
  receiverPhone?: string;
  receiverMobile?: string;
  receiverProvince?: string;
  receiverCity?: string;
  receiverCounty?: string;
  receiverAddress?: string;
  receiverProvinceCode?: string;
  receiverCityCode?: string;
  receiverCountyCode?: string;
  encrypt?: string;
}

export interface AlibabaLogisticsSender {
  senderName?: string;
  senderPhone?: string;
  senderMobile?: string;
  senderProvince?: string;
  senderCity?: string;
  senderCounty?: string;
  senderAddress?: string;
  senderProvinceCode?: string;
  senderCityCode?: string;
  senderCountyCode?: string;
  encrypt?: string;
}

export interface AlibabaLogisticsSendGood {
  goodName?: string;
  quantity?: string;
  unit?: string;
}

export interface AlibabaLogisticsOrder {
  logisticsId?: string;
  logisticsBillNo?: string;
  orderEntryIds?: string;
  status?: string;
  logisticsCompanyId?: string;
  logisticsCompanyName?: string;
  logisticsCompanyNo?: string;
  remarks?: string;
  serviceFeature?: string;
  gmtSystemSend?: string;
  sendGoods?: AlibabaLogisticsSendGood[];
  receiver?: AlibabaLogisticsReceiver;
  sender?: AlibabaLogisticsSender;
}

export interface AlibabaLogisticsInfosData {
  result?: AlibabaLogisticsOrder[];
  success?: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export type AlibabaLogisticsInfosResponse = AlibabaLogisticsInfosData;

// ============ 物流轨迹 ============

export interface AlibabaLogisticsStep {
  acceptTime?: string;
  remark?: string;
}

export interface AlibabaLogisticsTrace {
  logisticsId?: string;
  orderId?: number;
  logisticsBillNo?: string;
  logisticsSteps?: AlibabaLogisticsStep[];
}

export interface AlibabaLogisticsTraceData {
  logisticsTrace?: AlibabaLogisticsTrace[];
  success?: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export type AlibabaLogisticsTraceResponse = AlibabaLogisticsTraceData;

// 下单页
// ============ 收货地址 ============

export interface AlibabaReceiveAddressItem {
  id?: number;
  fullName?: string;
  address?: string;
  post?: string;
  phone?: string;
  mobilePhone?: string;
  addressCode?: string;
  addressCodeText?: string;
  isDefault?: boolean;
  townCode?: string;
  townName?: string;
}

export interface AlibabaReceiveAddressData {
  success?: boolean;
  result?: {
    receiveAddressItems?: AlibabaReceiveAddressItem[];
  };
  code?: string;
  message?: string;
}

export type AlibabaReceiveAddressResponse = AlibabaReceiveAddressData;

// ============ 地址解析 ============

export interface AlibabaParseAddressResult {
  address?: string;
  addressCode?: string;
  addressCodeText?: string;
  addressId?: number;
  isDefault?: boolean;
  latest?: boolean;
  postCode?: string;
  fullName?: string;
  mobile?: string;
  phone?: string;
}

export interface AlibabaParseAddressData {
  result?: AlibabaParseAddressResult;
  errorCode?: string;
  errorMessage?: string;
}

export type AlibabaParseAddressResponse = AlibabaParseAddressData;

// ============ 优惠券 ============

export interface AlibabaCouponClaimData {
  result?: {
    success?: boolean;
    code?: string;
    message?: string;
    result?: {
      couponIds?: string[];
    };
  };
}

export type AlibabaCouponClaimResponse = AlibabaCouponClaimData;

// ============ 下单预览 ============

export interface AlibabaPreviewCargo {
  amount?: number;
  finalUnitPrice?: number;
  specId?: string;
  skuId?: number;
  offerId?: number;
}

export interface AlibabaPreviewTradeModel {
  tradeType?: string;
  name?: string;
  description?: string;
  opSupport?: boolean;
}

export interface AlibabaPreviewOrderItem {
  tradeModeNameList?: string[];
  status?: boolean;
  sumPayment?: number;
  sumCarriage?: number;
  sumPaymentNoCarriage?: number;
  flowFlag?: string;
  cargoList?: AlibabaPreviewCargo[];
  tradeModelList?: AlibabaPreviewTradeModel[];
}

export interface AlibabaPreviewOrderData {
  orderPreviewResuslt?: AlibabaPreviewOrderItem[];
  success?: boolean;
  errorCode?: string;
  errorMsg?: string;
}

export type AlibabaPreviewOrderResponse = AlibabaPreviewOrderData;

// ============ 创建订单 ============

export interface AlibabaCreateOrderData {
  result?: {
    orderId?: string;
    totalSuccessAmount?: number;
    success?: boolean;
    code?: string;
    message?: string;
  };
  success?: boolean;
  code?: string;
  message?: string;
}

export type AlibabaCreateOrderResponse = AlibabaCreateOrderData;

// ============ 取消订单 ============

export interface AlibabaCancelOrderData {
  success?: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export type AlibabaCancelOrderResponse = AlibabaCancelOrderData;
