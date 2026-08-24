<script setup lang="ts">
import { ref, reactive, computed, onMounted, h, resolveComponent } from 'vue';
import { useLoading } from '@sa/hooks';
import {
  useMessage,
  NCard,
  NInput,
  NInputNumber,
  NSelect,
  NButton,
  NTag,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NDrawer,
  NDrawerContent
} from 'naive-ui';
import { fetchOzonSearchQueries, type OzonSearchQueryVO, type OzonSearchQueryParams } from '@/service/api/ozon-search';

defineOptions({ name: 'OzonSearchTrending' });

// ✅ 修复：通过 resolveComponent 获取全局注册的 SvgIcon 组件引用，供 h() 渲染函数使用
const SvgIconComp = resolveComponent('SvgIcon');

const message = useMessage();
const { loading, startLoading, endLoading } = useLoading();

// ========== 数据状态 ==========
const searchQueries = ref<OzonSearchQueryVO[]>([]);
const total = ref(0);
const detailVisible = ref(false);
const currentItem = ref<OzonSearchQueryVO | null>(null);

// ========== 统计卡片 ==========
const statCards = computed(() => {
  const list = searchQueries.value;
  const totalCount = total.value;
  const totalSearches = list.reduce((s: number, p: OzonSearchQueryVO) => s + (p.count || 0), 0);
  const totalGmv = list.reduce((s: number, p: OzonSearchQueryVO) => s + (p.gmv || 0), 0);
  const avgCa =
    list.length > 0 ? list.reduce((s: number, p: OzonSearchQueryVO) => s + (p.ca || 0), 0) / list.length : 0;

  return [
    {
      label: '总搜索词数',
      value: totalCount.toLocaleString('ru-RU'),
      icon: 'ph:hash',
      bg: 'linear-gradient(135deg,#667eea,#764ba2)',
      color: ''
    },
    {
      label: '本页搜索总量',
      value: totalSearches.toLocaleString('ru-RU'),
      icon: 'ph:eye',
      bg: 'linear-gradient(135deg,#4facfe,#00f2fe)',
      color: ''
    },
    {
      label: '本页GMV合计',
      value: `₽${formatPriceShort(totalGmv)}`,
      icon: 'ph:currency-rub',
      bg: 'linear-gradient(135deg,#f093fb,#f5576c)',
      color: ''
    },
    {
      label: '平均转化率',
      value: `${avgCa.toFixed(2)}%`,
      icon: 'ph:trend-up',
      bg: 'linear-gradient(135deg,#43e97b,#38f9d7)',
      color: avgCa > 10 ? '#67c23a' : avgCa > 5 ? '#e6a23c' : '#f56c6c'
    }
  ];
});

// ========== 搜索参数 ==========
const searchParams = reactive<OzonSearchQueryParams>({
  page: 1,
  size: 20,
  keyword: '',
  minCount: undefined,
  maxCount: undefined,
  minCa: undefined,
  minGmv: undefined,
  sortField: 'count',
  sortDir: 'desc'
});

const sortFieldOptions = [
  { label: '搜索次数', value: 'count' },
  { label: '转化率', value: 'ca' },
  { label: 'GMV', value: 'gmv' },
  { label: '订单数', value: 'ord' },
  { label: '客单价', value: 'avg_ca_rub' },
  { label: '浏览量', value: 'items_views' },
  { label: '卖家数', value: 'uniq_sellers' },
  { label: 'ZR计数', value: 'zr_count' },
  { label: '更新时间', value: 'created_at' }
];

// ========== 分页配置 ==========
const paginationConfig = computed(() => ({
  page: searchParams.page ?? 1,
  pageSize: searchParams.size ?? 20,
  itemCount: total.value,
  showSizePicker: true,
  pageSizes: [10, 20, 50, 100]
}));

// ========== 加载数据 ==========
async function loadData() {
  startLoading();
  try {
    const params: OzonSearchQueryParams = {
      page: searchParams.page ?? 1,
      size: searchParams.size ?? 20,
      keyword: searchParams.keyword || undefined,
      minCount: searchParams.minCount,
      maxCount: searchParams.maxCount,
      minCa: searchParams.minCa,
      minGmv: searchParams.minGmv,
      sortField: searchParams.sortField || 'count',
      sortDir: searchParams.sortDir || 'desc'
    };
    const { data, error } = await fetchOzonSearchQueries(params);
    if (!error && data) {
      searchQueries.value = data.records || [];
      total.value = data.total || 0;
    } else {
      searchQueries.value = [];
      total.value = 0;
    }
  } catch {
    message.error('加载热搜词数据失败');
    searchQueries.value = [];
    total.value = 0;
  } finally {
    endLoading();
  }
}

// ========== 事件处理 ==========
function handleSearch() {
  searchParams.page = 1;
  loadData();
}
function handleReset() {
  Object.assign(searchParams, {
    keyword: '',
    minCount: undefined,
    maxCount: undefined,
    minCa: undefined,
    minGmv: undefined,
    sortField: 'count',
    sortDir: 'desc',
    page: 1
  });
  loadData();
}
function handleRefresh() {
  loadData();
}
function handlePageChange(page: number) {
  searchParams.page = page;
  loadData();
}
function handlePageSizeChange(size: number) {
  searchParams.size = size;
  searchParams.page = 1;
  loadData();
}

function handleSorterChange(sorter: { columnKey: string; order: 'ascend' | 'descend' | false }) {
  if (!sorter.order) {
    searchParams.sortField = 'count';
    searchParams.sortDir = 'desc';
  } else {
    const map: Record<string, string> = {
      count: 'count',
      ca: 'ca',
      gmv: 'gmv',
      ord: 'ord',
      avgCaRub: 'avg_ca_rub',
      itemsViews: 'items_views',
      uniqSellers: 'uniq_sellers',
      zrCount: 'zr_count'
    };
    searchParams.sortField = map[sorter.columnKey] || 'count';
    searchParams.sortDir = sorter.order === 'ascend' ? 'asc' : 'desc';
  }
  loadData();
}

function handleWordClick(item: OzonSearchQueryVO) {
  currentItem.value = item;
  detailVisible.value = true;
}

// ========== 词云样式 ==========
function getWordStyle(item: OzonSearchQueryVO, idx: number): Record<string, string> {
  const counts = searchQueries.value.map(q => q.count || 0);
  const maxCount = counts.length > 0 ? Math.max(...counts) : 1;
  const minCount = counts.length > 0 ? Math.min(...counts) : 0;
  const range = maxCount - minCount || 1;
  const ratio = ((item.count || 0) - minCount) / range;
  return {
    'font-size': `${14 + ratio * 18}px`,
    color: `hsl(${220 - ratio * 220}, ${60 + ratio * 40}%, ${45 + (idx % 3) * 5}%)`,
    'font-weight': ratio > 0.7 ? '800' : ratio > 0.4 ? '600' : '400',
    'animation-delay': `${(idx % 10) * 0.1}s`
  };
}

// ========== 竞争等级 ==========
function getCompetitionType(item: OzonSearchQueryVO) {
  const c = item.count || 0;
  if (c > 50000) return 'error';
  if (c > 20000) return 'warning';
  if (c > 5000) return 'info';
  return 'success';
}
function getCompetitionLabel(item: OzonSearchQueryVO) {
  const c = item.count || 0;
  if (c > 50000) return '🔥 极度激烈';
  if (c > 20000) return '⚡ 竞争激烈';
  if (c > 5000) return '📊 中等竞争';
  return '🌱 竞争较低';
}
function getCompetitionWidth(item: OzonSearchQueryVO) {
  const max = searchQueries.value.length > 0 ? Math.max(...searchQueries.value.map(q => q.count || 0)) : 1;
  return `${Math.max(((item.count || 0) / max) * 100, 5)}%`;
}
function getCompetitionGradient(item: OzonSearchQueryVO) {
  const c = item.count || 0;
  if (c > 50000) return 'linear-gradient(90deg,#f56c6c,#f093fb)';
  if (c > 20000) return 'linear-gradient(90deg,#e6a23c,#f093fb)';
  if (c > 5000) return 'linear-gradient(90deg,#409eff,#43e97b)';
  return 'linear-gradient(90deg,#67c23a,#43e97b)';
}

// ========== 格式化工具 ==========
function formatNumber(v: number | null | undefined) {
  return v == null ? '—' : v.toLocaleString('ru-RU');
}
function formatPrice(v: number | null | undefined) {
  return v == null ? '—' : `₽${Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`;
}
function formatPriceShort(v: number) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
}
function getCaColor(v: number | null | undefined) {
  return v == null ? '#909399' : v > 15 ? '#67c23a' : v > 8 ? '#e6a23c' : '#f56c6c';
}
function getShareColor(v: number | null | undefined) {
  return v == null ? '#909399' : v > 50 ? '#f56c6c' : v > 20 ? '#e6a23c' : '#67c23a';
}

// ========== 表格列定义 ==========
const columns = computed(() => [
  {
    title: '#',
    key: 'index',
    width: 54,
    align: 'center' as const,
    render: (_row: OzonSearchQueryVO, idx: number) => {
      const rank = ((searchParams.page ?? 1) - 1) * (searchParams.size ?? 20) + idx + 1;
      const color = rank <= 3 ? '#f56c6c' : rank <= 10 ? '#e6a23c' : '#909399';
      const bg = rank <= 3 ? 'rgba(245,108,108,0.1)' : rank <= 10 ? 'rgba(230,162,60,0.1)' : 'transparent';
      return h(
        'span',
        {
          style: `display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;font-weight:700;font-size:12px;color:${color};background:${bg};`
        },
        rank
      );
    }
  },
  {
    title: '搜索词（俄/中）',
    key: 'queryText',
    minWidth: 240,
    sorter: true,
    render: (row: OzonSearchQueryVO) => {
      const children: any[] = [];
      if (row.queryTextZh) {
        children.push(h('div', { class: 'font-semibold text-gray-800' }, row.queryTextZh));
        children.push(h('div', { class: 'text-xs text-gray-400 truncate max-w-50' }, row.queryText || ''));
      } else {
        children.push(h('div', { class: 'font-medium text-gray-800' }, row.queryText || '—'));
      }
      return h('div', { class: 'flex flex-col gap-0.5' }, children);
    }
  },
  {
    title: '搜索次数',
    key: 'count',
    width: 124,
    align: 'right' as const,
    sorter: true,
    render: (row: OzonSearchQueryVO) => {
      if (row.count == null) return h('span', { class: 'text-gray-300' }, '—');
      const color = row.count > 50000 ? '#f56c6c' : row.count > 20000 ? '#e6a23c' : '#303133';
      return h('span', { class: 'font-bold', style: `color:${color};` }, formatNumber(row.count));
    }
  },
  {
    title: '转化率',
    key: 'ca',
    width: 98,
    align: 'center' as const,
    sorter: true,
    render: (row: OzonSearchQueryVO) => {
      if (row.ca == null) return h('span', { class: 'text-gray-300' }, '—');
      const color = row.ca > 15 ? '#67c23a' : row.ca > 8 ? '#e6a23c' : '#f56c6c';
      const bg = row.ca > 15 ? 'rgba(103,194,58,0.1)' : row.ca > 8 ? 'rgba(230,162,60,0.1)' : 'rgba(245,108,108,0.1)';
      return h(
        'span',
        { class: 'inline-block px-2 py-0.5 rounded font-bold text-xs', style: `color:${color};background:${bg};` },
        `${row.ca.toFixed(2)}%`
      );
    }
  },
  {
    title: '客单价',
    key: 'avgCaRub',
    width: 116,
    align: 'right' as const,
    sorter: true,
    render: (row: OzonSearchQueryVO) =>
      row.avgCaRub == null
        ? h('span', { class: 'text-gray-300' }, '—')
        : h('span', { class: 'font-medium text-gray-700' }, formatPrice(row.avgCaRub))
  },
  {
    title: 'GMV',
    key: 'gmv',
    width: 138,
    align: 'right' as const,
    sorter: true,
    render: (row: OzonSearchQueryVO) =>
      row.gmv == null
        ? h('span', { class: 'text-gray-300' }, '—')
        : h('span', { class: 'font-bold text-red-500' }, formatPrice(row.gmv))
  },
  {
    title: '订单数',
    key: 'ord',
    width: 104,
    align: 'right' as const,
    sorter: true,
    render: (row: OzonSearchQueryVO) =>
      row.ord == null
        ? h('span', { class: 'text-gray-300' }, '—')
        : h('span', { class: 'font-medium text-purple-600' }, formatNumber(row.ord))
  },
  {
    title: '浏览量',
    key: 'itemsViews',
    width: 106,
    align: 'right' as const,
    sorter: true,
    render: (row: OzonSearchQueryVO) =>
      row.itemsViews == null
        ? h('span', { class: 'text-gray-300' }, '—')
        : h('span', { class: 'text-gray-600' }, formatNumber(row.itemsViews))
  },
  {
    title: '竞争',
    key: 'competition',
    width: 108,
    align: 'center' as const,
    render: (row: OzonSearchQueryVO) =>
      h(
        NTag,
        { size: 'small', type: getCompetitionType(row), round: true },
        { default: () => getCompetitionLabel(row) }
      )
  },
  {
    title: '操作',
    key: 'actions',
    width: 84,
    align: 'center' as const,
    fixed: 'right' as const,
    render: (row: OzonSearchQueryVO) => {
      // ✅ 修复：使用 SvgIconComp 替代字符串 'SvgIcon'，确保图标正确渲染且按钮内容居中
      return h(
        NButton,
        {
          size: 'small',
          type: 'primary',
          ghost: true,
          onClick: () => {
            currentItem.value = row;
            detailVisible.value = true;
          }
        },
        {
          default: () => '详情',
          icon: () => h(SvgIconComp, { icon: 'ph:eye', width: 16, height: 16 })
        }
      );
    }
  }
]);

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="p-4">
    <!-- ========== 搜索卡片 ========== -->
    <NCard :bordered="false" class="rounded-xl shadow-sm mb-4" size="small">
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2 flex-1 min-w-70">
          <span class="text-sm text-gray-500 whitespace-nowrap">关键词</span>
          <NInput
            v-model:value="searchParams.keyword"
            placeholder="搜索俄语原文或中文翻译"
            clearable
            @keydown.enter="handleSearch"
          >
            <template #prefix>
              <SvgIcon icon="ph:magnifying-glass" />
            </template>
          </NInput>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-500 whitespace-nowrap">最小次数</span>
          <NInputNumber v-model:value="searchParams.minCount" :min="0" placeholder="不限" class="w-30" clearable />
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-500 whitespace-nowrap">最低CA%</span>
          <NInputNumber
            v-model:value="searchParams.minCa"
            :min="0"
            :max="100"
            :precision="2"
            placeholder="不限"
            class="w-25"
            clearable
          />
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-500 whitespace-nowrap">最低GMV</span>
          <NInputNumber v-model:value="searchParams.minGmv" :min="0" placeholder="不限" class="w-30" clearable />
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-500 whitespace-nowrap">排序</span>
          <NSelect v-model:value="searchParams.sortField" :options="sortFieldOptions" class="w-35" />
        </div>
        <div class="flex items-center gap-1">
          <NButton
            :type="searchParams.sortDir === 'desc' ? 'primary' : 'default'"
            size="small"
            @click="
              searchParams.sortDir = 'desc';
              handleSearch();
            "
          >
            <template #icon>
              <SvgIcon icon="ph:sort-descending" />
            </template>
            降序
          </NButton>
          <NButton
            :type="searchParams.sortDir === 'asc' ? 'primary' : 'default'"
            size="small"
            @click="
              searchParams.sortDir = 'asc';
              handleSearch();
            "
          >
            <template #icon>
              <SvgIcon icon="ph:sort-ascending" />
            </template>
            升序
          </NButton>
        </div>
        <div class="flex items-center gap-2 ml-auto">
          <NButton type="primary" :loading="loading" @click="handleSearch">
            <template #icon>
              <SvgIcon icon="ph:magnifying-glass" />
            </template>
            搜索
          </NButton>
          <NButton @click="handleReset">
            <template #icon>
              <SvgIcon icon="ph:arrow-counter-clockwise" />
            </template>
            重置
          </NButton>
          <NButton size="small" @click="handleRefresh">
            <template #icon>
              <SvgIcon icon="ph:arrows-clockwise" />
            </template>
            刷新
          </NButton>
        </div>
      </div>
    </NCard>

    <!-- ========== 统计概览卡片 ========== -->
    <div class="grid grid-cols-4 gap-4 mb-4">
      <NCard
        v-for="(card, idx) in statCards"
        :key="idx"
        :bordered="false"
        class="rounded-xl shadow-sm transition-transform hover:-translate-y-0.5"
        size="small"
      >
        <div class="flex items-center gap-3.5 p-1.5">
          <div
            class="flex items-center justify-center w-11.5 h-11.5 rounded-xl text-white flex-shrink-0"
            :style="{ background: card.bg }"
          >
            <SvgIcon :icon="card.icon" :font-size="22" />
          </div>
          <div class="flex flex-col gap-0.5 min-w-0">
            <span class="text-xs text-gray-400">{{ card.label }}</span>
            <span class="text-xl font-bold" :style="card.color ? { color: card.color } : {}">{{ card.value }}</span>
          </div>
        </div>
      </NCard>
    </div>

    <!-- ========== 热搜词云 + 表格 双栏布局 ========== -->
    <div class="grid grid-cols-12 gap-4 mb-4">
      <!-- 左侧：热搜词云 -->
      <NCard :bordered="false" class="col-span-4 rounded-xl shadow-sm" size="small">
        <template #header>
          <div class="flex items-center gap-2">
            <SvgIcon icon="ph:fire" class="text-lg text-orange-500" />
            <span class="text-base font-semibold text-gray-800">热搜词云</span>
            <NTag size="small" type="warning" round class="ml-auto">TOP {{ searchQueries.length }}</NTag>
          </div>
        </template>
        <div class="word-cloud-container">
          <div
            v-for="(item, idx) in searchQueries"
            :key="idx"
            class="word-cloud-item"
            :style="getWordStyle(item, idx)"
            :title="`${item.queryTextZh || item.queryText}\n搜索次数: ${formatNumber(item.count)}\n转化率: ${item.ca?.toFixed(2)}%\nGMV: ₽${formatNumber(item.gmv)}`"
            @click="handleWordClick(item)"
          >
            <span class="word-text">{{ item.queryTextZh || item.queryText }}</span>
            <span class="word-count">{{ formatNumber(item.count) }}</span>
          </div>
          <div
            v-if="searchQueries.length === 0 && !loading"
            class="flex flex-col items-center justify-center w-full py-10"
          >
            <SvgIcon icon="ph:magnifying-glass" class="text-3xl text-gray-300" />
            <span class="text-gray-400 mt-2">暂无数据，请调整搜索条件</span>
          </div>
        </div>
      </NCard>

      <!-- 右侧：热搜词明细表格 -->
      <NCard :bordered="false" class="col-span-8 rounded-xl shadow-sm" size="small">
        <template #header>
          <div class="flex items-center justify-between w-full">
            <span class="flex items-center gap-2 text-base font-semibold text-gray-800">
              <SvgIcon icon="ph:list-bullets" class="text-lg text-[#667eea]" />
              热搜词明细
            </span>
            <NTag size="small" type="info" round>共 {{ total }} 条</NTag>
          </div>
        </template>
        <NDataTable
          :columns="columns"
          :data="searchQueries"
          :loading="loading"
          :pagination="paginationConfig"
          :remote="true"
          :scroll-x="1100"
          striped
          hoverable
          size="small"
          @update:sorter="handleSorterChange"
          @update:page="handlePageChange"
          @update:page-size="handlePageSizeChange"
        />
      </NCard>
    </div>

    <!-- ========== 详情抽屉 ========== -->
    <NDrawer v-model:show="detailVisible" :width="520" placement="right" :mask-closable="true">
      <NDrawerContent :title="currentItem?.queryTextZh || currentItem?.queryText || '搜索词详情'" closable>
        <template v-if="currentItem">
          <div class="flex flex-col gap-1">
            <div class="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-4 flex flex-col gap-2">
              <div class="flex items-center gap-2 text-base font-semibold text-gray-800 break-all">
                <SvgIcon icon="ph:translate" class="text-blue-500" />
                <span>{{ currentItem.queryText || '—' }}</span>
              </div>
              <div v-if="currentItem.queryTextZh" class="flex items-center gap-2 text-lg font-bold text-green-600">
                <SvgIcon icon="ph:note" class="text-green-500" />
                <span>{{ currentItem.queryTextZh }}</span>
              </div>
            </div>
            <div class="grid grid-cols-4 gap-2.5">
              <div class="flex flex-col items-center gap-1 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span class="text-xs text-gray-400 uppercase tracking-wider">搜索次数</span>
                <span class="text-lg font-bold text-blue-600">{{ formatNumber(currentItem.count) }}</span>
              </div>
              <div class="flex flex-col items-center gap-1 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span class="text-xs text-gray-400 uppercase tracking-wider">转化率</span>
                <span class="text-lg font-bold" :style="{ color: getCaColor(currentItem.ca) }">
                  {{ currentItem.ca?.toFixed(2) }}%
                </span>
              </div>
              <div class="flex flex-col items-center gap-1 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span class="text-xs text-gray-400 uppercase tracking-wider">GMV</span>
                <span class="text-lg font-bold text-red-500">{{ formatPrice(currentItem.gmv) }}</span>
              </div>
              <div class="flex flex-col items-center gap-1 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span class="text-xs text-gray-400 uppercase tracking-wider">订单数</span>
                <span class="text-lg font-bold text-purple-600">{{ formatNumber(currentItem.ord) }}</span>
              </div>
            </div>
            <NDescriptions :column="2" bordered size="small" label-placement="left" class="mt-4">
              <NDescriptionsItem label="平均客单价">
                <span class="font-semibold">{{ formatPrice(currentItem.avgCaRub) }}</span>
              </NDescriptionsItem>
              <NDescriptionsItem label="平均商品数">
                <NTag size="small">{{ currentItem.avgCountItems || '—' }}</NTag>
              </NDescriptionsItem>
              <NDescriptionsItem label="商品浏览量">{{ formatNumber(currentItem.itemsViews) }}</NDescriptionsItem>
              <NDescriptionsItem label="软查询数">{{ formatNumber(currentItem.softQueryCount) }}</NDescriptionsItem>
              <NDescriptionsItem label="软查询占比">
                <span :style="{ color: getShareColor(currentItem.softQueryShare) }">
                  {{ currentItem.softQueryShare?.toFixed(2) }}%
                </span>
              </NDescriptionsItem>
              <NDescriptionsItem label="有加购查询数">{{ formatNumber(currentItem.uniqQueriesWCa) }}</NDescriptionsItem>
              <NDescriptionsItem label="唯一卖家数">
                <NTag size="small" type="info">{{ formatNumber(currentItem.uniqSellers) }}</NTag>
              </NDescriptionsItem>
              <NDescriptionsItem label="ZR计数">{{ formatNumber(currentItem.zrCount) }}</NDescriptionsItem>
              <NDescriptionsItem label="ZR占比">
                <span :style="{ color: getShareColor(currentItem.zrShare) }">
                  {{ currentItem.zrShare?.toFixed(2) }}%
                </span>
              </NDescriptionsItem>
              <NDescriptionsItem label="无交互用户数">
                {{ formatNumber(currentItem.usersWithoutInterectionCount) }}
              </NDescriptionsItem>
              <NDescriptionsItem label="无交互占比">
                <span :style="{ color: getShareColor(currentItem.usersWithoutInterectionShare) }">
                  {{ currentItem.usersWithoutInterectionShare?.toFixed(2) }}%
                </span>
              </NDescriptionsItem>
              <NDescriptionsItem label="搜索→订单转化">
                <span class="font-semibold text-green-600">{{ currentItem.searchUsersToOrdUsers?.toFixed(2) }}%</span>
              </NDescriptionsItem>
            </NDescriptions>
            <div class="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-sm font-medium text-gray-700">竞争热度</span>
                <NTag :type="getCompetitionType(currentItem)" size="small" round>
                  {{ getCompetitionLabel(currentItem) }}
                </NTag>
              </div>
              <div class="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-width duration-600"
                  :style="{ width: getCompetitionWidth(currentItem), background: getCompetitionGradient(currentItem) }"
                />
              </div>
            </div>
          </div>
        </template>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>

<style scoped>
.word-cloud-container {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px 14px;
  padding: 20px 16px;
  min-height: 340px;
  max-height: 440px;
  overflow-y: auto;
  background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #fdf2f8 100%);
  border-radius: 10px;
}

.word-cloud-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.25s ease;
  animation: fadeInUp 0.4s ease forwards;
  opacity: 0;
  white-space: nowrap;
}

.word-cloud-item:hover {
  transform: scale(1.12);
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  z-index: 10;
}

.word-text {
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  letter-spacing: 0.3px;
}

.word-count {
  font-size: 0.65em;
  opacity: 0.6;
  font-weight: 400;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

:global(.n-data-table .n-tag) {
  font-weight: 600;
}
</style>
