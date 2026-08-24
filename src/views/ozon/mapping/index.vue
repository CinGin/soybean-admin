<script setup lang="ts">
import { ref, reactive, onMounted, h } from 'vue';
import { useMessage } from 'naive-ui';
import { fetchCategoryMappings } from '@/service/api/ozon-mapping';
import type { Api } from '@/typings/api/ozon-mapping';

const message = useMessage();

// ===== 查询参数 =====
const queryParams = reactive<Api.OzonMapping.QueryParams>({
  page: 1,
  size: 20,
  keyword: '',
  rank: undefined,
  matchType: undefined,
  sortField: 'rank',
  sortDir: 'asc'
});

// ===== 数据状态 =====
const loading = ref(false);
const isFetching = ref(false); // 防重复点击
const tableData = ref<Api.OzonMapping.Record[]>([]);
const total = ref(0);

// ===== 排序字段选项 =====
const sortFieldOptions = [
  { label: 'ID', value: 'id' },
  { label: '热搜词（俄语）', value: 'query_text' },
  { label: '中文翻译', value: 'query_text_zh' },
  { label: '类目ID', value: 'category_id' },
  { label: '类目中文名', value: 'category_name_zh' },
  { label: '匹配分数', value: 'score' },
  { label: '匹配类型', value: 'match_type' },
  { label: '排名', value: 'rank' },
  { label: '创建时间', value: 'created_at' },
  { label: '更新时间', value: 'updated_at' }
];

// ===== 列字段映射 =====
const fieldMap: Record<string, string> = {
  id: 'id',
  queryText: 'query_text',
  queryTextZh: 'query_text_zh',
  categoryId: 'category_id',
  categoryNameZh: 'category_name_zh',
  score: 'score',
  matchType: 'match_type',
  rank: 'rank',
  updatedAt: 'updated_at'
};

// ===== 表格列定义 =====
const columns: any[] = [
  { title: '#', key: 'index', width: 55, align: 'center' },
  { title: 'ID', key: 'id', width: 78, align: 'center', sortable: true },
  { title: '热搜词 (俄语)', key: 'queryText', minWidth: 160, ellipsis: { tooltip: true } },
  { title: '中文翻译', key: 'queryTextZh', minWidth: 145, ellipsis: { tooltip: true } },
  {
    title: '类目 ID',
    key: 'categoryId',
    width: 125,
    align: 'center',
    render(row: Api.OzonMapping.Record) {
      return h('span', { style: { color: '#2080f0', fontWeight: 500 } }, row.categoryId);
    }
  },
  {
    title: '类目中文名',
    key: 'categoryNameZh',
    minWidth: 165,
    sortable: true,
    ellipsis: { tooltip: true },
    render(row: Api.OzonMapping.Record) {
      return row.categoryNameZh || h('span', { style: 'color:#aaa' }, '—');
    }
  },
  {
    title: '匹配分数',
    key: 'score',
    width: 185,
    align: 'center',
    sortable: true,
    render(row: Api.OzonMapping.Record) {
      const percent = Math.round(row.score * 100);
      const color = row.score >= 0.9 ? '#18a058' : row.score >= 0.7 ? '#f0a020' : '#d03050';
      return h('div', { style: 'display:flex;align-items:center;gap:6px;justify-content:center' }, [
        h('n-progress', {
          type: 'line',
          percentage: percent,
          height: 8,
          railColor: '#ececec',
          color,
          indicatorPlacement: 'inside',
          style: 'flex:1;max-width:100px'
        }),
        h('span', { style: `font-size:12px;min-width:38px;color:${color};font-weight:600` }, row.score.toFixed(2))
      ]);
    }
  },
  {
    title: '匹配类型',
    key: 'matchType',
    width: 120,
    align: 'center',
    sortable: true,
    render(row: Api.OzonMapping.Record) {
      const isRule = row.matchType === 'rule';
      return h(
        'n-tag',
        {
          type: isRule ? 'success' : 'info',
          size: 'small',
          round: true,
          bordered: false
        },
        {
          default: () => (isRule ? '🔧 规则' : '🧠 向量'),
          icon: () => h('span', { style: 'margin-right:2px' }, isRule ? '⚙️' : '📐')
        }
      );
    }
  },
  {
    title: '排名等级',
    key: 'rank',
    width: 110,
    align: 'center',
    sortable: true,
    render(row: Api.OzonMapping.Record) {
      const colors = ['#f5222d', '#fa8c16', '#fadb14', '#52c41a', '#1890ff'];
      const labels = ['1级', '2级', '3级', '4级', '5级'];
      return h(
        'n-tag',
        {
          color: { text: '#fff', border: colors[row.rank - 1], color: colors[row.rank - 1] },
          size: 'small',
          round: true
        },
        { default: () => labels[row.rank - 1] }
      );
    }
  },
  {
    title: '更新时间',
    key: 'updatedAt',
    width: 190,
    align: 'center',
    sortable: true,
    render(row: Api.OzonMapping.Record) {
      return row.updatedAt.replace('T', ' ').slice(0, 16);
    }
  }
];

// ===== 获取数据 =====
async function fetchData() {
  loading.value = true;
  try {
    const res = await fetchCategoryMappings(queryParams);
    if (res) {
      tableData.value = res.records || [];
      total.value = res.total || 0;
    }
  } catch (error) {
    message.error('数据加载失败');
    console.error(error);
  } finally {
    loading.value = false;
  }
}

// ===== 搜索（带锁定） =====
async function handleSearch() {
  if (isFetching.value) return;
  queryParams.page = 1;
  isFetching.value = true;
  try {
    await fetchData();
  } finally {
    isFetching.value = false;
  }
}

// ===== 重置（带锁定） =====
async function handleReset() {
  if (isFetching.value) return;
  queryParams.keyword = '';
  queryParams.rank = undefined;
  queryParams.matchType = undefined;
  queryParams.sortField = 'rank';
  queryParams.sortDir = 'asc';
  queryParams.page = 1;
  isFetching.value = true;
  try {
    await fetchData();
  } finally {
    isFetching.value = false;
  }
}

function handlePageChange(page: number) {
  if (isFetching.value) return;
  queryParams.page = page;
  fetchData();
}

function handlePageSizeChange(size: number) {
  if (isFetching.value) return;
  queryParams.size = size;
  queryParams.page = 1;
  fetchData();
}

function handleSortChange(options: { columnKey: string; order: 'ascend' | 'descend' | null }) {
  if (isFetching.value) return;
  if (!options.columnKey || !options.order) {
    queryParams.sortField = 'rank';
    queryParams.sortDir = 'asc';
  } else {
    const mapped = fieldMap[options.columnKey];
    if (mapped) {
      queryParams.sortField = mapped;
      queryParams.sortDir = options.order === 'ascend' ? 'asc' : 'desc';
    }
  }
  queryParams.page = 1;
  fetchData();
}

onMounted(() => fetchData());
</script>

<template>
  <div class="p-6 bg-gray-50 min-h-screen">
    <!-- 页面标题 -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-800 m-0 flex items-center gap-2">
          <SvgIcon icon="ph:git-fork" class="text-primary" />
          Ozon 热搜词与类目映射
        </h2>
        <p class="text-sm text-gray-400 mt-1">管理热搜词与 Ozon 类目的匹配关系，支持规则和向量两种匹配方式</p>
      </div>
      <NTag type="info" size="large" round bordered>共 {{ total }} 条</NTag>
    </div>

    <!-- 搜索区域 -->
    <NCard :bordered="false" class="rounded-xl shadow-sm mb-6" size="small">
      <NForm inline label-placement="left" label-width="auto" size="medium" :show-feedback="false">
        <NGrid :cols="6" :x-gap="12" :y-gap="8">
          <NGridItem>
            <NFormItem label="关键词">
              <NInput
                v-model:value="queryParams.keyword"
                placeholder="搜索俄语/中文/类目名"
                clearable
                @keydown.enter="handleSearch"
              >
                <template #prefix>
                  <SvgIcon icon="ph:magnifying-glass" class="text-gray-400" />
                </template>
              </NInput>
            </NFormItem>
          </NGridItem>
          <NGridItem>
            <NFormItem label="排名等级">
              <NSelect
                v-model:value="queryParams.rank"
                :options="[1, 2, 3, 4, 5].map(r => ({ label: `${r} 级`, value: r }))"
                placeholder="全部"
                clearable
              />
            </NFormItem>
          </NGridItem>
          <NGridItem>
            <NFormItem label="匹配类型">
              <NSelect
                v-model:value="queryParams.matchType"
                :options="[
                  { label: '规则匹配', value: 'rule' },
                  { label: '向量匹配', value: 'vector' }
                ]"
                placeholder="全部"
                clearable
              />
            </NFormItem>
          </NGridItem>
          <NGridItem>
            <NFormItem label="排序字段">
              <NSelect v-model:value="queryParams.sortField" :options="sortFieldOptions" />
            </NFormItem>
          </NGridItem>
          <NGridItem>
            <NFormItem label="排序方向">
              <NSelect
                v-model:value="queryParams.sortDir"
                :options="[
                  { label: '⬆ 升序', value: 'asc' },
                  { label: '⬇ 降序', value: 'desc' }
                ]"
              />
            </NFormItem>
          </NGridItem>
          <NGridItem>
            <NFormItem label=" ">
              <NSpace>
                <NButton type="primary" :loading="loading" :disabled="isFetching" @click="handleSearch">
                  <template #icon>
                    <SvgIcon icon="ph:magnifying-glass" />
                  </template>
                  查询
                </NButton>
                <NButton :disabled="isFetching" @click="handleReset">
                  <template #icon>
                    <SvgIcon icon="ph:arrow-counter-clockwise" />
                  </template>
                  重置
                </NButton>
              </NSpace>
            </NFormItem>
          </NGridItem>
        </NGrid>
      </NForm>
    </NCard>

    <!-- 数据表格 -->
    <NCard :bordered="false" class="rounded-xl shadow-sm" content-class="p-0">
      <NDataTable
        :columns="columns"
        :data="tableData"
        :loading="loading"
        :pagination="false"
        :bordered="true"
        :striped="true"
        :single-line="false"
        :row-key="(row: Api.OzonMapping.Record) => row.id"
        :remote="true"
        size="small"
        class="transition-all"
        @update:sorter="handleSortChange"
      >
        <!-- 空状态插槽 -->
        <template #empty>
          <div class="flex flex-col items-center py-16">
            <SvgIcon icon="ph:folder-open" class="text-5xl text-gray-300 mb-4" />
            <p class="text-gray-400 text-base">暂无匹配数据</p>
            <p class="text-gray-300 text-sm mt-1">请调整搜索条件或等待数据生成</p>
          </div>
        </template>
      </NDataTable>
      <!-- 分页 -->
      <div class="flex justify-end items-center p-4 border-t border-gray-100">
        <NPagination
          v-model:page="queryParams.page"
          v-model:page-size="queryParams.size"
          :item-count="total"
          :page-sizes="[10, 20, 50, 100]"
          show-size-picker
          show-quick-jumper
          @update:page="handlePageChange"
          @update:page-size="handlePageSizeChange"
        />
      </div>
    </NCard>
  </div>
</template>

<style scoped>
/* 全局背景和过渡 */
.p-6 {
  transition: background-color 0.3s;
}

/* 卡片悬停效果 */
.n-card.shadow-sm:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

/* 表格行动画 */
.n-data-table .n-data-table-tr {
  transition: background-color 0.2s;
}

/* 进度条宽度 */
.n-data-table td .n-progress {
  width: 102px;
}

/* 响应式：小屏幕时网格变为2列 */
@media (max-width: 640px) {
  .n-grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }
}
</style>
