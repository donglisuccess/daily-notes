import { createApp } from 'vue';
import 'element-plus/theme-chalk/base.css';
import 'highlight.js/styles/github-dark-dimmed.css';
import './styles/base.css';
import './styles/theme.css';

import App from './App.vue';
import router from './router';

document.documentElement.setAttribute('data-theme', 'dark');

createApp(App).use(router).mount('#app');
