# Homi

在 OpenWrt 上只用 Mihomo 内核跑你自己的配置。极简 LuCI 应用：没有透明代理、没有订阅、没有混入，只有核心功能。

## 功能

- 状态页：显示软件版本、Mihomo 内核版本、内核运行状态
- 重载服务 / 重启服务
- 更新面板（下载最新 zashboard 到本地）
- 打开面板（根据配置文件中的 `external-controller` 自动拼接面板地址）
- 上传配置文件（上传后自动校验，通过 `mihomo -t` 才算过关）
- 启用 / 禁用服务（开机自启）

## 一键安装

```sh
curl -fsSL https://raw.githubusercontent.com/pg-go/Homi/main/install.sh | sh
```

脚本会自动识别 CPU 架构（x86_64 / aarch64 / armv7 / mipsel / mips）和包管理器（opkg 装 ipk，apk 装 apk），从 GitHub Release 下载对应安装包并安装。

安装完成后，打开 LuCI → 服务 → Homi：

1. 上传你的 `config.yaml`（页面上有上传按钮，上传后会自动校验）
2. 勾选「启用」，保存并应用
3. 点「重载服务」或「重启服务」让配置生效

## 配置文件说明

配置文件路径：`/etc/homi/config.yaml`

想用「打开面板」按钮，配置里需要打开 API：

```yaml
external-controller: 0.0.0.0:9090
secret: "你的面板密码，可留空"
external-ui: ui   # 面板目录，点「更新面板」会自动下载到这里
```

仓库里有一份带注释的示例：`homi/files/etc/homi/config.yaml.example`

## 安装了什么

| 包名 | 内容 |
|---|---|
| `mihomo` | Mihomo 内核二进制（/usr/bin/mihomo），CI 从 MetaCubeX/mihomo 源码编译 |
| `homi` | procd 服务脚本、UCI 配置、面板更新脚本 |
| `luci-app-homi` | LuCI 界面 |

## 自己编译

Release 页的安装包由 GitHub Actions 自动构建：

- 内核在 SDK 里用 OpenWrt 的 Go 打包体系（`golang-package.mk`）直接编译，不再预编译二进制
- `build-packages` 任务矩阵：5 架构 × 2 分支（`openwrt-24.10` 原生出 ipk，`openwrt-25.12` 原生出 apk），不做格式转换
- 发版：推送 `v*` 标签或手动触发（填发版标签）后自动构建并发布到 GitHub Release，在 Release 页面直接下载

Release 页面提供 10 个下载包（5 架构 × apk/ipk），命名为 `homi-<架构>-<格式>.tar.gz`，
每个包里是该架构该格式的 3 个安装包（mihomo 内核 / homi 服务 / luci-app-homi 界面）。
一键安装脚本会自动按你的系统选择下载；想单独升级某个包时，下载对应包手动安装即可。

手动触发一次构建：在仓库 Actions 页点 `build` → Run workflow。

想换内核版本：改 `mihomo/Makefile` 里的 `PKG_SOURCE_URL` / `PKG_SOURCE_VERSION`（默认 MetaCubeX/mihomo `v1.19.32`）。

## 目录结构

```
Homi/
├── install.sh                  # 一键安装脚本
├── mihomo/                     # 内核包（SDK 里用 golang-package.mk 从源码编译）
├── homi/                 # 服务包
│   └── files/
│       ├── etc/config/homi
│       ├── etc/init.d/homi
│       ├── etc/homi/config.yaml.example
│       ├── usr/sbin/homi-update-dashboard
│       └── lib/upgrade/keep.d/homi
├── luci-app-homi/        # LuCI 界面
│   ├── htdocs/                 # JS 视图
│   └── root/usr/share/         # menu.d / rpcd acl / ucode 后端
└── .github/workflows/build.yml
```

## 许可证

MIT
