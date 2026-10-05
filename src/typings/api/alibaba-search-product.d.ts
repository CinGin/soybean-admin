// ============ 搜索相关类型 ============

export interface AlibabaProductPriceInfo {
  price?: string;
  jxhyPrice?: string | null;
  pfJxhyPrice?: string | null;
  consignPrice?: string;
  promotionPrice?: string | null;
}

export interface AlibabaProductPromotionModel {
  hasPromotion?: boolean;
  promotionType?: string;
}

export interface AlibabaProductSellerDataInfo {
  tradeMedalLevel?: string;
  compositeServiceScore?: string;
  logisticsExperienceScore?: string;
  disputeComplaintScore?: string;
  offerExperienceScore?: string;
  afterSalesExperienceScore?: string;
  consultingExperienceScore?: string;
  repeatPurchasePercent?: string;
  collect30DayWithin48HPercent?: string | null;
  qualityRefundWithin30Day?: string | null;
}

export interface AlibabaProductSimpleShippingInfo {
  sendGoodsAddressText?: string | null;
  shippingTimeGuarantee?: string;
}

export interface AlibabaProduct {
  imageUrl?: string;
  subject?: string;
  subjectTrans?: string;
  offerId?: number;
  isJxhy?: boolean;
  priceInfo?: AlibabaProductPriceInfo;
  repurchaseRate?: string;
  monthSold?: number;
  traceInfo?: string;
  isOnePsale?: boolean;
  sellerIdentities?: string[];
  offerIdentities?: string[];
  tradeScore?: string;
  whiteImage?: string | null;
  promotionModel?: AlibabaProductPromotionModel | null;
  topCategoryId?: number;
  secondCategoryId?: number;
  thirdCategoryId?: number;
  isPatentProduct?: boolean;
  createDate?: string;
  modifyDate?: string;
  isSelect?: boolean;
  minOrderQuantity?: number;
  sellerDataInfo?: AlibabaProductSellerDataInfo;
  productSimpleShippingInfo?: AlibabaProductSimpleShippingInfo | null;
  token?: string | null;
  promotionURL?: string;
  aigcImageUrl?: string | null;
}

export interface AlibabaProductSearchPageInfo {
  totalRecords?: number;
  totalPage?: number;
  pageSize?: number;
  currentPage?: number;
  data?: AlibabaProduct[];
}

export interface AlibabaProductSearchResult {
  success?: boolean;
  code?: string;
  message?: string | null;
  result?: AlibabaProductSearchPageInfo;
}

export interface AlibabaProductSearchResponse {
  result?: AlibabaProductSearchResult;
}

// ============ 详情相关类型（简化，只定义需要展示的字段） ============

export interface AlibabaProductAttribute {
  attributeId?: string;
  attributeName?: string;
  value?: string;
  attributeNameTrans?: string;
  valueTrans?: string;
}

export interface AlibabaProductSkuAttribute {
  attributeId?: number;
  attributeName?: string;
  value?: string;
  attributeNameTrans?: string;
  valueTrans?: string;
  skuImageUrl?: string | null;
}

export interface AlibabaProductSkuInfo {
  amountOnSale?: number;
  price?: string;
  skuId?: number;
  specId?: string;
  skuAttributes?: AlibabaProductSkuAttribute[];
  consignPrice?: string;
  cargoNumber?: string;
  promotionPrice?: string | null;
  // 可扩展其他字段
}

export interface AlibabaProductShippingDetail {
  skuId?: string;
  width?: number;
  length?: number;
  height?: number;
  weight?: number; // kg
  pkgSizeSource?: string;
  officialLength?: number | null;
  officialWidth?: number | null;
  officialHeight?: number | null;
  officialWeight?: number | null;
  aiWeight?: number | null;
  aiWeightAccuracy?: string | null;
}

export interface AlibabaProductShippingInfo {
  sendGoodsAddressText?: string;
  weight?: number | null;
  width?: number | null;
  height?: number | null;
  length?: number | null;
  shippingTimeGuarantee?: string;
  skuShippingDetails?: AlibabaProductShippingDetail[];
  pkgSizeSource?: string | null;
  officialLength?: number | null;
  officialWidth?: number | null;
  officialHeight?: number | null;
  officialWeight?: number | null;
}

export interface AlibabaProductDetail {
  offerId?: number;
  categoryId?: number;
  subject?: string;
  subjectTrans?: string;
  description?: string;
  mainVideo?: string | null;
  detailVideo?: string | null;
  productImage?: {
    images?: string[];
  };
  productAttribute?: AlibabaProductAttribute[];
  productSkuInfos?: AlibabaProductSkuInfo[];
  productSaleInfo?: {
    amountOnSale?: number;
    unitInfo?: {
      unit?: string;
      transUnit?: string;
    };
  };
  productShippingInfo?: AlibabaProductShippingInfo;
  isJxhy?: boolean;
  sellerOpenId?: string;
  minOrderQuantity?: number;
  status?: string;
  sellerDataInfo?: AlibabaProductSellerDataInfo;
  soldOut?: string;
  tradeScore?: string;
  companyName?: string;
  promotionUrl?: string;
  // 其他字段按需添加
  isSelect?: string | boolean;
}

export interface AlibabaProductDetailResult {
  success?: boolean;
  code?: string;
  message?: string | null;
  result?: AlibabaProductDetail;
}

export interface AlibabaProductDetailResponse {
  result?: AlibabaProductDetailResult;
}
