# 迅雷下载助手脚本版 (nas-xunlei-script)

专为迅雷 NAS (群晖 DSM / Docker / 威联通 QNAP) 与 Firefox / Chrome 用户适配的油猴脚本，支持全网磁力链接一键直推远程设备，具备双向任务状态感知与目录平铺直存特性。

## 致谢与项目来源

本项目基于开源扩展 [saaak/xunlei-docker-ext](https://github.com/saaak/xunlei-docker-ext) 移植重构。

---

## 使用指南

### 1. 获取扩展与鉴权凭证
本脚本需要使用迅雷长效凭证以持久连接您的 NAS。**建议用户首先参考原项目获取扩展并登录：**
- 原扩展地址：[https://github.com/saaak/xunlei-docker-ext](https://github.com/saaak/xunlei-docker-ext)
- 登录原扩展后，在控制台（Console）执行以下命令获取 `xl_refresh_token`：
```javascript
chrome.storage.local.get(['xl_refresh_token'], res => console.log(res.xl_refresh_token))
```
- 提取以 `a1.` 开头的长效字符串。

### 2. 安装与使用
1. 使用浏览器脚本管理器安装本仓库中的 `nas-xunlei-helper.user.js`。
2. 在任意磁力网站点击条目旁的「⚡ 迅雷直推」按钮。
3. 填入获取的凭证并绑定在线的 NAS 设备即可开始推送。

---

## 开源协议
MIT
