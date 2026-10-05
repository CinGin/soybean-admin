<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  NAlert,
  NButton,
  NCard,
  NDivider,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NSelect,
  NSpace,
  NSwitch,
  NTabPane,
  NTabs,
  useDialog, // ★ 新增
  useMessage
} from 'naive-ui';
import { useAuthStore } from '@/store/modules/auth';
import {
  fetchAddCommissionRate,
  fetchRetryAfterCommissionFix,
  fetchRepriceTemporary,
  fetchApplyTemporaryRate, // ★ 新增
  fetchCommissionRatePage
} from '@/service/api/ozon-auto-listing';

interface Props {
  visible: boolean;
  task: Api.AutoListing.TaskItem | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void;
  (e: 'saved'): void;
}>();

const message = useMessage();
const dialog = useDialog(); // ★ 新增
const authStore = useAuthStore();

const operator = computed(() => authStore.userInfo.userName ?? '未知用户');

const activeTab = ref<'fix' | 'temp'>('fix');

// ==================== Tab1：补库 ====================

type FixForm = {
  categoryId: number | null;
  categoryL1Cn: string;
  categoryL2Cn: string;
  categoryL3Cn: string;
  brand: string;
  rfbsRate01500: number | null;
  rfbsRate15005000: number | null;
  rfbsRate5000Plus: number | null;
  fbpRate01500: number | null;
  fbpRate15005000: number | null;
  fbpRate5000Plus: number | null;
};

function emptyFixForm(): FixForm {
  return {
    categoryId: null,
    categoryL1Cn: '',
    categoryL2Cn: '',
    categoryL3Cn: '',
    brand: 'All',
    rfbsRate01500: 0.12,
    rfbsRate15005000: 0.14,
    rfbsRate5000Plus: 0.16,
    fbpRate01500: 0.12,
    fbpRate15005000: 0.14,
    fbpRate5000Plus: 0.16
  };
}

const fixForm = ref<FixForm>(emptyFixForm());
const fixSubmitting = ref(false);
const autoRetry = ref(true);

// ==================== Tab2：临时费率 ====================

type TempForm = {
  categoryId: number | null;
  rfbsRate: number | null;
};

const tempForm = ref<TempForm>({
  categoryId: null,
  rfbsRate: null
});

const tempSubmitting = ref(false);
const applySubmitting = ref(false); // ★ 新增：提交应用
const tempResult = ref<Api.AutoListing.TemporaryRepriceResult | null>(null);

/** 佣金类目下拉 */
const commissionOptions = ref<{ label: string; value: number; raw: Api.AutoListing.CommissionRate }[]>([]);
const commissionLoading = ref(false);

/** ★ 服务端搜索：根据关键词拉取 */
async function fetchCommissionList(keyword: string) {
  commissionLoading.value = true;
  try {
    const { data, error } = await fetchCommissionRatePage({
      pageNo: 1,
      pageSize: 50,
      keyword: keyword || undefined
    });
    if (!error && data?.records) {
      commissionOptions.value = data.records
        .filter(r => r.categoryId != null)
        .map(r => {
          const path = [
            r.categoryL1Cn || r.categoryL1Ru,
            r.categoryL2Cn || r.categoryL2Ru,
            r.categoryL3Cn || r.categoryL3Ru
          ]
            .filter(Boolean)
            .join(' / ');
          return {
            label: `${path || '-'} [${r.categoryId}]`,
            value: r.categoryId as number,
            raw: r
          };
        });
    }
  } finally {
    commissionLoading.value = false;
  }
}

/** 搜索回调 */
async function onCommissionSearch(query: string) {
  await fetchCommissionList(query);
}

/** 选中佣金类目，自动带出费率 */
function onCommissionSelect(categoryId: number) {
  const opt = commissionOptions.value.find(o => o.value === categoryId);
  if (opt) {
    tempForm.value.rfbsRate = opt.raw.rfbsRate01500 ?? null;
  }
}

// ==================== 生命周期 ====================

watch(
  () => props.visible,
  v => {
    if (v && props.task) {
      // 重置 Tab1
      const init = emptyFixForm();
      if (props.task.ozonCategoryId) {
        const n = Number(props.task.ozonCategoryId);
        if (!Number.isNaN(n)) init.categoryId = n;
      }
      fixForm.value = init;
      autoRetry.value = true;

      // 重置 Tab2
      tempForm.value = { categoryId: null, rfbsRate: null };
      tempResult.value = null;

      // 首次加载前 50 条
      fetchCommissionList('');

      activeTab.value = 'fix';
    }
  }
);

// ==================== Tab1 提交 ====================

async function handleFixSubmit() {
  if (!fixForm.value.categoryId) {
    message.warning('请填写 category_id');
    return;
  }
  if (!fixForm.value.categoryL1Cn?.trim()) {
    message.warning('请填写一级类目中文名');
    return;
  }
  if (!fixForm.value.categoryL2Cn?.trim()) {
    message.warning('请填写二级类目中文名');
    return;
  }
  if (!fixForm.value.categoryL3Cn?.trim()) {
    message.warning('请填写三级类目中文名');
    return;
  }
  if (!fixForm.value.brand?.trim()) {
    message.warning('请填写品牌');
    return;
  }
  const rfbs = [fixForm.value.rfbsRate01500, fixForm.value.rfbsRate15005000, fixForm.value.rfbsRate5000Plus];
  if (rfbs.some(v => v == null)) {
    message.warning('请填写完整的三档 RFBS 费率');
    return;
  }
  const fbp = [fixForm.value.fbpRate01500, fixForm.value.fbpRate15005000, fixForm.value.fbpRate5000Plus];
  if (fbp.some(v => v == null)) {
    message.warning('请填写完整的三档 FBP 费率');
    return;
  }

  fixSubmitting.value = true;
  try {
    const payload: Api.AutoListing.CommissionRate = {
      categoryId: fixForm.value.categoryId,
      categoryL1Cn: fixForm.value.categoryL1Cn.trim(),
      categoryL2Cn: fixForm.value.categoryL2Cn.trim(),
      categoryL3Cn: fixForm.value.categoryL3Cn.trim(),
      categoryL1Ru: '',
      categoryL2Ru: '',
      categoryL3Ru: '',
      brand: fixForm.value.brand.trim(),
      rfbsRate01500: fixForm.value.rfbsRate01500,
      rfbsRate15005000: fixForm.value.rfbsRate15005000,
      rfbsRate5000Plus: fixForm.value.rfbsRate5000Plus,
      fbpRate01500: fixForm.value.fbpRate01500,
      fbpRate15005000: fixForm.value.fbpRate15005000,
      fbpRate5000Plus: fixForm.value.fbpRate5000Plus,
      creator: operator.value
    };
    const { error } = await fetchAddCommissionRate(payload);
    if (error) return;
    message.success('佣金费率已添加');

    if (autoRetry.value && props.task) {
      const { error: retryErr } = await fetchRetryAfterCommissionFix(props.task.id);
      if (!retryErr) {
        message.success('任务已回退到 SEARCHED，后台正在重跑首定价');
      }
    }

    emit('update:visible', false);
    emit('saved');
  } finally {
    fixSubmitting.value = false;
  }
}

// ==================== Tab2 试算 ====================

async function handleTempCalculate() {
  if (!tempForm.value.categoryId) {
    message.warning('请选择一个佣金类目');
    return;
  }
  if (tempForm.value.rfbsRate == null || tempForm.value.rfbsRate <= 0 || tempForm.value.rfbsRate >= 1) {
    message.warning('请输入 0~1 之间的 RFBS 费率');
    return;
  }
  if (!props.task) return;

  tempSubmitting.value = true;
  tempResult.value = null;
  try {
    const { data, error } = await fetchRepriceTemporary(props.task.id, {
      categoryId: tempForm.value.categoryId,
      rfbsRate: tempForm.value.rfbsRate,
      operator: operator.value
    });
    if (!error && data) {
      tempResult.value = data;
      message.success('试算完成，如满意可点击"提交并继续"');
    }
  } finally {
    tempSubmitting.value = false;
  }
}

// ==================== Tab2 提交应用（弹窗确认） ====================

function handleTempApply() {
  if (!tempResult.value || !tempForm.value.categoryId) return;

  const rfbsRateStr = (tempForm.value.rfbsRate! * 100).toFixed(2);
  const categoryName = commissionOptions.value.find(o => o.value === tempForm.value.categoryId)?.label ?? '-';

  dialog.warning({
    title: '确认按所选类目佣金费率执行后续流程',
    content: `即将使用类目「${categoryName}」的费率 ${rfbsRateStr}% 计算价格，并把结果应用到任务 #${props.task?.id}，随后触发首定价流程。\n\n确定继续吗？`,
    positiveText: '确认执行',
    negativeText: '取消',
    onPositiveClick: async () => {
      await doApply();
    }
  });
}

async function doApply() {
  if (!props.task) return;
  applySubmitting.value = true;
  try {
    const { data, error } = await fetchApplyTemporaryRate(props.task.id, {
      categoryId: tempForm.value.categoryId!,
      rfbsRate: tempForm.value.rfbsRate!,
      operator: operator.value
    });
    if (!error && data) {
      message.success('已应用临时费率，任务开始重跑');
      emit('update:visible', false);
      emit('saved');
    }
  } finally {
    applySubmitting.value = false;
  }
}

function handleClose() {
  emit('update:visible', false);
}

const taskHint = computed(() => {
  if (!props.task) return '';
  return `任务 #${props.task.id}（variantId: ${props.task.variantId}），类目ID: ${props.task.ozonCategoryId ?? '-'}`;
});
</script>

<template>
  <NModal
    :show="visible"
    preset="card"
    title="佣金费率处理"
    class="w-90vw max-w-900px"
    :mask-closable="false"
    @update:show="handleClose"
  >
    <NAlert type="warning" :bordered="false" class="mb-16px">
      该任务因
      <b>未找到佣金类目</b>
      而失败，请选择以下任一方式处理。
      <div class="mt-4px text-12px">{{ taskHint }}</div>
    </NAlert>

    <NTabs v-model:value="activeTab" type="line" animated>
      <!-- ==================== Tab1: 补库 ==================== -->
      <NTabPane name="fix" tab="方式1：补充类目并入库">
        <NCard :bordered="false" size="small" class="mt-8px">
          <NForm label-placement="left" label-width="150">
            <NFormItem label="category_id" required>
              <NInputNumber
                v-model:value="fixForm.categoryId"
                placeholder="Ozon 三级类目ID"
                class="w-full"
                :min="1"
                :show-button="false"
              />
            </NFormItem>

            <NDivider title-placement="left" class="!my-8px">类目名称（中文必填）</NDivider>

            <NFormItem label="一级类目（中文）" required>
              <NInput v-model:value="fixForm.categoryL1Cn" placeholder="如：家居" />
            </NFormItem>
            <NFormItem label="二级类目（中文）" required>
              <NInput v-model:value="fixForm.categoryL2Cn" placeholder="如：家纺" />
            </NFormItem>
            <NFormItem label="三级类目（中文）" required>
              <NInput v-model:value="fixForm.categoryL3Cn" placeholder="如：毛毯" />
            </NFormItem>
            <NFormItem label="品牌" required>
              <NInput v-model:value="fixForm.brand" placeholder="如：All" />
            </NFormItem>

            <NDivider title-placement="left" class="!my-8px">RFBS 费率（0~1 小数，默认 0.12/0.14/0.16）</NDivider>

            <NFormItem label="0 - 1500 卢布" required>
              <NInputNumber
                v-model:value="fixForm.rfbsRate01500"
                :step="0.01"
                :min="0"
                :max="1"
                :precision="4"
                class="w-200px"
              />
            </NFormItem>
            <NFormItem label="1500.01 - 5000 卢布" required>
              <NInputNumber
                v-model:value="fixForm.rfbsRate15005000"
                :step="0.01"
                :min="0"
                :max="1"
                :precision="4"
                class="w-200px"
              />
            </NFormItem>
            <NFormItem label="5000.01 卢布以上" required>
              <NInputNumber
                v-model:value="fixForm.rfbsRate5000Plus"
                :step="0.01"
                :min="0"
                :max="1"
                :precision="4"
                class="w-200px"
              />
            </NFormItem>

            <NDivider title-placement="left" class="!my-8px">FBP 费率（0~1 小数，默认 0.12/0.14/0.16）</NDivider>

            <NFormItem label="0 - 1500 卢布" required>
              <NInputNumber
                v-model:value="fixForm.fbpRate01500"
                :step="0.01"
                :min="0"
                :max="1"
                :precision="4"
                class="w-200px"
              />
            </NFormItem>
            <NFormItem label="1500.01 - 5000 卢布" required>
              <NInputNumber
                v-model:value="fixForm.fbpRate15005000"
                :step="0.01"
                :min="0"
                :max="1"
                :precision="4"
                class="w-200px"
              />
            </NFormItem>
            <NFormItem label="5000.01 卢布以上" required>
              <NInputNumber
                v-model:value="fixForm.fbpRate5000Plus"
                :step="0.01"
                :min="0"
                :max="1"
                :precision="4"
                class="w-200px"
              />
            </NFormItem>

            <NFormItem label="创建人">
              <div
                class="h-34px flex items-center border border-gray-300 rounded bg-gray-50 px-12px text-14px text-gray-600 w-300px"
              >
                {{ operator }}
              </div>
            </NFormItem>

            <NFormItem label="保存后重跑任务">
              <NSpace align="center" :size="8">
                <NSwitch v-model:value="autoRetry" />
                <span class="text-12px text-gray-500">回退到 SEARCHED 并异步重跑首定价（保留候选，只重跑定价）</span>
              </NSpace>
            </NFormItem>
          </NForm>

          <NSpace justify="end" class="mt-16px">
            <NButton @click="handleClose">取消</NButton>
            <NButton type="primary" :loading="fixSubmitting" @click="handleFixSubmit">保存并重跑</NButton>
          </NSpace>
        </NCard>
      </NTabPane>

      <!-- ==================== Tab2: 临时费率 ==================== -->
      <NTabPane name="temp" tab="方式2：临时选择费率（复用已有类目）">
        <NCard :bordered="false" size="small" class="mt-8px">
          <NAlert type="info" :bordered="false" class="mb-16px">
            从已有佣金类目中选择一个（如某些类目费率相同可直接复用），
            <b>试算满意后</b>
            可以提交应用，触发后续定价流程。
          </NAlert>

          <NForm label-placement="left" label-width="150">
            <NFormItem label="佣金类目" required>
              <NSelect
                v-model:value="tempForm.categoryId"
                :options="commissionOptions"
                :loading="commissionLoading"
                placeholder="输入关键词搜索佣金类目"
                filterable
                remote
                clearable
                :on-search="onCommissionSearch"
                @update:value="onCommissionSelect"
              />
            </NFormItem>

            <NFormItem label="RFBS 费率 (0~1)" required>
              <NInputNumber
                v-model:value="tempForm.rfbsRate"
                :step="0.01"
                :min="0"
                :max="1"
                :precision="4"
                class="w-200px"
                placeholder="选择类目后自动带出"
              />
            </NFormItem>

            <NFormItem label="操作人">
              <div
                class="h-34px flex items-center border border-gray-300 rounded bg-gray-50 px-12px text-14px text-gray-600 w-300px"
              >
                {{ operator }}
              </div>
            </NFormItem>
          </NForm>

          <NSpace justify="end" class="mt-16px">
            <NButton @click="handleClose">取消</NButton>
            <NButton type="info" :loading="tempSubmitting" :disabled="applySubmitting" @click="handleTempCalculate">
              试算
            </NButton>
            <NButton
              type="primary"
              :loading="applySubmitting"
              :disabled="!tempResult || tempSubmitting"
              @click="handleTempApply"
            >
              提交并继续
            </NButton>
          </NSpace>

          <!-- 试算结果 -->
          <div v-if="tempResult" class="mt-20px">
            <NDivider title-placement="left">试算结果（尚未应用）</NDivider>
            <NAlert type="success" :bordered="false">
              <div class="text-14px leading-7">
                <div>任务：#{{ tempResult.taskId }}</div>
                <div>
                  最终售价：
                  <b>{{ tempResult.finalPrice }} {{ tempResult.currency }}</b>
                </div>
                <div>
                  划线价：
                  <b>{{ tempResult.originalPrice }} {{ tempResult.currency }}</b>
                </div>
                <div>
                  使用的佣金率：
                  <b>{{ (tempResult.commissionRate * 100).toFixed(2) }}%</b>
                </div>
              </div>
            </NAlert>
            <div class="mt-12px text-12px text-gray-500">
              如满意，请点击上方"提交并继续"，将用该费率计算并应用到任务，随后触发首定价流程。
            </div>
          </div>
        </NCard>
      </NTabPane>
    </NTabs>
  </NModal>
</template>

<style scoped></style>
