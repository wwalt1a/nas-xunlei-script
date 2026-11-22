// ==UserScript==
// @name         nas-xunlei-webhook
// @name:zh-CN   迅雷下载助手 (Webhook 版)
// @namespace    https://github.com/wwalt1a/nas-xunlei-script
// @version      1.0.0
// @description  专为群晖 DSM (lwlook/webhook) 与 iOS 快捷指令协同打造的轻量化下载助手。浏览器端零 Token 鉴权，直接将全网磁链与种子附件通过 Webhook 直推到远程群晖迅雷套件，彻底杜绝 Token 冲突与失效问题。
// @author       Community
// @license      MIT
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @connect      *
// ==/UserScript==

(function () {
    'use strict';

    // 默认配置（支持公网 HTTPS 或内网 HTTP，首次使用请在设置弹窗中填入您的 Webhook 端点）
    const DEFAULT_WEBHOOK_URL = '';
    const DEFAULT_SECRET = '';

    // -------------------------------------------------------------------------
    // 基础工具与轻量 Toast 浮窗组件
    // -------------------------------------------------------------------------
    function showToast(title, message, type = 'info') {
        let container = document.getElementById('xl-webhook-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'xl-webhook-toast-container';
            container.style.cssText = `
                position: fixed; top: 20px; right: 20px; z-index: 99999999;
                display: flex; flex-direction: column; gap: 10px; pointer-events: none;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            `;
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.style.cssText = `
            pointer-events: auto; min-width: 280px; max-width: 380px;
            padding: 12px 16px; border-radius: 10px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
            color: #ffffff; font-size: 13px; line-height: 1.4;
            display: flex; align-items: flex-start; gap: 10px;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            transform: translateX(30px); opacity: 0;
            background-color: ${type === 'success' ? '#059669' : type === 'error' ? '#dc2626' : '#0284c7'};
            border: 1px solid ${type === 'success' ? '#047857' : type === 'error' ? '#b91c1c' : '#0369a1'};
        `;

        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '⚡';
        toast.innerHTML = `
            <span style="font-size: 16px; flex-shrink: 0; margin-top: -1px;">${icon}</span>
            <div style="flex: 1; word-break: break-all;">
                <div style="font-weight: 700; margin-bottom: 2px;">${title}</div>
                <div style="font-size: 12px; opacity: 0.95;">${message}</div>
            </div>
        `;

        container.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(0)';
            toast.style.opacity = '1';
        });

        setTimeout(() => {
            toast.style.transform = 'translateX(30px)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    function extractInfoHash(magnetUrl) {
        if (!magnetUrl) return '';
        const match = magnetUrl.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
        return match ? match[1].toLowerCase() : '';
    }

    // -------------------------------------------------------------------------
    // 工具函数：SHA-1 计算与 Bencode 种子解析引擎（无第三方依赖，纯原生实现）
    // -------------------------------------------------------------------------
    function sha1(bytes) {
        if (typeof bytes === 'string') {
            bytes = new TextEncoder().encode(bytes);
        }
        const len = bytes.length;
        const totalWords = (((len + 8) >> 6) + 1) * 16;
        const words = new Int32Array(totalWords);
        for (let i = 0; i < len; i++) {
            words[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
        }
        words[len >> 2] |= 0x80 << (24 - (len % 4) * 8);
        words[totalWords - 2] = Math.floor((len * 8) / 0x100000000);
        words[totalWords - 1] = (len * 8) >>> 0;

        let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
        const w = new Int32Array(80);

        for (let i = 0; i < totalWords; i += 16) {
            for (let j = 0; j < 16; j++) w[j] = words[i + j];
            for (let j = 16; j < 80; j++) {
                const val = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
                w[j] = (val << 1) | (val >>> 31);
            }

            let a = h0, b = h1, c = h2, d = h3, e = h4;
            for (let j = 0; j < 80; j++) {
                let f, k;
                if (j < 20) {
                    f = (b & c) | ((~b) & d);
                    k = 0x5A827999;
                } else if (j < 40) {
                    f = b ^ c ^ d;
                    k = 0x6ED9EBA1;
                } else if (j < 60) {
                    f = (b & c) | (b & d) | (c & d);
                    k = 0x8F1BBCDC;
                } else {
                    f = b ^ c ^ d;
                    k = 0xCA62C1D6;
                }
                const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[j]) | 0;
                e = d;
                d = c;
                c = ((b << 30) | (b >>> 2)) | 0;
                b = a;
                a = temp;
            }

            h0 = (h0 + a) | 0;
            h1 = (h1 + b) | 0;
            h2 = (h2 + c) | 0;
            h3 = (h3 + d) | 0;
            h4 = (h4 + e) | 0;
        }

        const hex = (n) => (n >>> 0).toString(16).padStart(8, '0');
        return (hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4)).toLowerCase();
    }

    function extractInfoHashFromTorrentBytes(bytes) {
        if (!bytes || bytes.length === 0) return null;
        const len = bytes.length;
        let infoStart = -1;
        // 检索 "4:info" 关键字 (ASCII: 52, 58, 105, 110, 102, 111)
        for (let i = 0; i < len - 7; i++) {
            if (bytes[i] === 52 && bytes[i+1] === 58 && bytes[i+2] === 105 &&
                bytes[i+3] === 110 && bytes[i+4] === 102 && bytes[i+5] === 111) {
                infoStart = i + 6;
                break;
            }
        }
        if (infoStart === -1) return null;

        let pos = infoStart;
        function parseValue() {
            if (pos >= len) throw new Error('Unexpected EOF');
            const byte = bytes[pos];
            if (byte === 105) { // 'i' 整数
                pos++;
                while (pos < len && bytes[pos] !== 101) pos++;
                if (pos >= len) throw new Error('Unterminated int');
                pos++; // 跳过 'e'
            } else if (byte === 108 || byte === 100) { // 'l' 列表 或 'd' 字典
                pos++;
                while (pos < len && bytes[pos] !== 101) {
                    parseValue();
                }
                if (pos >= len) throw new Error('Unterminated list/dict');
                pos++; // 跳过 'e'
            } else if (byte >= 48 && byte <= 57) { // 字符串以长度数字 0-9 开头
                let colonIdx = pos;
                while (colonIdx < len && bytes[colonIdx] >= 48 && bytes[colonIdx] <= 57) {
                    colonIdx++;
                }
                if (colonIdx >= len || bytes[colonIdx] !== 58) throw new Error('Invalid string length');
                let strLen = 0;
                for (let i = pos; i < colonIdx; i++) {
                    strLen = strLen * 10 + (bytes[i] - 48);
                }
                pos = colonIdx + 1 + strLen;
            } else {
                throw new Error('Unknown bencode token: ' + byte);
            }
        }

        try {
            parseValue();
            const infoBytes = bytes.subarray(infoStart, pos);
            return sha1(infoBytes);
        } catch (e) {
            return null;
        }
    }

    function resolveTorrentToMagnet(torrentUrl, title) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: torrentUrl,
                responseType: 'arraybuffer',
                timeout: 25000,
                headers: {
                    'Referer': window.location.href,
                    'User-Agent': navigator.userAgent,
                    'Accept': 'application/x-bittorrent, */*'
                },
                onload: (res) => {
                    try {
                        if (res.status >= 200 && res.status < 300) {
                            const bytes = new Uint8Array(res.response);
                            const infoHash = extractInfoHashFromTorrentBytes(bytes);
                            if (!infoHash) {
                                reject(new Error('未能从种子文件中解析出有效 InfoHash'));
                                return;
                            }
                            const cleanTitle = title || '种子文件直推';
                            const magnet = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(cleanTitle)}`;
                            resolve({ magnet, infoHash });
                        } else {
                            reject(new Error(`下载种子失败，HTTP状态码: ${res.status}`));
                        }
                    } catch (e) {
                        reject(new Error(`解析种子异常: ${e.message}`));
                    }
                },
                onerror: () => reject(new Error('网络请求错误，无法下载种子文件')),
                ontimeout: () => reject(new Error('下载种子文件超时'))
            });
        });
    }

    /**
     * 全网智能标题推导引擎（兼容各类影视站、Nyaa、1337x、蜜柑及论坛种子附件）
     */
    function extractSmartTitle(targetElement, magnetLink) {
        // 1. 优先从磁链自带的 dn 参数提取
        if (magnetLink) {
            try {
                const urlObj = new URL(magnetLink.replace(/&amp;/g, '&'));
                const dn = urlObj.searchParams.get('dn');
                if (dn && dn.trim().length > 2) {
                    return decodeURIComponent(dn).replace(/\+/g, ' ').trim();
                }
            } catch (e) {
                const match = magnetLink.match(/[?&]dn=([^&]+)/i);
                if (match) {
                    try {
                        return decodeURIComponent(match[1].replace(/\+/g, ' ')).trim();
                    } catch (e2) {}
                }
            }
        }

        // 2. 目标元素自身若明确为种子文件名
        const directText = targetElement.innerText ? targetElement.innerText.trim() : (targetElement.textContent ? targetElement.textContent.trim() : '');
        if (/\.torrent$/i.test(directText)) {
            return directText.replace(/\.torrent$/i, '').trim();
        }

        // 3. 表格行内查找
        const row = targetElement.closest('tr, li, .torrent-item, .item');
        if (row) {
            const torrentA = row.querySelector('a[href*=".torrent"], a[href*="attach-download"]');
            if (torrentA && torrentA.innerText.trim() && /\.torrent$/i.test(torrentA.innerText.trim())) {
                return torrentA.innerText.trim().replace(/\.torrent$/i, '');
            }
            const nyaaA = row.querySelector('td:not(.text-center) a[href*="/view/"]:not(.comments), a[href*="/view/"]:not(.comments)');
            if (nyaaA && nyaaA.innerText.trim()) return nyaaA.innerText.trim();

            const item1337x = row.querySelector('td.name a[href*="/torrent/"], a[href*="/torrent/"]');
            if (item1337x && item1337x.innerText.trim()) return item1337x.innerText.trim();

            const mikanA = row.querySelector('.magnet-link-wrap, a[href*="/Home/Episode/"]');
            if (mikanA && mikanA.innerText.trim()) return mikanA.innerText.trim();

            const genA = row.querySelector('.title a, a.title, .name a, a.name');
            if (genA && genA.innerText.trim()) return genA.innerText.trim();
        }

        // 4. 详情页全局标题查找
        const pageTitleEl = document.querySelector('.box-info-heading h1, .torrent-detail-page h1, .panel-heading .panel-title, h3.panel-title, h1.thread-title, h1#thread_subject, .subject h1, h1');
        if (pageTitleEl && pageTitleEl.innerText.trim()) {
            const hText = pageTitleEl.innerText.trim();
            if (hText.length > 2 && hText.length < 150) return hText;
        }

        if (targetElement.title && targetElement.title.length > 5) return targetElement.title.trim();
        if (directText && directText.length > 4 && !/magnet|download|下载|磁链/i.test(directText)) {
            return directText;
        }

        return document.title.replace(/ - (1337x|Nyaa|Sukebei|蜜柑计划|SeedHub).*$/i, '').trim() || '迅雷远程下载';
    }

    // -------------------------------------------------------------------------
    // Webhook 核心请求与状态管理
    // -------------------------------------------------------------------------
    function pushToWebhook(targetUrl, title) {
        return new Promise((resolve, reject) => {
            const webhookUrl = GM_getValue('xl_webhook_url', DEFAULT_WEBHOOK_URL).trim();
            const secret = GM_getValue('xl_webhook_secret', DEFAULT_SECRET).trim();

            if (!webhookUrl) {
                reject(new Error('CONFIG_REQUIRED'));
                return;
            }

            const sep = webhookUrl.includes('?') ? '&' : '?';
            const fullApiUrl = secret ? `${webhookUrl}${sep}secret=${encodeURIComponent(secret)}` : webhookUrl;

            GM_xmlhttpRequest({
                method: 'POST',
                url: fullApiUrl,
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify({
                    url: targetUrl,
                    title: title
                }),
                onload: (res) => {
                    try {
                        const rawText = res.responseText || '';
                        let data = {};
                        try {
                            data = JSON.parse(rawText);
                        } catch (e) {
                            data = { raw_output: rawText };
                        }

                        if (res.status >= 200 && res.status < 300) {
                            if (data.code === 0 || data.status === 'success' || rawText.includes('成功') || rawText.includes('已成功')) {
                                resolve(data);
                            } else if (data.status === 'error' || data.code !== undefined) {
                                reject(new Error(data.message || '群晖推送执行返回错误'));
                            } else {
                                resolve(data);
                            }
                        } else if (res.status === 403 || res.status === 401) {
                            reject(new Error('AUTH_FORBIDDEN'));
                        } else {
                            reject(new Error(`HTTP ${res.status}: ${data.message || rawText || 'Webhook 服务响应异常'}`));
                        }
                    } catch (err) {
                        reject(err);
                    }
                },
                ontimeout: () => reject(new Error('连接群晖 Webhook 超时，请检查内网或穿透网络')),
                onerror: () => reject(new Error('无法连接到群晖 Webhook 容器，请确认网络地址与端口是否可访问'))
            });
        });
    }

    // -------------------------------------------------------------------------
    // 配置弹窗组件
    // -------------------------------------------------------------------------
    function showConfigModal() {
        const exist = document.getElementById('xl-webhook-modal');
        if (exist) exist.remove();

        const currentUrl = GM_getValue('xl_webhook_url', DEFAULT_WEBHOOK_URL);
        const currentSecret = GM_getValue('xl_webhook_secret', DEFAULT_SECRET);

        const modal = document.createElement('div');
        modal.id = 'xl-webhook-modal';
        modal.innerHTML = `
            <div style="position:fixed;inset:0;background:rgba(15,23,42,0.65);backdrop-filter:blur(4px);z-index:99999998;display:flex;align-items:center;justify-content:center;padding:20px;">
                <div style="background:#ffffff;border-radius:14px;width:520px;max-width:100%;padding:24px 28px;box-shadow:0 20px 40px rgba(0,0,0,0.3);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
                        <h3 style="margin:0;font-size:18px;font-weight:700;display:flex;align-items:center;gap:8px;">
                            <span>⚡</span> 迅雷下载助手 Webhook 版设置
                        </h3>
                        <span style="font-size:12px;background:#e0f2fe;color:#0284c7;padding:3px 10px;border-radius:20px;font-weight:600;">
                            免 Token 模式
                        </span>
                    </div>

                    <div style="background:#f1f5f9;border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:12px;color:#475569;line-height:1.6;">
                        <div><b>工作机制：</b>本脚本不再向迅雷云端上传个人 Token，所有磁链和种子均直接转发至您的群晖 <code>lwlook/webhook</code> 容器，由群晖统一调度，永久稳定不失效。</div>
                    </div>

                    <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:#334155;">
                        Webhook 端点地址 (支持内网 IP 或外网反代域名)：
                    </label>
                    <input id="xl-webhook-input-url" type="text" value="${currentUrl}" placeholder="http://192.168.1.100:9000/hooks/xunlei-push 或 https://your-nas.com/hooks/xunlei-push" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;font-family:monospace;outline:none;margin-bottom:14px;" />

                    <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:#334155;">
                        Webhook 访问密钥 (Secret)：
                    </label>
                    <input id="xl-webhook-input-secret" type="text" value="${currentSecret}" placeholder="请输入 Webhook 访问密钥 Secret（若未设置可留空）" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;font-family:monospace;outline:none;" />

                    <div style="margin-top:20px;display:flex;justify-content:space-between;align-items:center;">
                        <button id="xl-webhook-btn-test" style="padding:8px 14px;border:1px solid #cbd5e1;background:#f8fafc;color:#334155;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">🔗 测试连通性</button>
                        <div style="display:flex;gap:10px;">
                            <button id="xl-webhook-btn-cancel" style="padding:8px 16px;border:1px solid #cbd5e1;background:#fff;color:#475569;border-radius:6px;cursor:pointer;font-size:13px;">取消</button>
                            <button id="xl-webhook-btn-save" style="padding:8px 20px;border:none;background:#0284c7;color:#fff;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;box-shadow:0 2px 8px rgba(2,132,199,0.3);">保存设置</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#xl-webhook-btn-cancel').onclick = () => modal.remove();

        modal.querySelector('#xl-webhook-btn-test').onclick = async () => {
            const urlVal = modal.querySelector('#xl-webhook-input-url').value.trim();
            const secretVal = modal.querySelector('#xl-webhook-input-secret').value.trim();
            if (!urlVal) {
                showToast('测试失败', '请先填写 Webhook 地址', 'error');
                return;
            }
            showToast('测试连接中', '正在 ping 群晖 Webhook 端口...', 'info');
            try {
                const sep = urlVal.includes('?') ? '&' : '?';
                const testUrl = secretVal ? `${urlVal}${sep}secret=${encodeURIComponent(secretVal)}` : urlVal;
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: testUrl,
                    timeout: 8000,
                    onload: (res) => {
                        if (res.status === 200 || res.status === 405 || (res.status >= 200 && res.status < 500)) {
                            showToast('连通成功！', `Webhook 服务在线，状态码: ${res.status}`, 'success');
                        } else {
                            showToast('连接异常', `状态码: ${res.status}`, 'error');
                        }
                    },
                    onerror: () => showToast('无法连接', '请检查群晖 IP 或端口是否开放', 'error'),
                    ontimeout: () => showToast('连接超时', '请检查网络连接', 'error')
                });
            } catch (e) {
                showToast('测试失败', e.message, 'error');
            }
        };

        modal.querySelector('#xl-webhook-btn-save').onclick = () => {
            const urlVal = modal.querySelector('#xl-webhook-input-url').value.trim();
            const secretVal = modal.querySelector('#xl-webhook-input-secret').value.trim();
            if (!urlVal) {
                showToast('保存失败', 'Webhook 地址不能为空', 'error');
                return;
            }
            GM_setValue('xl_webhook_url', urlVal);
            GM_setValue('xl_webhook_secret', secretVal);
            showToast('设置已保存', '已成功配置群晖 Webhook 终端', 'success');
            modal.remove();
        };
    }

    GM_registerMenuCommand('⚙️ 群晖 Webhook 设置', showConfigModal);

    // -------------------------------------------------------------------------
    // 按钮渲染与交互挂载
    // -------------------------------------------------------------------------
    function findItemContainer(el) {
        return el.closest(
            'tr, li, .item, .torrent-item, .magnet-row, .row, .torrent_row, .gl-item, .list-item, [data-rank], .magnet-links-item, .box, article'
        ) || el.parentElement || document.body;
    }

    function updateButtonState(button, state, textOverride) {
        button.dataset.state = state;
        const isIcon = button.dataset.mode === 'icon';

        if (state === 'SUCCESS') {
            button.textContent = isIcon ? '✅' : '✅ 已推送';
            button.style.backgroundColor = '#059669';
            button.style.borderColor = '#047857';
            button.title = '该任务已成功推送到群晖迅雷！';
        } else if (state === 'PUSHING') {
            button.textContent = isIcon ? '⏳' : '⏳ 推送中...';
            button.style.backgroundColor = '#64748b';
            button.style.borderColor = '#475569';
        } else if (state === 'ERROR') {
            button.textContent = isIcon ? '❌' : '❌ 失败重试';
            button.style.backgroundColor = '#dc2626';
            button.style.borderColor = '#b91c1c';
        } else {
            button.textContent = isIcon ? '⚡' : '⚡ 迅雷直推';
            button.style.backgroundColor = '#0284c7';
            button.style.borderColor = '#0369a1';
            button.title = '点击直接推送到群晖迅雷套件下载';
        }

        if (textOverride && !isIcon) {
            button.textContent = textOverride;
        }
    }

    function addDownloadButton(targetElement, magnetLink, torrentUrl) {
        if (targetElement.dataset.xunleiProcessed) return;

        const infoHash = magnetLink ? extractInfoHash(magnetLink) : '';
        const history = GM_getValue('xl_pushed_hashes', {});
        const isPushed = infoHash ? Boolean(history[infoHash]) : (torrentUrl ? Boolean(history[torrentUrl]) : false);

        const title = extractSmartTitle(targetElement, magnetLink);

        const button = document.createElement('button');
        button.className = 'xunlei-webhook-btn';
        if (infoHash) button.dataset.hash = infoHash;
        if (torrentUrl) button.dataset.torrentUrl = torrentUrl;

        // 识别场景模式 (icon / group / normal)
        const isIconMode = Boolean(
            targetElement.closest('.item-icons, #torrents .item-icons, td.coll-1, td.text-center') ||
            targetElement.tagName === 'IMG' ||
            targetElement.tagName === 'SVG' ||
            (targetElement.parentElement && targetElement.parentElement.classList && targetElement.parentElement.classList.contains('item-icons')) ||
            (targetElement.offsetWidth > 0 && targetElement.offsetWidth <= 32 && !targetElement.textContent.trim())
        );

        const isGroupMode = !isIconMode && Boolean(
            targetElement.closest('.buttons, .btn-group, .actions, .magnet-actions, .download-buttons') ||
            (targetElement.classList && (targetElement.classList.contains('button') || targetElement.classList.contains('btn')))
        );

        const mode = isIconMode ? 'icon' : (isGroupMode ? 'group' : 'normal');
        button.dataset.mode = mode;

        if (isGroupMode) {
            if (targetElement.classList && targetElement.classList.contains('button')) {
                button.classList.add('button', 'is-small');
            } else if (targetElement.classList && targetElement.classList.contains('btn')) {
                button.classList.add('btn', 'btn-sm');
            }
        }

        if (mode === 'icon') {
            button.style.cssText = `
                display: inline-flex; align-items: center; justify-content: center;
                width: 22px; min-width: 22px; max-width: 22px;
                height: 18px; min-height: 18px; max-height: 18px;
                padding: 0; margin: 0 0 0 3px;
                border-radius: 3px; font-size: 11px; font-weight: 600;
                line-height: 16px; cursor: pointer; vertical-align: middle;
                box-sizing: border-box; flex-shrink: 0;
                background-color: #0284c7; color: #ffffff;
                border: 1px solid #0369a1; box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                transition: all 0.2s ease; text-decoration: none;
            `;
        } else if (mode === 'group') {
            button.style.cssText = `
                display: inline-flex; align-items: center; justify-content: center;
                padding: 0 6px; margin: 0 2px;
                height: 24px; min-height: 24px;
                border-radius: 3px; font-size: 11px; font-weight: 600;
                line-height: 22px; cursor: pointer; vertical-align: middle;
                box-sizing: border-box; flex-shrink: 0; white-space: nowrap;
                background-color: #0284c7; color: #ffffff;
                border: 1px solid #0369a1; box-shadow: 0 1px 2px rgba(0,0,0,0.08);
                transition: all 0.2s ease; text-decoration: none;
            `;
        } else {
            button.style.cssText = `
                display: inline-flex; align-items: center; justify-content: center;
                margin: 0 4px; padding: 2px 8px; border-radius: 4px;
                font-size: 11px; font-weight: 600; cursor: pointer;
                height: 24px; min-height: 24px; line-height: 22px;
                vertical-align: middle; flex-shrink: 0; box-sizing: border-box;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                white-space: nowrap; transition: all 0.2s ease;
                box-shadow: 0 1px 2px rgba(0,0,0,0.08); border: 1px solid #0369a1;
                background-color: #0284c7; color: #ffffff; text-decoration: none;
            `;
        }

        updateButtonState(button, isPushed ? 'SUCCESS' : 'INITIAL');

        button.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (button.dataset.state === 'SUCCESS') {
                const confirmed = confirm(`【重新推送确认】\n\n任务名：${title}\n\n该条目此前已推送过，是否确认重新推送到群晖？`);
                if (!confirmed) return;
            }

            button.disabled = true;
            updateButtonState(button, 'PUSHING');

            try {
                let targetUrl = magnetLink;
                let activeHash = infoHash;

                if (!targetUrl && torrentUrl) {
                    updateButtonState(button, 'PUSHING', '⏳ 解析种子...');
                    try {
                        const resolved = await resolveTorrentToMagnet(torrentUrl, title);
                        targetUrl = resolved.magnet;
                        activeHash = resolved.infoHash;
                    } catch (resolveErr) {
                        console.warn('[迅雷Webhook] 浏览器端解析种子失败，回退由服务端解析:', resolveErr);
                        targetUrl = torrentUrl;
                    }
                }

                updateButtonState(button, 'PUSHING', '⏳ 推送中...');
                const res = await pushToWebhook(targetUrl, title);

                const taskName = res.task_name || title;
                showToast(`已成功添加至群晖迅雷`, taskName, 'success');
                updateButtonState(button, 'SUCCESS');

                // 记录推送历史
                const historyMap = GM_getValue('xl_pushed_hashes', {});
                if (activeHash) historyMap[activeHash] = true;
                if (torrentUrl) historyMap[torrentUrl] = true;
                GM_setValue('xl_pushed_hashes', historyMap);
            } catch (err) {
                if (err.message === 'CONFIG_REQUIRED' || err.message === 'AUTH_FORBIDDEN') {
                    showToast('请检查 Webhook 设置', err.message === 'AUTH_FORBIDDEN' ? 'Webhook 访问密钥不匹配' : '请先填写群晖 Webhook 地址', 'error');
                    showConfigModal();
                } else {
                    showToast('推送失败', err.message || '网络连接错误', 'error');
                }
                updateButtonState(button, 'ERROR');
            } finally {
                button.disabled = false;
            }
        });

        targetElement.insertAdjacentElement('afterend', button);
        targetElement.dataset.xunleiProcessed = 'true';
    }

    // -------------------------------------------------------------------------
    // 多维磁链深度提取引擎（支持全属性解构、隐藏域、全局变量与 Base64 解码）
    // -------------------------------------------------------------------------
    function extractBase64MagnetsFromText(text) {
        if (!text) return [];
        const results = [];
        const regex = /bWFnbmV0[a-zA-Z0-9+/=]{10,}/g;
        let m;
        while ((m = regex.exec(text)) !== null) {
            try {
                const decoded = atob(m[0]);
                if (decoded && (decoded.startsWith('magnet:') || decoded.includes('magnet:?xt='))) {
                    results.push(decoded);
                }
            } catch (e) {}
        }
        return results;
    }

    function extractMagnetFromElement(el) {
        if (!el) return '';
        const attrs = [
            'data-clipboard-text', 'data-magnet', 'data-link', 'data-url', 
            'data-href', 'data-copy', 'data-content', 'data-text', 
            'value', 'href', 'onclick', 'data-original-title'
        ];
        for (const attr of attrs) {
            const val = el.getAttribute ? el.getAttribute(attr) : '';
            if (val && (val.includes('magnet:?') || val.startsWith('magnet:'))) {
                const m = val.match(/magnet:\?[^\s"'<>]+/i);
                if (m) return m[0];
            }
            if (val && val.includes('bWFnbmV0')) {
                const decoded = extractBase64MagnetsFromText(val);
                if (decoded.length > 0) return decoded[0];
            }
        }
        if (el.dataset) {
            for (const k of Object.keys(el.dataset)) {
                const val = el.dataset[k];
                if (typeof val === 'string' && (val.includes('magnet:?') || val.startsWith('magnet:'))) {
                    const m = val.match(/magnet:\?[^\s"'<>]+/i);
                    if (m) return m[0];
                }
                if (typeof val === 'string' && val.includes('bWFnbmV0')) {
                    const decoded = extractBase64MagnetsFromText(val);
                    if (decoded.length > 0) return decoded[0];
                }
            }
        }
        return '';
    }

    function findGlobalMagnetFromPage() {
        const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
        if (win) {
            for (const key of ['panLink', 'magnetLink', 'magnet', 'downloadUrl', 'seedLink', 'targetLink', 'downUrl', 'data']) {
                try {
                    const val = win[key];
                    if (val && typeof val === 'string') {
                        if (val.includes('magnet:?') || val.startsWith('magnet:')) {
                            const m = val.match(/magnet:\?[^\s"'<>]+/i);
                            if (m) return m[0];
                        }
                        if (val.includes('bWFnbmV0')) {
                            const decoded = extractBase64MagnetsFromText(val);
                            if (decoded.length > 0) return decoded[0];
                        }
                    }
                } catch (e) {}
            }
        }

        const inputs = document.querySelectorAll('input, textarea');
        for (const inp of inputs) {
            const val = inp.value || '';
            if (val && val.includes('magnet:?xt=urn:btih:')) {
                const m = val.match(/magnet:\?[^\s"'<>]+/i);
                if (m) return m[0];
            }
            if (val && val.includes('bWFnbmV0')) {
                const decoded = extractBase64MagnetsFromText(val);
                if (decoded.length > 0) return decoded[0];
            }
        }

        try {
            const fullHtml = document.documentElement ? document.documentElement.innerHTML : '';
            if (fullHtml && fullHtml.includes('magnet:?xt=urn:btih:')) {
                const m = fullHtml.match(/magnet:\?xt=urn:btih:[a-zA-Z0-9]+[^\s"'<>\\`]+/i);
                if (m) return m[0];
            }
            const scripts = document.querySelectorAll('script:not([src])');
            for (const sc of scripts) {
                const code = sc.textContent || '';
                const decodedList = extractBase64MagnetsFromText(code);
                if (decodedList.length > 0) return decodedList[0];
            }
            const decodedList = extractBase64MagnetsFromText(fullHtml);
            if (decodedList.length > 0) return decodedList[0];
        } catch (e) {}

        return '';
    }

    function findCopyMagnetButtons() {
        const results = [];
        const candidates = document.querySelectorAll('button, a, div, span, p, input, [role="button"], [class*="btn"], [class*="copy"], [id*="copy"], [class*="magnet"], [id*="magnet"], [id="thunder"]');
        for (const el of candidates) {
            if (el.classList && el.classList.contains('xunlei-webhook-btn')) continue;
            if (el.dataset.xunleiProcessed) continue;

            const text = (el.innerText || el.textContent || el.value || '').trim();
            if (!text || text.length > 25) continue;

            if (/复制磁力|下载磁力|磁力下载|复制magnet|拷贝磁力|磁力链接|获取磁力|迅雷高速下载/i.test(text)) {
                const hasMatchingChild = Array.from(el.children).some(child => {
                    const cText = (child.innerText || child.textContent || '').trim();
                    return /复制磁力|下载磁力|磁力下载|复制magnet|拷贝磁力|磁力链接|获取磁力|迅雷高速下载/i.test(cText);
                });
                if (!hasMatchingChild) {
                    results.push(el);
                }
            }
        }
        return results;
    }

    // -------------------------------------------------------------------------
    // 磁链检测主引擎
    // -------------------------------------------------------------------------
    function detectMagnetLinks() {
        const selector = [
            'a[href^="magnet:"]',
            'a[href*="magnet:?"]',
            '[data-clipboard-text*="magnet:?"]',
            '[data-magnet*="magnet:?"]',
            '[data-link*="magnet:?"]',
            '[data-url*="magnet:?"]',
            '[data-href*="magnet:?"]',
            '[data-copy*="magnet:?"]',
            '[data-content*="magnet:?"]',
            '[value*="magnet:?"]',
            '[onclick*="magnet:?"]',
            'a.js-magnet',
            'a.magnet-link',
            '[data-magnet]'
        ].join(', ');

        const directElements = Array.from(document.querySelectorAll(selector));
        let foundAny = false;
        const candidateMap = new Map();

        directElements.forEach(el => {
            if (el.tagName === 'A' && el.querySelector('div, p, table, ul, ol, section, .tags, .meta, .name, .tag')) {
                return;
            }

            const mag = extractMagnetFromElement(el);
            if (!mag || (!mag.startsWith('magnet:') && !mag.includes('magnet:?xt='))) return;

            const infoHash = extractInfoHash(mag);
            if (!infoHash) return;

            const container = findItemContainer(el);
            if (container.querySelector(`.xunlei-webhook-btn[data-hash="${infoHash}"]`)) return;

            if (!container.dataset.xlWebhookId) {
                container.dataset.xlWebhookId = 'xl_' + Math.random().toString(36).slice(2, 9);
            }
            const groupKey = `${infoHash}_${container.dataset.xlWebhookId}`;
            candidateMap.set(groupKey, { el, mag, container, infoHash });
        });

        // 语义化增强扫描 (如 SeedHub)
        const semanticButtons = findCopyMagnetButtons();
        if (semanticButtons.length > 0) {
            const globalMag = findGlobalMagnetFromPage();
            semanticButtons.forEach(btn => {
                if (btn.dataset.xunleiProcessed || btn.classList.contains('xunlei-webhook-btn')) return;

                let mag = extractMagnetFromElement(btn);
                if (!mag) {
                    const container = findItemContainer(btn);
                    if (container) {
                        const candidates = container.querySelectorAll('input, textarea, code, pre, [data-link], [data-url], [data-magnet]');
                        for (const item of candidates) {
                            const val = item.value || extractMagnetFromElement(item) || item.innerText || item.textContent || '';
                            const m = val.match(/magnet:\?[^\s"'<>]+/i);
                            if (m) { mag = m[0]; break; }
                        }
                    }
                }
                if (!mag && globalMag) mag = globalMag;

                if (mag) {
                    const infoHash = extractInfoHash(mag);
                    if (!infoHash) return;
                    const container = findItemContainer(btn);
                    if (container.querySelector(`.xunlei-webhook-btn[data-hash="${infoHash}"]`)) return;

                    if (!container.dataset.xlWebhookId) {
                        container.dataset.xlWebhookId = 'xl_' + Math.random().toString(36).slice(2, 9);
                    }
                    const groupKey = `${infoHash}_${container.dataset.xlWebhookId}`;
                    candidateMap.set(groupKey, { el: btn, mag, container, infoHash });
                }
            });
        }

        candidateMap.forEach(({ el, mag, container, infoHash }) => {
            if (!container.querySelector(`.xunlei-webhook-btn[data-hash="${infoHash}"]`)) {
                foundAny = true;
                addDownloadButton(el, mag);
            }
        });

        // 纯文本节点扫描
        const magnetRegex = /magnet:\?[^\s<>"']+/gi;
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    if (node.parentElement && (node.parentElement.dataset.xunleiProcessed || 
                        node.parentElement.classList.contains('xunlei-webhook-btn') ||
                        ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'BUTTON'].includes(node.parentElement.tagName))) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            if (magnetRegex.test(node.textContent)) textNodes.push(node);
        }

        textNodes.forEach(textNode => {
            const matches = textNode.textContent.match(magnetRegex);
            if (matches && textNode.parentElement && !textNode.parentElement.dataset.xunleiProcessed) {
                matches.forEach(magnetLink => {
                    const infoHash = extractInfoHash(magnetLink);
                    const container = findItemContainer(textNode.parentElement);
                    if (container && container.querySelector(`.xunlei-webhook-btn[data-hash="${infoHash}"]`)) return;

                    foundAny = true;
                    const span = document.createElement('span');
                    span.style.cssText = 'display: inline-block; margin: 0 4px;';
                    textNode.parentElement.insertBefore(span, textNode.nextSibling);
                    addDownloadButton(span, magnetLink);
                });
                textNode.parentElement.dataset.xunleiProcessed = 'true';
            }
        });

        // 种子文件与论坛附件扫描（1lou、NexusPHP、Discuz等）
        const torrentSelectors = [
            'a[href*=".torrent"]',
            'a[href*="attach-download-"]',
            'a[href*="attachment.php?"]',
            'a[href*="download.php?"]',
            'a[href*="/torrent/"]',
            'a[href*="/download/"]',
            'a[download*=".torrent"]'
        ].join(', ');

        const torrentLinks = Array.from(document.querySelectorAll(torrentSelectors));
        document.querySelectorAll('a').forEach(a => {
            if (!torrentLinks.includes(a)) {
                const text = (a.innerText || a.textContent || '').trim();
                if (/\.torrent$/i.test(text)) torrentLinks.push(a);
            }
        });

        torrentLinks.forEach(el => {
            if (el.dataset.xunleiProcessed) return;
            if (el.querySelector('div, p, table, ul, ol, section')) return;

            const href = el.getAttribute('href') || el.href || '';
            if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
            if (href.startsWith('magnet:') || href.includes('magnet:?xt=')) return;

            let fullUrl = href;
            try { fullUrl = new URL(href, window.location.href).href; } catch(e) {}

            const container = findItemContainer(el);
            if (container.querySelector(`.xunlei-webhook-btn[data-torrent-url="${fullUrl}"]`)) return;

            addDownloadButton(el, '', fullUrl);
            foundAny = true;
        });

        return foundAny;
    }

    // 定时扫描
    setInterval(detectMagnetLinks, 1500);
    detectMagnetLinks();
})();
