## 一、为什么页面能访问不代表掌握了 Nginx

很多人第一次学习 Nginx 时，会写出下面的配置：

```nginx
server {
    listen 80;

    location / {
        root /usr/share/nginx/html;
        index index.html;
    }
}
```

然后打开浏览器，发现页面可以访问，于是认为自己已经掌握了 Nginx 静态资源配置。

但这只能说明最终结果成功了，并不能说明你理解了整个过程。

至少还需要回答以下问题：

- 浏览器发送的请求 URI 是什么？
- 为什么这个请求会进入 `location /`？
- `location /` 是否对应磁盘上的 `/` 目录？
- `root` 是如何计算最终文件路径的？
- 如果请求返回 `404`，说明没有匹配到 `location` 吗？
- 修改配置以后，为什么页面还是旧内容？
- 如何证明请求确实进入了预期的 `location`？

如果这些问题无法解释，就说明目前只是“会用”，还没有真正理解。

## 二、先区分 URL、URI 和文件路径

假设我们访问：

```text
http://localhost:8080/images/logo.txt?version=1
```

这个地址可以拆分为：

| 部分 | 内容 |
| --- | --- |
| 协议 | `http` |
| 主机 | `localhost` |
| 端口 | `8080` |
| URI 路径 | `/images/logo.txt` |
| 查询参数 | `version=1` |

Nginx 的 `location` 主要匹配的是：

```text
/images/logo.txt
```

而不是完整地址：

```text
http://localhost:8080/images/logo.txt?version=1
```

也不是容器中的文件路径：

```text
/usr/share/nginx/html/images/logo.txt
```

这里必须明确三个不同的概念。

### 1. URL

URL 是浏览器中输入的完整地址：

```text
http://localhost:8080/images/logo.txt
```

### 2. URI

URI 是请求的资源路径：

```text
/images/logo.txt
```

`location` 匹配的就是这个路径。

### 3. 文件系统路径

文件系统路径是 Nginx 最终读取文件的位置：

```text
/usr/share/nginx/html/images/logo.txt
```

它由 `root` 或 `alias` 根据请求 URI 计算出来。

因此：

> `location` 负责匹配请求，`root` 和 `alias` 负责把请求映射到文件。

这两件事不能混在一起理解。

## 三、搭建本章实验环境

本章使用 Docker 运行 Nginx，所有文件都放在本地，便于重复实验。

### 1. 项目目录

创建如下目录：

```text
nginx-stage1-chapter2/
├── docker-compose.yml
├── nginx/
│   └── conf.d/
│       └── default.conf
├── html/
│   ├── index.html
│   ├── about/
│   │   └── index.html
│   └── images/
│       └── root-logo.txt
└── files/
    ├── alias-logo.txt
    └── report.txt
```

## 四、准备静态文件

### 1. 创建首页

创建文件：

```text
html/index.html
```

内容如下：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Nginx 第二章</title>
</head>
<body>
  <h1>Nginx 请求匹配实验</h1>
  <p>当前页面来自 html/index.html</p>
</body>
</html>
```

### 2. 创建 About 页面

创建文件：

```text
html/about/index.html
```

内容如下：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>About</title>
</head>
<body>
  <h1>About 页面</h1>
  <p>当前页面来自 html/about/index.html</p>
</body>
</html>
```

### 3. 创建 root 实验文件

创建文件：

```text
html/images/root-logo.txt
```

内容如下：

```text
这是通过 root 指令返回的文件。真实路径：/usr/share/nginx/html/images/root-logo.txt
```

### 4. 创建 alias 实验文件

创建文件：

```text
files/alias-logo.txt
```

内容如下：

```text
这是通过 alias 指令返回的文件。真实路径：/data/files/alias-logo.txt
```

再创建：

```text
files/report.txt
```

内容如下：

```text
这是 files 目录中的报告文件。
```

## 五、编写 Docker Compose 配置

创建文件：

```text
docker-compose.yml
```

内容如下：

```yaml
services:
  nginx:
    image: nginx:1.28-alpine
    container_name: nginx-stage1-chapter2
    ports:
      - "8080:80"
    volumes:
      - ./nginx/conf.d/default.conf:/etc/nginx/conf.d/default.conf:ro
      - ./html:/usr/share/nginx/html:ro
      - ./files:/data/files:ro
```

这里有三个挂载，需要分别理解。

### 1. Nginx 配置文件挂载

```text
./nginx/conf.d/default.conf:/etc/nginx/conf.d/default.conf:ro
```

本机文件：

```text
./nginx/conf.d/default.conf
```

被挂载到容器：

```text
/etc/nginx/conf.d/default.conf
```

末尾的 `:ro` 表示只读。

也就是说，容器里的 Nginx 可以读取配置，但不能修改宿主机上的配置文件。

### 2. html 目录挂载

```text
./html:/usr/share/nginx/html:ro
```

本机目录：

```text
./html
```

映射到容器：

```text
/usr/share/nginx/html
```

后续主要用于 `root` 实验。

例如本地文件：

```text
html/images/root-logo.txt
```

容器内对应：

```text
/usr/share/nginx/html/images/root-logo.txt
```

### 3. files 目录挂载

```text
./files:/data/files:ro
```

本机目录：

```text
./files
```

映射到容器：

```text
/data/files
```

后续主要用于 `alias` 实验。

我们故意把 `html` 和 `files` 挂载到不同位置，是为了让 `root` 与 `alias` 的区别更加明显。

## 六、编写 Nginx 配置

创建文件：

```text
nginx/conf.d/default.conf
```

内容如下：

```nginx
server {
    listen 80;
    server_name localhost;

    # 访问日志与错误日志配置
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log notice;

    # 1. 精确匹配：只匹配 /exact 这个路径
    location = /exact {
        add_header X-Matched-Location "exact";
        return 200 "matched: exact location\n";
    }

    # 2. 前缀匹配 /images/：使用 root 拼接路径
    # 实际文件路径为：/usr/share/nginx/html/images/...
    location /images/ {
        add_header X-Matched-Location "images-prefix";
        root /usr/share/nginx/html;
    }

    # 3. 前缀匹配 /download/：使用 alias 替换路径
    # 实际文件路径为：/data/files/...，会去掉 /download/ 前缀
    location /download/ {
        add_header X-Matched-Location "download-alias";
        alias /data/files/;
    }

    # 4. 默认兜底匹配：匹配所有其他请求
    location / {
        add_header X-Matched-Location "root-prefix";
        root /usr/share/nginx/html;
        index index.html;
    }
}
```

启动容器：

```bash
docker compose up -d
```

查看容器状态：

```bash
docker compose ps
```

检查配置语法：

```bash
docker exec nginx-stage1-chapter2 nginx -t
```

正常情况下会输出：

```text
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

查看完整生效配置：

```bash
docker exec nginx-stage1-chapter2 nginx -T
```

需要确认输出中存在：

```nginx
location = /exact
location /images/
location /download/
location /
```

这里要特别注意：

> `nginx -t` 只能证明配置语法可以被 Nginx 解析，不代表路径映射一定正确。

后续还必须通过真实请求验证。

## 七、location 到底是如何匹配的

### 1. 精确匹配

配置如下：

```nginx
location = /exact {
    return 200 "matched: exact location\n";
}
```

`=` 表示请求 URI 必须完全等于 `/exact`。

可以匹配：

```text
/exact
```

不能匹配：

```text
/exact/
/exact/a
/exactly
```

执行：

```bash
curl -i http://localhost:8080/exact
```

可以看到：

```text
HTTP/1.1 200 OK
Server: nginx/1.28.3
Content-Type: application/octet-stream
X-Matched-Location: exact

matched: exact location
```

这里我们额外添加了一个响应头：

```nginx
add_header X-Matched-Location "exact";
```

它不是 Nginx 的匹配条件，只是一个调试标记，用来证明请求确实进入了这个 `location`，这比只看页面内容可靠得多。

### 2. 精确匹配失败实验

执行：

```bash
curl -i http://localhost:8080/exact/
```

注意这里多了一个 `/`。

请求 URI 变成：

```text
/exact/
```

它并不完全等于：

```text
/exact
```

所以不会进入：

```nginx
location = /exact
```

最终会进入：

```nginx
location /
```

因为 `/` 可以匹配几乎所有请求。

Nginx 接下来会尝试查找：

```text
/usr/share/nginx/html/exact/
```

由于这个目录下不存在 `index.html`，通常会返回 `404`。

这说明一个非常重要的问题：

> 返回 `404` 不代表没有匹配到 `location`。

真实过程可能是：

```text
请求已经匹配 location
  ↓
Nginx 计算出文件路径
  ↓
文件不存在
  ↓
返回 404
```

## 八、普通前缀匹配

下面的配置属于普通前缀匹配：

```nginx
location /images/ {

}
```

只要请求 URI 以 `/images/` 开头，就可以匹配。

可以匹配：

```text
/images/
/images/a.txt
/images/2026/logo.png
```

不能匹配：

```text
/image/a.txt
/img/a.txt
```

另一个常见配置是：

```nginx
location / {

}
```

因为绝大多数 URI 都以 `/` 开头，所以它经常被当作兜底配置。

更准确地说：

> `location /` 是最短的普通前缀匹配，因此当没有更具体的前缀时，它通常会被选中。

## 九、最长前缀优先，而不是书写顺序优先

假设配置如下：

```nginx
location / {

}

location /images/ {

}

location /images/private/ {

}
```

请求：

```text
/images/private/a.txt
```

三个 `location` 都可以匹配：

```text
/                 可以匹配
/images/          可以匹配
/images/private/  可以匹配
```

但 Nginx 会选择最长的前缀：

```text
/images/private/
```

这意味着：

> 普通前缀匹配不是简单按照配置书写顺序，从上往下找到第一个就停止。

为了验证这一点，在配置中加入：

```nginx
location /images/private/ {
    add_header X-Matched-Location "images-private" always;
    return 403 "private resources are forbidden\n";
}
```

完整相关配置：

```nginx
location /images/ {
    add_header X-Matched-Location "images-prefix" always;
    root /usr/share/nginx/html;
}

location /images/private/ {
    add_header X-Matched-Location "images-private" always;
    return 403 "private resources are forbidden\n";
}
```

即使将 `/images/private/` 写在 `/images/` 后面，它仍然会被优先选择。

修改后执行：

```bash
docker exec nginx-stage1-chapter2 nginx -t
docker compose down
docker compose up -d
```

然后访问：

```bash
curl -i http://localhost:8080/images/private/a.txt
```

此时可以看到：

```text
HTTP/1.1 403 Forbidden
Server: nginx/1.28.3
Content-Type: text/plain
X-Matched-Location: images-private

private resources are forbidden
```

请求链路如下：

```text
请求 /images/private/a.txt
  ↓
没有精确匹配
  ↓
location / 可以匹配
  ↓
location /images/ 可以匹配
  ↓
location /images/private/ 可以匹配
  ↓
选择最长前缀 /images/private/
  ↓
执行 return 403
```

这里并没有读取磁盘文件，因为 `return` 已经直接生成了 HTTP 响应。

## 十、root 的路径拼接规则

配置：

```nginx
location /images/ {
    root /usr/share/nginx/html;
}
```

访问：

```text
/images/root-logo.txt
```

执行：

```bash
curl -i http://localhost:8080/images/root-logo.txt
```

正常情况下会看到：

```text
HTTP/1.1 200 OK
Server: nginx/1.28.3
Content-Type: text/plain
X-Matched-Location: images-prefix

这是通过 root 指令返回的文件。真实路径：/usr/share/nginx/html/images/root-logo.txt
```

**root 的核心规则**

可以暂时记成：

```text
root 路径 + 完整请求 URI
```

当前配置：

```text
root 路径：/usr/share/nginx/html
请求 URI：/images/root-logo.txt
```

拼接后：

```text
/usr/share/nginx/html/images/root-logo.txt
```

因此，Nginx 最终读取：

```text
/usr/share/nginx/html/images/root-logo.txt
```

而不是：

```text
/usr/share/nginx/html/root-logo.txt
```

这是初学者最容易犯的错误之一。

`location /images/` 的作用只是匹配 URI，它不会自动把 `/images/` 从 URI 中删除。

**验证容器中的真实文件**

执行：

```bash
docker exec -it nginx-stage1-chapter2 /bin/sh
```

进入容器后执行：

```bash
ls -l /usr/share/nginx/html/images
cat /usr/share/nginx/html/images/root-logo.txt
```

退出：

```bash
exit
```

通过这组验证，我们证明了四件事：

1. 请求 URI 是 `/images/root-logo.txt`。
2. 请求进入了 `location /images/`。
3. `root` 拼接出了完整路径。
4. 容器中的目标文件确实存在。

## 十一、故意验证 root 不会删除 URI 前缀

在本地创建：

```text
html/wrong-place.txt
```

内容可以写成：

```text
这个文件故意放在错误位置。
```

此时容器中对应路径是：

```text
/usr/share/nginx/html/wrong-place.txt
```

访问：

```bash
curl -i http://localhost:8080/images/wrong-place.txt
```

请求会进入：

```nginx
location /images/
```

但 Nginx 查找的是：

```text
/usr/share/nginx/html/images/wrong-place.txt
```

而不是：

```text
/usr/share/nginx/html/wrong-place.txt
```

因此会返回 `404`。

> `root` 不会因为 `location` 是 `/images/`，就自动删除 URI 中的 `/images/`。

## 十二、alias 的路径替换规则

配置：

```nginx
location /download/ {
    alias /data/files/;
}
```

访问：

```text
/download/report.txt
```

执行：

```bash
curl -i http://localhost:8080/download/report.txt
```

正常情况下应该看到：

```text
HTTP/1.1 200 OK
Server: nginx/1.28.3
Content-Type: text/plain
X-Matched-Location: download-alias

这是 files 目录中的报告文件。
```

**alias 的核心规则**

`alias` 不会保留完整 URI，而是用指定目录替换匹配到的 `location` 前缀。

请求 URI：

```text
/download/report.txt
```

匹配前缀：

```text
/download/
```

删除匹配前缀后，剩余：

```text
report.txt
```

配置中的 `alias`：

```text
/data/files/
```

最终路径：

```text
/data/files/report.txt
```

因此可以暂时记成：

> `alias` 路径 + 去掉 `location` 前缀后的 URI

## 十三、root 和 alias 的核心区别

假设请求都是：

```text
/download/report.txt
```

| 写法 | 配置 | 最终路径 |
| --- | --- | --- |
| `root` | `root /data/files;` | `/data/files/download/report.txt` |
| `alias` | `alias /data/files/;` | `/data/files/report.txt` |

使用 `root` 时：

```nginx
location /download/ {
    root /data/files;
}
```

最终路径是：

```text
/data/files/download/report.txt
```

因为 `root` 保留完整 URI：

```text
/data/files + /download/report.txt = /data/files/download/report.txt
```

使用 `alias` 时：

```nginx
location /download/ {
    alias /data/files/;
}
```

最终路径是：

```text
/data/files/report.txt
```

因为 `alias` 会替换 `/download/` 前缀。

**一句话总结**

```text
root  = 根目录 + 完整 URI
alias = 别名目录 + 去掉匹配前缀后的 URI
```

因此，不能把 `alias` 理解成 `root` 的另一种写法。两者解决的问题不同。

## 十四、root 与 alias 路径推导练习

**示例一**

配置：

```nginx
location /static/ {
    root /var/www;
}
```

请求：

```text
/static/css/app.css
```

最终路径：

```text
/var/www/static/css/app.css
```

**示例二**

配置：

```nginx
location /static/ {
    alias /var/www/;
}
```

请求：

```text
/static/css/app.css
```

去掉 `/static/` 后，剩余：

```text
css/app.css
```

最终路径：

```text
/var/www/css/app.css
```

**示例三**

配置：

```nginx
location /assets/ {
    alias /data/frontend-assets/;
}
```

请求：

```text
/assets/images/logo.png
```

最终路径：

```text
/data/frontend-assets/images/logo.png
```

## 十五、故意制造错误：用 root 替代 alias

将原来的配置：

```nginx
location /download/ {
    add_header X-Matched-Location "download-alias";
    alias /data/files/;
}
```

修改为：

```nginx
location /download/ {
    add_header X-Matched-Location "download-root";
    root /data/files;
}
```

检查并重新加载：

```bash
docker exec nginx-stage1-chapter2 nginx -t
docker compose down
docker compose up -d
```

访问：

```bash
curl -i http://localhost:8080/download/report.txt
```

结果通常是：

```text
HTTP/1.1 404 Not Found
Server: nginx/1.28.3
Content-Type: text/html

<html>
<head><title>404 Not Found</title></head>
<body>
<center><h1>404 Not Found</h1></center>
<hr><center>nginx/1.28.3</center>
</body>
</html>
```

**为什么实际文件存在，却返回 404？**

因为文件真实位置是：

```text
/data/files/report.txt
```

但当前使用的是 `root`。

Nginx 会计算：

```text
/data/files
+
/download/report.txt
=
/data/files/download/report.txt
```

目标路径变成：

```text
/data/files/download/report.txt
```

这个文件不存在，所以返回 `404`。

**查看 Nginx 错误日志**

执行：

```bash
docker exec -it nginx-stage1-chapter2 /bin/sh
cat /var/log/nginx/error.log
```

因此，当静态文件返回 `404` 时，不要先盲目重启 Docker，也不要立即怀疑浏览器缓存。

正确排查顺序应该是：

```text
请求 URI
  ↓
命中的 location
  ↓
root 或 alias
  ↓
推导文件路径
  ↓
查看 error log
  ↓
检查容器中的文件
```

实验结束后，将配置恢复为：

```nginx
location /download/ {
    add_header X-Matched-Location "download-alias";
    alias /data/files/;
}
```

然后执行：

```bash
docker exec nginx-stage1-chapter2 nginx -t
docker compose down
docker compose up -d
```

## 十六、故意制造错误：alias 末尾缺少斜杠

正确配置：

```nginx
location /download/ {
    alias /data/files/;
}
```

故意修改成：

```nginx
location /download/ {
    alias /data/files;
}
```

注意：

```text
/data/files/
```

变成了：

```text
/data/files
```

末尾少了 `/`。

执行：

```bash
docker exec nginx-stage1-chapter2 nginx -t
```

此时配置语法可能仍然正确。

这说明：

> 语法正确不代表业务路径正确。

继续执行：

```bash
docker compose down
docker compose up -d
```

然后访问：

```bash
curl -i http://localhost:8080/download/report.txt
```

可能返回：

```text
404 Not Found
```

Nginx 可能尝试读取类似：

```text
/data/filesreport.txt
```

因为目录路径和剩余 URI 被错误连接。

对于目录型 `alias`，一般应该让两边保持一致：

```nginx
location /download/ {
    alias /data/files/;
}
```

也就是：

```text
location 以 / 结尾
alias 目录也以 / 结尾
```

这样替换关系最直观：

```text
/download/ 替换为 /data/files/
```

实验完成后恢复正确配置。

## 十七、目录请求与 index 文件

配置：

```nginx
location / {
    root /usr/share/nginx/html;
    index index.html;
}
```

访问：

```bash
curl -i http://localhost:8080/about/
```

请求 URI：

```text
/about/
```

它会进入：

```nginx
location /
```

`root` 首先计算目录路径：

```text
/usr/share/nginx/html
+
/about/
=
/usr/share/nginx/html/about/
```

因为配置中存在：

```nginx
index index.html;
```

Nginx 会继续查找：

```text
/usr/share/nginx/html/about/index.html
```

最终返回 About 页面。

完整链路如下：

```text
请求 /about/
  ↓
没有精确匹配
  ↓
/images/ 不匹配
  ↓
/download/ 不匹配
  ↓
进入 location /
  ↓
root + URI
  ↓
/usr/share/nginx/html/about/
  ↓
index 指定 index.html
  ↓
读取 /usr/share/nginx/html/about/index.html
  ↓
返回 200
```

**不带斜杠的目录请求**

执行：

```bash
curl -i http://localhost:8080/about
```

可能会看到：

```text
HTTP/1.1 301 Moved Permanently
Location: http://localhost/about/
```

随后浏览器会重新请求：

```text
http://localhost/about/
```

这是因为 `/about` 对应的是一个目录。Nginx 通常会把目录地址重定向为带 `/` 的形式。

最终真正读取的仍然是：

```text
/usr/share/nginx/html/about/index.html
```

但是在 Docker 端口映射场景下可能出现一个问题：访问 `http://my-ip:8080/about` 后，被重定向到 `http://my-ip/about`，最终页面展示 `404`。

原因是默认 `absolute_redirect on`，Nginx 可能返回绝对地址。可以在 `server` 中设置：

```nginx
absolute_redirect off;
```

这样 Nginx 会返回相对地址：

```text
Location: /about/
```

最终请求链路是：

```text
请求 http://localhost:8080/about
  ↓
Docker 8080 → 80
  ↓
进入 location /
  ↓
root 映射发现目标是目录
/usr/share/nginx/html/about
  ↓
URI 没有结尾 /
  ↓
Nginx 自动返回 301
  ↓
absolute_redirect off 生效
  ↓
Location: /about/
  ↓
客户端基于原 URL 解析相对地址
  ↓
http://localhost:8080/about/
  ↓
再次进入 Nginx
  ↓
index index.html
  ↓
/usr/share/nginx/html/about/index.html
  ↓
200
```

| 配置 | `/about` 返回的 Location |
| --- | --- |
| 默认配置 | 可能为 `http://localhost/about/` |
| `port_in_redirect off` | 不等于保留外部 `8080` |
| `absolute_redirect off` | `/about/` |

## 十八、如何通过响应头证明 location 匹配结果

如果只通过页面内容判断匹配结果，证据是不充分的。

例如两个 `location` 都可能返回相同内容，此时很难判断请求真正进入了哪一个配置块。因此，可以为不同的 `location` 添加不同的响应头：

```nginx
location = /exact {
    add_header X-Matched-Location "exact";
}

location /images/ {
    add_header X-Matched-Location "images-prefix";
}

location /download/ {
    add_header X-Matched-Location "download-alias";
}

location / {
    add_header X-Matched-Location "root-prefix";
}
```

执行：

```bash
curl -i http://localhost:8080/download/report.txt
```

通过下面的响应头就能判断：

```text
X-Matched-Location: download-alias
```

这是一种非常实用的调试方法。

不过要注意，`add_header` 默认可能不会在所有状态码中返回。例如 `404` 或 `403` 时，响应头可能不出现。

可以增加 `always`：

```nginx
add_header X-Matched-Location "root-prefix" always;
```

这样即使返回 `404`，也更容易看到匹配结果。

## 十九、增强访问日志

默认访问日志通常只能看到：

- 请求方法
- 请求 URI
- HTTP 状态码
- 返回字节数
- User-Agent

但无法直接知道请求进入了哪个 `location`。

我们可以定义自定义日志格式：

```nginx
log_format chapter2 '$remote_addr "$request" status=$status '
                    'uri=$uri matched=$sent_http_x_matched_location';
```

然后在 `server` 中使用：

```nginx
access_log /var/log/nginx/access.log chapter2;
```

完整配置开头可以写成：

```nginx
log_format chapter2 '$remote_addr "$request" status=$status '
                    'uri=$uri matched=$sent_http_x_matched_location';

server {
    listen 80;
    server_name localhost;

    access_log /var/log/nginx/access.log chapter2;
    error_log /var/log/nginx/error.log notice;
}
```

修改后执行：

```bash
docker exec nginx-stage1-chapter2 nginx -t
docker exec nginx-stage1-chapter2 nginx -s reload
```

发送几个请求：

```bash
curl http://localhost:8080/exact
curl http://localhost:8080/images/root-logo.txt
curl http://localhost:8080/download/report.txt
curl http://localhost:8080/not-found
```

查看日志：

```bash
docker logs nginx-stage1-chapter2
```

也可以直接查看容器内日志文件：

```bash
docker exec nginx-stage1-chapter2 tail -n 20 /var/log/nginx/access.log
```

## 二十、最终完整配置

完成全部实验后，建议将配置整理为：

```nginx
log_format chapter2 '$remote_addr "$request" status=$status '
                    'uri=$uri matched=$sent_http_x_matched_location';

server {
    listen 80;
    server_name localhost;

    absolute_redirect off;

    access_log /var/log/nginx/access.log chapter2;
    error_log /var/log/nginx/error.log notice;

    location = /exact {
        add_header X-Matched-Location "exact" always;
        return 200 "matched: exact location\n";
    }

    location /images/private/ {
        add_header X-Matched-Location "images-private" always;
        return 403 "private resources are forbidden\n";
    }

    location /images/ {
        add_header X-Matched-Location "images-prefix" always;
        root /usr/share/nginx/html;
    }

    location /download/ {
        add_header X-Matched-Location "download-alias" always;
        alias /data/files/;
    }

    location / {
        add_header X-Matched-Location "root-prefix" always;
        root /usr/share/nginx/html;
        index index.html;
    }
}
```

## 二十一、最终请求链路总图

以这个请求为例：

```text
http://localhost:8080/download/report.txt
```

完整链路：

```text
curl / 浏览器
  ↓
访问宿主机 localhost:8080
  ↓
Docker 端口映射 8080 → 容器 80
  ↓
Nginx server 监听 80
  ↓
提取 URI：/download/report.txt
  ↓
检查 location = /exact，不匹配
  ↓
检查普通前缀
  /download/ 匹配
  / 也匹配
  ↓
选择更长的 /download/
  ↓
alias /data/files/
  ↓
删除 URI 前缀 /download/
  ↓
剩余 report.txt
  ↓
映射为 /data/files/report.txt
  ↓
读取容器中的文件
  ↓
返回 HTTP 200
  ↓
Docker 将响应传回宿主机
  ↓
curl / 浏览器收到文件内容
```
