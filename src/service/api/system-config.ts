import { request } from '@/service/request';
import type { SystemConfig } from '@/typings/api/system-config';

/**
 * 获取所有系统配置
 * ✅ 修复：使用 any 避免 TS 泛型误导运行时判断，兼容 Soybean 拦截器多种解包情况
 */
export async function getSystemConfigs(): Promise<SystemConfig[]> {
  // 注意：这里必须用 any，因为拦截器实际返回类型可能与泛型声明不一致
  const res = await request<any>({
    url: '/api/redis/config',
    method: 'get'
  });

  console.log('[SystemConfig] 原始响应:', JSON.parse(JSON.stringify(res)));

  // 情况1: 拦截器已完全解包，直接返回数组
  if (Array.isArray(res)) {
    return res;
  }

  // 情况2: 标准包装 { code, data: [...], msg }
  if (res?.data && Array.isArray(res.data)) {
    return res.data;
  }

  // 情况3: 拦截器未解包，仍是 AxiosResponse { data: { code, data: [...] } }
  if (res?.data?.data && Array.isArray(res.data.data)) {
    return res.data.data;
  }

  // 情况4: 非标准包装 { data: [...] } 无 code 字段
  if (res && typeof res === 'object' && !Array.isArray(res) && 'data' in res) {
    const inner = (res as Record<string, unknown>).data;
    if (Array.isArray(inner)) return inner;
  }

  console.warn('[SystemConfig] 无法解析响应，返回空数组。实际响应:', res);
  return [];
}

/** 批量更新配置 */
export function updateSystemConfigs(data: SystemConfig[]) {
  return request<void>({
    url: '/api/redis/config',
    method: 'put',
    data
  });
}

/** 添加动态参数 */
export function addDynamicParam(key: string, value: string) {
  return request<void>({
    url: '/api/redis/config/dynamic',
    method: 'post',
    params: { key, value }
  });
}

/** 删除动态参数 */
export function deleteDynamicParam(key: string) {
  return request<void>({
    url: `/api/redis/config/dynamic/${encodeURIComponent(key)}`,
    method: 'delete'
  });
}
