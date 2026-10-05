<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { NSelect, NInput, NInputNumber, NSwitch, NDynamicTags, NFormItem } from 'naive-ui';
import { fetchAttributeValues, searchAttributeValues } from '@/service/api/ozon-listing-record';
import type { AttributeGroupVO, AttributeFieldVO } from '@/typings/api/ozon-listing-record';

const props = defineProps<{
  modelValue: AttributeGroupVO[];
  clientId: string;
  descriptionCategoryId: number;
  typeId: number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: AttributeGroupVO[]): void;
}>();

const dictOptionsCache = ref<Record<string, Array<{ label: string; value: number }>>>({});

async function loadDictionaryOptions(field: AttributeFieldVO, search?: string) {
  if (!field.dictionaryId || field.dictionaryId === 0) return [];
  const cacheKey = `${field.attrId}-${search || ''}`;
  if (dictOptionsCache.value[cacheKey]) return dictOptionsCache.value[cacheKey];

  let options: Array<{ label: string; value: number }> = [];
  try {
    if (search) {
      const res = await searchAttributeValues({
        attributeId: field.attrId,
        descriptionCategoryId: props.descriptionCategoryId,
        typeId: props.typeId,
        language: 'ZH_HANS',
        value: search,
        limit: 20,
        clientId: props.clientId
      });
      options = (res.data?.result || []).map(item => ({ label: item.value, value: item.id }));
    } else {
      const res = await fetchAttributeValues({
        attributeId: field.attrId,
        descriptionCategoryId: props.descriptionCategoryId,
        typeId: props.typeId,
        language: 'ZH_HANS',
        lastValueId: 0,
        limit: 50,
        clientId: props.clientId
      });
      options = (res.data?.result || []).map(item => ({ label: item.value, value: item.id }));
    }
    dictOptionsCache.value[cacheKey] = options;
    return options;
  } catch (e) {
    console.error('加载字典选项失败', e);
    return [];
  }
}

function updateFieldValues(field: AttributeFieldVO, newValues: Array<{ dictionaryValueId: number; value: string }>) {
  field.values = newValues;
  emit('update:modelValue', [...props.modelValue]);
}

function handleSingleSelect(field: AttributeFieldVO, val: number | null) {
  if (val === null) {
    updateFieldValues(field, []);
  } else {
    const option = dictOptionsCache.value[field.attrId]?.find(o => o.value === val);
    updateFieldValues(field, [{ dictionaryValueId: val, value: option?.label || '' }]);
  }
}

function handleMultiSelect(field: AttributeFieldVO, vals: number[]) {
  const selected = (dictOptionsCache.value[field.attrId] || []).filter(o => vals.includes(o.value));
  updateFieldValues(
    field,
    selected.map(o => ({ dictionaryValueId: o.value, value: o.label }))
  );
}

// 预加载所有字典选项
onMounted(async () => {
  for (const group of props.modelValue) {
    for (const field of group.fields) {
      if (field.control === 'dict_select' || field.control === 'dict_multi') {
        await loadDictionaryOptions(field);
      }
    }
  }
});
</script>

<template>
  <div class="attribute-form">
    <div v-for="(group, gi) in modelValue" :key="gi" class="attribute-group mb-4">
      <h4 class="text-sm font-semibold mb-2">{{ group.groupName }}</h4>
      <div v-for="field in group.fields" :key="field.attrId" class="attribute-field mb-2">
        <NFormItem :label="field.name + (field.required ? ' *' : '')">
          <!-- 字典单选 -->
          <NSelect
            v-if="field.control === 'dict_select'"
            :value="field.values[0]?.dictionaryValueId ?? null"
            :options="dictOptionsCache[field.attrId] || []"
            filterable
            remote
            clearable
            @update:value="(val: number | null) => handleSingleSelect(field, val)"
            @search="(q: string) => loadDictionaryOptions(field, q)"
          />
          <!-- 字典多选 -->
          <NSelect
            v-else-if="field.control === 'dict_multi'"
            :value="field.values.map(v => v.dictionaryValueId)"
            multiple
            :options="dictOptionsCache[field.attrId] || []"
            filterable
            remote
            @update:value="(vals: number[]) => handleMultiSelect(field, vals)"
            @search="(q: string) => loadDictionaryOptions(field, q)"
          />
          <!-- 文本输入 -->
          <NInput
            v-else-if="field.control === 'text' || field.control === 'textarea'"
            :value="field.values[0]?.value || ''"
            :type="field.control === 'textarea' ? 'textarea' : 'text'"
            :placeholder="field.description"
            @update:value="(val: string) => updateFieldValues(field, [{ dictionaryValueId: 0, value: val }])"
          />
          <!-- 数字输入 -->
          <NInputNumber
            v-else-if="field.control === 'number'"
            :value="Number(field.values[0]?.value || 0)"
            @update:value="
              (val: number | null) => updateFieldValues(field, [{ dictionaryValueId: 0, value: String(val ?? 0) }])
            "
          />
          <!-- 布尔 -->
          <NSwitch
            v-else-if="field.control === 'boolean'"
            :value="field.values[0]?.value === 'true'"
            @update:value="(val: boolean) => updateFieldValues(field, [{ dictionaryValueId: 0, value: String(val) }])"
          />
          <!-- 多值文本 -->
          <NDynamicTags
            v-else-if="field.control === 'text_multi'"
            :value="field.values.map(v => v.value)"
            @update:value="
              (vals: string[]) =>
                updateFieldValues(
                  field,
                  vals.map((v: string) => ({ dictionaryValueId: 0, value: v }))
                )
            "
          />
        </NFormItem>
      </div>
    </div>
  </div>
</template>
