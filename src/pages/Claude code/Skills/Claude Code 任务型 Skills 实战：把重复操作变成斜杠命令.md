> 学 `Skills` 时，很容易先记住目录、字段、配置格式，却忽略它真正解决的问题。
>
> 任务型 Skill 的价值不是“多写一个 Markdown 文件”，而是把那些反复对 Claude 说的固定流程，变成一个可以复用、可以传参、可以限权、可以加安全网的斜杠命令。

比如日常提交代码时，我们经常会反复说：

```txt
先看一下 git 状态，再看看 diff。
如果没问题就提交，commit message 用 fix login bug。
提交完告诉我改了几个文件。
```

如果这类话术每天都出现，它就不应该继续停留在聊天里。更好的做法是把它沉淀成：

```txt
/commit fix login bug
```

这就是任务型 Skill 的核心：**把重复对话压缩成明确指令，把临时口头流程变成工程化入口。**

## 一、任务型 Skill 解决的是“发令”问题

参考型 Skill 更像一份专业说明书：Claude 判断当前任务需要它时，自动加载里面的规范、知识和方法。

任务型 Skill 则更像一条命令：用户明确输入 `/name`，Claude 才开始执行对应流程。

这两者最关键的差异不是目录长什么样，而是**触发权在谁手里**。

| 类型 | 谁来触发 | 适合内容 | 风险边界 |
| --- | --- | --- | --- |
| 参考型 Skill | Claude 根据语义判断 | API 规范、审查清单、领域知识 | 主要影响回答方式 |
| 任务型 Skill | 用户输入斜杠命令 | 提交、部署、创建 PR、运行测试 | 可能真实改变项目状态 |

所以任务型 Skill 通常要加上：

```yaml
disable-model-invocation: true
```

这句配置的意思可以简单理解为：

```txt
Claude 可以理解这个命令，但不能自作主张触发它。
```

这对有副作用的操作尤其重要。提交代码、部署应用、推送分支、批量修改文件，都不应该只因为模型“觉得现在合适”就自动执行。任务型 Skill 的精神就是四个字：令行禁止。

## 二、Commands 和 Skills 现在要放在一起理解

早期 Claude Code 里，斜杠命令和 Skills 是两套东西。现在更适合把它们理解成同一个能力体系里的两种写法：`Commands` 是更轻量的命令入口，`Skills` 是更完整的能力包。

| 维度 | `.claude/commands/` | `.claude/skills/` |
| --- | --- | --- |
| 文件结构 | 一个 `.md` 文件就是一个命令 | 一个目录承载一个 Skill，主文件是 `SKILL.md` |
| 典型入口 | `/git:status`、`/log` | `/commit`、`/review`、`/pr-create` |
| 辅助资源 | 不适合放复杂资源 | 可以放脚本、模板、示例、引用文件 |
| 配置能力 | 适合简单 prompt | 支持更完整的 frontmatter |
| 新增建议 | 兼容旧项目 | 新命令优先选它 |

如果项目里同时存在同名命令和同名 Skill，应该按 Skill 的版本理解和维护。因为 Skill 目录能承载更多上下文，也更适合团队长期演进。

我自己的使用建议是：

| 场景 | 推荐目录 |
| --- | --- |
| 只是快速查询，比如 `/git:status` | `.claude/commands/` 可以接受 |
| 有明确步骤、权限、输出格式 | `.claude/skills/<name>/SKILL.md` |
| 需要模板、脚本、参考文件 | `.claude/skills/<name>/` |
| 未来要给团队复用 | `.claude/skills/` |

一句话：**新写任务型命令，优先按 Skill 来设计。**

## 三、任务型 Skill 的最小骨架

一个任务型 Skill 至少要回答四个问题：

```txt
这个命令叫什么？
用户怎么传参？
Claude 能用哪些工具？
执行后应该交付什么结果？
```

可以用下面这个提交命令做最小骨架：

```yaml
---
name: commit
description: Create a git commit from current workspace changes.
argument-hint: [commit message]
disable-model-invocation: true
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*)
model: haiku
---

Create one git commit for the current workspace changes.

Commit message from user:
$ARGUMENTS

Steps:

1. Run `git status` and confirm there are changes.
2. Review the staged diff; if nothing is staged, stage the relevant changes.
3. Use the provided message when it exists.
4. If no message is provided, generate a concise conventional commit message.
5. After committing, report the commit message and changed file count.
```

这个例子里，最值得注意的不是步骤，而是边界：

| 配置 | 作用 |
| --- | --- |
| `disable-model-invocation` | 只有用户输入 `/commit` 才能触发 |
| `argument-hint` | 告诉用户这个命令期待什么参数 |
| `$ARGUMENTS` | 接收用户在命令后输入的整段内容 |
| `allowed-tools` | 只给它 git 相关权限 |
| `model` | 简单任务用更轻量的模型，提高响应速度 |

任务型 Skill 写得好不好，先看边界有没有写清楚。Prompt 可以慢慢优化，但触发、参数、权限这些边界一开始就要立住。

## 四、参数传递：把用户输入变成流程变量

斜杠命令真正好用，是因为它可以带参数。

最常见的是 `$ARGUMENTS`，它会接收命令后面的所有内容：

```txt
/commit fix: handle empty login token
```

在 Skill 里：

```md
Use this commit message:
$ARGUMENTS
```

Claude 收到的就是完整提交说明。

如果参数天然有位置关系，也可以用 `$1`、`$2` 这类位置参数：

```txt
/pr-create "Add auth module" "Implements JWT login and refresh flow"
```

对应 Skill 可以这样读取：

```md
PR title: $1
PR description: $2
```

这里有一个实用判断：

| 参数形态 | 推荐写法 | 例子 |
| --- | --- | --- |
| 一整段自由文本 | `$ARGUMENTS` | commit message、审查目标说明 |
| 固定位置的多个值 | `$1`、`$2` | PR 标题和描述、源路径和目标路径 |
| 命令可不带参数 | 在正文里写清 fallback | 没有 commit message 时自动生成 |

参数不是越灵活越好。团队命令最好让 `argument-hint` 写得具体一点，比如：

```yaml
argument-hint: [commit message]
argument-hint: [environment]
argument-hint: [source file] [target directory]
```

不要写成：

```yaml
argument-hint: [args]
```

因为 `[args]` 对使用者没有任何帮助，也会让命令长期变成“靠记忆使用”的隐性规则。

## 五、动态上下文注入：让 Claude 一开始就拿到关键信息

任务型命令常常需要当前项目状态。

比如创建 PR 时，Claude 需要知道：

- 当前分支是什么；
- 相比主分支多了哪些提交；
- 改动了哪些文件；
- diff 大概长什么样。

当然，Claude 可以启动后再调用工具慢慢查。但如果每次 `/pr-create` 都要先探索一轮，就会浪费时间和上下文。

`!command` 的价值就在这里：它像 Skill 的预处理器，会在 Skill 正文发给模型之前先执行命令，并把输出结果填回 Prompt。

```mermaid
flowchart LR
  A[用户输入 /pr-create] --> B[读取 SKILL.md]
  B --> C[替换参数]
  C --> D[执行动态命令]
  D --> E[把输出注入 Prompt]
  E --> F[Claude 拿到完整上下文后执行任务]
```

例如：

```md
## Current Git Context

Branch:
!`git branch --show-current`

Recent commits:
!`git log --oneline -5 2>/dev/null || echo "No recent commits"`

Changed files:
!`git diff --name-status origin/main...HEAD 2>/dev/null || git diff --name-status`
```

这样 Claude 一开始看到的就不是抽象要求，而是已经带有运行时上下文的完整任务说明。

动态注入的优势可以压成四点：

| 维度 | 不用 `!command` | 使用 `!command` |
| --- | --- | --- |
| 启动上下文 | 需要 Claude 自己探索 | 关键状态已预注入 |
| 首轮工具调用 | 多次查询 | 通常更少 |
| 响应速度 | 慢一些 | 更快 |
| 结果一致性 | 依赖模型是否记得查 | 每次固定注入同类信息 |

不过这里也有一个安全重点：**参数会先替换，再执行动态命令。**

如果把用户输入直接拼进 shell 命令，就必须严格限制 `allowed-tools`，并尽量避免高风险命令。动态注入是提速器，不是绕过权限边界的后门。

## 六、Hooks：给有副作用的命令加安全网

任务型 Skill 经常会真实改变项目状态，所以它需要安全网。

这里说的“副作用”，不是日常语境里的负面反应，而是工程里的 side effect：命令执行后，外部世界发生了变化。

比如：

- `git commit` 会改变仓库历史；
- `git push` 会把代码发到远端；
- `npm run build` 会生成构建产物；
- `ssh deploy` 可能影响线上环境；
- `Edit` / `Write` 会修改文件。

Hooks 就适合放在这些动作前后做自动检查。

一个 Skill 内的 Hooks 可以理解成三层结构：

```txt
事件：什么时候触发
匹配器：匹配哪类工具或操作
命令列表：命中后执行哪些检查或处理
```

例如部署命令里，可以在所有 Bash 调用前记录审计日志，在文件修改后自动格式化：

```yaml
---
name: deploy-staging
description: Deploy the current branch to staging.
argument-hint: [environment]
disable-model-invocation: true
allowed-tools: Bash(git:*), Bash(npm:*), Bash(ssh:*)
hooks:
  PreToolUse:
    - matcher: Bash
      hooks:
        - type: command
          command: echo "$TOOL_INPUT" >> .claude/deploy-audit.log
  PostToolUse:
    - matcher: Edit
      hooks:
        - type: command
          command: npx prettier --write "$FILE_PATH"
---

Deploy the project to the requested staging environment.
```

常见搭配可以这样记：

| Hook 事件 | 匹配对象 | 适合做什么 |
| --- | --- | --- |
| `PreToolUse` | `Bash` | 记录高风险命令、做前置检查 |
| `PostToolUse` | `Edit` | 自动格式化刚修改的文件 |
| `PostToolUse` | `Write` | 校验生成文件是否符合规范 |
| `STOP` | 整个任务结束 | 发通知、写任务完成摘要 |

Skill Hooks 和全局 Hooks 的边界也要分清：

| 维度 | Skill Hooks | 全局 Hooks |
| --- | --- | --- |
| 生效范围 | 当前 Skill 执行期间 | 所有对话和任务 |
| 配置位置 | `SKILL.md` frontmatter | `.claude/settings.json` |
| 是否随 Skill 分发 | 可以一起进入仓库 | 需要单独维护 |
| 适合场景 | 某个命令专属检查 | 团队统一安全策略 |

我的理解是：**Skill Hooks 管局部流程，全局 Hooks 管组织底线。**

## 七、权限设计：任务越具体，权限越应该窄

任务型 Skill 最容易出问题的地方，不是 prompt 写得不够聪明，而是权限给得太大。

比如一个 `/commit` 命令不需要 `ssh`，一个 `/review` 命令不应该有 `Edit`，一个 `/test` 命令也没必要拿到所有 Bash 权限。

可以按任务类型做权限收敛：

| Skill 类型 | 推荐权限范围 |
| --- | --- |
| Git 提交 | `Bash(git status:*)`、`Bash(git diff:*)`、`Bash(git add:*)`、`Bash(git commit:*)` |
| 代码审查 | `Read`、`Grep`、`Glob`，必要时加 `Bash(git diff:*)` |
| 创建 PR | `Bash(git:*)`、`Bash(gh:*)` 或团队指定的 PR 工具 |
| 运行测试 | `Bash(npm test:*)`、`Bash(pnpm test:*)`、`Bash(pytest:*)` |
| 部署发布 | `Bash(git:*)`、`Bash(npm:*)`、`Bash(ssh:*)`，并配 Hooks 审计 |

最应该避免的是：

```yaml
allowed-tools: Bash(*)
```

这等于把命令边界交给模型自由发挥。任务型 Skill 既然是“命令”，就应该像命令一样有明确权限，而不是拿一张无限通行证。

## 八、设计任务型 Skill 的七个问题

真正写 Skill 前，可以先按这七个问题过一遍。

```txt
1. 这个命令要完成什么动作？
2. 它是否只能由用户手动触发？
3. 它需要哪些最小工具权限？
4. 启动时要不要预注入上下文？
5. 执行前后要不要 Hooks 做兜底？
6. 输出会不会很大，需要隔离上下文？
7. 任务复杂度适合哪个模型？
```

对应到设计原则，就是下面几条。

第一，一个命令只做一件事。

```txt
推荐：/commit、/review、/pr-create
不推荐：/git-all-in-one
```

第二，命名要让人不用猜。

```txt
推荐：/test:unit、/deploy:staging、/pr-create
不推荐：/do、/x、/helper
```

第三，错误路径要写清楚。

比如 `/commit` 至少要说明：

- 如果不是 git 仓库，停止并说明原因；
- 如果没有文件变化，告诉用户无需提交；
- 如果提交失败，保留错误输出，不要假装成功；
- 如果有未跟踪文件，说明是否已经纳入提交。

第四，输出格式要稳定。

任务型命令不是聊天闲谈。它的结果最好固定成团队熟悉的格式：

```txt
完成状态：
提交信息：
变更文件：
后续建议：
```

这样命令跑多了之后，大家会形成稳定预期。

## 九、一套团队命令应该怎么组织

如果团队要真正落地任务型 Skills，可以先从高频、低争议、边界清楚的命令开始。

推荐结构：

```txt
.claude/skills/
├── commit/
│   └── SKILL.md
├── review/
│   └── SKILL.md
├── pr-create/
│   └── SKILL.md
└── test/
    └── SKILL.md

.claude/commands/
└── git/
    ├── status.md
    └── log.md
```

这套结构背后的分工是：

| 命令 | 目的 | 设计重点 |
| --- | --- | --- |
| `/commit` | 快速提交当前改动 | 最小 git 权限、稳定 commit 格式 |
| `/review` | 审查当前 diff 或指定文件 | 只读权限、按严重程度输出 |
| `/pr-create` | 基于分支上下文创建 PR | 动态注入分支、提交和 diff 摘要 |
| `/test` | 运行项目测试 | 限制测试命令、汇总失败原因 |
| `/git:status` | 快速查看状态 | 简单查询，可放 commands 目录 |
| `/git:log` | 查看近期提交 | 简单查询，可放 commands 目录 |

命名空间也很重要。`/git:status`、`/git:log` 这种形式能把同类命令聚在一起，避免项目变大后命令名互相撞车。

项目级命令适合进入仓库，服务整个团队：

```txt
.claude/skills/
.claude/commands/
```

用户级命令适合个人跨项目复用：

```txt
~/.claude/skills/
~/.claude/commands/
```

团队规范、发布流程、PR 模板这类内容应该项目级；个人习惯、个人查询脚本、自己的工作流快捷方式可以放用户级。

## 十、我对任务型 Skill 的最终理解

任务型 Skill 不是把一句提示词包成 `/xxx` 这么简单。

它真正沉淀的是一套工程契约：

```txt
触发契约：只有用户明确发令才执行
参数契约：命令输入如何进入流程
上下文契约：启动时自动注入哪些事实
权限契约：这条命令最多能做什么
安全契约：关键动作前后如何检查
输出契约：完成后用什么格式交付结果
```

如果说参考型 Skill 让 Claude “知道该怎么做”，那么任务型 Skill 让 Claude “按命令去做，并且只在边界内做”。

这也是它最适合工程团队的地方：把个人经验变成团队命令，把重复对话变成可复用流程，把容易忘的检查变成自动安全网。

最后可以用一句话收束：

> 凡是高频、步骤固定、边界清楚、最好由用户明确触发的操作，都值得沉淀成任务型 Skill。
