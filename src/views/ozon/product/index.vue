<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, h } from 'vue';
import { useLoading } from '@sa/hooks';
import {
  useMessage,
  NButton,
  NTag,
  NDataTable,
  NCard,
  NInput,
  NSelect,
  NRadioGroup,
  NRadioButton,
  NDescriptions,
  NDescriptionsItem,
  NModal,
  NCollapseTransition,
  NTreeSelect
} from 'naive-ui';
import { fetchOzonProducts, type OzonProductVO, type OzonProductQuery } from '@/service/api/ozon-product';
import { fetchOzonCategoryTree } from '@/service/api/ozon-category';

defineOptions({ name: 'OzonProductList' });

const message = useMessage();
const { loading, startLoading, endLoading } = useLoading();

// ========== 数据状态 ==========
const productList = ref<OzonProductVO[]>([]);
const total = ref(0);

interface StatCard {
  label: string;
  value: string;
  icon: string;
  bg: string;
  color: string;
}
const statCards = ref<StatCard[]>([
  { label: '商品总数', value: '0', icon: 'ph:package', bg: 'from-[#667eea] to-[#764ba2]', color: '' },
  { label: '本页订购总量', value: '0 件', icon: 'ph:shopping-cart', bg: 'from-[#f093fb] to-[#f5576c]', color: '' },
  { label: '本页销售额', value: '₽0', icon: 'ph:currency-rub', bg: 'from-[#4facfe] to-[#00f2fe]', color: '' },
  { label: '平均增长率', value: '0%', icon: 'ph:trend-up', bg: 'from-[#43e97b] to-[#38f9d7]', color: '#909399' }
]);

// ========== 搜索参数 ==========
const searchParams = reactive<OzonProductQuery>({
  page: 1,
  size: 20,
  keyword: '',
  name: '',
  brand: '',
  category1: '',
  sellerName: '',
  sortField: 't1.id',
  sortDir: 'desc'
});

const expanded = ref(false);
const detailVisible = ref(false);
const currentProduct = ref<OzonProductVO | null>(null);

// ★ 类目树相关
const categoryTree = ref<any[]>([]);
const selectedCategoryIds = ref<string[]>([]);

// ========== 请求取消与组件卸载标志 ==========
let abortController: AbortController | null = null;
let isUnmounted = false;

// ========== 加载数据 ==========
async function loadData(params: OzonProductQuery = {}) {
  if (abortController) {
    abortController.abort();
  }
  abortController = new AbortController();

  startLoading();
  try {
    const queryParams: OzonProductQuery = {
      ...params,
      page: searchParams.page,
      size: searchParams.size,
      sortField: params.sortField || searchParams.sortField || 't1.id',
      sortDir: params.sortDir || searchParams.sortDir || 'desc'
    };
    const { data, error } = await fetchOzonProducts(queryParams, abortController.signal);
    if (isUnmounted) return;
    if (!error && data) {
      productList.value = data.records || [];
      total.value = data.total || 0;
    } else {
      productList.value = [];
      total.value = 0;
    }
    computeLocalStats();
  } catch (e: any) {
    if (isUnmounted) return;
    if (e.name === 'AbortError' || e.code === 'ERR_CANCELED') return;
    message.error('加载数据失败，请稍后重试');
  } finally {
    if (!isUnmounted) endLoading();
  }
}

// ========== 本地统计 ==========
function computeLocalStats() {
  const list = productList.value;
  const totalCount = total.value;
  const totalSoldCount = list.reduce((s, p) => s + (p.latestSoldCount || 0), 0);
  const totalSoldSum = list.reduce((s, p) => s + (p.soldSum || 0), 0);
  const gs = list
    .map(p => (p.growthRate !== null && p.growthRate !== undefined ? Number(p.growthRate) : NaN))
    .filter(n => !isNaN(n));
  const avgGrowth = gs.length > 0 ? Math.round((gs.reduce((a, b) => a + b, 0) / gs.length) * 100) / 100 : 0;

  statCards.value[0].value = totalCount.toLocaleString('ru-RU');
  statCards.value[1].value = `${totalSoldCount.toLocaleString('ru-RU')} 件`;
  statCards.value[2].value = formatPrice(totalSoldSum);
  statCards.value[3].value = `${avgGrowth > 0 ? '+' : ''}${avgGrowth.toFixed(1)}%`;
  statCards.value[3].color = getGrowthColor(avgGrowth);
}

// ========== 搜索/重置/分页/排序 ==========
function handleSearch() {
  // ★ 将选中的类目 ID 转换为名称（取第一个）
  if (selectedCategoryIds.value.length > 0) {
    const names = findCategoryNames(selectedCategoryIds.value, categoryTree.value);
    searchParams.category1 = names[0] || '';
  } else {
    searchParams.category1 = '';
  }
  searchParams.page = 1;
  loadData({ ...searchParams });
}

function handleReset() {
  selectedCategoryIds.value = [];
  searchParams.keyword = '';
  searchParams.name = '';
  searchParams.brand = '';
  searchParams.category1 = '';
  searchParams.sellerName = '';
  searchParams.page = 1;
  searchParams.size = 20;
  searchParams.sortField = 't1.id';
  searchParams.sortDir = 'desc';
  loadData({ ...searchParams });
}

function handlePageChange(page: number) {
  searchParams.page = page;
  loadData({ ...searchParams });
}
function handlePageSizeChange(size: number) {
  searchParams.size = size;
  searchParams.page = 1;
  loadData({ ...searchParams });
}

function handleSorterChange(sorter: { columnKey: string; order: 'ascend' | 'descend' | false }) {
  let sortField = 't1.id';
  let sortDir = 'desc';
  if (sorter.order) {
    const m: Record<string, string> = {
      name: 't1.name',
      soldSum: 't1.sold_sum',
      latestSoldCount: 't1.sold_count',
      growthRate: 'growthRate',
      salesDynamics: 'salesDynamics'
    };
    sortField = m[sorter.columnKey] || 't1.id';
    sortDir = sorter.order === 'ascend' ? 'asc' : 'desc';
  }
  if (sortField === searchParams.sortField && sortDir === searchParams.sortDir) return;
  searchParams.sortField = sortField;
  searchParams.sortDir = sortDir;
  loadData({ ...searchParams });
}

// ========== 详情/链接/刷新 ==========
function handleViewDetail(row: OzonProductVO) {
  currentProduct.value = row;
  detailVisible.value = true;
}
function handleCloseDetail(val: boolean) {
  detailVisible.value = false;
  if (!val) currentProduct.value = null;
}
function handleOpenLink(url: string) {
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}
function handleRefresh() {
  loadData({ ...searchParams });
}
function toggleExpand() {
  expanded.value = !expanded.value;
}

// ========== 格式化工具 ==========
function formatPrice(v: number | null | undefined): string {
  if (v == null) return '—';
  return `₽${Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`;
}
function formatSoldCount(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toLocaleString('ru-RU');
}

function formatPercent(v: string | number | null | undefined): { text: string; color: string; bg: string } {
  const num = v !== null && v !== undefined ? Number(v) : NaN;
  if (isNaN(num)) return { text: '—', color: '#909399', bg: 'rgba(144,147,153,0.1)' };
  const sign = num > 0 ? '+' : '';
  const color = num > 0 ? '#67c23a' : num < 0 ? '#f56c6c' : '#909399';
  const bg = num > 0 ? 'rgba(103,194,58,0.1)' : num < 0 ? 'rgba(245,108,108,0.1)' : 'rgba(144,147,153,0.1)';
  return { text: `${sign}${num.toFixed(1)}%`, color, bg };
}

function priceTagType(p: number | null | undefined): 'success' | 'warning' | 'error' | 'default' {
  if (p == null) return 'default';
  if (p < 1000) return 'success';
  if (p < 10000) return 'warning';
  return 'error';
}
function getGrowthColor(v: string | number | null | undefined): string {
  const num = v !== null && v !== undefined ? Number(v) : NaN;
  if (isNaN(num)) return '#909399';
  if (num > 0) return '#67c23a';
  if (num < 0) return '#f56c6c';
  return '#909399';
}

// ========== 图片加载错误处理 ==========
function handleImgError(e: Event) {
  (e.target as HTMLImageElement).style.display = 'none';
}

// ========== 复制功能 ==========
async function copyText(text: string) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    message.success(`已复制: ${text}`);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      message.success(`已复制: ${text}`);
    } catch {
      message.error('复制失败');
    }
    document.body.removeChild(ta);
  }
}

// ★ 复制按钮工厂
function makeCopyBtn(text: string, label: string) {
  return h(
    NButton,
    {
      quaternary: true,
      size: 'tiny',
      type: 'primary',
      title: `复制${label}`,
      class: 'copy-btn',
      style: 'padding:0 4px;flex-shrink:0;width:22px;height:22px;',
      onClick: (e: MouseEvent) => {
        e.stopPropagation();
        copyText(text);
      }
    },
    {
      icon: () => h('SvgIcon', { icon: 'ph:copy', style: 'font-size:14px;' })
    }
  );
}

// ★★★ 修复后的类目树加载函数（已去除 mock）★★★
async function loadCategoryTree() {
  try {
    const response = await fetchOzonCategoryTree();
    console.log('类目树原始响应:', response);
    // 从响应中提取树形数据，假设 response.data 是数组
    const rawData = response.data;
    if (Array.isArray(rawData) && rawData.length > 0) {
      categoryTree.value = mapTreeFields(rawData);
      console.log('类目树加载成功，根节点数:', categoryTree.value.length);
    } else {
      // 数据为空时，清空树并给出提示
      categoryTree.value = [];
      console.warn('类目树数据为空');
      message.warning('类目树数据为空，请检查后端数据');
    }
  } catch (e) {
    console.error('加载类目树失败:', e);
    categoryTree.value = [];
    message.error('加载类目树失败，请检查后端接口');
  }
}

// ★ 将后端树形结构（categoryId, name, children）映射为 NTreeSelect 所需格式（key, label, children）
function mapTreeFields(nodes: any[]): any[] {
  return nodes.map((node: any) => ({
    key: node.categoryId,
    label: node.name,
    children: node.children && node.children.length > 0 ? mapTreeFields(node.children) : []
  }));
}

// ★ 递归查找类目名称（基于 key/label/children 格式）
function findCategoryNames(ids: string[], nodes: any[]): string[] {
  const names: string[] = [];
  for (const node of nodes) {
    if (ids.includes(node.key)) {
      names.push(node.label);
    }
    if (node.children && node.children.length > 0) {
      names.push(...findCategoryNames(ids, node.children));
    }
  }
  return names;
}

// ========== 表格列定义 ==========
const columns = computed(() => [
  // ★ 商品列
  {
    title: '商品',
    key: 'name',
    width: 380,
    sorter: true,
    render: (row: OzonProductVO) => {
      const children: any[] = [];

      // 缩略图
      if (row.photo) {
        children.push(
          h('img', {
            src: row.photo,
            alt: row.name || '',
            class: 'w-60px h-60px object-contain rounded-6px border border-gray-200 flex-shrink-0 bg-gray-50',
            onerror: handleImgError
          })
        );
      } else {
        children.push(
          h('div', { class: 'w-60px h-60px flex items-center justify-center bg-gray-100 rounded-6px flex-shrink-0' }, [
            h('SvgIcon', { icon: 'ph:package', style: 'font-size:22px;color:#c0c4cc;' })
          ])
        );
      }

      const infoChildren: any[] = [
        h(
          'div',
          {
            class: 'font-medium text-gray-800 break-all',
            style: 'max-width:260px;',
            title: row.name || ''
          },
          row.name || '—'
        )
      ];

      if (row.brand) {
        infoChildren.push(
          h('div', { class: 'flex items-center gap-4px text-11px flex-wrap' }, [
            h('span', { class: 'text-gray-400 whitespace-nowrap flex-shrink-0' }, '品牌:'),
            h('span', { class: 'text-gray-700 break-all' }, row.brand),
            makeCopyBtn(row.brand, '复制')
          ])
        );
      }
      if (row.sellerName) {
        infoChildren.push(
          h('div', { class: 'flex items-center gap-4px text-11px flex-wrap' }, [
            h('span', { class: 'text-gray-400 whitespace-nowrap flex-shrink-0' }, '卖家:'),
            h('span', { class: 'text-gray-700 break-all' }, row.sellerName),
            makeCopyBtn(row.sellerName, '复制')
          ])
        );
      }
      if (row.article) {
        infoChildren.push(
          h('div', { class: 'flex items-center gap-4px text-11px flex-wrap' }, [
            h('span', { class: 'text-gray-400 whitespace-nowrap flex-shrink-0' }, '货号:'),
            h('span', { class: 'text-gray-700 break-all' }, row.article),
            makeCopyBtn(row.article, '复制')
          ])
        );
      }

      children.push(h('div', { class: 'flex flex-col gap-2px min-w-0 flex-1' }, infoChildren));
      return h('div', { class: 'flex items-start gap-8px' }, children);
    }
  },
  {
    title: '类目',
    key: 'category1',
    width: 130,
    ellipsis: { tooltip: true },
    render: (row: OzonProductVO) => {
      const items: any[] = [h('div', { class: 'font-medium text-gray-800' }, row.category1 || '—')];
      if (row.category2) items.push(h('div', { class: 'text-11px text-gray-500' }, row.category2));
      if (row.category3) items.push(h('div', { class: 'text-11px text-gray-400' }, row.category3));
      return h('div', { class: 'flex flex-col gap-1px' }, items);
    }
  },
  {
    title: '商品特征',
    key: 'binStatus',
    width: 88,
    align: 'center' as const,
    render: (row: OzonProductVO) => {
      if (!row.binStatus) return h('span', { class: 'text-gray-300' }, '—');
      const map: Record<string, { color: string; bg: string; label: string }> = {
        leader: { color: '#fff', bg: 'linear-gradient(135deg,#f093fb,#f5576c)', label: '🔥 Leader' },
        top_50: { color: '#fff', bg: 'linear-gradient(135deg,#667eea,#764ba2)', label: '⭐ Top50' },
        NoStatus: { color: '#909399', bg: '#f4f4f5', label: '普通' }
      };
      const s = map[row.binStatus] || { color: '#303133', bg: '#e8e8e8', label: row.binStatus };
      return h(
        'NTag',
        { size: 'small', round: true, style: `color:${s.color};background:${s.bg};border:none;font-weight:600;` },
        { default: () => s.label }
      );
    }
  },
  {
    title: '订购金额',
    key: 'soldSum',
    width: 120,
    align: 'right' as const,
    sorter: true,
    render: (row: OzonProductVO) => {
      if (row.soldSum == null) return h('span', { class: 'text-gray-300' }, '—');
      return h(
        'NTag',
        { size: 'small', type: priceTagType(row.soldSum), round: true, style: 'font-weight:600;font-size:13px;' },
        { default: () => formatPrice(row.soldSum) }
      );
    }
  },
  {
    title: '已订购数量',
    key: 'latestSoldCount',
    width: 112,
    align: 'right' as const,
    sorter: true,
    render: (row: OzonProductVO) => {
      const cur = row.latestSoldCount,
        prev = row.previousSoldCount;
      if (cur == null) return h('span', { class: 'text-gray-300' }, '—');
      const items: any[] = [h('div', { class: 'font-semibold text-gray-800 text-13px' }, formatSoldCount(cur))];
      if (prev != null) items.push(h('div', { class: 'text-11px text-gray-400' }, `上期:${formatSoldCount(prev)}`));
      return h('div', { class: 'flex flex-col items-end gap-1px' }, items);
    }
  },
  {
    title: '上期销量',
    key: 'previousSoldCount',
    width: 86,
    align: 'right' as const,
    sorter: true,
    render: (row: OzonProductVO) => {
      if (row.previousSoldCount == null) return h('span', { class: 'text-gray-300' }, '—');
      return h('span', { class: 'font-medium text-gray-700' }, formatSoldCount(row.previousSoldCount));
    }
  },
  {
    title: '增长率',
    key: 'growthRate',
    width: 96,
    align: 'center' as const,
    sorter: true,
    render: (row: OzonProductVO) => {
      const p = formatPercent(row.growthRate);
      if (p.text === '—') return h('span', { class: 'text-gray-300' }, '—');
      const num = Number(row.growthRate);
      return h(
        'div',
        {
          class: 'inline-flex items-center gap-2px px-6px py-2px rounded-4px font-bold text-12px',
          style: `color:${p.color};background:${p.bg};`
        },
        [h('span', { class: 'text-9px' }, num > 0 ? '▲' : '▼'), h('span', null, p.text)]
      );
    }
  },
  {
    title: '动态',
    key: 'salesDynamics',
    width: 96,
    align: 'center' as const,
    sorter: true,
    render: (row: OzonProductVO) => {
      const p = formatPercent(row.salesDynamics);
      if (p.text === '—') return h('span', { class: 'text-gray-300' }, '—');
      const num = Number(row.salesDynamics);
      return h(
        'div',
        {
          class: 'inline-flex items-center gap-2px px-6px py-2px rounded-4px font-bold text-12px',
          style: `color:${p.color};background:${p.bg};`
        },
        [h('span', { class: 'text-9px' }, num > 0 ? '▲' : '▼'), h('span', null, p.text)]
      );
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 76,
    align: 'center' as const,
    fixed: 'right' as const,
    render: (row: OzonProductVO) => {
      return h(
        NButton,
        { size: 'small', type: 'primary', ghost: true, onClick: () => handleViewDetail(row) },
        { default: () => '详情', icon: () => h('SvgIcon', { icon: 'ph:eye' }) }
      );
    }
  }
]);

// ★ 在 onMounted 中加载类目树和数据
onMounted(() => {
  loadCategoryTree();
  loadData({ ...searchParams });
});

// ★ 组件卸载时取消未完成的请求
onBeforeUnmount(() => {
  isUnmounted = true;
  if (abortController) {
    abortController.abort();
  }
});
</script>

<template>
  <div class="p-16px">
    <!-- 搜索卡片 -->
    <NCard :bordered="false" class="rounded-12px shadow-sm mb-16px" size="small">
      <div class="grid grid-cols-12 gap-x-16px gap-y-12px items-start">
        <div class="col-span-4">
          <div class="flex items-center gap-8px">
            <span class="text-13px text-gray-500 whitespace-nowrap" style="min-width: 65px">全局搜索</span>
            <NInput
              v-model:value="searchParams.keyword"
              placeholder="搜索商品名称/品牌/货号/卖家"
              clearable
              @keydown.enter="handleSearch"
            >
              <template #prefix><SvgIcon icon="ph:magnifying-glass" /></template>
            </NInput>
          </div>
        </div>
        <div class="col-span-2">
          <div class="flex items-center gap-8px">
            <span class="text-13px text-gray-500 whitespace-nowrap" style="min-width: 40px">品牌</span>
            <NInput v-model:value="searchParams.brand" placeholder="品牌" clearable @keydown.enter="handleSearch" />
          </div>
        </div>
        <!-- ★ 类目选择器 -->
        <div class="col-span-2">
          <div class="flex items-center gap-8px">
            <span class="text-13px text-gray-500 whitespace-nowrap" style="min-width: 40px">类目</span>
            <NTreeSelect
              v-model:value="selectedCategoryIds"
              :options="categoryTree"
              multiple
              checkable
              cascade
              filterable
              placeholder="选择类目（可搜索）"
              clearable
              style="width: 100%"
              :consistent-menu-width="false"
              :max-tag-count="1"
              :ellipsis="true"
            />
          </div>
        </div>
        <div class="col-span-4 flex items-center justify-end gap-8px">
          <NButton type="primary" :loading="loading" :disabled="loading" @click="handleSearch">
            <template #icon><SvgIcon icon="ph:magnifying-glass" /></template>
            搜索
          </NButton>
          <NButton :disabled="loading" @click="handleReset">
            <template #icon><SvgIcon icon="ph:arrow-counter-clockwise" /></template>
            重置
          </NButton>
          <NButton text type="primary" @click="toggleExpand">
            {{ expanded ? '收起' : '展开' }}
            <SvgIcon :icon="expanded ? 'ph:caret-up' : 'ph:caret-down'" class="ml-2" />
          </NButton>
        </div>
      </div>

      <NCollapseTransition :show="expanded">
        <div class="grid grid-cols-12 gap-x-16px gap-y-12px mt-12px pt-12px border-t border-dashed border-gray-200">
          <div class="col-span-3">
            <div class="flex items-center gap-8px">
              <span class="text-13px text-gray-500 whitespace-nowrap" style="min-width: 65px">商品名称</span>
              <NInput
                v-model:value="searchParams.name"
                placeholder="精确匹配名称"
                clearable
                @keydown.enter="handleSearch"
              />
            </div>
          </div>
          <div class="col-span-3">
            <div class="flex items-center gap-8px">
              <span class="text-13px text-gray-500 whitespace-nowrap" style="min-width: 65px">卖家名称</span>
              <NInput
                v-model:value="searchParams.sellerName"
                placeholder="卖家名称"
                clearable
                @keydown.enter="handleSearch"
              />
            </div>
          </div>
          <div class="col-span-3">
            <div class="flex items-center gap-8px">
              <span class="text-13px text-gray-500 whitespace-nowrap" style="min-width: 65px">排序字段</span>
              <NSelect
                v-model:value="searchParams.sortField"
                :options="[
                  { label: '默认', value: 't1.id' },
                  { label: '订购金额', value: 't1.sold_sum' },
                  { label: '订购数量', value: 't1.sold_count' },
                  { label: '商品名称', value: 't1.name' },
                  { label: '动态', value: 'salesDynamics' },
                  { label: '增长率', value: 'growthRate' }
                ]"
              />
            </div>
          </div>
          <div class="col-span-3">
            <div class="flex items-center gap-8px">
              <span class="text-13px text-gray-500 whitespace-nowrap" style="min-width: 40px">方向</span>
              <NRadioGroup v-model:value="searchParams.sortDir" class="flex" style="width: 180px">
                <NRadioButton
                  value="asc"
                  style="
                    flex: 1;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 2px;
                  "
                >
                  <SvgIcon icon="ph:sort-ascending" style="font-size: 12px; flex-shrink: 0" />
                  升序
                </NRadioButton>
                <NRadioButton
                  value="desc"
                  style="
                    flex: 1;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 2px;
                  "
                >
                  <SvgIcon icon="ph:sort-descending" style="font-size: 12px; flex-shrink: 0" />
                  降序
                </NRadioButton>
              </NRadioGroup>
            </div>
          </div>
        </div>
      </NCollapseTransition>
    </NCard>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-4 gap-16px mb-16px">
      <NCard
        v-for="(card, index) in statCards"
        :key="index"
        :bordered="false"
        class="rounded-12px shadow-sm transition-transform hover:-translate-y-2px"
        size="small"
      >
        <div class="flex items-center gap-14px p-6px">
          <div
            class="flex items-center justify-center w-46px h-46px rounded-12px text-white bg-gradient-to-r flex-shrink-0"
            :class="[card.bg]"
          >
            <SvgIcon :icon="card.icon" :font-size="22" />
          </div>
          <div class="flex flex-col gap-2px">
            <span class="text-12px text-gray-400">{{ card.label }}</span>
            <span class="text-20px font-bold" :style="card.color ? { color: card.color } : {}">{{ card.value }}</span>
          </div>
        </div>
      </NCard>
    </div>

    <!-- 数据表格 -->
    <NCard :bordered="false" class="rounded-12px shadow-sm" size="small">
      <template #header>
        <div class="flex items-center justify-between w-full">
          <span class="flex items-center gap-8px text-16px font-semibold text-gray-800">
            <SvgIcon icon="ph:list-bullets" class="text-18px text-[#667eea]" />
            Ozon 商品明细
          </span>
          <NButton size="small" :disabled="loading" @click="handleRefresh">
            <template #icon><SvgIcon icon="ph:arrows-clockwise" /></template>
            刷新
          </NButton>
        </div>
      </template>
      <NDataTable
        :columns="columns"
        :data="productList"
        :loading="loading"
        :pagination="{
          page: searchParams.page,
          pageSize: searchParams.size,
          itemCount: total,
          showSizePicker: true,
          pageSizes: [10, 20, 50, 100],
          onUpdatePage: handlePageChange,
          onUpdatePageSize: handlePageSizeChange
        }"
        :remote="true"
        :scroll-x="1400"
        striped
        hoverable
        @update:sorter="handleSorterChange"
      />
    </NCard>

    <!-- 详情弹窗 -->
    <NModal
      v-model:show="detailVisible"
      preset="card"
      :title="currentProduct?.name || '商品详情'"
      style="max-width: 540px; width: 90%"
      :bordered="false"
      :mask-closable="true"
      @update:show="handleCloseDetail"
    >
      <template v-if="currentProduct">
        <div class="space-y-16px">
          <div class="flex justify-center p-16px bg-gradient-to-br from-gray-50 to-gray-100 rounded-12px">
            <img
              v-if="currentProduct.photo"
              :src="currentProduct.photo"
              :alt="currentProduct.name"
              class="max-w-full max-h-200px object-contain rounded-8px"
              @error="handleImgError"
            />
            <div v-else class="w-full h-160px flex items-center justify-center text-gray-300">
              <SvgIcon icon="ph:package" :font-size="48" />
            </div>
          </div>
          <div class="text-18px font-bold text-gray-800 text-center leading-relaxed">
            {{ currentProduct.name || '—' }}
          </div>

          <NDescriptions :column="1" bordered size="small" label-placement="left">
            <NDescriptionsItem label="变体ID">
              <NTag size="small">{{ currentProduct.variantId || '—' }}</NTag>
            </NDescriptionsItem>
            <NDescriptionsItem label="SKU">{{ currentProduct.sku || '—' }}</NDescriptionsItem>
            <NDescriptionsItem label="品牌">
              <NTag size="small" type="info" round>{{ currentProduct.brand || '—' }}</NTag>
            </NDescriptionsItem>
            <NDescriptionsItem label="货号">
              <div class="flex items-center gap-6px flex-wrap">
                <span class="text-gray-700 break-all">{{ currentProduct.article || '—' }}</span>
                <NButton
                  v-if="currentProduct.article"
                  text
                  size="tiny"
                  type="primary"
                  title="复制货号"
                  @click.stop="copyText(currentProduct.article!)"
                >
                  <template #icon><SvgIcon icon="ph:copy" /></template>
                  复制
                </NButton>
              </div>
            </NDescriptionsItem>
            <NDescriptionsItem label="类目">
              <span>{{ currentProduct.category1 || '—' }}</span>
              <template v-if="currentProduct.category2">› {{ currentProduct.category2 }}</template>
              <template v-if="currentProduct.category3">› {{ currentProduct.category3 }}</template>
            </NDescriptionsItem>
            <NDescriptionsItem label="卖家">
              {{ currentProduct.sellerName || '—' }}
              <span v-if="currentProduct.sellerId" class="text-12px text-gray-400 ml-4px">
                (ID:{{ currentProduct.sellerId }})
              </span>
            </NDescriptionsItem>
            <NDescriptionsItem label="销售模式">
              <NTag v-if="currentProduct.salesSchema" size="small" type="primary" round>
                {{ currentProduct.salesSchema }}
              </NTag>
              <span v-else>—</span>
            </NDescriptionsItem>
            <NDescriptionsItem label="商品特征">
              <NTag v-if="currentProduct.binStatus" size="small" type="warning" round>
                {{ currentProduct.binStatus }}
              </NTag>
              <span v-else>—</span>
            </NDescriptionsItem>
            <NDescriptionsItem label="订购金额">
              <span class="text-16px font-bold text-red-500">{{ formatPrice(currentProduct.soldSum) }}</span>
            </NDescriptionsItem>
            <NDescriptionsItem label="最新期销量">
              {{ formatSoldCount(currentProduct.latestSoldCount) }}
            </NDescriptionsItem>
            <NDescriptionsItem label="上期权销量">
              {{ formatSoldCount(currentProduct.previousSoldCount) }}
            </NDescriptionsItem>
            <NDescriptionsItem label="动态">
              <span
                v-if="currentProduct.salesDynamics != null"
                class="font-semibold"
                :style="{ color: formatPercent(currentProduct.salesDynamics).color }"
              >
                {{ Number(currentProduct.salesDynamics) > 0 ? '▲ +' : '▼ '
                }}{{ Number(currentProduct.salesDynamics).toFixed(1) }}%
              </span>
              <span v-else class="text-gray-300">—</span>
            </NDescriptionsItem>
            <NDescriptionsItem label="增长率">
              <span
                v-if="currentProduct.growthRate != null"
                class="font-semibold"
                :style="{ color: formatPercent(currentProduct.growthRate).color }"
              >
                {{ Number(currentProduct.growthRate) > 0 ? '▲ +' : '▼ '
                }}{{ Number(currentProduct.growthRate).toFixed(1) }}%
              </span>
              <span v-else class="text-gray-300">—</span>
            </NDescriptionsItem>
            <NDescriptionsItem label="更新时间">{{ currentProduct.updateDate || '—' }}</NDescriptionsItem>
          </NDescriptions>

          <div class="pt-4px">
            <NButton v-if="currentProduct.link" type="primary" block @click="handleOpenLink(currentProduct.link!)">
              <template #icon><SvgIcon icon="ph:link" /></template>
              在 Ozon 中查看
            </NButton>
          </div>
        </div>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
/* 确保表格内的复制按钮图标始终可见 */
:global(.copy-btn) {
  color: #9ca3af !important;
  transition: color 0.2s;
}
:global(.copy-btn:hover) {
  color: #3b82f6 !important;
}
/* 防止 NButton quaternary 在表格单元格中被意外隐藏 */
:global(td .n-button.copy-btn) {
  display: inline-flex !important;
  visibility: visible !important;
}
</style>
