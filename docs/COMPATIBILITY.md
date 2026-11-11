# Huawei HiLink 兼容性说明

CPE Lens 不针对单一型号写死字段，而是通过 `huawei-lte-api` 访问设备的 HiLink API，并在连接后用心跳和
只读探测建立当前设备的能力表。型号、固件和运营商定制都会影响可用接口。

## 适配方式

- 连接管理地址、用户名和密码后，自动处理 Cookie、Session 和 CSRF。
- 读取 `device/information`、`monitoring/status`、`device/signal`、`net/cell-info`、
  `monitoring/traffic-statistics`、`wlan/host-list` 等公开 HiLink 接口。
- 每项能力独立探测；读取成功才展示对应数据，写能力必须在执行时再次检查。
- 对空字段、单位差异和异常响应做容错；缺失值显示为不可用，不使用 `0` 代替。
- 不同设备可能只支持部分能力；不支持的页面入口会显示原因，而不是伪造数据。

## huawei-lte-api 的已测试范围

根据 `huawei-lte-api` 2.0.1 的项目 README，库作者测试过的设备包括：

- 3G/LTE 路由：B310s-22、B311-221、B315s-22、B525s-23a、B525s-65a、B715s-23c、B528s、
  B535-232、B628-265、B612-233、B818-263、E5180s-22、E5186s-22a、E5576-320、E5577Cs-321、
  E8231、E5573s-320、SoyeaLink B535-333。
- HiLink USB 设备：E3131、E8372h-608、E3372、E3531、E5530As-2。
- 5G CPE：5G CPE Pro 2 (H122-373)、5G CPE Pro (H112-372)、5G CPE6 (H165-383)。

库还明确列出不兼容或需要进一步测试的型号：B2368-22、B593s-22。项目最初的目标型号也不在上述
已测试列表中；它的字段和写操作必须在实机上验证。

> 以上列表来自第三方库文档，仅代表该库作者的测试范围，不代表 CPE Lens 已完成验证。

## 5G 网络模式

`huawei-lte-api` 的 `NetworkModeEnum` 只定义 2G/3G/4G 组合，没有 5G 枚举。CPE Lens 会读取设备 `net/net-mode-list`；只有设备明确报告 5G 模式时才显示 5G 选项。未报告时不猜测 `08` 等代码，避免设备失联。SA/NSA 锁定不在当前库接口范围内。

## 写操作支持边界

当前 `huawei-lte-api` 提供安全写入封装的功能：

- Wi-Fi：SSID、隐藏状态、密码；Wi-Fi 重启。
- 移动网络：移动数据开关、漫游自动连接、重新拨号。
- 网络模式/LTE Band Lock：`net/net-mode`。
- APN：新增、修改、删除、设为默认。
- 短信：发送、删除、标记已读；USSD 发送。
- 高级设置：DHCP/DNS、UPnP、DMZ、防火墙。
- 设备重启。

没有可靠安全写入封装、因此本项目只读展示的功能：

- Cell Lock：库只有 `ntwk/celllock` 读取，没有设置方法。
- 端口映射：`security/virtual-servers` 只有读取；`ntwk/lan_upnp_portmapping` 只有读取。
- NAT：`security/nat` 只有读取。
- 访客 Wi-Fi、MAC 过滤等复杂写入未在当前 UI 开放，能力仍会显示。
- 不实现恢复出厂设置、固件破解或权限绕过。

写入前必须：
1. 当前能力不是“不支持/无权限/探测失败”。
2. 服务端读取旧值并生成计划。
3. 用户显式二次确认。
4. 写入后尽可能回读；无法回读或部分验证时明确标记。
5. 记录操作日志。

## 已知风险

- 修改 Wi-Fi SSID/密码、LAN 地址、DHCP 范围、网络模式、Band Lock 或防火墙可能导致当前管理连接中断。
- 错误的 Band Lock 可能导致设备暂时无法注册网络；请确认恢复自动模式的方法。
- 不同固件可能忽略部分写入字段或返回成功但实际未生效；回读验证是必要的。
- “库中有接口”不等于“设备支持”；以当前设备探测和实机验证为准。
