<script setup lang="ts">
import planJson from '@/data/personalPlan.json';

type PersonalPlanMetric = {
  label: string;
  value: string;
  note?: string;
};

type PersonalPlanItem = {
  text: string;
  note?: string;
  tag?: string;
};

type PersonalPlanSection = {
  id: string;
  badge: string;
  title: string;
  description: string;
  items: PersonalPlanItem[];
};

type PersonalPlanData = {
  hero: {
    eyebrow: string;
    date: string;
    title: string;
    subtitle: string;
  };
  metrics: PersonalPlanMetric[];
  sections: PersonalPlanSection[];
  insights?: {
    title: string;
    points: string[];
  };
};

const plan = planJson as PersonalPlanData;
</script>

<template>
  <div class="personal-plan-view">
    <header class="plan-hero">
      <div class="plan-text">
        <p class="plan-eyebrow">{{ plan.hero.eyebrow }}</p>
        <p class="plan-date">{{ plan.hero.date }}</p>
        <h1>{{ plan.hero.title }}</h1>
        <p class="plan-subtitle">{{ plan.hero.subtitle }}</p>
      </div>
      <div class="plan-metrics">
        <div v-for="metric in plan.metrics" :key="metric.label" class="metric-card">
          <span class="metric-label">{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
          <p>{{ metric.note }}</p>
        </div>
      </div>
    </header>

    <section class="todo-sections">
      <article v-for="section in plan.sections" :key="section.id" class="todo-card">
        <div class="todo-card-header">
          <span class="todo-badge">{{ section.badge }}</span>
          <h3>{{ section.title }}</h3>
          <p>{{ section.description }}</p>
        </div>
        <ul class="todo-list">
          <li v-for="item in section.items" :key="item.text" class="todo-item">
            <span class="checkbox" role="checkbox" aria-checked="false">
              <span class="check-icon">✓</span>
            </span>
            <div class="todo-content">
              <p class="todo-text">{{ item.text }}</p>
              <small v-if="item.note">{{ item.note }}</small>
            </div>
            <span v-if="item.tag" class="todo-tag">{{ item.tag }}</span>
          </li>
        </ul>
      </article>
    </section>

    <section v-if="plan.insights" class="insight-panel">
      <h4>{{ plan.insights.title }}</h4>
      <ul>
        <li v-for="point in plan.insights.points" :key="point">{{ point }}</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.personal-plan-view {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.plan-hero {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--panel-border);
}

.plan-text h1 {
  margin: 6px 0 4px;
  font-size: clamp(26px, 4vw, 34px);
}

.plan-text p {
  margin: 0;
}

.plan-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
  color: var(--accent);
}

.plan-date {
  color: var(--text-secondary);
  font-weight: 600;
  margin-top: 4px;
}

.plan-subtitle {
  color: var(--text-secondary);
  margin-top: 12px;
  line-height: 1.6;
}

.plan-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.metric-card {
  border: 1px solid var(--panel-border);
  border-radius: 18px;
  padding: 14px 18px;
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.12), rgba(79, 70, 229, 0.08));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.metric-label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
}

.metric-card strong {
  display: block;
  font-size: 20px;
  margin: 6px 0 4px;
  color: var(--text-primary);
}

.metric-card p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.todo-sections {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 18px;
}

.todo-card {
  border: 1px solid var(--panel-border);
  border-radius: 22px;
  padding: 24px;
  background: var(--panel-bg);
  display: flex;
  flex-direction: column;
  gap: 20px;
  box-shadow: var(--shadow-soft);
}

.todo-card-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.todo-card-header h3 {
  margin: 0;
}

.todo-card-header p {
  margin: 0;
  color: var(--text-secondary);
}

.todo-badge {
  align-self: flex-start;
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--accent);
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(96, 165, 250, 0.4);
}

.todo-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.todo-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 14px;
  align-items: center;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(148, 163, 184, 0.08);
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.checkbox {
  width: 24px;
  height: 24px;
  border-radius: 8px;
  border: 2px solid rgba(148, 163, 184, 0.8);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: transparent;
  transition: all var(--transition-base);
  background: var(--panel-bg);
}

.todo-item:hover .checkbox {
  border-color: var(--accent);
  color: var(--accent);
}

.check-icon {
  font-size: 14px;
  line-height: 1;
}

.todo-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.todo-text {
  margin: 0;
  font-weight: 600;
  color: var(--text-primary);
}

.todo-content small {
  color: var(--text-secondary);
}

.todo-tag {
  padding: 4px 10px;
  background: rgba(34, 197, 94, 0.12);
  color: var(--accent);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.insight-panel {
  border: 1px dashed var(--panel-border);
  border-radius: 18px;
  padding: 20px 24px;
  background: rgba(34, 197, 94, 0.08);
}

.insight-panel h4 {
  margin: 0 0 12px;
}

.insight-panel ul {
  margin: 0;
  padding-left: 18px;
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

@media (max-width: 600px) {
  .todo-card {
    padding: 20px;
  }

  .todo-item {
    grid-template-columns: auto 1fr;
  }

  .todo-tag {
    grid-column: span 2;
    justify-self: start;
  }
}
</style>
