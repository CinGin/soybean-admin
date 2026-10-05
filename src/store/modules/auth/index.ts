import { computed, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { defineStore } from 'pinia';
import { useLoading } from '@sa/hooks';
import { fetchGetUserInfo, fetchLogin, fetchLogout } from '@/service/api';
import { useRouterPush } from '@/hooks/common/router';
import { localStg } from '@/utils/storage';
import { SetupStoreId } from '@/enum';
import { $t } from '@/locales';
import { useRouteStore } from '../route';
import { useTabStore } from '../tab';
import { clearAuthStorage, getToken } from './shared';

// WebSocket 相关变量
let ws: WebSocket | null = null;

export const useAuthStore = defineStore(SetupStoreId.Auth, () => {
  const route = useRoute();
  const authStore = useAuthStore();
  const routeStore = useRouteStore();
  const tabStore = useTabStore();
  const { toLogin, redirectFromLogin } = useRouterPush(false);
  const { loading: loginLoading, startLoading, endLoading } = useLoading();

  const token = ref('');

  const userInfo: Api.Auth.UserInfo = reactive({
    userId: '',
    userName: '',
    roles: [],
    buttons: []
  });

  /** is super role in static route */
  const isStaticSuper = computed(() => {
    const { VITE_AUTH_ROUTE_MODE, VITE_STATIC_SUPER_ROLE } = import.meta.env;

    return VITE_AUTH_ROUTE_MODE === 'static' && userInfo.roles.includes(VITE_STATIC_SUPER_ROLE);
  });

  /** Is login */
  const isLogin = computed(() => Boolean(token.value));

  /**
   * 建立 WebSocket 连接，用于接收实时顶号通知
   * @param token 当前用户的访问令牌
   */
  function connectWebSocket(accessToken: string) {
    console.log('尝试建立 WebSocket 连接，token:', accessToken);
    console.log('调用 connectWebSocket，当前 ws 状态:', ws ? ws.readyState : 'null', 'token:', accessToken);
    // 如果已有连接且处于打开状态，并且 token 相同，则不重复连接
    if (ws && ws.readyState === WebSocket.OPEN) {
      const currentToken = extractTokenFromUrl(ws.url);
      if (currentToken === accessToken) {
        return;
      }
      // 否则关闭旧连接
      ws.close();
    }

    const baseUrl =
      import.meta.env.VITE_WS_BASE_URL ||
      `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;
    const wsUrl = `${baseUrl}/ws/notification?token=${accessToken}`;
    console.log('WebSocket URL:', wsUrl);

    try {
      ws = new WebSocket(wsUrl);

      ws.addEventListener('open', () => {
        console.log('✅ WebSocket 连接成功');
      });

      ws.addEventListener('message', event => {
        console.log('📩 收到 WebSocket 消息:', event.data);
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'force_logout') {
            window.$message?.warning('您的账号已在其他设备登录，请重新登录');
            disconnectWebSocket();
            resetStore();
          }
        } catch (e) {
          console.error('解析 WebSocket 消息失败', e);
        }
      });

      ws.addEventListener('error', error => {
        console.error('❌ WebSocket 连接错误', error);
      });

      ws.addEventListener('close', event => {
        console.log('🔒 WebSocket 连接关闭，code:', event.code, 'reason:', event.reason);
        ws = null;
      });
    } catch (e) {
      console.error('建立 WebSocket 连接失败', e);
    }
  }
  // 从 URL 中提取 token 的辅助函数
  function extractTokenFromUrl(url: string): string | null {
    const match = url.match(/[?&]token=([^&]+)/);
    return match ? match[1] : null;
  }
  /**
   * 关闭 WebSocket 连接
   */
  function disconnectWebSocket() {
    if (ws) {
      ws.close();
      ws = null;
    }
  }

  /** Reset auth store */
  async function resetStore() {
    recordUserId();

    // 关闭 WebSocket 连接
    disconnectWebSocket();

    clearAuthStorage();

    authStore.$reset();

    if (!route.meta.constant) {
      await toLogin();
    }

    tabStore.cacheTabs();
    routeStore.resetStore();
  }

  /** Record the user ID of the previous login session Used to compare with the current user ID on next login */
  function recordUserId() {
    if (!userInfo.userId) {
      return;
    }

    // Store current user ID locally for next login comparison
    localStg.set('lastLoginUserId', userInfo.userId);
  }

  /**
   * Check if current login user is different from previous login user If different, clear all tabs
   *
   * @returns {boolean} Whether to clear all tabs
   */
  function checkTabClear(): boolean {
    if (!userInfo.userId) {
      return false;
    }

    const lastLoginUserId = localStg.get('lastLoginUserId');

    // Clear all tabs if current user is different from previous user
    if (!lastLoginUserId || lastLoginUserId !== userInfo.userId) {
      localStg.remove('globalTabs');
      tabStore.clearTabs();

      localStg.remove('lastLoginUserId');
      return true;
    }

    localStg.remove('lastLoginUserId');
    return false;
  }

  /**
   * Login
   *
   * @param userName User name
   * @param password Password
   * @param [redirect=true] Whether to redirect after login. Default is `true`
   */
  async function login(userName: string, password: string, redirect = true) {
    startLoading();

    const { data: loginToken, error } = await fetchLogin(userName, password);

    if (!error) {
      const pass = await loginByToken(loginToken);

      if (pass) {
        // Check if the tab needs to be cleared
        const isClear = checkTabClear();
        let needRedirect = redirect;

        if (isClear) {
          // If the tab needs to be cleared,it means we don't need to redirect.
          needRedirect = false;
        }
        await redirectFromLogin(needRedirect);

        window.$notification?.success({
          title: $t('page.login.common.loginSuccess'),
          content: $t('page.login.common.welcomeBack', { userName: userInfo.userName }),
          duration: 4500
        });
      }
    } else {
      resetStore();
    }

    endLoading();
  }

  async function loginByToken(loginToken: Api.Auth.LoginToken) {
    // 1. stored in the localStorage, the later requests need it in headers
    localStg.set('token', loginToken.token);
    localStg.set('refreshToken', loginToken.refreshToken);

    // 2. get user info
    const pass = await getUserInfo();

    if (pass) {
      token.value = loginToken.token;

      // 登录成功后建立 WebSocket 连接（用于实时顶号）
      connectWebSocket(loginToken.token);

      return true;
    }

    return false;
  }

  async function getUserInfo() {
    const { data: info, error } = await fetchGetUserInfo();

    if (!error) {
      // update store
      Object.assign(userInfo, info);

      return true;
    }

    return false;
  }

  async function initUserInfo() {
    const maybeToken = getToken();
    if (maybeToken) {
      token.value = maybeToken;
      const pass = await getUserInfo();
      if (!pass) {
        resetStore();
      } else {
        // 只有在连接不存在时才建立连接
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          connectWebSocket(maybeToken);
        }
      }
    }
  }

  /** Logout and call backend */
  async function logout() {
    // 调用后端退出接口（不阻塞后续操作）
    try {
      await fetchLogout();
    } catch (error) {
      console.warn('Logout API call failed, continuing to clear local state:', error);
    }
    // 重置本地状态
    await resetStore();
  }

  return {
    token,
    userInfo,
    isStaticSuper,
    isLogin,
    loginLoading,
    resetStore,
    login,
    initUserInfo,
    logout
  };
});
