import { onMounted, ref, watch } from 'vue';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'daily-notes-theme';

export function useTheme() {
  const theme = ref<ThemeMode>('light');

  const setTheme = (value: ThemeMode) => {
    theme.value = value;
  };

  const toggleTheme = () => {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
  };

  onMounted(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const saved = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (saved === 'light' || saved === 'dark') {
      theme.value = saved;
    } else if (window.matchMedia?.('(prefers-color-scheme: light)').matches) {
      theme.value = 'light';
    }
  });

  watch(
    theme,
    (value) => {
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', value);
      }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, value);
      }
    },
    { immediate: true }
  );

  return {
    theme,
    setTheme,
    toggleTheme
  };
}
