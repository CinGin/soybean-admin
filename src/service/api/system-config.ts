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
/**
 * 界面密码验证
 * ✅ 修复：使用双重断言避免 TS 2352 类型错误
 */
export async function verifyPassword(password: string): Promise<{ code: number; msg?: string }> {
  const res = await request<any>({
    url: '/api/redis/config/verify-password',
    method: 'post',
    data: { password }
  });

  // 情况1: 直接返回 { code, msg, data }
  if (res && typeof res === 'object' && 'code' in res) {
    const result = res as unknown as { code: number; msg?: string };
    return { code: result.code, msg: result.msg };
  }

  // 情况2: 嵌套在 data 中 { data: { code, msg } }
  if (res?.data && typeof res.data === 'object' && 'code' in res.data) {
    const data = res.data as unknown as { code: number; msg?: string };
    return { code: data.code, msg: data.msg };
  }

  // 情况3: 嵌套在 response.data 中 (Soybean 拦截器包装)
  if (res?.response?.data && typeof res.response.data === 'object' && 'code' in res.response.data) {
    const data = res.response.data as unknown as { code: number; msg?: string };
    return { code: data.code, msg: data.msg };
  }

  // 情况4: 其他未知格式，默认返回错误
  console.warn('[verifyPassword] 无法解析响应:', res);
  return { code: 500, msg: '验证服务异常' };
}
