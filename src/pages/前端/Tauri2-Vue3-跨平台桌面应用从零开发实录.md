# 从零到双平台安装包：Tauri 2 + Vue 3 桌面应用开发实录

> **目标**：从空目录开始，做一个 Tauri 2 桌面应用 `tauri-demo`——界面点击按钮获取当前电脑的设备序列号（SN），窗口支持自由拖拽缩放，最终产出 **Windows 安装包**和 **Linux 安装包（deb/rpm）**。
>
> **技术栈**（参照既有项目 `baiying-token-key` 的架构）：Tauri 2 + Vue 3 + TypeScript + Vite + Element Plus（自动按需导入）+ Sass + pnpm。
>
> **本文特色**：不只是成功路径，所有踩过的坑（GitHub 超时、PowerShell 黑窗口、SSH 拒绝连接、Node 版本不对、root/普通用户家目录隔离……）都原样保留，附原因分析和解法。



---

## 一、项目目标与技术选型

需求只有两条，但麻雀虽小五脏俱全：

1. 界面上点击按钮，获取当前电脑设备的 SN（BIOS 序列号）
2. 窗口可以自动拖动放大/缩小

选型完全对齐团队既有项目的架构，保证后续维护心智一致：

| 层     | 技术                                 | 说明                                                          |
| ----- | ---------------------------------- | ----------------------------------------------------------- |
| 桌面壳   | **Tauri 2.x**（Rust）                | 前端渲染交给系统 WebView，安装包比 Electron 小一个数量级（本文最终 deb 包仅 2.35 MiB） |
| 前端    | **Vue 3 + TypeScript**             | 脚手架模板 `vue-ts`                                              |
| 构建    | **Vite**（dev 端口固定 1420）            | Tauri 官方模板默认约定                                              |
| UI 库  | **Element Plus** + unplugin 自动按需导入 | 组件和 API 均免手写 import                                         |
| 包管理   | **pnpm**                           | 与既有项目一致，注意锁定大版本                                             |
| 前后端通信 | `@tauri-apps/api` 的 `invoke`       | 前端调 Rust 命令的唯一通道                                            |

## 二、总体路线图

整个流程拆成 8 步，每步做完验证再前进：

1. 环境自检（Windows 侧工具链）
2. 脚手架创建项目骨架
3. 首次运行 `pnpm tauri dev`，跑通全链路
4. 对齐架构：Element Plus + 自动按需导入
5. 核心功能：Rust 命令获取设备 SN
6. 窗口缩放配置
7. Windows 打包 + 安装验证
8. Linux 打包（Hyper-V Ubuntu 虚拟机）+ 安装验证

---

## 三、第 1 步：环境自检

```bash
node -v     # 期望 v20.19+ / v22.12+（Vite 7 的硬性要求）
pnpm -v     # 9.x 即可
rustc -V    # Tauri 2 最低要求 1.77.2
cargo -V
```

实测环境：`node v22.22.1`、`pnpm 9.15.4`、`rustc/cargo 1.99.1`，全部达标。

> 💡 **小坑**：node 的版本参数是**小写** `-v`，输成 `-V` 会报 `node: bad option: -V`。这是很多 CLI 工具的不一致之处：node/rustc 用 `-v` 或 `--version`，大小写含义各不相同，报错时先检查参数大小写。

## 四、第 2 步：脚手架创建项目

**这一步是干啥的**：用官方脚手架一次性生成"前端 + Rust 壳 + 粘合配置"三件套，比手工从零搭快且不易漏。

```bash
cd /d D:\project
pnpm create tauri-app@latest tauri-demo --template vue-ts --manager pnpm --identifier com.baiying.tauridemo --yes
```

参数详解：

| 参数                                   | 含义                                                            |
| ------------------------------------ | ------------------------------------------------------------- |
| `tauri-demo`                         | 项目名/目录名                                                       |
| `--template vue-ts`                  | **关键参数**：Vue 3 + TS 模板（别选错成 `vue` 或 `react-ts`）               |
| `--manager pnpm`                     | 包管理器                                                          |
| `--identifier com.baiying.tauridemo` | 应用唯一标识（反向域名格式），安装包与系统注册都用它。不指定会得到 `com.tauri.dev` 默认值，后续打包会告警 |
| `--yes`                              | 跳过交互提问                                                        |

生成的目录结构：

```
tauri-demo/
├── src/            ← 前端代码（Vue 组件）
├── src-tauri/      ← Rust 壳（后端逻辑、窗口配置、打包配置都在这）
│   ├── Cargo.toml        ← Rust 依赖清单
│   ├── tauri.conf.json   ← Tauri 核心：窗口/打包/构建钩子全在这
│   └── src/main.rs、lib.rs
├── package.json
├── vite.config.ts
└── tsconfig.json
```

模板自带的配置已经比较贴心：`vite.config.ts` 里预置了 Tauri 专属的 `port: 1420 + strictPort`（Tauri 要求固定端口）、`watch` 忽略 `src-tauri/**`（避免 Rust 编译产物触发前端热更新）、`clearScreen: false`（不遮挡 cargo 报错输出）。

## 五、第 3 步：首次运行——理解 Tauri dev 的双进程模型

```bash
cd tauri-demo
pnpm install      # 只装前端 npm 包
pnpm tauri dev    # 启动开发模式
```

`pnpm tauri dev` 在背后**同时干两件事**：

1. 按 `tauri.conf.json` 里的 `beforeDevCommand`（即 `pnpm dev`）启动 **Vite 开发服务器**（占用 1420 端口，提供前端页面）
2. 用 cargo **编译并运行 Rust 壳**，编译完弹出一个原生窗口，窗口里加载的就是 `http://localhost:1420`

首次编译需要几分钟到十几分钟——Tauri 及其依赖的上百个 Rust 库要从零编译一遍。产物缓存在 `src-tauri/target/`，以后增量编译只要几十秒。

dev 模式是常驻进程：改前端代码窗口热更新；改 Rust 代码自动重新编译并刷新窗口。停止按 `Ctrl+C`。

**验收**：弹出标题为 `tauri-demo` 的窗口，显示脚手架自带欢迎页（带一个 Greet 演示按钮——那正是 invoke 调 Rust 的示例）。

## 六、第 4 步：对齐架构——Element Plus 与自动按需导入

**这一步是干啥的**：引入 Element Plus，并配上"写 `<el-button>`、用 `ElMessage` 都不用 import"的自动按需导入机制（与既有项目完全同款）。

### 安装依赖

```bash
pnpm add element-plus @element-plus/icons-vue
pnpm add -D sass unplugin-auto-import unplugin-vue-components @types/node
```

### 替换 `vite.config.ts`

```ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    // JS API 自动导入：代码里直接写 ref / ElMessage，不用 import
    AutoImport({
      imports: ["vue"],
      resolvers: [ElementPlusResolver({ importStyle: "sass" })],
      dts: "src/auto-imports.d.ts",
    }),
    // 组件自动导入：模板里直接写 <el-button>，不用注册
    Components({
      resolvers: [ElementPlusResolver({ importStyle: "sass" })],
      dts: "src/components.d.ts",
    }),
  ],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  esbuild: {
    // 生产构建剔除 console/debugger
    drop: mode === "production" ? ["console", "debugger"] : [],
  },
}));
```

**两个关键设计点**：

- `dts: "src/auto-imports.d.ts"` —— 有意让类型声明生成到 `src/` 里（官方默认生成在项目根目录）。因为脚手架的 `tsconfig.json` 的 `include` 只覆盖 `src/**`，声明放进 src 就不用改 tsconfig，`vue-tsc` 类型检查也能认出自动导入的 API。
- `importStyle: "sass"` —— 组件样式按需经 Sass 编译引入，所以 `sass` 必须在 devDependencies 里，且不需要在 main.ts 全量引入 Element Plus 的 CSS。

**踩坑提醒**：启动时终端会刷一屏 **sass deprecation warning**，无害，忽略即可。另外 `vite.config.ts` 的改动**热更新不生效**，必须 `Ctrl+C` 重启 `pnpm tauri dev`。

**验收**：窗口出现 Element Plus 风格的蓝色圆角按钮（样式生效）；点击弹出绿色 ElMessage 提示条（API 自动导入生效）。

## 七、第 5 步：核心功能——Rust 命令获取设备 SN

**这一步是干啥的**：补上"前端按钮 → Rust 后端 → 返回结果"的完整链路。读 SN 没有跨平台现成 API，Rust 端按平台分别实现。

### 7.1 平台方案选择

- **Windows**：通过 PowerShell 查询 WMI 的 `Win32_BIOS.SerialNumber`（BIOS 里的整机序列号）。  
  **为什么不用 `wmic`**：wmic 是老工具，在 Windows 11 24H2 及以后版本已被移除，PowerShell 则各版本都有。
- **Linux**：硬件 SN 在 `/sys/class/dmi/id/product_serial`，但该文件**只有 root 能读**（权限 0400 root:root）。普通用户运行时读不到，所以做降级：读不到就退回 `/etc/machine-id`（OS 层机器标识，人人可读），并在返回值里明确标注它不是硬件 SN。

### 7.2 Rust 端完整代码（`src-tauri/src/lib.rs`）

```rust
// Tauri 命令：前端通过 invoke 调用，宏会把函数暴露给页面
#[tauri::command]
fn get_device_sn() -> Result<String, String> {
    get_sn()
}

// ----- 平台各自的实现 -----

#[cfg(target_os = "windows")]
fn get_sn() -> Result<String, String> {
    // CREATE_NO_WINDOW：不给子进程分配控制台窗口，避免点击按钮时闪黑框
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    use std::os::windows::process::CommandExt;

    // 不用 wmic：它在较新版本的 Windows 11 中已被移除；PowerShell 各版本都有
    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "(Get-CimInstance -ClassName Win32_BIOS).SerialNumber",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("启动 PowerShell 失败: {e}"))?;

    if !output.status.success() {
        return Err(format!(
            "查询失败（退出码 {:?}）：{}",
            output.status.code(),
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    let sn = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if sn.is_empty() {
        Err("查询成功但序列号为空（该机器可能未写入 SN）".into())
    } else {
        Ok(sn)
    }
}

#[cfg(target_os = "linux")]
fn get_sn() -> Result<String, String> {
    // 硬件 SN 在 sysfs 中，普通用户无权读取（0400 root:root），root/sudo 才能读到
    if let Ok(s) = std::fs::read_to_string("/sys/class/dmi/id/product_serial") {
        let s = s.trim().to_string();
        if !s.is_empty() {
            return Ok(s);
        }
    }
    // 降级：machine-id 普通用户可读，但它是 OS 级标识，不是硬件 SN
    match std::fs::read_to_string("/etc/machine-id") {
        Ok(id) => {
            let id = id.trim().to_string();
            if id.is_empty() {
                Err("无法获取序列号（machine-id 也为空）".into())
            } else {
                Ok(format!("{id}  （注：这是 machine-id；读取硬件 SN 需要 root 权限）"))
            }
        }
        Err(e) => Err(format!("无法获取序列号: {e}")),
    }
}

// 其余平台不在本 demo 范围内
#[cfg(not(any(target_os = "windows", target_os = "linux")))]
fn get_sn() -> Result<String, String> {
    Err("不支持的平台".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // 新命令必须在这里登记，否则前端 invoke 会报 "command not found"
        .invoke_handler(tauri::generate_handler![get_device_sn])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Tauri 命令机制的三个关键点（核心套路）**：

1. `#[tauri::command]` —— 把普通 Rust 函数暴露给前端；返回值 `Result<String, String>` 中 `Err(String)` 会变成前端 Promise 的失败原因
2. `generate_handler![get_device_sn]` —— 命令注册表。**加了命令忘了登记，是新手最常见的报错来源**
3. 前后端函数名靠字符串对应：前端 `invoke("get_device_sn")` ↔ Rust 的 `fn get_device_sn`

### 7.3 前端（`src/App.vue`）

```vue
<script setup lang="ts">
import { invoke } from "@tauri-apps/api/core";

const sn = ref("");      // ref / ElMessage 由插件自动导入，无需手写
const loading = ref(false);

async function fetchSn() {
  loading.value = true;
  sn.value = "";
  try {
    sn.value = await invoke<string>("get_device_sn");
    ElMessage.success("SN 获取成功");
  } catch (err) {
    // Rust 端 Result 的 Err(String) 会走到这里
    ElMessage.error(String(err));
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="container">
    <h1>tauri-demo</h1>
    <el-card class="box-card">
      <template #header>设备序列号（SN）</template>
      <el-button type="primary" :loading="loading" @click="fetchSn">
        {{ loading ? "查询中…" : "获取设备 SN" }}
      </el-button>
      <p v-if="sn" class="sn-value">{{ sn }}</p>
    </el-card>
  </main>
</template>

<style scoped>
.container {
  padding-top: 10vh;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.box-card { width: 420px; }
.sn-value {
  margin-top: 14px;
  font-family: Consolas, monospace;
  font-size: 16px;
  font-weight: 600;
  word-break: break-all;
}
</style>
```

**交互细节**：`:loading="loading"` 让按钮在查询期间转圈并禁点——PowerShell 冷启动要 1~2 秒，必须给用户反馈。

**验收（Windows）**：点按钮 → 转圈 1~2 秒 → 绿色提示 + 卡片显示 BIOS 序列号，可与机身标签对照。

## 八、第 6 步：窗口缩放配置

Tauri 窗口**默认就是可缩放的**，这一步的价值是显式声明（配置即文档）并加边界约束——正式应用不能让用户把窗口拖到没法用。

修改 `src-tauri/tauri.conf.json` 的 `app.windows`：

```json
"windows": [
  {
    "title": "tauri-demo",
    "width": 800,
    "height": 600,
    "minWidth": 500,
    "minHeight": 400,
    "resizable": true,
    "center": true
  }
]
```

| 键                        | 含义                                                                          |
| ------------------------ | --------------------------------------------------------------------------- |
| `width` / `height`       | 初始尺寸，单位是**逻辑像素**。150% DPI 缩放的屏上 800 逻辑像素 = 1200 物理像素。用逻辑像素才能在不同 DPI 屏幕上观感一致 |
| `minWidth` / `minHeight` | 缩放下限，拖到 500×400 被顶住                                                         |
| `resizable`              | 允许拖边角缩放与最大化，默认 `true`，显式写出便于日后阅读                                            |
| `center`                 | 启动时窗口在屏幕居中                                                                  |

**验收四条**：边角拖动正常且布局自适应；拖小被卡在约 500×400；重启后窗口居中；最大化下功能不受影响。

> 注意：`tauri.conf.json` 是被 Rust 宏 `generate_context!` 编译进程序的，改动会触发一次 Rust 重编译。


## 九、第 7 步：Windows 打包与安装验证

### 9.1 构建三阶段

不需要改任何配置（脚手架已设 `"bundle": {"active": true, "targets": "all"}`），先停掉 dev（构建与 dev 共用编译目录，会互相等锁），然后：

```bash
pnpm tauri build
```

按顺序干三件事：

1. **构建前端**：`beforeBuildCommand`（`vue-tsc --noEmit && vite build`）——先过 TypeScript 类型检查，再产出压缩静态文件到 `dist/`
2. **Rust release 编译**：按 `[profile.release]` 优化（`lto = true`、`codegen-units = 1`、`strip = true` 等），比 dev 慢得多（实测 6 分钟）
3. **生成安装包**：Windows 上默认产出 NSIS `.exe` 安装程序与 WiX `.msi`（首次会自动下载 WiX 和 NSIS 两个打包工具）

### 9.2 三种产物形态怎么选

| 产物 | 路径 | 特点 |
|---|---|---|
| NSIS 安装程序 | `bundle\nsis\tauri-demo_0.1.0_x64-setup.exe` | 向导式安装，开始菜单快捷方式 + 卸载器，消费级软件最常用 |
| MSI 安装包 | `bundle\msi\tauri-demo_0.1.0_x64_en-US.msi` | Windows Installer 标准，企业域批量部署常用 |
| 裸可执行文件 | `target\release\tauri-demo.exe` | 单文件绿色版，双击即用，无需安装 |

**裸 exe 的一个重要前提——WebView2 运行时**：Tauri 应用本身不含浏览器内核，渲染靠系统的 WebView2：

- Windows 11：自带，100% 能跑
- Windows 10：装了 Edge 或近期更新过系统就自带；少数纯净老系统没有，裸 exe 会打不开界面
- **NSIS/MSI 安装包的核心优势**正在这里：检测到目标机器缺 WebView2 时会自动下载安装，还提供快捷方式与卸载器

**结论**：团队内部分发直接发 exe 完全可行（与既有项目"直接打包 exe 而非安装包"的决策一致）；面向不特定用户的对外分发用安装包更稳妥。

### 9.3 坑一：打包工具下载超时（`timeout: global`）

构建日志在编译成功后报错：

```
Downloading https://github.com/wixtoolset/wix3/releases/download/wix3141rtm/wix314-binaries.zip
failed to bundle project: `timeout: global`
```

**原因**：生成 MSI 需要 WiX 工具集，Tauri 首次打包自动从 GitHub 下载，国内网络访问 GitHub 超时。注意 **Rust 编译已经成功、应用本体已产出**，失败的只是最后的打包工具下载环节。

**解法三选一**：

1. **代理（最推荐）**：在代理工具开启的情况下，构建前设置：
   ```bash
   set HTTP_PROXY=http://127.0.0.1:7890
   set HTTPS_PROXY=http://127.0.0.1:7890
   pnpm tauri build
   ```
   （`set` 只对当前 cmd 窗口生效，端口按实际代理工具修改。）
2. **镜像环境变量**：
   ```bash
   set TAURI_BUNDLER_TOOLS_GITHUB_MIRROR=https://ghfast.top
   pnpm tauri build
   ```
   这类加速镜像站时效不稳定，失败就换前缀重试。
3. **手动放置**：浏览器下载 `wix314-binaries.zip`（浏览器走 GitHub CDN 通常能成功），解压到 `C:\Users\<用户>\AppData\Local\tauri\WixTools314\`，要求 `candle.exe` 直接位于该目录（不能嵌套子文件夹）。NSIS 阶段同理，工具会缓存在 `AppData\Local\tauri\NSIS`。

工具一旦缓存，**以后构建不再联网**，代理变量也不用再设。重跑构建时 Rust 有缓存，几秒就跳到打包环节。

**附加知识**：无代码签名的安装包首次运行会弹蓝色警告"Windows 已保护你的电脑"——点"更多信息 → 仍要运行"即可（正式产品需要购买代码签名证书，demo 不必）。

### 9.4 坑二：点击按钮闪 PowerShell 黑窗口

**现象**：正式版 exe 里点"获取设备 SN"，屏幕闪出一个 PowerShell 黑窗口随即消失（dev 模式没有这个现象）。

**原因**：PowerShell 是控制台程序，启动它系统会分配控制台窗口。dev 模式下应用从终端启动，子进程复用终端窗口所以看不到；正式版因 `main.rs` 顶部有 `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]`（图形程序、无控制台），给子进程分配的窗口就只能新弹一个——就是闪的黑框。

**解法**：给子进程加 Windows 创建标志 `CREATE_NO_WINDOW`（`0x08000000`），完整代码见第七章（`.creation_flags(CREATE_NO_WINDOW)` 一行 + `use std::os::windows::process::CommandExt`）。改完重跑 `pnpm tauri build`（工具已缓存，不需要代理变量；增量编译 1~2 分钟）。

**收尾提醒**：如果系统里已装过旧版本，要重跑新的 `setup.exe` 覆盖安装，否则装的还是带 bug 的旧代码。

## 十、第 8 步：Linux 打包（Hyper-V Ubuntu 虚拟机）

### 10.1 为什么必须用 Linux 环境

**硬约束：Tauri 无法在 Windows 上交叉编译出 Linux 安装包**，必须在 Linux 里构建。方案：Windows 上的 Hyper-V 装 Ubuntu 虚拟机（实测 Ubuntu 24.04）。

> 版本要求：**Ubuntu 22.04+**。Tauri 2 依赖 `libwebkit2gtk-4.1`，这个包 22.04 才开始有。
> 资源建议：内存 ≥ 4G（Rust release 编译吃内存，2G 可能被 OOM 杀进程）、磁盘 ≥ 10G。
> Hyper-V 对 Linux 客户机没有拖拽文件/共享剪贴板等便利功能，传文件走网络。

### 10.2 8a：源码传输——tar 打包 + scp 推送

**不能直接拷整个项目文件夹**：`node_modules/` 和 `src-tauri/target/` 有几个 GB，且 Linux 构建要求所有依赖在 Linux 下重装（二进制不通用），带过去纯属浪费。

**① Windows 打源码包（排除依赖目录）：**

```bash
cd D:\project
tar -a -cf tauri-demo-src.tar.gz --exclude node_modules --exclude dist --exclude target tauri-demo
dir tauri-demo-src.tar.gz
```

- Windows 自带 `tar` 支持 `-a` 按扩展名自动压缩
- **自检点**：压缩包应只有几百 KB；若有几百 MB 说明排除没生效

**② Ubuntu 开 SSH + 查 IP：**

```bash
sudo apt update && sudo apt install -y openssh-server
sudo systemctl enable --now ssh
sudo systemctl status ssh        # 看到绿色 Active: active (running)
sudo ss -tln | grep :22          # 确认 22 端口在监听
hostname -I                      # 记下 IP，如 172.26.224.125
lsb_release -a                   # 确认版本 22.04/24.04
```

**③ Windows 推送（Windows 10/11 自带 scp，无需安装）：**

```bash
scp D:\project\tauri-demo-src.tar.gz dongli@172.26.224.125:~/
```

> 💡 **小坑**：scp 命令 IP 后面**必须有冒号和路径**（`:~/` 表示用户主目录），漏了会直接报错。首次连接提示指纹输 `yes`；输密码时屏幕不显示任何字符是正常的。

**④ Ubuntu 解压验证：**

```bash
cd ~
tar -xzf tauri-demo-src.tar.gz
ls tauri-demo        # 应看到 package.json、src、src-tauri
```

### 10.3 8b：安装构建依赖（镜像三件套）

全程思路与 Windows 侧一致，**系统库走 apt 镜像、Node/npm 走 npmmirror、Rust 走 rsproxy**，全程不需要代理。

#### 前置：apt 换清华镜像源

Ubuntu 24.04 的源配置在 `/etc/apt/sources.list.d/ubuntu.sources`（DEB822 新格式）：

```bash
sudo cp /etc/apt/sources.list.d/ubuntu.sources /etc/apt/sources.list.d/ubuntu.sources.bak
sudo sed -i 's|http://cn.archive.ubuntu.com/ubuntu|https://mirrors.tuna.tsinghua.edu.cn/ubuntu|g' /etc/apt/sources.list.d/ubuntu.sources
sudo apt update
```

> 💡 **习惯**：改配置文件前先做 `.bak` 备份，出问题随时回滚。

#### B0：检查虚拟机资源

```bash
free -h      # 内存 ≥ 4G
df -h ~      # 磁盘 ≥ 10G
nproc        # CPU 核数
```

#### B1：Tauri 的 Linux 系统依赖

```bash
sudo apt install -y build-essential curl wget file libssl-dev \
  libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev \
  libxdo-dev patchelf libfuse2
```

关键包说明：

- `libwebkit2gtk-4.1-dev` —— **最重要**。Linux 版 Tauri 的"WebView2"，界面渲染内核，缺了直接编译失败
- `build-essential` —— gcc/g++ 工具链（对应 Windows 的 VS Build Tools）
- `libssl-dev` / `librsvg2-dev` / `libxdo-dev` —— Tauri 依赖库要链接的系统组件
- `patchelf` + `libfuse2` —— AppImage 打包与运行

#### B2：Node 22 + pnpm

Ubuntu 自带的 apt Node（18.x）太老，**Vite 7 硬性要求 Node ^20.19.0 或 ≥22.12.0**，用 NodeSource 源装：

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x -o nodesource_setup.sh
sudo bash nodesource_setup.sh
sudo apt install -y nodejs
node -v        # 期望 v22.x

sudo npm config set registry https://registry.npmmirror.com
sudo npm install -g pnpm@9     # 锁 9.x，与 Windows 侧版本一致
pnpm -v
```

> 💡 **为什么 pnpm 锁 9.x**：保证 Windows 与 Linux 生成的 `pnpm-lock.yaml` 版本互相兼容，避免锁文件格式漂移。
>
> 💡 **NodeSource 失败的兜底方案**（deb.nodesource.com 国内偶尔抽风），走 npmmirror 手动装：
> ```bash
> cd /tmp
> wget https://registry.npmmirror.com/-/binary/node/v22.12.0/node-v22.12.0-linux-x64.tar.xz
> tar -xJf node-v22.12.0-linux-x64.tar.xz -C /usr/local --strip-components=1
> node -v && npm -v
> ```
> 原理：解压进 `/usr/local`，其 bin 目录在 PATH 里排在 apt 的前面，自动覆盖旧版。

#### B3：Rust（rustup + rsproxy 国内镜像）

**坚决不用 `apt install rustc`（1.75 太老）或 `snap install rustup`（非官方机制）**，只用 rustup 官方脚本：

```bash
export RUSTUP_DIST_SERVER=https://rsproxy.cn
export RUSTUP_UPDATE_ROOT=https://rsproxy.cn/rustup
curl --proto '=https' --tlsv1.2 -sSf https://rsproxy.cn/rustup-init.sh -o rustup-init.sh
sh rustup-init.sh -y --default-toolchain stable
source "$HOME/.cargo/env"
rustc -V && cargo -V
```

cargo 的依赖库（crates.io）下载也切镜像——创建 `~/.cargo/config.toml`：

```toml
[source.crates-io]
replace-with = 'rsproxy-sparse'

[source.rsproxy-sparse]
registry = "sparse+https://rsproxy.cn/index/"
```

> 💡 **为什么重要**：没有它，cargo 去官方 crates.io 拉上百个依赖，国内网络大概率卡死。

#### B4：自检清单

```bash
node -v                                   # v22.x
pnpm -v                                   # 9.x
rustc -V                                  # 1.8x+
cargo -V
pkg-config --modversion webkit2gtk-4.1    # 能打印 2.4x.x 说明核心系统库就位
free -h                                   # 内存 ≥ 4G
```

### 10.4 8c：构建 deb + rpm

**策略先行**：Linux 上 `targets: "all"` 会打 deb / rpm / AppImage 三种包，其中 **AppImage 的打包工具 linuxdeploy 只能从 GitHub 下载**（Windows 那个超时坑在 Linux 重演）。所以先只打 deb + rpm（不需要下载任何工具），打成功后再单独攻克 AppImage，把网络问题隔离在小范围。

```bash
cd ~/tauri-demo
npm config set registry https://registry.npmmirror.com
pnpm install
pnpm tauri build --bundles deb,rpm
```

- 前端类型检查 + Vite 构建几十秒（`vue-tsc` 能过说明 Linux 侧 TS 环境正常）
- Rust release 编译首次需要一段时间（依赖从零下载+编译，LTO 优化吃 CPU），期间刷大量 `Compiling xxx` 正常
- 若报 `signal: Killed` 或 `out of memory`——虚拟机内存不够被系统杀进程，加内存或加 swap 再战

产物：

```
src-tauri/target/release/bundle/deb/tauri-demo_0.1.0_amd64.deb   (2.35 MiB)
src-tauri/target/release/bundle/rpm/tauri-demo-0.1.0-1.x86_64.rpm (2.36 MiB)
```

### 10.5 8d：deb 安装验证

**deb 和 rpm 是什么**：Linux 世界的"安装程序"，与 Windows 的 setup.exe/.msi 完全对应：

| 包格式 | 适用系统 | 类比 | 生态工具 |
|---|---|---|---|
| deb | Ubuntu / Debian / 深度 / UOS | .msi | apt / dpkg |
| rpm | Fedora / CentOS / RHEL / openSUSE | 另一家的 .msi | dnf / yum |

包内含编译好的主程序、图标、应用菜单入口（`.desktop`）、版本元数据和**依赖声明**（安装时自动检查补齐 webkit2gtk 等运行库）。rpm 是给 Red Hat 系的成品，Ubuntu 上装不了也不需要装。

**安装**：

```bash
cd ~/tauri-demo
sudo apt install ./src-tauri/target/release/bundle/deb/tauri-demo_0.1.0_amd64.deb
```

> ⚠️ **经典陷阱**：路径开头的 `./` 不能省。`apt install` 不带 `./` 时把参数当"网上的包名"去远程仓库找，直接报"找不到软件包"；带 `./` 才表示本地文件。

**启动（两种方式都试）**：Super 键（Windows 徽标键）→ 搜 `tauri` → 点图标；或终端直接 `tauri-demo`。

**验收清单**：

1. 窗口正常渲染（webkit2gtk 在干活）
2. 点"获取设备 SN"→ **预期显示 machine-id 并带提示文字**——设计内行为：虚拟机的"硬件 SN"是 Hyper-V 虚拟的，且 sysfs 文件普通用户读不了，走了第 5 步的降级路径。想看"真 SN"：`sudo cat /sys/class/dmi/id/product_serial`（虚拟机大概率是 `None` 或空，反向验证了降级逻辑的必要性）
3. 缩放有最小尺寸限制、启动居中（第 6 步配置跨平台生效）
4. 卸载：`sudo apt remove tauri-demo`，应用菜单图标消失

### 10.6 Linux 侧踩坑实录（三连）

**坑一：`ssh: connect to host ... port 22: Connection refused`**

scp 推送被拒。**报错本身就有诊断价值**：refused（拒绝）说明网络通、IP 对，但 22 端口没人监听——`openssh-server` 没装上或没启动（如果是 IP 错，报错会是 timed out 超时）。解法：

```bash
sudo apt install -y openssh-server
sudo systemctl enable --now ssh     # 装上 ≠ 启动，enable --now 别跳过
sudo systemctl status ssh
```

> 另一个坑中坑：`apt install` 卡住，是官方源在国外太慢——换清华镜像源（见 10.3 前置）后立刻正常。

**坑二：`node -v` 是 v18.19.1（NodeSource 没生效）**

跑了 `apt install nodejs` 但 NodeSource 源没加上，装到的还是 Ubuntu 自带的 18.x，而 Vite 7 直接拒绝跑。用 `apt policy nodejs` 看安装来源（出现 `deb.nodesource.com` 才说明源生效），重跑 NodeSource 脚本或走 npmmirror 手动装（见 B2 兜底）。

**坑三：`failed to run 'cargo metadata' ... No such file or directory`**

`pnpm tauri build` 时找不到 cargo 命令。两种可能：

- Rust 装了但**当前终端 PATH 没加载**：`source "$HOME/.cargo/env"` 立即修复（以后新终端自动生效）
- Rust 在 **root 的家目录**装的，当前是普通用户：`ls ~/.cargo/bin` 为空即确诊，在当前用户下重新装一遍 rustup

**连带教训（本文最重要的 Linux 坑）**：操作中途从 `root@ubuntu-dev` 切到 `dongli@ubuntu-dev`，root 装的东西全在 root 的家目录（如 Rust 在 `/root/.cargo`），普通用户的 PATH 里根本没有——工具"消失"了不是丢了，是各用户家目录隔离。**日常构建用普通用户跑**，这既是标准做法也避免权限混乱；确认"当前是谁"最简单的办法就是看终端提示符前缀。

## 十一、踩坑速查表

| # | 症状 | 原因 | 解法 |
|---|---|---|---|
| 1 | `node: bad option: -V` | node 版本参数是小写 `-v` | 用 `-v` |
| 2 | 打包报 `timeout: global`（下载 wix314-binaries.zip） | GitHub 访问超时 | 设 `HTTP(S)_PROXY` 代理，或 `TAURI_BUNDLER_TOOLS_GITHUB_MIRROR` 镜像，或手动放 `AppData\Local\tauri\WixTools314` |
| 3 | 正式版点按钮闪 PowerShell 黑框 | GUI 程序给控制台子进程分配了新窗口 | `Command` 加 `.creation_flags(0x08000000)`（CREATE_NO_WINDOW） |
| 4 | 双击裸 exe 在老系统打不开 | 缺 WebView2 运行时 | 用 NSIS/MSI 安装包（会自动补 WebView2） |
| 5 | 安装包弹"Windows 已保护你的电脑" | 无代码签名 | 更多信息 → 仍要运行；正式产品买证书签名 |
| 6 | `scp` 报 `Connection refused` | 22 端口没人监听（sshd 没装/没启动） | `apt install openssh-server` + `systemctl enable --now ssh` |
| 7 | `apt install` 卡住不动 | Ubuntu 官方源在国外 | 换清华镜像源（先备份配置文件） |
| 8 | `node -v` 是 v18 | apt 自带 Node；NodeSource 源没生效 | 重跑 NodeSource 脚本，或 npmmirror tarball 手动装；`apt policy nodejs` 验证 |
| 9 | `rustc/cargo: Command not found` | rustup 没装成功，或装在别的用户家目录 | 当前用户重装 rustup；已装则 `source ~/.cargo/env` |
| 10 | `failed to run 'cargo metadata'` | cargo 不在当前 PATH | 同上 |
| 11 | 换了用户后工具"消失" | root 与普通用户家目录隔离（`/root/.cargo` vs `~/.cargo`） | 在主力用户下安装；看终端提示符确认当前身份 |
| 12 | `apt install xxx.deb` 报找不到软件包 | 少了路径前缀 `./`，被当成远程包名 | `apt install ./xxx.deb` |
| 13 | Rust 编译被杀（`signal: Killed`） | 虚拟机内存不足（OOM） | 内存调到 4G+ 或加 swap |
| 14 | 启动刷屏 sass deprecation warning | Element Plus sass 样式的弃用警告 | 无害，忽略 |

## 十二、收工状态与待办

**已完成 ✅**

- Windows：dev 全链路、SN 功能、窗口缩放、NSIS/MSI/裸 exe 三产物、黑窗口修复、安装验证
- Linux（Hyper-V Ubuntu 24.04）：源码传输、依赖安装（镜像三件套）、deb/rpm 构建成功（2.35 MiB / 2.36 MiB）

**待办 ⏳**

- 8d 安装验证结果回填（deb 安装 → SN 降级路径 → 缩放 → 卸载）
- **AppImage 攻坚**：linuxdeploy 从 GitHub 下载需处理网络——优先试 `export TAURI_BUNDLER_TOOLS_GITHUB_MIRROR=https://ghfast.top`，不行则把 Windows 代理共享给虚拟机：代理工具开"允许局域网连接"，VM 里 `ip route show default` 查网关 IP（即 Windows 主机地址），然后 `export https_proxy=http://<主机IP>:7890` 再 `pnpm tauri build --bundles appimage`

## 附录 A：Tauri 前后端通信心智图

```
┌─────────────── WebView 窗口（前端）───────────────┐
│  <el-button @click="fetchSn">                     │
│      invoke<string>("get_device_sn")              │
│           │  Promise<string>                      │
└───────────┼───────────────────────────────────────┘
            │ IPC（进程间通信）
┌───────────▼─────────── Rust 壳（后端）────────────┐
│  #[tauri::command]                                │
│  fn get_device_sn() -> Result<String, String>     │
│      Ok(sn)  → Promise resolve                    │
│      Err(msg)→ Promise reject（前端 catch）        │
│  注册表：generate_handler![get_device_sn]          │
└───────────────────────────────────────────────────┘
```

## 附录 B：日常命令备忘

```bash
# Windows / Linux 通用
pnpm tauri dev                       # 开发模式
pnpm tauri build                     # 全量打包
pnpm tauri build --bundles deb,rpm   # 只打指定格式（Linux）
pnpm tauri build --bundles appimage  # 只打 AppImage（需处理 GitHub 下载）

# Linux 安装/卸载
sudo apt install ./tauri-demo_0.1.0_amd64.deb   # 注意 ./ 前缀
sudo apt remove tauri-demo

# Windows 裸 exe 位置
src-tauri\target\release\tauri-demo.exe
```
