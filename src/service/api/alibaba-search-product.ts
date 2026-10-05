import { request } from '@/service/request';
import type { AlibabaProductSearchResponse, AlibabaProductDetailResponse } from '@/typings/api/alibaba-search-product';

/**
 * 多语言关键词搜索商品
 * @param keyword 搜索关键词
 * @param page 页码（从1开始）
 * @param pageSize 每页数量
 */
export function fetchAlibabaProductSearch(keyword: string, page: number, pageSize: number) {
  return request<AlibabaProductSearchResponse>({
    url: '/api/alibaba/product/search',
    method: 'get',
    params: { keyword, page, pageSize }
  });
}

/**
 * 多语言图搜（上传图片文件）
 * @param file 图片文件
 * @param page 页码（从1开始）
 * @param pageSize 每页数量
 * @param country 语言，默认 en
 */
export function fetchAlibabaProductSearchByImage(file: File, page = 1, pageSize = 20, country = 'en') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('beginPage', String(page));
  formData.append('pageSize', String(pageSize));
  formData.append('country', country);
  return request<AlibabaProductSearchResponse>({
    url: '/api/alibaba/product/search-by-image',
    method: 'post',
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' }
  });
}
/**
 * 查询商品详情（多语言商详）
 * @param offerId 商品ID
 */
export function fetchAlibabaProductDetail(offerId: number) {
  return request<AlibabaProductDetailResponse>({
    url: `/api/alibaba/product/detail/${offerId}`,
    method: 'get'
  });
}
