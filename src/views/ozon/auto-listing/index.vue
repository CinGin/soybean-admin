<script setup lang="ts">
import type { VNode } from 'vue';
import { h, onMounted, reactive, ref, computed } from 'vue';
import type { DataTableColumns, PaginationProps } from 'naive-ui';
import {
  NAlert,
  NButton,
  NCard,
  NDataTable,
  NDivider,
  NForm,
  NFormItem,
  NImage,
  NInput,
  NModal,
  NPopconfirm,
  NRadio,
  NRadioGroup,
  NSelect,
  NSpace,
  NStep,
  NSteps,
  NTag,
  NPopover, // ★ 新增 NStep/NSteps/NPopover
  useMessage
} from 'naive-ui';
import { fetchAutoListingTaskPage, fetchResetTask, fetchAssignShop } from '@/service/api/ozon-auto-listing';
import {
  MANUAL_PICK_STATUSES,
  COMMISSION_FIXABLE_STATUSES,
  RETRYABLE_STATUSES,
  TASK_STATUS_MAP,
  TASK_STATUS_OPTIONS
} from '@/constants/auto-listing';
import CandidatePicker from './modules/candidate-picker.vue';
import CommissionFix from './modules/commission-fix.vue';
import ProductDetailModal from './modules/product-detail-modal.vue';
import { fetchSellerGroups, type ShopGroup } from '@/service/api/ozon-seller-info';

defineOptions({ name: 'AutoListingTask' });
// ==================== 状态流程定义 ====================

/** 主流程（按顺序） */
const MAIN_FLOW: Api.AutoListing.TaskStatus[] = [
  'PENDING',
  'SEARCHED',
  'FIRST_PRICED',
  'LISTING',
  'LISTED',
  'SECOND_PRICED',
  'PRICE_UPDATED',
  'COMPLETED'
];

/** 主流程节点的中文标签 */
const MAIN_FLOW_LABEL: Partial<Record<Api.AutoListing.TaskStatus, string>> = {
  PENDING: '创建任务',
  SEARCHED: '图搜完成',
  FIRST_PRICED: '首定价完成',
  LISTING: '跟卖中',
  LISTED: '跟卖成功',
  SECOND_PRICED: '二定价完成',
  PRICE_UPDATED: '改价完成',
  COMPLETED: '流程完成'
};

/** 人工介入分支说明 */
const MANUAL_BRANCH: Record<string, { prev: string; next: string; tip: string }> = {
  FIRST_PENDING_MANUAL: {
    prev: '图搜完成 (SEARCHED)',
    next: '首定价完成 (FIRST_PRICED)',
    tip: '首定价出现多个并列候选，需人工选定。选择后将回到首定价完成状态继续跟卖。'
  },
  SECOND_PENDING_MANUAL: {
    prev: '跟卖成功 (LISTED)',
    next: '二定价完成 (SECOND_PRICED)',
    tip: '二次定价出现多个并列候选，需人工选定。选择后将继续改价流程。'
  }
};

/** 失败态说明 */
const FAILED_STATUS_TIP: Partial<Record<Api.AutoListing.TaskStatus, string>> = {
  FAILED_NO_MATCH: '图搜无匹配商品，可点击"重置重跑"回到 PENDING 重新图搜。',
  FAILED_PRICING: '定价计算失败（佣金类目缺失或计算异常），可"重置重跑"。',
  FAILED_NO_WEIGHT: '选中 SKU 无有效重量，可"重置重跑"或人工录入重量。',
  FAILED_LISTING: '跟卖提交失败，可"重置重跑"或人工干预。',
  FAILED_ATTR_MATCH: '二次属性匹配失败，可"重置重跑"。',
  FAILED_PRICE_UPDATE: '改价失败，重试调度器会自动退避重试；也可手动"重置重跑"。',
  FAILED_STOCK_UPDATE: '库存更新失败，重试调度器会自动退避重试；也可手动"重置重跑"。',
  FAILED_UNKNOWN: '未知异常，重试次数已耗尽。请人工排查后"重置重跑"。'
};

/** 流程图弹窗开关 */
const showFlowChart = ref(false);

/** 渲染状态 Popover 内容 */
function renderStatusPopover(row: Api.AutoListing.TaskItem) {
  const current = row.status;

  // 1. 主流程中的状态
  if (MAIN_FLOW.includes(current)) {
    const currentIdx = MAIN_FLOW.indexOf(current);
    return h('div', { style: 'padding: 12px 16px; min-width: 420px; width: max-content;' }, [
      h(
        'div',
        {
          style: 'font-size: 12px; color: #666; margin-bottom: 12px;'
        },
        `当前进度：第 ${currentIdx + 1} 步 / 共 ${MAIN_FLOW.length} 步`
      ),
      h(
        NSteps,
        { size: 'small', current: currentIdx + 1 },
        {
          default: () =>
            MAIN_FLOW.map((s, idx) => {
              const isCurrent = idx === currentIdx;
              const isPast = idx < currentIdx;
              return h(NStep, {
                // ★ 关键：给每个 step 显式指定 status
                status: isCurrent ? 'process' : isPast ? 'finish' : 'process',
                title: MAIN_FLOW_LABEL[s] ?? s,
                description: isCurrent ? '← 当前' : undefined
              });
            })
        }
      )
    ]);
  }

  // 2. 人工介入状态
  if (MANUAL_BRANCH[current]) {
    const b = MANUAL_BRANCH[current];
    return h('div', { style: 'padding: 12px 16px; min-width: 320px; max-width: 420px;' }, [
      h(
        NAlert,
        {
          type: 'warning',
          size: 'small',
          title: '等待人工选择',
          bordered: false
        },
        { default: () => b.tip }
      ),
      h('div', { style: 'font-size: 12px; color: #666; margin-top: 10px;' }, [
        h('div', `前置：${b.prev}`),
        h('div', { style: 'margin-top: 4px;' }, `后置：${b.next}`)
      ])
    ]);
  }

  // 3. 失败状态
  if (current.startsWith('FAILED_')) {
    return h(
      'div',
      { style: 'padding: 12px 16px; min-width: 320px; max-width: 420px;' },
      h(
        NAlert,
        {
          type: 'error',
          size: 'small',
          title: '任务已失败',
          bordered: false
        },
        {
          default: () => FAILED_STATUS_TIP[current] ?? '该任务已失败，请人工排查。'
        }
      )
    );
  }

  return row.status;
}

const message = useMessage();

// ==================== 状态 ====================
const loading = ref(false);
const list = ref<Api.AutoListing.TaskItem[]>([]);

/** 跟卖成功后可见候选的状态 */
const VIEW_CANDIDATE_STATUSES: Api.AutoListing.TaskStatus[] = [
  'LISTED',
  'SECOND_PRICED',
  'SECOND_PENDING_MANUAL',
  'PRICE_UPDATED',
  'COMPLETED'
];

const query = reactive<Api.AutoListing.TaskQuery>({
  pageNo: 1,
  pageSize: 20,
  status: null,
  variantId: '',
  clientId: '',
  companyInn: ''
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

// ==================== 主体分组 ====================
const shopGroups = ref<ShopGroup[]>([]);

const shopOptions = computed(() =>
  shopGroups.value.map(g => ({
    type: 'group' as const,
    label: `${g.companyName} (${g.inn})`,
    key: g.inn,
    children: g.shops.map(s => ({
      label: `${s.displayName}  [${s.clientId}]`,
      value: s.clientId,
      inn: g.inn,
      companyName: g.companyName
    }))
  }))
);

const innFilterOptions = computed(() =>
  shopGroups.value.map(g => ({
    label: `${g.companyName} (${g.inn})`,
    value: g.inn
  }))
);

async function loadShopGroups() {
  const { data } = await fetchSellerGroups();
  if (data) shopGroups.value = data;
}

// ==================== 指定店铺弹窗 ====================
const assignModalVisible = ref(false);
const assignRow = ref<Api.AutoListing.TaskItem | null>(null);
const assignForm = reactive<{ clientId: string | null; targetStatus: string }>({
  clientId: null,
  targetStatus: 'FIRST_PRICED'
});

function openAssignModal(row: Api.AutoListing.TaskItem) {
  assignRow.value = row;
  assignForm.clientId = null;
  assignForm.targetStatus = row.firstFinalPrice != null ? 'FIRST_PRICED' : 'PENDING';
  assignModalVisible.value = true;
}

async function handleAssignSubmit() {
  if (!assignForm.clientId) {
    message.warning('请选择店铺');
    return;
  }
  const { error } = await fetchAssignShop(
    assignRow.value!.id,
    assignForm.clientId,
    assignForm.targetStatus as Api.AutoListing.TaskStatus
  );
  if (!error) {
    message.success('店铺已指定，任务将重新推进');
    assignModalVisible.value = false;
    loadData();
  }
}

// ==================== 产品详情弹窗 ====================
const productDetailVisible = ref(false);
const productDetailVariantId = ref<string | null>(null);

function openProductDetail(row: Api.AutoListing.TaskItem) {
  productDetailVariantId.value = row.variantId;
  productDetailVisible.value = true;
}

// ==================== 人工选择弹窗 ====================
const pickerVisible = ref(false);
const pickerTaskId = ref<number | null>(null);
const pickerStage = ref<'FIRST' | 'SECOND'>('FIRST');
const pickerClientId = ref<string | null>(null);

function openCandidatePicker(row: Api.AutoListing.TaskItem) {
  pickerTaskId.value = row.id;
  pickerClientId.value = row.clientId ?? null;
  pickerStage.value = row.manualStage === 'SECOND' ? 'SECOND' : 'FIRST';
  pickerVisible.value = true;
}

// ==================== 查看候选弹窗（只读） ====================
const viewerVisible = ref(false);
const viewerTaskId = ref<number | null>(null);
const viewerClientId = ref<string | null>(null);
const viewerStage = ref<'FIRST' | 'SECOND'>('FIRST');
const viewerSelectedItemId = ref<number | null>(null);

function openCandidateViewer(row: Api.AutoListing.TaskItem) {
  viewerTaskId.value = row.id;
  viewerClientId.value = row.clientId ?? null;
  viewerStage.value = row.manualStage === 'SECOND' ? 'SECOND' : 'FIRST';
  // 已选候选 ID：从 task.manualSelectedItemId 取
  viewerSelectedItemId.value = row.manualSelectedItemId ?? null;
  viewerVisible.value = true;
}

// ==================== 补佣金弹窗 ====================
const commissionVisible = ref(false);
const commissionTask = ref<Api.AutoListing.TaskItem | null>(null);

function openCommissionFix(row: Api.AutoListing.TaskItem) {
  commissionTask.value = row;
  commissionVisible.value = true;
}

// ==================== 数据加载 ====================
async function loadData() {
  loading.value = true;
  try {
    const params: Record<string, any> = {};
    Object.entries(query).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') {
        params[k] = v;
      }
    });

    const { data, error } = await fetchAutoListingTaskPage(params as Api.AutoListing.TaskQuery);
    if (!error && data) {
      list.value = data.records ?? [];
      pagination.itemCount = data.total ?? 0;
    }
  } finally {
    loading.value = false;
  }
}

function handleResetQuery() {
  query.status = null;
  query.variantId = '';
  query.clientId = '';
  query.companyInn = '';
  query.pageNo = 1;
  pagination.page = 1;
  loadData();
}

// ==================== 重置任务 ====================
async function handleResetTask(row: Api.AutoListing.TaskItem) {
  const { error } = await fetchResetTask(row.id, {
    targetStatus: 'PENDING',
    clearError: true,
    clearCandidates: false
  });
  if (!error) {
    message.success(`任务 #${row.id} 已重置为 PENDING`);
    loadData();
  }
}

// ==================== 表格列 ====================
const columns: DataTableColumns<Api.AutoListing.TaskItem> = [
  { title: 'ID', key: 'id', width: 70 },
  {
    title: '主图',
    key: 'ozonPhotoUrl',
    width: 80,
    render: row =>
      row.ozonPhotoUrl
        ? h(NImage, {
            src: row.ozonPhotoUrl,
            width: 50,
            height: 50,
            objectFit: 'cover',
            class: 'rounded'
          })
        : '-'
  },
  {
    title: 'variantId',
    key: 'variantId',
    width: 140,
    render: row =>
      h(
        NButton,
        {
          text: true,
          type: 'primary',
          onClick: () => openProductDetail(row)
        },
        { default: () => row.variantId }
      )
  },
  {
    title: '状态',
    key: 'status',
    width: 170,
    render: row => {
      const meta = TASK_STATUS_MAP[row.status];
      return h(
        NPopover,
        { trigger: 'hover', placement: 'right', style: 'padding: 0;' },
        {
          trigger: () =>
            h(
              NTag,
              { type: meta?.type ?? 'default', size: 'small', bordered: false },
              { default: () => meta?.label ?? row.status }
            ),
          default: () => renderStatusPopover(row)
        }
      );
    }
  },
  {
    title: '主体',
    key: 'companyName',
    width: 180,
    ellipsis: { tooltip: true },
    render: r => (r.companyName ? r.companyName : h('span', { class: 'text-orange-500' }, '未指定'))
  },
  {
    title: '店铺',
    key: 'clientId',
    width: 140,
    render: r =>
      r.clientId
        ? r.clientId
        : h(NTag, { size: 'small', type: 'warning', bordered: false }, { default: () => '未指定' })
  },
  { title: '类目', key: 'ozonCategoryId', width: 100, render: r => r.ozonCategoryId ?? '-' },
  { title: '候选', key: 'candidateCount', width: 70, render: r => r.candidateCount ?? 0 },
  {
    title: '错误信息',
    key: 'errorMsg',
    minWidth: 200,
    ellipsis: { tooltip: true },
    render: r => r.errorMsg ?? '-'
  },
  { title: '更新时间', key: 'updatedAt', width: 170 },
  {
    title: '操作',
    key: 'actions',
    width: 340,
    fixed: 'right',
    render: row => {
      const btns: VNode[] = [];

      // client_id 为空 → 需要指定店铺
      if (!row.clientId) {
        btns.push(
          h(
            NButton,
            { size: 'small', type: 'warning', onClick: () => openAssignModal(row) },
            { default: () => '指定店铺' }
          )
        );
      }

      // 待人工选择
      if (MANUAL_PICK_STATUSES.includes(row.status)) {
        btns.push(
          h(
            NButton,
            {
              size: 'small',
              type: 'error', // ★ 红描边，与"重置重跑"（info 青色）明确区分
              ghost: true,
              onClick: () => openCandidatePicker(row)
            },
            { default: () => '人工选择' }
          )
        );
      }

      // ★ 跟卖成功后：查看候选（只读）
      if (VIEW_CANDIDATE_STATUSES.includes(row.status)) {
        btns.push(
          h(
            NButton,
            {
              size: 'small',
              type: 'success',
              ghost: true,
              onClick: () => openCandidateViewer(row)
            },
            { default: () => '查看候选' }
          )
        );
      }

      if (COMMISSION_FIXABLE_STATUSES.includes(row.status)) {
        btns.push(
          h(
            NButton,
            { size: 'small', type: 'warning', onClick: () => openCommissionFix(row) },
            { default: () => '补佣金类目' }
          )
        );
      }

      if (RETRYABLE_STATUSES.includes(row.status)) {
        btns.push(
          h(
            NPopconfirm,
            { onPositiveClick: () => handleResetTask(row) },
            {
              trigger: () => h(NButton, { size: 'small', type: 'info' }, { default: () => '重置重跑' }),
              default: () => '确定要重置该任务为 PENDING 吗？'
            }
          )
        );
      }

      return h(NSpace, { size: 6, wrap: false }, { default: () => btns });
    }
  }
];

// ==================== 挂载 ====================
onMounted(async () => {
  await loadShopGroups();
  loadData();
});
</script>

<template>
  <div class="h-full flex-col gap-16px p-16px">
    <!-- 筛选栏 -->
    <NCard :bordered="false" size="small">
      <NSpace align="center" :wrap="true">
        <NSelect
          v-model:value="query.status"
          :options="TASK_STATUS_OPTIONS"
          placeholder="状态"
          clearable
          class="w-180px"
        />
        <NSelect
          v-model:value="query.companyInn"
          :options="innFilterOptions"
          placeholder="公司主体"
          clearable
          filterable
          class="w-260px"
        />
        <NInput
          v-model:value="query.variantId"
          placeholder="variantId"
          clearable
          class="w-200px"
          @keyup.enter="loadData"
        />
        <NInput
          v-model:value="query.clientId"
          placeholder="Client-Id"
          clearable
          class="w-200px"
          @keyup.enter="loadData"
        />
        <NButton type="primary" @click="loadData">查询</NButton>
        <NButton @click="handleResetQuery">重置</NButton>
      </NSpace>
      <NButton type="info" ghost @click="showFlowChart = true">状态流程</NButton>
    </NCard>

    <!-- 表格 -->
    <NCard :bordered="false" size="small" class="flex-1">
      <NDataTable
        remote
        :loading="loading"
        :columns="columns"
        :data="list"
        :pagination="pagination"
        :row-key="(r: Api.AutoListing.TaskItem) => r.id"
        :scroll-x="1800"
        size="small"
        striped
      />
    </NCard>

    <!-- 人工选择（编辑模式） -->
    <CandidatePicker
      v-model:visible="pickerVisible"
      :task-id="pickerTaskId"
      :client-id="pickerClientId"
      :stage="pickerStage"
      @picked="loadData"
    />

    <!-- 查看候选（只读模式） -->
    <CandidatePicker
      v-model:visible="viewerVisible"
      :task-id="viewerTaskId"
      :client-id="viewerClientId"
      :stage="viewerStage"
      :readonly="true"
      :selected-item-id="viewerSelectedItemId"
    />

    <CommissionFix v-model:visible="commissionVisible" :task="commissionTask" @saved="loadData" />

    <ProductDetailModal v-model:visible="productDetailVisible" :variant-id="productDetailVariantId" />

    <!-- 指定店铺弹窗 -->
    <NModal
      v-model:show="assignModalVisible"
      preset="card"
      title="指定店铺"
      class="w-90vw max-w-600px"
      :mask-closable="false"
    >
      <NAlert type="info" :bordered="false" class="mb-16px">
        任务 #{{ assignRow?.id }}（variantId: {{ assignRow?.variantId }}）当前未关联店铺， 请选择要上架到的主体及店铺。
      </NAlert>

      <NForm label-placement="left" label-width="120px">
        <NFormItem label="选择店铺" required>
          <NSelect
            v-model:value="assignForm.clientId"
            :options="shopOptions"
            placeholder="按公司主体分组选择"
            filterable
            clearable
            class="w-full"
          />
        </NFormItem>
        <NFormItem label="回退状态">
          <NRadioGroup v-model:value="assignForm.targetStatus">
            <NSpace>
              <NRadio value="FIRST_PRICED">保留首定价，重新跟卖</NRadio>
              <NRadio value="PENDING">重跑首定价</NRadio>
            </NSpace>
          </NRadioGroup>
        </NFormItem>
        <div class="text-12px text-gray-500 ml-120px">建议：已有定价数据选「保留首定价」，可节省图搜/定价时间</div>
      </NForm>

      <template #footer>
        <NSpace justify="end">
          <NButton @click="assignModalVisible = false">取消</NButton>
          <NButton type="primary" :disabled="!assignForm.clientId" @click="handleAssignSubmit">确认</NButton>
        </NSpace>
      </template>
    </NModal>
    <!-- ==================== 状态流程图弹窗 ==================== -->
    <NModal
      v-model:show="showFlowChart"
      preset="card"
      title="自动上架状态流程图"
      class="w-90vw max-w-900px"
      :mask-closable="true"
    >
      <div class="text-13px leading-6">
        <!-- 主流程 -->
        <div class="mb-8px font-bold">主流程（自动）</div>
        <div class="flex flex-wrap items-center gap-6px mb-16px">
          <template v-for="(s, i) in MAIN_FLOW" :key="s">
            <NTag type="success" size="small" :bordered="false">
              {{ MAIN_FLOW_LABEL[s] ?? s }}
            </NTag>
            <span v-if="i < MAIN_FLOW.length - 1" class="text-gray-400">→</span>
          </template>
        </div>

        <!-- 人工介入分支 -->
        <div class="mb-8px font-bold">人工介入分支</div>
        <div class="flex flex-col gap-10px mb-16px">
          <div
            v-for="(b, k) in MANUAL_BRANCH"
            :key="k"
            class="flex items-start gap-8px p-10px rounded bg-orange-50 border border-orange-200"
          >
            <NTag type="warning" size="small" :bordered="false">{{ k }}</NTag>
            <div class="flex-1 text-12px text-gray-600">
              <div>前置：{{ b.prev }}</div>
              <div>后置：{{ b.next }}</div>
              <div class="mt-4px text-gray-500">{{ b.tip }}</div>
            </div>
          </div>
        </div>

        <!-- 失败态 -->
        <div class="mb-8px font-bold">失败态（可通过"重置重跑"回到 PENDING）</div>
        <div class="flex flex-wrap gap-6px mb-16px">
          <NTag v-for="(tip, s) in FAILED_STATUS_TIP" :key="s" type="error" size="small" ghost>
            {{ s }}
          </NTag>
        </div>

        <NDivider />

        <div class="text-12px text-gray-500">提示：鼠标悬浮任意任务的状态标签，可查看该任务当前所处节点。</div>
      </div>
    </NModal>
  </div>
</template>

<style scoped></style>
