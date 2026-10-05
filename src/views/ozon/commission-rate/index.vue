<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue';
import type { DataTableColumns, PaginationProps } from 'naive-ui';
import { NButton, NCard, NDataTable, NInput, NInputNumber, NPopconfirm, NSpace, NTag, useMessage } from 'naive-ui';
import { fetchCommissionRatePage, fetchDeleteCommissionRate } from '@/service/api/ozon-auto-listing';
import RateEditModal from './modules/rate-edit-modal.vue';

defineOptions({ name: 'OzonCommissionRate' });

const message = useMessage();

const loading = ref(false);
const list = ref<Api.AutoListing.CommissionRate[]>([]);

const query = reactive<Api.AutoListing.CommissionRateQuery>({
  pageNo: 1,
  pageSize: 20,
  categoryId: null,
  categoryL1Cn: '',
  categoryL2Cn: '',
  keyword: ''
});

const pagination = reactive<PaginationProps>({
  page: 1,
  pageSize: 20,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 20, 50, 100],
  onChange: (page: number) => {
    query.pageNo = page;
    pagination.page = page;
    loadData();
  },
  onUpdatePageSize: (size: number) => {
    query.pageSize = size;
    query.pageNo = 1;
    pagination.pageSize = size;
    pagination.page = 1;
    loadData();
  }
});

async function loadData() {
  loading.value = true;
  try {
    const params: Record<string, any> = {};
    Object.entries(query).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') {
        params[k] = v;
      }
    });

    const { data, error } = await fetchCommissionRatePage(params as Api.AutoListing.CommissionRateQuery);
    if (!error && data) {
      list.value = data.records ?? [];
      pagination.itemCount = data.total ?? 0;
    }
  } finally {
    loading.value = false;
  }
}

function handleResetQuery() {
  query.categoryId = null;
  query.categoryL1Cn = '';
  query.categoryL2Cn = '';
  query.keyword = '';
  query.pageNo = 1;
  pagination.page = 1;
  loadData();
}

async function handleDelete(row: Api.AutoListing.CommissionRate) {
  const { error } = await fetchDeleteCommissionRate(row.id!);
  if (!error) {
    message.success(`已删除 categoryId=${row.categoryId}`);
    loadData();
  }
}

const modalVisible = ref(false);
const editingRow = ref<Api.AutoListing.CommissionRate | null>(null);

function openAdd() {
  editingRow.value = null;
  modalVisible.value = true;
}

function openEdit(row: Api.AutoListing.CommissionRate) {
  editingRow.value = { ...row };
  modalVisible.value = true;
}

function fmtRate(v: number | null | undefined) {
  if (v === null || v === undefined) return '-';
  return `${(v * 100).toFixed(2)}%`;
}

const columns: DataTableColumns<Api.AutoListing.CommissionRate> = [
  { title: 'ID', key: 'id', width: 70 },
  { title: '类目ID', key: 'categoryId', width: 100 },

  // ★ 新增：一级类目（中文）
  {
    title: '一级类目',
    key: 'categoryL1Cn',
    width: 140,
    ellipsis: { tooltip: true },
    render: r => r.categoryL1Cn || '-'
  },
  // ★ 新增：二级类目（中文）
  {
    title: '二级类目',
    key: 'categoryL2Cn',
    width: 160,
    ellipsis: { tooltip: true },
    render: r => r.categoryL2Cn || '-'
  },

  { title: '三级类目（俄）', key: 'categoryL3Ru', minWidth: 200, ellipsis: { tooltip: true } },
  { title: '三级类目（中）', key: 'categoryL3Cn', minWidth: 180, ellipsis: { tooltip: true } },
  { title: '品牌', key: 'brand', width: 80, render: r => r.brand ?? 'All' },
  {
    title: 'RFBS 费率',
    key: 'rfbs',
    children: [
      {
        title: '≤1500₽',
        key: 'rfbsRate01500',
        width: 100,
        render: r =>
          h(NTag, { size: 'small', bordered: false, type: 'info' }, { default: () => fmtRate(r.rfbsRate01500) })
      },
      {
        title: '1500~5000₽',
        key: 'rfbsRate15005000',
        width: 110,
        render: r =>
          h(NTag, { size: 'small', bordered: false, type: 'info' }, { default: () => fmtRate(r.rfbsRate15005000) })
      },
      {
        title: '>5000₽',
        key: 'rfbsRate5000Plus',
        width: 100,
        render: r =>
          h(NTag, { size: 'small', bordered: false, type: 'info' }, { default: () => fmtRate(r.rfbsRate5000Plus) })
      }
    ]
  },
  { title: '更新时间', key: 'updatedAt', width: 170 },
  {
    title: '操作',
    key: 'actions',
    width: 140,
    fixed: 'right',
    render: row =>
      h(
        NSpace,
        { size: 6, wrap: false },
        {
          default: () => [
            h(NButton, { size: 'small', type: 'primary', onClick: () => openEdit(row) }, { default: () => '编辑' }),
            h(
              NPopconfirm,
              { onPositiveClick: () => handleDelete(row) },
              {
                trigger: () => h(NButton, { size: 'small', type: 'error' }, { default: () => '删除' }),
                default: () => `确定删除 categoryId=${row.categoryId} 的费率吗？`
              }
            )
          ]
        }
      )
  }
];

onMounted(loadData);
</script>

<template>
  <div class="h-full flex-col gap-16px p-16px">
    <!-- 筛选栏 -->
    <NCard :bordered="false" size="small">
      <NSpace align="center" :wrap="true">
        <NInputNumber
          v-model:value="query.categoryId"
          placeholder="类目ID"
          clearable
          :show-button="false"
          class="w-160px"
        />
        <NInput
          v-model:value="query.categoryL1Cn"
          placeholder="一级类目（中文）"
          clearable
          class="w-180px"
          @keyup.enter="loadData"
        />
        <NInput
          v-model:value="query.categoryL2Cn"
          placeholder="二级类目（中文）"
          clearable
          class="w-180px"
          @keyup.enter="loadData"
        />
        <NInput
          v-model:value="query.keyword"
          placeholder="三级类目关键词（中/俄）"
          clearable
          class="w-220px"
          @keyup.enter="loadData"
        />
        <NButton type="primary" @click="loadData">查询</NButton>
        <NButton @click="handleResetQuery">重置</NButton>
        <NButton type="success" @click="openAdd">+ 新增费率</NButton>
      </NSpace>
    </NCard>

    <!-- 表格 -->
    <NCard :bordered="false" size="small" class="flex-1">
      <NDataTable
        remote
        :loading="loading"
        :columns="columns"
        :data="list"
        :pagination="pagination"
        :row-key="(r: Api.AutoListing.CommissionRate) => r.id!"
        :scroll-x="1800"
        size="small"
        striped
      />
    </NCard>

    <!-- 新增/编辑弹窗 -->
    <RateEditModal v-model:visible="modalVisible" :row="editingRow" @saved="loadData" />
  </div>
</template>

<style scoped></style>
