# 迅雷下载助手脚本版 (nas-xunlei-script)

专为迅雷 NAS (群晖 DSM / Docker / 威联通 QNAP) 用户打造的油猴脚本套件，支持全网磁力链接与种子附件（.torrent）一键直推远程设备，具备双向任务状态感知与目录平铺直存特性。

---

## 🎯 脚本方案选择 (Choose Your Flavor)

本项目提供两种架构方案，用户可根据自身使用场景自由选择：

| 方案 | 脚本文件 | 鉴权机制 | 优势特点 | 适用场景 |
| :--- | :--- | :--- | :--- | :--- |
| **方案 A<br>(经典版)** | [`nas-xunlei-helper.user.js`](nas-xunlei-helper.user.js) | 浏览器端填入 `a1.` Refresh Token | 支持双向下载进度轮询感知，单设备独立运作 | 仅在 PC 浏览器使用，无需搭建任何自建服务端 |
| **方案 B<br>(Webhook 版)** | [`nas-xunlei-webhook.user.js`](nas-xunlei-webhook.user.js) | 群晖端 `lwlook/webhook` 集中鉴权 | **零 Token 模式**，彻底杜绝 Token 冲突与频繁失效，支持 iPhone/iPad 快捷指令 | 有群晖 DSM 或自建 Webhook，且需要手机/PC 多端协同 |

---

## 📥 方案 A：经典版一键安装 (nas-xunlei-helper)

请确保浏览器已安装 [Tampermonkey (篡改猴)](https://www.tampermonkey.net/) 或 [Violentmonkey (暴力猴)](https://violentmonkey.github.io/)：

| 安装渠道 / 节点 | 链接地址 | 特点说明 |
| :--- | :--- | :--- |
| **🚀 jsDelivr (Fastly CDN)** | [点击一键安装](https://fastly.jsdelivr.net/gh/wwalt1a/nas-xunlei-script@main/nas-xunlei-helper.user.js) | 国内首选，高速免翻直连 |
| **⚡ jsDelivr (GCore CDN)** | [点击一键安装](https://gcore.jsdelivr.net/gh/wwalt1a/nas-xunlei-script@main/nas-xunlei-helper.user.js) | 优质多线加速镜像 |
| **🌐 GHProxy 镜像节点 1** | [点击一键安装](https://ghproxy.net/https://raw.githubusercontent.com/wwalt1a/nas-xunlei-script/main/nas-xunlei-helper.user.js) | 稳定 GitHub 加速代理 |
| **🌐 GHProxy 镜像节点 2** | [点击一键安装](https://ghproxy.cn/https://raw.githubusercontent.com/wwalt1a/nas-xunlei-script/main/nas-xunlei-helper.user.js) | 备用加速代理通道 |
| **🐱 GitHub 官方 Raw** | [点击一键安装](https://raw.githubusercontent.com/wwalt1a/nas-xunlei-script/main/nas-xunlei-helper.user.js) | 官方源（需要顺畅的网络环境） |

> **方案 A 使用教程**：
> 1. 参考 [saaak/xunlei-docker-ext](https://github.com/saaak/xunlei-docker-ext) 扩展控制台执行 `chrome.storage.local.get(['xl_refresh_token'], res => console.log(res.xl_refresh_token))` 获取 `a1.` 开头的长效凭据；
> 2. 安装脚本后打开任意资源站，点击「⚡ 迅雷直推」并粘贴凭据保存即可。

---

## 📥 方案 B：Webhook 版一键安装 (nas-xunlei-webhook)

专为解决迅雷 OAuth Refresh Token 轮转机制导致的“多端登录互踢 / Token 频繁失效”而重构。

| 安装渠道 / 节点 | 链接地址 | 特点说明 |
| :--- | :--- | :--- |
| **🚀 jsDelivr (Fastly CDN)** | [点击一键安装](https://fastly.jsdelivr.net/gh/wwalt1a/nas-xunlei-script@main/nas-xunlei-webhook.user.js) | 国内首选，高速免翻直连 |
| **⚡ jsDelivr (GCore CDN)** | [点击一键安装](https://gcore.jsdelivr.net/gh/wwalt1a/nas-xunlei-script@main/nas-xunlei-webhook.user.js) | 优质多线加速镜像 |
| **🌐 GHProxy 镜像节点 1** | [点击一键安装](https://ghproxy.net/https://raw.githubusercontent.com/wwalt1a/nas-xunlei-script/main/nas-xunlei-webhook.user.js) | 稳定 GitHub 加速代理 |
| **🌐 GHProxy 镜像节点 2** | [点击一键安装](https://ghproxy.cn/https://raw.githubusercontent.com/wwalt1a/nas-xunlei-script/main/nas-xunlei-webhook.user.js) | 备用加速代理通道 |
| **🐱 GitHub 官方 Raw** | [点击一键安装](https://raw.githubusercontent.com/wwalt1a/nas-xunlei-script/main/nas-xunlei-webhook.user.js) | 官方源（需要顺畅的网络环境） |

> **方案 B 使用教程**：
> 1. 安装脚本后首次点击「⚡ 迅雷直推」或在油猴菜单点击「⚙️ 群晖 Webhook 设置」；
> 2. 填写您的群晖 Webhook 端点地址（如 `http://<NAS_IP>:9000/hooks/xunlei-push` 或外网反代域名）以及访问 Secret 密钥并保存；
> 3. 支持 iOS 快捷指令：在手机端配置相同的 Webhook POST 请求，长按磁力链接点击「分享」即可直接推送。

---

## 💡 致谢与项目来源

本项目基于开源扩展 [saaak/xunlei-docker-ext](https://github.com/saaak/xunlei-docker-ext) 移植重构，特别针对 **迅雷 NAS 官方套件 + 跨平台/多端协作** 进行了专项优化。

---

## 📄 开源协议
[MIT License](LICENSE)
