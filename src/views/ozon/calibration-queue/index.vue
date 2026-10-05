<script setup lang="ts">
import { h, onMounted, reactive, ref, computed } from 'vue';
import type { DataTableColumns, PaginationProps } from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import {
  NAlert,
  NButton,
  NCard,
  NCheckbox,
  NDataTable,
  NForm,
  NFormItem,
  NImage,
  NInput,
  NInputNumber,
  NModal,
  NSpace,
  NTag,
  NDivider,
  NTooltip,
  useMessage
} from 'naive-ui';
import {
  fetchCalibrationQueue,
  fetchFeedbackByCandidate,
  fetchBatchFeedbackByCandidate
} from '@/service/api/ozon-weight';
import { useAuthStore } from '@/store/modules/auth';

defineOptions({ name: 'WeightCalibrationQueue' });

const message = useMessage();
const authStore = useAuthStore();
const operator = authStore.userInfo.userName ?? 'unknown';

const loading = ref(false);
const list = ref<Api.Weight.CalibrationQueueVO[]>([]);
const showFeedbackHistory = ref(false);

const checkedRowKeys = ref<number[]>([]);
const selectedCount = computed(() => checkedRowKeys.value.length);

const query = reactive<Api.Weight.CalibrationQueueQuery>({
  pageNo: 1,
  pageSize: 20,
  feedbackStatus: 0,
  maxConfidence: 60,
  taskId: null,
  clientId: '',
  keyword: '',
  days: 7
});

const pagination = reactive<PaginationProps>({
  page: 1,
  pageSize: 20,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [20, 50, 100, 200],
  onChange: (p: number) => {
    query.pageNo = p;
    pagination.page = p;
    load();
  },
  onUpdatePageSize: (s: number) => {
    query.pageSize = s;
    query.pageNo = 1;
    pagination.pageSize = s;
    pagination.page = 1;
    load();
  }
});

async function load() {
  loading.value = true;
  try {
    query.feedbackStatus = showFeedbackHistory.value ? null : 0;
    const { data, error } = await fetchCalibrationQueue({ ...query });
    if (!error && data) {
      list.value = data.records ?? [];
      pagination.itemCount = data.total ?? 0;
      const ids = new Set(list.value.map(r => r.id));
      checkedRowKeys.value = checkedRowKeys.value.filter(id => ids.has(id));
    }
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  query.pageNo = 1;
  pagination.page = 1;
  load();
}

function handleToggleHistory() {
  checkedRowKeys.value = [];
  query.pageNo = 1;
  pagination.page = 1;
  load();
}

// ==================== 单条录入 ====================
const modalVisible = ref(false);
const submitting = ref(false);
const current = ref<Api.Weight.CalibrationQueueVO | null>(null);
const form = reactive({ actualWeight: null as number | null, remark: '' });

function openModal(row: Api.Weight.CalibrationQueueVO) {
  current.value = row;
  form.actualWeight = null;
  form.remark = '';
  modalVisible.value = true;
}

async function handleSubmit() {
  if (!form.actualWeight || form.actualWeight <= 0) {
    message.warning('请输入大于 0 的实际重量');
    return;
  }
  if (!current.value) return;
  submitting.value = true;
  try {
    const { error } = await fetchFeedbackByCandidate({
      candidateId: current.value.id,
      actualWeight: form.actualWeight,
      remark: form.remark || undefined,
      operator
    });
    if (!error) {
      message.success('录入成功');
      modalVisible.value = false;
      load();
    }
  } finally {
    submitting.value = false;
  }
}

// ==================== 批量录入 ====================
const batchModalVisible = ref(false);
const batchSubmitting = ref(false);
const batchForm = reactive({ actualWeight: null as number | null, remark: '' });

const batchPreview = computed(() => list.value.filter(r => checkedRowKeys.value.includes(r.id)).slice(0, 5));

function openBatchModal() {
  if (checkedRowKeys.value.length === 0) {
    message.warning('请先勾选要录入的候选');
    return;
  }
  batchForm.actualWeight = null;
  batchForm.remark = '';
  batchModalVisible.value = true;
}

async function handleBatchSubmit() {
  if (!batchForm.actualWeight || batchForm.actualWeight <= 0) {
    message.warning('请输入大于 0 的实际重量');
    return;
  }
  batchSubmitting.value = true;
  try {
    const { data, error } = await fetchBatchFeedbackByCandidate({
      candidateIds: checkedRowKeys.value,
      actualWeight: batchForm.actualWeight,
      remark: batchForm.remark || undefined,
      operator
    });
    if (!error && data) {
      if (data.failed === 0) {
        message.success(`批量录入成功，共 ${data.success} 条`);
      } else {
        message.warning(`批量录入完成：成功 ${data.success}，失败 ${data.failed}`);
        console.warn('[batch feedback errors]', data.errors);
      }
      batchModalVisible.value = false;
      checkedRowKeys.value = [];
      load();
    }
  } finally {
    batchSubmitting.value = false;
  }
}

function handleResetQuery() {
  Object.assign(query, {
    feedbackStatus: 0,
    maxConfidence: 60,
    taskId: null,
    clientId: '',
    keyword: '',
    days: 7,
    pageNo: 1
  });
  showFeedbackHistory.value = false;
  checkedRowKeys.value = [];
  pagination.page = 1;
  load();
}

function confidenceTagType(score: number | null) {
  if (score == null) return 'default';
  if (score >= 85) return 'success';
  if (score >= 70) return 'info';
  if (score >= 55) return 'warning';
  return 'error';
}

function merchantWeightColor(flag: string | null) {
  if (flag === 'SUSPICIOUS') return '#d03050';
  if (flag === 'MISSING') return '#999999';
  return '#333333';
}

const columns: DataTableColumns<Api.Weight.CalibrationQueueVO> = [
  { type: 'selection', fixed: 'left' },
  {
    title: '图',
    key: 'skuImageUrl',
    width: 70,
    render: r =>
      r.skuImageUrl
        ? h(NImage, {
            src: r.skuImageUrl,
            width: 50,
            height: 50,
            objectFit: 'cover',
            class: 'rounded'
          })
        : '-'
  },
  {
    title: 'SKU 分组',
    key: 'skuGroupName',
    width: 140,
    ellipsis: { tooltip: true },
    render: r => r.skuGroupName ?? '-'
  },
  { title: '商品标题', key: 'subject', minWidth: 200, ellipsis: { tooltip: true } },
  {
    title: 'SKU ID',
    key: 'skuId',
    width: 200,
    render: r => {
      if (!r.skuId) return '-';
      const skuId = String(r.skuId);

      // ★ 无链接时降级为普通文本
      const skuTextNode = r.productUrl
        ? h(
            'a',
            {
              href: r.productUrl,
              target: '_blank',
              rel: 'noopener noreferrer',
              title: '点击打开 1688 商品详情',
              class: 'text-primary font-mono text-12px hover:underline cursor-pointer',
              onClick: (e: MouseEvent) => e.stopPropagation()
            },
            skuId
          )
        : h('span', { class: 'text-gray-700 font-mono text-12px' }, skuId);

      return h(
        NSpace,
        { size: 6, align: 'center', wrap: false },
        {
          default: () => [
            skuTextNode,
            h(
              NButton,
              {
                quaternary: true,
                size: 'tiny',
                type: 'primary',
                title: '复制 SKU ID',
                style: 'padding:0 4px;flex-shrink:0;width:22px;height:22px;',
                onClick: async (e: MouseEvent) => {
                  e.stopPropagation();
                  try {
                    await navigator.clipboard.writeText(skuId);
                    message.success('已复制');
                  } catch {
                    message.error('复制失败');
                  }
                }
              },
              {
                icon: () => h(SvgIcon, { icon: 'ph:copy', width: 14, height: 14 })
              }
            )
          ]
        }
      );
    }
  },
  // ★ 商家标重列
  {
    title: '商家标重',
    key: 'merchantWeightG',
    width: 110,
    render: r => {
      if (!r.merchantWeightG) {
        return h('span', { class: 'text-gray-400 text-12px' }, '未填');
      }
      const color = merchantWeightColor(r.merchantWeightFlag);
      const text = `${r.merchantWeightG}g`;
      const isSuspicious = r.merchantWeightFlag === 'SUSPICIOUS';
      if (isSuspicious) {
        return h(
          NTooltip,
          { trigger: 'hover' },
          {
            trigger: () => h('span', { style: `color:${color};font-weight:600` }, `${text} ⚠️`),
            default: () => '商家标重异常，建议以模型推算或实测为准'
          }
        );
      }
      return h('span', { style: `color:${color}` }, text);
    }
  },
  // ★ 模型推算列
  {
    title: '模型推算',
    key: 'weightG',
    width: 110,
    render: r => h('span', { style: 'font-weight:600;color:#18a058' }, r.weightG ? `${r.weightG}g` : '-')
  },
  // 误差范围
  {
    title: '合理范围',
    key: 'reasonableRange',
    width: 130,
    render: r => (r.reasonableRange ? h('span', { class: 'text-gray-500 text-12px' }, r.reasonableRange) : '-')
  },
  // ★ 置信度列（分数 + 等级）
  {
    title: '置信度',
    key: 'confidenceText',
    width: 110,
    render: r => {
      if (r.confidenceScore == null) return '-';
      return h(
        NTag,
        {
          type: confidenceTagType(r.confidenceScore) as any,
          size: 'small',
          bordered: false
        },
        { default: () => `${r.confidenceScore} ${extractLevel(r.confidenceText)}` }
      );
    }
  },
  // 来源
  { title: '来源', key: 'weightSource', width: 100, render: r => r.weightSource ?? '-' },
  // 任务
  { title: '任务', key: 'taskId', width: 80, render: r => `#${r.taskId}` },
  // 录入人
  {
    title: '录入人',
    key: 'latestFeedbackOperator',
    width: 110,
    render: r => r.latestFeedbackOperator ?? '-'
  },
  // 录入备注
  {
    title: '录入备注',
    key: 'latestFeedbackRemark',
    width: 150,
    ellipsis: { tooltip: true },
    render: r => r.latestFeedbackRemark ?? '-'
  },
  // 操作
  {
    title: '操作',
    key: 'actions',
    width: 120,
    fixed: 'right',
    render: r => {
      const isFeedback = r.feedbackStatus === 1;
      return h(
        NButton,
        {
          size: 'small',
          type: 'primary',
          ghost: isFeedback,
          onClick: () => openModal(r)
        },
        { default: () => (isFeedback ? '重新录入' : '录入重量') }
      );
    }
  }
];

/** 从 "75 中高" 里提取"中高" */
function extractLevel(text: string | null): string {
  if (!text) return '';
  const m = text.match(/\d+\s*(.+)/);
  return m ? m[1].trim() : '';
}

onMounted(load);
</script>

<template>
  <div class="h-full flex-col gap-16px p-16px">
    <NCard :bordered="false" size="small">
      <NAlert type="info" :bordered="false" class="mb-12px">
        只展示
        <b>未反馈</b>
        且
        <b>置信度低于阈值</b>
        的候选。 可通过标题关键词搜索后
        <b>批量勾选</b>
        同类 SKU 一起录入。
        <b>⚠️</b>
        标记的商家标重存在异常，仅供参考。
      </NAlert>
      <NSpace align="center" :wrap="true">
        <NInput
          v-model:value="query.taskId as any"
          placeholder="任务ID"
          clearable
          class="w-120px"
          :allow-input="(v: string) => /^\d*$/.test(v)"
          @keyup.enter="handleSearch"
        />
        <NInput
          v-model:value="query.clientId"
          placeholder="店铺 Client-Id"
          clearable
          class="w-180px"
          @keyup.enter="handleSearch"
        />
        <NInput
          v-model:value="query.keyword"
          placeholder="标题 / SKU 后6位"
          clearable
          class="w-220px"
          @keyup.enter="handleSearch"
        />
        <NInputNumber
          v-model:value="query.maxConfidence as any"
          placeholder="最大置信度"
          :min="0"
          :max="100"
          class="w-140px"
        />
        <NButton type="primary" @click="handleSearch">查询</NButton>
        <NButton @click="handleResetQuery">重置</NButton>
        <NCheckbox v-model:checked="showFeedbackHistory" @update:checked="handleToggleHistory">
          显示已反馈记录
        </NCheckbox>
      </NSpace>
    </NCard>

    <NCard :bordered="false" size="small" class="flex-1">
      <div class="mb-8px flex items-center justify-between">
        <div class="text-13px text-gray-600">
          已勾选
          <b class="text-primary">{{ selectedCount }}</b>
          条
          <template v-if="selectedCount > 0">
            ·
            <NButton text type="primary" size="tiny" @click="checkedRowKeys = []">清空选择</NButton>
          </template>
        </div>
        <NButton type="primary" :disabled="selectedCount === 0" @click="openBatchModal">
          批量录入重量 ({{ selectedCount }})
        </NButton>
      </div>

      <NDataTable
        v-model:checked-row-keys="checkedRowKeys"
        remote
        :loading="loading"
        :columns="columns"
        :data="list"
        :pagination="pagination"
        :row-key="(r: Api.Weight.CalibrationQueueVO) => r.id"
        :scroll-x="1800"
        size="small"
        striped
      />
    </NCard>

    <!-- 单条录入弹窗 -->
    <NModal
      v-model:show="modalVisible"
      preset="card"
      title="录入实际重量"
      class="w-90vw max-w-600px"
      :mask-closable="false"
    >
      <div v-if="current" class="flex gap-12px">
        <NImage
          :src="current.skuImageUrl ?? current.productImageUrl ?? ''"
          width="100"
          height="100"
          object-fit="cover"
          class="rounded"
        />
        <div class="flex-1">
          <div class="text-14px font-medium">{{ current.subject }}</div>
          <!-- ★ 新增：1688 商品链接 -->
          <div v-if="current.productUrl" class="text-12px mt-4px">
            <NButton
              tag="a"
              :href="current.productUrl"
              target="_blank"
              rel="noopener noreferrer"
              text
              type="primary"
              size="tiny"
            >
              <template #icon>
                <SvgIcon icon="ph:arrow-square-out" width="14" height="14" />
              </template>
              去 1688 查看原商品
            </NButton>
          </div>
          <div class="text-12px text-gray-500 mt-4px">SKU：{{ current.skuGroupName ?? '-' }}</div>

          <!-- ★ 三方对比 -->
          <div class="text-12px mt-8px flex flex-col gap-4px">
            <div>
              商家标重：
              <b :style="{ color: merchantWeightColor(current.merchantWeightFlag) }">
                {{ current.merchantWeightG ?? '未填' }}{{ current.merchantWeightG ? 'g' : '' }}
              </b>
              <span v-if="current.merchantWeightFlag === 'SUSPICIOUS'" class="text-red-500 ml-4px">
                ⚠️ 可疑，建议忽略
              </span>
            </div>
            <div>
              模型推算：
              <b class="text-green-600">{{ current.weightG ?? '-' }}g</b>
              <span v-if="current.reasonableRange" class="text-gray-400">
                （合理范围 {{ current.reasonableRange }}）
              </span>
            </div>
            <div>
              置信度：
              <NTag :type="confidenceTagType(current.confidenceScore) as any" size="tiny" :bordered="false">
                {{ current.confidenceScore }} {{ extractLevel(current.confidenceText) }}
              </NTag>
              <span class="text-gray-400 ml-4px">来源：{{ current.weightSource ?? '-' }}</span>
            </div>
          </div>

          <div class="text-12px text-gray-400 mt-4px">任务 #{{ current.taskId }}</div>
          <div v-if="current.feedbackStatus === 1" class="text-12px text-orange-500 mt-4px">
            上次录入：
            <b>{{ current.latestFeedbackWeight ?? '-' }}g</b>
            （{{ current.latestFeedbackOperator ?? '-' }}） · {{ current.latestFeedbackAt ?? '-' }}
          </div>
        </div>
      </div>

      <NForm label-placement="left" label-width="100px" class="mt-16px">
        <NFormItem label="实际重量(g)" required>
          <NInputNumber
            v-model:value="form.actualWeight as any"
            placeholder="必填"
            :min="0.01"
            :precision="2"
            class="w-200px"
            autofocus
            @keyup.enter="handleSubmit"
          />
        </NFormItem>
        <NFormItem label="员工编号">
          <div class="h-34px flex items-center border border-gray-300 rounded bg-gray-50 px-12px text-gray-600 w-200px">
            {{ operator }}
          </div>
        </NFormItem>
        <NFormItem label="备注">
          <NInput v-model:value="form.remark" type="textarea" :rows="2" placeholder="选填" />
        </NFormItem>
      </NForm>

      <template #footer>
        <NSpace justify="end">
          <NButton @click="modalVisible = false">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="handleSubmit">提交</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 批量录入弹窗 -->
    <NModal
      v-model:show="batchModalVisible"
      preset="card"
      title="批量录入实际重量"
      class="w-90vw max-w-680px"
      :mask-closable="false"
    >
      <NAlert type="warning" :bordered="false" class="mb-16px">
        即将为
        <b>{{ selectedCount }}</b>
        条候选统一录入实际重量。 同一 SKU 只写一次，重复候选会自动去重。
      </NAlert>

      <div class="mb-16px">
        <div class="text-13px text-gray-600 mb-8px">预览（前 {{ Math.min(5, selectedCount) }} 条）：</div>
        <div class="flex flex-col gap-6px">
          <div
            v-for="row in batchPreview"
            :key="row.id"
            class="flex items-center gap-8px border border-gray-200 rounded px-8px py-6px text-12px"
          >
            <NImage :src="row.skuImageUrl ?? ''" width="32" height="32" object-fit="cover" class="rounded shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="truncate">{{ row.subject }}</div>
              <div class="text-gray-400">
                {{ row.skuGroupName ?? '-' }} · 预测 {{ row.weightG ?? '-' }}g
                <a
                  v-if="row.productUrl"
                  :href="row.productUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary ml-4px"
                  @click.stop
                >
                  1688↗
                </a>
                · 商家 {{ row.merchantWeightG ?? '-' }}g · 模型 {{ row.weightG ?? '-' }}g
                <span v-if="row.reasonableRange">（{{ row.reasonableRange }}）</span>
              </div>
            </div>
          </div>
        </div>
        <div v-if="selectedCount > 5" class="text-12px text-gray-400 mt-8px">...还有 {{ selectedCount - 5 }} 条</div>
      </div>

      <NDivider />

      <NForm label-placement="left" label-width="100px">
        <NFormItem label="实际重量(g)" required>
          <NInputNumber
            v-model:value="batchForm.actualWeight as any"
            placeholder="必填"
            :min="0.01"
            :precision="2"
            class="w-200px"
            autofocus
            @keyup.enter="handleBatchSubmit"
          />
        </NFormItem>
        <NFormItem label="员工编号">
          <div class="h-34px flex items-center border border-gray-300 rounded bg-gray-50 px-12px text-gray-600 w-200px">
            {{ operator }}
          </div>
        </NFormItem>
        <NFormItem label="备注">
          <NInput
            v-model:value="batchForm.remark"
            type="textarea"
            :rows="2"
            placeholder="选填，建议说明批量依据（如：同款套装已称重）"
          />
        </NFormItem>
      </NForm>

      <template #footer>
        <NSpace justify="end">
          <NButton @click="batchModalVisible = false">取消</NButton>
          <NButton type="primary" :loading="batchSubmitting" @click="handleBatchSubmit">
            确认批量录入 ({{ selectedCount }})
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped></style>
