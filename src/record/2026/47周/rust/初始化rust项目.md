## 一、环境准备
**安装rust编译环境：** 
执行指令：
```shell
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```
**安装cargo：**
`cargo` 主要用于 `rust` 项目的依赖包的安装，可以将其类比于 `node` 项目中的`npm`, `python` 项目中的`pip`
**安装cargo-generate**
这个依赖包主要用于初始化项目模板。
安装指令：
```shell
cargo install cargo-generate
```
初始化项目：
```py
cargo generate xxxx
```
**安装pre-commit**
主要是用于在执行`git commit`时，进行的代码拦截检查。
`安装指令:`
```shell
pip install pre-commit
```
可以在项目根目录下编写`.pre-commit-config.yaml`文件，这里的内容可以自定义代码检查拦截规则。
**安装cargo-deny**
这个依赖包主要是用于检查`rust`项目下依赖包的安全性和合规性的依赖包，相关配置可以在项目根目录下的`deny.toml`中进行配置。
`安装指令：`
```shell
cargo install --locked cargo-deny
```
**安装typos**
`typos`这个依赖包是拼写检查工具。
`安装指令：`
```shell
cargo install typos-cli
```
**安装 git cliff**
这个依赖包主要用于做软件的`changlog`
`安装指令：`
```shell
cargo install  git cliff
```
**安装 cargo nextest**
`cargo nextest` 是一个 Rust 增强测试工具。
```shell
cargo install cargo-nextest --locked
```

## 二、运行项目
执行`cargo run` 可以运行项目。

## 三、项目打包
执行`cargo build --release` 进行项目打包，打包后会生成 `exe`文件（在window系统中）。
