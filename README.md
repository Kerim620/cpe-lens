# CPE Lens

CPE Lens 是一个只在本机运行的 Huawei HiLink CPE 管理面板。它通过 `huawei-lte-api` 访问设备，
面向**所有提供 HiLink API 的 Huawei/SoyeaLink 设备**，而不是绑定单一型号。设备型号、固件和可用
能力由连接后的实际探测决定；不同型号/固件可能缺少部分页面字段或控制接口。

- 后端：Python 3.12、FastAPI、`huawei-lte-api`、SQLite
- 前端：React、TypeScript（strict）、Vite、Tailwind CSS
- 默认只监听 `127.0.0.1`，不连接云服务，不收集遥测
- 凭据只保存在后端内存；不会写入 SQLite、日志或浏览器存储
- 不提供内置虚拟设备或样本数据；自动测试使用测试目录注入的测试替身，不进入生产代码

## 已实现

### 设备探测与连接

- 连接 HiLink 地址（通常是 `http://192.168.8.1`），自动处理登录、Cookie、Session 和 CSRF。
- 会话失效或短暂断线后自动重连；连续认证失败会丢弃内存凭据，避免反复尝试。
- 读取并展示型号、硬件/固件/Web UI 版本、运营商、网络制式和脱敏 IMEI。
- 通过只读请求探测能力，状态为：可用、实验性、当前不可用、无权限、不支持、探测失败。
  读取成功表示当前设备上的接口可用；写能力默认标记为实验性，执行时仍需确认和回读验证。

### 只读看板

- 总览：实时上下行速度、核心 LTE/NR 信号、Band/PCI/Cell ID、运营商、网络制式、WAN/LAN 地址、运行时间。
- 信号与小区：LTE/NR 指标、信号质量、历史趋势、小区列表。
- 流量：实时速率、本次连接/今日/本月/累计流量、速度与数据量历史曲线。
- 客户端：名称、IP、脱敏 MAC、连接方式和在线时长。
- 历史：SQLite 原始采样保留 30 天，之后按小时聚合保留一年；图表支持 15 分钟、1 小时、6 小时、24 小时和 7 天。

### 受保护的设备控制（阶段三）

所有写操作遵循同一流程：

1. 检查当前设备能力探测结果；不支持或探测失败的接口拒绝写入。
2. 服务端读取并返回当前值，生成带有效期的操作计划。
3. 前端展示旧值、新值和影响警告，要求显式二次确认。
4. 后端一次消费操作令牌，执行写入。
5. 尽可能回读设备验证结果；无法回读时明确标记。
6. 将脱敏后的操作记录写入 SQLite。

当前控制范围：

- Wi-Fi：SSID、隐藏网络、密码（密码无法回读，报告部分验证）。
- 移动网络：移动数据开关、漫游开关、重新拨号。
- Band Lock：网络模式和 LTE 频段；Cell Lock 仅有只读接口，页面会说明原因。
- APN：新增、修改、删除、设为默认。
- 短信：读取、发送、标记已读、删除；USSD 请求。
- 高级设置：DHCP/DNS、UPnP、DMZ、防火墙；端口映射和 NAT 仅显示能力，不执行写入。
- 设备重启（高风险，明确警告）。
- 诊断：脱敏报告导出、能力状态、实时接口错误、操作记录。

## 安装与运行

前置要求：macOS、[uv](https://docs.astral.sh/uv/)、Node.js 20.19+ 或 22.12+（含 npm）。首次运行会安装前端依赖。

```bash
uv sync

# 开发模式：FastAPI (127.0.0.1:8765) + Vite (127.0.0.1:5173)
uv run dev

# 生产模式：构建前端并由 FastAPI 提供静态文件
uv run start

# 后端 pytest + 前端 vitest + TypeScript 类型检查
uv run test

# 代码风格与类型检查
uv run lint
uv run typecheck
```

只启动后端：`uv run dev --no-frontend`。开发模式下 Vite 将 `/api` 代理到 `http://127.0.0.1:8765`；
可设置 `VITE_API_PROXY` 和 `CPE_LENS_PORT`。

## 连接与兼容性

1. 打开界面，输入 HiLink 管理地址、用户名和密码。
2. 连接后自动执行能力探测并开始采样。
3. 总览、信号、流量、客户端页面自动刷新；控制页面会先读取旧值。

`huawei-lte-api` 文档列出的已测试设备包括多款 B/E 系列 LTE 路由、5G CPE Pro 系列和 H165-383 等；
其他 Huawei HiLink 设备通常也可能工作，但**不保证**。本项目不根据相近型号推断支持，而是以当前设备
探测结果为准。详见 [兼容性说明](docs/COMPATIBILITY.md) 和 [实机验证清单](docs/DEVICE_VERIFICATION.md)。

> **写操作尚未在真实设备上验证。** 所有写路径都有能力检查、二次确认和回读验证，但在实机上测试
> 前仍应视为实验性。不要在没有物理恢复手段的情况下修改 Wi-Fi、APN、网络模式或防火墙。

## 配置

配置通过 `CPE_LENS_*` 环境变量或项目根目录 `.env` 提供，示例见 [.env.example](.env.example)。

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
| `CPE_LENS_SAMPLE_INTERVAL_SECONDS` | `5` | 看板采样与历史写入间隔，`0` 关闭自动采样 |
| `CPE_LENS_TELEMETRY_SECTION_TIMEOUT_SECONDS` | `20` | 单个看板区块读取超时 |
| `CPE_LENS_HISTORY_RAW_DAYS` | `30` | 原始历史保留天数（最少 7） |
| `CPE_LENS_HISTORY_HOURLY_DAYS` | `365` | 小时聚合保留天数 |

## 安全边界

- 只允许 `http`/`https` 管理地址；拒绝内嵌用户名密码、路径、查询串和 fragment。
- 不实现恢复出厂设置、固件破解或权限绕过。
- API 不返回第三方库对象或原始 XML；不保存密码、Cookie、Token 或短信正文到 SQLite/日志。
- IMEI、MAC、WAN 地址默认遮挡；完整标识不会进入 API 或诊断报告。
- 写操作必须有显式确认令牌；操作令牌一次性使用，2 分钟过期，并绑定当前设备会话。
- 状态变更请求校验 `Origin`，拒绝跨站来源。
- `huawei-lte-api` 在 DEBUG 级别会打印密码，因此后端强制将该库日志级别设为 WARNING。
- 默认只监听 `127.0.0.1`。

## 测试

```bash
uv run test --backend-only
uv run test --frontend-only
```

自动测试不连接真实设备，而是通过 `tests/fakes.py` 注入测试替身；生产代码没有虚拟设备适配器或内置样本。
当前结果：72 个后端测试、16 个前端测试，lint、mypy、TypeScript 类型检查和前端构建均通过。

## 文档

- [产品需求](docs/PRD.md)
- [前端设计规范](docs/FRONTEND_DESIGN.md)
- [开发计划](docs/DEVELOPMENT_PLAN.md)
- [兼容性说明](docs/COMPATIBILITY.md)
- [实机验证清单](docs/DEVICE_VERIFICATION.md)
- [阶段一实现说明](docs/PHASE1.md)
- [阶段二实现说明](docs/PHASE2.md)
- [阶段三实现说明](docs/PHASE3.md)

## 许可证

MIT。第三方依赖及许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
