<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import {
  NAlert,
  NButton,
  NDivider,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NSpace,
  useMessage
} from 'naive-ui';
import { fetchAddCommissionRate, fetchUpdateCommissionRate } from '@/service/api/ozon-auto-listing';

interface Props {
  visible: boolean;
  /** null 表示新增；否则为编辑（含 id） */
  row: Api.AutoListing.CommissionRate | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void;
  (e: 'saved'): void;
}>();

const message = useMessage();
const submitting = ref(false);

const isEdit = computed(() => props.row != null && props.row.id != null);

function emptyForm(): Api.AutoListing.CommissionRate {
  return {
    id: undefined,
    categoryId: null,
    categoryL1Ru: '',
    categoryL1Cn: '',
    categoryL2Ru: '',
    categoryL2Cn: '',
    categoryL3Ru: '',
    categoryL3Cn: '',
    brand: 'All',
    rfbsRate01500: 0.15,
    rfbsRate15005000: 0.12,
    rfbsRate5000Plus: 0.1,
    fbpRate01500: null,
    fbpRate15005000: null,
    fbpRate5000Plus: null
  };
}

const form = reactive<Api.AutoListing.CommissionRate>(emptyForm());

watch(
  () => props.visible,
  v => {
    if (!v) return;
    if (props.row) {
      // 编辑：拷贝（避免直接修改父组件传引用）
      Object.assign(form, emptyForm(), props.row);
    } else {
      Object.assign(form, emptyForm());
    }
  }
);

async function handleSubmit() {
  // 校验
  if (!form.categoryId) {
    message.warning('请填写 category_id');
    return;
  }
  if (!form.categoryL3Ru || !form.categoryL3Ru.trim()) {
    message.warning('请填写三级类目俄文名');
    return;
  }
  if (form.rfbsRate01500 == null) {
    message.warning('请填写 RFBS ≤1500₽ 的费率');
    return;
  }

  submitting.value = true;
  try {
    if (isEdit.value) {
      const { error } = await fetchUpdateCommissionRate(form.id!, form);
      if (error) return;
      message.success('已保存');
    } else {
      const { error } = await fetchAddCommissionRate(form);
      if (error) return;
      message.success('已新增');
    }
    emit('update:visible', false);
    emit('saved');
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
    :title="isEdit ? '编辑佣金费率' : '新增佣金费率'"
    class="w-90vw max-w-900px"
    :mask-closable="false"
    @update:show="handleClose"
  >
    <NAlert v-if="isEdit" type="info" :bordered="false" class="mb-16px">
      编辑 ID
      <b>{{ form.id }}</b>
      ，categoryId
      <b>{{ form.categoryId }}</b>
      不可修改
    </NAlert>

    <NForm label-placement="left" label-width="160">
      <!-- ===== 基础信息 ===== -->
      <NDivider title-placement="left" class="!my-8px">基础信息</NDivider>

      <NFormItem label="category_id" required>
        <NInputNumber
          v-model:value="form.categoryId"
          placeholder="Ozon 三级类目ID"
          :show-button="false"
          :min="1"
          :disabled="isEdit"
          class="w-full"
        />
      </NFormItem>

      <NFormItem label="品牌">
        <NInput v-model:value="form.brand" placeholder="默认 All" class="w-full" />
      </NFormItem>

      <!-- ===== 类目名称 ===== -->
      <NDivider title-placement="left" class="!my-8px">类目名称</NDivider>

      <div class="grid grid-cols-2 gap-12px">
        <NFormItem label="一级类目（俄）">
          <NInput v-model:value="form.categoryL1Ru" placeholder="可选" />
        </NFormItem>
        <NFormItem label="一级类目（中）">
          <NInput v-model:value="form.categoryL1Cn" placeholder="可选" />
        </NFormItem>
        <NFormItem label="二级类目（俄）">
          <NInput v-model:value="form.categoryL2Ru" placeholder="可选" />
        </NFormItem>
        <NFormItem label="二级类目（中）">
          <NInput v-model:value="form.categoryL2Cn" placeholder="可选" />
        </NFormItem>
        <NFormItem label="三级类目（俄）" required>
          <NInput v-model:value="form.categoryL3Ru" placeholder="必填" />
        </NFormItem>
        <NFormItem label="三级类目（中）">
          <NInput v-model:value="form.categoryL3Cn" placeholder="可选" />
        </NFormItem>
      </div>

      <!-- ===== RFBS 费率 ===== -->
      <NDivider title-placement="left" class="!my-8px">RFBS 费率（小数，如 0.15 = 15%）</NDivider>

      <div class="grid grid-cols-3 gap-12px">
        <NFormItem label="≤1500₽" label-placement="top" required>
          <NInputNumber
            v-model:value="form.rfbsRate01500"
            :step="0.01"
            :min="0"
            :max="1"
            :precision="4"
            placeholder="0.15"
            class="w-full"
          />
        </NFormItem>
        <NFormItem label="1500.01 ~ 5000₽" label-placement="top" required>
          <NInputNumber
            v-model:value="form.rfbsRate15005000"
            :step="0.01"
            :min="0"
            :max="1"
            :precision="4"
            placeholder="0.12"
            class="w-full"
          />
        </NFormItem>
        <NFormItem label=">5000₽" label-placement="top" required>
          <NInputNumber
            v-model:value="form.rfbsRate5000Plus"
            :step="0.01"
            :min="0"
            :max="1"
            :precision="4"
            placeholder="0.10"
            class="w-full"
          />
        </NFormItem>
      </div>

      <!-- ===== FBP 费率 ===== -->
      <NDivider title-placement="left" class="!my-8px">FBP 费率（可选）</NDivider>

      <div class="grid grid-cols-3 gap-12px">
        <NFormItem label="≤1500₽" label-placement="top">
          <NInputNumber
            v-model:value="form.fbpRate01500"
            :step="0.01"
            :min="0"
            :max="1"
            :precision="4"
            class="w-full"
          />
        </NFormItem>
        <NFormItem label="1500.01 ~ 5000₽" label-placement="top">
          <NInputNumber
            v-model:value="form.fbpRate15005000"
            :step="0.01"
            :min="0"
            :max="1"
            :precision="4"
            class="w-full"
          />
        </NFormItem>
        <NFormItem label=">5000₽" label-placement="top">
          <NInputNumber
            v-model:value="form.fbpRate5000Plus"
            :step="0.01"
            :min="0"
            :max="1"
            :precision="4"
            class="w-full"
          />
        </NFormItem>
      </div>
    </NForm>

    <template #footer>
      <NSpace justify="end">
        <NButton @click="handleClose">取消</NButton>
        <NButton type="primary" :loading="submitting" @click="handleSubmit">保存</NButton>
      </NSpace>
    </template>
  </NModal>
</template>
