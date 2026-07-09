## 一、为什么要给 Sentry AI Fix Bot 接入 CI/CD？

最近我在做一个项目：**Sentry AI Fix Bot：前端线上异常自动诊断与修复 Agent**。

它的目标流程大概是：

```text
Sentry 收到线上异常
  ↓
后台服务触发 sentry-ai-fix-bot
  ↓
Bot 拉取 Sentry Issue 上下文
  ↓
调用 Claude Code / AI 修复代码
  ↓
自动创建分支、提交代码、推送 GitLab
  ↓
自动创建 MR
  ↓
钉钉通知结果
```

在项目早期，我的部署方式非常原始：

```text
本地修改代码
  ↓
本地打包
  ↓
手动 scp 上传服务器
  ↓
服务器手动 npm install
  ↓
服务器手动 npm run build
  ↓
手动 systemctl restart sentry-ai-fix-bot
```

这套方式能跑，但问题很多：

1. 每次部署都靠手动操作，容易漏步骤。
2. 不知道本次部署是否真的构建成功。
3. 服务器上的代码和 GitLab 仓库代码可能不一致。
4. 出问题不好回溯。
5. 不适合长期维护。

所以我决定给这个项目接入 GitLab CI/CD，让它变成：

```text
本地 push master
  ↓
GitLab 自动触发 Pipeline
  ↓
自动 build
  ↓
自动 deploy
  ↓
自动重启服务
  ↓
服务生效
```

这篇文章记录的是我从 0 到 1 接入 GitLab Runner 的过程，以及每一步为什么要这么做。

> 说明：文中的 GitLab 地址、服务器 IP、Token、服务器用户和部署目录均已脱敏。实际使用时请替换为自己的环境信息。

## 二、最终要实现什么？

这次接入 CI/CD 的目标不是为了“看起来高级”，而是为了打通一条真正可用的自动发布链路。

最终闭环如下：

```text
开发者本地修改 sentry-ai-fix-bot 代码
  ↓
git push origin master
  ↓
GitLab 检测到 master 有新提交
  ↓
创建 Pipeline
  ↓
匹配指定 GitLab Runner
  ↓
Runner 拉取项目代码
  ↓
执行 build 阶段
  ↓
build 成功后执行 deploy 阶段
  ↓
服务器拉取最新 master 代码
  ↓
npm install
  ↓
npm run build
  ↓
systemctl restart sentry-ai-fix-bot
  ↓
服务 active
  ↓
新版本正式生效
```

一句话总结：

> GitLab CI/CD 的作用，就是把“代码提交后的构建、部署、重启、验证”变成自动化、可追踪、可重复的标准流程。

## 三、整体流程涉及哪些角色？

在开始之前，要先搞清楚几个角色之间的关系。

| 角色 | 职责 |
| --- | --- |
| GitLab | 托管代码、识别 `.gitlab-ci.yml`、创建 Pipeline、分发 Job、展示执行结果 |
| GitLab Runner | 接收 GitLab 派发的 Job，并在服务器上执行流水线命令 |
| `gitlab-runner` 用户 | Shell executor 默认执行用户，负责运行 CI Job |
| 应用运行用户 | 运行线上服务、维护线上代码目录和项目环境变量 |
| `root` 用户 | 管理 GitLab Runner、systemd、sudo 授权等系统级操作 |

### 3.1 GitLab

GitLab 不是直接执行代码的人，它更像一个任务调度平台。

```text
GitLab 负责：
1. 托管代码
2. 识别 .gitlab-ci.yml
3. 创建 Pipeline
4. 分发 CI/CD Job
5. 展示执行结果
```

也就是说，GitLab 是“派活的人”。

### 3.2 GitLab Runner

GitLab Runner 才是真正执行任务的人。

它安装在服务器上，负责接收 GitLab 派发的 Job，然后执行 `.gitlab-ci.yml` 里定义的命令。

```text
GitLab Runner 负责：
1. 接收 GitLab CI/CD 任务
2. 拉取代码
3. 执行 npm install / npm run build
4. 执行部署脚本
```

可以简单理解为：

```text
GitLab：任务调度平台
GitLab Runner：任务执行器
.gitlab-ci.yml：流水线说明书
服务器：实际执行环境
```

### 3.3 `gitlab-runner` 用户

因为我使用的是 shell executor，所以 GitLab Runner 的任务是在服务器本机执行的。

执行用户是：

```text
gitlab-runner
```

这个用户有自己的环境变量、自己的 home 目录、自己的 Node/npm 环境。

这也是为什么我后面遇到了：

```bash
node: command not found
```

因为 Node 原来只装在应用运行用户下面，`gitlab-runner` 用户并不能直接使用。

### 3.4 应用运行用户

`sentry-ai-fix-bot` 服务由一个低权限应用用户运行。为了避免暴露真实服务器用户，下面统一用 `appuser` 表示。

线上代码目录示例：

```bash
/home/appuser/sentry-ai-fix-bot
```

这个用户负责：

1. 保存线上运行代码。
2. 执行 `npm install`。
3. 执行 `npm run build`。
4. 运行 `sentry-ai-fix-bot` 服务。
5. 管理项目相关环境变量。

### 3.5 `root` 用户

`root` 不负责写业务代码，但负责系统级操作，比如：

1. 安装 GitLab Runner。
2. 管理 systemd 服务。
3. 授权 `gitlab-runner` 执行部署脚本。
4. 重启 `sentry-ai-fix-bot` 服务。

最终形成一个比较清晰的权限分工：

```text
gitlab-runner：执行 CI/CD Job
appuser：运行 sentry-ai-fix-bot 服务
root：管理 systemd 和部署权限
```

## 四、第一步：确认项目没有可用 Runner

一开始，我在 GitLab 上添加了 `.gitlab-ci.yml`，但是 Pipeline 一直处于 `pending` 状态。

错误提示大概是：

```text
This job is stuck because you don't have any active runners that can run this job.
```

这句话的意思是：

```text
GitLab 已经知道有任务要跑，
但是当前项目没有可用的 Runner 来执行这个任务。
```

也就是说，GitLab 是派活的人，但是现在没有执行任务的人。

所以第一步要去项目设置里检查 Runner：

```text
Settings → CI/CD → Runners
```

我当时看到的情况是：

```text
没有 Shared Runner
没有 Group Runner
项目也没有 Specific Runner
```

所以结论很明确：必须自己给这个项目注册一个 Specific Runner。

**这一步的作用**

确认到底有没有可执行 CI/CD 任务的 Runner。

**这一步能不能省**

不能。如果没有 Runner，后面 `.gitlab-ci.yml` 写得再好也跑不起来。

## 五、第二步：安装 GitLab Runner

我先在服务器上下载 GitLab Runner 二进制文件。

最初我直接用 `curl` 下载：

```bash
curl -L --output /usr/local/bin/gitlab-runner \
  https://gitlab-runner-downloads.s3.amazonaws.com/latest/binaries/gitlab-runner-linux-amd64
```

但是因为服务器访问国外资源比较慢，下载速度非常慢。

所以我最后采用了更稳的方式：

```text
本地电脑下载 gitlab-runner
  ↓
scp 上传到服务器普通用户目录
  ↓
切换到 root
  ↓
移动到 /usr/local/bin/gitlab-runner
```

上传方式类似：

```bash
scp gitlab-runner <SSH_USER>@<SERVER_IP>:/home/<SSH_USER>/gitlab-runner
```

然后在服务器上执行：

```bash
sudo -i
mv /home/<SSH_USER>/gitlab-runner /usr/local/bin/gitlab-runner
chmod +x /usr/local/bin/gitlab-runner
gitlab-runner --version
```

**这一步的作用**

让服务器拥有执行 GitLab CI/CD 任务的能力。

安装 GitLab Runner 之前，GitLab 只能创建任务，但服务器不会主动接任务。安装后，Runner 会定期向 GitLab 拉取任务并执行。

**这一步能不能省**

如果公司已经提供 Shared Runner，可以不用自己安装。

但我的项目没有可用 Runner，所以这一步必须做。

## 六、第三步：匹配 GitLab 服务端版本

这里是我这次踩的一个大坑。

我一开始安装的是最新版 GitLab Runner：

```text
GitLab Runner 19.1.1
```

但是后来发现公司 GitLab 服务端版本比较旧：

```text
GitLab Enterprise Edition 11.6.0-ee
```

版本差距太大。

表现出来的问题是：Runner 虽然能注册成功，但是拉代码时报错：

```text
remote: HTTP Basic: Access denied
fatal: Authentication failed
```

后来我把 Runner 降级成：

```text
GitLab Runner 11.6.0
```

这个问题才继续往下排查并解决。

**为什么要匹配版本**

GitLab Runner 和 GitLab 服务端之间不是简单的“HTTP 请求”关系，它们之间涉及：

1. Runner 注册协议。
2. Job Token 认证。
3. 代码拉取方式。
4. CI/CD API。
5. clone 策略。

服务端太老、Runner 太新，就可能出现协议兼容问题。

可以理解为：

```text
GitLab 服务端说的是老版本语言，
Runner 19 说的是新版本语言，
双方能听懂一部分，但关键认证流程可能出问题。
```

**这一步的作用**

保证 Runner 和 GitLab 服务端之间的通信协议匹配。

**这一步能不能省**

在我的环境里不能省。

因为 GitLab 服务端是 11.6.0，继续用 Runner 19 风险太高。最终选择是：

```text
GitLab 服务端：11.6.0-ee
GitLab Runner：11.6.0
```

## 七、第四步：注册 Specific Runner

安装完 Runner 之后，还需要执行注册：

```bash
gitlab-runner register
```

注册过程中需要填写：

```text
GitLab instance URL:
https://gitlab.example.com/

Registration token:
<PROJECT_RUNNER_REGISTRATION_TOKEN>

Description:
sentry-ai-fix-bot-runner

Tags:
sentry-ai-fix-bot

Executor:
shell
```

注册成功后，项目的 Runner 页面会出现：

```text
sentry-ai-fix-bot-runner
tag: sentry-ai-fix-bot
status: active
```

**这一步的作用**

安装 Runner 只是让服务器有了 runner 程序。注册 Runner 是告诉 GitLab：

```text
这台服务器上的 Runner 属于当前项目；
它的名字是 sentry-ai-fix-bot-runner；
它可以执行 tag 为 sentry-ai-fix-bot 的任务。
```

**这一步能不能省**

不能。不注册的话，GitLab 不知道这个 Runner 可以服务哪个项目。

## 八、第五步：配置 Runner tag

我给 Runner 设置了 tag：

```text
sentry-ai-fix-bot
```

然后 `.gitlab-ci.yml` 里的 job 也加上：

```yaml
tags:
  - sentry-ai-fix-bot
```

这个设计非常关键。

Runner tag 的作用是任务匹配：

```text
Runner tag：这个 Runner 能执行什么任务
Job tags：这个任务需要哪个 Runner 执行
```

只有两边 tag 匹配，这个 Runner 才会接这个 job。

**为什么要加 tag**

如果不加 tag，可能出现几个问题：

1. Runner 不接任务。
2. 任务被其他 Runner 接走。
3. 不同项目之间任务混跑。
4. 部署环境不可控。

我这个项目需要在固定服务器上部署固定服务，所以必须让这个项目的 CI/CD 任务只被指定 Runner 执行。

**这一步能不能省**

理论上，如果 Runner 允许跑 untagged jobs，可以不加。

但在企业项目里，我认为应该加。因为它能确保：

```text
指定项目
指定 Runner
指定服务器
指定部署路径
```

这才是可控的 CI/CD。

## 九、第六步：解决 Runner 拉代码认证问题

注册成功后，Pipeline 不再 `pending`，但又出现了新的错误：

```text
Cloning repository...
remote: HTTP Basic: Access denied
fatal: Authentication failed
```

这个错误发生在：

```text
Getting source from Git repository
```

也就是说，GitLab Runner 还没有执行 `.gitlab-ci.yml` 里的 `script`，它在自动 clone 项目代码时就失败了。

后来发现 Runner clone 使用的是：

```text
http://gitlab.example.com/...
```

而 Runner 注册地址是：

```text
https://gitlab.example.com/
```

所以我修改了 Runner 配置文件：

```bash
/etc/gitlab-runner/config.toml
```

给 Runner 增加：

```toml
clone_url = "https://gitlab.example.com"
```

最终配置类似：

```toml
[[runners]]
  name = "sentry-ai-fix-bot-runner"
  url = "https://gitlab.example.com/"
  token = "<RUNNER_AUTH_TOKEN>"
  executor = "shell"
  clone_url = "https://gitlab.example.com"
```

然后重启 Runner：

```bash
gitlab-runner restart
```

之后 Pipeline 成功拉取代码。

**这一步的作用**

解决 Runner clone 仓库时的认证问题。

简单来说就是：

```text
Runner 注册时使用 https，
Runner 拉代码时也强制使用 https，
避免 http/https 不一致导致认证失败。
```

**这一步能不能省**

在我的环境里不能省。

因为不配置 `clone_url`，Runner clone 代码会失败，CI 根本执行不到 `script`。

## 十、第七步：给 `gitlab-runner` 用户安装 Node/npm

Runner 拉代码成功后，进入了 `script` 阶段。

日志显示：

```bash
$ whoami
gitlab-runner

$ node -v
bash: node: command not found
```

这里说明 CI job 是用 `gitlab-runner` 用户执行的。

但是 Node.js 原来只装在应用运行用户的 nvm 里。Linux 用户之间环境是隔离的，所以 `gitlab-runner` 用户找不到 Node。

于是我切到 `gitlab-runner` 用户，安装 nvm 和 Node：

```bash
su - gitlab-runner
git clone https://gitee.com/mirrors/nvm.git ~/.nvm
cd ~/.nvm
git checkout v0.40.5
```

然后加载 nvm：

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
```

安装 Node：

```bash
export NVM_NODEJS_ORG_MIRROR=https://npmmirror.com/mirrors/node
nvm install 20
nvm use 20
nvm alias default 20
```

验证：

```bash
node -v
npm -v
```

**这一步的作用**

让 CI 执行用户 `gitlab-runner` 具备 Node.js 构建能力。

因为我的项目是 Node.js + TypeScript 项目，构建必须依赖：

```text
node
npm
typescript
```

**这一步能不能省**

如果使用 shell executor，就必须让执行用户有 Node/npm。

如果使用 docker executor，可以直接使用 `node:20` 镜像，不需要在宿主机安装 Node。

但我这个项目需要在宿主机部署并重启 systemd，所以选择 shell executor 更方便。

## 十一、第八步：编写 `.gitlab-ci.yml`

最终 `.gitlab-ci.yml` 大概如下：

```yaml
stages:
  - build
  - deploy

build:
  stage: build
  tags:
    - sentry-ai-fix-bot
  only:
    - master
  script:
    - whoami
    - pwd
    - node -v
    - npm -v
    - npm config set registry https://registry.npmmirror.com
    - npm ci --include=dev || npm install --include=dev
    - npx tsc -v
    - npm run build

deploy:
  stage: deploy
  tags:
    - sentry-ai-fix-bot
  only:
    - master
  script:
    - sudo /usr/local/bin/deploy-sentry-ai-fix-bot.sh
```

这里有几个关键设计。

### 11.1 为什么分 `build` 和 `deploy`？

因为 `build` 和 `deploy` 的职责不同。

```text
build：验证代码能不能构建成功
deploy：把构建通过的代码部署到服务器
```

如果 `build` 失败，就不应该继续 `deploy`。这是一种保护机制。

没有 `build` 阶段，就相当于代码没有检查就直接上线。

### 11.2 为什么只在 `master` 分支触发？

配置如下：

```yaml
only:
  - master
```

作用是限制只有 `master` 分支会自动部署。

如果任意分支 push 都触发 deploy，就可能出现：

```text
开发分支还没写完
  ↓
一 push
  ↓
直接部署到服务器
  ↓
服务异常
```

所以 `master` 是自动部署边界。

### 11.3 为什么 `npm install` 要带 `include=dev`？

我的 `package.json` 里 TypeScript 是 `devDependency`：

```json
{
  "devDependencies": {
    "typescript": "^5.5.3"
  }
}
```

但构建需要执行：

```bash
tsc
```

所以 build 阶段必须安装 `devDependencies`。

之前失败过：

```bash
tsc: command not found
```

原因就是没有安装 `devDependencies`。

所以改成：

```bash
npm ci --include=dev || npm install --include=dev
```

### 11.4 为什么要写 `tags`？

因为要让这个 job 被指定 Runner 接住：

```yaml
tags:
  - sentry-ai-fix-bot
```

这样就不会被其他 Runner 接走。

## 十二、第九步：创建部署脚本

我没有把部署逻辑全部写在 `.gitlab-ci.yml` 里，而是创建了一个固定部署脚本：

```bash
/usr/local/bin/deploy-sentry-ai-fix-bot.sh
```

脚本内容大概如下：

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_USER="appuser"
APP_DIR="/home/appuser/sentry-ai-fix-bot"
BRANCH="master"
SERVICE_NAME="sentry-ai-fix-bot"

echo "[deploy] start deploy ${SERVICE_NAME}"

sudo -u "${APP_USER}" bash -lc "
set -euo pipefail

export NVM_DIR=\"\$HOME/.nvm\"
[ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\"

cd \"${APP_DIR}\"

echo '[deploy] current user:' \$(whoami)
echo '[deploy] current dir:' \$(pwd)

echo '[deploy] node version'
node -v
npm -v

echo '[deploy] fetch latest code'
git fetch origin

echo '[deploy] checkout ${BRANCH}'
git checkout \"${BRANCH}\"

echo '[deploy] reset to origin/${BRANCH}'
git reset --hard \"origin/${BRANCH}\"

echo '[deploy] install dependencies'
npm config set registry https://registry.npmmirror.com
npm install --include=dev

echo '[deploy] build'
npm run build
"

echo "[deploy] restart service"
systemctl restart "${SERVICE_NAME}"

echo "[deploy] service status"
systemctl is-active "${SERVICE_NAME}"

echo "[deploy] deploy success"
```

然后授权：

```bash
chmod +x /usr/local/bin/deploy-sentry-ai-fix-bot.sh
```

手动测试：

```bash
/usr/local/bin/deploy-sentry-ai-fix-bot.sh
```

最终输出：

```text
[deploy] deploy success
```

**这一步的作用**

部署脚本是整个 CD 的核心。它负责：

1. 进入线上目录。
2. 拉取最新 `master`。
3. 安装依赖。
4. 构建项目。
5. 重启服务。
6. 验证服务状态。

**为什么不直接写在 `.gitlab-ci.yml` 里**

因为 `.gitlab-ci.yml` 应该描述流水线，不应该承载太多服务器细节。

更清晰的分工是：

```text
.gitlab-ci.yml：负责触发部署
deploy-sentry-ai-fix-bot.sh：负责具体怎么部署
```

这样以后要改部署逻辑，只需要改服务器上的部署脚本。

**这一步能不能省**

理论上可以不用脚本，直接把命令写在 `.gitlab-ci.yml`。

但我不推荐。独立部署脚本更安全、更清晰、更容易排查。

## 十三、第十步：给 `gitlab-runner` 最小 sudo 权限

CI job 是 `gitlab-runner` 用户执行的。

但部署脚本里需要：

```bash
systemctl restart sentry-ai-fix-bot
```

这个操作需要 root 权限。

如果直接给 `gitlab-runner` 完整 sudo 权限，就很危险。所以我使用 `visudo` 加了最小授权：

```text
gitlab-runner ALL=(root) NOPASSWD: /usr/local/bin/deploy-sentry-ai-fix-bot.sh
```

这句话的意思是：

```text
gitlab-runner 用户可以免密以 root 身份执行这个固定脚本，
但不能随便执行其他 root 命令。
```

**这一步的作用**

让 GitLab CI/CD 能自动执行部署脚本，同时控制权限范围。

这也是典型的最小权限原则。

**为什么不能直接给 `gitlab-runner` 全量 sudo**

因为 CI 脚本来自代码仓库。

如果有人修改 `.gitlab-ci.yml`，并且 `gitlab-runner` 有完整 root 权限，那么风险会非常大。

最小权限设计可以把风险控制在：

```text
只能执行固定部署脚本
不能执行任意 root 命令
```

**这一步能不能省**

如果需要自动重启 systemd 服务，就需要某种提权方式。

在我当前这个项目里，这一步是必要的。

## 十四、最终完整闭环

最终，我的 CI/CD 流程变成了这样：

```text
开发者本地修改 sentry-ai-fix-bot 代码
  ↓
git push origin master
  ↓
GitLab 检测到 master 有新提交
  ↓
创建 Pipeline
  ↓
匹配 tag = sentry-ai-fix-bot 的 Runner
  ↓
服务器上的 gitlab-runner 接到任务
  ↓
Runner 在 /home/gitlab-runner/builds/... 拉取代码
  ↓
执行 build 阶段：
    - node -v
    - npm -v
    - npm install
    - npm run build
  ↓
build 成功
  ↓
执行 deploy 阶段：
    - sudo /usr/local/bin/deploy-sentry-ai-fix-bot.sh
  ↓
部署脚本开始执行
  ↓
脚本切到 appuser 用户
  ↓
进入 /home/appuser/sentry-ai-fix-bot
  ↓
git fetch origin
  ↓
git checkout master
  ↓
git reset --hard origin/master
  ↓
npm install
  ↓
npm run build
  ↓
回到 root 权限
  ↓
systemctl restart sentry-ai-fix-bot
  ↓
systemctl is-active sentry-ai-fix-bot
  ↓
服务 active
  ↓
CI/CD 成功
  ↓
新版本 sentry-ai-fix-bot 正式生效
```

## 十五、用一句话理解这套设计

这套 CI/CD 的本质是：

```text
GitLab 负责发现代码变化，
Runner 负责执行流水线，
build 负责验证代码质量，
deploy 脚本负责标准化部署，
systemd 负责守护服务，
最小 sudo 权限负责控制风险。
```

如果用更生活化的比喻：

```text
GitLab 像订单系统
Runner 像执行人员
.gitlab-ci.yml 像施工单
build 像质检
deploy 像上架
systemd restart 像重新开门营业
health check 像确认门店正常营业
```

## 十六、总结

这次接入 GitLab CI/CD 后，我从手动部署升级成了自动部署。

之前是：

```text
本地改代码
  ↓
手动上传
  ↓
手动安装依赖
  ↓
手动构建
  ↓
手动重启服务
```

现在是：

```text
git push origin master
  ↓
GitLab CI 自动 build
  ↓
GitLab CI 自动 deploy
  ↓
服务自动重启并生效
```

这条链路打通后，`sentry-ai-fix-bot` 项目已经不再是一个简单脚本，而是开始具备了企业项目的工程化发布能力。
