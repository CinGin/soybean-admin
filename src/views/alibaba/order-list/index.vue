<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import { fetchAlibabaOrderList, fetchAlibabaPayUrl } from '@/service/api/alibaba-trade';
import type { AlibabaTradeInfo, AlibabaProductItem } from '@/typings/api/alibaba-trade';

const router = useRouter();
const message = useMessage();

// ====== 状态 Tab 配置 ======
const STATUS_TABS = [
  { key: '', label: '全部' },
  { key: 'waitbuyerpay', label: '待付款' },
  { key: 'waitsellersend', label: '待发货' },
  { key: 'waitbuyerreceive', label: '待收货' },
  { key: 'success', label: '已完成' },
  { key: 'cancel', label: '已取消' }
];

// ====== 状态映射 ======
const STATUS_LABELS: Record<string, string> = {
  waitbuyerpay: '待付款',
  waitsellersend: '待发货',
  waitbuyerreceive: '待收货',
  success: '已完成',
  cancel: '已取消',
  terminated: '交易终止'
};

const STATUS_TAG_TYPES: Record<string, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  waitbuyerpay: 'warning',
  waitsellersend: 'info',
  waitbuyerreceive: 'info',
  success: 'success',
  cancel: 'default',
  terminated: 'error'
};

// ====== 状态 ======
const activeStatus = ref('');
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const loading = ref(false);
const orderList = ref<AlibabaTradeInfo[]>([]);

const emptyDescription = computed(() => {
  if (!activeStatus.value) return '暂无订单';
  const tab = STATUS_TABS.find(t => t.key === activeStatus.value);
  return `暂无${tab?.label || ''}订单`;
});

// ====== 加载订单列表 ======
async function loadOrderList() {
  loading.value = true;
  try {
    const res = await fetchAlibabaOrderList({
      page: page.value,
      pageSize: pageSize.value,
      orderStatus: activeStatus.value || undefined
    });
    const data = res.data;
    orderList.value = data?.result || [];
    total.value = data?.totalRecord || 0;
  } catch (error) {
    console.error('加载订单列表失败', error);
    message.error('加载订单列表失败');
  } finally {
    loading.value = false;
  }
}

// ====== 切换 Tab ======
function handleTabChange(key: string) {
  activeStatus.value = key;
  page.value = 1;
  loadOrderList();
}

// ====== 切换分页大小 ======
function handlePageSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadOrderList();
}

// ====== 查看详情 ======
function goDetail(order: AlibabaTradeInfo) {
  const orderId = order.baseInfo?.idOfStr || order.baseInfo?.id;
  if (!orderId) return;
  router.push({
    path: '/alibaba/order-detail',
    query: { id: String(orderId) }
  });
}

// ====== 立即支付 ======
async function handlePay(order: AlibabaTradeInfo) {
  const orderId = order.baseInfo?.idOfStr || order.baseInfo?.id;
  if (!orderId) return;

  try {
    const res = await fetchAlibabaPayUrl(orderId);
    const data = res.data;
    if (data?.success && data.payUrl) {
      window.open(data.payUrl, '_blank');
    } else {
      message.error(data?.erroMsg || '获取支付链接失败');
    }
  } catch (error) {
    console.error('获取支付链接失败', error);
    message.error('获取支付链接失败');
  }
}

// ====== 辅助函数 ======
function getStatusLabel(status?: string): string {
  if (!status) return '未知';
  return STATUS_LABELS[status] || status;
}

function getStatusTagType(status?: string) {
  if (!status) return 'default' as const;
  return STATUS_TAG_TYPES[status] || 'default';
}

function formatAmount(amount?: number): string {
  if (amount == null) return '0.00';
  return Number(amount).toFixed(2);
}

function getItemImage(item: AlibabaProductItem): string {
  if (item.productImgUrl && item.productImgUrl.length > 0) {
    return item.productImgUrl[0];
  }
  return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="10"%3E无图%3C/text%3E%3C/svg%3E';
}

function onImageError(e: Event) {
  const img = e.target as HTMLImageElement;
  img.src =
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="10"%3E无图%3C/text%3E%3C/svg%3E';
}

// ====== 初始化 ======
onMounted(() => {
  loadOrderList();
});
</script>

<template>
  <div class="p-4">
    <!-- 状态 Tab -->
    <NTabs v-model:value="activeStatus" type="line" animated @update:value="handleTabChange">
      <NTab v-for="tab in STATUS_TABS" :key="tab.key" :name="tab.key">
        {{ tab.label }}
      </NTab>
    </NTabs>

    <!-- 订单列表 -->
    <NSpin :show="loading">
      <div v-if="orderList.length > 0" class="mt-4 flex flex-col gap-4">
        <NCard
          v-for="order in orderList"
          :key="order.baseInfo?.idOfStr || order.baseInfo?.id"
          class="order-card cursor-pointer hover:shadow-lg transition-shadow duration-300"
          @click="goDetail(order)"
        >
          <!-- 订单头部：订单号、时间、状态 -->
          <div class="flex flex-wrap items-center justify-between border-b border-gray-100 pb-3 mb-3">
            <div class="flex items-center gap-4 text-xs text-gray-500">
              <span>订单号：{{ order.baseInfo?.idOfStr || order.baseInfo?.id }}</span>
              <span>下单时间：{{ order.baseInfo?.createTime }}</span>
              <span v-if="order.baseInfo?.shopName" class="text-gray-700">
                {{ order.baseInfo.shopName }}
              </span>
            </div>
            <NTag :type="getStatusTagType(order.baseInfo?.status)" size="small" :bordered="false">
              {{ getStatusLabel(order.baseInfo?.status) }}
            </NTag>
          </div>

          <!-- 商品列表 -->
          <div class="flex flex-col gap-2">
            <div v-for="(item, idx) in order.productItems || []" :key="idx" class="flex items-center gap-3 py-2">
              <img
                :src="getItemImage(item)"
                :alt="item.name"
                class="w-16 h-16 object-cover rounded-md border border-gray-100"
                loading="lazy"
                referrerpolicy="no-referrer"
                @error="onImageError"
              />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium line-clamp-2" :title="item.name">
                  {{ item.name }}
                </div>
                <div v-if="item.skuInfos?.length" class="text-xs text-gray-500 mt-1">
                  <span v-for="(sku, i) in item.skuInfos" :key="i" class="mr-2">{{ sku.name }}: {{ sku.value }}</span>
                </div>
              </div>
              <div class="text-right text-sm">
                <div class="text-gray-700">¥{{ item.price }}</div>
                <div class="text-gray-500 text-xs">×{{ item.quantity }}{{ item.unit || '' }}</div>
              </div>
            </div>
          </div>

          <!-- 订单底部：金额、操作 -->
          <div class="flex flex-wrap items-center justify-between border-t border-gray-100 pt-3 mt-3">
            <div class="text-sm">
              <span class="text-gray-500">实付：</span>
              <span class="text-red-500 font-bold text-xl">¥{{ formatAmount(order.baseInfo?.totalAmount) }}</span>
              <span v-if="order.baseInfo?.shippingFee" class="ml-3 text-xs text-gray-500">
                （含运费 ¥{{ order.baseInfo.shippingFee }}）
              </span>
            </div>
            <div class="flex gap-2" @click.stop>
              <NButton size="small" @click.stop="goDetail(order)">查看详情</NButton>
              <NButton
                v-if="order.baseInfo?.status === 'waitbuyerpay'"
                type="primary"
                size="small"
                @click.stop="handlePay(order)"
              >
                立即支付
              </NButton>
            </div>
          </div>
        </NCard>
      </div>

      <NEmpty v-else-if="!loading" class="mt-20" :description="emptyDescription" />
    </NSpin>

    <!-- 分页 -->
    <div v-if="total > 0" class="mt-4 flex justify-end">
      <NPagination
        v-model:page="page"
        :page-size="pageSize"
        :item-count="total"
        :page-slot="5"
        show-size-picker
        :page-sizes="[10, 20, 50]"
        @update:page="loadOrderList"
        @update:page-size="handlePageSizeChange"
      />
    </div>
  </div>
</template>

<style scoped>
.order-card :deep(.n-card__content) {
  padding: 16px;
}
</style>
