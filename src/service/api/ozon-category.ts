// @/service/api/ozon-category.ts
import { request } from '@/service/request';

/**
 * 获取 Ozon 类目树
 */
export function fetchOzonCategoryTree() {
  return request({
    url: '/api/ozon/categories/tree',
    method: 'get'
  });
}
