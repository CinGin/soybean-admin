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
  NDatePicker,
  NModal,
  NCollapseTransition,
  NDescriptions,
  NDescriptionsItem,
  NSpace,
  NInputNumber,
  NForm,
  NFormItem,
  type DataTableColumns
} from 'naive-ui';
import {
  fetchOzonListingRecords,
  manualCheckStatus,
  manualRebuild,
  fetchRebuildData,
  submitManualRebuild
} from '@/service/api/ozon-listing-record';
import type {
  OzonListingRecordVO,
  OzonListingRecordQuery,
  ManualRebuildCommand,
  AttributeGroupVO
} from '@/typings/api/ozon-listing-record';
import AttributeForm from './modules/AttributeForm.vue';

defineOptions({ name: 'OzonListingRecord' });

const message = useMessage();
const { loading, startLoading, endLoading } = useLoading();

const recordList = ref<OzonListingRecordVO[]>([]);
const total = ref(0);
const expanded = ref(false);
const detailVisible = ref(false);
const currentRecord = ref<OzonListingRecordVO | null>(null);
const updatingTaskId = ref<string | null>(null);
const rebuildingRecordId = ref<number | null>(null);

// 倒计时相关
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | null = null;
const lastUpdateAttempts = ref<Record<string, number>>({});

// 手动重建弹窗
const manualRebuildVisible = ref(false);
const manualRebuildLoading = ref(false);
const manualRebuildClientId = ref<string>('');

// 新增：商品特征编辑弹窗
const attributeModalVisible = ref(false);

const manualRebuildForm = reactive<ManualRebuildCommand>({
  recordId: 0,
  offerId: '',
  name: '',
  description: '',
  descriptionCategoryId: 0,
  typeId: 0,
  price: '',
  oldPrice: '',
  vat: '0',
  currencyCode: 'RUB',
  depth: 0,
  height: 0,
  width: 0,
  weight: 0,
  dimensionUnit: 'mm',
  weightUnit: 'g',
  images: [],
  primaryImage: '',
  barcode: '',
  attributes: [],
  complexAttributes: [],
  groups: []
});

const manualRebuildImages = computed({
  get: () => manualRebuildForm.images.join(','),
  set: (val: string) => {
    manualRebuildForm.images = val
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }
});

const searchParams = reactive<OzonListingRecordQuery>({
  pageNo: 1,
  pageSize: 20,
  productId: '',
  listingType: undefined,
  ozonTaskId: '',
  offerId: '',
  status: undefined,
  operator: '',
  newProductId: '',
  startTime: undefined,
  endTime: undefined,
  sortField: 'createdAt',
  sortDir: 'desc'
});

const dateRange = ref<[number, number] | null>(null);

const listingTypeOptions = [
  { label: '全部类型', value: undefined },
  { label: '自建', value: 1 },
  { label: '跟卖', value: 2 }
];

const statusOptions = [
  { label: '全部状态', value: undefined },
  { label: '待审核', value: 'PENDING' },
  { label: '成功', value: 'SUCCESS' },
  { label: '失败', value: 'FAILED' }
];

const statusMap: Record<string, { label: string; type: 'default' | 'info' | 'success' | 'warning' | 'error' }> = {
  PENDING: { label: '待审核', type: 'warning' },
  SUCCESS: { label: '成功', type: 'success' },
  FAILED: { label: '失败', type: 'error' }
};

const listingTypeMap: Record<number, { label: string; type: 'default' | 'info' | 'success' | 'warning' | 'error' }> = {
  1: { label: '自建', type: 'info' },
  2: { label: '跟卖', type: 'warning' }
};

const rebuildStatusMap: Record<string, { label: string; type: 'default' | 'info' | 'success' | 'warning' | 'error' }> =
  {
    PENDING: { label: '待重建', type: 'warning' },
    PROCESSING: { label: '重建中', type: 'info' },
    SUCCESS: { label: '重建成功', type: 'success' },
    FAILED: { label: '重建失败', type: 'error' }
  };

let abortController: AbortController | null = null;
let isUnmounted = false;

async function loadData(params: Partial<OzonListingRecordQuery> = {}) {
  if (abortController) abortController.abort();
  abortController = new AbortController();
  startLoading();
  try {
    if (dateRange.value && dateRange.value.length === 2) {
      searchParams.startTime = new Date(dateRange.value[0]).toISOString();
      searchParams.endTime = new Date(dateRange.value[1]).toISOString();
    } else {
      searchParams.startTime = undefined;
      searchParams.endTime = undefined;
    }

    const queryParams: OzonListingRecordQuery = {
      ...searchParams,
      ...params,
      pageNo: params.pageNo ?? searchParams.pageNo,
      pageSize: params.pageSize ?? searchParams.pageSize,
      sortField: params.sortField || searchParams.sortField || 'createdAt',
      sortDir: params.sortDir || searchParams.sortDir || 'desc',
      newProductId: searchParams.newProductId?.trim() || undefined
    };

    const { data, error } = await fetchOzonListingRecords(queryParams);
    if (isUnmounted) return;
    if (!error && data) {
      recordList.value = data.records || [];
      total.value = data.total || 0;
    } else {
      recordList.value = [];
      total.value = 0;
    }
  } catch (e: any) {
    if (isUnmounted) return;
    if (e.name === 'AbortError' || e.code === 'ERR_CANCELED') return;
    message.error('加载上架记录失败');
  } finally {
    if (!isUnmounted) endLoading();
  }
}

function handleSearch() {
  searchParams.pageNo = 1;
  loadData({ pageNo: 1 });
}

function handleReset() {
  dateRange.value = null;
  searchParams.productId = '';
  searchParams.listingType = undefined;
  searchParams.ozonTaskId = '';
  searchParams.offerId = '';
  searchParams.status = undefined;
  searchParams.operator = '';
  searchParams.newProductId = '';
  searchParams.startTime = undefined;
  searchParams.endTime = undefined;
  searchParams.pageNo = 1;
  searchParams.pageSize = 20;
  searchParams.sortField = 'createdAt';
  searchParams.sortDir = 'desc';
  loadData();
}

function getEffectiveTaskId(row: OzonListingRecordVO): string | null {
  if (row.rebuildTaskId && row.rebuildStatus && row.rebuildStatus !== 'SUCCESS') {
    return row.rebuildTaskId;
  }
  return row.ozonTaskId || null;
}
function handlePageChange(page: number) {
  searchParams.pageNo = page;
  loadData({ pageNo: page });
}

function handlePageSizeChange(size: number) {
  searchParams.pageSize = size;
  searchParams.pageNo = 1;
  loadData({ pageNo: 1, pageSize: size });
}

function handleSorterChange(sorter: { columnKey: string; order: 'ascend' | 'descend' | false }) {
  if (!sorter.order) return;
  const sortFieldMap: Record<string, string> = {
    id: 'id',
    productId: 'productId',
    listingType: 'listingType',
    ozonTaskId: 'ozonTaskId',
    offerId: 'offerId',
    status: 'status',
    operator: 'operator',
    newProductId: 'newProductId',
    newSku: 'newSku',
    stockSet: 'stockSet',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };
  const sortField = sortFieldMap[sorter.columnKey] || 'createdAt';
  const sortDir = sorter.order === 'ascend' ? 'asc' : 'desc';
  searchParams.sortField = sortField;
  searchParams.sortDir = sortDir;
  loadData({ sortField, sortDir });
}

const pagination = computed(() => ({
  page: searchParams.pageNo,
  pageSize: searchParams.pageSize,
  itemCount: total.value,
  showSizePicker: true,
  pageSizes: [10, 20, 50, 100],
  onUpdatePage: handlePageChange,
  onUpdatePageSize: handlePageSizeChange
}));

function handleViewDetail(row: OzonListingRecordVO) {
  currentRecord.value = row;
  detailVisible.value = true;
}

function isInCooldown(taskId: string): boolean {
  const last = lastUpdateAttempts.value[taskId];
  if (!last) return false;
  return now.value - last < 60000;
}

function getCooldownRemaining(taskId: string): number {
  const last = lastUpdateAttempts.value[taskId];
  if (!last) return 0;
  const diff = 60000 - (now.value - last);
  return diff > 0 ? Math.ceil(diff / 1000) : 0;
}

async function handleManualUpdate(row: OzonListingRecordVO) {
  const taskId = getEffectiveTaskId(row);
  if (!taskId) {
    message.warning('该记录缺少任务ID，无法更新');
    return;
  }
  if (isInCooldown(taskId)) {
    const remain = getCooldownRemaining(taskId);
    message.warning(`操作过于频繁，请等待 ${remain} 秒后再试`);
    return;
  }
  if (updatingTaskId.value === taskId) return;

  updatingTaskId.value = taskId;
  lastUpdateAttempts.value[taskId] = now.value;
  try {
    await manualCheckStatus(taskId);
    message.success('状态更新请求已提交，3秒后自动刷新');
    setTimeout(() => {
      loadData();
    }, 3000);
  } catch {
    message.error('状态更新失败');
  } finally {
    updatingTaskId.value = null;
  }
}

async function handleManualRebuild(row: OzonListingRecordVO) {
  if (!row.id) return;
  if (rebuildingRecordId.value === row.id) return;

  rebuildingRecordId.value = row.id;
  try {
    await manualRebuild(row.id);
    message.success('重建任务已提交，请稍后关注重建状态');
    setTimeout(() => {
      loadData();
    }, 3000);
  } catch {
    message.error('重建失败，请检查后重试');
  } finally {
    rebuildingRecordId.value = null;
  }
}

async function openManualRebuild(row: OzonListingRecordVO) {
  if (!row.id) return;
  manualRebuildLoading.value = true;
  try {
    const { data, error } = await fetchRebuildData(row.id);
    if (!error && data) {
      manualRebuildForm.recordId = data.recordId;
      manualRebuildForm.offerId = data.offerId;
      manualRebuildForm.name = data.name;
      manualRebuildForm.description = data.description || '';
      manualRebuildForm.descriptionCategoryId = data.descriptionCategoryId;
      manualRebuildForm.typeId = data.typeId;
      manualRebuildForm.price = data.price;
      manualRebuildForm.oldPrice = data.oldPrice || '';
      manualRebuildForm.vat = data.vat || '0';
      manualRebuildForm.currencyCode = data.currencyCode || 'RUB';
      manualRebuildForm.depth = data.depth;
      manualRebuildForm.height = data.height;
      manualRebuildForm.width = data.width;
      manualRebuildForm.weight = data.weight;
      manualRebuildForm.dimensionUnit = data.dimensionUnit || 'mm';
      manualRebuildForm.weightUnit = data.weightUnit || 'g';
      manualRebuildForm.images = data.images || [];
      manualRebuildForm.primaryImage = data.primaryImage || '';
      manualRebuildForm.barcode = data.barcode || '';
      manualRebuildForm.attributes = data.attributes || [];
      manualRebuildForm.complexAttributes = data.complexAttributes || [];
      manualRebuildForm.groups = data.groups || [];
      manualRebuildClientId.value = row.clientId || '';
      manualRebuildVisible.value = true;
    } else {
      message.error('获取重建数据失败');
    }
  } catch {
    message.error('获取重建数据异常');
  } finally {
    manualRebuildLoading.value = false;
  }
}

function buildAttributesFromGroups(groups: AttributeGroupVO[]): any[] {
  const attributes: any[] = [];
  for (const group of groups) {
    for (const field of group.fields) {
      if (field.values && field.values.length > 0) {
        attributes.push({
          id: field.attrId,
          complex_id: 0,
          values: field.values.map(v => ({
            dictionary_value_id: v.dictionaryValueId,
            value: v.value
          }))
        });
      }
    }
  }
  return attributes;
}

async function handleManualRebuildSubmit() {
  if (
    !manualRebuildForm.name ||
    !manualRebuildForm.descriptionCategoryId ||
    !manualRebuildForm.typeId ||
    !manualRebuildForm.depth ||
    !manualRebuildForm.height ||
    !manualRebuildForm.width ||
    !manualRebuildForm.weight ||
    !manualRebuildForm.images ||
    manualRebuildForm.images.length === 0
  ) {
    message.warning('请补全必填项');
    return;
  }
  manualRebuildForm.attributes = buildAttributesFromGroups(manualRebuildForm.groups || []);

  startLoading();
  try {
    const taskId = await submitManualRebuild(manualRebuildForm);
    message.success(`手动重建已提交，任务ID: ${taskId}`);
    manualRebuildVisible.value = false;
    loadData({ ...searchParams });
  } catch {
    message.error('手动重建提交失败');
  } finally {
    endLoading();
  }
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', { hour12: false });
}

function getStatusTag(status: string) {
  const config = statusMap[status] || { label: status, type: 'default' as const };
  return h(NTag, { size: 'small', type: config.type, round: true }, { default: () => config.label });
}

function getTypeTag(type: number) {
  const config = listingTypeMap[type] || { label: '未知', type: 'default' as const };
  return h(NTag, { size: 'small', type: config.type, round: true }, { default: () => config.label });
}

function getStockTag(row: OzonListingRecordVO) {
  if (row.stockSet === 1) {
    return h(NTag, { size: 'small', type: 'success', round: true }, { default: () => '已设置' });
  }
  return h(NTag, { size: 'small', type: 'default', round: true }, { default: () => '未设置' });
}

function getRebuildStatusTag(status?: string | null) {
  if (!status) return '—';
  const config = rebuildStatusMap[status] || { label: status, type: 'default' as const };
  return h(NTag, { size: 'small', type: config.type, round: true }, { default: () => config.label });
}

function shouldShowRebuild(row: OzonListingRecordVO): boolean {
  return (
    row.listingType === 2 &&
    row.status === 'FAILED' &&
    row.rebuildStatus !== 'PROCESSING' &&
    row.rebuildStatus !== 'SUCCESS' &&
    row.rebuildStatus !== 'FAILED'
  );
}

function shouldShowManualRebuild(row: OzonListingRecordVO): boolean {
  return row.status === 'FAILED' && row.rebuildStatus === 'FAILED';
}

function shouldShowUpdateStatus(row: OzonListingRecordVO): boolean {
  return row.stockSet !== 1;
}

function getUpdateStatusDisabled(row: OzonListingRecordVO): boolean {
  const taskId = getEffectiveTaskId(row);
  if (!taskId) return true;
  return isInCooldown(taskId);
}

const columns = computed<DataTableColumns<OzonListingRecordVO>>(() => [
  { title: 'ID', key: 'id', width: 70, sorter: true },
  { title: '来源商品ID', key: 'productId', width: 120, ellipsis: { tooltip: true }, sorter: true },
  {
    title: '新商品ID',
    key: 'newProductId',
    width: 120,
    ellipsis: { tooltip: true },
    sorter: true,
    render: (row: OzonListingRecordVO) => row.newProductId || '—'
  },
  {
    title: '新SKU',
    key: 'newSku',
    width: 110,
    ellipsis: { tooltip: true },
    render: (row: OzonListingRecordVO) => (row.newSku && row.newSku > 0 ? row.newSku : '—')
  },
  {
    title: '类型',
    key: 'listingType',
    width: 80,
    align: 'center',
    sorter: true,
    render: (row: OzonListingRecordVO) => getTypeTag(row.listingType)
  },
  {
    title: '状态',
    key: 'status',
    width: 90,
    align: 'center',
    sorter: true,
    render: (row: OzonListingRecordVO) => getStatusTag(row.status)
  },
  {
    title: '库存状态',
    key: 'stockSet',
    width: 100,
    align: 'center',
    sorter: true,
    render: (row: OzonListingRecordVO) => getStockTag(row)
  },
  {
    title: '重建状态',
    key: 'rebuildStatus',
    width: 110,
    align: 'center',
    render: (row: OzonListingRecordVO) => getRebuildStatusTag(row.rebuildStatus)
  },
  { title: '操作人', key: 'operator', width: 90, ellipsis: { tooltip: true }, sorter: true },
  {
    title: '创建时间',
    key: 'createdAt',
    width: 150,
    sorter: true,
    render: (row: OzonListingRecordVO) => formatDateTime(row.createdAt)
  },
  {
    title: '操作',
    key: 'actions',
    width: 180,
    align: 'center',
    fixed: 'right',
    render: (row: OzonListingRecordVO) => {
      const buttons = [
        h(
          NButton,
          { size: 'small', type: 'primary', ghost: true, onClick: () => handleViewDetail(row) },
          { default: () => '详情' }
        )
      ];
      if (shouldShowUpdateStatus(row)) {
        const taskId = getEffectiveTaskId(row);
        const disabled = getUpdateStatusDisabled(row);
        const remain = disabled && taskId ? getCooldownRemaining(taskId) : 0;
        buttons.push(
          h(
            NButton,
            {
              size: 'small',
              type: 'warning',
              ghost: true,
              loading: updatingTaskId.value === taskId,
              disabled: disabled || updatingTaskId.value === taskId,
              onClick: () => handleManualUpdate(row)
            },
            { default: () => (disabled && remain > 0 ? `更新状态(${remain}s)` : '更新状态') }
          )
        );
      }
      if (shouldShowRebuild(row)) {
        buttons.push(
          h(
            NButton,
            {
              size: 'small',
              type: 'success',
              ghost: true,
              loading: rebuildingRecordId.value === row.id,
              disabled: rebuildingRecordId.value === row.id,
              onClick: () => handleManualRebuild(row)
            },
            { default: () => '重建' }
          )
        );
      }
      if (shouldShowManualRebuild(row)) {
        buttons.push(
          h(
            NButton,
            {
              size: 'small',
              type: 'error',
              ghost: true,
              style: 'border-color: #f56c6c; color: #f56c6c;',
              loading: manualRebuildLoading.value && manualRebuildForm.recordId === row.id,
              disabled: manualRebuildLoading.value,
              onClick: () => openManualRebuild(row)
            },
            { default: () => '手动重建' }
          )
        );
      }
      return h('div', { class: 'flex flex-col gap-4px items-stretch' }, buttons);
    }
  }
]);

onMounted(() => {
  loadData();
  timer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});

onBeforeUnmount(() => {
  isUnmounted = true;
  if (abortController) abortController.abort();
  if (timer) clearInterval(timer);
});
</script>

<template>
  <div class="p-16px">
    <NCard :bordered="false" class="rounded-12px shadow-sm mb-16px" size="small">
      <div class="grid grid-cols-12 gap-x-16px gap-y-12px items-start">
        <div class="col-span-3">
          <div class="flex items-center gap-8px">
            <span class="text-13px text-gray-500 whitespace-nowrap" style="min-width: 65px">来源商品ID</span>
            <NInput
              v-model:value="searchParams.productId"
              placeholder="来源商品ID"
              clearable
              @keydown.enter="handleSearch"
            />
          </div>
        </div>
        <div class="col-span-3">
          <div class="flex items-center gap-8px">
            <span class="text-13px text-gray-500 whitespace-nowrap" style="min-width: 65px">新商品ID</span>
            <NInput
              v-model:value="searchParams.newProductId"
              placeholder="新商品ID"
              clearable
              @keydown.enter="handleSearch"
            />
          </div>
        </div>
        <div class="col-span-3">
          <div class="flex items-center gap-8px">
            <span class="text-13px text-gray-500 whitespace-nowrap" style="min-width: 65px">任务ID</span>
            <NInput
              v-model:value="searchParams.ozonTaskId"
              placeholder="Ozon任务ID"
              clearable
              @keydown.enter="handleSearch"
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
          <NButton text type="primary" @click="expanded = !expanded">
            {{ expanded ? '收起' : '展开' }}
            <SvgIcon :icon="expanded ? 'ph:caret-up' : 'ph:caret-down'" class="ml-2" />
          </NButton>
        </div>
      </div>
      <NCollapseTransition :show="expanded">
        <div class="grid grid-cols-12 gap-x-16px gap-y-12px mt-12px pt-12px border-t border-dashed border-gray-200">
          <div class="col-span-3">
            <div class="flex items-center gap-8px">
              <span class="text-13px text-gray-500 whitespace-nowrap" style="min-width: 65px">货号</span>
              <NInput
                v-model:value="searchParams.offerId"
                placeholder="货号 offer_id"
                clearable
                @keydown.enter="handleSearch"
              />
            </div>
          </div>
          <div class="col-span-3">
            <div class="flex items-center gap-8px">
              <span class="text-13px text-gray-500 whitespace-nowrap" style="min-width: 65px">类型</span>
              <NSelect
                v-model:value="searchParams.listingType"
                :options="listingTypeOptions"
                clearable
                placeholder="全部类型"
              />
            </div>
          </div>
          <div class="col-span-3">
            <div class="flex items-center gap-8px">
              <span class="text-13px text-gray-500 whitespace-nowrap" style="min-width: 65px">状态</span>
              <NSelect v-model:value="searchParams.status" :options="statusOptions" clearable placeholder="全部状态" />
            </div>
          </div>
          <div class="col-span-3">
            <div class="flex items-center gap-8px">
              <span class="text-13px text-gray-500 whitespace-nowrap" style="min-width: 65px">操作人</span>
              <NInput
                v-model:value="searchParams.operator"
                placeholder="操作人"
                clearable
                @keydown.enter="handleSearch"
              />
            </div>
          </div>
          <div class="col-span-6">
            <div class="flex items-center gap-8px">
              <span class="text-13px text-gray-500 whitespace-nowrap" style="min-width: 65px">创建时间</span>
              <NDatePicker
                v-model:value="dateRange"
                type="datetimerange"
                clearable
                style="width: 100%"
                :default-time="['00:00:00', '23:59:59']"
                @update:value="handleSearch"
              />
            </div>
          </div>
        </div>
      </NCollapseTransition>
    </NCard>

    <NCard :bordered="false" class="rounded-12px shadow-sm" size="small">
      <template #header>
        <div class="flex items-center justify-between w-full">
          <span class="flex items-center gap-8px text-16px font-semibold text-gray-800">
            <SvgIcon icon="ph:list-bullets" class="text-18px text-[#667eea]" />
            Ozon 上架记录
          </span>
          <NButton size="small" :disabled="loading" @click="loadData()">
            <template #icon>
              <SvgIcon icon="ph:arrows-clockwise" />
            </template>
            刷新
          </NButton>
        </div>
      </template>
      <NDataTable
        :columns="columns"
        :data="recordList"
        :loading="loading"
        :pagination="pagination"
        :remote="true"
        :scroll-x="1450"
        striped
        hoverable
        @update:sorter="handleSorterChange"
      />
    </NCard>

    <NModal
      v-model:show="detailVisible"
      preset="card"
      title="上架记录详情"
      style="max-width: 700px; width: 90%"
      :bordered="false"
      :mask-closable="true"
    >
      <NDescriptions v-if="currentRecord" :column="2" bordered size="small" label-placement="left">
        <NDescriptionsItem label="ID">{{ currentRecord.id }}</NDescriptionsItem>
        <NDescriptionsItem label="来源商品ID">{{ currentRecord.productId }}</NDescriptionsItem>
        <NDescriptionsItem label="新商品ID">{{ currentRecord.newProductId || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="新SKU">
          {{ currentRecord.newSku && currentRecord.newSku > 0 ? currentRecord.newSku : '—' }}
        </NDescriptionsItem>
        <NDescriptionsItem label="店铺ID">{{ currentRecord.shopId }}</NDescriptionsItem>
        <NDescriptionsItem label="上架类型">
          <NTag size="small" :type="listingTypeMap[currentRecord.listingType]?.type || 'default'" round>
            {{ listingTypeMap[currentRecord.listingType]?.label || '未知' }}
          </NTag>
        </NDescriptionsItem>
        <NDescriptionsItem label="任务ID">{{ currentRecord.ozonTaskId || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="货号">{{ currentRecord.offerId || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="来源SKU">{{ currentRecord.sourceSku || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="状态">
          <NTag size="small" :type="statusMap[currentRecord.status]?.type || 'default'" round>
            {{ statusMap[currentRecord.status]?.label || currentRecord.status }}
          </NTag>
        </NDescriptionsItem>
        <NDescriptionsItem label="库存状态">{{ currentRecord.stockSet === 1 ? '已设置' : '未设置' }}</NDescriptionsItem>
        <NDescriptionsItem label="仓库ID">{{ currentRecord.stockWarehouseId || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="库存更新时间">{{ formatDateTime(currentRecord.stockUpdatedAt) }}</NDescriptionsItem>
        <NDescriptionsItem label="重建状态">
          <NTag
            v-if="currentRecord.rebuildStatus"
            size="small"
            :type="rebuildStatusMap[currentRecord.rebuildStatus]?.type || 'default'"
            round
          >
            {{ rebuildStatusMap[currentRecord.rebuildStatus]?.label || currentRecord.rebuildStatus }}
          </NTag>
          <span v-else>—</span>
        </NDescriptionsItem>
        <NDescriptionsItem label="重建任务ID">{{ currentRecord.rebuildTaskId || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="重建货号">{{ currentRecord.rebuildOfferId || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="重建新商品ID">{{ currentRecord.rebuildNewProductId || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="重建错误信息" :span="2">
          <span class="text-red-500">{{ currentRecord.rebuildErrorMsg || '无' }}</span>
        </NDescriptionsItem>
        <NDescriptionsItem label="操作人">{{ currentRecord.operator || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="创建时间">{{ formatDateTime(currentRecord.createdAt) }}</NDescriptionsItem>
        <NDescriptionsItem label="更新时间">{{ formatDateTime(currentRecord.updatedAt) }}</NDescriptionsItem>
        <NDescriptionsItem label="错误信息" :span="2">
          <span class="text-red-500">{{ currentRecord.errorMsg || '无' }}</span>
        </NDescriptionsItem>
      </NDescriptions>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="detailVisible = false">关闭</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 手动二次重建主弹窗 -->
    <NModal
      v-model:show="manualRebuildVisible"
      preset="card"
      title="手动二次重建商品"
      style="max-width: 900px; width: 90%"
      :bordered="false"
      :mask-closable="true"
    >
      <NForm :model="manualRebuildForm" label-placement="left" label-width="120px" require-mark-placement="right">
        <NFormItem label="货号(offerId)">
          <NInput v-model:value="manualRebuildForm.offerId" placeholder="留空自动生成" clearable />
        </NFormItem>
        <NFormItem label="商品名称" required>
          <NInput v-model:value="manualRebuildForm.name" />
        </NFormItem>
        <NFormItem label="商品描述">
          <NInput v-model:value="manualRebuildForm.description" type="textarea" :rows="3" />
        </NFormItem>
        <NFormItem label="类目ID" required>
          <NInputNumber v-model:value="manualRebuildForm.descriptionCategoryId" :min="1" class="w-full" />
        </NFormItem>
        <NFormItem label="类型ID" required>
          <NInputNumber v-model:value="manualRebuildForm.typeId" :min="1" class="w-full" />
        </NFormItem>
        <NFormItem label="价格(RUB)" required>
          <NInput v-model:value="manualRebuildForm.price" />
        </NFormItem>
        <NFormItem label="原价(RUB)">
          <NInput v-model:value="manualRebuildForm.oldPrice" placeholder="可选" />
        </NFormItem>
        <NFormItem label="增值税率">
          <NInput v-model:value="manualRebuildForm.vat" placeholder="如 0, 0.1, 0.2" />
        </NFormItem>
        <NFormItem label="货币代码">
          <NInput v-model:value="manualRebuildForm.currencyCode" />
        </NFormItem>
        <NFormItem label="长(mm)" required>
          <NInputNumber v-model:value="manualRebuildForm.depth" :min="1" class="w-full" />
        </NFormItem>
        <NFormItem label="宽(mm)" required>
          <NInputNumber v-model:value="manualRebuildForm.width" :min="1" class="w-full" />
        </NFormItem>
        <NFormItem label="高(mm)" required>
          <NInputNumber v-model:value="manualRebuildForm.height" :min="1" class="w-full" />
        </NFormItem>
        <NFormItem label="重量(g)" required>
          <NInputNumber v-model:value="manualRebuildForm.weight" :min="1" class="w-full" />
        </NFormItem>
        <NFormItem label="尺寸单位">
          <NInput v-model:value="manualRebuildForm.dimensionUnit" />
        </NFormItem>
        <NFormItem label="重量单位">
          <NInput v-model:value="manualRebuildForm.weightUnit" />
        </NFormItem>
        <NFormItem label="图片URL(逗号分隔)" required>
          <NInput v-model:value="manualRebuildImages" placeholder="https://...,https://..." />
        </NFormItem>
        <NFormItem label="主图URL">
          <NInput v-model:value="manualRebuildForm.primaryImage" placeholder="留空使用第一张图片" />
        </NFormItem>
        <NFormItem label="条码">
          <NInput v-model:value="manualRebuildForm.barcode" placeholder="可选" />
        </NFormItem>
        <NFormItem label="商品特征">
          <NButton @click="attributeModalVisible = true">编辑商品特征</NButton>
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="manualRebuildVisible = false">取消</NButton>
          <NButton type="primary" :loading="loading" @click="handleManualRebuildSubmit">提交重建</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 商品特征编辑弹窗 -->
    <NModal
      v-model:show="attributeModalVisible"
      preset="card"
      title="编辑商品特征"
      style="max-width: 1200px; width: 90%; max-height: 80vh; overflow-y: auto"
      :bordered="false"
      :mask-closable="false"
    >
      <AttributeForm
        v-model="manualRebuildForm.groups"
        :client-id="manualRebuildClientId"
        :description-category-id="manualRebuildForm.descriptionCategoryId"
        :type-id="manualRebuildForm.typeId"
      />
      <template #footer>
        <NSpace justify="end">
          <NButton type="primary" @click="attributeModalVisible = false">完成</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>
