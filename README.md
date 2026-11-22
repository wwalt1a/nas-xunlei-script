# 迅雷下载助手脚本版 (nas-xunlei-script)

专为迅雷 NAS (群晖 DSM / Docker / 威联通 QNAP) 与 Firefox / Chrome 用户适配的油猴脚本，支持全网磁力链接一键直推远程设备，具备双向任务状态感知与目录平铺直存特性。

---

## 📥 脚本一键安装 (Install Userscript)

请确保浏览器已安装 [Tampermonkey (篡改猴)](https://www.tampermonkey.net/) 或 [Violentmonkey (暴力猴)](https://violentmonkey.github.io/)，点击下方任意链接即可触发浏览器脚本管理器安装：

| 安装渠道 / 节点 | 链接地址 | 特点说明 |
| :--- | :--- | :--- |
| **🚀 jsDelivr (Fastly CDN)** | [点击一键安装](https://fastly.jsdelivr.net/gh/wwalt1a/nas-xunlei-script@main/nas-xunlei-helper.user.js) | 国内首选，高速免翻直连 |
| **⚡ jsDelivr (GCore CDN)** | [点击一键安装](https://gcore.jsdelivr.net/gh/wwalt1a/nas-xunlei-script@main/nas-xunlei-helper.user.js) | 优质多线加速镜像 |
| **🌐 GHProxy 镜像节点 1** | [点击一键安装](https://ghproxy.net/https://raw.githubusercontent.com/wwalt1a/nas-xunlei-script/main/nas-xunlei-helper.user.js) | 稳定 GitHub 加速代理 |
| **🌐 GHProxy 镜像节点 2** | [点击一键安装](https://ghproxy.cn/https://raw.githubusercontent.com/wwalt1a/nas-xunlei-script/main/nas-xunlei-helper.user.js) | 备用加速代理通道 |
| **🌐 GH-Proxy 镜像节点 3** | [点击一键安装](https://gh-proxy.com/https://raw.githubusercontent.com/wwalt1a/nas-xunlei-script/main/nas-xunlei-helper.user.js) | 备用加速代理通道 |
| **🐱 GitHub 官方 Raw** | [点击一键安装](https://raw.githubusercontent.com/wwalt1a/nas-xunlei-script/main/nas-xunlei-helper.user.js) | 官方源（需要顺畅的网络环境） |

---

## 💡 致谢与项目来源

本项目基于开源扩展 [saaak/xunlei-docker-ext](https://github.com/saaak/xunlei-docker-ext) 移植重构，特别针对 **迅雷 NAS 官方套件 + Firefox 浏览器** 进行了专项优化。

---

## 🔑 使用教程：获取扩展与鉴权凭证

由于迅雷官方禁用了公开扫码接口，本脚本采用原生长期有效的 `xl_refresh_token` 自动续期机制。

**请用户首先参考原项目获取扩展并登录：**
1. 访问原项目地址下载安装扩展：[https://github.com/saaak/xunlei-docker-ext](https://github.com/saaak/xunlei-docker-ext)
2. 在扩展登录成功后，在扩展页面或控制台（Console）执行以下命令：
```javascript
chrome.storage.local.get(['xl_refresh_token'], res => console.log(res.xl_refresh_token))
```
3. 复制输出的以 `a1.` 开头的长效字符串凭证（**切勿复制 2 小时失效的 access_token**）。

*(注：纯火狐用户若未安装 Chrome 扩展，也可在登录 [pan.xunlei.com](https://pan.xunlei.com/) 网页版后，在 F12 控制台 Cookies 中获取同名 `xl_refresh_token`)*

---

## 🚀 绑定与推送使用

1. 点击上方 CDN 链接完成安装；
2. 打开任意资源站点（如蜜柑计划 Mikanani、1337x、Nyaa、Sukebei 等）；
3. 找到资源条目，点击新增的 **「⚡ 迅雷直推」** 按钮；
4. 首次使用时会弹出轻量设置窗口，粘贴以 `a1.` 开头的凭证并保存；
5. 脚本将自动识别并连接在线的 NAS 设备，后续点击即可秒速直推，并实时同步下载百分比与完成状态！

---

## 📄 开源协议
[MIT License](LICENSE)
