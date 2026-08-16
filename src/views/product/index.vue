<script setup lang="ts">
import { ref, reactive, computed, onMounted, h } from 'vue';
import { useLoading } from '@sa/hooks';
import { fetchProductList } from '@/service/api/product';

// 直接使用全局类型 Api.Product.*，无需手动 import
// 确保 src/typings/api/product.d.ts 在 tsconfig.json 的 include 中

const { loading, startLoading, endLoading } = useLoading();

/** 搜索参数 */
const searchParams = reactive<Api.Product.ProductSearchParams>({
  productName: '',
  minPrice: undefined,
  maxPrice: undefined,
  minOrder: '',
  supplierName: '',
  page: 0,
  size: 10,
  sortField: 'id',
  sortDir: 'asc'
});

const tableData = ref<Api.Product.ProductItem[]>([]);
const total = ref(0);

const stats = reactive({
  totalCount: 0,
  supplierCount: 0,
  avgPrice: 0
});

/** 抽屉状态（用 ref 代替不存在的 useBoolean） */
const drawerVisible = ref(false);
const currentProduct = ref<Api.Product.ProductItem | null>(null);

/** 获取列表 */
async function getData(params: Api.Product.ProductSearchParams) {
  startLoading();
  try {
    const resp = await fetchProductList(params);
    const data = resp.data ?? {
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 0
    };
    tableData.value = data.content;
    total.value = data.totalElements;
    stats.totalCount = data.totalElements;
    const suppliers = new Set(data.content.map(item => item.supplierName));
    stats.supplierCount = suppliers.size;
    const prices = data.content
      .filter((item: Api.Product.ProductItem) => item.price != null)
      .map((item: Api.Product.ProductItem) => Number(item.price));
    stats.avgPrice = prices.length > 0 ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length : 0;
  } finally {
    endLoading();
  }
}

function handleSearch() {
  searchParams.page = 0;
  getData({ ...searchParams });
}

function handleReset() {
  searchParams.productName = '';
  searchParams.minPrice = undefined;
  searchParams.maxPrice = undefined;
  searchParams.minOrder = '';
  searchParams.supplierName = '';
  searchParams.page = 0;
  searchParams.size = 10;
  searchParams.sortField = 'id';
  searchParams.sortDir = 'asc';
  getData({ ...searchParams });
}

function handlePageChange(page: number) {
  searchParams.page = page - 1;
  getData({ ...searchParams });
}

function handlePageSizeChange(size: number) {
  searchParams.size = size;
  searchParams.page = 0;
  getData({ ...searchParams });
}

function viewDetail(row: Api.Product.ProductItem) {
  currentProduct.value = row;
  drawerVisible.value = true;
}

function openLink(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

onMounted(() => {
  getData({ ...searchParams });
});

/** 价格标签颜色 */
function priceTagColor(price: number | null | undefined): 'success' | 'warning' | 'error' | 'default' {
  if (price == null) return 'default';
  if (price < 50) return 'success';
  if (price < 200) return 'warning';
  return 'error';
}

/** 表格列定义（不使用 $t，直接中文） */
const columns = computed(() => [
  {
    title: '图片',
    key: 'productImage',
    width: 96,
    render: (row: Api.Product.ProductItem) => {
      if (row.productImage) {
        return h('img', {
          src: row.productImage,
          alt: row.productName,
          class: 'w-48px h-48px object-cover rounded-4px cursor-pointer',
          onclick: () => viewDetail(row)
        });
      }
      return h('span', '—');
    }
  },
  {
    title: '商品名称',
    key: 'productName',
    ellipsis: { tooltip: true },
    render: (row: Api.Product.ProductItem) => {
      return h(
        'a',
        {
          href: row.productUrl || '#',
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'text-primary no-underline hover:underline',
          onclick: (e: MouseEvent) => {
            if (!row.productUrl) e.preventDefault();
          }
        },
        row.productName
      );
    }
  },
  {
    title: '价格',
    key: 'price',
    width: 128,
    render: (row: Api.Product.ProductItem) => {
      const price = row.price;
      if (price == null) return h('span', '—');
      return h('n-tag', { type: priceTagColor(price), round: true, size: 'small' }, `¥${Number(price).toFixed(2)}`);
    }
  },
  {
    title: '起批件数',
    key: 'minOrder',
    width: 106
  },
  {
    title: '供应商',
    key: 'supplierName',
    ellipsis: { tooltip: true },
    render: (row: Api.Product.ProductItem) => {
      if (row.supplierUrl) {
        return h(
          'a',
          {
            href: row.supplierUrl,
            target: '_blank',
            rel: 'noopener noreferrer',
            class: 'text-primary no-underline hover:underline'
          },
          row.supplierName
        );
      }
      return row.supplierName;
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 170,
    render: (row: Api.Product.ProductItem) => {
      const btns = [
        h(
          'n-button',
          {
            size: 'small',
            type: 'primary',
            ghost: true,
            onClick: () => viewDetail(row)
          },
          '查看'
        )
      ];
      if (row.productUrl) {
        btns.push(
          h(
            'n-button',
            {
              size: 'small',
              type: 'info',
              ghost: true,
              onClick: () => openLink(row.productUrl!)
            },
            '访问链接'
          )
        );
      }
      return h('n-space', {}, btns);
    }
  }
]);
</script>

<template>
  <div class="p-16px">
    <!-- 搜索卡片 -->
    <NCard :bordered="false" class="rounded-12px shadow-sm mb-16px" size="small">
      <div class="flex flex-wrap gap-12px items-center">
        <NInput
          v-model:value="searchParams.productName"
          placeholder="请输入商品名称"
          clearable
          class="w-200px"
          @keydown.enter="handleSearch"
        />
        <NInputNumber
          v-model:value="searchParams.minPrice"
          placeholder="最低价"
          :min="0"
          :precision="2"
          clearable
          class="w-130px"
        />
        <span class="text-gray-400">-</span>
        <NInputNumber
          v-model:value="searchParams.maxPrice"
          placeholder="最高价"
          :min="0"
          :precision="2"
          clearable
          class="w-130px"
        />
        <NInput
          v-model:value="searchParams.minOrder"
          placeholder="起批件数"
          clearable
          class="w-140px"
          @keydown.enter="handleSearch"
        />
        <NInput
          v-model:value="searchParams.supplierName"
          placeholder="供应商名称"
          clearable
          class="w-160px"
          @keydown.enter="handleSearch"
        />
        <NButton type="primary" :loading="loading" @click="handleSearch">搜索</NButton>
        <NButton @click="handleReset">重置</NButton>
      </div>
    </NCard>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-3 gap-16px mb-16px">
      <NCard :bordered="false" class="rounded-12px shadow-sm transition-transform hover:-translate-y-2px">
        <div class="flex items-center gap-16px">
          <div
            class="flex items-center justify-center w-54px h-54px rounded-12px text-white"
            style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
          >
            <SvgIcon icon="ph:package" class="text-32px" />
          </div>
          <div class="flex-1">
            <div class="text-13px text-gray-400 mb-4px">商品总数</div>
            <div class="text-24px font-bold">{{ stats.totalCount }}</div>
          </div>
        </div>
      </NCard>

      <NCard :bordered="false" class="rounded-12px shadow-sm transition-transform hover:-translate-y-2px">
        <div class="flex items-center gap-16px">
          <div
            class="flex items-center justify-center w-54px h-54px rounded-12px text-white"
            style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
          >
            <SvgIcon icon="ph:building" class="text-32px" />
          </div>
          <div class="flex-1">
            <div class="text-13px text-gray-400 mb-4px">供应商数</div>
            <div class="text-24px font-bold">{{ stats.supplierCount }}</div>
          </div>
        </div>
      </NCard>

      <NCard :bordered="false" class="rounded-12px shadow-sm transition-transform hover:-translate-y-2px">
        <div class="flex items-center gap-16px">
          <div
            class="flex items-center justify-center w-54px h-54px rounded-12px text-white"
            style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
          >
            <SvgIcon icon="ph:currency-circle-dollar" class="text-32px" />
          </div>
          <div class="flex-1">
            <div class="text-13px text-gray-400 mb-4px">均价</div>
            <div class="text-24px font-bold">¥{{ stats.avgPrice.toFixed(2) }}</div>
          </div>
        </div>
      </NCard>
    </div>

    <!-- 数据表格 -->
    <NCard :bordered="false" class="rounded-12px shadow-sm">
      <NDataTable
        :columns="columns"
        :data="tableData"
        :loading="loading"
        :pagination="{
          page: searchParams.page + 1,
          pageSize: searchParams.size,
          itemCount: total,
          showSizePicker: true,
          pageSizes: [10, 20, 30, 50],
          onUpdatePage: handlePageChange,
          onUpdatePageSize: handlePageSizeChange
        }"
        :bordered="false"
        striped
        size="small"
        remote
      />
    </NCard>

    <!-- 详情抽屉 -->
    <NDrawer v-model:show="drawerVisible" :width="480" placement="right">
      <NDrawerContent title="商品详情" closable>
        <template v-if="currentProduct">
          <div class="text-center mb-16px">
            <img
              :src="currentProduct.productImage || ''"
              :alt="currentProduct.productName"
              class="max-w-full max-h-240px object-contain rounded-8px border border-gray-200"
            />
          </div>
          <NDescriptions :column="1" bordered size="small">
            <NDescriptionsItem label="商品名称">
              {{ currentProduct.productName }}
            </NDescriptionsItem>
            <NDescriptionsItem label="价格">
              <NTag :type="priceTagColor(currentProduct.price)" round>
                ¥{{ currentProduct.price?.toFixed(2) ?? '—' }}
              </NTag>
            </NDescriptionsItem>
            <NDescriptionsItem label="起批件数">
              {{ currentProduct.minOrder || '—' }}
            </NDescriptionsItem>
            <NDescriptionsItem label="供应商">
              {{ currentProduct.supplierName }}
            </NDescriptionsItem>
            <NDescriptionsItem label="商品链接">
              <a
                v-if="currentProduct.productUrl"
                :href="currentProduct.productUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary"
              >
                打开链接
              </a>
              <span v-else>—</span>
            </NDescriptionsItem>
            <NDescriptionsItem label="供应商链接">
              <a
                v-if="currentProduct.supplierUrl"
                :href="currentProduct.supplierUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary"
              >
                查看供应商
              </a>
              <span v-else>—</span>
            </NDescriptionsItem>
          </NDescriptions>
          <div class="mt-16px">
            <NButton
              v-if="currentProduct.productUrl"
              type="primary"
              block
              @click="openLink(currentProduct.productUrl!)"
            >
              立即购买
            </NButton>
          </div>
        </template>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>
