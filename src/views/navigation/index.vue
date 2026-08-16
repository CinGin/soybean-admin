<script setup lang="ts">
import { ref } from 'vue';
import { useMessage } from 'naive-ui';
import { Icon } from '@iconify/vue';

interface EnvItem {
  name: string;
  url: string;
  username?: string;
  password?: string;
  remark?: string;
}

const showPassword = ref(false);
// 使用 Naive UI 的 useMessage 来显示提示
const message = useMessage();

// 环境数据（与之前保持一致）
const envList = ref<EnvItem[]>([
  {
    name: 'k3s 集群管理',
    url: 'https://192.168.71.105.nip.io/',
    username: 'admin',
    password: 'Admin@123456'
  },
  {
    name: 'Longhorn 管理界面',
    url: 'https://192.168.71.105.nip.io/k8s/clusters/local/api/v1/namespaces/longhorn-system/services/http:longhorn-frontend:80/proxy/'
  },
  {
    name: 'Harbor私有镜像仓库',
    url: 'https://192.168.71.100/',
    username: 'admin',
    password: 'Harbor12345'
  },
  {
    name: 'Airflow',
    url: 'http://192.168.71.105:30080/',
    username: 'admin',
    password: 'admin',
    remark: '默认账号 airflow/airflow'
  },
  {
    name: 'DolphinScheduler',
    url: 'http://192.168.71.105:30090/dolphinscheduler/ui/login',
    username: 'admin',
    password: 'dolphinscheduler123',
    remark: 'k3s_solphinscheduler'
  },
  {
    name: 'Spark 日志服务',
    url: 'http://192.168.71.105:30095/'
  },
  {
    name: 'Flink 日志服务',
    url: 'http://192.168.71.105:30096/'
  },
  {
    name: 'Redpanda Kafka 管理工具',
    url: 'http://192.168.71.206:8088/'
  },
  {
    name: 'Kafka UI',
    url: 'http://192.168.71.205:38080/'
  },
  {
    name: 'Postgres CDC 工具',
    url: 'http://192.168.71.105:30100/',
    username: 'admin@hns.com',
    password: 'admin123'
  },
  {
    name: 'Valkey',
    url: 'http://192.168.71.105:30379/'
  }
]);

// 复制文本到剪贴板
const copyText = (text: string) => {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      message.success('已复制到剪贴板');
    })
    .catch(() => {
      message.error('复制失败，请手动复制');
    });
};
</script>

<template>
  <div class="p-5 min-h-screen bg-gray-100">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-gray-800 mb-2">🌐 集群环境导航</h1>
      <p class="text-gray-500 text-base">快速访问各环境管理界面</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <NCard
        v-for="(item, index) in envList"
        :key="index"
        class="rounded-3xl transition-transform duration-200 hover:translate-y--1"
        hoverable
      >
        <template #header>
          <div class="flex justify-between items-center">
            <span class="font-semibold text-base text-gray-800">{{ item.name }}</span>
            <NTag v-if="item.remark" size="small" type="info">
              {{ item.remark }}
            </NTag>
          </div>
        </template>

        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-1 break-all">
            <NA :href="item.url" target="_blank" rel="noopener noreferrer" class="flex-1 text-sm">
              {{ item.url }}
            </NA>
            <NButton size="small" quaternary title="复制链接" @click="copyText(item.url)">
              <Icon icon="mdi:content-copy" />
            </NButton>
          </div>

          <div v-if="item.username || item.password" class="bg-gray-50 p-2 rounded-md flex flex-col gap-1">
            <div class="flex items-center gap-1.5 text-sm">
              <span class="text-gray-600 w-12 flex-shrink-0">账号：</span>
              <span>{{ item.username || '-' }}</span>
              <NButton v-if="item.username" size="small" quaternary title="复制账号" @click="copyText(item.username)">
                <Icon icon="mdi:content-copy" />
              </NButton>
            </div>
            <div class="flex items-center gap-1.5 text-sm">
              <span class="text-gray-600 w-12 flex-shrink-0">密码：</span>
              <span>{{ showPassword ? item.password : '••••••••' }}</span>
              <NButton v-if="item.password" size="small" quaternary title="复制密码" @click="copyText(item.password)">
                <Icon icon="mdi:content-copy" />
              </NButton>
            </div>
          </div>
          <div v-else class="text-gray-400 text-sm italic">无需认证</div>
        </div>
      </NCard>
    </div>

    <div class="mt-8 text-center">
      <NSwitch v-model:value="showPassword">
        <template #checked>显示密码</template>
        <template #unchecked>隐藏密码</template>
      </NSwitch>
    </div>
  </div>
</template>
