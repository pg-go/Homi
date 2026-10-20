#!/bin/sh
#
# Homi 一键安装脚本
#
# 用法：
#   curl -fsSL https://raw.githubusercontent.com/pg-go/Homi/main/install.sh | sh
#   或下载后执行：sh install.sh [版本号]
#   不带版本号默认安装最新 Release。
#

set -e

REPO="pg-go/Homi"
VERSION="${1:-latest}"

# 只要 OpenWrt
if [ ! -f /etc/openwrt_release ]; then
	echo "只支持 OpenWrt 系统"
	exit 1
fi
. /etc/openwrt_release

# 架构映射到 Release 包名
ARCH="$DISTRIB_ARCH"
case "$ARCH" in
	x86_64|aarch64_generic|aarch64_cortex-a53|aarch64_cortex-a72|arm_cortex-a7_neon-vfpv4)
		;;
	*)
		echo "暂不支持的架构: $ARCH"
		echo "支持的架构: x86_64, aarch64_generic, aarch64_cortex-a53, aarch64_cortex-a72, arm_cortex-a7_neon-vfpv4"
		exit 1
		;;
esac

# 按包管理器决定下载哪种格式
if [ -x /bin/opkg ]; then
	PKG=ipk
elif [ -x /usr/bin/apk ]; then
	PKG=apk
else
	echo "找不到 opkg 也找不到 apk，无法安装"
	exit 1
fi

if [ "$VERSION" = "latest" ]; then
	URL="https://github.com/$REPO/releases/latest/download/homi-${ARCH}-${PKG}.tar.gz"
else
	URL="https://github.com/$REPO/releases/download/${VERSION}/homi-${ARCH}-${PKG}.tar.gz"
fi

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

echo "下载 $URL ..."
if command -v curl >/dev/null 2>&1; then
	curl -fsSL -o "$TMPDIR/pkg.tar.gz" "$URL"
else
	wget -O "$TMPDIR/pkg.tar.gz" "$URL"
fi
tar -xzf "$TMPDIR/pkg.tar.gz" -C "$TMPDIR"

echo "安装软件包 ..."
if [ "$PKG" = "ipk" ]; then
	opkg update
	# 按依赖顺序安装：内核 -> 服务 -> 界面
	opkg install "$TMPDIR"/mihomo_*.ipk
	opkg install "$TMPDIR"/homi_*.ipk
	opkg install "$TMPDIR"/luci-app-homi_*.ipk
else
	apk update
	# apk 包未签名，加上 --allow-untrusted
	# 按依赖顺序安装：内核 -> 服务 -> 界面
	apk add --allow-untrusted "$TMPDIR"/mihomo-*.apk
	apk add --allow-untrusted "$TMPDIR"/homi-*.apk
	apk add --allow-untrusted "$TMPDIR"/luci-app-homi-*.apk
fi

echo ""
echo "安装完成！"
echo "接下来请打开 LuCI -> 服务 -> Homi："
echo "  1. 上传你的 config.yaml（页面会自动校验）"
echo "  2. 勾选「启用」并保存应用"
echo "  3. 点「重载服务」让配置生效"
