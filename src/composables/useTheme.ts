import { onMounted, ref, watch } from 'vue';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'daily-notes-theme';

export function useTheme() {
  const theme = ref<ThemeMode>('light');

  const setTheme = (value: ThemeMode) => {
    theme.value = value;
  };

  const toggleTheme = () => {
    if (typeof document === 'undefined') {
      theme.value = theme.value === 'dark' ? 'light' : 'dark';
      return;
    }

    const targetTheme: ThemeMode = theme.value === 'dark' ? 'light' : 'dark';

    // Create transition overlay that expands from top-right corner
    const overlay = document.createElement('div');
    overlay.className = 'theme-transition-overlay';
    overlay.style.backgroundColor = targetTheme === 'dark' ? '#26221d' : '#f7f3ea';
    document.body.appendChild(overlay);

    // Switch the actual theme halfway through the animation
    const switchTimer = setTimeout(() => {
      theme.value = targetTheme;
    }, 220);

    // Clean up overlay after animation completes (550ms total)
    const cleanupTimer = setTimeout(() => {
      overlay.remove();
    }, 600);

    // Ensure cleanup if animation ends early (e.g. tab hidden)
    overlay.addEventListener('animationend', () => {
      clearTimeout(switchTimer);
      clearTimeout(cleanupTimer);
      overlay.remove();
    });
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
