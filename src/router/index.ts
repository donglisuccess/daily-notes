import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';

export const NOTE_ROUTE_PREFIX = '/notes';

const EmptyView = { template: '<div />' };

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: EmptyView
  },
  {
    path: `${NOTE_ROUTE_PREFIX}/:notePath(.*)*`,
    name: 'note',
    component: EmptyView
  }
];

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 };
  }
});

export default router;
