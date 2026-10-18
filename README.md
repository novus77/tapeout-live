# TapeOut Live

轻量的 macOS 菜单栏 / Windows 系统托盘应用，用于查看 **BEM、FAB 全网数据与自己钱包地址关联的矿机数据**。打开面板即可查看，无需反复访问网页。

监控数据仅来自 [TapeOutScan](https://tapeoutscan.io/)。应用只需要公开钱包地址，**不需要私钥、助记词、连接钱包或签名，也不会提交交易**。

## 主要功能

- **BEM / FAB 切换**：一键切换全网概览和当前账户数据，两类项目的数据与缓存相互隔离。
- **全网概览**：展示代币价格、全网算力、已验证 / 未验证权重、每日发行量、已收录矿机数量。
- **我的矿机**：展示当前地址的算力、预计日产、矿机数量、最优席位和可获取的资产余额。
- **矿机明细（开发中，尚未发布）**：固定汇总区下方独立滚动，支持搜索、按算力 / 日产 / 编号排序，以及原地展开处理器地址、题号、最优席位和可用权重。BEM 分组会明确标识，不将未知口径的分组值当作单台产出；FAB 明细未加载完整时标示已加载 / 已收录数量。
- **多账户管理**：最多保存 20 个公开地址，可命名、编辑、切换或删除；支持为每个账户选择 BEM、FAB 或两者。
- **按项目筛选账户**：BEM 页面只列出带 BEM 标签的账户，FAB 同理；双选账户在两边都显示，各页面只展示对应项目的数据，不合并算力或余额。
- **紧凑固定面板**：420 × 520 逻辑尺寸，无需手动拖拽调整；支持多显示器定位和不同缩放比例。全网数据在上，账户数据在下。
- **外观与偏好**：暖白 / 烟色主题、跟随系统主题、中文 / English、开机启动、刷新频率、保持面板展开。
- **自动刷新与本地缓存**：后台获取数据并保存最近有效快照；接口异常或限流时进行退避重试，不把缺失数据伪装成零。
- **托盘右键菜单**：打开 TapeOut Live、查看当前安装版本（不可点击）、退出 TapeOut Live。

> 当前算力是 TapeOutScan 返回的该地址、该项目的算力汇总，单位显示为 H，不是电脑 CPU / GPU 的实时性能。预计日产为数据源估算，并非收益承诺。这里的矿机状态属于链上数据，不代表实体设备的温度、功耗或在线健康状态。

### 余额与数据限制

| 页面 | 余额展示 | 说明                                                |
| ---- | -------- | --------------------------------------------------- |
| BEM  | BEM、BNB | 按数据源返回值展示                                  |
| FAB  | FAB、OKB | FAB 按接口可用值展示；当前未接入 OKB 余额，显示 `—` |

数据尚未收录、接口未返回或快照延迟时，可能显示 `—`、等待数据或数据延迟。`—` 不代表余额或矿机数量为零。FAB 价格可能为参考换算报价，不应视为可直接成交的价格。

## 下载安装包

**v0.4.0 已正式发布**，打开 [Releases](https://github.com/novus77/tapeout-live/releases/tag/v0.4.0) 即可下载，无需从 Actions 查找测试产物。

| 系统                              | 安装包                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| macOS Apple Silicon（M 系列芯片） | [下载 DMG](https://github.com/novus77/tapeout-live/releases/download/v0.4.0/TapeOut.Live_0.4.0_aarch64.dmg)   |
| Windows x64                       | [下载 EXE](https://github.com/novus77/tapeout-live/releases/download/v0.4.0/TapeOut.Live_0.4.0_x64-setup.exe) |

本次没有提供 Intel Mac 安装包，DMG 不是通用架构包。Release 中的 `Source code` 是源码，不是安装程序。可使用同页的 `SHA256SUMS.txt` 校验下载完整性；校验和不能替代开发者签名。

本版为正式 Release，但**尚未配置开发者正式代码签名及 macOS 公证**，系统仍可能阻止启动。开发测试版本也可从 [Actions](https://github.com/novus77/tapeout-live/actions/workflows/desktop.yml) 获取，其产物保留 7 天，不等同于正式发布版本。

### macOS 安装

1. 使用 macOS 13 或更新系统，下载上方 DMG 安装包。
2. 确认电脑为 Apple Silicon（M 系列芯片），使用 `aarch64` / `arm64` 安装包；Intel Mac 不能使用本次发布的 DMG。
3. 打开 `.dmg`，将 **TapeOut Live.app** 拖入「应用程序」。
4. 从「应用程序」启动 **TapeOut Live**，点击屏幕顶部菜单栏图标打开面板；它不是需要常驻 Dock 的普通窗口。

本版尚未配置正式签名 / 公证，系统可能阻止启动。遇到安全提示时先停止安装并核实来源，或等待正式签名版本；不要关闭系统安全保护或运行来历不明的解除限制命令。

更新时先通过菜单栏图标右键菜单退出应用，再用新版替换「应用程序」中的旧版。账户和偏好保存在独立的应用数据目录，正常替换应用不会删除这些数据，重要配置仍建议先备份。

### Windows 安装

1. 初始支持目标为 **Windows 11 x64**；其他系统版本 / 架构尚未完成设备兼容性验证。
2. 下载上方 EXE 安装包，运行并按提示完成安装。当前为当前用户安装模式。
3. 如果安装程序提示缺少 **Microsoft Edge WebView2 Runtime**，请使用微软官方来源提供的运行时，并按提示安装。
4. 从开始菜单启动 **TapeOut Live**，在任务栏通知区域点击图标打开面板。如果看不到图标，请检查通知区域的隐藏图标列表。

当前构建尚未配置 Windows 正式代码签名。若系统或安全软件阻止运行，请先核实来源并等待维护者提供可信安装包，不要关闭系统防护。

更新前通过托盘图标右键菜单退出应用，再运行新版安装程序。不要主动删除应用数据目录，以免丢失已保存账户与偏好。

## 开始使用

### 1. 添加账户

点击右上角齿轮进入「设置」→「添加账户」：

1. 填写便于识别的账户名称。
2. 填写完整公开钱包地址（`0x` 开头，共 42 个字符）。
3. 勾选挖矿项目：**BEM、FAB 或两者**，至少选择一项。
4. 点击「保存账户」。无需连接钱包，也不要输入私钥或助记词。

项目标签由你手动指定，不根据某一次接口结果自动推断。已有旧版账户默认兼容 BEM / FAB 双选，可以点击账户旁的「编辑」调整。账户旁的垃圾桶只删除应用内保存的账户记录，不会影响钱包资产或链上矿机。

### 2. 查看与切换

- 点击顶部 **BEM / FAB** 切换项目。
- 在「我的矿机」右侧下拉框选择该项目的账户。
- 切换项目时，如果原账户也支持该项目则继续使用；否则选择第一个匹配账户。没有匹配账户时显示添加提示，不沿用其他项目的账户数据。
- 在同一面板查看上方全网概览和下方当前账户指标；账户地址旁可以复制完整地址。

矿机明细开发版的全网辅助信息合并为一行：已验证权重、已收录矿机、每日发行。账户汇总固定显示，明细列表单独滚动；预计日产不是实际到账或待领取金额。当前已发布的 v0.4.0 尚不包含此布局，不要将开发预览与 Release 安装包混淆。

### 3. 刷新数据

点击右上角刷新按钮会请求 **BEM 和 FAB 的全网 / 行情数据**，并更新当前地址已勾选项目的账户数据，不会遍历刷新全部保存账户。短时间重复点击、接口限流或既有请求尚未完成时，可能复用请求或延后重试。

自动刷新默认每 60 秒获取当前项目的账户及行情数据，可改为 120 秒或 300 秒；完整全网统计使用较低频率（15 分钟）。面板隐藏、数据源限流或网络异常可能影响实际更新时机。

### 4. 设置与退出

设置顺序为：**主题 → 语言 → 开机启动 → 跟随系统主题 → 刷新频率 → 保持面板展开**。偏好自动保存在本机。

- 开启「跟随系统主题」后，手动主题选择暂停生效；关闭后使用手动主题。
- 开启「保持面板展开」后，点击其他窗口仍保持显示；关闭时，点击外部会收起面板。
- 右键菜单栏 / 托盘图标，可以打开面板、查看安装版本或退出应用。
- 面板本身不提供退出、关闭、返回按钮，也没有算力历史区域。

## 隐私与本地数据

应用没有启用遥测。已保存地址、项目标签和偏好保存在本地；为了查询矿机数据，当前查询的公开钱包地址会发送给 TapeOutScan。应用不持有、导入或管理私钥，也不具备交易能力。

macOS 的应用数据目录：`~/Library/Application Support/io.tapeout.live/`。Windows 使用当前用户的应用数据目录，目录标识为 `io.tapeout.live`。其中保存设置文件和 SQLite 缓存。备份时建议先退出应用，并复制完整目录；钱包地址虽是公开地址，其与个人的对应关系仍应妥善保护。

## 开发与自行构建

技术架构：React + TypeScript 渲染界面，Tauri + Rust 负责网络请求、刷新调度、本地 SQLite 缓存与系统集成。数据源只使用 TapeOutScan，无其他备用数据平台。

准备 Node.js 24、Rust stable（含 rustfmt / clippy）以及 [Tauri 系统依赖](https://v2.tauri.app/start/prerequisites/)。macOS 需要 Apple Command Line Tools；Windows 需要 C++ 构建工具和 WebView2。请在目标系统上构建对应安装包。

```bash
git clone https://github.com/novus77/tapeout-live.git
cd tapeout-live
npm ci
npm run tauri dev
```

仅查看浏览器布局预览：

```bash
npm run dev
```

浏览器预览不连接真实数据源，不保存到正式应用配置；真实请求由桌面端 Rust 发起。访问开发服务器终端输出的地址即可。

构建安装包：

```bash
npm run tauri build
```

产物位于 `src-tauri/target/release/bundle/`。macOS 生成应用 / DMG，Windows 生成安装程序；签名与公证需要维护者自行配置凭据。

验证代码：

```bash
npm run lint
npm run typecheck
npm run format:check
npm test
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

普通测试不需要访问公网。以下为可选真实接口测试，会使用公开示例地址并消耗 API 请求：

```bash
cargo test --manifest-path src-tauri/Cargo.toml --test live_provider -- --ignored
cargo test --manifest-path src-tauri/Cargo.toml live_fab_provider -- --ignored --nocapture
```

### 数据接口

| 数据           | TapeOutScan 接口                                                                    |
| -------------- | ----------------------------------------------------------------------------------- |
| BEM 地址       | `https://tapeoutscan.io/api/address/{wallet}`                                       |
| BEM 行情       | `https://tapeoutscan.io/api/home?view=market`                                       |
| BEM 全网       | `https://tapeoutscan.io/api/home`                                                   |
| FAB 行情与全网 | `https://tapeoutscan.io/api/fabx/home`                                              |
| FAB 矿机       | `https://tapeoutscan.io/api/fabx/address?address={wallet}&tab=miners&pageSize=100`  |
| FAB 活动       | `https://tapeoutscan.io/api/fabx/address?address={wallet}&tab=activity&pageSize=20` |

以上为当前代码使用的接口，并非已经确认长期稳定的版本化公开 API。FAB 矿机列表最多获取 100 条，汇总指标使用数据源提供的汇总值，而非将已加载列表简单相加。接口结构变化或请求失败时保留最近有效快照；应用禁用 HTTP 重定向。

更多设计背景见 [FAB 监控规格](docs/specs/2026-10-17-fab-monitoring.md)、[账户项目标签方案](docs/plans/2026-10-17-account-project-tags.md) 和 [验证记录](docs/VALIDATION.md)。部分历史文档描述的是旧版本，以当前实现及本页使用说明为准。

## 许可证与声明

[MIT](LICENSE)。这是独立的第三方监控客户端，不代表 TapeOutScan 官方。所有指标仅用于信息展示，不构成投资建议或收益保证。
