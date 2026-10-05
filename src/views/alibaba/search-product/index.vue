<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import {
  fetchAlibabaProductSearch,
  fetchAlibabaProductSearchByImage,
  fetchAlibabaProductDetail
} from '@/service/api/alibaba-search-product';
import type { AlibabaProduct, AlibabaProductDetail } from '@/typings/api/alibaba-search-product';

const router = useRouter();
const message = useMessage();

// 搜索模式：关键词 / 图搜
const searchMode = ref<'keyword' | 'image'>('keyword');
// 图搜时缓存的图片文件（用于 loadMore 重新请求）
const imageFile = ref<File | null>(null);
// 文件输入引用
const fileInputRef = ref<HTMLInputElement | null>(null);

const keyword = ref('');
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const totalPage = ref(0);
const loading = ref(false);
const loadingMore = ref(false);
const productList = ref<AlibabaProduct[]>([]);
const hasMore = ref(false);

const showDetail = ref(false);
const selectedProduct = ref<AlibabaProduct | null>(null);

const showDetailParams = ref(false);
const detailLoading = ref(false);
const detailData = ref<AlibabaProductDetail | null>(null);

// ====== 链接解析相关 ======
const showLinkModal = ref(false);
const linkInput = ref('');
const linkParsing = ref(false);

// 实时解析预览的 offerId
const parsedOfferId = computed(() => {
  return parseOfferIdFromUrl(linkInput.value);
});

// 防抖定时器
let searchTimer: ReturnType<typeof setTimeout> | undefined;

// IntersectionObserver
let observer: IntersectionObserver | undefined;
const loadMoreTrigger = ref<HTMLElement | null>(null);

// ====== 链接解析核心函数 ======

/**
 * 从链接中解析 offerId
 * 支持格式：
 *  1. https://detail.1688.com/offer/1071878515326.html
 *  2. https://detail.1688.com/offer/1071878515326.html?offerId=...
 *  3. https://xxx.1688.com/xxx?offerId=1071878515326
 *  4. 纯数字 1071878515326
 */
function parseOfferIdFromUrl(url: string): string | null {
  if (!url) return null;
  const text = url.trim();
  if (!text) return null;

  // 1. 优先匹配 /offer/xxx.html 或 /offer/xxx
  const m1 = text.match(/\/offer\/(\d+)(?:\.html)?/);
  if (m1) return m1[1];

  // 2. 匹配 query 中的 offerId=xxx
  const m2 = text.match(/[?&]offerId=(\d+)/);
  if (m2) return m2[1];

  // 3. 纯数字
  if (/^\d+$/.test(text)) return text;

  return null;
}

/**
 * 打开链接解析弹窗
 */
function handleCloseLinkModal() {
  showLinkModal.value = false;
  linkInput.value = '';
}

/**
 * 执行链接解析：解析 offerId → 调详情接口 → 转换 → 展示
 */
async function handleParseLink() {
  if (!linkInput.value.trim()) {
    message.warning('请输入商品链接或 offerId');
    return;
  }

  const offerId = parseOfferIdFromUrl(linkInput.value);
  if (!offerId) {
    message.error('无法从链接中解析出 offerId，请检查链接格式');
    return;
  }

  linkParsing.value = true;
  try {
    const response = await fetchAlibabaProductDetail(Number(offerId));
    const detail = response.data?.result?.result;
    if (!detail) {
      message.error('未获取到商品详情，请确认商品是否存在');
      return;
    }

    // 转换为 AlibabaProduct 格式
    const product = detailToProduct(detail);

    // 缓存 detail 供后续"商品参数详情"直接使用，避免重复请求
    detailData.value = detail;
    selectedProduct.value = product;

    // 关闭链接解析弹窗，打开基础详情弹窗
    showLinkModal.value = false;
    linkInput.value = '';
    showDetail.value = true;
  } catch (error) {
    console.error('链接解析失败', error);
    message.error('链接解析失败，请稍后重试');
  } finally {
    linkParsing.value = false;
  }
}

/**
 * 将 AlibabaProductDetail 转换为 AlibabaProduct 格式
 * 便于复用现有的基础详情弹窗
 */
function detailToProduct(detail: AlibabaProductDetail): AlibabaProduct {
  const firstImage = detail.productImage?.images?.[0] || '';
  const firstSku = detail.productSkuInfos?.[0];
  // 从第一个 SKU 获取价格，若无则空
  const price = firstSku?.price || '';

  return {
    offerId: detail.offerId,
    subject: detail.subject,
    subjectTrans: detail.subjectTrans,
    imageUrl: firstImage,
    priceInfo: {
      price: price
    },
    minOrderQuantity: detail.minOrderQuantity,
    tradeScore: detail.tradeScore,
    isJxhy: detail.isJxhy,
    // 详情接口不返回的字段统一为 false / undefined
    isOnePsale: false,
    isPatentProduct: false,
    isSelect: Boolean((detail as any).isSelect),
    sellerDataInfo: detail.sellerDataInfo,
    promotionURL: detail.promotionUrl
  };
}

// ====== 关键词搜索 ======

function debouncedSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    handleSearch();
  }, 500);
}

async function handleSearch() {
  if (!keyword.value.trim() || loading.value) return;
  if (searchTimer) {
    clearTimeout(searchTimer);
    searchTimer = undefined;
  }

  searchMode.value = 'keyword';
  imageFile.value = null;

  loading.value = true;
  page.value = 1;
  productList.value = [];
  total.value = 0;
  totalPage.value = 0;
  hasMore.value = false;

  try {
    const response = await fetchAlibabaProductSearch(keyword.value, page.value, pageSize.value);
    const pageInfo = response.data?.result?.result;
    productList.value = pageInfo?.data || [];
    total.value = pageInfo?.totalRecords || 0;
    totalPage.value = pageInfo?.totalPage || 0;
    hasMore.value = page.value < totalPage.value;
  } catch (error) {
    console.error('搜索失败', error);
  } finally {
    loading.value = false;
    await nextTick();
    setupObserver();
  }
}

// ====== 图搜 ======

function triggerImageUpload() {
  fileInputRef.value?.click();
}

async function handleImageFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = '';
  if (!file) return;

  if (loading.value) return;

  if (!file.type.startsWith('image/')) {
    message.warning('请选择图片文件');
    return;
  }

  searchMode.value = 'image';
  imageFile.value = file;

  loading.value = true;
  page.value = 1;
  productList.value = [];
  total.value = 0;
  totalPage.value = 0;
  hasMore.value = false;

  try {
    const response = await fetchAlibabaProductSearchByImage(file, page.value, pageSize.value);
    const pageInfo = response.data?.result?.result;
    productList.value = pageInfo?.data || [];
    total.value = pageInfo?.totalRecords || 0;
    totalPage.value = pageInfo?.totalPage || 0;
    hasMore.value = page.value < totalPage.value;
  } catch (error) {
    console.error('图搜失败', error);
  } finally {
    loading.value = false;
    await nextTick();
    setupObserver();
  }
}

// ====== 分页加载 ======

async function loadMore() {
  if (!hasMore.value || loadingMore.value || loading.value) return;
  loadingMore.value = true;
  const nextPage = page.value + 1;

  try {
    let pageInfo;
    if (searchMode.value === 'image' && imageFile.value) {
      const response = await fetchAlibabaProductSearchByImage(imageFile.value, nextPage, pageSize.value);
      pageInfo = response.data?.result?.result;
    } else {
      const response = await fetchAlibabaProductSearch(keyword.value, nextPage, pageSize.value);
      pageInfo = response.data?.result?.result;
    }
    const newProducts = pageInfo?.data || [];
    productList.value = [...productList.value, ...newProducts];
    page.value = nextPage;
    total.value = pageInfo?.totalRecords || total.value;
    totalPage.value = pageInfo?.totalPage || totalPage.value;
    hasMore.value = page.value < totalPage.value;
  } catch (error) {
    console.error('加载更多失败', error);
  } finally {
    loadingMore.value = false;
    await nextTick();
    setupObserver();
  }
}

function setupObserver() {
  if (observer) {
    observer.disconnect();
  }
  if (!loadMoreTrigger.value) return;
  observer = new IntersectionObserver(
    entries => {
      const entry = entries[0];
      if (entry.isIntersecting && hasMore.value && !loadingMore.value && !loading.value) {
        loadMore();
      }
    },
    {
      root: null,
      rootMargin: '100px',
      threshold: 0.1
    }
  );
  observer.observe(loadMoreTrigger.value);
}

// ====== 详情弹窗 ======

function openDetail(product: AlibabaProduct) {
  // 如果切换了商品，清空缓存的 detail，避免显示错乱
  if (selectedProduct.value?.offerId !== product.offerId) {
    detailData.value = null;
  }
  selectedProduct.value = product;
  showDetail.value = true;
}

function openOriginalLink() {
  if (selectedProduct.value) {
    const url =
      selectedProduct.value.promotionURL || `https://detail.1688.com/offer/${selectedProduct.value.offerId}.html`;
    window.open(url, '_blank');
  }
}

async function openDetailParams() {
  if (!selectedProduct.value?.offerId) return;
  showDetailParams.value = true;

  // 如果已缓存该商品的详情（例如从链接解析进来的），直接用
  if (detailData.value && detailData.value.offerId === selectedProduct.value.offerId) {
    return;
  }

  detailLoading.value = true;
  detailData.value = null;
  try {
    const response = await fetchAlibabaProductDetail(selectedProduct.value.offerId);
    detailData.value = response.data?.result?.result ?? null;
  } catch (error) {
    console.error('获取商品详情参数失败', error);
    message.error('获取商品详情参数失败');
  } finally {
    detailLoading.value = false;
  }
}

// ====== 购买 ======

function handleBuyNow(sku: any) {
  if (!detailData.value?.offerId) return;
  if (!sku?.specId) {
    message.warning('该 SKU 缺少 specId，无法下单');
    return;
  }
  router.push({
    path: '/alibaba/create-order',
    query: {
      offerId: String(detailData.value.offerId),
      specId: String(sku.specId),
      quantity: String(sku.minOrderQuantity || detailData.value.minOrderQuantity || 1)
    }
  });
}

// ====== 辅助函数 ======

function getShippingLabel(type?: string) {
  const map: Record<string, string> = {
    shipIn48Hours: '48h发货',
    shipIn24Hours: '24h发货'
  };
  return type ? map[type] || type : '-';
}

function getSellerIdentityLabels(identities?: string[]): string[] {
  const map: Record<string, string> = {
    super_factory: '超级工厂',
    powerful_merchants: '实力商家',
    tp_member: '诚信通会员'
  };
  return (identities || []).map(i => map[i] || i);
}

function getOfferIdentityLabels(identities?: string[]): string[] {
  const map: Record<string, string> = {
    yx: '严选'
  };
  return (identities || []).map(i => map[i] || i);
}

function getSkuSpec(sku: any): string {
  return sku.skuAttributes?.map((attr: any) => `${attr.attributeName}:${attr.value}`).join('; ') || '-';
}

function getSkuWeight(skuId?: number): string {
  if (!skuId || !detailData.value?.productShippingInfo?.skuShippingDetails) return '-';
  const detail = detailData.value.productShippingInfo.skuShippingDetails.find(
    (item: any) => item.skuId === String(skuId)
  );
  return detail?.weight != null ? (detail.weight * 1000).toFixed(0) : '-';
}

function getUniqueAttributes(attrs?: any[]): any[] {
  if (!attrs) return [];
  const map = new Map();
  attrs.forEach(attr => {
    const key = `${attr.attributeName}_${attr.value}`;
    if (!map.has(key)) {
      map.set(key, attr);
    }
  });
  return Array.from(map.values());
}

// ====== 生命周期 ======
onMounted(() => {
  setupObserver();
});

onUnmounted(() => {
  if (observer) observer.disconnect();
  if (searchTimer) clearTimeout(searchTimer);
});
</script>

<template>
  <div class="p-4">
    <!-- 搜索区域 -->
    <div class="mb-4 flex items-center gap-2 flex-wrap">
      <NInput
        v-model:value="keyword"
        placeholder="请输入搜索关键词"
        class="max-w-300px"
        @keyup.enter="handleSearch"
        @input="debouncedSearch"
      />
      <!-- 图搜按钮 -->
      <NButton secondary :disabled="loading" @click="triggerImageUpload">
        <template #icon>
          <SvgIcon icon="hugeicons:pokemon" />
        </template>
        图片搜索
      </NButton>
      <!-- 链接解析按钮 -->
      <NButton secondary :disabled="loading" @click="showLinkModal = true">
        <template #icon>
          <!-- <span class="i-carbon:link" /> -->
          <SvgIcon icon="mingcute:link-fill" />
        </template>
        链接解析
      </NButton>
      <!-- 隐藏的文件输入 -->
      <input ref="fileInputRef" type="file" accept="image/*" class="hidden" @change="handleImageFileChange" />
      <NButton type="primary" :loading="loading" @click="handleSearch">搜索</NButton>
    </div>

    <!-- 搜索模式提示 -->
    <div v-if="searchMode === 'image' && productList.length > 0" class="mb-2 text-xs text-gray-500">
      当前为图搜结果，共 {{ total }} 条
    </div>

    <!-- 商品卡片列表 -->
    <NSpin :show="loading">
      <div v-if="productList.length > 0" class="flex flex-wrap -m-2">
        <div
          v-for="product in productList"
          :key="product.offerId"
          class="w-full p-2 sm:w-1/2 md:w-1/3 lg:w-1/4 xl:w-1/5"
        >
          <NCard
            class="cursor-pointer hover:shadow-lg transition-shadow duration-300 h-full"
            @click="openDetail(product)"
          >
            <div class="flex flex-col gap-3">
              <div class="relative">
                <img
                  :src="product.imageUrl"
                  :alt="product.subject"
                  class="h-40 w-full object-cover rounded-md"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                />
                <div v-if="product.offerIdentities?.length" class="absolute top-2 left-2 flex gap-1">
                  <NTag
                    v-for="tag in getOfferIdentityLabels(product.offerIdentities)"
                    :key="tag"
                    size="small"
                    type="primary"
                    :bordered="false"
                  >
                    {{ tag }}
                  </NTag>
                </div>
              </div>

              <div class="text-sm font-medium line-clamp-2 min-h-10" :title="product.subject">
                {{ product.subject }}
              </div>

              <div class="flex items-end justify-between">
                <div>
                  <span class="text-red-500 font-bold text-xl">
                    ¥{{ product.priceInfo?.price || product.priceInfo?.consignPrice || '-' }}
                  </span>
                  <span v-if="product.priceInfo?.promotionPrice" class="ml-1 text-xs text-gray-400 line-through">
                    ¥{{ product.priceInfo.promotionPrice }}
                  </span>
                </div>
                <div class="text-right">
                  <div class="text-sm font-semibold text-gray-700">月销 {{ product.monthSold ?? 0 }}</div>
                  <div class="text-xs text-gray-500">复购率 {{ product.repurchaseRate || '-' }}</div>
                </div>
              </div>

              <div class="grid grid-cols-3 gap-1 text-xs text-gray-600">
                <div class="flex flex-col items-center rounded bg-gray-50 p-1">
                  <span class="text-gray-400">起批量</span>
                  <span class="font-medium">{{ product.minOrderQuantity ?? 1 }}</span>
                </div>
                <div class="flex flex-col items-center rounded bg-gray-50 p-1">
                  <span class="text-gray-400">交易评分</span>
                  <span class="font-medium">{{ product.tradeScore || '-' }}</span>
                </div>
                <div class="flex flex-col items-center rounded bg-gray-50 p-1">
                  <span class="text-gray-400">发货时效</span>
                  <span class="font-medium">
                    {{ getShippingLabel(product.productSimpleShippingInfo?.shippingTimeGuarantee) }}
                  </span>
                </div>
              </div>

              <div class="flex flex-wrap gap-1">
                <NTag v-if="product.isJxhy" type="warning" size="small" :bordered="false">精选货源</NTag>
                <NTag v-if="product.isOnePsale" type="success" size="small" :bordered="false">一件代发</NTag>
                <NTag v-if="product.isPatentProduct" type="info" size="small" :bordered="false">专利商品</NTag>
                <NTag v-if="product.isSelect" type="info" size="small" :bordered="false">跨境Select</NTag>
                <NTag
                  v-for="label in getSellerIdentityLabels(product.sellerIdentities)"
                  :key="label"
                  type="default"
                  size="small"
                  :bordered="false"
                >
                  {{ label }}
                </NTag>
              </div>
            </div>
          </NCard>
        </div>
      </div>

      <NEmpty
        v-else-if="!loading"
        :description="
          searchMode === 'image' ? '图搜暂无数据，请尝试其他图片' : '暂无数据，请输入关键词、上传图片或解析商品链接'
        "
      />
    </NSpin>

    <!-- 加载更多指示器与哨兵 -->
    <div v-if="productList.length > 0" class="flex flex-col items-center py-4">
      <NSpin v-if="loadingMore" size="small" />
      <span v-else-if="!hasMore" class="text-gray-400 text-sm">没有更多数据了</span>
      <span v-else class="text-gray-400 text-sm">加载中...</span>
      <div ref="loadMoreTrigger" class="h-1 w-full"></div>
    </div>

    <!-- 商品基础详情弹窗 -->
    <NModal
      v-model:show="showDetail"
      preset="card"
      :title="selectedProduct?.subject"
      class="max-w-3xl"
      :bordered="false"
      style="width: 90%; max-width: 800px"
    >
      <div v-if="selectedProduct" class="flex flex-col gap-4">
        <div class="flex flex-col sm:flex-row gap-4">
          <img
            :src="selectedProduct.imageUrl"
            :alt="selectedProduct.subject"
            class="w-full sm:w-60 h-48 object-cover rounded-md"
            referrerpolicy="no-referrer"
          />
          <div class="flex-1 flex flex-col gap-2">
            <div class="text-lg font-semibold">{{ selectedProduct.subject }}</div>
            <div class="text-sm text-gray-600">{{ selectedProduct.subjectTrans }}</div>
            <div class="flex items-center gap-2">
              <span class="text-red-500 font-bold text-2xl">
                ¥{{ selectedProduct.priceInfo?.price || selectedProduct.priceInfo?.consignPrice || '-' }}
              </span>
              <span v-if="selectedProduct.priceInfo?.promotionPrice" class="text-gray-400 line-through text-sm">
                ¥{{ selectedProduct.priceInfo.promotionPrice }}
              </span>
            </div>
            <div class="flex flex-wrap gap-2 text-sm">
              <NTag v-if="selectedProduct.isJxhy" type="warning">精选货源</NTag>
              <NTag v-if="selectedProduct.isOnePsale" type="success">一件代发</NTag>
              <NTag v-for="tag in getSellerIdentityLabels(selectedProduct.sellerIdentities)" :key="tag" type="info">
                {{ tag }}
              </NTag>
              <NTag v-for="tag in getOfferIdentityLabels(selectedProduct.offerIdentities)" :key="tag" type="primary">
                {{ tag }}
              </NTag>
            </div>
            <div class="text-sm text-gray-700">
              复购率：{{ selectedProduct.repurchaseRate || '-' }}　|　交易评分：{{ selectedProduct.tradeScore || '-' }}
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-2">
          <NButton type="primary" @click="openOriginalLink">查看原商品</NButton>
          <NButton @click="openDetailParams">商品参数详情</NButton>
          <NButton @click="showDetail = false">关闭</NButton>
        </div>
      </div>
    </NModal>

    <!-- 商品参数详情弹窗 -->
    <NModal
      v-model:show="showDetailParams"
      preset="card"
      title="商品参数详情"
      class="max-w-4xl"
      :bordered="false"
      style="width: 95%; max-width: 1000px"
    >
      <NSpin :show="detailLoading">
        <div v-if="detailData" class="flex flex-col gap-4">
          <NDescriptions label-placement="left" :column="2" bordered size="small">
            <NDescriptionsItem label="商品标题">{{ detailData.subject }}</NDescriptionsItem>
            <NDescriptionsItem label="公司名称">{{ detailData.companyName || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="发货地">
              {{ detailData.productShippingInfo?.sendGoodsAddressText || '-' }}
            </NDescriptionsItem>
            <NDescriptionsItem label="单位">
              {{ detailData.productSaleInfo?.unitInfo?.unit || '-' }}
            </NDescriptionsItem>
          </NDescriptions>

          <div>
            <div class="font-semibold mb-2">商品属性</div>
            <NTable :bordered="true" size="small">
              <thead>
                <tr>
                  <th>属性名</th>
                  <th>属性值</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(attr, idx) in getUniqueAttributes(detailData.productAttribute)" :key="idx">
                  <td>{{ attr.attributeName }}</td>
                  <td>{{ attr.value }}</td>
                </tr>
              </tbody>
            </NTable>
          </div>

          <!-- SKU 信息 -->
          <div>
            <div class="font-semibold mb-2">SKU 列表</div>
            <NTable :bordered="true" size="small">
              <thead>
                <tr>
                  <th>规格</th>
                  <th>价格</th>
                  <th>库存</th>
                  <th>重量(g)</th>
                  <th>货号</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="sku in detailData.productSkuInfos" :key="sku.skuId">
                  <td>{{ getSkuSpec(sku) }}</td>
                  <td>¥{{ sku.price }}</td>
                  <td>{{ sku.amountOnSale }}</td>
                  <td>{{ getSkuWeight(sku.skuId) }}</td>
                  <td>{{ sku.cargoNumber || '-' }}</td>
                  <td>
                    <NButton size="tiny" type="primary" @click="handleBuyNow(sku)">购买</NButton>
                  </td>
                </tr>
              </tbody>
            </NTable>
          </div>

          <div>
            <div class="font-semibold mb-2">物流与包装</div>
            <NDescriptions label-placement="left" :column="3" bordered size="small">
              <NDescriptionsItem label="发货时效">
                {{ getShippingLabel(detailData.productShippingInfo?.shippingTimeGuarantee) }}
              </NDescriptionsItem>
              <NDescriptionsItem label="官方重量">
                {{ detailData.productShippingInfo?.officialWeight || '-' }}
              </NDescriptionsItem>
              <NDescriptionsItem label="AI预估重量">
                {{ detailData.productShippingInfo?.skuShippingDetails?.[0]?.aiWeight || '-' }}
              </NDescriptionsItem>
            </NDescriptions>
          </div>

          <div>
            <div class="font-semibold mb-2">商家评分</div>
            <NDescriptions label-placement="left" :column="3" bordered size="small">
              <NDescriptionsItem label="综合服务">
                {{ detailData.sellerDataInfo?.compositeServiceScore || '-' }}
              </NDescriptionsItem>
              <NDescriptionsItem label="物流体验">
                {{ detailData.sellerDataInfo?.logisticsExperienceScore || '-' }}
              </NDescriptionsItem>
              <NDescriptionsItem label="纠纷投诉">
                {{ detailData.sellerDataInfo?.disputeComplaintScore || '-' }}
              </NDescriptionsItem>
              <NDescriptionsItem label="商品体验">
                {{ detailData.sellerDataInfo?.offerExperienceScore || '-' }}
              </NDescriptionsItem>
              <NDescriptionsItem label="售后体验">
                {{ detailData.sellerDataInfo?.afterSalesExperienceScore || '-' }}
              </NDescriptionsItem>
              <NDescriptionsItem label="咨询体验">
                {{ detailData.sellerDataInfo?.consultingExperienceScore || '-' }}
              </NDescriptionsItem>
            </NDescriptions>
          </div>
        </div>
        <NEmpty v-else-if="!detailLoading" description="暂无数据" />
      </NSpin>
      <template #footer>
        <NButton @click="showDetailParams = false">关闭</NButton>
      </template>
    </NModal>

    <!-- 商品链接解析弹窗 -->
    <NModal
      v-model:show="showLinkModal"
      preset="card"
      title="商品链接解析"
      style="width: 90%; max-width: 600px"
      :bordered="false"
    >
      <div class="flex flex-col gap-3">
        <div class="text-sm text-gray-500 leading-relaxed">
          请输入 1688 商品链接或商品ID，例如：
          <br />
          <span class="text-xs text-gray-400 break-all">
            https://detail.1688.com/offer/1071878515326.html?offerId=1071878515326&hotSaleSkuId=6124123681672
          </span>
        </div>
        <NInput
          v-model:value="linkInput"
          type="textarea"
          placeholder="粘贴商品链接，或直接输入纯数字 offerId"
          :rows="3"
        />
        <div v-if="parsedOfferId" class="text-xs text-green-600">已识别 offerId：{{ parsedOfferId }}</div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="handleCloseLinkModal">取消</NButton>
          <NButton type="primary" :loading="linkParsing" @click="handleParseLink">解析并查看</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
/* 可添加额外样式，但主要使用 unocss */
</style>
