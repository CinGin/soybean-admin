<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NDescriptions, NDescriptionsItem, NEmpty, NImage, NModal, NSpin, NTag } from 'naive-ui';
import { request } from '@/service/request';

interface Props {
  visible: boolean;
  variantId: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void;
}>();

const loading = ref(false);
const product = ref<Api.Ozon.OzonProductVO | null>(null);

/** listingSource 枚举映射 */
const LISTING_SOURCE_MAP: Record<
  number,
  { label: string; type: 'default' | 'info' | 'success' | 'warning' | 'error' }
> = {
  0: { label: '未上架', type: 'default' },
  1: { label: '自建审核中', type: 'info' },
  2: { label: '自建成功', type: 'success' },
  3: { label: '自建失败', type: 'error' },
  4: { label: '跟卖审核中', type: 'info' },
  5: { label: '跟卖成功', type: 'success' },
  6: { label: '跟卖失败', type: 'error' }
};

const listingSourceMeta = computed(() => {
  const src = product.value?.listingSource;
  if (src == null) return null;
  return (
    LISTING_SOURCE_MAP[src] ?? {
      label: `未知(${src})`,
      type: 'default' as const
    }
  );
});

async function load() {
  if (!props.variantId) return;
  loading.value = true;
  product.value = null;
  try {
    const { data, error } = await request<Api.Ozon.OzonProductVO>({
      url: `/api/ozon/auto-listing/product/${props.variantId}`,
      method: 'get'
    });
    if (!error && data) product.value = data;
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.visible,
  v => {
    if (v) load();
    else product.value = null;
  }
);

function handleClose() {
  emit('update:visible', false);
}

/** 通用数字格式化 */
function fmtNum(v: number | null | undefined, suffix = '') {
  if (v === null || v === undefined) return '-';
  return `${v}${suffix}`;
}

/** 通用字符串占位 */
function fmtStr(v: string | null | undefined) {
  return v != null && v !== '' ? v : '-';
}
</script>

<template>
  <NModal
    :show="visible"
    preset="card"
    title="Ozon 原商品信息"
    class="w-90vw max-w-1100px"
    :mask-closable="true"
    @update:show="handleClose"
  >
    <NSpin :show="loading">
      <NEmpty v-if="!loading && !product" description="无数据" class="py-40px" />

      <template v-else-if="product">
        <!-- ===== 主图 + 核心信息 ===== -->
        <div class="flex gap-16px">
          <div class="flex-shrink-0">
            <NImage
              :src="product.photo || undefined"
              width="220"
              height="220"
              object-fit="cover"
              class="rounded border border-gray-200"
              :preview-disabled="!product.photo"
            />
          </div>
          <div class="flex-1 min-w-0">
            <div class="mb-12px text-16px font-medium leading-snug break-all">
              {{ fmtStr(product.name) }}
            </div>
            <NDescriptions :column="1" label-placement="left" bordered size="small">
              <NDescriptionsItem label="variantId">
                {{ fmtStr(product.variantId) }}
              </NDescriptionsItem>
              <NDescriptionsItem label="SKU">
                {{ fmtStr(product.sku) }}
              </NDescriptionsItem>
              <NDescriptionsItem label="品牌">
                {{ fmtStr(product.brand) }}
                <span v-if="product.brandId" class="ml-4px text-12px text-gray-400">(id: {{ product.brandId }})</span>
              </NDescriptionsItem>
              <NDescriptionsItem label="货号">
                {{ fmtStr(product.article) }}
              </NDescriptionsItem>
              <NDescriptionsItem label="卖家">
                {{ fmtStr(product.sellerName) }}
                <span v-if="product.sellerId" class="ml-4px text-12px text-gray-400">(id: {{ product.sellerId }})</span>
              </NDescriptionsItem>
              <NDescriptionsItem label="商品链接">
                <a
                  v-if="product.link"
                  :href="product.link"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-blue-500 hover:underline break-all"
                >
                  {{ product.link }} ↗
                </a>
                <span v-else>-</span>
              </NDescriptionsItem>
            </NDescriptions>
          </div>
        </div>

        <!-- ===== 类目信息 ===== -->
        <NDescriptions :column="2" label-placement="left" bordered size="small" class="mt-16px" title="类目信息">
          <NDescriptionsItem label="一级类目">
            {{ fmtStr(product.category1) }}
            <span v-if="product.category1Id" class="ml-4px text-12px text-gray-400">({{ product.category1Id }})</span>
          </NDescriptionsItem>
          <NDescriptionsItem label="二级类目">
            {{ fmtStr(product.category2) }}
            <span v-if="product.category2Id" class="ml-4px text-12px text-gray-400">({{ product.category2Id }})</span>
          </NDescriptionsItem>
          <NDescriptionsItem label="三级类目">
            {{ fmtStr(product.category3) }}
            <span v-if="product.category3Id" class="ml-4px text-12px text-gray-400">({{ product.category3Id }})</span>
          </NDescriptionsItem>
          <NDescriptionsItem label="销售模式">
            {{ fmtStr(product.salesSchema) }}
          </NDescriptionsItem>
        </NDescriptions>

        <!-- ===== 销售动态 ===== -->
        <NDescriptions :column="3" label-placement="left" bordered size="small" class="mt-16px" title="销售动态">
          <NDescriptionsItem label="总销售额">
            {{ fmtNum(product.soldSum) }}
          </NDescriptionsItem>
          <NDescriptionsItem label="本期销量">
            {{ fmtNum(product.latestSoldCount) }}
          </NDescriptionsItem>
          <NDescriptionsItem label="上期销量">
            {{ fmtNum(product.previousSoldCount) }}
          </NDescriptionsItem>
          <NDescriptionsItem label="增长率">
            <span
              v-if="product.growthRate != null"
              :class="product.growthRate >= 0 ? 'text-green-600' : 'text-red-600'"
            >
              {{ product.growthRate >= 0 ? '+' : '' }}{{ product.growthRate }}%
            </span>
            <span v-else>-</span>
          </NDescriptionsItem>
          <NDescriptionsItem label="库存状态">
            {{ fmtStr(product.binStatus) }}
          </NDescriptionsItem>
          <NDescriptionsItem label="销售动态">
            {{ fmtNum(product.salesDynamics) }}
          </NDescriptionsItem>
        </NDescriptions>

        <!-- ===== 上架状态 ===== -->
        <NDescriptions :column="2" label-placement="left" bordered size="small" class="mt-16px" title="上架状态">
          <NDescriptionsItem label="上架状态">
            <NTag v-if="listingSourceMeta" :type="listingSourceMeta.type" size="small" :bordered="false">
              {{ listingSourceMeta.label }}
            </NTag>
            <span v-else>-</span>
          </NDescriptionsItem>
          <NDescriptionsItem label="上架任务ID">
            {{ fmtStr(product.listingTaskId) }}
          </NDescriptionsItem>
          <NDescriptionsItem label="上架Client-Id">
            {{ fmtStr(product.listingClientId) }}
          </NDescriptionsItem>
          <NDescriptionsItem label="上架店铺">
            {{ fmtStr(product.listingSellerName) }}
          </NDescriptionsItem>
          <NDescriptionsItem label="更新时间" :span="2">
            {{ fmtStr(product.updateDate) }}
          </NDescriptionsItem>
        </NDescriptions>
      </template>
    </NSpin>
  </NModal>
</template>

<style scoped></style>
