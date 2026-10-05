<script setup lang="ts">
import { computed, h, reactive, ref, watch } from 'vue';
import type { DataTableColumns } from 'naive-ui';
import {
  NAlert,
  NButton,
  NDataTable,
  NDivider,
  NForm,
  NFormItem,
  NImage,
  NInput,
  NInputNumber,
  NModal,
  NSelect,
  NSpace,
  NSpin,
  NTag,
  useMessage
} from 'naive-ui';
import { useAuthStore } from '@/store/modules/auth';
import { fetchAutoListingCandidates, fetchCandidateFreight, fetchPickCandidate } from '@/service/api/ozon-auto-listing';
import { fetchFeedbackByCandidate } from '@/service/api/ozon-weight';
import { fetchSellerGroups, type ShopGroup } from '@/service/api/ozon-seller-info';

interface Props {
  visible: boolean;
  taskId: number | null;
  clientId?: string | null;
  stage?: 'FIRST' | 'SECOND';
  readonly?: boolean;
  selectedItemId?: number | null;
}

const props = withDefaults(defineProps<Props>(), {
  stage: 'FIRST',
  clientId: null,
  readonly: false,
  selectedItemId: null
});

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void;
  (e: 'picked'): void;
  (e: 'weight-updated'): void; // ★ 新增
}>();

const message = useMessage();
const authStore = useAuthStore();

const loading = ref(false);
const submitting = ref(false);
const list = ref<Api.AutoListing.CandidateItem[]>([]);
const checkedRowKeys = ref<number[]>([]);
const remark = ref('');

// ==================== 运费状态 ====================
const freightMap = ref<Record<number, number>>({});
const freightLoading = ref<Set<number>>(new Set());
const freightFailed = ref<Set<number>>(new Set());

// ==================== 店铺 ====================
const shopGroups = ref<ShopGroup[]>([]);
const selectedClientId = ref<string | null>(null);

const shopOptions = computed(() =>
  shopGroups.value.map(g => ({
    type: 'group' as const,
    label: `${g.companyName} (${g.inn})`,
    key: g.inn,
    children: g.shops.map(s => ({
      label: `${s.displayName}  [${s.clientId}]`,
      value: s.clientId
    }))
  }))
);

const operator = computed(() => authStore.userInfo.userName ?? '未知用户');
const selectedId = computed(() => checkedRowKeys.value[0] ?? null);
const modalTitle = computed(() => (props.readonly ? '查看候选（已跟卖）' : '人工选择候选'));

function offerUrl(row: Api.AutoListing.CandidateItem) {
  if (row.productUrl) return row.productUrl;
  return `https://detail.1688.com/offer/${row.offerId}.html`;
}

// ==================== 数据加载 ====================
async function loadCandidates() {
  if (!props.taskId) return;
  loading.value = true;
  try {
    const { data, error } = await fetchAutoListingCandidates(props.taskId, props.stage);
    if (!error && data) list.value = data;
  } finally {
    loading.value = false;
  }
}

async function loadShopGroups() {
  if (shopGroups.value.length > 0) return;
  const { data } = await fetchSellerGroups();
  if (data) shopGroups.value = data;
}

// ==================== 运费 ====================
async function queryFreight(c: Api.AutoListing.CandidateItem) {
  if (!props.taskId) return;
  if (freightLoading.value.has(c.id)) return;

  freightLoading.value = new Set(freightLoading.value).add(c.id);
  if (freightFailed.value.has(c.id)) {
    const next = new Set(freightFailed.value);
    next.delete(c.id);
    freightFailed.value = next;
  }

  try {
    const { data, error } = await fetchCandidateFreight(props.taskId, c.id);
    if (!error && data && data.success && data.carriageCny != null) {
      freightMap.value = { ...freightMap.value, [c.id]: Number(data.carriageCny) };
    } else {
      freightFailed.value = new Set(freightFailed.value).add(c.id);
    }
  } catch {
    freightFailed.value = new Set(freightFailed.value).add(c.id);
  } finally {
    const next = new Set(freightLoading.value);
    next.delete(c.id);
    freightLoading.value = next;
  }
}

// ==================== ★ 需求3：修改重量弹窗 ====================
const weightEditVisible = ref(false);
const weightEditSubmitting = ref(false);
const weightEditTarget = ref<Api.AutoListing.CandidateItem | null>(null);
const weightEditForm = reactive<{
  actualWeight: number | null;
  remark: string;
}>({
  actualWeight: null,
  remark: ''
});

/** 打开重量编辑弹窗 */
function openWeightEdit(row: Api.AutoListing.CandidateItem) {
  weightEditTarget.value = row;
  weightEditForm.actualWeight = row.weightG ?? null;
  weightEditForm.remark = '';
  weightEditVisible.value = true;
}

/** 提交重量修改 —— 只传 candidateId / actualWeight / operator / remark */
async function handleWeightEditSubmit() {
  if (!weightEditTarget.value) return;
  if (!weightEditForm.actualWeight || weightEditForm.actualWeight <= 0) {
    message.warning('请输入大于 0 的实际重量');
    return;
  }
  if (weightEditForm.actualWeight === weightEditTarget.value.weightG) {
    message.warning('实际重量与当前值相同，无需提交');
    return;
  }

  weightEditSubmitting.value = true;
  try {
    const { error } = await fetchFeedbackByCandidate({
      candidateId: weightEditTarget.value.id,
      actualWeight: weightEditForm.actualWeight,
      operator: operator.value,
      remark: weightEditForm.remark
    });
    if (!error) {
      message.success('重量已更新，下次评估将采用该实测值');
      weightEditVisible.value = false;
      await loadCandidates(); // 刷新列表
      emit('weight-updated'); // 通知父组件
    }
  } finally {
    weightEditSubmitting.value = false;
  }
}

// ==================== 生命期 ====================
watch(
  () => props.visible,
  v => {
    if (v) {
      checkedRowKeys.value = [];
      remark.value = '';
      freightMap.value = {};
      freightLoading.value = new Set();
      freightFailed.value = new Set();
      selectedClientId.value = props.clientId ?? null;
      loadCandidates();
      if (!props.readonly) loadShopGroups();
    } else {
      freightMap.value = {};
      freightLoading.value = new Set();
      freightFailed.value = new Set();
    }
  }
);

// ==================== 行样式 ====================
function isCurrentSelected(row: Api.AutoListing.CandidateItem): boolean {
  return props.selectedItemId != null && row.id === props.selectedItemId;
}

function rowProps(row: Api.AutoListing.CandidateItem) {
  if (isCurrentSelected(row)) return { style: 'background: #e6f7ff;' };
  if (row.isSelected) return { style: 'background: #f0f9ff;' };
  return {};
}

// ==================== 运费列渲染 ====================
function renderFreight(row: Api.AutoListing.CandidateItem) {
  if (freightLoading.value.has(row.id)) return h(NSpin, { size: 'small' });
  if (freightMap.value[row.id] !== undefined) {
    return h('span', { class: 'text-blue-600 font-medium' }, `¥${freightMap.value[row.id].toFixed(2)}`);
  }
  if (freightFailed.value.has(row.id)) {
    return h(
      NButton,
      { size: 'tiny', type: 'error', ghost: true, onClick: () => queryFreight(row) },
      { default: () => '重试' }
    );
  }
  return h(
    NButton,
    { size: 'tiny', type: 'info', ghost: true, onClick: () => queryFreight(row) },
    { default: () => '查运费' }
  );
}

// ==================== ★ 重量列（可编辑） ====================
function renderWeight(row: Api.AutoListing.CandidateItem) {
  const weight = row.weightG;

  if (props.readonly) {
    return weight != null ? `${weight}g` : '-';
  }

  return h(
    NSpace,
    { size: 4, align: 'center', wrap: false },
    {
      default: () => [
        h('span', { style: weight == null ? 'color: #999;' : '' }, weight != null ? `${weight}g` : '未设置'),
        h(
          NButton,
          {
            size: 'tiny',
            type: 'primary',
            ghost: true,
            onClick: (e: Event) => {
              e.stopPropagation();
              openWeightEdit(row);
            }
          },
          { default: () => '改' }
        )
      ]
    }
  );
}

// ==================== 列定义 ====================
const columns = computed<DataTableColumns<Api.AutoListing.CandidateItem>>(() => {
  const cols: DataTableColumns<Api.AutoListing.CandidateItem> = [];

  if (props.readonly) {
    cols.push({
      title: '标记',
      key: '_selectedFlag',
      width: 80,
      align: 'center',
      render: row =>
        isCurrentSelected(row)
          ? h(NTag, { type: 'success', size: 'small', bordered: false }, { default: () => '✓ 已选' })
          : ''
    });
  } else {
    cols.push({
      type: 'selection',
      multiple: false,
      disabled: row => Number(row.isCandidate) !== 1
    });
  }

  cols.push(
    {
      title: 'SKU图',
      key: 'skuImageUrl',
      width: 80,
      render: r =>
        r.skuImageUrl
          ? h(NImage, { src: r.skuImageUrl, width: 50, height: 50, objectFit: 'cover', class: 'rounded' })
          : '-'
    },
    {
      title: 'offerId',
      key: 'offerId',
      width: 130,
      render: row =>
        h(
          'a',
          {
            href: offerUrl(row),
            target: '_blank',
            rel: 'noopener',
            class: 'text-blue-500 hover:underline',
            onClick: (e: Event) => e.stopPropagation()
          },
          String(row.offerId)
        )
    },
    { title: 'specId', key: 'specId', width: 120 },
    { title: '标题', key: 'subject', minWidth: 220, ellipsis: { tooltip: true } },
    {
      title: '价格',
      key: 'price',
      width: 100,
      render: r => (r.price != null ? `¥${r.price}` : '-')
    },
    { title: '运费', key: '_freight', width: 110, align: 'center', render: r => renderFreight(r) },
    { title: '重量(g)', key: 'weightG', width: 130, render: r => renderWeight(r) },
    {
      title: '相似度',
      key: 'similarity',
      width: 100,
      render: r => {
        const s = r.similarity ?? 0;
        const type = s >= 0.85 ? 'success' : s >= 0.7 ? 'warning' : 'default';
        return h(NTag, { type, size: 'small', bordered: false }, { default: () => s.toFixed(3) });
      }
    },
    {
      title: '候选',
      key: 'isCandidate',
      width: 80,
      render: r =>
        h(
          NTag,
          { type: r.isCandidate ? 'success' : 'default', size: 'small', bordered: false },
          { default: () => (r.isCandidate ? 'Y' : 'N') }
        )
    },
    { title: '候选内排名', key: 'rankInCandidate', width: 110 },
    { title: 'SKU内排名', key: 'rankInSku', width: 100 }
  );

  return cols;
});

// ==================== 提交人工选择 ====================
async function handleSubmit() {
  if (!selectedId.value) {
    message.warning('请先选择一条候选');
    return;
  }
  if (!selectedClientId.value) {
    message.warning('请选择要上架的店铺');
    return;
  }
  submitting.value = true;
  try {
    const { error } = await fetchPickCandidate({
      taskId: props.taskId!,
      itemId: selectedId.value,
      operator: operator.value,
      remark: remark.value,
      autoContinue: true,
      clientId: selectedClientId.value
    });
    if (!error) {
      message.success('已提交，任务继续执行');
      emit('update:visible', false);
      emit('picked');
    }
  } finally {
    submitting.value = false;
  }
}

function handleClose() {
  emit('update:visible', false);
}
</script>

<template>
  <NModal
    :show="visible"
    preset="card"
    :title="modalTitle"
    class="w-90vw max-w-1400px"
    :mask-closable="false"
    @update:show="handleClose"
  >
    <NDataTable
      v-if="!readonly"
      v-model:checked-row-keys="checkedRowKeys"
      :loading="loading"
      :columns="columns"
      :data="list"
      :row-key="(r: Api.AutoListing.CandidateItem) => r.id"
      :scroll-x="1500"
      :max-height="440"
      size="small"
      :row-props="rowProps"
    />
    <NDataTable
      v-else
      :loading="loading"
      :columns="columns"
      :data="list"
      :row-key="(r: Api.AutoListing.CandidateItem) => r.id"
      :scroll-x="1500"
      :max-height="520"
      size="small"
      :row-props="rowProps"
    />

    <div v-if="!readonly" class="mt-16px grid grid-cols-1 gap-12px md:grid-cols-2">
      <div>
        <div class="mb-4px text-12px text-gray-500">
          上架店铺
          <span class="text-red-500">*</span>
        </div>
        <NSelect
          v-model:value="selectedClientId"
          :options="shopOptions"
          placeholder="按公司主体分组选择"
          filterable
          clearable
        />
      </div>
      <div>
        <div class="mb-4px text-12px text-gray-500">操作人</div>
        <div class="h-34px flex items-center border border-gray-300 rounded bg-gray-50 px-12px text-14px text-gray-600">
          {{ operator }}
        </div>
      </div>
    </div>
    <div v-if="!readonly" class="mt-12px">
      <div class="mb-4px text-12px text-gray-500">备注</div>
      <NInput v-model:value="remark" placeholder="备注（可选）" />
    </div>

    <template #footer>
      <NSpace justify="end">
        <NButton @click="handleClose">{{ readonly ? '关闭' : '取消' }}</NButton>
        <NButton
          v-if="!readonly"
          type="primary"
          :loading="submitting"
          :disabled="!selectedId || !selectedClientId"
          @click="handleSubmit"
        >
          确认选择并继续
        </NButton>
      </NSpace>
    </template>

    <!-- ==================== ★ 需求3：修改重量弹窗 ==================== -->
    <NModal
      v-model:show="weightEditVisible"
      preset="card"
      title="修改候选重量"
      class="w-90vw max-w-560px"
      :mask-closable="false"
    >
      <NAlert type="info" :bordered="false" class="mb-16px">
        <div>
          标题：
          <b>{{ weightEditTarget?.subject || '-' }}</b>
        </div>
        <div class="mt-4px">
          OfferId：
          <b>{{ weightEditTarget?.offerId }}</b>
          · SpecId：
          <b>{{ weightEditTarget?.specId }}</b>
        </div>
        <div class="mt-4px text-gray-500">
          系统预估值：
          <b>{{ weightEditTarget?.weightG ?? '-' }} g</b>
        </div>
      </NAlert>

      <NForm label-placement="left" label-width="120px">
        <NFormItem label="实际重量(g)" required>
          <NInputNumber
            v-model:value="weightEditForm.actualWeight as any"
            placeholder="必填，员工称重值"
            :min="0.01"
            :precision="2"
            class="w-200px"
          />
        </NFormItem>

        <NFormItem label="员工编号">
          <div
            class="h-34px flex items-center border border-gray-300 rounded bg-gray-50 px-12px text-14px text-gray-600 w-300px"
          >
            {{ operator }}
          </div>
        </NFormItem>

        <NFormItem label="备注">
          <NInput v-model:value="weightEditForm.remark" type="textarea" :rows="2" placeholder="选填" />
        </NFormItem>
      </NForm>

      <NDivider />

      <div class="text-12px text-gray-500">提交后，该 SKU 的实测值将被永久记录，下次评估同一 SKU 时会自动采用。</div>

      <template #footer>
        <NSpace justify="end">
          <NButton @click="weightEditVisible = false">取消</NButton>
          <NButton type="primary" :loading="weightEditSubmitting" @click="handleWeightEditSubmit">提交</NButton>
        </NSpace>
      </template>
    </NModal>
  </NModal>
</template>

<style scoped></style>
