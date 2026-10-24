include $(TOPDIR)/rules.mk

PKG_NAME:=homi
PKG_VERSION:=1.0.0
PKG_RELEASE:=10
PKGARCH:=all

PKG_LICENSE:=MIT
PKG_MAINTAINER:=pg-go

include $(INCLUDE_DIR)/package.mk

define Package/homi
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Homi service scripts
  URL:=https://github.com/pg-go/Homi
  DEPENDS:=+mihomo +yq +curl +ca-bundle +unzip
endef

define Package/homi/description
  Procd service, UCI config and helper scripts to run the Mihomo
  core with a user-uploaded config file as a transparent proxy.
endef

define Package/homi/conffiles
/etc/config/homi
/etc/homi/config.yaml
endef

define Package/homi/install
	$(INSTALL_DIR) $(1)/etc/homi/ui
	$(INSTALL_DATA) $(CURDIR)/files/etc/homi/config.yaml.example $(1)/etc/homi/config.yaml.example

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) $(CURDIR)/files/etc/config/homi $(1)/etc/config/homi

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) $(CURDIR)/files/etc/init.d/homi $(1)/etc/init.d/homi

	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) $(CURDIR)/files/usr/sbin/homi-update-dashboard $(1)/usr/sbin/homi-update-dashboard
	$(INSTALL_BIN) $(CURDIR)/files/usr/sbin/homi-log $(1)/usr/sbin/homi-log
	$(INSTALL_BIN) $(CURDIR)/files/usr/sbin/homi-fetch-mmdb $(1)/usr/sbin/homi-fetch-mmdb
	$(INSTALL_BIN) $(CURDIR)/files/usr/sbin/homi-update-rules $(1)/usr/sbin/homi-update-rules

	$(INSTALL_DIR) $(1)/lib/upgrade/keep.d
	$(INSTALL_DATA) $(CURDIR)/files/lib/upgrade/keep.d/homi $(1)/lib/upgrade/keep.d/homi
endef

define Package/homi/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
# 安装完成后立即后台预下载 MMDB，不等用户上传配置；后台执行不阻塞 opkg，
# 下载失败也不影响安装（首次校验/启动时还会再试）
if [ ! -f /etc/homi/geoip.metadb ]; then
	/usr/sbin/homi-fetch-mmdb 60 >/dev/null 2>&1 &
fi
exit 0
endef

define Package/homi/postrm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
# 升级时新包的 init 脚本已就位，不做清理；只有真正卸载（脚本已被删除）才全清
[ -e /etc/init.d/homi ] && exit 0
rm -rf /etc/homi
rm -rf /var/log/homi
rm -f /etc/config/homi /etc/config/homi-opkg
exit 0
endef

define Build/Compile
endef

$(eval $(call BuildPackage,homi))
