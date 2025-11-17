## 一、verdaccio简介
### 1.1 什么是 Verdaccio？
Verdaccio 是一个开源的 **私有 npm registry 服务器**使用 Node.js 开发，可以用来：
- 自建私有 npm 仓库
- 缓存官方 npmjs.org
- 发布和管理团队内部的 JavaScript 包
- 控制权限、安全、版本管理
- 私有化前端依赖服务

### 1.2 为什么要使用 Verdaccio（背景与作用）
现代前端工程高度依赖 npm 包，但是直接使用官方 registry 有几个问题：
| 问题               | Verdaccio 能解决吗？ |
| ---------------- | --------------- |
| npm 官方源下载慢/不稳定   | ✅ 缓存加速          |
| 企业内部需要共享私有模块     | ✅ 私有仓库          |
| 团队之间共享 UI 组件、工具库 | ✅ Scope 机制      |
| 官方 npm 被墙/限流     | ✅ 本地镜像          |
| 发布包需要控制权限和审核     | ✅ 账号管理          |
| 需要可控的依赖源（安全、可追踪） | ✅ 本地存储          |


## 二、使用 Docker 部署 Verdaccio
### 2.1 是否存在docker
```bash
docker
执行docker出现以下内容，说明已经安装了docker
[root@iZj6cj1n9gdzvdwd86uer7Z ~]# docker

Usage:  docker [OPTIONS] COMMAND

A self-sufficient runtime for containers

Common Commands:
  run         Create and run a new container from an image
  exec        Execute a command in a running container
  ps          List containers
  build       Build an image from a Dockerfile
  pull        Download an image from a registry
  push        Upload an image to a registry
  images      List images
  login       Log in to a registry
  logout      Log out from a registry
  search      Search Docker Hub for images
  version     Show the Docker version information
  info        Display system-wide information
  xxx
```
### 2.2 创建目录结构
```bash
用来存放verdaccio的配置文件
mkdir -p /opt/verdaccio/conf
用来存放verdaccio的数据
mkdir -p /opt/verdaccio/storage
用来存放verdaccio的插件
mkdir -p /opt/verdaccio/plugins
```
### 2.3 准备配置文件
首先执行如下指令，创建文件
```bash
vi config.yaml
```
再将如下内容写入文件中
```yaml
storage: /verdaccio/storage
plugins: /verdaccio/plugins

web:
  title: My Private NPM Registry

auth:
  htpasswd:
    file: /verdaccio/storage/htpasswd
    max_users: 1000

uplinks:
  npmjs:
    url: https://registry.npmjs.org/

packages:
  '@*/*':
    access: $all
    publish: $authenticated
    proxy: npmjs

  '**':
    access: $all
    publish: $authenticated
    proxy: npmjs
```
### 2.4 启动容器
```bash
docker run -d \
  --name verdaccio \
  -p 4873:4873 \
  -v /opt/verdaccio/conf:/verdaccio/conf \
  -v /opt/verdaccio/storage:/verdaccio/storage \
  -v /opt/verdaccio/plugins:/verdaccio/plugins \
  verdaccio/verdaccio:latest
```
这里注意执行docker run指令时，如果本地没有这个镜像，则回去dockerhub上拉取。
### 2.5 访问
此时可以通过浏览器访问http://ip:4873，如果出现以下内容，则说明启动成功
![alt text](./image/verdaccio-1.png)
### 2.6 访问失败
如果访问失败，则可以通过以下指令查看日志
```bash
docker logs verdaccio
```
## 三、config.yaml配置项
### 3.1 storage
```yaml
storage: /verdaccio/storage
```
存放：
- 包的 tarball
- 包的元信息
- htpasswd 用户文件

### 3.2 uplinks
```yaml
uplinks:
  npmjs:
    url: https://registry.npmjs.org/
```
场景：
- 当本地没有包，就会从这里获取并缓存
- 支持多个 uplink，包括企业内部源。
### 3.3 packages权限控制
```bash
packages:
  '@company/*':
    access: $authenticated
    publish: admin
```
权限说明：
| 权限             | 说明   |
| -------------- | ---- |
| $all           | 所有人  |
| $anonymous     | 未登录  |
| $authenticated | 登录用户 |
| 用户名            | 特定用户 |
### 3.4 auth（用户认证）
默认使用 htpasswd：
```bash
auth:
  htpasswd:
    file: /verdaccio/storage/htpasswd
```
此时打开/opt/verdaccio/storage/htpasswd文件，可以看到如下内容
![alt text](./image/verdaccio-2.png)
## 四、上传（发布）npm 包
### 4.1 配置 registry
```bash
npm set @company:registry=http://npm.example.com/
```
### 4.2 登录
```bash
npm adduser --registry http://npm.example.com/
```
### 4.3 发布
```bash
npm publish
```
## 五、在项目中使用包
### 5.1 配置 registry
在项目根目录中增加.npmrc文件，内容如下
```bash
@company:registry=http://npm.example.com/
```
### 5.2 安装包
```bash
npm install @company/xxx
```
如果在node_modules中存在如下内容，则说明安装成功。
![alt text](./image/verdaccio-3.png)