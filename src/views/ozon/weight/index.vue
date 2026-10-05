<script setup lang="ts">
import { h, reactive, ref, computed } from 'vue';
import type { DataTableColumns } from 'naive-ui';
import {
  NAlert,
  NButton,
  NCard,
  NDataTable,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NSpace,
  NTag,
  NTabPane,
  NTabs,
  NCheckbox,
  NDivider,
  NEmpty,
  useMessage
} from 'naive-ui';
import { useAuthStore } from '@/store/modules/auth';
import { fetchEvaluateWeight, fetchSubmitWeightFeedback, fetchLatestWeightFeedback } from '@/service/api/ozon-weight';

defineOptions({ name: 'OzonWeightCalibration' });

const message = useMessage();
const authStore = useAuthStore();

// ==================== 当前登录用户（用于自动填入员工编号） ====================
const operator = computed(() => authStore.userInfo.userName ?? '未知用户');

// ==================== 通用工具 ====================

/** 从 "100 高" 中解析出分数 */
function parseConfidenceScore(conf?: string): number {
  if (!conf) return 0;
  const m = conf.match(/\d+/);
  return m ? Number.parseInt(m[0], 10) : 0;
}

/** 置信度标签颜色 */
function confidenceTagType(conf?: string): 'success' | 'info' | 'warning' | 'error' | 'default' {
  const score = parseConfidenceScore(conf);
  if (score >= 90) return 'success';
  if (score >= 75) return 'info';
  if (score >= 60) return 'warning';
  if (score > 0) return 'error';
  return 'default';
}

// ==================== Tab1：快速录入 ====================

type QuickForm = {
  offerId: number | null;
  skuId: string;
  skuGroupName: string;
  predictedWeight?: number;
  actualWeight: number | null;
  remark: string;
};

const quickForm = reactive<QuickForm>({
  offerId: null,
  skuId: '',
  skuGroupName: '',
  predictedWeight: undefined,
  actualWeight: null,
  remark: ''
});

const quickSubmitting = ref(false);

async function handleQuickSubmit() {
  if (!quickForm.offerId) {
    message.warning('请输入 offerId');
    return;
  }
  if (!quickForm.skuId?.trim()) {
    message.warning('请输入 skuId');
    return;
  }
  if (!quickForm.actualWeight || quickForm.actualWeight <= 0) {
    message.warning('请输入大于 0 的实际重量');
    return;
  }

  quickSubmitting.value = true;
  try {
    const { data, error } = await fetchSubmitWeightFeedback({
      offerId: quickForm.offerId,
      skuId: quickForm.skuId,
      skuGroupName: quickForm.skuGroupName,
      predictedWeight: quickForm.predictedWeight,
      actualWeight: quickForm.actualWeight,
      remark: quickForm.remark,
      // ★ 员工编号自动填入当前登录账号，不可编辑
      employeeId: operator.value
    });
    if (!error && data) {
      message.success(
        `录入成功：偏差 ${data.latest?.deviation_percent ?? '-'}%，时间 ${data.latest?.create_time ?? '-'}`
      );
      // 保留 offerId，方便连续录入
      quickForm.skuId = '';
      quickForm.skuGroupName = '';
      quickForm.predictedWeight = undefined;
      quickForm.actualWeight = null;
      quickForm.remark = '';
    }
  } finally {
    quickSubmitting.value = false;
  }
}

// ==================== Tab2：商详评估 ====================

const offerJsonText = ref('');
const evaluating = ref(false);
const currentOfferId = ref<number | null>(null);
const skuList = ref<Api.Weight.SkuWeightItem[]>([]);
const lowConfidenceOnly = ref(false);

const displayedSkuList = computed(() => {
  if (!lowConfidenceOnly.value) return skuList.value;
  return skuList.value.filter(item => parseConfidenceScore(item.confidence) < 60);
});

async function handleEvaluate() {
  const raw = offerJsonText.value.trim();
  if (!raw) {
    message.warning('请粘贴商详 JSON');
    return;
  }

  let offerObj: any;
  try {
    offerObj = JSON.parse(raw);
  } catch (e) {
    message.error('JSON 解析失败：' + (e as Error).message);
    return;
  }
  // 兼容用户直接粘贴完整响应（带 result 包裹）
  const offer = offerObj.offer ?? offerObj.result ?? offerObj.result?.result ?? offerObj;

  evaluating.value = true;
  try {
    const { data, error } = await fetchEvaluateWeight({ offer });
    if (!error && data) {
      skuList.value = data.data?.data ?? [];
      currentOfferId.value = data.data?.offerId ?? null;
      message.success(`评估完成，共 ${skuList.value.length} 个 SKU`);
    }
  } finally {
    evaluating.value = false;
  }
}

// ==================== 录入弹窗（评估结果行内触发） ====================

type FeedbackForm = {
  offerId: number;
  skuId: string;
  skuGroupName: string;
  predictedWeight?: number;
  actualWeight: number | null;
  remark: string;
};

const feedbackModalVisible = ref(false);
const feedbackForm = reactive<FeedbackForm>({
  offerId: 0,
  skuId: '',
  skuGroupName: '',
  predictedWeight: undefined,
  actualWeight: null,
  remark: ''
});
const feedbackSubmitting = ref(false);
const latestFeedback = ref<Api.Weight.FeedbackLatest | null>(null);
const latestLoading = ref(false);

async function openFeedbackModal(row: Api.Weight.SkuWeightItem) {
  if (!currentOfferId.value) {
    message.warning('缺少 offerId');
    return;
  }
  feedbackForm.offerId = currentOfferId.value;
  feedbackForm.skuId = row.skuId;
  feedbackForm.skuGroupName = row.skuGroupName;
  feedbackForm.predictedWeight = Number.parseFloat((row.logisticsWeight || '').replace(/[^\d.]/g, '')) || undefined;
  feedbackForm.actualWeight = null;
  feedbackForm.remark = '';
  latestFeedback.value = null;

  feedbackModalVisible.value = true;

  // 异步查询该 SKU 最近一次反馈
  latestLoading.value = true;
  try {
    const { data, error } = await fetchLatestWeightFeedback(row.skuId);
    if (!error && data) latestFeedback.value = data;
  } finally {
    latestLoading.value = false;
  }
}

async function handleFeedbackSubmit() {
  if (!feedbackForm.actualWeight || feedbackForm.actualWeight <= 0) {
    message.warning('请输入大于 0 的实际重量');
    return;
  }
  feedbackSubmitting.value = true;
  try {
    const { data, error } = await fetchSubmitWeightFeedback({
      offerId: feedbackForm.offerId,
      skuId: feedbackForm.skuId,
      skuGroupName: feedbackForm.skuGroupName,
      predictedWeight: feedbackForm.predictedWeight,
      actualWeight: feedbackForm.actualWeight,
      remark: feedbackForm.remark,
      // ★ 员工编号自动填入当前登录账号，不可编辑
      employeeId: operator.value
    });
    if (!error && data) {
      message.success(`录入成功，偏差 ${data.latest?.deviation_percent ?? '-'}%`);
      feedbackModalVisible.value = false;
      // 重新评估以刷新置信度
      if (currentOfferId.value) await handleEvaluate();
    }
  } finally {
    feedbackSubmitting.value = false;
  }
}

// ==================== 表格列 ====================

const columns: DataTableColumns<Api.Weight.SkuWeightItem> = [
  { title: 'SKU ID', key: 'skuId', width: 140 },
  {
    title: 'SKU 分组',
    key: 'skuGroupName',
    minWidth: 140,
    ellipsis: { tooltip: true }
  },
  { title: '净重', key: 'netWeight', width: 90 },
  {
    title: '物流重',
    key: 'logisticsWeight',
    width: 100,
    render: row => h('span', { style: 'font-weight: 600' }, row.logisticsWeight || '-')
  },
  { title: '合理范围', key: 'reasonableRange', width: 130 },
  {
    title: '置信度',
    key: 'confidence',
    width: 100,
    render: row =>
      h(
        NTag,
        { type: confidenceTagType(row.confidence), size: 'small', bordered: false },
        { default: () => row.confidence || '-' }
      )
  },
  {
    title: '主要依据/风险',
    key: 'reason',
    minWidth: 260,
    ellipsis: { tooltip: true },
    render: row => row.reason || '-'
  },
  {
    title: '操作',
    key: 'actions',
    width: 130,
    fixed: 'right',
    render: row =>
      h(
        NButton,
        {
          size: 'small',
          type: 'primary',
          onClick: () => openFeedbackModal(row)
        },
        { default: () => '录入实际重量' }
      )
  }
];

// ==================== 挂载 ====================
// 页面无需自动加载
</script>

<template>
  <div class="h-full flex-col gap-16px p-16px">
    <NTabs type="line" animated>
      <!-- ==================== Tab1：员工快速录入 ==================== -->
      <NTabPane name="quick" tab="员工快速录入">
        <NCard :bordered="false" size="small" class="mt-8px">
          <NAlert type="info" :bordered="false" class="mb-16px">
            员工称重后直接录入 SKU 的实际重量。系统会自动计算偏差率，下次评估该 SKU 时会自动采用实测值。
          </NAlert>

          <NForm label-placement="left" label-width="120px" class="max-w-700px">
            <NFormItem label="Offer ID" required>
              <NInput
                v-model:value="quickForm.offerId as any"
                placeholder="1688 商品 ID（数字）"
                :allow-input="(v: string) => /^\d*$/.test(v)"
              />
            </NFormItem>

            <NFormItem label="SKU ID" required>
              <NInput v-model:value="quickForm.skuId" placeholder="SKU ID" clearable />
            </NFormItem>

            <NFormItem label="SKU 分组名">
              <NInput v-model:value="quickForm.skuGroupName" placeholder="选填，如 25cm 红色" clearable />
            </NFormItem>

            <NFormItem label="预测重量(g)">
              <NInputNumber
                v-model:value="quickForm.predictedWeight as any"
                placeholder="选填，系统预估值"
                :min="0"
                class="w-200px"
              />
            </NFormItem>

            <NFormItem label="实际重量(g)" required>
              <NInputNumber
                v-model:value="quickForm.actualWeight as any"
                placeholder="必填，员工称重值"
                :min="0.01"
                :precision="2"
                class="w-200px"
              />
            </NFormItem>

            <!-- ★ 员工编号：自动填入当前登录账号，只读展示 -->
            <NFormItem label="员工编号">
              <div
                class="h-34px flex items-center border border-gray-300 rounded bg-gray-50 px-12px text-14px text-gray-600 w-300px"
              >
                {{ operator }}
              </div>
            </NFormItem>

            <NFormItem label="备注">
              <NInput v-model:value="quickForm.remark" type="textarea" :rows="2" placeholder="选填" />
            </NFormItem>

            <NFormItem :show-label="false">
              <NSpace>
                <NButton type="primary" :loading="quickSubmitting" @click="handleQuickSubmit">提交录入</NButton>
              </NSpace>
            </NFormItem>
          </NForm>
        </NCard>
      </NTabPane>

      <!-- ==================== Tab2：商详评估 ==================== -->
      <NTabPane name="evaluate" tab="商详评估">
        <NCard :bordered="false" size="small" class="mt-8px">
          <NAlert type="info" :bordered="false" class="mb-16px">
            粘贴 1688 商详 JSON（完整响应或直接 result.result 均可），系统会按 SKU 评估重量，供人工复核。
          </NAlert>

          <NInput
            v-model:value="offerJsonText"
            type="textarea"
            :rows="6"
            placeholder='粘贴商详 JSON，例如：{"offerId":34513534353434,"subject":"25cm毛绒汽车","productImage":{...},"productSkuInfos":[...]}'
          />

          <NSpace class="mt-12px" align="center">
            <NButton type="primary" :loading="evaluating" @click="handleEvaluate">评估重量</NButton>
            <NCheckbox v-model:checked="lowConfidenceOnly">只看低置信度（&lt;60）</NCheckbox>
          </NSpace>
        </NCard>

        <NCard v-if="skuList.length > 0" :bordered="false" size="small" class="mt-16px">
          <div class="mb-8px flex items-center justify-between">
            <div class="text-14px text-gray-600">
              Offer #{{ currentOfferId }} · 共 {{ skuList.length }} 个 SKU
              <span v-if="lowConfidenceOnly" class="text-orange-500">（筛选后 {{ displayedSkuList.length }} 个）</span>
            </div>
          </div>

          <NDataTable
            :columns="columns"
            :data="displayedSkuList"
            :row-key="(r: Api.Weight.SkuWeightItem) => r.skuId"
            :scroll-x="1200"
            size="small"
            striped
          />
        </NCard>

        <NEmpty v-else class="mt-60px" description="暂无评估数据，请粘贴商详 JSON 后点击评估" />
      </NTabPane>
    </NTabs>

    <!-- ==================== 录入弹窗 ==================== -->
    <NModal
      v-model:show="feedbackModalVisible"
      preset="card"
      title="录入实际称重"
      class="w-90vw max-w-600px"
      :mask-closable="false"
    >
      <NAlert type="warning" :bordered="false" class="mb-16px">
        SKU：
        <b>{{ feedbackForm.skuGroupName }}</b>
        （{{ feedbackForm.skuId }}）
        <br />
        系统预测物流重：
        <b>{{ feedbackForm.predictedWeight ?? '-' }} g</b>
      </NAlert>

      <div v-if="latestLoading" class="text-12px text-gray-500 mb-12px">正在查询历史反馈...</div>
      <div v-else-if="latestFeedback" class="text-12px text-gray-500 mb-12px">
        上次录入：
        <b>{{ latestFeedback.actual_weight }} g</b>
        （偏差 {{ latestFeedback.deviation_percent }}%） · {{ latestFeedback.create_time }}
      </div>

      <NDivider />

      <NForm label-placement="left" label-width="120px">
        <NFormItem label="实际重量(g)" required>
          <NInputNumber
            v-model:value="feedbackForm.actualWeight as any"
            placeholder="必填"
            :min="0.01"
            :precision="2"
            class="w-200px"
          />
        </NFormItem>

        <!-- ★ 员工编号：自动填入当前登录账号，只读展示 -->
        <NFormItem label="员工编号">
          <div
            class="h-34px flex items-center border border-gray-300 rounded bg-gray-50 px-12px text-14px text-gray-600 w-300px"
          >
            {{ operator }}
          </div>
        </NFormItem>

        <NFormItem label="备注">
          <NInput v-model:value="feedbackForm.remark" type="textarea" :rows="2" placeholder="选填" />
        </NFormItem>
      </NForm>

      <template #footer>
        <NSpace justify="end">
          <NButton @click="feedbackModalVisible = false">取消</NButton>
          <NButton type="primary" :loading="feedbackSubmitting" @click="handleFeedbackSubmit">提交</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped></style>
