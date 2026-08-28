<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, h, resolveComponent } from 'vue';
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
  NTreeSelect,
  NForm,
  NFormItem,
  NInputNumber,
  NSpace,
  type DataTableColumns
} from 'naive-ui';
import { fetchOzonProducts, type OzonProductVO, type OzonProductQuery } from '@/service/api/ozon-product';
import { fetchOzonCategoryTree } from '@/service/api/ozon-category';
import { fetchSellerInfoList, type SellerInfoVO } from '@/service/api/ozon-seller-info';
import { useAuthStore } from '@/store/modules/auth';
import { createListing, followListing } from '@/service/api/ozon-product';

defineOptions({ name: 'OzonProductList' });

const SvgIconComp = resolveComponent('SvgIcon');
const message = useMessage();
const { loading, startLoading, endLoading } = useLoading();
const authStore = useAuthStore();

// ========== 数据状态 ==========
const productList = ref<OzonProductVO[]>([]);
const total = ref(0);
const sellerList = ref<SellerInfoVO[]>([]);

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
  sortDir: 'desc',
  listingSource: undefined
});

const expanded = ref(false);
const detailVisible = ref(false);
const currentProduct = ref<OzonProductVO | null>(null);

// 类目树相关
const categoryTree = ref<any[]>([]);
const selectedCategoryIds = ref<string[]>([]);

// 上架弹窗相关
const listingModalVisible = ref(false);
const listingMode = ref<'create' | 'follow'>('create');
const listingRow = ref<OzonProductVO | null>(null);
const formData = reactive({
  offerId: '',
  price: null as number | null,
  oldPrice: null as number | null,
  selectedSellerId: null as string | null
});

const operator = computed(() => authStore.userInfo?.userName || 'system');

const listingStatusOptions = [
  { label: '全部状态', value: undefined },
  { label: '未上架', value: 0 },
  { label: '自建审核中', value: 1 },
  { label: '自建成功', value: 2 },
  { label: '自建失败', value: 3 },
  { label: '跟卖审核中', value: 4 },
  { label: '跟卖成功', value: 5 },
  { label: '跟卖失败', value: 6 }
];

// 计算默认价格：平均价格 = soldSum / latestSoldCount，原价 = 平均价格 * 1.1
function setDefaultPrices(row: OzonProductVO) {
  const soldSum = Number(row.soldSum);
  const soldCount = Number(row.latestSoldCount);
  if (soldSum > 0 && soldCount > 0) {
    const avgPrice = soldSum / soldCount;
    formData.price = Number(avgPrice.toFixed(2));
    formData.oldPrice = Number((avgPrice * 1.1).toFixed(2));
  } else {
    formData.price = null;
    formData.oldPrice = null;
  }
}

function openCreateModal(row: OzonProductVO) {
  listingMode.value = 'create';
  listingRow.value = row;
  formData.offerId = '';
  formData.selectedSellerId = null;
  setDefaultPrices(row);
  listingModalVisible.value = true;
}

function openFollowModal(row: OzonProductVO) {
  listingMode.value = 'follow';
  listingRow.value = row;
  formData.offerId = '';
  formData.selectedSellerId = null;
  setDefaultPrices(row);
  listingModalVisible.value = true;
}

async function handleSubmitListing() {
  if (!listingRow.value) return;
  if (formData.price === null || formData.price <= 0) {
    message.warning('请填写有效的价格');
    return;
  }
  if (!formData.selectedSellerId) {
    message.warning('请选择卖家店铺');
    return;
  }
  const selectedSeller = sellerList.value.find(item => item.clientId === formData.selectedSellerId);
  if (!selectedSeller) {
    message.error('所选卖家不存在，请刷新后重试');
    return;
  }
  startLoading();
  try {
    const baseData = {
      productId: listingRow.value.variantId!,
      offerId: formData.offerId || undefined,
      price: String(formData.price),
      oldPrice: formData.oldPrice ? String(formData.oldPrice) : undefined,
      operator: operator.value,
      clientId: selectedSeller.clientId,
      sellerName: selectedSeller.companyName
    };
    let taskId: string;
    if (listingMode.value === 'create') {
      taskId = (await createListing(baseData)).data!;
    } else {
      taskId = (await followListing(baseData)).data!;
    }
    message.success(`上架任务已提交，任务ID: ${taskId}`);
    listingModalVisible.value = false;
    loadData({ ...searchParams });
  } catch {
    message.error('上架失败，请重试');
  } finally {
    endLoading();
  }
}

// ========== 加载卖家列表 ==========
async function loadSellerList() {
  try {
    const { data, error } = await fetchSellerInfoList({ pageNo: 1, pageSize: 100 });
    if (!error && data) {
      sellerList.value = data.records || [];
    }
  } catch (e) {
    console.error('加载卖家列表失败', e);
  }
}

// ========== 请求取消与组件卸载标志 ==========
let abortController: AbortController | null = null;
let isUnmounted = false;

async function loadData(params: OzonProductQuery = {}) {
  if (abortController) {
    abortController.abort();
  }
  abortController = new AbortController();
  startLoading();
  try {
    const queryParams: OzonProductQuery = {
      ...searchParams,
      ...params,
      page: params.page ?? searchParams.page,
      size: params.size ?? searchParams.size,
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

function handleSearch() {
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
  searchParams.listingSource = undefined;
  searchParams.page = 1;
  searchParams.size = 20;
  searchParams.sortField = 't1.id';
  searchParams.sortDir = 'desc';
  loadData({ ...searchParams });
}

function handlePageChange(page: number) {
  searchParams.page = page;
  loadData({ page, size: searchParams.size });
}

function handlePageSizeChange(size: number) {
  searchParams.size = size;
  searchParams.page = 1;
  loadData({ page: 1, size });
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

const pagination = computed(() => ({
  page: searchParams.page,
  pageSize: searchParams.size,
  itemCount: total.value,
  showSizePicker: true,
  pageSizes: [10, 20, 50, 100],
  onUpdatePage: handlePageChange,
  onUpdatePageSize: handlePageSizeChange
}));

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

function handleImgError(e: Event) {
  (e.target as HTMLImageElement).style.display = 'none';
}

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
      icon: () => h(SvgIconComp, { icon: 'ph:copy', width: 14, height: 14 })
    }
  );
}

async function loadCategoryTree() {
  try {
    const response = await fetchOzonCategoryTree();
    const rawData = response.data;
    if (Array.isArray(rawData) && rawData.length > 0) {
      categoryTree.value = mapTreeFields(rawData);
    } else {
      categoryTree.value = [];
      message.warning('类目树数据为空，请检查后端数据');
    }
  } catch (e) {
    console.error('加载类目树失败:', e);
    categoryTree.value = [];
    message.error('加载类目树失败，请检查后端接口');
  }
}

function mapTreeFields(nodes: any[]): any[] {
  return nodes.map((node: any) => ({
    key: node.categoryId,
    label: node.name,
    children: node.children && node.children.length > 0 ? mapTreeFields(node.children) : []
  }));
}

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

const listingStatusMap: Record<number, { label: string; type: 'default' | 'info' | 'success' | 'warning' | 'error' }> =
  {
    0: { label: '未上架', type: 'default' },
    1: { label: '自建审核中', type: 'info' },
    2: { label: '自建成功', type: 'success' },
    3: { label: '自建失败', type: 'error' },
    4: { label: '跟卖审核中', type: 'warning' },
    5: { label: '跟卖成功', type: 'success' },
    6: { label: '跟卖失败', type: 'error' }
  };

function getListingStatusTag(value: number | undefined) {
  const status = listingStatusMap[value ?? 0];
  return h(NTag, { size: 'small', type: status.type, round: true }, { default: () => status.label });
}

// 商品图片渲染（带印章）
function renderProductImage(row: OzonProductVO) {
  const img = row.photo
    ? h('img', {
        src: row.photo,
        alt: row.name || '',
        class: 'w-80px h-80px object-contain rounded-6px border border-gray-200 bg-gray-50',
        onerror: handleImgError
      })
    : h('div', { class: 'w-60px h-60px flex items-center justify-center bg-gray-100 rounded-6px' }, [
        h(SvgIconComp, { icon: 'ph:package', width: 22, height: 22, style: 'color:#c0c4cc;' })
      ]);

  const showStamp = row.listingSellerName && row.listingSource !== 0 && row.listingSource !== undefined;
  if (!showStamp) return img;

  return h('div', { class: 'relative inline-block' }, [
    img,
    h(
      'div',
      {
        class: 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none whitespace-nowrap',
        style: {
          border: '2px solid #e6a23c',
          color: '#e6a23c',
          padding: '2px 6px',
          fontSize: '10px',
          fontWeight: 'bold',
          background: 'rgba(255,255,255,0.85)',
          borderRadius: '4px',
          transform: 'rotate(-20deg)'
        }
      },
      row.listingSellerName
    )
  ]);
}

const columns = computed<DataTableColumns<OzonProductVO>>(() => [
  {
    title: '商品',
    key: 'name',
    width: 350,
    sorter: true,
    render: (row: OzonProductVO) => {
      const children: any[] = [];
      children.push(renderProductImage(row));
      const infoChildren: any[] = [
        h(
          'div',
          {
            class: 'font-medium text-gray-800 break-all',
            style: 'max-width:220px;',
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
            makeCopyBtn(row.brand, '品牌')
          ])
        );
      }
      if (row.sellerName) {
        infoChildren.push(
          h('div', { class: 'flex items-center gap-4px text-11px flex-wrap' }, [
            h('span', { class: 'text-gray-400 whitespace-nowrap flex-shrink-0' }, '卖家:'),
            h('span', { class: 'text-gray-700 break-all' }, row.sellerName),
            makeCopyBtn(row.sellerName, '卖家')
          ])
        );
      }
      if (row.article) {
        infoChildren.push(
          h('div', { class: 'flex items-center gap-4px text-11px flex-wrap' }, [
            h('span', { class: 'text-gray-400 whitespace-nowrap flex-shrink-0' }, '货号:'),
            h('span', { class: 'text-gray-700 break-all' }, row.article),
            makeCopyBtn(row.article, '货号')
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
    width: 115,
    ellipsis: { tooltip: true },
    render: (row: OzonProductVO) => {
      const items: any[] = [h('div', { class: 'font-medium text-gray-800' }, row.category1 || '—')];
      if (row.category2) items.push(h('div', { class: 'text-11px text-gray-500' }, row.category2));
      if (row.category3) items.push(h('div', { class: 'text-11px text-gray-400' }, row.category3));
      return h('div', { class: 'flex flex-col gap-1px' }, items);
    }
  },
  {
    title: '上架状态',
    key: 'listingSource',
    width: 95,
    align: 'center',
    render: (row: OzonProductVO) => getListingStatusTag(row.listingSource)
  },
  {
    title: '订购金额',
    key: 'soldSum',
    width: 106,
    align: 'right',
    sorter: true,
    render: (row: OzonProductVO) => {
      if (row.soldSum == null) return h('span', { class: 'text-gray-300' }, '—');
      return h(
        NTag,
        { size: 'small', type: priceTagType(row.soldSum), round: true, style: 'font-weight:600;font-size:13px;' },
        { default: () => formatPrice(row.soldSum) }
      );
    }
  },
  {
    title: '已订购数量',
    key: 'latestSoldCount',
    width: 102,
    align: 'right',
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
    width: 78,
    align: 'right',
    sorter: true,
    render: (row: OzonProductVO) => {
      if (row.previousSoldCount == null) return h('span', { class: 'text-gray-300' }, '—');
      return h('span', { class: 'font-medium text-gray-700' }, formatSoldCount(row.previousSoldCount));
    }
  },
  {
    title: '增长率',
    key: 'growthRate',
    width: 84,
    align: 'center',
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
    width: 74,
    align: 'center',
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
    width: 140,
    align: 'center',
    fixed: 'right',
    render: (row: OzonProductVO) => {
      return h('div', { class: 'flex flex-col gap-4px items-stretch' }, [
        h(
          NButton,
          { size: 'small', type: 'primary', ghost: true, onClick: () => handleViewDetail(row), class: 'w-full' },
          {
            default: () => '详情',
            icon: () => h(SvgIconComp, { icon: 'ph:eye', width: 15, height: 15 })
          }
        ),
        h(
          NButton,
          {
            size: 'small',
            type: 'success',
            ghost: true,
            onClick: () => openCreateModal(row),
            disabled: row.listingSource === 2 || row.listingSource === 5,
            class: 'w-full'
          },
          { default: () => '创建' }
        ),
        h(
          NButton,
          {
            size: 'small',
            type: 'warning',
            ghost: true,
            onClick: () => openFollowModal(row),
            disabled: !row.sku || row.listingSource === 4 || row.listingSource === 5 || row.listingSource === 6,
            class: 'w-full'
          },
          { default: () => 'sku创建' }
        )
      ]);
    }
  }
]);

onMounted(() => {
  loadCategoryTree();
  loadSellerList();
  loadData({ ...searchParams });
});

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
        <div class="col-span-3">
          <div class="flex items-center gap-8px">
            <span class="text-13px text-gray-500 whitespace-nowrap" style="min-width: 65px">全局搜索</span>
            <NInput
              v-model:value="searchParams.keyword"
              placeholder="搜索商品名称/品牌/货号/卖家"
              clearable
              @keydown.enter="handleSearch"
            >
              <template #prefix>
                <SvgIcon icon="ph:magnifying-glass" />
              </template>
            </NInput>
          </div>
        </div>
        <div class="col-span-2">
          <div class="flex items-center gap-8px">
            <span class="text-13px text-gray-500 whitespace-nowrap" style="min-width: 40px">品牌</span>
            <NInput v-model:value="searchParams.brand" placeholder="品牌" clearable @keydown.enter="handleSearch" />
          </div>
        </div>
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
        <div class="col-span-2">
          <div class="flex items-center gap-8px">
            <span class="text-13px text-gray-500 whitespace-nowrap" style="min-width: 65px">上架状态</span>
            <NSelect
              v-model:value="searchParams.listingSource"
              :options="listingStatusOptions"
              placeholder="全部状态"
              clearable
              @update:value="handleSearch"
            />
          </div>
        </div>
        <div class="col-span-3 flex items-center justify-end gap-8px">
          <NButton type="primary" :loading="loading" :disabled="loading" @click="handleSearch">
            <template #icon>
              <SvgIcon icon="ph:magnifying-glass" />
            </template>
            搜索
          </NButton>
          <NButton :disabled="loading" @click="handleReset">
            <template #icon>
              <SvgIcon icon="ph:arrow-counter-clockwise" />
            </template>
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
                  style="flex: 1; height: 32px; display: flex; align-items: center; justify-content: center; padding: 0"
                >
                  <div style="display: flex; align-items: center; gap: 6px">
                    <SvgIcon icon="ph:sort-ascending" style="font-size: 16px; flex-shrink: 0" />
                    <span style="font-size: 13px; white-space: nowrap">升序</span>
                  </div>
                </NRadioButton>
                <NRadioButton
                  value="desc"
                  style="flex: 1; height: 32px; display: flex; align-items: center; justify-content: center; padding: 0"
                >
                  <div style="display: flex; align-items: center; gap: 6px">
                    <SvgIcon icon="ph:sort-descending" style="font-size: 16px; flex-shrink: 0" />
                    <span style="font-size: 13px; white-space: nowrap">降序</span>
                  </div>
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
            <template #icon>
              <SvgIcon icon="ph:arrows-clockwise" />
            </template>
            刷新
          </NButton>
        </div>
      </template>
      <NDataTable
        :columns="columns"
        :data="productList"
        :loading="loading"
        :pagination="pagination"
        :remote="true"
        :scroll-x="1450"
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
      style="max-width: 550px; width: 94%"
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
                  <template #icon>
                    <SvgIcon icon="ph:copy" />
                  </template>
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
            <NDescriptionsItem label="上架卖家">
              <span v-if="currentProduct.listingSellerName">
                {{ currentProduct.listingSellerName }} ({{ currentProduct.listingClientId }})
              </span>
              <span v-else>—</span>
            </NDescriptionsItem>
            <NDescriptionsItem label="销售模式">
              <NTag v-if="currentProduct.salesSchema" size="small" type="primary" round>
                {{ currentProduct.salesSchema }}
              </NTag>
              <span v-else>—</span>
            </NDescriptionsItem>
            <NDescriptionsItem label="上架状态">
              <NTag
                v-if="currentProduct.listingSource !== undefined"
                :type="listingStatusMap[currentProduct.listingSource]?.type || 'default'"
                round
                size="small"
              >
                {{ listingStatusMap[currentProduct.listingSource]?.label || '未知' }}
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
          <NSpace justify="center" class="pt-8px">
            <NButton
              type="success"
              :disabled="currentProduct.listingSource === 2 || currentProduct.listingSource === 5"
              @click="openCreateModal(currentProduct)"
            >
              <template #icon><SvgIcon icon="ph:plus-circle" /></template>
              创建（自建）
            </NButton>
            <NButton
              type="warning"
              :disabled="
                !currentProduct.sku ||
                currentProduct.listingSource === 4 ||
                currentProduct.listingSource === 5 ||
                currentProduct.listingSource === 6
              "
              @click="openFollowModal(currentProduct)"
            >
              <template #icon><SvgIcon icon="ph:copy" /></template>
              SKU创建（跟卖）
            </NButton>
          </NSpace>
          <div class="pt-4px">
            <NButton v-if="currentProduct.link" type="primary" block @click="handleOpenLink(currentProduct.link!)">
              <template #icon>
                <SvgIcon icon="ph:link" />
              </template>
              在 Ozon 中查看
            </NButton>
          </div>
        </div>
      </template>
    </NModal>

    <!-- 上架弹窗 -->
    <NModal
      v-model:show="listingModalVisible"
      preset="card"
      :title="listingMode === 'create' ? '自建商品上架' : 'SKU跟卖上架'"
      style="max-width: 480px; width: 90%"
      :bordered="false"
      :mask-closable="true"
    >
      <NForm
        v-if="listingRow"
        :model="formData"
        label-placement="left"
        label-width="100px"
        require-mark-placement="right"
      >
        <NFormItem label="商品ID">
          <NInput :value="listingRow.variantId" disabled />
        </NFormItem>
        <NFormItem label="商品名称">
          <NInput :value="listingRow.name" disabled />
        </NFormItem>
        <NFormItem label="卖家店铺" required>
          <NSelect
            v-model:value="formData.selectedSellerId"
            :options="sellerList.map(s => ({ label: `${s.companyName} (${s.clientId})`, value: s.clientId }))"
            placeholder="请选择卖家"
            filterable
            clearable
          />
        </NFormItem>
        <NFormItem label="货号(offerId)" path="offerId">
          <NInput v-model:value="formData.offerId" placeholder="留空则自动生成" clearable />
        </NFormItem>
        <NFormItem label="价格(RUB)" path="price" required>
          <NInputNumber
            v-model:value="formData.price"
            :min="0"
            :precision="2"
            placeholder="请输入价格"
            clearable
            class="w-full"
          />
        </NFormItem>
        <NFormItem label="原价(RUB)" path="oldPrice">
          <NInputNumber
            v-model:value="formData.oldPrice"
            :min="0"
            :precision="2"
            placeholder="可选"
            clearable
            class="w-full"
          />
        </NFormItem>
        <NFormItem label="操作人">
          <NInput :value="operator" disabled />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="listingModalVisible = false">取消</NButton>
          <NButton type="primary" :loading="loading" @click="handleSubmitListing">提交上架</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>
