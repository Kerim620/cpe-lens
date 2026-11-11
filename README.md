# CPE Lens

CPE Lens 是一个只在本机运行的 Huawei HiLink CPE 管理面板。它通过 `huawei-lte-api` 访问设备，
面向**所有提供 HiLink API 的 Huawei/SoyeaLink 设备**，而不是绑定单一型号。设备型号、固件和可用
能力由连接后的实际探测决定；不同型号/固件可能缺少部分页面字段或控制接口。

- 后端：Python 3.11+、FastAPI、`huawei-lte-api`、SQLite
- 前端：React 19、TypeScript（strict）、Vite 7、Tailwind CSS 4、shadcn/ui 本地组件、Tremor Raw 图表源码、Lucide 图标
- 默认只监听 `127.0.0.1`，不连接云服务，不收集遥测
- 凭据默认只保存在后端内存，不写入 SQLite 或日志；只有用户显式勾选“记住”时才存入浏览器 localStorage，并提示明文风险
- 不提供内置虚拟设备或样本数据；自动测试使用测试目录注入的测试替身，不进入生产代码

## 特别感谢

CPE Lens 能够连接并管理 Huawei HiLink 设备，核心基础来自
[**huawei-lte-api**](https://github.com/Salamek/huawei-lte-api)（作者 Adam Schubert）。

本项目对该库的登录与 Session/CSRF 处理、设备信息、信号、流量、客户端、Wi-Fi、APN、短信、USSD
以及网络模式等接口进行了封装和界面化。没有 `huawei-lte-api` 持续维护这些设备的兼容实现，就没有
CPE Lens。特别感谢作者及所有贡献者。

如果你也在开发 Huawei HiLink 相关工具，欢迎优先支持这个项目：
<https://github.com/Salamek/huawei-lte-api>

## 已实现

### 设备探测与连接

- 连接 HiLink 地址（通常是 `http://192.168.8.1`），自动处理登录、Cookie、Session 和 CSRF。
- 会话失效或短暂断线后自动重连；连续认证失败会丢弃内存凭据，避免反复尝试。
- 读取并展示型号、硬件/固件/Web UI 版本、运营商、网络制式和完整 IMEI。
- 通过只读请求探测能力，状态为：可用、实验性、当前不可用、无权限、不支持、探测失败。
  读取成功表示当前设备上的接口可用；写能力默认标记为实验性，执行时仍需确认和回读验证。

### 只读看板

- 总览：实时上下行速度、核心 LTE/NR 信号、Band/PCI/Cell ID、运营商、网络制式、WAN/LAN 地址、运行时间。
- 信号与小区：LTE/NR 指标、信号质量、历史趋势、小区列表。
- 流量：实时速率、本次连接/今日/本月/累计流量、速度与数据量历史曲线。
- 客户端：名称、IP、完整 MAC、连接方式和在线时长。
- 实时：SSE 推送，严格按应用设置的采样间隔刷新全部区块；断线自动回退轮询。WebRTC 不适用，因为 CPE 数据源仍是 HTTP/XML API。
- 历史：SQLite 原始采样保留 30 天，之后按小时聚合保留一年；图表支持 15 分钟、1 小时、6 小时、24 小时和 7 天。

### 数据优先界面

- 主导航只展示总览、信号与小区、流量、客户端；设备管理、诊断和设置分组收纳，保留原有 URL。
- 总览以速率曲线、信号趋势、流量摘要和小区摘要为核心；连接后不再显示配置表单。
- 速率用面积图，数据量用柱状图，信号按指标分图；缺失样本保留断点，不用 0 填充。
- 断线、过期数据、区块错误、空记录、不支持和无权限都有独立状态；刷新保留上次结果并标明时间。
- Tailwind 4 语义令牌统一浅色/深色；基础控件为本地 shadcn/ui 源码，图表基于 Tremor Raw 源码适配，图标按需静态导入 Lucide。
- 12 个页面按路由懒加载，图表与 Radix 依赖单独分包；所有资源本地提供，不使用 CDN 或远程字体。

### 全屏与 5G

- 顶栏支持浏览器全屏；全屏后进入监测布局，隐藏侧栏、顶栏、页头和非必要信息卡。
- 全屏监测保留 KPI 和 6 张图：速率、数据量、RSRP、SINR、RSRQ、RSSI。
- 网络模式从设备 `net/net-mode-list` 发现；设备报告 5G 模式时才显示 5G 选项，不猜测未验证代码；未报告时不显示额外说明。

### 应用设置

- 采样间隔、心跳间隔、区块读取超时、原始/小时历史保留可在应用设置页修改。
- 修改立即生效，可一键恢复默认值。

### 受保护的设备控制（阶段三）

所有写操作遵循同一流程：

1. 检查当前设备能力探测结果；不支持或探测失败的接口拒绝写入。
2. 服务端读取并返回当前值，生成带有效期的操作计划。
3. 前端展示旧值、新值和影响警告，要求显式二次确认。
4. 后端一次消费操作令牌，执行写入。
5. 尽可能回读设备验证结果；无法回读时明确标记。
6. 将操作记录写入 SQLite（认证秘密除外）。

当前控制范围：

- Wi-Fi：SSID、隐藏网络、密码（密码无法回读，报告部分验证）。
- 移动网络：移动数据开关、漫游开关、重新拨号。
- Band Lock：网络模式和 LTE 频段；Cell Lock 仅有只读接口，页面会说明原因。
- APN：新增、修改、删除、设为默认。
- 短信：读取、发送、标记已读、删除；USSD 请求。
- 高级设置：DHCP/DNS、UPnP、DMZ、防火墙；端口映射和 NAT 仅显示能力，不执行写入。
- 设备重启（高风险，明确警告）。
- 诊断：报告导出、能力状态、实时接口错误、操作记录。

## 安装与运行

前置要求：Python 3.11 或更新版本。普通使用不需要 Node.js、uv 或 pnpm；仓库包含构建好的
`frontend/dist`，由 FastAPI 直接提供。只有修改前端源码时才需要 Node.js 20.19+ 或 22.12+。

### 一键启动（推荐）

```bash
./start.sh
```

首次运行会创建 `.venv`、安装 Python 依赖并启动服务。浏览器打开 `http://127.0.0.1:8765`。
传参可改地址/端口，例如：

```bash
./start.sh --host 0.0.0.0 --port 8765
```

### 手动安装

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
python -m pip install -e . --no-deps
python -m cpe_lens start
```

Windows（PowerShell）：

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m pip install -e . --no-deps
python -m cpe_lens start
```

### Android / Termux

```bash
pkg update
pkg install python
cd cpe-lens
./start.sh
```

`start.sh` 只使用 Python 和 pip。若设备没有预编译的 `pydantic-core` wheel，pip 可能需要本地编译工具；
这种情况下先安装 Termux 的 Python 构建依赖，或把项目放在已有 Python 3.11+ 的环境中运行。

### 开发模式

只有开发前端时需要 Node.js：

```bash
python -m pip install -r requirements-dev.txt
python -m pip install -e . --no-deps
python -m cpe_lens dev
```

`dev` 同时启动 FastAPI（8765）和 Vite（5173）。只启动后端：`python -m cpe_lens dev --no-frontend`。
修改前端源码后先构建：`python -m cpe_lens start --build`，或 `cd frontend && npm run build`。

### 测试与检查

```bash
python -m pytest
cd frontend && npm test && npm run typecheck
python -m ruff check src tests
python -m mypy
```

## 连接与兼容性

1. 打开界面，输入 HiLink 管理地址、用户名和密码。
2. 连接后自动执行能力探测并开始采样。
3. 总览、信号、流量、客户端页面自动刷新；控制页面会先读取旧值。

`huawei-lte-api` 文档列出的已测试设备包括多款 B/E 系列 LTE 路由、5G CPE Pro 系列和 H165-383 等；
其他 Huawei HiLink 设备通常也可能工作，但**不保证**。本项目不根据相近型号推断支持，而是以当前设备
探测结果为准。详见 [兼容性说明](docs/COMPATIBILITY.md)。

> **写操作尚未在真实设备上验证。** 所有写路径都有能力检查、二次确认和回读验证，但在实机上测试
> 前仍应视为实验性。不要在没有物理恢复手段的情况下修改 Wi-Fi、APN、网络模式或防火墙。

## 配置

`CPE_LENS_*` 环境变量或项目根目录 `.env` 是**启动默认值**；应用设置页修改的采样、心跳、区块超时和历史保留会保存到本机 SQLite，并覆盖对应默认值。修改 `.env` 后需要重启后端；点击“恢复默认值”会清除数据库覆盖（使用当前进程启动时读取的默认值）。示例见 [.env.example](.env.example)。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `CPE_LENS_HOST` | `127.0.0.1` | 监听地址，默认仅本机 |
| `CPE_LENS_PORT` | `8765` | 后端端口 |
| `CPE_LENS_DATA_DIR` | `data` | SQLite 目录 |
| `CPE_LENS_DEVICE_TIMEOUT_SECONDS` | `8` | 单次设备请求超时 |
| `CPE_LENS_CONNECT_TIMEOUT_SECONDS` | `25` | 登录/信息读取总超时 |
| `CPE_LENS_PROBE_TIMEOUT_SECONDS` | `75` | 全量能力探测超时 |
| `CPE_LENS_HEARTBEAT_TIMEOUT_SECONDS` | `15` | 心跳请求超时 |
| `CPE_LENS_MONITOR_INTERVAL_SECONDS` | `30` | 自动重连/心跳间隔，`0` 关闭 |
| `CPE_LENS_SAMPLE_INTERVAL_SECONDS` | `5` | 全部看板区块的采样、SSE 推送和历史写入间隔，`0` 关闭自动采样 |
| `CPE_LENS_TELEMETRY_SECTION_TIMEOUT_SECONDS` | `20` | 单个看板区块读取超时 |
| `CPE_LENS_HISTORY_RAW_DAYS` | `30` | 原始历史保留天数（最少 7） |
| `CPE_LENS_HISTORY_HOURLY_DAYS` | `365` | 小时聚合保留天数 |

## 安全边界

- 只允许 `http`/`https` 管理地址；拒绝内嵌用户名密码、路径、查询串和 fragment。
- 不实现恢复出厂设置、固件破解或权限绕过。
- API 不返回第三方库对象或原始 XML；不保存登录密码、Cookie、Token、Wi-Fi/APN 密码或短信正文到 SQLite/日志。
- IMEI、MAC、WAN IP、短信手机号完整显示；只有登录密码、Cookie、Token、Session、Wi-Fi/APN 密码保持不可见。
- 凭据默认只保存在后端内存。连接页的“记住用户名和密码”是显式选项，开启后密码以明文存入浏览器 localStorage，仅建议个人设备使用。
- 写操作必须有显式确认令牌；操作令牌一次性使用，2 分钟过期，并绑定当前设备会话。
- 状态变更请求校验 `Origin`，拒绝跨站来源。
- `huawei-lte-api` 在 DEBUG 级别会打印密码，因此后端强制将该库日志级别设为 WARNING。
- 默认只监听 `127.0.0.1`。

## 测试

```bash
python -m pytest
cd frontend && npm test
```

自动测试不连接真实设备，而是通过 `tests/fakes.py` 注入测试替身；生产代码没有虚拟设备适配器或内置样本。
当前结果：78 个后端测试、22 个前端测试，lint、mypy、TypeScript 类型检查和前端构建均通过。
前端生产构建初始加载约 288 KB gzip（其中图表 vendor 约 117 KB），12 个页面按需加载；详见
[前端设计规范](docs/FRONTEND_DESIGN.md)。

## 文档

- [产品需求](docs/PRD.md)
- [前端设计规范](docs/FRONTEND_DESIGN.md)
- [兼容性说明](docs/COMPATIBILITY.md)

内部开发计划、实机验证清单和阶段记录保留在本地，不随开源仓库发布。

## 许可证

MIT。第三方依赖及许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)；Tremor Raw 适配的归属和 Apache-2.0 文本见 [NOTICE](NOTICE) 与 [LICENSES/Apache-2.0.txt](LICENSES/Apache-2.0.txt)。
