import { request } from '../request';

/**
 * 获取产品列表（分页+多条件）
 */
export function fetchProductList(params: Api.Product.ProductSearchParams) {
  return request<Api.Product.ProductPageResult>({
    url: '/products',
    method: 'get',
    params: params as any
  });
}
