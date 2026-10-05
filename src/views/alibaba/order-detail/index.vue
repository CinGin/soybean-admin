<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMessage, useDialog } from 'naive-ui';
import {
  fetchAlibabaOrderDetail,
  fetchAlibabaLogisticsInfos,
  fetchAlibabaLogisticsTrace,
  fetchAlibabaPayUrl,
  fetchAlibabaCancelOrder // 新增
} from '@/service/api/alibaba-trade';
import type {
  AlibabaTradeInfo,
  AlibabaProductItem,
  AlibabaLogisticsOrder,
  AlibabaLogisticsStep
} from '@/typings/api/alibaba-trade';

const route = useRoute();
const router = useRouter();
const message = useMessage();
const dialog = useDialog();

// ====== 状态 ======
const orderId = computed(() => String(route.query.id || ''));
const loading = ref(false);
const orderData = ref<AlibabaTradeInfo | null>(null);
const logisticsList = ref<AlibabaLogisticsOrder[]>([]);
// logisticsId -> 轨迹步骤列表
const traceMap = ref<Record<string, AlibabaLogisticsStep[]>>({});

// ====== 状态映射 ======
const STATUS_LABELS: Record<string, string> = {
  waitbuyerpay: '等待买家付款',
  waitsellersend: '等待卖家发货',
  waitbuyerreceive: '等待买家收货',
  success: '交易成功',
  cancel: '交易已取消',
  terminated: '交易终止'
};

const STATUS_HINTS: Record<string, string> = {
  waitbuyerpay: '请在支付超时前完成付款',
  waitsellersend: '卖家正在准备发货',
  waitbuyerreceive: '商品已发货，请注意查收',
  success: '订单已完成',
  cancel: '订单已取消',
  terminated: '订单已终止'
};

const statusColorClass = computed(() => {
  const status = orderData.value?.baseInfo?.status;
  if (status === 'waitbuyerpay') return 'text-orange-500';
  if (status === 'success') return 'text-green-500';
  if (status === 'cancel' || status === 'terminated') return 'text-gray-500';
  return 'text-blue-500';
});

// ====== 加载订单详情 ======
async function loadOrderDetail() {
  if (!orderId.value) return;
  loading.value = true;
  try {
    const res = await fetchAlibabaOrderDetail(orderId.value);
    const data = res.data;
    if (data?.success === 'true' || data?.result) {
      orderData.value = data.result || null;
    } else {
      message.error(data?.errorMessage || '加载订单详情失败');
    }
  } catch (error) {
    console.error('加载订单详情失败', error);
    message.error('加载订单详情失败');
  } finally {
    loading.value = false;
  }
}

// ====== 加载物流信息 ======
async function loadLogistics() {
  if (!orderId.value) return;
  try {
    const res = await fetchAlibabaLogisticsInfos(orderId.value);
    const data = res.data;
    if (data?.success && data.result) {
      logisticsList.value = data.result;
      // 并发加载轨迹
      await Promise.all(
        data.result.map(async log => {
          if (log.logisticsId) {
            await loadTrace(log.logisticsId);
          }
        })
      );
    } else if (data?.errorCode === '500_2') {
      // 订单未发货，忽略
      logisticsList.value = [];
    }
  } catch (error) {
    console.error('加载物流信息失败', error);
  }
}

// ============ 加载物流轨迹 ============
async function loadTrace(logisticsId: string) {
  if (!logisticsId) return;
  try {
    const res = await fetchAlibabaLogisticsTrace(orderId.value, logisticsId);
    const data = res.data;
    if (data?.success && data.logisticsTrace) {
      // 提取第一个 trace 的 steps
      const trace = data.logisticsTrace[0];
      if (trace?.logisticsSteps) {
        // 倒序展示（最新的在前）
        traceMap.value[logisticsId] = [...trace.logisticsSteps].reverse();
      }
    }
  } catch (error) {
    console.error('加载物流轨迹失败', logisticsId, error);
  }
}

// ====== 支付 ======
async function handlePay() {
  if (!orderId.value) return;
  try {
    const res = await fetchAlibabaPayUrl(orderId.value);
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

// ====== 取消订单 ======
function handleCancel() {
  dialog.warning({
    title: '确认取消',
    content: '确定要取消该订单吗？取消后不可恢复。',
    positiveText: '确认取消',
    negativeText: '再想想',
    onPositiveClick: async () => {
      try {
        const res = await fetchAlibabaCancelOrder(orderId.value, 'buyerCancel', '用户主动取消');
        const data = res.data;
        if (data?.success) {
          message.success('订单已取消');
          // 重新加载订单详情，状态会变为 cancel
          await loadOrderDetail();
        } else {
          const code = data?.errorCode;
          if (code === 'ORDER_STATUS_ERROR') {
            message.warning('订单当前状态不可取消（仅待付款订单可取消）');
          } else if (code === '400_3') {
            message.error('没有权限取消该订单');
          } else if (code === 'ORDER_NOT_EXIST') {
            message.error('订单不存在');
          } else {
            message.error(data?.errorMessage || '取消失败');
          }
        }
      } catch (error) {
        console.error('取消订单失败', error);
        message.error('取消订单失败');
      }
    }
  });
}

// ====== 确认收货（占位，需后端实现 trade.receivegoods.confirm） ======
function handleConfirmReceive() {
  dialog.warning({
    title: '确认收货',
    content: '请确认已收到商品，确认后货款将打给卖家。',
    positiveText: '确认收货',
    negativeText: '取消',
    onPositiveClick: () => {
      message.info('确认收货功能待实现');
      // TODO: 调用 confirmReceive 接口
    }
  });
}

// ====== 返回 ======
function goBack() {
  router.back();
}

// ====== 辅助函数 ======
function getStatusLabel(status?: string): string {
  if (!status) return '未知';
  return STATUS_LABELS[status] || status;
}

function getStatusHint(status?: string): string {
  if (!status) return '';
  return STATUS_HINTS[status] || '';
}

function getLogisticsStatusLabel(status?: string): string {
  const map: Record<string, string> = {
    WAITACCEPT: '未受理',
    CANCEL: '已撤销',
    ACCEPT: '已受理',
    TRANSPORT: '运输中',
    NOGET: '揽件失败',
    SIGN: '已签收',
    UNSIGN: '签收异常'
  };
  return status ? map[status] || status : '-';
}

function getLogisticsStatusType(status?: string): 'default' | 'info' | 'success' | 'warning' | 'error' {
  if (status === 'SIGN') return 'success';
  if (status === 'TRANSPORT' || status === 'ACCEPT') return 'info';
  if (status === 'NOGET' || status === 'UNSIGN') return 'warning';
  if (status === 'CANCEL') return 'error';
  return 'default';
}

function getTraceSteps(logisticsId?: string): AlibabaLogisticsStep[] {
  if (!logisticsId) return [];
  return traceMap.value[logisticsId] || [];
}

function formatAmount(amount?: number): string {
  if (amount == null) return '0.00';
  return Number(amount).toFixed(2);
}

function getItemImage(item: AlibabaProductItem): string {
  if (item.productImgUrl && item.productImgUrl.length > 0) {
    return item.productImgUrl[0];
  }
  return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80"%3E%3Crect width="80" height="80" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="12"%3E无图%3C/text%3E%3C/svg%3E';
}

function onImageError(e: Event) {
  const img = e.target as HTMLImageElement;
  img.src =
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80"%3E%3Crect width="80" height="80" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="12"%3E无图%3C/text%3E%3C/svg%3E';
}

// ====== 初始化 ======
onMounted(async () => {
  await loadOrderDetail();
  // 详情加载完成后再加载物流（未发货也无妨）
  await loadLogistics();
});
</script>

<template>
  <div class="p-4">
    <!-- 顶部导航 -->
    <div class="mb-4 flex items-center gap-2">
      <NButton quaternary size="small" @click="goBack">
        <template #icon>
          <span class="i-carbon:arrow-left" />
        </template>
        返回
      </NButton>
      <NDivider vertical />
      <span class="text-sm text-gray-500">订单号：{{ orderId }}</span>
    </div>

    <NSpin :show="loading">
      <div v-if="orderData" class="flex flex-col gap-4">
        <!-- 订单状态卡片 -->
        <NCard>
          <div class="flex flex-wrap items-center justify-between">
            <div class="flex items-center gap-4">
              <div class="flex flex-col">
                <span class="text-2xl font-bold" :class="statusColorClass">
                  {{ getStatusLabel(orderData.baseInfo?.status) }}
                </span>
                <span class="text-xs text-gray-500 mt-1">
                  {{ getStatusHint(orderData.baseInfo?.status) }}
                </span>
              </div>
              <NDivider vertical />
              <div class="flex flex-col text-xs text-gray-500 gap-1">
                <span>下单时间：{{ orderData.baseInfo?.createTime }}</span>
                <span v-if="orderData.baseInfo?.payTime">付款时间：{{ orderData.baseInfo?.payTime }}</span>
              </div>
            </div>
            <div class="flex gap-2">
              <NButton v-if="orderData.baseInfo?.status === 'waitbuyerpay'" type="primary" @click="handlePay">
                立即支付
              </NButton>
              <NButton v-if="orderData.baseInfo?.status === 'waitbuyerpay'" @click="handleCancel">取消订单</NButton>
              <NButton
                v-if="orderData.baseInfo?.status === 'waitbuyerreceive'"
                type="primary"
                @click="handleConfirmReceive"
              >
                确认收货
              </NButton>
            </div>
          </div>
        </NCard>

        <!-- 收货地址 -->
        <NCard v-if="orderData.baseInfo?.receiverInfo" title="收货地址">
          <NDescriptions label-placement="left" :column="2" size="small" bordered>
            <NDescriptionsItem label="收货人">
              {{ orderData.baseInfo.receiverInfo.toFullName || '-' }}
            </NDescriptionsItem>
            <NDescriptionsItem label="手机">
              {{ orderData.baseInfo.receiverInfo.toMobile || '-' }}
            </NDescriptionsItem>
            <NDescriptionsItem label="电话">
              {{ orderData.baseInfo.receiverInfo.toPhone || '-' }}
            </NDescriptionsItem>
            <NDescriptionsItem label="邮编">
              {{ orderData.baseInfo.receiverInfo.toPost || '-' }}
            </NDescriptionsItem>
            <NDescriptionsItem label="地址" :span="2">
              {{ orderData.baseInfo.receiverInfo.toArea || '-' }}
            </NDescriptionsItem>
          </NDescriptions>
        </NCard>

        <!-- 商品清单 -->
        <NCard title="商品清单">
          <div class="flex flex-col gap-3">
            <div
              v-for="(item, idx) in orderData.productItems || []"
              :key="idx"
              class="flex items-center gap-3 pb-3 border-b border-gray-100 last:border-b-0 last:pb-0"
            >
              <img
                :src="getItemImage(item)"
                :alt="item.name"
                class="w-20 h-20 object-cover rounded-md border border-gray-100"
                loading="lazy"
                referrerpolicy="no-referrer"
                @error="onImageError"
              />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium line-clamp-2" :title="item.name">
                  {{ item.name }}
                </div>
                <div v-if="item.skuInfos?.length" class="text-xs text-gray-500 mt-1">
                  <span v-for="(sku, i) in item.skuInfos" :key="i" class="mr-3">{{ sku.name }}: {{ sku.value }}</span>
                </div>
                <div class="text-xs text-gray-400 mt-1">商品ID：{{ item.productID }}</div>
              </div>
              <div class="text-right">
                <div class="text-red-500 font-semibold">¥{{ item.price }}</div>
                <div class="text-gray-500 text-xs mt-1">×{{ item.quantity }}{{ item.unit || '' }}</div>
              </div>
            </div>
          </div>
        </NCard>

        <!-- 金额明细 -->
        <NCard title="金额明细">
          <div class="flex flex-col gap-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-500">商品总价</span>
              <span>¥{{ formatAmount(orderData.baseInfo?.sumProductPayment) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">运费</span>
              <span>¥{{ formatAmount(orderData.baseInfo?.shippingFee) }}</span>
            </div>
            <div v-if="orderData.baseInfo?.discount" class="flex justify-between">
              <span class="text-gray-500">优惠</span>
              <span class="text-green-500">-¥{{ formatAmount(orderData.baseInfo.discount) }}</span>
            </div>
            <div v-if="orderData.baseInfo?.couponFee" class="flex justify-between">
              <span class="text-gray-500">红包</span>
              <span class="text-green-500">-¥{{ formatAmount(orderData.baseInfo.couponFee) }}</span>
            </div>
            <NDivider class="my-2" />
            <div class="flex justify-between items-center">
              <span class="text-gray-700 font-medium">应付总额</span>
              <span class="text-red-500 font-bold text-xl">¥{{ formatAmount(orderData.baseInfo?.totalAmount) }}</span>
            </div>
          </div>
        </NCard>

        <!-- 物流信息 -->
        <NCard title="物流信息">
          <div v-if="logisticsList.length > 0" class="flex flex-col gap-4">
            <div v-for="(logistics, idx) in logisticsList" :key="idx" class="flex flex-col gap-3">
              <NDescriptions label-placement="left" :column="2" size="small" bordered>
                <NDescriptionsItem label="物流公司">
                  {{ logistics.logisticsCompanyName || '-' }}
                </NDescriptionsItem>
                <NDescriptionsItem label="运单号">
                  <span class="font-mono">{{ logistics.logisticsBillNo || '-' }}</span>
                </NDescriptionsItem>
                <NDescriptionsItem label="物流状态">
                  <NTag :type="getLogisticsStatusType(logistics.status)" size="small">
                    {{ getLogisticsStatusLabel(logistics.status) }}
                  </NTag>
                </NDescriptionsItem>
                <NDescriptionsItem label="发货时间">
                  {{ logistics.gmtSystemSend || '-' }}
                </NDescriptionsItem>
                <NDescriptionsItem v-if="logistics.remarks" label="备注" :span="2">
                  {{ logistics.remarks }}
                </NDescriptionsItem>
              </NDescriptions>

              <!-- 物流轨迹时间轴 -->
              <div v-if="getTraceSteps(logistics.logisticsId).length > 0" class="mt-2">
                <NTimeline>
                  <NTimelineItem
                    v-for="(step, sIdx) in getTraceSteps(logistics.logisticsId)"
                    :key="sIdx"
                    :time="step.acceptTime"
                    :type="sIdx === 0 ? 'success' : 'default'"
                  >
                    {{ step.remark }}
                  </NTimelineItem>
                </NTimeline>
              </div>
              <NEmpty v-else size="small" description="暂无物流轨迹" class="py-4" />
            </div>
          </div>
          <NEmpty v-else description="暂无物流信息，订单发货后可查看" class="py-6" />
        </NCard>

        <!-- 订单信息 -->
        <NCard title="订单信息">
          <NDescriptions label-placement="left" :column="2" size="small" bordered>
            <NDescriptionsItem label="订单号">
              {{ orderData.baseInfo?.idOfStr || orderData.baseInfo?.id }}
            </NDescriptionsItem>
            <NDescriptionsItem label="交易方式">
              {{ orderData.baseInfo?.tradeTypeDesc || '-' }}
            </NDescriptionsItem>
            <NDescriptionsItem label="买家账号">
              {{ orderData.baseInfo?.buyerLoginId || '-' }}
            </NDescriptionsItem>
            <NDescriptionsItem label="卖家账号">
              {{ orderData.baseInfo?.sellerLoginId || '-' }}
            </NDescriptionsItem>
            <NDescriptionsItem v-if="orderData.baseInfo?.shopName" label="店铺名称">
              {{ orderData.baseInfo.shopName }}
            </NDescriptionsItem>
            <NDescriptionsItem v-if="orderData.baseInfo?.buyerFeedback" label="买家留言" :span="2">
              {{ orderData.baseInfo.buyerFeedback }}
            </NDescriptionsItem>
          </NDescriptions>
        </NCard>
      </div>
    </NSpin>
  </div>
</template>

<style scoped>
.order-detail :deep(.n-card__content) {
  padding: 16px;
}
</style>
