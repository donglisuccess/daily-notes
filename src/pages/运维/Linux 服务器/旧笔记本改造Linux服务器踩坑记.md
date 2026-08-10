最近我把一台闲置的 Windows 笔记本改造成了一台 Ubuntu Server，准备后续用于学习和实践：

- Linux
- Nginx
- Docker
- Jenkins
- CI/CD
- Kubernetes
- Sentry
- AI 服务部署

目前第一阶段已经完成：

> Ubuntu Server 裸机安装 + Wi-Fi + SSH + Tailscale + Nginx

整个过程看起来不复杂，但实际踩了不少坑。这篇文章主要记录这些问题，以及我是怎么解决的。

## 一、为什么我最终没有装虚拟机

最开始我的想法是在 Windows 中安装 Linux 虚拟机。

这台电脑配置大概是：

```text
CPU：Intel i7-9750H
内存：8GB
硬盘：512GB SSD
启动模式：UEFI
```

虚拟机当然可以跑，但问题也很明显：

```text
8GB 内存
  ↓
Windows 约占 3~5GB
  ↓
Linux 虚拟机再占 2~3GB
  ↓
剩余内存非常有限
```

而这台电脑本身已经不用了，所以最终选择：

> 直接删除 Windows，裸机安装 Ubuntu Server。

这样 Linux 可以独占整台机器的 CPU、内存和磁盘。

## 二、安装 Ubuntu Server 前先检查硬件

Windows 中按：

```text
Win + R
```

输入：

```text
msinfo32
```

重点确认：

- CPU
- 内存
- BIOS 模式
- 电脑型号

我的机器 BIOS 模式是：

```text
UEFI
```

因此后续 Rufus 制作启动盘时选择：

| 配置项 | 选择 |
| --- | --- |
| 分区类型 | `GPT` |
| 目标系统 | `UEFI` |

## 三、第一个坑：Windows 一个 Wi-Fi 都搜不到

安装 Linux 之前，我发现原 Windows 系统突然一个 Wi-Fi 都搜索不到。

打开：

```text
设备管理器
  ↓
网络适配器
```

看到无线网卡：

```text
Intel(R) Wireless-AC 9560 160MHz
```

但是设备前面有黄色感叹号。

打开属性后显示：

```text
该设备无法启动。（代码 10）
```

也就是：

```text
Code 10
```

这说明并不是电脑没有无线网卡，而是：

> Windows 已经识别到无线网卡硬件，但是设备驱动无法正常启动。

后来通过重新处理无线网卡驱动，Windows 网络恢复。

这里有个很重要的经验：

> 装 Linux 前发现 Wi-Fi 有问题，不要立刻判断无线网卡坏了。

首先要检查设备管理器里的错误代码。

## 四、制作 Ubuntu 启动 U 盘

我下载的是：

```text
Ubuntu Server 26.04 LTS amd64
```

然后使用 Rufus 制作启动 U 盘。

需要注意：

> 不是把 ISO 文件直接复制到 U 盘。

ISO 可以理解成：

```text
Ubuntu 安装光盘的电子版
```

Rufus 的作用是：

```text
Ubuntu ISO
  ↓
Rufus
  ↓
普通 U 盘
  ↓
可启动 U 盘
```

最终 Rufus 配置：

| 配置项 | 选择 |
| --- | --- |
| 设备 | `32GB U 盘` |
| 引导类型 | `ubuntu-26.04-live-server-amd64.iso` |
| 分区类型 | `GPT` |
| 目标系统 | `UEFI` |
| 文件系统 | `FAT32` |

然后点击：

```text
开始
```

## 五、从 U 盘启动 Ubuntu 安装程序

HP 笔记本启动时按：

```text
F9
```

进入 Boot Menu。

从 U 盘启动以后看到：

```text
Try or Install Ubuntu Server
Boot from next volume
UEFI Firmware Settings
```

选择：

```text
Try or Install Ubuntu Server
```

## 六、Ubuntu Server 安装选项

语言选择：

```text
English
```

我最终没有选中文环境。

原因是服务器里大量内容都是英文：

- 错误日志
- 命令
- Stack Overflow
- GitHub Issue
- 官方文档

服务器环境直接使用英文反而更方便。

**Ubuntu Server vs Minimized**

安装过程中会问：

```text
Ubuntu Server
Ubuntu Server (minimized)
```

我选择：

```text
Ubuntu Server
```

`Minimized` 会删除一些常用工具，适合追求极致轻量的服务器。学习环境没有必要。

## 七、Wi-Fi 网卡成功被 Ubuntu 识别

进入 Network configuration 后，Ubuntu 自动识别到了：

```text
Intel Wireless-AC 9560
```

对应接口：

```text
wlo1
```

因此以后查看网络可以执行：

```bash
ip a
```

## 八、Proxy 不需要填写

安装时会出现：

```text
Proxy configuration
```

普通家庭网络这里直接：

```text
留空
```

即可。

它并不是 Wi-Fi 配置。只有公司代理服务器等特殊网络环境才需要填写。

## 九、Ubuntu 软件源 Mirror

安装程序自动选择：

```text
http://cn.archive.ubuntu.com/ubuntu/
```

并提示：

```text
This mirror location passed tests.
```

说明软件源可以正常访问，因此直接继续。

## 十、磁盘分区：LVM 是什么

我选择：

```text
Use an entire disk
```

也就是说：

> 删除整个 Windows，把 512GB SSD 全部交给 Ubuntu。

同时保留：

```text
Set up this disk as an LVM group
```

没有开启：

```text
LUKS encryption
```

最终大概变成：

```text
512GB SSD
├── /boot/efi
│   └── 约 1GB
├── /boot
│   └── 约 2GB
└── LVM
    ├── /
    │   └── 约 100GB
    └── 剩余 300GB+
        └── 未分配
```

这时候我第一次发现：

> 明明有 512GB SSD，为什么 Linux 根目录只有约 100GB？

其实硬盘没有丢，因为使用了 LVM。

剩余空间被保留在：

```text
Volume Group
```

以后可以：

- 扩容 `/`
- 创建 `/data`
- 创建 `/docker`
- 创建 `/backup`

之类的新逻辑卷。

## 十一、创建 Linux 用户

我设置类似：

```text
用户名：dongli
主机名：home-server
```

所以以后登录后看到：

```bash
dongli@home-server:~$
```

这个格式其实很好理解：

```text
dongli       = 当前用户
home-server  = 服务器主机名
~            = 当前位于用户家目录
```

## 十二、SSH 一定要安装

安装过程中有：

```text
Install OpenSSH server
```

这里我选择安装。

这样安装完成以后，就不需要一直坐在旧笔记本前。

例如服务器 IP：

```text
192.168.100.7
```

Windows 可以直接：

```bash
ssh dongli@192.168.100.7
```

然后输入密码即可进入 Linux。

## 十三、第三方 NVIDIA 驱动没有安装

系统检测到了：

```text
nvidia-driver-595-server
```

但我的目标是：

- Linux
- Nginx
- Docker
- CI/CD
- 服务部署

暂时并不需要 CUDA 或 GPU 推理。

因此选择：

```text
Do not install third-party drivers now
```

减少不必要的驱动复杂度。

## 十四、Featured Server Snaps 全部跳过

Ubuntu 安装器还推荐了一些软件：

- MicroK8s
- Nextcloud
- Docker
- Mosquitto

这里全部没有选。

原因很简单：

> 我要自己一步一步安装，而不是让 Ubuntu 安装器替我全装好。

这样学习价值更大。

## 十五、第一次启动看到一堆 cloud-init 日志

安装结束后重启，第一次看到：

```text
cloud-init
Generating SSH keys
...
```

Ubuntu Server 第一次启动时会进行一些初始化操作：

- 初始化网络
- 创建 SSH Host Key
- 初始化服务
- 写入配置

最终进入：

```text
home-server login:
```

输入用户名和密码即可。

## 十六、ifconfig 为什么不存在

第一次查看 IP 时，下意识执行：

```bash
ifconfig
```

结果：

```text
Command 'ifconfig' not found
```

这是正常的。

现代 Ubuntu 默认已经不安装：

```text
net-tools
```

推荐使用：

```bash
ip a
```

或者：

```bash
ip addr
```

如果只是快速查看 IP：

```bash
hostname -I
```

更方便。

## 十七、合上笔记本盖子，服务器直接掉线

把笔记本当服务器后又发现：

> 盖上屏幕以后 SSH、Nginx、Tailscale 全断了。

原因：

```text
合盖
  ↓
Ubuntu Suspend
  ↓
CPU 进入休眠
  ↓
网络断开
  ↓
SSH 断开
```

解决方式是修改：

```bash
sudo nano /etc/systemd/logind.conf
```

设置：

```ini
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
```

然后重启：

```bash
sudo reboot
```

这样就可以：

```text
笔记本合盖
  ↓
屏幕关闭
  ↓
服务器继续运行
```

这个配置对于“旧笔记本改服务器”非常重要。

## 十八、我尝试安装 GUI，但最后又删了

因为一开始觉得纯命令行不习惯，所以尝试安装：

```bash
sudo apt install xubuntu-desktop -y
```

也就是 XFCE 桌面。

但装完以后体验并不好：

- 鼠标操作异常
- 增加资源占用
- 服务器其实也不需要 GUI

所以最终决定：

> 恢复纯 Ubuntu Server。

如果 GUI 卡住，可以按：

```text
Ctrl + Alt + F3
```

切换到 TTY。

然后卸载：

```bash
sudo apt purge xubuntu-desktop xubuntu-core xfce4 lightdm -y
sudo apt autoremove --purge -y
```

恢复命令行启动：

```bash
sudo systemctl set-default multi-user.target
```

然后：

```bash
sudo reboot
```

经过这一轮折腾，我对服务器为什么普遍不用 GUI 有了更直观的理解：

> GUI 对服务器不是“更高级”，反而是额外资源消耗。

## 十九、Ubuntu Server 默认没有 nmcli

在处理 Wi-Fi 时执行：

```bash
nmcli
```

发现：

```text
command not found
```

原因是 Ubuntu Server 默认不一定使用：

```text
NetworkManager
```

而是：

```text
Netplan
  +
systemd-networkd
```

因此网络配置主要位于：

```text
/etc/netplan/
```

我的配置文件：

```text
00-installer-config.yaml
```

## 二十、Netplan 配 Wi-Fi

配置大致类似：

```yaml
network:
  version: 2

  wifis:
    wlo1:
      access-points:
        "WiFi名称":
          password: "WiFi密码"
      dhcp4: true
```

修改完成以后：

```bash
sudo netplan generate
```

用于生成配置。

然后：

```bash
sudo netplan apply
```

应用配置。

还可以：

```bash
sudo netplan try
```

临时应用并等待确认。

## 二十一、Tailscale：不用公网 IP 也能远程访问服务器

家庭宽带最大的问题之一是：

```text
192.168.x.x
```

属于内网地址，外面无法直接访问。

本来可以搞：

- 公网 IP
- 端口映射
- DDNS

但家庭宽带可能还有：

```text
CGNAT
```

所以我最终使用：

```text
Tailscale
```

Ubuntu 安装以后会得到：

```text
100.x.x.x
```

这样的 Tailscale IP。

Windows 主力机也安装 Tailscale，并登录同一个账号。之后直接：

```bash
ssh dongli@100.x.x.x
```

即可连接家里的 Ubuntu。

甚至 Windows 连接手机热点以后依旧可以访问。

整个网络就像：

```text
Windows
  │
  │ Tailscale
  ↓
Ubuntu Home Server
```

这也是我第一次真正理解：

> 给分布在不同网络中的设备建立了一个虚拟私有网络。

## 二十二、安装 Nginx

安装 Nginx：

```bash
sudo apt update
sudo apt install nginx -y
```

查看：

```bash
systemctl status nginx
```

如果看到：

```text
active (running)
```

说明 Nginx 正常启动。

然后 Windows 浏览器访问：

```text
http://Tailscale-IP
```

就可以看到 Nginx 默认页面。

## 二十三、修改 Nginx 页面没生效

我一开始修改的是：

```text
/usr/share/html/index.html
```

但是浏览器页面完全没变化。

原因：

> 改错目录了。

Ubuntu 通过 `apt` 安装的 Nginx 默认站点目录通常是：

```text
/var/www/html
```

可以通过：

```bash
sudo nginx -T | grep -n "root "
```

确认真实目录。

然后修改：

```bash
sudo nano /var/www/html/index.html
```

修改后：

```text
不需要重启 Nginx
```

静态文件会立即生效。

如果浏览器仍然显示旧页面：

```text
Ctrl + F5
```

强制刷新。

## 二十四、Windows 如何把 HTML 传给 Linux

我还做了一个自定义主页。

Windows 上直接使用：

```powershell
scp C:\Users\xxx\Desktop\index.html dongli@100.x.x.x:/home/dongli/
```

然后服务器执行：

```bash
sudo cp ~/index.html /var/www/html/index.html
```

这样 Windows 文件就成功传到 Linux。

这也是非常实用的一个技能：

```text
SSH = 远程执行命令
SCP = 远程复制文件
```

## 二十五、目前最终架构

现在我的这台旧笔记本已经从：

```text
Windows 闲置电脑
```

变成：

```text
Ubuntu Home Server
├── Ubuntu Server 26.04
├── SSH
├── Tailscale
├── Nginx
├── Git
└── Node / NVM 准备中
```

访问方式：

```text
Windows 主力机
  │
  │ Tailscale
  ↓
Ubuntu Server
  ├── SSH
  └── HTTP
      ↓
    Nginx
```
