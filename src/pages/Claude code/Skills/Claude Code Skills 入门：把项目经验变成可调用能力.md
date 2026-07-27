> 最近继续学习 Claude Code 工程化时，我发现 `Skills` 是一个很容易被误解的能力。
>
> 很多人会把它理解成“多放几份 Markdown 文档，让 Claude 需要时看看”。但真正用工程视角看，Skill 不是文档仓库，而是把项目经验、团队规范、操作流程封装成可被 Claude 按需调用的能力包。

如果说 `CLAUDE.md` 解决的是“Claude 每次进入项目时应该先知道什么”，`Sub-Agent` 解决的是“复杂任务应该派谁去做”，那 `Skills` 解决的就是：

```txt
Claude 在什么场景下，应该加载哪一套专业知识和操作方法？
```

这篇文章不是单纯介绍 `SKILL.md` 怎么写，而是结合我自己的理解，把 Skills 放回 Claude Code 的工程化体系里看：它解决什么问题、和 Tools / Sub-Agents / Hooks 有什么区别、触发机制怎么工作、`description` 为什么关键，以及项目里到底什么时候应该用 Skill。

## 一、为什么 Claude Code 需要 Skills？

真实项目里，团队知识通常不是“不知道”，而是“太多了”。

比如一个前端项目里可能会有这些规则：

- API 命名规范；
- 组件拆分规范；
- Git commit 规范；
- PR 描述模板；
- 安全审查清单；
- 发布前检查流程；
- 日志分析方法；
- 历史系统的特殊约定。

这些内容如果全部写进 `CLAUDE.md`，Claude 每次对话都会读取。短期看很方便，但项目一复杂就会出现两个问题。

第一，浪费上下文。很多规则当前任务根本用不到，却一直占着 token。

第二，稀释注意力。真正关键的规则可能被一堆无关信息淹没。

所以我现在更愿意这样理解：

> `CLAUDE.md` 放长期、稳定、每次都需要的少量规则；`Skills` 放特定场景才需要的专业知识和操作流程。

也就是说，Skills 不是为了让 Claude 记住更多，而是为了让 Claude **在正确的时候加载正确的知识**。

## 二、Skills 在 Claude Code 体系里的位置

要理解 Skills，最好不要孤立地看，而是把它和 Claude Code 的其他工程组件放在一起比较。

| 组件 | 回答的问题 | 我的理解 |
| --- | --- | --- |
| Tools | 能做什么 | Claude 的手，比如读文件、改代码、跑命令 |
| Skills | 怎么做，什么时候用这套方法 | 专业手册、SOP、领域知识包 |
| Sub-Agents | 谁来做 | 专职员工，带独立上下文和权限 |
| Hooks | 什么时候强制检查 | 流程门禁、质量检查、自动兜底 |
| CLAUDE.md | 每次都应该知道什么 | 项目入职手册和长期规则 |
| MCP Servers | 连接外部什么系统 | 外部工具和数据源 |
| Plugins | 如何打包分发能力 | 可复用的能力集合 |

可以用一个简单模型来理解：

```txt
Tools       = 行动能力，回答“能不能做”
Skills      = 操作知识，回答“应该怎么做”
Sub-Agents  = 执行分工，回答“谁来做”
Hooks       = 流程约束，回答“什么时候检查”
CLAUDE.md   = 长期记忆，回答“这个项目默认规则是什么”
```

这也是 Skills 最核心的位置：它不是工具，也不是子代理，而是介于“知识”和“行动”之间的结构。

它把一份原本需要人主动查阅的文档，变成 Claude 可以自动识别、按需加载、按流程执行的能力。

## 三、Skill 不是普通文档，而是可操作知识

一份 API 设计规范放在 Wiki 上，只是一份被动文档。

它不会主动告诉 Claude：

```txt
什么时候应该读我？
读完以后要怎么做？
输出结果应该长什么样？
哪些工具能用，哪些不能用？
完成后要不要检查？
```

但同样的内容如果封装成 Skill，就变成了可操作知识。

一个完整的 Skill 通常包含这些东西：

- `description`：告诉 Claude 什么场景下应该使用它；
- 正文步骤：告诉 Claude 拿到这份知识后怎么做；
- 输出格式：约束最终结果长什么样；
- `allowed-tools`：限制这个 Skill 能使用哪些工具；
- hooks：在关键步骤自动做检查；
- 辅助文件：模板、示例、脚本、参考资料。

所以，Skill 的价值不是“把 Markdown 放到另一个目录”，而是把文档升级成一套可以被调用的行为模式。

举个例子，如果项目里有一份 API 规范文档，放在普通文档目录里，Claude 只有在你明确引用它时才会看。

但如果它变成一个 `api-conventions` Skill，Claude 在你说“帮我写一个用户接口”时，就可以根据 `description` 判断这是 API 设计场景，然后自动加载这套规范。

这就是 Skills 的关键变化：

> 知识不再只是“存着”，而是可以在任务发生时自动到场。

## 四、Skill 的触发机制：description 才是入口

Claude Code 的 Skills 通常有两种触发方式。

第一种是用户手动触发。

```txt
/review src/auth.ts
/deploy staging
/commit fix login bug
```

这种方式很像以前的 Slash Command。用户明确知道自己要调用哪一个能力。

第二种是 Claude 自动触发。

比如用户没有输入 `/review`，只是说：

```txt
帮我看看这段代码有没有问题。
```

Claude 会读取可用 Skills 的 `description`，通过语义匹配判断当前任务是不是代码审查。如果匹配，就加载对应的 Skill。

这也是为什么 `description` 是 Skill 里最重要的字段。它不是写给人看的摘要，而是写给 Claude 看的触发器。

一个很弱的 `description` 长这样：

```yaml
description: Handles PDFs
```

问题是太模糊。Handles 到底是读取、合并、转换、填表，还是提取表格？Claude 很难判断什么时候该用。

更好的写法应该是：

```yaml
description: Extract text and tables from PDF files, fill forms, and merge documents. Use when working with PDF files, forms, or document extraction tasks.
```

我现在会用一个公式来写 description：

```txt
description = 做什么 + 怎么做 + 什么时候用
```

比如：

```yaml
description: Review code for quality, security, and best practices. Checks for bugs, performance issues, and style violations. Use when the user asks for code review, wants feedback on code changes, or mentions code quality.
```

这段描述明确告诉 Claude 三件事：

```txt
做什么：Review code
检查什么：quality, security, best practices
什么时候用：asks for code review / feedback / code quality
```

如果项目里有多个 Skills，`description` 还要避免互相抢活。

比如这两个就很容易冲突：

```yaml
name: unit-testing
description: Write tests for code

name: integration-testing
description: Write tests for code
```

更好的写法是明确边界：

```yaml
name: unit-testing
description: Write and run unit tests for individual functions or methods in isolation. Use when testing a single function, mocking dependencies, or verifying local behavior.

name: integration-testing
description: Write and run integration tests for multiple components working together. Use when testing API endpoints, database interactions, or end-to-end component behavior.
```

一句话：**description 写得越清楚，Claude 越知道什么时候该用，什么时候不该用。**

## 五、渐进式加载：Skills 为什么省上下文

Skills 的加载方式可以理解成两层。

```txt
第一层：平时只加载所有 Skills 的 description
第二层：匹配成功后，再加载对应 SKILL.md 全文
```

假设项目里有 5 个 Skills，每个完整内容 1000 tokens。

如果全部写进 `CLAUDE.md`，每次对话都要加载大约 5000 tokens。

但如果做成 Skills，Claude 可能只需要先读取每个 Skill 的 `description`，等确定当前任务需要其中一个，再加载那一个 Skill 的完整内容。

这就是“渐进式加载”的价值。

它不是把知识删掉，而是把知识从“常驻上下文”变成“按需加载”。

所以在项目里可以这样分工：

| 内容 | 放哪里 | 原因 |
| --- | --- | --- |
| 技术栈、启动命令、基本目录 | `CLAUDE.md` | 每次都要知道 |
| API 设计规范 | Skill | 写接口或审接口时才需要 |
| 代码审查清单 | Skill | 审查代码时才需要 |
| 部署流程 | 任务型 Skill / Command | 用户明确触发时执行 |
| 提交前检查 | Hooks | 某个事件发生时强制执行 |
| 大量日志分析 | Sub-Agent | 执行噪声大，需要隔离上下文 |

我自己的判断标准是：

> 如果一段内容不是每次都需要，但需要时又很重要，那它就适合做成 Skill。

## 六、SKILL.md 的基本结构

一个 Skill 通常独占一个目录：

```txt
.claude/skills/<skill-name>/
└── SKILL.md
```

`SKILL.md` 一般由两部分组成：

```txt
YAML frontmatter：元数据，决定这个 Skill 怎么被识别和触发
Markdown 正文：完整的知识、流程、示例和约束
```

例如一个 API 规范 Skill 可以这样写：

```yaml
---
name: api-conventions
description: API design patterns and conventions for this project. Covers RESTful URL naming, response format standards, error handling, and authentication requirements. Use when writing or reviewing API endpoints, designing new APIs, or making decisions about request and response formats.
allowed-tools:
  - Read
  - Grep
  - Glob
---

# API Design Conventions

Apply these conventions whenever working with API endpoints.

## URL Naming

- Use plural nouns for resources: `/users`, `/orders`
- Use kebab-case for multi-word resources: `/order-items`
- Use query parameters for filtering: `/orders?status=active`

## Response Format

All API responses should use:

{
  "data": {},
  "error": null,
  "meta": {}
}
```

这里面几个字段最重要。

| 字段 | 作用 | 我的理解 |
| --- | --- | --- |
| `name` | Skill 名称 | 能力标识 |
| `description` | 自动触发依据 | 最关键，决定 Claude 什么时候用 |
| `argument-hint` | 斜杠调用时的参数提示 | 让用户知道怎么传参 |
| `disable-model-invocation` | 禁止 Claude 自动触发 | 适合部署、提交等有副作用动作 |
| `user-invocable` | 是否允许用户手动调用 | 控制 `/skill-name` 是否可见 |
| `allowed-tools` | 限制可用工具 | 最小权限原则 |
| `context` / `agent` | 隔离执行或指定代理 | 复杂任务时控制执行环境 |
| `hooks` | Skill 内部检查 | 在关键动作前后自动校验 |

字段很多，但不要被吓到。初学时真正要抓住两个：

```txt
description：决定什么时候加载
allowed-tools：决定加载后能做什么
```

## 七、参考型 Skill 和任务型 Skill

从工程使用上，我会把 Skills 分成两类：参考型和任务型。

### 1. 参考型 Skill

参考型 Skill 影响的是“怎么做”。

它更像团队规范、领域知识、操作手册。Claude 可以根据语义自动判断什么时候需要它。

比如：

```yaml
---
name: api-conventions
description: API design patterns for this codebase. Use when writing or reviewing API endpoints.
allowed-tools:
  - Read
  - Grep
  - Glob
---
```

适合做参考型 Skill 的内容包括：

- API 设计规范；
- 代码风格规范；
- 安全审查清单；
- 业务术语说明；
- legacy 系统背景；
- 日志分析方法；
- PR review 标准。

参考型 Skill 的重点是：Claude 需要在某些场景自动采用这套知识。

### 2. 任务型 Skill

任务型 Skill 影响的是“做什么”。

它更像一个明确的操作流程，通常由用户手动触发。

比如：

```yaml
---
name: deploy
description: Deploy the application to production.
argument-hint: "[environment]"
disable-model-invocation: true
allowed-tools:
  - Bash(git status:*)
  - Bash(npm test:*)
  - Bash(npm run build:*)
---
```

这里最关键的是：

```yaml
disable-model-invocation: true
```

它表示 Claude 不能根据语义自动调用这个 Skill，只有用户明确输入 `/deploy ...` 才能触发。

为什么要这样？因为部署、提交、发版、迁移、批量改配置这些动作都有副作用。你不希望 Claude 因为“看起来应该部署一下”，就替你执行生产操作。

所以我的判断是：

> 凡是带副作用的 Skill，默认都应该关闭模型自动触发。

## 八、什么时候用 Skill，什么时候不用？

这是我认为最实用的一张判断表。

| 场景 | 推荐机制 | 原因 |
| --- | --- | --- |
| 每次对话都要遵守的长期规则 | `CLAUDE.md` | 常驻记忆 |
| 特定场景才需要的专业知识 | 参考型 Skill | 按需加载 |
| 用户明确触发的固定流程 | 任务型 Skill / Command | 可复用操作 |
| 执行过程日志很多 | Sub-Agent | 隔离上下文 |
| 必须在事件前后检查 | Hooks | 自动门禁 |
| 临时参考某个文件 | `@file` | 一次性上下文 |

我现在会用下面这组问题判断：

```txt
这条规则是不是每次都需要？
是 → 放 CLAUDE.md

是不是只有某类任务才需要？
是 → 做成参考型 Skill

是不是用户明确发令才该执行？
是 → 做成任务型 Skill，并加 disable-model-invocation: true

执行过程是不是会产生大量噪声？
是 → 考虑 Sub-Agent

是不是必须在某个操作前后自动检查？
是 → 用 Hooks
```

这套判断比“哪个功能更高级”重要得多。

Claude Code 工程化真正难的不是会不会写配置，而是知道每类配置应该放到哪里。

## 九、我对 Skills 的最终理解

一开始我也容易把 Skills 看成“高级版文档”。但现在我更愿意把它理解成：

> Skills 是 Claude Code 里的按需能力系统，它把项目经验、领域知识和操作流程，封装成 Claude 可以理解、选择、加载和执行的工程资产。

它的价值主要有三点。

第一，降低上下文成本。不是所有知识都常驻，只在需要时加载。

第二，沉淀团队经验。把散落在文档、口头约定和老员工经验里的知识，变成可复用的能力包。

第三，提高工程可控性。通过 `description`、`allowed-tools`、`disable-model-invocation` 和 hooks，把“什么时候用、怎么用、能做什么、不能做什么”写成结构化规则。

所以，Skills 真正解决的问题不是“Claude 会不会读文档”，而是：

```txt
如何让 Claude 在正确的场景下，自动获得正确的专业能力。
```

这也是我觉得 Skills 值得单独作为一个专题学习的原因。

## 十、总结一下

这篇文章可以总结成几句话。

`CLAUDE.md` 是项目入职手册，适合放每次都需要的长期规则。

`Skills` 是按需加载的能力包，适合放特定场景才需要的专业知识和 SOP。

`description` 是 Skill 的触发器，不是普通摘要，写法要明确“做什么、怎么做、什么时候用”。

参考型 Skill 让 Claude 自动采用某套知识；任务型 Skill 则需要用户明确发令，尤其适合部署、提交、发版这类有副作用的流程。

如果你犹豫一段内容该放 `CLAUDE.md` 还是 Skill，可以先问自己一句：

> 这件事 Claude 是每次都要知道，还是只在某类任务里才需要？

如果答案是后者，大概率应该把它做成 Skill。
