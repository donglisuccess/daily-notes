当我们刚开始编写 Claude Code Skill 时，很容易产生一种直觉：

> 既然这些知识都可能用到，那就全部写进 `SKILL.md`。

比如，一个财务分析 Skill 可能包含：

* 收入增长率公式
* 成本分析方法
* 毛利率和净利率计算
* 行业基准数据
* 报告模板
* Python 计算脚本
* 大量输入输出示例

全部放进一个文件，看起来集中、完整，也方便管理。

但真正运行时，很快就会出现两个问题。

第一，**Token 消耗过大**。

用户可能只是问一句“毛利率怎么算”，Claude 却需要先阅读几千行与成本、现金流、资产负债表、报告生成相关的内容。

第二，**有效信息被噪声淹没**。

Claude 读到的内容越多，不代表完成任务的效果一定越好。当上下文中存在大量无关信息时，模型反而更难抓住真正重要的规则。

解决这个问题的架构，就是：

> 渐进式披露。

---

## 一、什么是渐进式披露

渐进式披露，英文是 Progressive Disclosure。

它的核心思想非常简单：

> 不要一次性把所有知识交给 Claude，而是在任务真正需要时，再逐层加载对应内容。

可以把它理解为去图书馆查资料。

你不会进入图书馆后，把所有书从头到尾读一遍。正常流程应该是：

1. 先看图书目录；
2. 找到相关分类；
3. 选择一本书；
4. 翻到需要的章节；
5. 必要时再查看附录。

Claude Code Skills 也可以采用相同结构。

```text
第一层：description
作用：像图书目录一样，帮助 Claude 判断该不该使用这个 Skill。

第二层：SKILL.md
作用：像书的章节目录，告诉 Claude 任务应该如何执行、需要去哪里找资料。

第三层：reference、templates、scripts 等文件
作用：像附录和专项资料，只在确实需要时加载或执行。
```

这就是 Skills 渐进式披露的三层结构。

---

## 二、为什么不能把所有内容都塞进 SKILL.md

很多人认为，只要上下文窗口足够大，就不需要节省 Token。

这个判断并不严谨。

上下文窗口虽然可以容纳大量信息，但它依然是一种有限资源，而且存在一个非常现实的问题：

> 信息越多，注意力越容易被稀释。

可以把上下文窗口理解成 Claude 的“工作台”。

工作台上只有当前任务需要的几件工具时，Claude 很容易找到它们。

但如果工作台上堆着：

* 几百页接口文档
* 几十个代码示例
* 大量错误处理规则
* 多种报告模板
* 历史案例
* 无关业务背景

Claude 就需要先从大量内容中寻找当前任务真正需要的信息。

因此，Skill 设计追求的不是“知识越多越好”，而是：

> 用最少的 Token，提供当前任务最关键的知识。

这可以称为 Skill 的知识投资回报率：

```text
知识 ROI = 任务完成质量 ÷ Token 投入
```

高质量的 Skill，不是让 Claude 每次阅读最多的内容，而是让正确的内容在正确的时间出现。

---

## 三、渐进式披露的三个关键词

理解渐进式披露，可以抓住三个关键词：

1. 目录
2. 路由
3. 契约

---

## 四、第一个关键词：目录

Skill 的第一层目录，是 frontmatter 中的 `description`。

例如：

```yaml
---
name: financial-analyzing
description: Analyze financial data, calculate financial ratios, and generate reports. Use when the user asks about revenue, costs, profits, margins, ROI, or company financial performance.
---
```

Claude Code 在判断应该使用哪个 Skill 时，不会立即读取所有 Skill 的完整正文，而是先查看它们的名称和描述。

所以，`description` 的作用不是详细说明执行流程，而是回答两个问题：

```text
这个 Skill 能做什么？
用户在什么情况下应该使用它？
```

一个好的 description 应该包含用户可能使用的自然语言关键词。

例如，财务分析 Skill 可以包含：

* revenue
* costs
* profits
* margins
* ROI
* financial analysis

这样，当用户提到收入、成本、利润率时，Claude 才更容易正确匹配这个 Skill。

但 description 也不能无限变长。

因为所有 Skills 的 description 会共同占用上下文预算。description 写得过长、Skill 数量过多，都可能导致描述被截断。

因此：

> description 要足够准确，但不要承担正文的工作。

---

## 五、第二个关键词：路由

当 Skill 被激活后，Claude 才会读取 `SKILL.md`。

但 `SKILL.md` 也不应该写成一本完整的百科全书。它更应该像一个路由器。

例如：

```markdown
## Quick Reference

| 用户需求 | 需要加载的内容 |
|---|---|
| 收入增长、同比、环比、ARPU | `reference/revenue.md` |
| 成本结构、费用分析 | `reference/costs.md` |
| 毛利率、净利率、ROE、ROA | `reference/profitability.md` |
| 生成完整报告 | `templates/analysis-report.md` |
| 执行准确计算 | `scripts/calculate-ratios.py` |
```

当用户问：

> 毛利率怎么计算？

Claude 的加载过程是：

```text
用户问题
   ↓
扫描 description
   ↓
匹配 financial-analyzing
   ↓
加载 SKILL.md
   ↓
通过 Quick Reference 判断属于盈利能力分析
   ↓
加载 reference/profitability.md
   ↓
回答问题
```

它不需要加载：

* 收入分析资料
* 成本分析资料
* 报告模板
* 完整行业数据库
* 所有代码示例

这就是路由的价值。

### 一个好的路由表应该满足什么条件

第一，使用用户可能说出的词作为路由条件。

不要只写：

```text
Financial Module A
```

应该写：

```text
用户询问毛利率、净利率、ROE、ROA 时
```

第二，每个路由条目只负责一个明确方向。

第三，高频需求放在前面。

第四，路由条目过多时继续分层。

假设一个 Skill 已经有 20 个参考文件，就不应该把 20 个文件平铺在一个表格里。应该先按照领域分组，再进入二级索引。

---

## 六、第三个关键词：契约

只把文件路径写进 `SKILL.md`，还不算一个真正清晰的引用。

例如：

```markdown
See `reference/revenue.md` for details.
```

这是一个弱引用。

Claude 只知道存在这个文件，却不知道：

* 什么情况下应该读取；
* 文件中有什么；
* 读取它要解决什么问题。

更好的方式是使用契约式引用：

```markdown
## Revenue Analysis

When the user asks about revenue growth, YoY, QoQ, ARPU, or revenue composition:

→ Load `reference/revenue.md` for calculation formulas, interpretation rules, and abnormal signal checks.
```

一个完整的契约式引用包含三个要素。

### 1. 触发条件

什么时候应该加载。

```text
当用户询问收入增长、同比、环比或 ARPU 时
```

### 2. 文件路径

具体去哪里读取。

```text
reference/revenue.md
```

### 3. 内容预期

加载后可以获得什么。

```text
计算公式、指标解释和异常信号判断规则
```

所以，契约式引用的标准格式可以总结为：

```text
当出现什么任务
→ 加载哪个文件
→ 使用其中什么内容完成什么目标
```

这会明显降低 Claude 的判断成本。

---

## 七、一个合理的 Skill 目录应该长什么样

一个复杂 Skill 可以使用下面的目录结构：

```text
.claude/skills/financial-analyzing/
├── SKILL.md
├── reference/
│   ├── revenue.md
│   ├── costs.md
│   └── profitability.md
├── templates/
│   ├── analysis-report.md
│   └── quarterly-report.md
├── examples/
│   ├── revenue-analysis.md
│   └── full-report.md
├── scripts/
│   └── calculate-ratios.py
└── data/
    └── industry-benchmarks.json
```

每个目录承担不同职责。

### SKILL.md：入口和路由

只放：

* Skill 的身份和目标
* 核心执行流程
* 高频规则
* 资源路由
* 输出要求
* 关键限制

### reference：知识资料

放：

* API 规范
* 公式
* 业务规则
* 行业标准
* 边界条件
* 低频详细说明

### templates：输出模板

放：

* 报告格式
* MR 描述模板
* 审查报告模板
* 技术方案模板
* 错误处理模板

### examples：示例

放：

* 完整输入输出案例
* 正确示例
* 错误示例
* 边缘场景示例

### scripts：确定性逻辑

放：

* 数据计算
* 文件转换
* 批量处理
* 静态检查
* 报告生成
* 可视化生成

### data：静态数据

放：

* JSON 数据
* CSV 数据
* 行业基准
* 配置映射
* 规则列表

这套结构的重要价值是：

> Claude 不再面对一份巨大的长文档，而是面对一套有组织、可导航、可执行的能力系统。

---

## 八、什么应该写进 SKILL.md

可以使用一个简单判断：

> 如果 Claude 每次执行这个 Skill 都必须知道，就放进 SKILL.md。

例如：

* Skill 的职责
* 适用场景
* 基础工作流程
* 必须遵守的限制
* 高频判断规则
* 输出格式概览
* 资源路由表
* 何时加载其他文件

下面这些内容通常不应该全部塞进主文件：

* 几百行 API 规范
* 大量完整代码示例
* 所有错误处理模板
* 低频业务细节
* 历史案例
* 大型静态数据
* 可以通过脚本完成的确定性计算

官方建议把 `SKILL.md` 控制在 500 行以内。

500 行并不是绝对的技术限制，而是一个非常实用的架构提醒：

> 当 SKILL.md 超过 500 行时，你很可能把路由、知识、示例、模板和脚本说明混在了一起。

---

## 九、脚本为什么是渐进式披露的重要组成部分

假设需要计算收入增长率、毛利率、ROA 和 ROE。

如果全部交给 Claude 推理：

```text
1. 读取数据
2. 回忆公式
3. 手动计算
4. 检查除零问题
5. 格式化结果
6. 发现错误后重新计算
```

这会消耗推理 Token，而且计算过程存在出错可能。

如果把公式固化成脚本：

```bash
python scripts/calculate-ratios.py data.json
```

Claude 只需要知道：

```text
什么时候运行这个脚本；
传入什么参数；
脚本会返回什么结果。
```

Claude 不需要在上下文中理解整个脚本实现。

因此，脚本可以理解为：

> 被提前编译好的专家知识。

它特别适合处理：

* 公式固定的计算
* 数据格式转换
* 文件批处理
* 静态检查
* 报表生成
* 可视化生成
* 确定性验证

但下面这些任务不适合完全交给脚本：

* 开放性分析
* 复杂业务判断
* 创意设计
* 需要多轮沟通的决策
* 上下文依赖很强的问题

脚本负责确定性，Claude 负责判断性。

---

## 十、Skills 和 Tools 到底是什么关系

Skills 和 Tools 不是相互替代的关系。

可以把它们理解为：

```text
Skill：告诉 Claude 应该怎么做。
Tool：让 Claude 真正把事情做出来。
```

它们之间存在三层关系。

---

### 第一层：Skills 约束 Tools

Skill 可以通过 `allowed-tools` 控制 Claude 可以使用哪些工具。

例如，代码审查 Skill：

```yaml
allowed-tools:
  - Read
  - Grep
  - Glob
```

没有：

* Write
* Edit
* Bash

这意味着该 Skill 只能读代码，不能直接修改代码。

这不是单纯的权限配置，而是对任务边界的表达：

> 代码审查负责发现问题，不负责擅自改代码。

这符合最小权限原则。

---

### 第二层：Skills 编排 Tools

Skill 可以告诉 Claude 按什么顺序调用工具。

例如：

```text
1. 使用 Glob 查找源码文件；
2. 使用 Grep 查找调用方；
3. 使用 Read 阅读关键代码；
4. 使用 Bash 运行静态分析脚本；
5. 根据结果生成审查报告。
```

如果这一套过程稳定、重复而且确定，还可以将它固化成脚本。

Claude 原来可能需要调用五次 Tool，现在只需要：

```bash
python scripts/analyze.py
```

脚本相当于预编译的 Tool 调用序列。

---

### 第三层：Tools 反哺 Skills

有些实时信息不能预先写死在 Skill 中。

例如：

* 当前 Git 分支
* 本次修改文件
* PR diff
* 最新测试结果
* 当前依赖版本

可以使用命令预先读取这些数据，再注入 Skill 上下文。

例如：

```markdown
## Current Context

- Current branch: !`git branch --show-current`
- Changed files: !`git diff --name-only`
- Diff summary: !`git diff --stat`
```

这样，Claude 激活 Skill 时，拿到的不是一份静态说明，而是已经包含当前项目状态的动态上下文。

三层关系可以总结成：

```text
Skills 约束 Tools
Skills 编排 Tools
Tools 反哺 Skills
```

---

# 思考题答案

## 思考题一：如果 Skill 有 20 个参考文件，应该如何组织

不要在 `SKILL.md` 中直接平铺 20 个文件。

更合理的方式是两级路由。

例如，一个 Sentry 错误修复 Skill 可以这样组织：

```text
.claude/skills/sentry-fix/
├── SKILL.md
├── reference/
│   ├── frontend/
│   │   ├── vue-errors.md
│   │   ├── react-errors.md
│   │   ├── network-errors.md
│   │   └── source-map-errors.md
│   ├── electron/
│   │   ├── main-process.md
│   │   ├── renderer-process.md
│   │   ├── preload.md
│   │   └── native-crash.md
│   ├── git/
│   │   ├── branch-strategy.md
│   │   ├── commit-rules.md
│   │   └── merge-request.md
│   └── quality/
│       ├── build-check.md
│       ├── lint-check.md
│       ├── test-check.md
│       └── risk-assessment.md
└── indexes/
    ├── frontend-index.md
    ├── electron-index.md
    ├── git-index.md
    └── quality-index.md
```

`SKILL.md` 只做一级路由：

```markdown
| 任务类型 | 路由 |
|---|---|
| Vue、React、网络、Source Map 错误 | 加载 `indexes/frontend-index.md` |
| Electron 主进程、渲染进程、崩溃问题 | 加载 `indexes/electron-index.md` |
| 分支、提交、MR 操作 | 加载 `indexes/git-index.md` |
| 构建、Lint、测试和风险检查 | 加载 `indexes/quality-index.md` |
```

然后 `frontend-index.md` 再做二级路由：

```markdown
- Vue 运行时错误 → `reference/frontend/vue-errors.md`
- React 渲染错误 → `reference/frontend/react-errors.md`
- 请求超时或状态码错误 → `reference/frontend/network-errors.md`
- 压缩代码无法定位源码 → `reference/frontend/source-map-errors.md`
```

原则是：

> 参考文件超过 10 个时，不要继续平铺，应增加中间索引层。

---

## 思考题二：哪些内容放主文件，哪些放引用文件

### 应该放在 SKILL.md 中

* Skill 的目标和边界
* 核心执行流程
* 每次任务都要遵守的规则
* 高频知识
* 路由表
* 工具权限
* 输出要求
* 异常情况下的总原则

### 应该放在引用文件中

* 详细 API 规范
* 低频业务规则
* 框架专项知识
* 完整错误码列表
* 大量边缘案例
* 行业基准数据
* 详细故障排查手册

### 应该放在模板中的内容

* MR 描述
* 修复报告
* 代码审查报告
* 测试报告
* 风险评估报告

### 应该放在脚本中的内容

* 固定公式
* 数据处理
* 仓库扫描
* 依赖分析
* 结果验证
* HTML 图表生成

最简单的判断方式是：

```text
每次必须知道 → SKILL.md
特定情况才需要 → reference
只约束输出结构 → templates
固定并可执行的逻辑 → scripts
大量固定数据 → data
完整案例 → examples
```

---

## 思考题三：渐进式披露和子代理隔离上下文有什么相似之处

两者的共同目标都是：

> 限制无关信息进入当前推理过程。

渐进式披露是在一个 Skill 内部控制知识加载。

```text
只加载当前任务需要的参考文件
```

子代理隔离上下文，是把某个专项任务交给独立 Agent。

```text
只给子代理完成当前专项任务需要的上下文
```

它们的相似点包括：

1. 都在减少上下文噪声；
2. 都在保护主上下文窗口；
3. 都强调任务边界；
4. 都让专业知识按需出现；
5. 都希望提高 Token 投入的回报率。

但两者层级不同。

```text
渐进式披露：解决“一个能力包内部如何加载知识”。

子代理隔离：解决“不同执行角色之间如何隔离任务和上下文”。
```

可以组合使用：

```text
主 Agent
  ↓
调用 code-reviewer 子代理
  ↓
code-reviewer Skill 被激活
  ↓
根据问题加载 Vue、Electron 或安全相关参考文件
```

子代理负责角色隔离，渐进式披露负责知识隔离。

---

## 思考题四：重构一个 800 行的 SKILL.md

原文件包含：

* 100 行核心指令
* 200 行 API 规范
* 300 行代码示例
* 200 行错误处理模板

重构后的目录：

```text
.claude/skills/api-integration/
├── SKILL.md
├── reference/
│   └── api-specification.md
├── examples/
│   ├── basic-usage.md
│   ├── authentication.md
│   ├── pagination.md
│   └── advanced-scenarios.md
└── templates/
    ├── validation-error.md
    ├── network-error.md
    ├── authentication-error.md
    └── server-error.md
```

重构后的 `SKILL.md` 保留大约 100～150 行核心内容。

契约式引用如下：

```markdown
## API Specification

When the task requires constructing an API request, validating request fields,
checking response structures, or confirming endpoint behavior:

→ Load `reference/api-specification.md` for endpoint definitions, parameters,
authentication requirements, response schemas, and status codes.
```

```markdown
## Code Examples

When the user requests implementation examples or the task requires selecting
a supported integration pattern:

→ Load the matching file under `examples/`.

- Basic request and response handling
  → `examples/basic-usage.md`

- Token, signature, or credential handling
  → `examples/authentication.md`

- Page number, cursor, or batch retrieval
  → `examples/pagination.md`

- Retry, concurrency, streaming, or complex workflows
  → `examples/advanced-scenarios.md`
```

```markdown
## Error Handling

When an API call fails, first classify the failure and load only the matching template:

- Invalid parameters or response validation failure
  → Load `templates/validation-error.md`

- Timeout, DNS, connection, or retryable request failure
  → Load `templates/network-error.md`

- Missing, expired, or invalid credentials
  → Load `templates/authentication-error.md`

- HTTP 5xx or unexpected server response
  → Load `templates/server-error.md`

Each template contains diagnosis steps, required evidence, recommended handling,
and the expected output format.
```

重构后的效果是：

```text
普通任务：只加载 100～150 行主文件
API 查询：额外加载 API 规范
需要示例：只加载一个对应示例
出现错误：只加载一个错误模板
```

而不是每次加载全部 800 行。

---

## 思考题五：设计一个可视化输出 Skill

这里选择你的项目中很实用的场景：

> 可视化前端项目的 API 调用链。

目录结构：

```text
.claude/skills/api-call-chain-visualizer/
├── SKILL.md
├── reference/
│   └── detection-rules.md
└── scripts/
    └── visualize-api-chain.py
```

`SKILL.md`：

````yaml
---
name: api-call-chain-visualizer
description: Generate an interactive visualization of API call chains in a frontend or Electron project. Use when the user wants to understand where an API is called, wrapped, forwarded, or consumed.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(python:*)
---

# API Call Chain Visualizer

Use this Skill when the user requests an API call-chain analysis or visualization.

## Execution

From the project root, run:

```bash
python ~/.claude/skills/api-call-chain-visualizer/scripts/visualize-api-chain.py .
````

Optional target API:

```bash
python ~/.claude/skills/api-call-chain-visualizer/scripts/visualize-api-chain.py . --keyword "/api/v1/project-runtimes"
```

The script generates:

* `api-call-chain.html`
* `api-call-chain.json`

Open `api-call-chain.html` and summarize the most important call paths.

## Additional Rules

When framework-specific detection is required:

→ Load `reference/detection-rules.md` for Axios, Fetch, Vue, React,
Electron IPC, preload, and main-process detection rules.

````

Claude 最少只需要知道：

```text
什么时候使用这个 Skill；
执行哪条命令；
可选参数是什么；
生成什么文件；
最后需要总结什么。
````

脚本负责最多的逻辑：

* 遍历项目文件
* 识别 Axios、Fetch 请求
* 识别 API 封装函数
* 查找函数调用方
* 分析 import 关系
* 识别 Vue/React 组件入口
* 识别 Electron preload 和 IPC 链路
* 构建调用关系图
* 去重和处理循环依赖
* 生成 JSON
* 生成交互式 HTML
* 提供节点搜索和路径高亮

这正是渐进式披露的极致：

> Claude 只知道运行什么，脚本知道具体怎么做。

---

## 思考题六：用认知经济学分析一个 Skill

以你的 Sentry AI Fix Skill 为例。

横轴是 Token 投入，纵轴是任务完成质量。

```text
任务质量
100% |                         _________
 90% |                    ____/
 80% |               ____/
 70% |          ____/
 60% |      ___/
 50% |   __/
 40% |__/
     +-------------------------------- Token
       A    B       C              D
```

### A 阶段：Token 太少

只有一句：

```text
修复这个 Sentry 错误。
```

缺少：

* Issue 信息
* 源码位置
* 分支规则
* 修复约束
* 验证要求

任务质量很低。

### B 阶段：加入关键知识

增加：

* Sentry Issue 信息
* 原始异常堆栈
* 源码映射结果
* 项目路径
* Git 分支规则
* 修改范围要求
* 基本验证流程

任务质量会快速提高。

这些属于高边际收益知识。

### C 阶段：加入专项知识

根据错误类型按需加载：

* Vue 错误排查
* Electron 主进程错误
* Source Map 规则
* 网络请求错误
* GitLab MR 规范

任务质量继续提高，但增长速度开始下降。

### D 阶段：无差别加入所有资料

继续加入：

* 所有历史事故
* 全部框架文档
* 几百个修复案例
* 不相关项目规范
* 所有构建日志
* 完整 Git 历史

Token 大量增加，但任务质量几乎不再提升，甚至可能下降。

这些属于接近零收益的冗余知识。

### ROI 最大化方案

`SKILL.md` 只保留：

* 修复流程
* 安全边界
* Git 规则
* 输出要求
* 错误类型路由

然后按需加载：

```text
Vue 错误 → reference/vue.md
Electron 错误 → reference/electron.md
Source Map 错误 → reference/source-map.md
网络错误 → reference/network.md
MR 创建 → reference/gitlab-mr.md
```

确定性过程交给脚本：

```text
获取 Issue 数据
准备仓库
创建分支
运行检查
生成报告
提交代码
创建 MR
```

最终结果是：

```text
关键知识优先进入上下文；
专项知识按需加载；
重复逻辑交给脚本；
历史资料不默认加载。
```

---

## 思考题七：设计 Skills × Tools 协作图

仍然以 Sentry AI Fix Skill 为例。

### 1. Skill 应该约束哪些 Tools

```yaml
allowed-tools:
  - Read
  - Grep
  - Glob
  - Edit
  - Bash(git:*)
  - Bash(pnpm:*)
  - Bash(npm:*)
  - Bash(python:*)
```

不应该默认开放任意 Bash。

原因是自动修复任务需要：

* 读取代码
* 搜索调用链
* 修改指定文件
* 执行 Git 操作
* 运行构建或检查脚本

但它通常不需要：

* 删除任意系统目录
* 修改服务器配置
* 管理系统用户
* 执行任意网络下载
* 操作其他项目目录

更严格的方案还应该限制：

* 只能修改当前项目目录；
* 不允许修改 `.git` 内部文件；
* 不允许执行强制推送；
* 不允许直接提交到主分支；
* MR 创建失败时不发送成功通知。

### 2. 适合封装成脚本的确定性逻辑

```text
scripts/
├── fetch-sentry-context.py
├── prepare-repository.sh
├── create-fix-branch.sh
├── run-quality-checks.sh
├── generate-fix-report.py
└── create-merge-request.py
```

这些逻辑规则明确、重复执行，适合成为“预编译知识”。

例如：

```bash
bash scripts/prepare-repository.sh project-id
```

脚本内部负责：

* 检查项目是否存在
* 首次不存在时 clone
* 检查远程地址
* 切换主分支
* 拉取最新代码
* 清理非预期改动
* 安装依赖
* 输出准备结果

Claude 不需要每次重新设计这些操作。

### 3. 适合通过命令预加载的实时数据

```markdown
## Runtime Context

- Current branch: !`git branch --show-current`
- Working tree status: !`git status --short`
- Changed files: !`git diff --name-only`
- Recent commits: !`git log -5 --oneline`
- Node version: !`node -v`
- Package manager version: !`pnpm -v`
```

还可以预加载当前 Sentry 任务信息：

```markdown
- Issue context: !`python scripts/fetch-sentry-context.py "$ISSUE_ID"`
```

这些数据不能写死在 Skill 中，因为它们会随着每次任务变化。

### Skills × Tools 协作图

```text
用户或后台服务
      │
      │ issueId
      ▼
Sentry Fix Skill
      │
      ├── 约束 Tools
      │     ├── Read / Grep / Glob
      │     ├── Edit
      │     └── 受限 Bash
      │
      ├── Tools 反哺上下文
      │     ├── 当前分支
      │     ├── Git 状态
      │     ├── Sentry Issue
      │     └── 修改文件
      │
      ├── 路由专项知识
      │     ├── Vue 错误规则
      │     ├── Electron 错误规则
      │     ├── Source Map 规则
      │     └── GitLab MR 规则
      │
      ├── 调用预编译脚本
      │     ├── 准备项目
      │     ├── 创建分支
      │     ├── 运行检查
      │     ├── 生成报告
      │     └── 创建 MR
      │
      ▼
Claude 分析并修改代码
      │
      ▼
质量检查
      │
      ▼
Commit + Push + MR
      │
      ▼
MR 成功后发送通知
```

这套协作关系中：

```text
Skill 决定规则和边界；
Reference 提供专项知识；
Tool 获取信息并执行动作；
Script 固化确定性流程；
Claude 负责理解、判断和修复。
```

---

## 总结

渐进式披露并不只是一个节省 Token 的技巧。

它真正解决的是一个更大的工程问题：

> 当知识规模越来越大时，如何让 Claude 在正确的时间获得正确的知识。

一个成熟的 Skill 不应该是一篇越来越长的提示词，而应该是一套结构化能力系统：

```text
description 是目录；
SKILL.md 是路由器；
契约式引用规定加载条件；
reference 保存专项知识；
templates 统一输出格式；
scripts 固化确定性逻辑；
Tools 完成真实行动。
```

最终目标不是让 Claude 每次知道所有事情，而是：

> 让 Claude 每次只知道完成当前任务必须知道的事情。
