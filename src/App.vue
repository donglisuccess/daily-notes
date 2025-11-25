<script setup lang="ts">
import { ElDrawer } from 'element-plus';
import 'element-plus/es/components/drawer/style/css';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import AppHeader from './components/AppHeader.vue';
import ContentViewer from './components/ContentViewer.vue';
import PersonalPlanView from './components/PersonalPlanView.vue';
import SidebarTree from './components/SidebarTree.vue';
import TocSidebar from './components/TocSidebar.vue';
import { useNotes } from './composables/useNotes';
import { useTheme } from './composables/useTheme';
import { NOTE_ROUTE_PREFIX } from './router';
import type { LoadedNote, OutlineHeading } from './types/note';

type PersonalLoginForm = {
  username: string;
  password: string;
};

const notes = useNotes();
const route = useRoute();
const router = useRouter();
const { theme, toggleTheme } = useTheme();

const currentNote = ref<LoadedNote | null>(null);
const headings = ref<OutlineHeading[]>([]);
const activeHeading = ref<string | null>(null);
const isMobileNavOpen = ref(false);
const isPersonalMode = ref(false);
const isLoginModalOpen = ref(false);
const loginForm = ref<PersonalLoginForm>({
  username: '',
  password: ''
});
const loginError = ref('');
const currentPath = computed(() => (route.path.startsWith(NOTE_ROUTE_PREFIX) ? route.path : ''));
let loadToken = 0;

watch(
  () => currentPath.value,
  async (value) => {
    if (!value) {
      currentNote.value = null;
      notes.rememberRoute('');
      return;
    }

    if (!notes.isValidRoute(value)) {
      router.replace('/');
      return;
    }

    const token = ++loadToken;
    const loaded = await notes.loadNote(value);
    if (token !== loadToken) {
      return;
    }
    if (!loaded) {
      router.replace('/');
      return;
    }
    currentNote.value = loaded;
    notes.rememberRoute(value);
  },
  { immediate: true }
);

onMounted(() => {
  if (route.path === '/') {
    const saved = notes.getSavedRoute();
    if (saved) {
      router.replace(saved);
    }
  }
});

const handleHeadingsUpdate = (value: OutlineHeading[]) => {
  headings.value = value;
};

const handleActiveHeading = (value: string | null) => {
  activeHeading.value = value;
};

const handleNavigate = (id: string) => {
  if (typeof document === 'undefined') return;
  const target = document.getElementById(id);
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const handleOpenMobileNav = () => {
  isMobileNavOpen.value = true;
};

const handleCloseMobileNav = () => {
  isMobileNavOpen.value = false;
};

const handleSelectNote = (path: string) => {
  if (!path) {
    router.push('/');
  } else {
    router.push(path);
  }
  handleCloseMobileNav();
};

const handleNavigateHome = () => {
  router.push('/');
  handleCloseMobileNav();
};

const handleEnterPersonalMode = () => {
  loginForm.value = { username: '', password: '' };
  loginError.value = '';
  isLoginModalOpen.value = true;
  handleCloseMobileNav();
};

const handleCloseLoginModal = () => {
  isLoginModalOpen.value = false;
  loginError.value = '';
};

const handleSubmitPersonalLogin = () => {
  if (
    loginForm.value.username === 'dongli' &&
    loginForm.value.password === 'dlwwj011022@'
  ) {
    isPersonalMode.value = true;
    isLoginModalOpen.value = false;
    loginError.value = '';
    return;
  }
  loginError.value = '账号或密码错误，请重试';
};

const handleExitPersonalMode = () => {
  isPersonalMode.value = false;
};
</script>

<template>
  <div class="app-shell">
    <AppHeader
      :theme="theme"
      :is-personal-mode="isPersonalMode"
      @toggle-theme="toggleTheme"
      @toggle-menu="handleOpenMobileNav"
      @navigate-home="handleNavigateHome"
      @enter-personal-mode="handleEnterPersonalMode"
      @exit-personal-mode="handleExitPersonalMode"
    />

    <div v-if="isPersonalMode" class="personal-mode-container">
      <section class="panel personal-mode-panel">
        <PersonalPlanView />
      </section>
    </div>

    <template v-else>
      <div class="layout">
        <section class="sidebar-panel panel">
          <div class="sidebar-scroll">
            <SidebarTree
              :data="notes.treeData"
              :current-path="currentPath"
              @select="handleSelectNote"
            />
          </div>
        </section>

        <ContentViewer
          :note="currentNote"
          @update:headings="handleHeadingsUpdate"
          @active-heading-change="handleActiveHeading"
        />

        <TocSidebar :headings="headings" :active-id="activeHeading" @navigate="handleNavigate" />
      </div>

      <ElDrawer
        v-model="isMobileNavOpen"
        direction="ltr"
        size="78%"
        :with-header="false"
        custom-class="mobile-nav-drawer"
      >
        <SidebarTree
          :data="notes.treeData"
          :current-path="currentPath"
          @select="handleSelectNote"
        />
      </ElDrawer>
    </template>

    <div
      v-if="isLoginModalOpen"
      class="personal-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="个人登录对话框"
    >
      <form class="personal-modal" @submit.prevent="handleSubmitPersonalLogin">
        <header class="personal-modal-header">
          <div>
            <p class="personal-modal-eyebrow">个人模式</p>
            <h3>个人登录</h3>
          </div>
          <button class="plain-btn" type="button" aria-label="关闭" @click="handleCloseLoginModal">
            &times;
          </button>
        </header>
        <p class="personal-modal-description">
          请输入您的用户名和密码以进入个人模式。该模式用于访问私人计划视图，数据仅保存在本地。
        </p>
        <label class="personal-field">
          <span>用户名</span>
          <input
            v-model="loginForm.username"
            type="text"
            autocomplete="username"
            placeholder="请输入用户名"
            required
          />
        </label>
        <label class="personal-field">
          <span>密码</span>
          <input
            v-model="loginForm.password"
            type="password"
            autocomplete="current-password"
            placeholder="请输入密码"
            required
          />
        </label>
        <p v-if="loginError" class="personal-modal-error">{{ loginError }}</p>
        <div class="personal-modal-actions">
          <button class="ghost-btn" type="button" @click="handleCloseLoginModal">取消</button>
          <button class="primary-btn" type="submit">登录</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.personal-mode-container {
  flex: 1;
  padding: 20px clamp(16px, 6vw, 48px) 32px;
  width: 100%;
  box-sizing: border-box;
}

.personal-mode-panel {
  min-height: calc(100vh - var(--header-height) - 52px);
}

.personal-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 50;
}

.personal-modal {
  width: min(420px, 100%);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.08)),
    var(--panel-bg);
  border-radius: 22px;
  border: 1px solid rgba(99, 102, 241, 0.25);
  padding: 32px;
  box-shadow: 0 30px 80px rgba(15, 23, 42, 0.55);
  display: flex;
  flex-direction: column;
  gap: 18px;
  backdrop-filter: blur(8px);
}

.personal-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.personal-modal-header h3 {
  margin: 6px 0 0;
  font-size: 26px;
  color: var(--text-primary);
}

.personal-modal-eyebrow {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(99, 102, 241, 0.9);
}

.personal-modal-description {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.plain-btn {
  border: none;
  background: transparent;
  font-size: 18px;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 6px;
  border-radius: 10px;
  transition: color var(--transition-base), background var(--transition-base);
}

.plain-btn:hover {
  color: var(--text-primary);
  background: rgba(148, 163, 184, 0.12);
}

.personal-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
  color: var(--text-secondary);
}

.personal-field input {
  border-radius: 12px;
  border: 1px solid var(--panel-border);
  padding: 12px 14px;
  background: var(--app-bg);
  color: var(--text-primary);
  font-size: 16px;
}

.personal-field input:focus {
  outline: 2px solid var(--accent);
  border-color: transparent;
}

.personal-modal-error {
  margin: -4px 0 0;
  color: #ef4444;
  font-size: 13px;
}

.personal-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
}

.ghost-btn,
.primary-btn {
  border-radius: 999px;
  padding: 10px 22px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: transform var(--transition-base), filter var(--transition-base),
    background var(--transition-base);
}

.ghost-btn {
  background: rgba(148, 163, 184, 0.12);
  border-color: transparent;
  color: var(--text-primary);
}

.ghost-btn:hover {
  background: rgba(148, 163, 184, 0.2);
}

.primary-btn {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #ffffff;
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.35);
}

.primary-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.05);
}

@media (max-width: 600px) {
  .personal-mode-panel {
    min-height: auto;
  }

  .personal-mode-container {
    padding: 16px;
  }
}
</style>
