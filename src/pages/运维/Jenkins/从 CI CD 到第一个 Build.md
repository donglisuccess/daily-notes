## 一、为什么要学 Jenkins？

在没有 Jenkins 之前，一个项目发布往往依赖人工执行：

```bash
git pull
npm install
npm run test
npm run build
```

然后再手动把构建产物部署到服务器。

这种方式在小项目里能用，但团队规模一大，就会出现几个问题：

- 效率低
- 容易误操作
- 流程不统一
- 缺少构建记录
- 问题发现太晚

真正危险的不是"命令多"，而是：

> 发布流程依赖人的记忆和操作。

CI/CD 要解决的，就是把这些重复、机械、容易出错的流程逐步**自动化、标准化、可追踪化**。

## 二、CI/CD 到底是什么？

### 1. CI：持续集成

CI 全称 **Continuous Integration**，中文是**持续集成**。

它的核心并不是"自动构建"，而是：

> 频繁集成代码，并尽早发现集成问题。

假设三个人分别开发：

- A → 登录模块
- B → 商品模块
- C → 支付模块

如果大家很久以后才一起合代码，很容易出现：

- 大量冲突
- 接口不一致
- 公共代码被改坏
- 项目无法构建

更合理的方式是：

```text
不断提交 → 不断集成 → 不断自动验证
```

例如：

```mermaid
flowchart TD
    A["git push"] --> B["安装依赖"]
    B --> C["代码检查"]
    C --> D["自动测试"]
    D --> E["构建"]

    style A fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    style E fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
```

所以 CI 可以理解成：**频繁集成 + 自动验证**。

自动构建只是手段，尽早发现问题才是目标。

### 2. CD：持续交付与持续部署

CD 常见有两个含义。

**Continuous Delivery**，中文：**持续交付**。

表示代码经过自动构建、测试、打包后，始终处于"随时可以上线"的状态。

例如：

```mermaid
flowchart TD
    A["git push"] --> B["自动测试"]
    B --> C["自动构建"]
    C --> D["生成制品"]
    D --> E["等待人工审批"]
    E --> F["上线"]

    style E fill:#fffde7,stroke:#f9a825,stroke-width:2px
    style F fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
```

**Continuous Deployment**，中文：**持续部署**。

它比持续交付更进一步：

```mermaid
flowchart TD
    A["代码提交"] --> B["自动测试"]
    B --> C["自动构建"]
    C --> D["自动部署"]
    D --> E["直接上线"]

    style E fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
```

不再需要人工点击发布。

所以可以简单记：

| 概念                   | 一句话理解               |
| ---------------------- | ------------------------ |
| CI                     | 保证代码能安全集成       |
| Continuous Delivery    | 保证代码随时可以发布     |
| Continuous Deployment  | 检查通过后自动上线       |

## 三、Jenkins 和 CI/CD 的关系

这里必须区分清楚：

```text
CI/CD ≠ Jenkins
```

CI/CD 是：**软件工程实践与流程思想**。

Jenkins 是：**实现 CI/CD 的自动化工具**。

Jenkins 本身可以帮我们完成：

- 拉代码
- 执行 Shell
- 测试
- 构建
- 打包
- 部署
- 记录日志
- 记录构建历史
- 管理凭据
- 触发任务

所以从底层看，Jenkins 很像：

> 一个能够自动调度和执行任务的平台。

但它不只是 Shell 脚本。

例如一个 `deploy.sh` 只能回答：

```text
具体怎么部署？
```

而 Jenkins 还能回答：

- 什么时候执行？
- 谁来执行？
- 在哪台机器执行？
- 失败怎么办？
- 执行记录在哪里？
- 谁有权限执行？
- 如何自动触发？

所以两者关系更像：

```mermaid
flowchart TD
    A["Jenkins：调度流程"] --> B["test.sh"]
    A --> C["build.sh"]
    A --> D["deploy.sh"]
    B --> E["执行具体动作"]
    C --> E
    D --> E

    style A fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style E fill:#fff3e0,stroke:#e65100,stroke-width:2px
```

## 四、Jenkins 核心概念

这一章最重要的是把几个核心概念真正搞清楚。

### 1. Job

Job 可以理解成：**任务定义**。

例如 `frontend-build`，它里面可能定义：

```bash
npm install
npm run test
npm run build
```

这个整体就是一个 Job。

### 2. Build

Build 是：**Job 的一次具体执行**。

例如 `frontend-build` 这个 Job 会产生：

```text
Build #1
Build #2
Build #3
```

所以：

| 概念  | 含义           |
| ----- | -------------- |
| Job   | 任务模板       |
| Build | 一次执行记录   |

一个 Job 可以执行很多次 Build。

### 3. Workspace

Workspace 是：**Jenkins 执行 Job 时真正使用的工作目录**。

例如本次实战中：

```text
/var/jenkins_home/workspace/hello-jenkins
```

Jenkins 在这个目录里执行 `pwd`、`ls`、`echo`、`npm`、`git` 等命令。

以后如果出现 `package.json not found`，第一反应不应该直接认为 npm 坏了，而应该先检查：

```bash
pwd
ls -la
```

确认：

- 当前到底在哪？
- 代码有没有真的存在？

这也是 Jenkins 排错里非常重要的思路。

### 4. Queue

Queue 就是：**等待执行的 Build 队列**。

如果当前没有可用执行资源，Build 就会先进入 Queue。

### 5. Executor

Executor 可以理解成：**执行任务的并发槽位**。

例如某个 Agent 配置 `Executors = 2`，意味着最多同时执行 2 个 Build。

如果同时来了 5 个：

```text
2 个执行，3 个等待
```

### 6. Controller

Controller 是 Jenkins 的**管理和调度中心**。

它主要负责：

- 管理 Job
- 管理配置
- 创建 Build
- 管理 Queue
- 调度 Agent
- 提供 Web UI

可以理解成：**Jenkins 的大脑**。

### 7. Agent

Agent 是：**真正执行 Build 的节点**。

```mermaid
flowchart LR
    A["Controller"] -->|"分配任务"| B["Agent"]
    B -->|"执行"| C["npm run build"]

    style A fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style B fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    style C fill:#fff3e0,stroke:#e65100,stroke-width:2px
```

企业环境中可能有：

- Linux Agent
- Windows Agent
- Docker Agent

Agent 和 Executor 的区别：

| 概念     | 含义                     |
| -------- | ------------------------ |
| Agent    | 执行节点                 |
| Executor | 这个节点上的并发执行槽位 |

例如 Agent A 配置 `Executors = 2`，说明这台 Agent 最多同时执行两个 Build。

### 8. Plugin

Jenkins 很多功能都是通过插件扩展的。

可以理解成：

```text
Jenkins = 核心系统 + 插件生态
```

常见插件包括：

- Git
- Pipeline
- Credentials
- GitLab
- SSH Build Agents

但插件并不是越多越好。

插件越多，意味着：

- 升级风险更高
- 兼容问题更多
- 维护成本更高
- 安全风险更高

原则应该是：

> 需要什么，装什么。

## 五、一次 Build 的完整链路

当我们点击 `Build Now`，Jenkins 内部大致发生：

```mermaid
flowchart TD
    A["Job 被触发"] --> B["Controller 创建 Build"]
    B --> C["Build 进入 Queue"]
    C --> D["选择可用 Agent"]
    D --> E["占用 Executor"]
    E --> F["准备 Workspace"]
    F --> G["执行 Shell / 构建命令"]
    G --> H["收集 Console Output"]
    H --> I{"判断结果"}
    I -->|"成功"| J["SUCCESS"]
    I -->|"失败"| K["FAILURE"]

    style A fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    style J fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style K fill:#ffebee,stroke:#c62828,stroke-width:2px
```

这一条链路必须真正理解：

```text
Controller → Queue → Agent → Executor → Workspace → Shell → Result
```

## 六、Jenkins 到底以谁的身份执行命令？

这是一个特别容易踩坑的问题。

我们在 Jenkins Job 中执行：

```bash
whoami
```

实际得到：

```text
jenkins
```

说明 Shell 命令是以 Linux 用户 `jenkins` 执行的。

而我们自己 SSH 登录 Ubuntu 时，可能是 `dongli`。

所以：

```text
你能执行成功 ≠ Jenkins 能执行成功
```

两边可能存在差异：

- PATH
- 权限
- HOME
- 环境变量
- Docker 权限
- SSH Key
- 文件权限

例如执行 `docker ps`，你自己执行成功，但 Jenkins 可能报：

```text
permission denied
```

本质原因很可能只是：

```text
dongli 有权限，jenkins 没权限
```

所以以后排 Jenkins 问题，建议先检查：

```bash
whoami
pwd
echo $HOME
echo $PATH
env
```

先搞清楚：

> 谁，在什么目录，用什么环境执行。
