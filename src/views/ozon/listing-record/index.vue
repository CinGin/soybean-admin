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
  NPopover,
  type DataTableColumns
} from 'naive-ui';
import { fetchOzonListingRecords, manualCheckStatus } from '@/service/api/ozon-listing-record';
import type { OzonListingRecordVO, OzonListingRecordQuery } from '@/typings/api/ozon-listing-record';

defineOptions({ name: 'OzonListingRecord' });

const message = useMessage();
const { loading, startLoading, endLoading } = useLoading();

// ========== 数据状态 ==========
const recordList = ref<OzonListingRecordVO[]>([]);
const total = ref(0);
const expanded = ref(false);
const detailVisible = ref(false);
const currentRecord = ref<OzonListingRecordVO | null>(null);
const updatingTaskId = ref<string | null>(null); // 正在手动更新的任务ID

// ========== 查询参数 ==========
const searchParams = reactive<OzonListingRecordQuery>({
  pageNo: 1,
  pageSize: 20,
  productId: '',
  shopId: '',
  listingType: undefined,
  ozonTaskId: '',
  offerId: '',
  status: undefined,
  operator: '',
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
      sortDir: params.sortDir || searchParams.sortDir || 'desc'
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
  searchParams.shopId = '';
  searchParams.listingType = undefined;
  searchParams.ozonTaskId = '';
  searchParams.offerId = '';
  searchParams.status = undefined;
  searchParams.operator = '';
  searchParams.startTime = undefined;
  searchParams.endTime = undefined;
  searchParams.pageNo = 1;
  searchParams.pageSize = 20;
  searchParams.sortField = 'createdAt';
  searchParams.sortDir = 'desc';
  loadData();
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
    shopId: 'shopId',
    listingType: 'listingType',
    ozonTaskId: 'ozonTaskId',
    offerId: 'offerId',
    status: 'status',
    operator: 'operator',
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

/**
 * 手动更新状态：调用后端接口，等待3秒后刷新列表
 */
async function handleManualUpdate(row: OzonListingRecordVO) {
  if (!row.ozonTaskId) {
    message.warning('该记录缺少任务ID，无法更新');
    return;
  }
  if (updatingTaskId.value === row.ozonTaskId) return; // 防止重复点击

  updatingTaskId.value = row.ozonTaskId;
  try {
    await manualCheckStatus(row.ozonTaskId);
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

function formatDateTime(dateStr?: string): string {
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

const columns = computed<DataTableColumns<OzonListingRecordVO>>(() => [
  { title: 'ID', key: 'id', width: 80, sorter: true },
  { title: '商品ID', key: 'productId', width: 120, ellipsis: { tooltip: true }, sorter: true },
  { title: '店铺ID', key: 'shopId', width: 110, ellipsis: { tooltip: true }, sorter: true },
  {
    title: '类型',
    key: 'listingType',
    width: 90,
    align: 'center',
    sorter: true,
    render: (row: OzonListingRecordVO) => getTypeTag(row.listingType)
  },
  {
    title: '任务ID',
    key: 'ozonTaskId',
    width: 130,
    ellipsis: { tooltip: true },
    sorter: true,
    render: (row: OzonListingRecordVO) => row.ozonTaskId || '—'
  },
  { title: '货号', key: 'offerId', width: 120, ellipsis: { tooltip: true }, sorter: true },
  { title: '来源SKU', key: 'sourceSku', width: 110, ellipsis: { tooltip: true } },
  {
    title: '状态',
    key: 'status',
    width: 100,
    align: 'center',
    sorter: true,
    render: (row: OzonListingRecordVO) => getStatusTag(row.status)
  },
  {
    title: '错误信息',
    key: 'errorMsg',
    width: 200,
    ellipsis: { tooltip: true },
    render: (row: OzonListingRecordVO) => {
      if (!row.errorMsg) return '—';
      return h(
        NPopover,
        { trigger: 'hover', style: 'max-width: 400px;' },
        {
          trigger: () => h('span', { class: 'text-red-500 cursor-help' }, '查看错误'),
          default: () => row.errorMsg
        }
      );
    }
  },
  { title: '操作人', key: 'operator', width: 100, ellipsis: { tooltip: true }, sorter: true },
  {
    title: '创建时间',
    key: 'createdAt',
    width: 160,
    sorter: true,
    render: (row: OzonListingRecordVO) => formatDateTime(row.createdAt)
  },
  {
    title: '更新时间',
    key: 'updatedAt',
    width: 160,
    sorter: true,
    render: (row: OzonListingRecordVO) => formatDateTime(row.updatedAt)
  },
  {
    title: '操作',
    key: 'actions',
    width: 160,
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

      // 仅当状态为 PENDING 时显示“更新状态”按钮
      if (row.status === 'PENDING') {
        buttons.push(
          h(
            NButton,
            {
              size: 'small',
              type: 'warning',
              ghost: true,
              loading: updatingTaskId.value === row.ozonTaskId,
              disabled: updatingTaskId.value === row.ozonTaskId,
              onClick: () => handleManualUpdate(row)
            },
            { default: () => '更新状态' }
          )
        );
      }

      return h('div', { class: 'flex flex-col gap-4px items-stretch' }, buttons);
    }
  }
]);

onMounted(() => {
  loadData();
});

onBeforeUnmount(() => {
  isUnmounted = true;
  if (abortController) abortController.abort();
});
</script>

<template>
  <div class="p-16px">
    <!-- 搜索卡片 -->
    <NCard :bordered="false" class="rounded-12px shadow-sm mb-16px" size="small">
      <div class="grid grid-cols-12 gap-x-16px gap-y-12px items-start">
        <div class="col-span-3">
          <div class="flex items-center gap-8px">
            <span class="text-13px text-gray-500 whitespace-nowrap" style="min-width: 65px">商品ID</span>
            <NInput
              v-model:value="searchParams.productId"
              placeholder="商品ID"
              clearable
              @keydown.enter="handleSearch"
            />
          </div>
        </div>
        <div class="col-span-3">
          <div class="flex items-center gap-8px">
            <span class="text-13px text-gray-500 whitespace-nowrap" style="min-width: 65px">店铺ID</span>
            <NInput v-model:value="searchParams.shopId" placeholder="店铺ID" clearable @keydown.enter="handleSearch" />
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
            <template #icon><SvgIcon icon="ph:magnifying-glass" /></template>
            搜索
          </NButton>
          <NButton :disabled="loading" @click="handleReset">
            <template #icon><SvgIcon icon="ph:arrow-counter-clockwise" /></template>
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

    <!-- 数据表格卡片 -->
    <NCard :bordered="false" class="rounded-12px shadow-sm" size="small">
      <template #header>
        <div class="flex items-center justify-between w-full">
          <span class="flex items-center gap-8px text-16px font-semibold text-gray-800">
            <SvgIcon icon="ph:list-bullets" class="text-18px text-[#667eea]" />
            Ozon 上架记录
          </span>
          <NButton size="small" :disabled="loading" @click="loadData()">
            <template #icon><SvgIcon icon="ph:arrows-clockwise" /></template>
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

    <!-- 详情弹窗 -->
    <NModal
      v-model:show="detailVisible"
      preset="card"
      title="上架记录详情"
      style="max-width: 600px; width: 90%"
      :bordered="false"
      :mask-closable="true"
    >
      <NDescriptions v-if="currentRecord" :column="2" bordered size="small" label-placement="left">
        <NDescriptionsItem label="ID">{{ currentRecord.id }}</NDescriptionsItem>
        <NDescriptionsItem label="商品ID">{{ currentRecord.productId }}</NDescriptionsItem>
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
  </div>
</template>
