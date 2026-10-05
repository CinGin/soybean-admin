<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useMessage, type FormRules } from 'naive-ui';
import {
  calculatePrice,
  fetchExchangeRates,
  fetchCommissionCategories,
  fetchGrossProfitConfig,
  updateGrossProfitConfig
} from '@/service/api/ozon-pricing';
import type { Api } from '@/typings/api/ozon-pricing';

const message = useMessage();

// 在 formData 中增加 weightUnit，默认为 'g'
const formData = reactive({
  shopType: 'CNY' as Api.OzonPricing.ShopType,
  purchasePrice: null as number | null,
  weightG: null as number | null, // 始终保存为克（内部使用）
  weightInput: null as number | null, // 界面输入值（与显示单位一致）
  weightUnit: 'g' as 'g' | 'kg', // 当前显示单位
  commissionMode: 'manual' as Api.OzonPricing.CommissionMode,
  commissionRate: null as number | null,
  categoryId: null as number | null
});

const loading = ref(false);
const resultDetail = ref<Api.OzonPricing.CalcDetail | null>(null);
const exchangeRates = ref<Api.OzonPricing.ExchangeRates | null>(null);
const commissionCategories = ref<Api.OzonPricing.CommissionCategory[]>([]);
const selectedCategory = computed(() => {
  return commissionCategories.value.find(c => c.categoryId === formData.categoryId) || null;
});

const rules: FormRules = {
  purchasePrice: [
    { required: true, type: 'number', message: '请输入进货价', trigger: 'blur' },
    { type: 'number', min: 0, message: '进货价不能为负数', trigger: 'blur' }
  ],
  weightG: [
    { required: true, type: 'number', message: '请输入产品重量', trigger: 'blur' },
    { type: 'number', min: 1, message: '重量至少为1克', trigger: 'blur' }
  ],
  commissionRate: [
    { required: true, type: 'number', message: '请输入佣金率', trigger: 'blur' },
    { type: 'number', min: 0, max: 100, message: '佣金率应在0~100之间', trigger: 'blur' }
  ],
  categoryId: [{ required: true, type: 'number', message: '请选择类目', trigger: 'change' }]
};

const formRef = ref();
// 新增状态
const grossProfitConfig = ref<Api.OzonPricing.GrossProfitConfig | null>(null);
const configSaving = ref(false);

// 加载配置
async function loadGrossProfitConfig() {
  try {
    const config = await fetchGrossProfitConfig();
    console.log('获取到的毛利率配置:', config);
    if (config && typeof config === 'object' && 'ratio0To30' in config) {
      grossProfitConfig.value = config;
    } else {
      message.warning('未获取到毛利率配置，请检查后端');
    }
  } catch (e) {
    message.error('加载毛利率配置失败');
    console.error(e);
  }
}

// 保存配置
async function saveGrossProfitConfig() {
  if (!grossProfitConfig.value) return;
  configSaving.value = true;
  try {
    const latestConfig = await updateGrossProfitConfig(grossProfitConfig.value);
    if (latestConfig) {
      grossProfitConfig.value = latestConfig;
    } else {
      // 如果返回 null，则回退重新查询
      await loadGrossProfitConfig();
    }
    message.success('毛利率配置已保存');
  } catch (e) {
    message.error('保存配置失败');
    console.error(e);
  } finally {
    configSaving.value = false;
  }
}
async function loadInitialData() {
  const [rates, categories] = await Promise.all([fetchExchangeRates(), fetchCommissionCategories()]);
  exchangeRates.value = rates;
  commissionCategories.value = categories;
}

function handleModeChange(mode: Api.OzonPricing.CommissionMode) {
  formData.commissionMode = mode;
  // 切换模式时清空对应字段
  if (mode === 'manual') formData.categoryId = null;
  else formData.commissionRate = null;
}

async function handleCalculate() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  // 转换重量为克
  if (formData.weightUnit === 'kg') {
    formData.weightG = Number((formData.weightInput! * 1000).toFixed(1));
  } else {
    formData.weightG = formData.weightInput;
  }
  if (!formData.purchasePrice || !formData.weightG) {
    message.warning('请填写完整参数');
    return;
  }
  if (formData.commissionMode === 'manual' && !formData.commissionRate) {
    message.warning('请输入佣金率');
    return;
  }
  if (formData.commissionMode === 'category' && !formData.categoryId) {
    message.warning('请选择类目');
    return;
  }

  loading.value = true;
  resultDetail.value = null;
  try {
    const detail = await calculatePrice({
      purchasePrice: formData.purchasePrice,
      weightG: formData.weightG,
      shopType: formData.shopType,
      commissionMode: formData.commissionMode,
      commissionRate: formData.commissionMode === 'manual' ? formData.commissionRate : null,
      categoryId: formData.commissionMode === 'category' ? formData.categoryId : null
    });
    resultDetail.value = detail;
    if (detail.usdToRub && detail.usdToCny && detail.cnyToRub) {
      exchangeRates.value = {
        usdToRub: detail.usdToRub,
        usdToCny: detail.usdToCny,
        cnyToRub: detail.cnyToRub
      };
    }
    message.success('计算完成');
  } catch (error) {
    message.error('计算失败，请稍后重试');
    console.error(error);
  } finally {
    loading.value = false;
  }
}

function handleReset() {
  formData.purchasePrice = null;
  formData.weightG = null;
  formData.commissionMode = 'manual';
  formData.commissionRate = null;
  formData.categoryId = null;
  resultDetail.value = null;
  formRef.value?.restoreValidation();
}
// 单位切换时，将当前输入值按比例转换
function handleWeightUnitChange(unit: 'g' | 'kg') {
  if (formData.weightInput === null) return;
  if (unit === 'kg' && formData.weightUnit === 'g') {
    formData.weightInput = Number((formData.weightInput / 1000).toFixed(3));
  } else if (unit === 'g' && formData.weightUnit === 'kg') {
    formData.weightInput = Number((formData.weightInput * 1000).toFixed(1));
  }
  formData.weightUnit = unit;
}

onMounted(() => {
  loadInitialData();
  loadGrossProfitConfig();
});

const fmt = (num: number | undefined, digits = 2) => (num !== undefined ? Number(num).toFixed(digits) : '—');
</script>

<template>
  <div class="p-6 bg-gray-50 min-h-screen">
    <!-- 页面标题 + 汇率标签 -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-800 m-0 flex items-center gap-2">
          <SvgIcon icon="ph:calculator" class="text-primary" />
          Ozon 产品售价计算器
        </h2>
        <p class="text-sm text-gray-400 mt-1">根据进货价、重量、佣金率自动计算建议售价（卢布为主）</p>
      </div>
      <div class="flex gap-3">
        <NTag v-if="exchangeRates" type="info" size="small" round>1 USD = {{ fmt(exchangeRates.usdToRub) }} RUB</NTag>
        <NTag v-if="exchangeRates" type="success" size="small" round>
          1 USD = {{ fmt(exchangeRates.usdToCny) }} CNY
        </NTag>
        <NTag v-if="exchangeRates" type="warning" size="small" round>
          1 CNY = {{ fmt(exchangeRates.cnyToRub) }} RUB
        </NTag>
      </div>
    </div>

    <!-- 输入区 -->
    <NCard :bordered="false" class="rounded-xl shadow-sm mb-6" size="small">
      <NForm
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-placement="left"
        label-width="120"
        size="medium"
        :show-feedback="true"
      >
        <NGrid :cols="2" :x-gap="24" :y-gap="8">
          <NGridItem>
            <NFormItem label="店铺类型" path="shopType">
              <NRadioGroup v-model:value="formData.shopType">
                <NSpace>
                  <NRadio value="CNY">人民币店铺</NRadio>
                  <NRadio value="USD">美金店铺</NRadio>
                </NSpace>
              </NRadioGroup>
            </NFormItem>
          </NGridItem>
          <NGridItem>
            <NFormItem label="进货价 (¥)" path="purchasePrice">
              <NInputNumber
                v-model:value="formData.purchasePrice"
                placeholder="1688 采购价 + 运费"
                clearable
                :min="0"
                :precision="2"
                style="width: 100%"
              />
            </NFormItem>
          </NGridItem>
          <NGridItem>
            <NFormItem label="产品重量" path="weightInput">
              <NInputGroup>
                <NInputNumber
                  v-model:value="formData.weightInput"
                  placeholder="产品净重"
                  clearable
                  :min="0"
                  :precision="formData.weightUnit === 'kg' ? 3 : 1"
                  style="width: 100%"
                />
                <NSelect
                  v-model:value="formData.weightUnit"
                  :options="[
                    { label: '克 (g)', value: 'g' },
                    { label: '千克 (kg)', value: 'kg' }
                  ]"
                  style="width: 110px"
                  @update:value="handleWeightUnitChange"
                />
              </NInputGroup>
            </NFormItem>
          </NGridItem>
          <NGridItem>
            <NFormItem label="佣金模式" path="commissionMode">
              <NRadioGroup v-model:value="formData.commissionMode" @update:value="handleModeChange">
                <NSpace>
                  <NRadio value="manual">手动输入</NRadio>
                  <NRadio value="category">类目选择</NRadio>
                </NSpace>
              </NRadioGroup>
            </NFormItem>
          </NGridItem>
          <NGridItem v-if="formData.commissionMode === 'manual'">
            <NFormItem label="平台佣金率 (%)" path="commissionRate">
              <NInputNumber
                v-model:value="formData.commissionRate"
                placeholder="原始佣金率，如 12"
                clearable
                :min="0"
                :max="100"
                :precision="1"
                style="width: 100%"
              >
                <template #suffix>%</template>
              </NInputNumber>
            </NFormItem>
          </NGridItem>
          <NGridItem v-else>
            <NFormItem label="选择类目" path="categoryId">
              <NSelect
                v-model:value="formData.categoryId"
                :options="
                  commissionCategories.map(c => ({
                    label: `${c.categoryL1Cn} > ${c.categoryL2Cn} > ${c.categoryL3Cn}`,
                    value: c.categoryId
                  }))
                "
                placeholder="请选择类目"
                filterable
                clearable
              />
            </NFormItem>
          </NGridItem>
          <!-- 显示所选类目的费率阶梯 -->
          <NGridItem v-if="formData.commissionMode === 'category' && selectedCategory" :span="2">
            <div class="flex gap-3 text-sm text-gray-600">
              <span>0-1500₽: {{ (selectedCategory.rfbsRate01500 * 100).toFixed(1) }}%</span>
              <span>1500-5000₽: {{ (selectedCategory.rfbsRate15005000 * 100).toFixed(1) }}%</span>
              <span>>5000₽: {{ (selectedCategory.rfbsRate5000Plus * 100).toFixed(1) }}%</span>
            </div>
          </NGridItem>
        </NGrid>

        <div class="flex justify-end gap-3 mt-2">
          <NButton type="primary" size="large" :loading="loading" @click="handleCalculate">
            <template #icon>
              <SvgIcon icon="ph:equals" />
            </template>
            计算售价
          </NButton>
          <NButton size="large" @click="handleReset">
            <template #icon>
              <SvgIcon icon="ph:arrow-counter-clockwise" />
            </template>
            重置
          </NButton>
        </div>
      </NForm>
    </NCard>

    <!-- 结果展示 -->
    <NCard v-if="resultDetail" :bordered="false" class="rounded-xl shadow-sm" size="small">
      <template #header>
        <div class="flex items-center gap-2">
          <SvgIcon icon="ph:chart-line-up" class="text-primary text-xl" />
          <span class="text-lg font-semibold">计算结果明细</span>
        </div>
      </template>

      <!-- 主结果：卢布售价 -->
      <div
        class="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 flex items-center justify-between"
      >
        <div>
          <div class="text-sm text-gray-500 mb-1">建议售价（卢布）</div>
          <div class="text-4xl font-extrabold text-blue-600">₽ {{ fmt(resultDetail.finalPriceRub) }}</div>
          <div class="text-xs text-gray-400 mt-2">
            {{ resultDetail.currency === 'USD' ? '美元店铺换算' : '人民币店铺换算' }}
          </div>
        </div>
        <div class="text-right">
          <div class="text-lg font-semibold text-gray-700">
            {{ resultDetail.currency === 'USD' ? '$' : '¥' }} {{ fmt(resultDetail.finalPrice) }}
          </div>
          <div class="text-xs text-gray-400">原始币种售价</div>
        </div>
      </div>

      <!-- 步骤卡片 -->
      <NGrid :cols="3" :x-gap="16" :y-gap="16">
        <NGridItem>
          <div class="step-card bg-blue-50 p-4 rounded-lg border border-blue-100">
            <div class="text-sm text-gray-500 mb-1">① 产品进货价</div>
            <div class="text-xl font-bold text-gray-800">¥ {{ fmt(resultDetail.purchasePrice) }}</div>
            <div class="text-xs text-gray-400 mt-1">包含 1688 售价及运费</div>
          </div>
        </NGridItem>
        <NGridItem>
          <div class="step-card bg-green-50 p-4 rounded-lg border border-green-100">
            <div class="text-sm text-gray-500 mb-1">② 产品毛利</div>
            <div class="text-xl font-bold text-green-600">¥ {{ fmt(resultDetail.grossProfit) }}</div>
            <div class="text-xs text-gray-400 mt-1">按进货价阶梯比例计算</div>
          </div>
        </NGridItem>
        <NGridItem>
          <div class="step-card bg-orange-50 p-4 rounded-lg border border-orange-100">
            <div class="text-sm text-gray-500 mb-1">③ 物流成本</div>
            <div class="text-xl font-bold text-orange-600">¥ {{ fmt(resultDetail.logisticsCost) }}</div>
            <div class="text-xs text-gray-400 mt-1">
              挂号费 ¥{{ fmt(resultDetail.registrationFee) }} + 入仓费 ¥{{
                fmt(resultDetail.logisticsCost - resultDetail.registrationFee)
              }}
            </div>
          </div>
        </NGridItem>
        <NGridItem>
          <div class="step-card bg-purple-50 p-4 rounded-lg border border-purple-100">
            <div class="text-sm text-gray-500 mb-1">④ 平台佣金</div>
            <div class="text-xl font-bold text-purple-600">¥ {{ fmt(resultDetail.commissionAmount) }}</div>
            <div class="text-xs text-gray-400 mt-1">
              原始佣金率 {{ (resultDetail.baseCommissionRate * 100).toFixed(1) }}% + 4% 回款抽点 = 总比例
              {{ (resultDetail.commissionRate * 100).toFixed(1) }}%
            </div>
          </div>
        </NGridItem>
        <NGridItem :span="2">
          <div
            class="step-card bg-white p-4 rounded-lg border-2 border-primary shadow-inner flex items-center justify-between"
          >
            <div>
              <div class="text-sm text-gray-500 mb-1">⑤ 建议售价（{{ resultDetail.currency }}）</div>
              <div class="text-3xl font-extrabold text-primary">
                {{ resultDetail.currency === 'USD' ? '$' : '¥' }} {{ fmt(resultDetail.finalPrice) }}
              </div>
              <div class="text-xs text-gray-400 mt-1">
                {{ resultDetail.currency === 'USD' ? '美元店铺最终售价' : '人民币店铺最终售价' }}
              </div>
            </div>
            <div class="text-5xl opacity-20">
              <SvgIcon icon="ph:check-circle" class="text-primary" />
            </div>
          </div>
        </NGridItem>
      </NGrid>

      <!-- 汇率信息（从计算结果中获取） -->
      <div v-if="resultDetail.usdToRub" class="mt-4 text-sm text-gray-500 flex gap-4">
        <span>1 USD = {{ fmt(resultDetail.usdToRub) }} RUB</span>
        <span>1 USD = {{ fmt(resultDetail.usdToCny) }} CNY</span>
        <span>1 CNY = {{ fmt(resultDetail.cnyToRub) }} RUB</span>
      </div>
    </NCard>

    <!-- 空状态 -->
    <NCard v-else :bordered="false" class="rounded-xl shadow-sm" size="small">
      <div class="flex flex-col items-center py-16">
        <SvgIcon icon="ph:calculator" class="text-6xl text-gray-200 mb-4" />
        <p class="text-gray-400 text-base">填写参数后点击“计算售价”查看结果</p>
        <p class="text-gray-300 text-sm mt-1">系统将自动套用阶梯毛利和物流模板</p>
      </div>
    </NCard>
    <NCard :bordered="false" class="rounded-xl shadow-sm mt-6" size="small">
      <template #header>
        <div class="flex items-center gap-2">
          <SvgIcon icon="ph:sliders" class="text-primary text-xl" />
          <span class="text-lg font-semibold">毛利率配置</span>
        </div>
      </template>
      <div v-if="grossProfitConfig" class="flex flex-wrap gap-4 items-end">
        <NFormItem label="0 - 30 元">
          <NInputNumber
            v-model:value="grossProfitConfig.ratio0To30"
            :min="0"
            :max="1"
            :step="0.01"
            :precision="2"
            style="width: 120px"
          />
        </NFormItem>
        <NFormItem label="30 - 60 元">
          <NInputNumber
            v-model:value="grossProfitConfig.ratio30To60"
            :min="0"
            :max="1"
            :step="0.01"
            :precision="2"
            style="width: 120px"
          />
        </NFormItem>
        <NFormItem label="60 - 100 元">
          <NInputNumber
            v-model:value="grossProfitConfig.ratio60To100"
            :min="0"
            :max="1"
            :step="0.01"
            :precision="2"
            style="width: 120px"
          />
        </NFormItem>
        <NFormItem label="100 - 200 元">
          <NInputNumber
            v-model:value="grossProfitConfig.ratio100To200"
            :min="0"
            :max="1"
            :step="0.01"
            :precision="2"
            style="width: 120px"
          />
        </NFormItem>
        <NFormItem label="200 元以上">
          <NInputNumber
            v-model:value="grossProfitConfig.ratio200Plus"
            :min="0"
            :max="1"
            :step="0.01"
            :precision="2"
            style="width: 120px"
          />
        </NFormItem>
        <NButton type="primary" :loading="configSaving" @click="saveGrossProfitConfig">
          <template #icon>
            <SvgIcon icon="ph:floppy-disk" />
          </template>
          保存配置
        </NButton>
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.step-card {
  transition: all 0.25s ease;
}

.step-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}
</style>
