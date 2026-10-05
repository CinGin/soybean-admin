<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import {
  fetchAlibabaReceiveAddress,
  fetchAlibabaParseAddress,
  fetchAlibabaClaimOptimalCoupon,
  fetchAlibabaPreviewOrder,
  fetchAlibabaCreateOrder
} from '@/service/api/alibaba-trade';
import { fetchAlibabaProductDetail } from '@/service/api/alibaba-search-product';
import type {
  AlibabaReceiveAddressItem,
  AlibabaPreviewOrderItem,
  AlibabaPreviewTradeModel
} from '@/typings/api/alibaba-trade';

const route = useRoute();
const router = useRouter();
const message = useMessage();

const placeholderImg =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80"%3E%3Crect width="80" height="80" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="12"%3E无图%3C/text%3E%3C/svg%3E';

interface OrderCargo {
  offerId: number;
  specId: string;
  quantity: number;
  subject?: string;
  imageUrl?: string;
  price?: string;
  /** 库存上限，来自 SKU 的 amountOnSale */
  stock?: number;
  /** 单位，如"件"、"个" */
  unit?: string;
}

interface OrderRequestBody {
  flow: string;
  isvBizType: string;
  outOrderId: string;
  message: string;
  tradeType?: string;
  address: {
    addressId?: number;
    fullName?: string;
    mobile?: string;
    phone?: string;
    postCode?: string;
    address?: string;
    addressCode?: string;
    districtCode?: string;
    provinceText?: string;
    cityText?: string;
    areaText?: string;
    townText?: string;
  };
  cargoList: { offerId: number; specId: string; quantity: number }[];
}

// ====== 状态 ======
const pageLoading = ref(false);
const orderCargos = ref<OrderCargo[]>([]);
const orderMessage = ref('');
const outOrderId = ref('');

const showAddressModal = ref(false);
const addressLoading = ref(false);
const addressList = ref<AlibabaReceiveAddressItem[]>([]);
const selectedAddress = ref<AlibabaReceiveAddressItem | null>(null);
const parseLoading = ref(false);

// 新增地址表单
const newAddressForm = reactive({
  fullName: '',
  mobile: '',
  addressText: ''
});

const couponIds = ref<string[]>([]);
const couponLoading = ref(false);

const previewLoading = ref(false);
const previewResult = ref<AlibabaPreviewOrderItem | null>(null);
const selectedTradeType = ref<string>('');
const tradeModels = computed<AlibabaPreviewTradeModel[]>(() => {
  return previewResult.value?.tradeModelList || [];
});

const submitLoading = ref(false);

// 数量变化防抖定时器
let quantityTimer: ReturnType<typeof setTimeout> | undefined;

// ====== 初始化 ======
onMounted(async () => {
  const offerIdStr = String(route.query.offerId || '');
  const specId = String(route.query.specId || '');
  const quantity = Number(route.query.quantity || 1);

  if (!offerIdStr) {
    message.error('缺少商品ID');
    router.back();
    return;
  }

  orderCargos.value = [
    {
      offerId: Number(offerIdStr),
      specId,
      quantity
    }
  ];

  outOrderId.value = `OUT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // 加载必要数据
  await Promise.all([loadProductDetail(Number(offerIdStr)), loadAddressList(), loadCoupons()]);

  // 自动预览（仅当地址已选时）
  if (selectedAddress.value) {
    await handlePreview();
  }
});

onUnmounted(() => {
  if (quantityTimer) clearTimeout(quantityTimer);
});

// ====== 加载商品详情 ======
async function loadProductDetail(offerId: number) {
  try {
    const res = await fetchAlibabaProductDetail(offerId);
    const data = res.data;
    if (data?.result?.result) {
      const detail = data.result.result;
      const cargo = orderCargos.value[0];
      cargo.subject = detail.subject;
      cargo.imageUrl = detail.productImage?.images?.[0];
      cargo.unit = detail.productSaleInfo?.unitInfo?.unit || '件';

      if (detail.productSkuInfos && cargo.specId) {
        const sku = detail.productSkuInfos.find((s: { specId?: string }) => s.specId === cargo.specId);
        if (sku) {
          cargo.price = sku.price;
          // 库存上限
          if (sku.amountOnSale != null) {
            cargo.stock = Number(sku.amountOnSale);
            // 如果 URL 传入的数量超过库存，自动修正为库存上限
            if (cargo.quantity > cargo.stock) {
              cargo.quantity = cargo.stock;
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('加载商品详情失败', error);
  }
}

// ====== 加载地址列表 ======
async function loadAddressList() {
  addressLoading.value = true;
  try {
    const res = await fetchAlibabaReceiveAddress();
    const data = res.data;

    const items = data?.result?.receiveAddressItems;
    if (Array.isArray(items)) {
      addressList.value = items;
      const defaultAddr = items.find(a => a.isDefault);
      if (!selectedAddress.value) {
        selectedAddress.value = defaultAddr || items[0] || null;
      }
    }
  } catch (error) {
    console.error('加载地址列表失败', error);
  } finally {
    addressLoading.value = false;
  }
}

// ====== 打开地址弹窗 ======
async function openAddressModal() {
  showAddressModal.value = true;
  if (addressList.value.length === 0) {
    await loadAddressList();
  }
}

// ====== 选择地址（自动重新预览） ======
async function selectAddress(addr: AlibabaReceiveAddressItem) {
  selectedAddress.value = addr;
  showAddressModal.value = false;
  // 地址变更，清空预览并立即重新预览
  previewResult.value = null;
  await handlePreview();
}

// ====== 数量变化（防抖后重新预览） ======
function handleQuantityChange() {
  // 立即清空预览，显示 '--'
  previewResult.value = null;

  if (quantityTimer) clearTimeout(quantityTimer);
  quantityTimer = setTimeout(async () => {
    if (selectedAddress.value) {
      await handlePreview();
    }
  }, 500);
}

// ====== 解析新地址并添加 ======
async function handleParseNewAddress() {
  if (!newAddressForm.fullName.trim()) {
    message.warning('请输入收货人姓名');
    return;
  }
  if (!newAddressForm.mobile.trim()) {
    message.warning('请输入手机号');
    return;
  }
  if (!newAddressForm.addressText.trim()) {
    message.warning('请输入详细地址');
    return;
  }

  parseLoading.value = true;
  try {
    const res = await fetchAlibabaParseAddress(newAddressForm.addressText);
    const data = res.data;

    const parsed = data?.result as any;
    if (!parsed || !parsed.addressCode) {
      message.error(data?.errorMessage || '地址解析失败，请检查地址格式（需包含省市区）');
      return;
    }

    const newAddr: AlibabaReceiveAddressItem = {
      id: parsed.addressId,
      fullName: newAddressForm.fullName.trim(),
      mobilePhone: newAddressForm.mobile.trim(),
      phone: parsed.phone,
      address: parsed.address,
      addressCode: parsed.addressCode,
      addressCodeText: parsed.addressCodeText || '',
      post: parsed.postCode,
      isDefault: false
    };

    addressList.value = [newAddr, ...addressList.value];
    selectedAddress.value = newAddr;

    newAddressForm.fullName = '';
    newAddressForm.mobile = '';
    newAddressForm.addressText = '';
    showAddressModal.value = false;

    message.success('地址添加成功');

    // 自动重新预览
    previewResult.value = null;
    await handlePreview();
  } catch (error) {
    console.error('地址解析失败', error);
    message.error('地址解析失败');
  } finally {
    parseLoading.value = false;
  }
}

// ====== 领取优惠券 ======
async function loadCoupons() {
  couponLoading.value = true;
  try {
    const offerIds = orderCargos.value.map(c => c.offerId);
    const res = await fetchAlibabaClaimOptimalCoupon(offerIds);
    const data = res.data;
    if (data?.result?.success && data.result.result?.couponIds) {
      couponIds.value = data.result.result.couponIds;
    }
  } catch (error) {
    console.error('领取优惠券失败', error);
  } finally {
    couponLoading.value = false;
  }
}

// ====== 预览价格 ======
async function handlePreview() {
  if (!selectedAddress.value) {
    message.warning('请先选择收货地址');
    showAddressModal.value = true;
    return;
  }

  // 数量校验
  for (const c of orderCargos.value) {
    if (c.stock != null && c.quantity > c.stock) {
      message.error(`商品「${c.subject}」库存不足，最多可购 ${c.stock} 件`);
      c.quantity = c.stock;
      return;
    }
  }

  previewLoading.value = true;
  try {
    const request = buildOrderRequest();
    const res = await fetchAlibabaPreviewOrder(request);
    const data = res.data;
    if (data?.success && data.orderPreviewResuslt && data.orderPreviewResuslt.length > 0) {
      previewResult.value = data.orderPreviewResuslt[0];
      if (previewResult.value.tradeModelList && previewResult.value.tradeModelList.length > 0) {
        selectedTradeType.value = previewResult.value.tradeModelList[0].tradeType || '';
      }
    } else {
      message.error(data?.errorMsg || '预览失败');
    }
  } catch (error) {
    console.error('预览失败', error);
    message.error('预览失败');
  } finally {
    previewLoading.value = false;
  }
}

// ====== 提交订单（未预览则自动预览） ======
async function handleSubmit() {
  if (!selectedAddress.value) {
    message.warning('请先选择收货地址');
    showAddressModal.value = true;
    return;
  }

  // 数量校验
  for (const c of orderCargos.value) {
    if (c.quantity == null || c.quantity < 1) {
      message.error(`商品「${c.subject}」数量必须大于 0`);
      return;
    }
    if (c.stock != null && c.quantity > c.stock) {
      message.error(`商品「${c.subject}」库存不足，最多可购 ${c.stock} 件`);
      return;
    }
  }

  // 未预览时自动预览
  if (!previewResult.value) {
    await handlePreview();
    if (!previewResult.value) {
      return;
    }
  }

  submitLoading.value = true;
  try {
    const request = buildOrderRequest();
    request.tradeType = selectedTradeType.value;
    const res = await fetchAlibabaCreateOrder(request);
    const data = res.data;
    if (data?.success || data?.result?.success) {
      const orderId = data.result?.orderId;
      message.success('订单创建成功');
      if (orderId) {
        router.replace({
          path: '/alibaba/order-detail',
          query: { id: orderId }
        });
      } else {
        router.replace('/alibaba/order-list');
      }
    } else {
      message.error(data?.message || data?.result?.message || '下单失败');
    }
  } catch (error) {
    console.error('下单失败', error);
    message.error('下单失败');
  } finally {
    submitLoading.value = false;
  }
}

// ====== 构造订单请求 ======
function buildOrderRequest(): OrderRequestBody {
  const addr = selectedAddress.value!;
  const [provinceText, cityText, areaText] = (addr.addressCodeText || '').split(/\s+/).filter(Boolean);

  return {
    flow: previewResult.value?.flowFlag || 'general',
    isvBizType: 'cross',
    outOrderId: outOrderId.value,
    message: orderMessage.value,
    address: {
      addressId: addr.id,
      fullName: addr.fullName,
      mobile: addr.mobilePhone,
      phone: addr.phone,
      postCode: addr.post,
      address: addr.address,
      addressCode: addr.addressCode,
      districtCode: addr.addressCode,
      provinceText,
      cityText,
      areaText,
      townText: addr.townName
    },
    cargoList: orderCargos.value.map(c => ({
      offerId: c.offerId,
      specId: c.specId,
      quantity: c.quantity
    }))
  };
}

// ====== 辅助函数 ======
function goBack() {
  router.back();
}

function formatAmount(amount?: number): string {
  if (amount == null) return '0.00';
  return (Number(amount) / 100).toFixed(2);
}

function onImageError(e: Event) {
  const img = e.target as HTMLImageElement;
  img.src = placeholderImg;
}
</script>

<template>
  <div class="p-4 flex flex-col" style="min-height: calc(100vh - 100px)">
    <!-- 顶部导航 -->
    <div class="mb-4 flex items-center gap-2">
      <NButton quaternary size="small" @click="goBack">
        <template #icon>
          <span class="i-carbon:arrow-left" />
        </template>
        返回
      </NButton>
      <NDivider vertical />
      <span class="text-sm text-gray-500">确认订单</span>
    </div>

    <!-- 主内容区：flex-1 撑开剩余高度 -->
    <div class="flex-1">
      <NSpin :show="pageLoading">
        <div class="flex flex-col gap-4">
          <!-- 商品清单 -->
          <NCard title="商品信息">
            <div v-if="orderCargos.length > 0" class="flex flex-col gap-3">
              <div
                v-for="(cargo, idx) in orderCargos"
                :key="idx"
                class="flex items-center gap-3 pb-3 border-b border-gray-100 last:border-b-0 last:pb-0"
              >
                <img
                  :src="cargo.imageUrl || placeholderImg"
                  :alt="cargo.subject"
                  class="w-20 h-20 object-cover rounded-md border border-gray-100"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                  @error="onImageError"
                />
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium line-clamp-2" :title="cargo.subject">
                    {{ cargo.subject || '-' }}
                  </div>
                  <div class="text-xs text-gray-500 mt-1">规格ID：{{ cargo.specId || '-' }}</div>
                  <div class="text-xs text-gray-400 mt-1">offerId：{{ cargo.offerId }}</div>
                  <div v-if="cargo.stock != null" class="text-xs text-orange-500 mt-1">
                    库存：{{ cargo.stock }}{{ cargo.unit || '件' }}
                  </div>
                </div>
                <div class="flex flex-col items-end gap-2">
                  <div class="text-red-500 font-semibold">¥{{ cargo.price || '-' }}</div>
                  <div class="flex items-center gap-1">
                    <NInputNumber
                      v-model:value="cargo.quantity"
                      :min="1"
                      :max="cargo.stock ?? 99999"
                      size="small"
                      style="width: 100px"
                      :show-button="true"
                      @update:value="handleQuantityChange"
                    />
                    <span class="text-gray-500 text-xs">{{ cargo.unit || '件' }}</span>
                  </div>
                </div>
              </div>
            </div>
            <NEmpty v-else description="未选择商品" />
          </NCard>

          <!-- 收货地址 -->
          <NCard title="收货地址">
            <template #header-extra>
              <NButton size="small" @click="openAddressModal">管理地址</NButton>
            </template>

            <div v-if="selectedAddress" class="flex items-start gap-3">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-medium">{{ selectedAddress.fullName || '待填写' }}</span>
                  <span class="text-gray-500 text-sm">{{ selectedAddress.mobilePhone || '' }}</span>
                  <NTag v-if="selectedAddress.isDefault" size="tiny" type="success">默认</NTag>
                </div>
                <div class="text-sm text-gray-600">
                  {{ selectedAddress.addressCodeText }} {{ selectedAddress.address }}
                </div>
              </div>
              <NButton text type="primary" @click="openAddressModal">更换</NButton>
            </div>
            <NEmpty v-else description="请选择收货地址" class="py-4">
              <template #extra>
                <NButton size="small" type="primary" @click="openAddressModal">选择地址</NButton>
              </template>
            </NEmpty>
          </NCard>

          <!-- 优惠券 -->
          <NCard title="优惠券">
            <div v-if="couponIds.length > 0" class="flex items-center gap-2">
              <NTag type="success" :bordered="false">已自动领取 {{ couponIds.length }} 张最优优惠券</NTag>
              <span class="text-xs text-gray-400">下单时自动抵扣</span>
            </div>
            <div v-else-if="couponLoading" class="text-sm text-gray-500">正在领取优惠券...</div>
            <div v-else class="flex items-center gap-2">
              <span class="text-sm text-gray-500">暂无可用优惠券</span>
              <NButton text type="primary" size="small" @click="loadCoupons">重新领取</NButton>
            </div>
          </NCard>

          <!-- 备注 -->
          <NCard title="订单备注">
            <NInput
              v-model:value="orderMessage"
              type="textarea"
              placeholder="选填，可填写特殊要求"
              :rows="2"
              maxlength="500"
              show-count
            />
          </NCard>

          <!-- 预览价格 -->
          <NCard v-if="previewResult" title="价格明细">
            <div class="flex flex-col gap-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-500">商品总价</span>
                <span>¥{{ formatAmount(previewResult.sumPaymentNoCarriage) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">运费</span>
                <span>¥{{ formatAmount(previewResult.sumCarriage) }}</span>
              </div>
              <NDivider class="my-2" />
              <div class="flex justify-between items-center">
                <span class="text-gray-700 font-medium">应付总额</span>
                <span class="text-red-500 font-bold text-xl">¥{{ formatAmount(previewResult.sumPayment) }}</span>
              </div>
            </div>

            <div v-if="tradeModels.length > 0" class="mt-4">
              <div class="text-sm text-gray-500 mb-2">交易方式</div>
              <NRadioGroup v-model:value="selectedTradeType">
                <NSpace>
                  <NRadio v-for="model in tradeModels" :key="model.tradeType" :value="model.tradeType">
                    {{ model.name }}
                  </NRadio>
                </NSpace>
              </NRadioGroup>
            </div>
          </NCard>
        </div>
      </NSpin>
    </div>

    <!-- 底部操作栏：sticky 贴底 -->
    <div
      class="sticky bottom-0 -mx-4 mt-4 px-6 py-3 border-t border-gray-200 bg-white flex items-center justify-between shadow-lg z-50"
    >
      <div class="text-sm">
        <span class="text-gray-500">应付：</span>
        <span class="text-red-500 font-bold text-2xl">
          ¥{{ previewResult ? formatAmount(previewResult.sumPayment) : '--' }}
        </span>
      </div>
      <div class="flex gap-2">
        <NButton :loading="previewLoading" @click="handlePreview">
          {{ previewResult ? '刷新预览' : '预览价格' }}
        </NButton>
        <NButton type="primary" :loading="submitLoading" @click="handleSubmit">创建订单</NButton>
      </div>
    </div>

    <!-- 地址选择弹窗 -->
    <NModal
      v-model:show="showAddressModal"
      preset="card"
      title="管理收货地址"
      style="width: 90%; max-width: 700px"
      :bordered="false"
    >
      <NSpin :show="addressLoading">
        <!-- 已有地址列表 -->
        <div v-if="addressList.length > 0" class="flex flex-col gap-2 max-h-60 overflow-y-auto">
          <div class="text-sm font-medium mb-1">选择已有地址</div>
          <div
            v-for="(addr, idx) in addressList"
            :key="addr.id ?? `new-${idx}`"
            class="flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors"
            :class="selectedAddress === addr ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'"
            @click="selectAddress(addr)"
          >
            <NRadio :checked="selectedAddress === addr" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="font-medium">{{ addr.fullName }}</span>
                <span class="text-gray-500 text-sm">{{ addr.mobilePhone }}</span>
                <NTag v-if="addr.isDefault" size="tiny" type="success">默认</NTag>
                <NTag v-if="!addr.id" size="tiny" type="info">新地址</NTag>
              </div>
              <div class="text-sm text-gray-600 break-all">{{ addr.addressCodeText }} {{ addr.address }}</div>
            </div>
          </div>
        </div>
        <NEmpty v-else description="暂无已保存的收货地址" class="py-6" />

        <NDivider />

        <!-- 新增地址表单 -->
        <div class="flex flex-col gap-3">
          <div class="text-sm font-medium">新增地址</div>
          <NInput v-model:value="newAddressForm.fullName" placeholder="收货人姓名（必填）" />
          <NInput v-model:value="newAddressForm.mobile" placeholder="手机号（必填）" />
          <NInput
            v-model:value="newAddressForm.addressText"
            type="textarea"
            placeholder="详细地址，例如：福建省厦门市思明区软件园二期观日路28号501"
            :rows="2"
          />
          <div class="flex justify-end">
            <NButton type="primary" :loading="parseLoading" @click="handleParseNewAddress">解析并添加</NButton>
          </div>
        </div>
      </NSpin>

      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showAddressModal = false">关闭</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.pb-24 {
  padding-bottom: 96px;
}
</style>
