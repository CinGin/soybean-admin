<script setup lang="ts">
import { ref, reactive, computed, onMounted, h } from 'vue';
import { useLoading } from '@sa/hooks';
import {
  useMessage,
  NButton,
  NTag,
  NDataTable,
  NCard,
  NInput,
  NSelect,
  NModal,
  NForm,
  NFormItem,
  NSpace,
  NPopconfirm,
  type DataTableColumns
} from 'naive-ui';
import {
  fetchSellerInfoList,
  addSeller,
  updateSellerName,
  deleteSeller,
  type SellerInfoVO,
  type SellerInfoQuery
} from '@/service/api/ozon-seller-info';

defineOptions({ name: 'OzonSellerManage' });

const message = useMessage();
const { loading, startLoading, endLoading } = useLoading();

// ========== 数据状态 ==========
const sellerList = ref<SellerInfoVO[]>([]);
const total = ref(0);

// 搜索参数
const searchParams = reactive<SellerInfoQuery>({
  pageNo: 1,
  pageSize: 20,
  companyName: '',
  inn: '',
  country: '',
  currency: '',
  isPremium: undefined,
  subscriptionType: ''
});

// 弹窗状态
const addModalVisible = ref(false);
const editModalVisible = ref(false);
const currentEditSeller = ref<SellerInfoVO | null>(null);
const addForm = reactive({
  clientId: '',
  apiKey: ''
});
const editForm = reactive({
  companyName: ''
});

const subscriptionTypeOptions = [
  { label: '全部', value: '' },
  { label: 'UNKNOWN', value: 'UNKNOWN' },
  { label: 'UNSPECIFIED', value: 'UNSPECIFIED' },
  { label: 'PREMIUM', value: 'PREMIUM' },
  { label: 'PREMIUM_LITE', value: 'PREMIUM_LITE' },
  { label: 'PREMIUM_PLUS', value: 'PREMIUM_PLUS' },
  { label: 'PREMIUM_PRO', value: 'PREMIUM_PRO' }
];

const countryOptions = [
  { label: '全部', value: '' },
  { label: 'CHN', value: 'CHN' },
  { label: 'RUS', value: 'RUS' },
  { label: 'Other', value: 'OTHER' }
];

// ========== 方法 ==========
async function loadData() {
  startLoading();
  try {
    const { data, error } = await fetchSellerInfoList(searchParams);
    if (!error && data) {
      sellerList.value = data.records || [];
      total.value = data.total || 0;
    }
  } catch {
    message.error('加载店铺列表失败');
  } finally {
    endLoading();
  }
}

function handleSearch() {
  searchParams.pageNo = 1;
  loadData();
}

function handleReset() {
  searchParams.companyName = '';
  searchParams.inn = '';
  searchParams.country = '';
  searchParams.currency = '';
  searchParams.isPremium = undefined;
  searchParams.subscriptionType = '';
  searchParams.pageNo = 1;
  loadData();
}

function handlePageChange(page: number) {
  searchParams.pageNo = page;
  loadData();
}

function handlePageSizeChange(size: number) {
  searchParams.pageSize = size;
  searchParams.pageNo = 1;
  loadData();
}

function openAddModal() {
  addForm.clientId = '';
  addForm.apiKey = '';
  addModalVisible.value = true;
}

async function handleAddSubmit() {
  if (!addForm.clientId.trim() || !addForm.apiKey.trim()) {
    message.warning('请填写完整的 Client-Id 和 Api-Key');
    return;
  }
  startLoading();
  try {
    await addSeller({ clientId: addForm.clientId.trim(), apiKey: addForm.apiKey.trim() });
    message.success('店铺添加成功');
    addModalVisible.value = false;
    loadData();
  } catch {
    message.error('添加失败，可能店铺已存在');
  } finally {
    endLoading();
  }
}

function openEditModal(row: SellerInfoVO) {
  currentEditSeller.value = row;
  editForm.companyName = row.companyName;
  editModalVisible.value = true;
}

async function handleEditSubmit() {
  if (!currentEditSeller.value || !editForm.companyName.trim()) {
    message.warning('店铺名称不能为空');
    return;
  }
  startLoading();
  try {
    await updateSellerName(currentEditSeller.value.id, editForm.companyName.trim());
    message.success('名称修改成功');
    editModalVisible.value = false;
    loadData();
  } catch {
    message.error('修改失败');
  } finally {
    endLoading();
  }
}

async function handleDelete(row: SellerInfoVO) {
  startLoading();
  try {
    await deleteSeller(row.id);
    message.success('删除成功');
    loadData();
  } catch {
    message.error('删除失败');
  } finally {
    endLoading();
  }
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

const columns = computed<DataTableColumns<SellerInfoVO>>(() => [
  { title: 'ID', key: 'id', width: 60 },
  { title: '公司名称', key: 'companyName', width: 200, ellipsis: { tooltip: true } },
  { title: 'INN', key: 'inn', width: 140, ellipsis: { tooltip: true } },
  { title: 'Client-Id', key: 'clientId', width: 120, ellipsis: { tooltip: true } },
  { title: '国家', key: 'country', width: 80 },
  { title: '货币', key: 'currency', width: 80 },
  {
    title: '订阅类型',
    key: 'subscriptionType',
    width: 120,
    render: (row: SellerInfoVO) => {
      const typeMap: Record<string, { label: string; type: 'default' | 'info' | 'success' | 'warning' | 'error' }> = {
        PREMIUM: { label: 'Premium', type: 'success' },
        PREMIUM_LITE: { label: 'Premium Lite', type: 'info' },
        PREMIUM_PLUS: { label: 'Premium Plus', type: 'info' },
        PREMIUM_PRO: { label: 'Premium Pro', type: 'warning' },
        UNSPECIFIED: { label: '未指定', type: 'default' },
        UNKNOWN: { label: '未知', type: 'default' }
      };
      const config = typeMap[row.subscriptionType] || { label: row.subscriptionType || '—', type: 'default' as const };
      return h(NTag, { size: 'small', type: config.type, round: true }, { default: () => config.label });
    }
  },
  {
    title: '高级订阅',
    key: 'isPremium',
    width: 90,
    align: 'center',
    render: (row: SellerInfoVO) =>
      row.isPremium ? h(NTag, { size: 'small', type: 'success', round: true }, { default: () => '是' }) : '否'
  },
  {
    title: '更新时间',
    key: 'updatedAt',
    width: 160,
    render: (row: SellerInfoVO) =>
      row.updatedAt ? new Date(row.updatedAt).toLocaleString('zh-CN', { hour12: false }) : '—'
  },
  {
    title: '操作',
    key: 'actions',
    width: 160,
    align: 'center',
    fixed: 'right',
    render: (row: SellerInfoVO) => {
      return h('div', { class: 'flex gap-8px justify-center' }, [
        h(
          NButton,
          { size: 'small', type: 'primary', ghost: true, onClick: () => openEditModal(row) },
          { default: () => '编辑' }
        ),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDelete(row) },
          {
            trigger: () => h(NButton, { size: 'small', type: 'error', ghost: true }, { default: () => '删除' }),
            default: () => '确认删除该店铺吗？'
          }
        )
      ]);
    }
  }
]);

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="p-16px">
    <!-- 搜索卡片 -->
    <NCard :bordered="false" class="rounded-12px shadow-sm mb-16px" size="small">
      <div class="grid grid-cols-12 gap-x-16px gap-y-12px items-start">
        <div class="col-span-3">
          <div class="flex items-center gap-8px">
            <span class="text-13px text-gray-500 whitespace-nowrap" style="min-width: 65px">公司名称</span>
            <NInput
              v-model:value="searchParams.companyName"
              placeholder="公司名称"
              clearable
              @keydown.enter="handleSearch"
            />
          </div>
        </div>
        <div class="col-span-2">
          <div class="flex items-center gap-8px">
            <span class="text-13px text-gray-500 whitespace-nowrap" style="min-width: 40px">INN</span>
            <NInput v-model:value="searchParams.inn" placeholder="INN" clearable @keydown.enter="handleSearch" />
          </div>
        </div>
        <div class="col-span-2">
          <div class="flex items-center gap-8px">
            <span class="text-13px text-gray-500 whitespace-nowrap" style="min-width: 40px">国家</span>
            <NSelect v-model:value="searchParams.country" :options="countryOptions" clearable placeholder="全部" />
          </div>
        </div>
        <div class="col-span-2">
          <div class="flex items-center gap-8px">
            <span class="text-13px text-gray-500 whitespace-nowrap" style="min-width: 40px">订阅类型</span>
            <NSelect
              v-model:value="searchParams.subscriptionType"
              :options="subscriptionTypeOptions"
              clearable
              placeholder="全部"
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
          <NButton type="success" @click="openAddModal">
            <template #icon>
              <SvgIcon icon="ph:plus" />
            </template>
            添加店铺
          </NButton>
        </div>
      </div>
    </NCard>

    <!-- 表格卡片 -->
    <NCard :bordered="false" class="rounded-12px shadow-sm" size="small">
      <template #header>
        <div class="flex items-center justify-between w-full">
          <span class="flex items-center gap-8px text-16px font-semibold text-gray-800">
            <SvgIcon icon="ph:storefront" class="text-18px text-[#667eea]" />
            店铺管理
          </span>
          <NButton size="small" :disabled="loading" @click="loadData">
            <template #icon>
              <SvgIcon icon="ph:arrows-clockwise" />
            </template>
            刷新
          </NButton>
        </div>
      </template>
      <NDataTable
        :columns="columns"
        :data="sellerList"
        :loading="loading"
        :pagination="pagination"
        :remote="true"
        :scroll-x="1200"
        striped
        hoverable
      />
    </NCard>

    <!-- 添加店铺弹窗 -->
    <NModal
      v-model:show="addModalVisible"
      preset="card"
      title="添加店铺"
      style="max-width: 480px; width: 90%"
      :bordered="false"
      :mask-closable="true"
    >
      <NForm :model="addForm" label-placement="left" label-width="100px" require-mark-placement="right">
        <NFormItem label="Client-Id" required>
          <NInput v-model:value="addForm.clientId" placeholder="请输入 Ozon Client-Id" clearable />
        </NFormItem>
        <NFormItem label="Api-Key" required>
          <NInput
            v-model:value="addForm.apiKey"
            placeholder="请输入 Ozon Api-Key"
            clearable
            type="password"
            show-password-on="click"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="addModalVisible = false">取消</NButton>
          <NButton type="primary" :loading="loading" @click="handleAddSubmit">添加</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 修改名称弹窗 -->
    <NModal
      v-model:show="editModalVisible"
      preset="card"
      title="修改店铺名称"
      style="max-width: 480px; width: 90%"
      :bordered="false"
      :mask-closable="true"
    >
      <NForm :model="editForm" label-placement="left" label-width="100px" require-mark-placement="right">
        <NFormItem label="公司名称" required>
          <NInput v-model:value="editForm.companyName" placeholder="请输入新的公司名称" clearable />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="editModalVisible = false">取消</NButton>
          <NButton type="primary" :loading="loading" @click="handleEditSubmit">保存</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>
