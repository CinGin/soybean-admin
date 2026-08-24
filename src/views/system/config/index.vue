<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import { useMessage, useDialog, NTag, NInput, NButton, type DataTableColumns } from 'naive-ui';
import {
  getSystemConfigs,
  updateSystemConfigs,
  addDynamicParam,
  deleteDynamicParam
} from '@/service/api/system-config';
import type { SystemConfig } from '@/typings/api/system-config';

const message = useMessage();
const dialog = useDialog(); // ✅ 新增：使用 Naive UI 的对话框

const configList = ref<SystemConfig[]>([]);
const loading = ref(false);
const saving = ref(false);
const newParam = ref({ key: '', value: '' });

// ✅ 修改：操作列现在为所有可编辑行显示"保存"和"删除"按钮
const columns: DataTableColumns<SystemConfig> = [
  {
    title: '参数名',
    key: 'paramKey',
    width: 270,
    ellipsis: { tooltip: true },
    render(row) {
      return h('div', { class: 'flex items-center gap-2' }, [
        h('span', { class: 'font-mono text-sm' }, row.paramKey),
        h(
          NTag,
          {
            type: row.required ? 'error' : 'info',
            size: 'small',
            round: true
          },
          { default: () => (row.required ? '必填' : '动态') }
        )
      ]);
    }
  },
  {
    title: '参数值',
    key: 'paramValue',
    width: 260,
    render(row, index) {
      return h(NInput, {
        value: configList.value[index]?.paramValue ?? '',
        disabled: !row.editable,
        size: 'small',
        placeholder: '请输入参数值',
        'onUpdate:value': (val: string) => {
          configList.value[index].paramValue = val;
        }
      });
    }
  },
  {
    title: '参数说明',
    key: 'description',
    render(row) {
      return h('div', { class: 'description-cell' }, row.description || '-');
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 160, // ✅ 加宽以容纳两个按钮
    align: 'center',
    render(row, index) {
      // ✅ 修复：不可编辑的行不显示任何按钮
      if (!row.editable) return null;

      return h('div', { class: 'flex items-center justify-center gap-2' }, [
        // ✅ 新增：单项保存按钮
        h(
          NButton,
          {
            text: true,
            type: 'primary',
            size: 'small',
            onClick: () => handleSingleSave(row, index)
          },
          { default: () => '保存' }
        ),
        // 仅非必填项显示删除按钮
        !row.required
          ? h(
              NButton,
              {
                text: true,
                type: 'error',
                size: 'small',
                onClick: () => handleDelete(row.paramKey)
              },
              { default: () => '删除' }
            )
          : null
      ]);
    }
  }
];

// ----- 数据加载 -----
async function fetchData() {
  loading.value = true;
  try {
    const data = await getSystemConfigs();
    configList.value = Array.isArray(data) ? data : [];
  } catch (error) {
    message.error('获取配置失败');
    console.error('[SystemConfig] fetchData error:', error);
    configList.value = [];
  } finally {
    loading.value = false;
  }
}

function handleRefresh() {
  fetchData();
}

// ✅ 新增：单项保存（带确认弹窗）
function handleSingleSave(row: SystemConfig, index: number) {
  const currentValue = configList.value[index]?.paramValue ?? '';

  dialog.warning({
    title: '确认修改',
    content: `确定要将参数 "${row.paramKey}" 的值修改为 "${currentValue}" 吗？`,
    positiveText: '确认修改',
    negativeText: '取消',
    maskClosable: false,
    onPositiveClick: async () => {
      try {
        // 单项保存：构造只包含当前行的数组调用批量更新接口
        await updateSystemConfigs([configList.value[index]]);
        message.success(`参数 "${row.paramKey}" 修改成功`);
      } catch (error) {
        console.error('[SystemConfig] singleSave error:', error);
        message.error('修改失败');
      }
    }
  });
}

// ✅ 修改：批量保存（带确认弹窗）
function handleSave() {
  dialog.warning({
    title: '确认批量保存',
    content: `确定要保存全部 ${configList.value.length} 条配置吗？此操作将覆盖所有已修改的参数值。`,
    positiveText: '确认保存',
    negativeText: '取消',
    maskClosable: false,
    onPositiveClick: async () => {
      saving.value = true;
      try {
        await updateSystemConfigs(configList.value);
        message.success('全部配置保存成功');
      } catch (error) {
        console.error('[SystemConfig] batchSave error:', error);
        message.error('保存失败');
      } finally {
        saving.value = false;
      }
    }
  });
}

// ✅ 修改：删除（使用 dialog 替代 window.confirm）
function handleDelete(key: string) {
  dialog.error({
    title: '确认删除',
    content: `确定要删除参数 "${key}" 吗？此操作不可恢复。`,
    positiveText: '确认删除',
    negativeText: '取消',
    maskClosable: false,
    onPositiveClick: async () => {
      try {
        await deleteDynamicParam(key);
        message.success('参数删除成功');
        await fetchData();
      } catch (error) {
        console.error('[SystemConfig] deleteParam error:', error);
        message.error('删除参数失败');
      }
    }
  });
}

// ----- 添加动态参数 -----
async function handleAddParam() {
  const key = newParam.value.key.trim();
  if (!key) {
    message.warning('参数名不能为空');
    return;
  }
  try {
    await addDynamicParam(key, newParam.value.value);
    message.success('参数添加成功');
    newParam.value = { key: '', value: '' };
    await fetchData();
  } catch (error) {
    console.error('[SystemConfig] addParam error:', error);
    message.error('添加参数失败');
  }
}

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div class="p-6 bg-gray-50 min-h-screen">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-800 mb-1">Redis 配置管理</h2>
        <p class="text-gray-500 text-sm">管理 Ozon 爬虫系统 Redis 配置参数</p>
      </div>
      <NButton type="primary" :loading="loading" @click="handleRefresh">
        <template #icon>
          <SvgIcon icon="ph:arrows-clockwise" />
        </template>
        刷新
      </NButton>
    </div>

    <NCard :bordered="false" class="shadow-sm rounded-xl" content-class="p-0">
      <NDataTable
        :columns="columns"
        :data="configList"
        :loading="loading"
        :pagination="false"
        :bordered="true"
        :striped="true"
        :single-line="false"
        :row-key="(row: SystemConfig) => row.paramKey"
        size="small"
      />

      <div class="mt-4 p-4 bg-white rounded-lg border border-gray-100">
        <h3 class="text-lg font-semibold mb-3">添加动态参数</h3>
        <NForm inline label-placement="left" label-width="auto" size="medium">
          <NFormItem label="参数名">
            <NInput v-model:value="newParam.key" placeholder="输入参数名" clearable class="w-40" />
          </NFormItem>
          <NFormItem label="参数值">
            <NInput v-model:value="newParam.value" placeholder="输入参数值" clearable class="w-40" />
          </NFormItem>
          <NFormItem>
            <NButton type="primary" @click="handleAddParam">
              <template #icon>
                <SvgIcon icon="ph:plus" />
              </template>
              添加
            </NButton>
          </NFormItem>
        </NForm>
      </div>

      <div class="flex justify-end p-4 border-t border-gray-100">
        <NButton type="primary" :loading="saving" @click="handleSave">
          <template #icon>
            <SvgIcon icon="ph:floppy-disk" />
          </template>
          保存全部配置
        </NButton>
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.n-data-table :deep(.n-data-table-th) {
  background-color: #f9fafb;
}

.n-input:focus-within {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.description-cell {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
  font-size: 13px;
  color: #555;
  padding: 2px 0;
}
</style>
