## 一、什么是 Docker 容器？
> Docker 容器本质上是：一个轻量级、独立、封装好的运行环境，用来运行你的应用程序。你可以把它理解为 —— 运行代码的“浏览器 Tab”。
只是浏览器运行的是 JavaScript，而 Docker 容器运行的是 Node / Python / Go / Java / AI 模型 / 数据库 / Nginx / 后端服务。

### 1.1 用前端类比更好理解
🎨 **容器 ≈ 运行中的浏览器 Tab（带隔离环境）。**
例如：打开一个 Vue 项目 → 这就是“运行中的实例”，互不影响。再开一个 Tab 也不影响前一个 Tab。Tab 关闭了，不影响浏览器本体。

### 1.2 容器由什么组成？
**容器内有：**

- 一个 极简的 Linux 系统（隔离环境）。
- 应用运行所需的依赖（Node、npm 包、Python、Java…）。
- 应用本身（你的代码）。
- 环境变量
- 启动命令

> 你可以理解成：把“运行某个应用所需的环境”全部打包起来运行。

### 1.3 Docker 容器最大特点
- **（1）轻量：** 不像虚拟机那样要开整台电脑，容器只运行应用本身。
- **（2）独立隔离：** 容器间互不影响：例如容器A使用Node18，容器B使用Node20，这两个互不冲突。
- **（3）可移植：** 只要你能安装 Docker，Windows / Linux / macOS都能运行完全一样的环境。
- **（4）一键启动：** 你可以执行如下指令来启动容器。
```sh
docker run my-app
```

### 1.4 容器 vs 镜像
> 容器和镜像的关系，就像对象和类的关系。容器是镜像的实例。

**类比与前端：**
| 前端概念      | Docker概念      | 含义      |
| --------- | ------------- | ------- |
| dist/     | Image（镜像）     | 静态的产物   |
| 运行在浏览器的页面 | Container（容器） | 动态的运行实例 |

**用一句话总结：** 

Docker 容器是基于镜像创建的、轻量级、可移植、独立隔离的运行环境，用来运行应用程序，是现代开发和部署的标准方式。

## 二、Docker指令
> 以下是 Docker 最核心的三大类指令，它们占了我们日常 90% 的使用场景。

### 2.1 容器（Container）指令
> 容器指令是我们使用 Docker 最常用的部分，所有“运行、停止、进入”等操作都在这里。

#### 2.1.1 查看容器
```shell
docker ps
```
常用参数：
| 参数   | 作用            |
| ---- | ------------- |
| `-a` | 显示所有容器（包含已退出） |
| `-q` | 只输出容器 ID      |
| `-s` | 显示容器占用空间      |

```shell
docker ps

CONTAINER ID   IMAGE                        COMMAND                  CREATED       STATUS       PORTS                                       NAMES
b5759ae1cbae   verdaccio/verdaccio:latest   "uid_entrypoint /bin…"   11 days ago   Up 11 days   0.0.0.0:4873->4873/tcp, :::4873->4873/tcp   verdaccio
```

#### 2.1.2 启动容器
```shell
docker run [参数] 镜像名
```
常用参数（必须熟悉）：
| 参数              | 说明            |
| --------------- | ------------- |
| `-d`            | 后台运行容器        |
| `-p 宿主机端口:容器端口` | 端口映射          |
| `--name 名称`     | 容器命名          |
| `-e KEY=value`  | 设置环境变量        |
| `-v 本地目录:容器目录`  | 文件挂载          |
| `--rm`          | 容器退出后自动删除     |
| `-it`           | 交互式运行（进入容器终端） |

1️⃣ -d —— 后台运行容器

📖 说明：让容器在后台运行，不占用当前终端。

📌 示例
```shell
docker run -d nginx
```
容器在后台启动，你的终端不会被占用。使用 docker ps 可以看到它。

2️⃣ -p 宿主机端口:容器端口 —— 端口映射

📖 说明：让浏览器可以访问容器内部的服务。nginx 内部默认使用端口 80。

结果：
```html
[root@iZj6cj1n9gdzvdwd86uer7Z ~]# curl localhost:8080
<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
<style>
  html { color-scheme: light dark; }
  body { width: 35em; margin: 0 auto;
  font-family: Tahoma, Verdana, Arial, sans-serif; }
  </style>
  </head>
    <body>
      <h1>Welcome to nginx!</h1>
      <p>If you see this page, the nginx web server is successfully installed and
      working. Further configuration is required.</p>

      <p>For online documentation and support please refer to
      <a href="http://nginx.org/">nginx.org</a>.<br/>
      Commercial support is available at
      <a href="http://nginx.com/">nginx.com</a>.</p>

      <p><em>Thank you for using nginx.</em></p>
    </body>
  </html>
```

3️⃣ --name 名称 —— 给容器起名字

📖 说明：方便你后续使用名字来管理容器，而不是 ID。

📌 示例
```shell
docker run -d --name my-nginx -p 8080:80 nginx

# 结果
[root@iZj6cj1n9gdzvdwd86uer7Z ~]# docker ps
CONTAINER ID   IMAGE     COMMAND                  CREATED         STATUS         PORTS                                   NAMES
63b8bc95eb74   nginx     "/docker-entrypoint.…"   3 seconds ago   Up 3 seconds   0.0.0.0:8080->80/tcp, :::8080->80/tcp   dl-nginx
```
此时你可以使用:
```shell
docker stop dl-nginx
docker start dl-nginx
docker logs dl-nginx
```

4️⃣ -e KEY=value —— 设置环境变量

示例：（容器里加入一个自定义环境变量）
```shell
docker run -d -p 8080:80 --name dl-nginx -e ENV=production nginx
```
进入容器：
```shell
docker exec -it dl-nginx sh
env
```
输出结果：
```shell
ENV=production
```

5️⃣ -v 本地目录:容器目录 —— 目录挂载

📖 说明:把本地文件挂载到 nginx 的 HTML 目录，做到“修改本地文件 → 容器立即生效”。

📌 示例
```shell
 docker run -d -p 8080:80 --name dl-nginx -v /root/web:/usr/share/nginx/html nginx

# 输出结果：
[root@iZj6cj1n9gdzvdwd86uer7Z web]# curl localhost:8080
helloworld
```

6️⃣ --rm —— 退出后自动删除容器
📖 说明：容器退出后自动删除，一般用于测试。
```shell
docker run -d --rm -p 8080:80 nginx
```
当你停止它：
```shell
docker stop 容器ID
```
容器会自动删除（不会占空间）。

7️⃣ -it —— 交互式运行（进入容器终端）
📖 说明：用于进入容器并保持交互，常用于调试。nginx 本身没有交互服务，但可以用 shell。

📌 示例（进入 nginx 容器内部）
```shell
docker run -it nginx sh
```
进入容器内容：
```shell
/#
```

#### 2.1.3 停止容器
```shell
docker stop 容器ID
```
强制停止：
```shell
docker kill 容器ID
```

#### 2.1.4 启动/重启容器
```shell
docker start 容器ID
docker restart 容器ID
```

#### 2.1.5 删除容器
```shell
docker rm 容器ID
```

#### 2.1.6 进入容器（最常用调试方式）
```shell
docker exec -it 容器ID sh

docker exec -it 容器ID /bin/bash
```

#### 2.1.7 查看容器日志
```shell
docker logs 容器ID
```
实时监听：
```shell
docker logs -f 容器ID
```

#### 2.1.8 容器与本地相互拷贝
容器 → 本地：
```shell
docker cp dl-nginx:/usr/share/nginx/html .
```
本地 → 容器：
```shell
docker cp ./set.html dl-nginx:/usr/share/nginx/html

# 输出结果：
[root@iZj6cj1n9gdzvdwd86uer7Z web]# docker cp ./set.html dl-nginx:/usr/share/nginx/html
Successfully copied 2.05kB to dl-nginx:/usr/share/nginx/html
[root@iZj6cj1n9gdzvdwd86uer7Z web]# curl localhost:8080/set.html
hello set
```

### 2.2 镜像（Image）指令
> 镜像是 Docker 的基础，就像“打包后的 dist 文件”。

#### 2.2.1 查看镜像
```shell
docker images
```
| 参数          | 说明       |
| ----------- | -------- |
| `-q`        | 只显示镜像 ID |
| `--digests` | 查看摘要     |

#### 2.2.2 拉取镜像
```shell
docker pull 镜像名
```
示例：
```shell
docker pull node:18-alpine
docker pull nginx
```

#### 2.2.3 删除镜像
```shell
docker rmi 镜像ID
```

```shell
docker image prune -a 

# 输出结果：
[root@iZj6cj1n9gdzvdwd86uer7Z ~]# docker image prune -a
WARNING! This will remove all images without at least one container associated to them.
Are you sure you want to continue? [y/N] y
Deleted Images:
untagged: centos:7
untagged: centos@sha256:be65f488b7764ad3638f236b7b515b3678369a5124c47b8d32916d6487418ea4
deleted: sha256:eeb6ee3f44bd0b5103bb561b4c16bcb82328cfe5809ab675bb17ab3a16c517c9
deleted: sha256:174f5685490326fc0a1c0f5570b8663732189b327007e47ff13d2ca59673db02
untagged: hello-world:latest
untagged: hello-world@sha256:f7931603f70e13dbd844253370742c4fc4202d290c80442b2e68706d8f33ce26
deleted: sha256:1b44b5a3e06a9aae883e7bf25e45c100be0bb81a0e01b32de604f3ac44711634
deleted: sha256:53d204b3dc5ddbc129df4ce71996b8168711e211274c785de5e0d4eb68ec3851
untagged: ubuntu:latest
untagged: ubuntu@sha256:66460d557b25769b102175144d538d88219c077c678a49af4afca6fbfc1b5252
deleted: sha256:97bed23a34971024aa8d254abbe67b7168772340d1f494034773bc464e8dd5b6
deleted: sha256:073ec47a8c22dcaa4d6e5758799ccefe2f9bde943685830b1bf6fd2395f5eabc

Total reclaimed space: 282.1MB
```

#### 2.2.4 给镜像重新打标签
```shell
docker tag old-image new-image:tag

# 示例：
[root@iZj6cj1n9gdzvdwd86uer7Z ~]# docker tag nginx nginx:dev
[root@iZj6cj1n9gdzvdwd86uer7Z ~]# docker images
REPOSITORY            TAG       IMAGE ID       CREATED       SIZE
nginx                 dev       60adc2e137e7   10 days ago   152MB
nginx                 latest    60adc2e137e7   10 days ago   152MB
verdaccio/verdaccio   latest    7eb7f4f0ff8e   8 weeks ago   200MB
```