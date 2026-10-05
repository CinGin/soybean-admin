export interface OzonListingRecordVO {
  id: number;
  clientId?: string; // 新增
  productId: string;
  shopId: string;
  listingType: number;
  ozonTaskId: string;
  offerId: string;
  sourceSku: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  errorMsg: string | null;
  operator: string;
  createdAt: string;
  updatedAt: string;
  newProductId?: number | null;
  newSku?: number | null;
  stockSet?: number;
  stockWarehouseId?: string | null;
  stockUpdatedAt?: string | null;
  rebuildStatus?: string | null;
  rebuildTaskId?: string | null;
  rebuildOfferId?: string | null;
  rebuildNewProductId?: number | null;
  rebuildErrorMsg?: string | null;
  rebuildAttemptCount?: number | null;
  originalArchived?: boolean | null;
  originalDeleted?: boolean | null;
}

export interface OzonListingRecordQuery {
  pageNo?: number;
  pageSize?: number;
  productId?: string;
  listingType?: number;
  ozonTaskId?: string;
  offerId?: string;
  status?: string;
  operator?: string;
  newProductId?: string;
  startTime?: string;
  endTime?: string;
  sortField?: string;
  sortDir?: 'asc' | 'desc';
}

/** 属性值 */
export interface AttributeValueVO {
  dictionaryValueId: number;
  value: string;
}

/** 属性字段 */
export interface AttributeFieldVO {
  attrId: number;
  name: string;
  required: boolean;
  control: 'dict_select' | 'dict_multi' | 'text' | 'textarea' | 'text_multi' | 'boolean' | 'number';
  type: string;
  description?: string;
  values: AttributeValueVO[];
  dictionaryId?: number;
  maxValueCount?: number;
}

/** 属性分组 */
export interface AttributeGroupVO {
  groupName: string;
  fields: AttributeFieldVO[];
}

/** 重建商品数据（用于编辑弹窗） */
export interface RebuildDataVO {
  recordId: number;
  offerId: string;
  name: string;
  description: string | null;
  descriptionCategoryId: number;
  typeId: number;
  price: string;
  oldPrice: string | null;
  vat: string;
  currencyCode: string;
  depth: number;
  height: number;
  width: number;
  weight: number;
  dimensionUnit: string;
  weightUnit: string;
  images: string[];
  primaryImage: string | null;
  barcode: string | null;
  groups: AttributeGroupVO[];
  attributes: Array<{
    complex_id: number;
    id: number;
    values: Array<{ dictionary_value_id: number; value: string }>;
  }>;
  complexAttributes: Array<any>;
}

/** 手动二次重建命令 */
export interface ManualRebuildCommand {
  recordId: number;
  offerId?: string;
  name: string;
  description?: string;
  descriptionCategoryId: number;
  typeId: number;
  price: string;
  oldPrice?: string;
  vat?: string;
  currencyCode?: string;
  depth: number;
  height: number;
  width: number;
  weight: number;
  dimensionUnit: string;
  weightUnit: string;
  images: string[];
  primaryImage?: string;
  barcode?: string;
  attributes: RebuildDataVO['attributes'];
  complexAttributes?: RebuildDataVO['complexAttributes'];
  groups: AttributeGroupVO[]; // 移除问号，改为必填
}
/** 字典值请求参数 */
export interface AttributeValuesRequest {
  attributeId: number;
  descriptionCategoryId: number;
  typeId: number;
  language?: string;
  lastValueId?: number;
  limit?: number;
  clientId: string;
}

/** 字典值搜索结果 */
export interface SearchAttributeValuesRequest extends AttributeValuesRequest {
  value: string;
}

export interface PageResult<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
}
