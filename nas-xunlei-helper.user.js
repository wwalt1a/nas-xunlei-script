// ==UserScript==
// @name         迅雷下载助手脚本版
// @namespace    https://github.com/saaak/xunlei-docker-ext
// @version      1.4.3
// @description  基于 saaak/xunlei-docker-ext 扩展移植重构，专为迅雷 NAS (群晖 DSM / Docker / 威联通 QNAP) 与 Firefox / Chrome 深度适配。一键抓取全网磁力链接与种子文件（.torrent）推送到远程 NAS，支持双向下载状态实时同步与目录平铺直存。
// @author       Community
// @license      MIT
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @connect      xluser-ssl.xunlei.com
// @connect      api-pan.xunlei.com
// @connect      *
// ==/UserScript==

(function () {
    'use strict';

    const CLIENT_ID = 'Xp6vsxz_7IYVw2BB';
    const CLIENT_VERSION = '8.31.0.9726';
    const PACKAGE_NAME = 'com.xunlei.downloadprovider';
    const REDIRECT_URI = 'xlaccsdk01://xunlei.com/callback?state=harbor';

    // -------------------------------------------------------------------------
    // 域名黑名单与局域网安全过滤机制
    // -------------------------------------------------------------------------
    const currentHost = (window.location && window.location.hostname) ? window.location.hostname.toLowerCase() : '';

    function isPrivateNetwork(host) {
        if (!host) return false;
        if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
        // IPv4 私有网段 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16)
        if (/^(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3})$/.test(host)) {
            return true;
        }
        if (/\.(local|lan|internal|home|corp)$/i.test(host)) return true;
        const port = window.location ? window.location.port : '';
        if (port === '5000' || port === '5001' || port === '5005' || port === '5006') return true;
        return false;
    }

    function getExcludedDomains() {
        const val = GM_getValue('xl_excluded_domains', []);
        return Array.isArray(val) ? val : [];
    }

    function isCurrentDomainExcluded() {
        if (!currentHost) return false;
        const list = getExcludedDomains();
        return list.some(item => {
            const d = item.toLowerCase().trim();
            return d && (currentHost === d || currentHost.endsWith('.' + d));
        });
    }

    function addExcludeDomain(host) {
        if (!host) return;
        const list = getExcludedDomains().filter(d => d.toLowerCase().trim() !== host);
        list.push(host);
        GM_setValue('xl_excluded_domains', list);
    }

    function removeExcludeDomain(host) {
        if (!host) return;
        const list = getExcludedDomains().filter(d => {
            const item = d.toLowerCase().trim();
            return item !== host && !host.endsWith('.' + item);
        });
        GM_setValue('xl_excluded_domains', list);
    }

    // 1. 局域网私有网段与群晖/路由器管理后台安全保护：默认彻底跳过，杜绝系统冲突
    if (isPrivateNetwork(currentHost)) {
        console.log(`[迅雷助手] 检测到当前处于私有局域网/群晖管理页面 (${currentHost})，脚本已自动安全停用，避免干扰管理系统。`);
        GM_registerMenuCommand(`🔒 局域网/管理后台已自动安全忽略 (${currentHost})`, () => {
            alert(`【迅雷助手安全防护】\n\n检测到当前地址 (${currentHost}) 属于私有局域网 IP 或 NAS/路由器管理后台。\n\n为确保群晖 DSM、路由器等核心系统运行绝对稳定，本脚本在此类页面已自动完全停用，不会执行任何网络拦截和按钮注入。`);
        });
        GM_registerMenuCommand('⚙️ 迅雷 NAS 设置与教程', showConfigModal);
        return;
    }

    // 2. 检查当前域名是否处于用户手动排除名单
    if (isCurrentDomainExcluded()) {
        GM_registerMenuCommand(`✅ 在当前网站启用 (${currentHost})`, () => {
            removeExcludeDomain(currentHost);
            alert(`【迅雷助手】已将 ${currentHost} 从排除名单中移除，本脚本将恢复在此网站运行。\n\n页面即将自动刷新。`);
            window.location.reload();
        });
        GM_registerMenuCommand('⚙️ 迅雷 NAS 设置与教程', showConfigModal);
        console.log(`[迅雷助手] 当前网站 ${currentHost} 处于排除名单中，脚本已自动停用。`);
        return;
    }

    GM_registerMenuCommand(`🚫 在当前网站禁用 (${currentHost})`, () => {
        if (confirm(`【迅雷助手设置】\n\n是否确认在当前网站 (${currentHost}) 禁用本脚本？\n\n禁用后脚本将彻底停止在此网站注入下载按钮与拦截请求。\n您可随时通过油猴扩展菜单重新启用。`)) {
            addExcludeDomain(currentHost);
            window.location.reload();
        }
    });
    GM_registerMenuCommand('⚙️ 迅雷 NAS 设置与教程', showConfigModal);
    GM_registerMenuCommand('🔄 强制刷新群晖下载状态', () => {
        showToast('正在同步', '正在向群晖请求最新的任务完成状态...', 'info');
        syncNasTasks();
    });

    // -------------------------------------------------------------------------
    // 动态网络与交互拦截层（仅在 ext.to 等已知动态 API 签名站点激活，杜绝全网污染）
    // -------------------------------------------------------------------------
    const extMagnetCache = new Map(); // id -> magnet url
    let extMagnetResolvers = [];

    function needsNetworkInterceptor(host) {
        if (!host) return false;
        const dynamicSites = ['ext.to', 'ext.is', 'ext.stream', 'extratorrent'];
        return dynamicSites.some(d => host === d || host.endsWith('.' + d));
    }

    (function initNetworkInterceptor() {
        if (!needsNetworkInterceptor(currentHost)) return;

        const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
        if (!win || win.__xl_interceptor_injected) return;
        win.__xl_interceptor_injected = true;

        // 1. 劫持 XMLHttpRequest，捕获任何包含 magnet: 响应的 API (如 ext.to /ajax/getSearchMagnet.php)
        const origOpen = win.XMLHttpRequest.prototype.open;
        const origSend = win.XMLHttpRequest.prototype.send;

        win.XMLHttpRequest.prototype.open = function(method, url) {
            this._xl_url = url ? url.toString() : '';
            return origOpen.apply(this, arguments);
        };

        win.XMLHttpRequest.prototype.send = function(body) {
            this.addEventListener('load', function() {
                try {
                    // 安全校验：仅在纯文本或默认模式下读取 responseText，防止 InvalidStateError
                    if (!this.responseType || this.responseType === 'text') {
                        const text = this.responseText;
                        if (text && text.includes('magnet:?xt=')) {
                            let parsed = null;
                            try { parsed = JSON.parse(text); } catch (e) {}
                            const magMatch = text.match(/magnet:\?xt=urn:btih:[a-zA-Z0-9]+[^\s"'<>\\`]+/i);
                            const foundMagnet = (parsed && parsed.url && parsed.url.startsWith('magnet:')) ? parsed.url : (magMatch ? magMatch[0] : null);

                            if (foundMagnet) {
                                let reqId = '';
                                if (typeof body === 'string') {
                                    const m = body.match(/(?:torrent_id|id)=([0-9]+)/);
                                    if (m) reqId = m[1];
                                }
                                if (reqId) {
                                    extMagnetCache.set(reqId, foundMagnet);
                                }

                                if (extMagnetResolvers.length > 0) {
                                    const resolvers = [...extMagnetResolvers];
                                    extMagnetResolvers = [];
                                    resolvers.forEach(r => r(foundMagnet));
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.debug('[迅雷助手] XHR 拦截解析忽略:', e);
                }
            });
            return origSend.apply(this, arguments);
        };

        // 2. 劫持原生 fetch (严格绑定宿主 window 上下文，杜绝 Illegal invocation 异常与跨 Realm 污染)
        if (typeof win.fetch === 'function') {
            const origFetch = win.fetch;
            win.fetch = function(...args) {
                const promise = origFetch.apply(win, args);
                if (promise && typeof promise.then === 'function') {
                    promise.then(response => {
                        try {
                            if (response && typeof response.clone === 'function') {
                                const clone = response.clone();
                                clone.text().then(text => {
                                    if (text && text.includes('magnet:?xt=')) {
                                        let parsed = null;
                                        try { parsed = JSON.parse(text); } catch (e) {}
                                        const magMatch = text.match(/magnet:\?xt=urn:btih:[a-zA-Z0-9]+[^\s"'<>\\`]+/i);
                                        const foundMagnet = (parsed && parsed.url && parsed.url.startsWith('magnet:')) ? parsed.url : (magMatch ? magMatch[0] : null);
                                        if (foundMagnet && extMagnetResolvers.length > 0) {
                                            const resolvers = [...extMagnetResolvers];
                                            extMagnetResolvers = [];
                                            resolvers.forEach(r => r(foundMagnet));
                                        }
                                    }
                                }).catch(() => {});
                            }
                        } catch (e) {}
                    }).catch(() => {});
                }
                return promise;
            };
        }

        // 3. 劫持原生 HTMLAnchorElement.prototype.click，避免静默触发时唤起本地 BT 软件
        const origAnchorClick = win.HTMLAnchorElement.prototype.click;
        win.HTMLAnchorElement.prototype.click = function() {
            const href = this.href || '';
            if (win.__xl_suppress_native_click && (href.startsWith('magnet:') || href.includes('magnet:?xt='))) {
                console.log('[迅雷助手] 成功拦截原生磁链弹窗唤醒:', href);
                if (extMagnetResolvers.length > 0) {
                    const resolvers = [...extMagnetResolvers];
                    extMagnetResolvers = [];
                    resolvers.forEach(r => r(href));
                }
                return;
            }
            return origAnchorClick.apply(this, arguments);
        };
    })();

    function fetchExtMagnetFromNative(nativeBtn, torrentId) {
        return new Promise((resolve, reject) => {
            if (torrentId && extMagnetCache.has(torrentId)) {
                resolve(extMagnetCache.get(torrentId));
                return;
            }

            const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
            win.__xl_suppress_native_click = true;

            const timer = setTimeout(() => {
                win.__xl_suppress_native_click = false;
                reject(new Error('获取动态磁链超时，请重试'));
            }, 10000);

            const resolver = (magnet) => {
                clearTimeout(timer);
                win.__xl_suppress_native_click = false;
                if (torrentId && magnet) extMagnetCache.set(torrentId, magnet);
                resolve(magnet);
            };

            extMagnetResolvers.push(resolver);

            try {
                nativeBtn.click();
            } catch (err) {
                clearTimeout(timer);
                win.__xl_suppress_native_click = false;
                reject(new Error('触发原生下载失败: ' + err.message));
            }
        });
    }

    // -------------------------------------------------------------------------
    // 工具函数：MD5 与移动端人机签名
    // -------------------------------------------------------------------------
    function md5(str) {
        function md5cycle(x, k) {
            var a = x[0], b = x[1], c = x[2], d = x[3];
            a = ff(a, b, c, d, k[0], 7, -680876936);
            d = ff(d, a, b, c, k[1], 12, -389564586);
            c = ff(c, d, a, b, k[2], 17, 606105819);
            b = ff(b, c, d, a, k[3], 22, -1044525330);
            a = ff(a, b, c, d, k[4], 7, -176418897);
            d = ff(d, a, b, c, k[5], 12, 1200080426);
            c = ff(c, d, a, b, k[6], 17, -1473231341);
            b = ff(b, c, d, a, k[7], 22, -45705983);
            a = ff(a, b, c, d, k[8], 7, 1770035416);
            d = ff(d, a, b, c, k[9], 12, -1958414417);
            c = ff(c, d, a, b, k[10], 17, -42063);
            b = ff(b, c, d, a, k[11], 22, -1990404162);
            a = ff(a, b, c, d, k[12], 7, 1804603682);
            d = ff(d, a, b, c, k[13], 12, -40341101);
            c = ff(c, d, a, b, k[14], 17, -1502002290);
            b = ff(b, c, d, a, k[15], 22, 1236535329);
            a = gg(a, b, c, d, k[1], 5, -165796510);
            d = gg(d, a, b, c, k[6], 9, -1069501632);
            c = gg(c, d, a, b, k[11], 14, 643717713);
            b = gg(b, c, d, a, k[0], 20, -373897302);
            a = gg(a, b, c, d, k[5], 5, -701558691);
            d = gg(d, a, b, c, k[10], 9, 38016083);
            c = gg(c, d, a, b, k[15], 14, -660478335);
            b = gg(b, c, d, a, k[4], 20, -405537848);
            a = gg(a, b, c, d, k[9], 5, 568446438);
            d = gg(d, a, b, c, k[14], 9, -1019803690);
            c = gg(c, d, a, b, k[3], 14, -187363961);
            b = gg(b, c, d, a, k[8], 20, 1163531501);
            a = gg(a, b, c, d, k[13], 5, -1444681467);
            d = gg(d, a, b, c, k[2], 9, -51403784);
            c = gg(c, d, a, b, k[7], 14, 1735328473);
            b = gg(b, c, d, a, k[12], 20, -1926607734);
            a = hh(a, b, c, d, k[5], 4, -378558);
            d = hh(d, a, b, c, k[8], 11, -2022574463);
            c = hh(c, d, a, b, k[11], 16, 1839030562);
            b = hh(b, c, d, a, k[14], 23, -35309556);
            a = hh(a, b, c, d, k[1], 4, -1530992060);
            d = hh(d, a, b, c, k[4], 11, 1272893353);
            c = hh(c, d, a, b, k[7], 16, -155497632);
            b = hh(b, c, d, a, k[10], 23, -1094730640);
            a = hh(a, b, c, d, k[13], 4, 681279174);
            d = hh(d, a, b, c, k[0], 11, -358537222);
            c = hh(c, d, a, b, k[3], 16, -722521979);
            b = hh(b, c, d, a, k[6], 23, 76029189);
            a = hh(a, b, c, d, k[9], 4, -640364487);
            d = hh(d, a, b, c, k[12], 11, -421815835);
            c = hh(c, d, a, b, k[15], 16, 530742520);
            b = hh(b, c, d, a, k[2], 23, -995338651);
            a = ii(a, b, c, d, k[0], 6, -198630844);
            d = ii(d, a, b, c, k[7], 10, 1126891415);
            c = ii(c, d, a, b, k[14], 15, -1416354905);
            b = ii(b, c, d, a, k[5], 21, -57434055);
            a = ii(a, b, c, d, k[12], 6, 1700485571);
            d = ii(d, a, b, c, k[3], 10, -1894986606);
            c = ii(c, d, a, b, k[10], 15, -1051523);
            b = ii(b, c, d, a, k[1], 21, -2054922799);
            a = ii(a, b, c, d, k[8], 6, 1873313359);
            d = ii(d, a, b, c, k[15], 10, -30611744);
            c = ii(c, d, a, b, k[6], 15, -1560198380);
            b = ii(b, c, d, a, k[13], 21, 1309151649);
            a = ii(a, b, c, d, k[4], 6, -145523070);
            d = ii(d, a, b, c, k[11], 10, -1120210379);
            c = ii(c, d, a, b, k[2], 15, 718787259);
            b = ii(b, c, d, a, k[9], 21, -343485551);
            x[0] = add32(a, x[0]); x[1] = add32(b, x[1]); x[2] = add32(c, x[2]); x[3] = add32(d, x[3]);
        }
        function cmn(q, a, b, x, s, t) { a = add32(add32(a, q), add32(x, t)); return add32((a << s) | (a >>> (32 - s)), b); }
        function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
        function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
        function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
        function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
        function md51(s) {
            var n = s.length, state = [1732584193, -271733879, -1732584194, 271733878], i;
            for (i = 64; i <= s.length; i += 64) { md5cycle(state, md5blk(s.substring(i - 64, i))); }
            s = s.substring(i - 64);
            var tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
            tail[i >> 2] |= 0x80 << ((i % 4) << 3);
            if (i > 55) { md5cycle(state, tail); for (i = 0; i < 16; i++) tail[i] = 0; }
            tail[14] = n * 8; md5cycle(state, tail); return state;
        }
        function md5blk(s) {
            var md5blks = [], i;
            for (i = 0; i < 64; i += 4) {
                md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
            }
            return md5blks;
        }
        var hex_chr = '0123456789abcdef'.split('');
        function rhex(n) {
            var s = '', j = 0;
            for (; j < 4; j++) s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F];
            return s;
        }
        function hex(x) {
            for (var i = 0; i < x.length; i++) x[i] = rhex(x[i]);
            return x.join('');
        }
        function add32(a, b) { return (a + b) & 0xFFFFFFFF; }
        return hex(md51(unescape(encodeURIComponent(str))));
    }

    const ALGORITHMS = [
        "9uJNVj/wLmdwKrJaVj/omlQ", "Oz64Lp0GigmChHMf/6TNfxx7O9PyopcczMsnf",
        "Eb+L7Ce+Ej48u", "jKY0", "ASr0zCl6v8W4aidjPK5KHd1Lq3t+vBFf41dqv5+fnOd",
        "wQlozdg6r1qxh0eRmt3QgNXOvSZO6q/GXK", "gmirk+ciAvIgA/cxUUCema47jr/YToixTT+Q6O",
        "5IiCoM9B1/788ntB", "P07JH0h6qoM6TSUAK2aL9T5s2QBVeY9JWvalf", "+oK0AN"
    ];

    function getCaptchaSign(deviceId) {
        const ts = Date.now().toString();
        let s = `${CLIENT_ID}${CLIENT_VERSION}${PACKAGE_NAME}${deviceId}${ts}`;
        for (const algo of ALGORITHMS) {
            s = md5(s + algo);
        }
        return { ts, sign: `1.${s}` };
    }

    function getOrCreateDeviceId() {
        let devId = GM_getValue('xl_device_id', '');
        if (!devId) {
            devId = md5(`${Date.now()}-${Math.random()}`);
            GM_setValue('xl_device_id', devId);
        }
        return devId;
    }

    function sanitizeTitle(str) {
        if (!str) return '迅雷远程下载';
        return str
            .replace(/\s*[\/\\]+\s*/g, ' - ') // 把 " / " 替换为 " - "，根除多层子目录
            .replace(/[\\:*?"<>|]/g, '')       // 移除非法字符
            .replace(/\s+/g, ' ')             // 合并连续空格
            .trim();
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
     * 全网智能标题推导引擎（兼容 1337x / Nyaa / Sukebei / 蜜柑及各类论坛种子附件）
     */
    function extractSmartTitle(targetElement, magnetLink) {
        // 1. 优先从磁链自带的 dn 参数提取（最权威真实文件名，1337x 和 Nyaa 均完整包含）
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

        // 2. 目标元素自身若明确为种子文件名（如 1lou、各类论坛附件中的 Resident.Evil...torrent）
        const directText = targetElement.innerText ? targetElement.innerText.trim() : (targetElement.textContent ? targetElement.textContent.trim() : '');
        if (/\.torrent$/i.test(directText)) {
            return directText.replace(/\.torrent$/i, '').trim();
        }

        // 3. 表格行内查找（Nyaa、Sukebei、蜜柑、DMHY、论坛附件行、ext.to）
        const row = targetElement.closest('tr, li, .torrent-item, .item');
        if (row) {
            const extTitle = row.querySelector('a.torrent-title-link');
            if (extTitle && extTitle.innerText.trim()) return extTitle.innerText.trim();

            // 论坛附件行或种子文件名链接
            const torrentA = row.querySelector('a[href*=".torrent"], a[href*="attach-download"]');
            if (torrentA && torrentA.innerText.trim() && /\.torrent$/i.test(torrentA.innerText.trim())) {
                return torrentA.innerText.trim().replace(/\.torrent$/i, '');
            }

            // Nyaa / Sukebei: td a[href*="/view/"]
            const nyaaA = row.querySelector('td:not(.text-center) a[href*="/view/"]:not(.comments), a[href*="/view/"]:not(.comments)');
            if (nyaaA && nyaaA.innerText.trim()) return nyaaA.innerText.trim();

            // 1337x 列表: td.name a[href*="/torrent/"]
            const item1337x = row.querySelector('td.name a[href*="/torrent/"], a[href*="/torrent/"]');
            if (item1337x && item1337x.innerText.trim()) return item1337x.innerText.trim();

            // 蜜柑计划
            const mikanA = row.querySelector('.magnet-link-wrap, a[href*="/Home/Episode/"]');
            if (mikanA && mikanA.innerText.trim()) return mikanA.innerText.trim();

            // 通用标题类
            const genA = row.querySelector('.title a, a.title, .name a, a.name');
            if (genA && genA.innerText.trim()) return genA.innerText.trim();
        }

        // 4. 详情页全局标题查找（1337x 详情页 h1、Nyaa 详情页 h3、论坛主题 h1 等）
        const pageTitleEl = document.querySelector('.box-info-heading h1, .torrent-detail-page h1, .panel-heading .panel-title, h3.panel-title, h1.thread-title, h1#thread_subject, .subject h1, h1');
        if (pageTitleEl && pageTitleEl.innerText.trim()) {
            const hText = pageTitleEl.innerText.trim();
            if (hText.length > 2 && hText.length < 150) return hText;
        }

        // 5. 目标元素自身或 title 属性
        if (targetElement.title && targetElement.title.length > 5) return targetElement.title.trim();

        if (directText && directText.length > 4 && !/magnet|download|下载|磁链/i.test(directText)) {
            return directText;
        }

        // 6. 网页标题兜底
        return document.title.replace(/ - (1337x|Nyaa|Sukebei|蜜柑计划|SeedHub).*$/i, '').trim() || '迅雷远程下载';
    }

    function request(options) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                timeout: 15000,
                ...options,
                onload: (res) => {
                    try {
                        const json = JSON.parse(res.responseText || '{}');
                        if (res.status >= 200 && res.status < 300) {
                            resolve(json);
                        } else {
                            reject({ status: res.status, data: json });
                        }
                    } catch (e) {
                        reject({ status: res.status, error: res.responseText });
                    }
                },
                ontimeout: () => reject(new Error('网络请求超时')),
                onerror: (err) => reject(err)
            });
        });
    }

    // -------------------------------------------------------------------------
    // 认证管理与自动静默轮转续期（长效永久机制）
    // -------------------------------------------------------------------------
    async function getValidAccessToken() {
        let accessToken = GM_getValue('xl_access_token', '');
        let expiresAt = GM_getValue('xl_token_expires_at', 0);
        const refreshToken = GM_getValue('xl_refresh_token', '');

        if (!refreshToken) {
            throw new Error('AUTH_REQUIRED');
        }

        if (accessToken && Date.now() < expiresAt - 300000) {
            return accessToken;
        }

        const devId = getOrCreateDeviceId();
        const data = await request({
            method: 'POST',
            url: 'https://xluser-ssl.xunlei.com/v1/auth/token',
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: CLIENT_ID,
                device_id: devId
            })
        });

        if (!data.access_token) {
            throw new Error('刷新授权令牌失败：' + (data.error_description || 'Refresh Token 已失效，请在设置中重新粘贴'));
        }

        GM_setValue('xl_access_token', data.access_token);
        GM_setValue('xl_token_expires_at', Date.now() + (data.expires_in || 7200) * 1000);

        if (data.refresh_token) {
            GM_setValue('xl_refresh_token', data.refresh_token);
        }

        try {
            const payload = JSON.parse(atob(data.access_token.split('.')[1]));
            if (payload.sub) {
                GM_setValue('xl_user_id', payload.sub);
            }
        } catch (e) {}

        return data.access_token;
    }

    async function getCaptchaToken(action, userId) {
        const devId = getOrCreateDeviceId();
        const { ts, sign } = getCaptchaSign(devId);
        const data = await request({
            method: 'POST',
            url: 'https://xluser-ssl.xunlei.com/v1/shield/captcha/init',
            headers: {
                'Content-Type': 'application/json',
                'x-client-id': CLIENT_ID,
                'x-client-version': CLIENT_VERSION
            },
            data: JSON.stringify({
                action: action,
                captcha_token: '',
                client_id: CLIENT_ID,
                device_id: devId,
                meta: {
                    client_version: CLIENT_VERSION,
                    package_name: PACKAGE_NAME,
                    user_id: userId || GM_getValue('xl_user_id', ''),
                    timestamp: ts,
                    captcha_sign: sign
                },
                redirect_uri: REDIRECT_URI
            })
        });
        return data.captcha_token;
    }

    // -------------------------------------------------------------------------
    // 动态探测绑定的 NAS 硬件空间与下载目录 ID
    // -------------------------------------------------------------------------
    async function detectAndSaveRunner(accessToken) {
        const devId = getOrCreateDeviceId();
        const userId = GM_getValue('xl_user_id', '');
        const captcha = await getCaptchaToken('GET:/drive/v1/tasks', userId);

        const res = await request({
            method: 'GET',
            url: 'https://api-pan.xunlei.com/drive/v1/tasks?type=user%23runner',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'pan-auth': accessToken,
                'x-client-id': CLIENT_ID,
                'x-client-version': CLIENT_VERSION,
                'x-device-id': devId,
                'x-captcha-token': captcha
            }
        });

        const runners = (res.tasks || []).filter(t => t.type === 'user#runner');
        if (runners.length === 0) {
            throw new Error('未检测到绑定的迅雷 NAS，请确认群晖/Docker 迅雷套件处于已登录在线状态');
        }

        const runner = runners.find(r => r.params?.online === 'true' || r.params?.online === true) || runners[0];
        const space = runner.params?.target || runner.params?.space || runner.id || '';
        const name = runner.name || runner.params?.device_name || '群晖 NAS';

        if (!space || !space.startsWith('device_id#')) {
            throw new Error(`检测到的设备未识别出有效硬件空间标识: ${space || '空'}`);
        }

        GM_setValue('xl_runner_name', name);
        GM_setValue('xl_runner_space', space);

        try {
            const taskCaptcha = await getCaptchaToken('GET:/drive/v1/tasks', userId);
            const history = await request({
                method: 'GET',
                url: `https://api-pan.xunlei.com/drive/v1/tasks?space=${encodeURIComponent(space)}&limit=10`,
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'pan-auth': accessToken,
                    'x-client-id': CLIENT_ID,
                    'x-client-version': CLIENT_VERSION,
                    'x-device-id': devId,
                    'x-captcha-token': taskCaptcha
                }
            });
            for (const t of history.tasks || []) {
                if (t.params?.parent_folder_id) {
                    GM_setValue('xl_parent_folder_id', t.params.parent_folder_id);
                    break;
                }
            }
        } catch (e) {}

        return { name, space };
    }

    // -------------------------------------------------------------------------
    // 执行推送下载任务（根目录直存）
    // -------------------------------------------------------------------------
    async function pushDownloadTask(magnetUrl, title) {
        const accessToken = await getValidAccessToken();
        let space = GM_getValue('xl_runner_space', '');
        let name = GM_getValue('xl_runner_name', 'NAS');

        if (!space || !space.startsWith('device_id#')) {
            const detected = await detectAndSaveRunner(accessToken);
            space = detected.space;
            name = detected.name;
        }

        const devId = getOrCreateDeviceId();
        const userId = GM_getValue('xl_user_id', '');
        const folderId = GM_getValue('xl_parent_folder_id', '');
        const captcha = await getCaptchaToken('POST:/drive/v1/task', userId);

        const cleanName = sanitizeTitle(title);

        const payload = {
            type: 'user#download-url',
            name: cleanName,
            file_name: '', // 留空：单文件直存根目录，绝不生成嵌套文件夹！
            file_size: '0',
            space: space,
            params: {
                target: space,
                url: magnetUrl,
                parent_folder_id: folderId,
                parent_folder_path: '',
                sub_file_index: '--1,',
                total_file_count: '1',
                file_id: ''
            }
        };

        const result = await request({
            method: 'POST',
            url: 'https://api-pan.xunlei.com/drive/v1/task',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'pan-auth': accessToken,
                'x-client-id': CLIENT_ID,
                'x-client-version': CLIENT_VERSION,
                'x-device-id': devId,
                'x-captcha-token': captcha,
                'Content-Type': 'application/json'
            },
            data: JSON.stringify(payload)
        });

        const infoHash = extractInfoHash(magnetUrl);
        if (infoHash) {
            const history = GM_getValue('xl_pushed_hashes', {});
            history[infoHash] = { title: cleanName, time: Date.now(), phase: 'PHASE_TYPE_PENDING' };
            GM_setValue('xl_pushed_hashes', history);
        }

        setTimeout(syncNasTasks, 2000);
        return { result, name, cleanName };
    }

    // -------------------------------------------------------------------------
    // 状态管理引擎：与群晖 NAS 任务生命周期双向同步
    // -------------------------------------------------------------------------
    function updateButtonState(btn, state, progress, taskTitle) {
        btn.dataset.state = state;
        const mode = btn.dataset.mode || 'normal';
        const rawTitle = taskTitle || btn.dataset.taskTitle || '';
        if (taskTitle) btn.dataset.taskTitle = taskTitle;

        if (state === 'COMPLETE') {
            btn.dataset.pushed = 'true';
            btn.style.backgroundColor = '#059669'; // 翡翠绿
            btn.style.borderColor = '#047857';
            btn.style.color = '#ffffff';

            if (mode === 'icon') {
                btn.textContent = '✔';
            } else if (mode === 'group') {
                btn.textContent = '✔ 完成';
            } else {
                btn.textContent = '✔ 已完成';
            }
            btn.title = `【迅雷 NAS 已入库】${rawTitle ? `任务名: ${rawTitle}\n` : ''}该资源此前已下载完成，点击可选择重新推送。`;
        } else if (state === 'DOWNLOADING') {
            btn.dataset.pushed = 'true';
            btn.style.backgroundColor = '#d97706'; // 暖橙色
            btn.style.borderColor = '#b45309';
            btn.style.color = '#ffffff';

            const pct = (progress !== undefined && progress !== null && progress > 0) ? `${progress}%` : '';
            if (mode === 'icon') {
                btn.textContent = '⏳';
            } else if (mode === 'group') {
                btn.textContent = pct ? `⏳ ${pct}` : '⏳ 下载中';
            } else {
                btn.textContent = `⏳ 正在下载 ${pct}`.trim();
            }
            btn.title = `【迅雷 NAS 下载中 ${pct}】${rawTitle ? `任务名: ${rawTitle}\n` : ''}点击可强制重新提交。`;
        } else if (state === 'ERROR') {
            btn.dataset.pushed = 'false';
            btn.style.backgroundColor = '#dc2626';
            btn.style.borderColor = '#b91c1c';
            btn.style.color = '#ffffff';

            if (mode === 'icon') {
                btn.textContent = '❌';
            } else if (mode === 'group') {
                btn.textContent = '❌ 异常';
            } else {
                btn.textContent = '❌ 下载异常';
            }
            btn.title = `【迅雷 NAS 下载异常】${rawTitle ? `任务名: ${rawTitle}\n` : ''}点击可重试。`;
        } else { // INITIAL
            btn.dataset.pushed = 'false';
            btn.style.backgroundColor = '#0284c7';
            btn.style.borderColor = '#0369a1';
            btn.style.color = '#ffffff';

            if (mode === 'icon') {
                btn.textContent = '⚡';
            } else if (mode === 'group') {
                btn.textContent = '⚡ 迅雷';
            } else {
                btn.textContent = '⚡ 迅雷直推';
            }
            btn.title = `【迅雷 NAS 一键直推】${rawTitle ? `任务名: ${rawTitle}\n` : ''}点击推送到远程 NAS 下载根目录。`;
        }
    }

    async function syncNasTasks() {
        const refreshToken = GM_getValue('xl_refresh_token', '');
        const space = GM_getValue('xl_runner_space', '');
        if (!refreshToken || !space || !space.startsWith('device_id#')) return;

        // 若当前网页没有挂载任何按钮，不发起网络请求以节约流量与算力
        const buttons = document.querySelectorAll('.xunlei-download-btn');
        if (buttons.length === 0) return;

        try {
            const accessToken = await getValidAccessToken();
            const devId = getOrCreateDeviceId();
            const userId = GM_getValue('xl_user_id', '');
            const taskCaptcha = await getCaptchaToken('GET:/drive/v1/tasks', userId);

            const res = await request({
                method: 'GET',
                url: `https://api-pan.xunlei.com/drive/v1/tasks?space=${encodeURIComponent(space)}&limit=100`,
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'pan-auth': accessToken,
                    'x-client-id': CLIENT_ID,
                    'x-client-version': CLIENT_VERSION,
                    'x-device-id': devId,
                    'x-captcha-token': taskCaptcha
                }
            });

            const tasks = res.tasks || [];
            const nasMap = new Map();
            for (const t of tasks) {
                const url = t.params?.url || '';
                const hash = extractInfoHash(url);
                if (hash) {
                    nasMap.set(hash, {
                        phase: t.phase || '',
                        progress: t.progress,
                        name: t.name || ''
                    });
                }
            }

            const history = GM_getValue('xl_pushed_hashes', {});

            buttons.forEach(btn => {
                const hash = btn.dataset.hash;
                if (!hash) return;

                if (nasMap.has(hash)) {
                    const info = nasMap.get(hash);
                    history[hash] = { title: info.name, time: Date.now(), phase: info.phase };
                    if (info.phase === 'PHASE_TYPE_COMPLETE') {
                        updateButtonState(btn, 'COMPLETE', null, info.name);
                    } else if (info.phase === 'PHASE_TYPE_RUNNING' || info.phase === 'PHASE_TYPE_PENDING') {
                        updateButtonState(btn, 'DOWNLOADING', info.progress, info.name);
                    } else if (info.phase === 'PHASE_TYPE_ERROR') {
                        updateButtonState(btn, 'ERROR', null, info.name);
                    }
                } else {
                    if (history[hash]) {
                        delete history[hash];
                    }
                    updateButtonState(btn, 'INITIAL');
                }
            });

            GM_setValue('xl_pushed_hashes', history);
        } catch (e) {
            console.debug('后台静默同步 NAS 状态跳过:', e);
        }
    }

    // -------------------------------------------------------------------------
    // UI：右上角毛玻璃卡片 Toast 与配置弹窗
    // -------------------------------------------------------------------------
    function showToast(title, desc = '', type = 'success') {
        const toast = document.createElement('div');
        const bgColor = type === 'success' ? 'rgba(16, 185, 129, 0.95)' : type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(14, 165, 233, 0.95)';
        toast.style.cssText = `
            position: fixed; top: 24px; right: 24px; z-index: 99999999;
            min-width: 300px; max-width: 440px; padding: 14px 18px; border-radius: 10px;
            backdrop-filter: blur(10px); background: ${bgColor}; color: #ffffff;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            opacity: 0; transform: translateY(-10px);
        `;
        toast.innerHTML = `
            <div style="display:flex;align-items:flex-start;gap:10px;">
                <span style="font-size:20px;line-height:1;">${type === 'success' ? '🚀' : type === 'error' ? '❌' : 'ℹ️'}</span>
                <div style="flex:1;">
                    <div style="font-weight:bold;font-size:14px;margin-bottom:3px;word-break:break-all;">${title}</div>
                    ${desc ? `<div style="font-size:12px;opacity:0.92;line-height:1.4;word-break:break-all;">${desc}</div>` : ''}
                </div>
            </div>
        `;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3600);
    }

    function showConfigModal() {
        const oldModal = document.getElementById('xl-config-modal');
        if (oldModal) oldModal.remove();

        const currentToken = GM_getValue('xl_refresh_token', '');
        const currentRunner = GM_getValue('xl_runner_name', '未绑定');
        const currentSpace = GM_getValue('xl_runner_space', '');
        const isSpaceValid = currentSpace && currentSpace.startsWith('device_id#');
        const excludedDomains = getExcludedDomains();

        const modal = document.createElement('div');
        modal.id = 'xl-config-modal';
        modal.innerHTML = `
            <div style="position:fixed;inset:0;background:rgba(15,23,42,0.6);backdrop-filter:blur(4px);z-index:99999998;display:flex;align-items:center;justify-content:center;padding:20px;">
                <div style="background:#ffffff;border-radius:14px;width:540px;max-width:100%;padding:24px 28px;box-shadow:0 20px 40px rgba(0,0,0,0.25);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
                        <h3 style="margin:0;font-size:18px;font-weight:700;display:flex;align-items:center;gap:8px;">
                            <span>⚡</span> 迅雷 NAS 推送助手设置
                        </h3>
                        <span style="font-size:12px;background:${isSpaceValid ? '#e0f2fe' : '#fee2e2'};color:${isSpaceValid ? '#0284c7' : '#ef4444'};padding:3px 10px;border-radius:20px;font-weight:600;">
                            ${isSpaceValid ? `${currentRunner} (在线)` : '未绑定NAS'}
                        </span>
                    </div>

                    <div style="background:#f1f5f9;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#475569;display:flex;flex-direction:column;gap:4px;">
                        <div><b>目标设备：</b><span style="color:#0f172a;">${currentRunner}</span></div>
                        <div><b>空间标识：</b><code style="color:${isSpaceValid ? '#0284c7' : '#ef4444'};">${currentSpace || '尚未识别到 device_id# 硬件空间'}</code></div>
                        <div><b>保存路径：</b><span>NAS 默认下载根目录 (平铺直存，无多余子文件夹)</span></div>
                    </div>

                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;margin-bottom:14px;font-size:12px;line-height:1.6;color:#475569;">
                        <b style="color:#0f172a;display:block;margin-bottom:4px;">📌 如何从已登录的 Chrome/Edge 迅雷扩展获取长效 Token？</b>
                        1. 在任意打开扩展的页面按 <kbd style="background:#e2e8f0;padding:1px 5px;border-radius:4px;">F12</kbd> 打开控制台（Console）；<br>
                        2. 复制并回车运行下方这行命令：<br>
                        <div style="background:#1e293b;color:#38bdf8;padding:6px 10px;border-radius:5px;font-family:monospace;margin:5px 0;user-select:all;cursor:pointer;" id="xl-copy-cmd" title="点击一键复制">
                            chrome.storage.local.get(['xl_refresh_token'], res => console.log(res.xl_refresh_token))
                        </div>
                        3. 复制输出的 <b style="color:#ef4444;">a1.</b> 开头的长串字符（<b>切勿复制 2小时失效的 xl_access_token！</b>）。
                    </div>

                    <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:#334155;">
                        迅雷 Refresh Token（自动静默轮转，长效永久）：
                    </label>
                    <textarea id="xl-token-input" rows="3" placeholder="在此粘贴 a1.xxxx 开头的长效 Refresh Token" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;font-family:monospace;outline:none;resize:vertical;">${currentToken}</textarea>

                    <div style="margin-top:16px;border-top:1px solid #e2e8f0;padding-top:14px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                            <label style="font-size:13px;font-weight:600;color:#334155;">
                                🚫 域名排除名单 (${excludedDomains.length})：
                            </label>
                            ${excludedDomains.length > 0 ? `<button id="xl-btn-clear-excluded" type="button" style="background:none;border:none;color:#ef4444;font-size:12px;cursor:pointer;padding:0;font-weight:500;">清空全部</button>` : ''}
                        </div>
                        <div id="xl-excluded-list" style="max-height:90px;overflow-y:auto;display:flex;flex-wrap:wrap;gap:6px;padding:2px 0;">
                            ${excludedDomains.length === 0 ? '<span style="font-size:12px;color:#94a3b8;">暂无排除域名（脚本在所有网站默认启用）</span>' : excludedDomains.map(domain => `
                                <span style="display:inline-flex;align-items:center;gap:4px;background:#f1f5f9;border:1px solid #cbd5e1;color:#334155;border-radius:12px;padding:2px 8px;font-size:11px;font-family:monospace;">
                                    ${domain}
                                    <span class="xl-remove-domain-btn" data-domain="${domain}" style="cursor:pointer;color:#94a3b8;font-weight:bold;margin-left:2px;font-size:13px;line-height:1;" title="移除排除">×</span>
                                </span>
                            `).join('')}
                        </div>
                    </div>

                    <div style="margin-top:18px;display:flex;justify-content:space-between;align-items:center;">
                        <button id="xl-btn-clear" style="padding:8px 14px;border:1px solid #fca5a5;background:#fff1f2;color:#e11d48;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">清空缓存</button>
                        <div style="display:flex;gap:10px;">
                            <button id="xl-btn-cancel" style="padding:8px 16px;border:1px solid #cbd5e1;background:#fff;color:#475569;border-radius:6px;cursor:pointer;font-size:13px;">取消</button>
                            <button id="xl-btn-save" style="padding:8px 20px;border:none;background:#0284c7;color:#fff;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;box-shadow:0 2px 8px rgba(2,132,199,0.3);">重新检测并绑定 NAS</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelectorAll('.xl-remove-domain-btn').forEach(btn => {
            btn.onclick = () => {
                const domain = btn.dataset.domain;
                removeExcludeDomain(domain);
                showToast('已移除排除', `${domain} 将恢复启用`, 'info');
                btn.parentElement.remove();
                if (domain === currentHost) {
                    setTimeout(() => window.location.reload(), 800);
                }
            };
        });

        const clearExcludedBtn = modal.querySelector('#xl-btn-clear-excluded');
        if (clearExcludedBtn) {
            clearExcludedBtn.onclick = () => {
                GM_setValue('xl_excluded_domains', []);
                showToast('已清空排除名单', '所有网站已恢复启用', 'info');
                modal.querySelector('#xl-excluded-list').innerHTML = '<span style="font-size:12px;color:#94a3b8;">暂无排除域名（脚本在所有网站默认启用）</span>';
                clearExcludedBtn.remove();
                if (isCurrentDomainExcluded()) {
                    setTimeout(() => window.location.reload(), 800);
                }
            };
        }

        modal.querySelector('#xl-copy-cmd').onclick = () => {
            navigator.clipboard.writeText("chrome.storage.local.get(['xl_refresh_token'], res => console.log(res.xl_refresh_token))");
            showToast('已复制控制台命令', '请在 F12 控制台粘贴回车', 'info');
        };
        modal.querySelector('#xl-btn-cancel').onclick = () => modal.remove();
        modal.querySelector('#xl-btn-clear').onclick = () => {
            GM_setValue('xl_refresh_token', '');
            GM_setValue('xl_access_token', '');
            GM_setValue('xl_runner_space', '');
            GM_setValue('xl_runner_name', '');
            GM_setValue('xl_parent_folder_id', '');
            showToast('已清空本地凭证与缓存', '', 'info');
            modal.remove();
        };
        modal.querySelector('#xl-btn-save').onclick = async () => {
            const tokenVal = modal.querySelector('#xl-token-input').value.trim();
            if (!tokenVal) {
                showToast('保存失败', '请输入有效的 Refresh Token', 'error');
                return;
            }
            GM_setValue('xl_refresh_token', tokenVal);
            GM_setValue('xl_access_token', '');
            GM_setValue('xl_runner_space', '');
            showToast('正在探测 NAS 硬件', '正在连接迅雷服务并定位群晖 Space ID...', 'info');
            try {
                const token = await getValidAccessToken();
                const runner = await detectAndSaveRunner(token);
                showToast('NAS 绑定成功！', `已精准绑定：${runner.name} [${runner.space.substring(0, 15)}...]`, 'success');
                modal.remove();
                syncNasTasks();
            } catch (err) {
                showToast('检测绑定失败', err.message || '请确认 Refresh Token 是否正确', 'error');
            }
        };
    }

    // -------------------------------------------------------------------------
    // 磁力链接识别、全网智能挂载与交互
    // -------------------------------------------------------------------------
    function getElementScore(el) {
        let score = 0;
        // 1. 优先挂载于真正的按钮或输入框
        if (el.tagName === 'BUTTON' || el.tagName === 'INPUT') score += 100;
        // 2. 携带按钮相关 class
        const cls = (el.className || '').toLowerCase();
        if (cls.includes('btn') || cls.includes('button') || cls.includes('copy') || cls.includes('download')) score += 50;
        // 3. 处于按钮群组容器中
        if (el.closest('.buttons, .btn-group, .actions, .magnet-actions, .download-buttons, td.coll-1')) score += 40;
        // 4. 短文本或图标专属链接（如磁力图标）
        const textLen = (el.textContent || '').trim().length;
        if (textLen <= 10) score += 30;
        // 5. 严重惩罚：包裹性父级超链接（内部包含 div, p, tags 等排版块）
        if (el.querySelector('div, p, table, ul, ol, section')) score -= 150;
        // 6. 惩罚长文本（通常为整行条目标题，不适合插入内联按钮）
        if (textLen > 40) score -= 80;
        return score;
    }

    function findItemContainer(el) {
        return el.closest(
            'tr, li, .item, .torrent-item, .magnet-row, .row, .torrent_row, .gl-item, .list-item, [data-rank], .magnet-links-item, .box, article'
        ) || el.parentElement || document.body;
    }

    function addDownloadButton(targetElement, magnetLink, torrentUrl, options = {}) {
        if (targetElement.dataset.xunleiProcessed) return;

        const isExt = Boolean(options && options.isExt);
        const torrentId = options && options.torrentId ? options.torrentId : '';

        let infoHash = magnetLink ? extractInfoHash(magnetLink) : '';
        const torrentHashMap = GM_getValue('xl_torrent_hash_map', {});
        if (!infoHash && torrentUrl && torrentHashMap[torrentUrl]) {
            infoHash = torrentHashMap[torrentUrl];
        }

        const title = extractSmartTitle(targetElement, magnetLink);
        const history = GM_getValue('xl_pushed_hashes', {});
        const cachedItem = infoHash ? history[infoHash] : (torrentId ? history['ext_' + torrentId] : null);

        const button = document.createElement('button');
        button.className = 'xunlei-download-btn';
        if (infoHash) button.dataset.hash = infoHash;
        if (torrentUrl) button.dataset.torrentUrl = torrentUrl;
        if (torrentId) button.dataset.extId = torrentId;
        button.dataset.taskTitle = title;

        // 自动识别场景模式：
        // 1. icon 模式：紧凑表格列（The Pirate Bay 的 .item-icons、td.coll-1、td.text-center、纯图标链接、宽度 <= 85px 紧凑单元格、ext.to）
        const isIconMode = Boolean(
            targetElement.closest('.item-icons, #torrents .item-icons, td.coll-1, td.text-center') ||
            targetElement.tagName === 'IMG' ||
            targetElement.tagName === 'SVG' ||
            (targetElement.parentElement && targetElement.parentElement.classList && targetElement.parentElement.classList.contains('item-icons')) ||
            (targetElement.offsetWidth > 0 && targetElement.offsetWidth <= 32 && !targetElement.textContent.trim()) ||
            (targetElement.classList && (targetElement.classList.contains('dwn-btn') || targetElement.classList.contains('search-magnet-btn')))
        );

        // 2. group 模式：处于框架按钮群组中（JavDB 的 .buttons、Bootstrap .btn-group、Bulma 按钮群）
        const isGroupMode = !isIconMode && Boolean(
            targetElement.closest('.buttons, .btn-group, .actions, .magnet-actions, .download-buttons') ||
            (targetElement.classList && (targetElement.classList.contains('button') || targetElement.classList.contains('btn')))
        );

        const mode = isIconMode ? 'icon' : (isGroupMode ? 'group' : 'normal');
        button.dataset.mode = mode;

        // 针对 Bulma / Bootstrap 等常见 CSS 框架的按键群组继承原生类
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

        if (cachedItem) {
            if (cachedItem.phase === 'PHASE_TYPE_COMPLETE') {
                updateButtonState(button, 'COMPLETE', null, title);
            } else if (cachedItem.phase === 'PHASE_TYPE_ERROR') {
                updateButtonState(button, 'ERROR', null, title);
            } else {
                updateButtonState(button, 'COMPLETE', null, title);
            }
        } else {
            updateButtonState(button, 'INITIAL', null, title);
        }

        button.onmouseover = () => {
            if (button.dataset.state === 'COMPLETE') {
                button.style.backgroundColor = '#047857';
            } else if (button.dataset.state === 'DOWNLOADING') {
                button.style.backgroundColor = '#b45309';
            } else if (!button.disabled) {
                button.style.backgroundColor = '#0369a1';
            }
        };
        button.onmouseout = () => {
            if (button.dataset.state === 'COMPLETE') {
                button.style.backgroundColor = '#059669';
            } else if (button.dataset.state === 'DOWNLOADING') {
                button.style.backgroundColor = '#d97706';
            } else if (!button.disabled) {
                button.style.backgroundColor = '#0284c7';
            }
        };

        button.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (button.dataset.state === 'COMPLETE') {
                const confirmed = confirm(
                    `【已完成下载提示】\n\n该剧集此前已在群晖 NAS 完整下载！\n任务名：${title}\n\n如果您在群晖上已删除文件或需要重新下载，请点击【确定】重新推送。`
                );
                if (!confirmed) return;
            } else if (button.dataset.state === 'DOWNLOADING') {
                const confirmed = confirm(
                    `【正在下载提示】\n\n该任务目前正在群晖 NAS 下载队列中！\n任务名：${title}\n\n是否仍然强制重新提交一次？`
                );
                if (!confirmed) return;
            }

            button.disabled = true;
            const originalText = button.textContent;
            button.textContent = button.dataset.mode === 'icon' ? '⏳' : '⏳ 提交中...';
            button.style.backgroundColor = '#64748b';

            try {
                let targetMagnet = magnetLink;

                if (!targetMagnet && isExt && options.nativeBtn) {
                    button.textContent = button.dataset.mode === 'icon' ? '⏳' : '⏳ 获取磁链...';
                    targetMagnet = await fetchExtMagnetFromNative(options.nativeBtn, torrentId);
                    const resHash = extractInfoHash(targetMagnet);
                    if (resHash) button.dataset.hash = resHash;
                }

                if (!targetMagnet && torrentUrl) {
                    button.textContent = button.dataset.mode === 'icon' ? '⏳' : '⏳ 解析种子中...';
                    const res = await resolveTorrentToMagnet(torrentUrl, title);
                    targetMagnet = res.magnet;
                    const resHash = res.infoHash;
                    button.dataset.hash = resHash;
                    const map = GM_getValue('xl_torrent_hash_map', {});
                    map[torrentUrl] = resHash;
                    GM_setValue('xl_torrent_hash_map', map);
                }

                if (!targetMagnet) {
                    throw new Error('未能获取到有效的磁力下载链接');
                }

                button.textContent = button.dataset.mode === 'icon' ? '⏳' : '⏳ 推送中...';
                const res = await pushDownloadTask(targetMagnet, title);
                showToast(`已成功添加至群晖 [${res.name}]`, res.cleanName, 'success');
                updateButtonState(button, 'DOWNLOADING', null, res.cleanName);

                if (torrentId) {
                    const h = GM_getValue('xl_pushed_hashes', {});
                    h['ext_' + torrentId] = { phase: 'PHASE_TYPE_RUNNING', name: res.cleanName, time: Date.now() };
                    GM_setValue('xl_pushed_hashes', h);
                }
            } catch (err) {
                if (err.message === 'AUTH_REQUIRED') {
                    showConfigModal();
                } else {
                    showToast('推送失败', err.message || '未知错误', 'error');
                }
                button.textContent = originalText;
                updateButtonState(button, button.dataset.state || 'INITIAL', null, title);
            } finally {
                button.disabled = false;
            }
        });

        // 插入在目标按钮之后
        targetElement.insertAdjacentElement('afterend', button);
        targetElement.dataset.xunleiProcessed = 'true';
    }

    // -------------------------------------------------------------------------
    // 多维磁链深度提取引擎（支持全属性解构、隐藏域、全局变量、源码扫描与 Base64 解码）
    // -------------------------------------------------------------------------
    function extractBase64MagnetsFromText(text) {
        if (!text) return [];
        const results = [];
        // bWFnbmV0 是 "magnet" 的 Base64 编码特征前缀
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
        // 1. 常见所有可能存放磁力链接的直接属性
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
        // 2. dataset 扫描
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
        // 3. 关联目标（Clipboard.js / Bootstrap data-target 模式）
        const targetSel = el.getAttribute ? (el.getAttribute('data-clipboard-target') || el.getAttribute('data-target')) : '';
        if (targetSel) {
            try {
                const targetEl = document.querySelector(targetSel);
                if (targetEl) {
                    const targetVal = targetEl.value || targetEl.innerText || targetEl.textContent || '';
                    const m = targetVal.match(/magnet:\?[^\s"'<>]+/i);
                    if (m) return m[0];
                    const decoded = extractBase64MagnetsFromText(targetVal);
                    if (decoded.length > 0) return decoded[0];
                }
            } catch (e) {}
        }
        return '';
    }

    function findGlobalMagnetFromPage() {
        // 1. 检查全局作用域原生变量（如 SeedHub 的 panLink 等）
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

        // 2. 扫描整页 input/textarea 隐藏表单
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

        // 3. 整页 HTML 源代码与 script 块明文正则直扫
        try {
            const fullHtml = document.documentElement ? document.documentElement.innerHTML : '';
            if (fullHtml && fullHtml.includes('magnet:?xt=urn:btih:')) {
                const m = fullHtml.match(/magnet:\?xt=urn:btih:[a-zA-Z0-9]+[^\s"'<>\\`]+/i);
                if (m) return m[0];
            }
        } catch (e) {}

        // 4. 整页内联 script 块及源码中的 Base64 混淆特征扫描（如 SeedHub 的 const data = "bWFnbmV0..."）
        try {
            const scripts = document.querySelectorAll('script:not([src])');
            for (const sc of scripts) {
                const code = sc.textContent || '';
                const decodedList = extractBase64MagnetsFromText(code);
                if (decodedList.length > 0) return decodedList[0];
            }
            const fullHtml = document.documentElement ? document.documentElement.innerHTML : '';
            const decodedList = extractBase64MagnetsFromText(fullHtml);
            if (decodedList.length > 0) return decodedList[0];
        } catch (e) {}

        return '';
    }

    // 通用语义化查找：精准定位页面中充当“复制磁力/下载磁力”的交互按钮或叶子元素（支持 button, a, div, span 等任何标签）
    function findCopyMagnetButtons() {
        const results = [];
        const candidates = document.querySelectorAll('button, a, div, span, p, input, [role="button"], [class*="btn"], [class*="copy"], [id*="copy"], [class*="magnet"], [id*="magnet"], [id="thunder"]');
        for (const el of candidates) {
            if (el.classList && el.classList.contains('xunlei-download-btn')) continue;
            if (el.dataset.xunleiProcessed) continue;

            const text = (el.innerText || el.textContent || el.value || '').trim();
            if (!text || text.length > 25) continue;

            if (/复制磁力|下载磁力|磁力下载|复制magnet|拷贝磁力|磁力链接|获取磁力|迅雷高速下载/i.test(text)) {
                // 确保选取最底层的叶子按钮元素，避免挂载于外层大容器上
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

    function detectMagnetLinks() {
        // 全面兼容全网磁力链接形式（带 href、纯 data 属性、隐藏域或按钮）
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
            // 严格过滤：若该元素是一个包裹性超链接（包含 div, p, .tags, .meta, .name 等复杂排版块），坚决不挂载于其后！
            if (el.tagName === 'A' && el.querySelector('div, p, table, ul, ol, section, .tags, .meta, .name, .tag')) {
                return;
            }

            const mag = extractMagnetFromElement(el);
            if (!mag || (!mag.startsWith('magnet:') && !mag.includes('magnet:?xt='))) return;

            const infoHash = extractInfoHash(mag);
            if (!infoHash) return;

            const container = findItemContainer(el);

            // 若该容器条目内已经成功挂载过该哈希的按钮，坚决不再重复挂载
            if (container.querySelector(`.xunlei-download-btn[data-hash="${infoHash}"]`)) {
                return;
            }

            if (!container.dataset.xlId) {
                container.dataset.xlId = 'xl_' + Math.random().toString(36).slice(2, 9);
            }
            const groupKey = `${infoHash}_${container.dataset.xlId}`;

            const score = getElementScore(el);
            if (!candidateMap.has(groupKey) || candidateMap.get(groupKey).score < score) {
                candidateMap.set(groupKey, { el, mag, score, container, infoHash });
            }
        });

        // ---------------------------------------------------------------------
        // 语义化增强扫描：针对类似 SeedHub 等无直接 href 属性的“复制磁力”按钮
        // ---------------------------------------------------------------------
        const semanticButtons = findCopyMagnetButtons();
        if (semanticButtons.length > 0) {
            // 预先提取页面全局可能存在的磁链
            const globalMag = findGlobalMagnetFromPage();

            semanticButtons.forEach(btn => {
                if (btn.dataset.xunleiProcessed || btn.classList.contains('xunlei-download-btn')) return;

                // 1. 先从自身所有属性提取
                let mag = extractMagnetFromElement(btn);

                // 2. 若自身无属性，向其父级容器搜寻隐藏的 input、textarea、code、pre 等
                if (!mag) {
                    const container = findItemContainer(btn);
                    if (container) {
                        const candidates = container.querySelectorAll('input, textarea, code, pre, [data-link], [data-url], [data-magnet]');
                        for (const item of candidates) {
                            const val = item.value || extractMagnetFromElement(item) || item.innerText || item.textContent || '';
                            const m = val.match(/magnet:\?[^\s"'<>]+/i);
                            if (m) {
                                mag = m[0];
                                break;
                            }
                        }
                    }
                }

                // 3. 使用整页全局提取的磁链
                if (!mag && globalMag) {
                    mag = globalMag;
                }

                if (mag) {
                    const infoHash = extractInfoHash(mag);
                    if (!infoHash) return;
                    const container = findItemContainer(btn);
                    if (container.querySelector(`.xunlei-download-btn[data-hash="${infoHash}"]`)) return;

                    if (!container.dataset.xlId) {
                        container.dataset.xlId = 'xl_' + Math.random().toString(36).slice(2, 9);
                    }
                    const groupKey = `${infoHash}_${container.dataset.xlId}`;
                    // 赋予这类明确的按钮最高优先级评分，确保精准挂载于其右侧
                    const score = 280;
                    if (!candidateMap.has(groupKey) || candidateMap.get(groupKey).score < score) {
                        candidateMap.set(groupKey, { el: btn, mag, score, container, infoHash });
                    }
                }
            });
        }

        candidateMap.forEach(({ el, mag, container, infoHash }) => {
            if (!container.querySelector(`.xunlei-download-btn[data-hash="${infoHash}"]`)) {
                foundAny = true;
                addDownloadButton(el, mag);
            }
        });

        // 纯文本节点磁链扫描（仅对未包裹超链接的纯文本磁链生效）
        const magnetRegex = /magnet:\?[^\s<>"']+/gi;
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    if (node.parentElement && (node.parentElement.dataset.xunleiProcessed || 
                        node.parentElement.classList.contains('xunlei-download-btn') ||
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
            if (magnetRegex.test(node.textContent)) {
                textNodes.push(node);
            }
        }

        textNodes.forEach(textNode => {
            const matches = textNode.textContent.match(magnetRegex);
            if (matches && textNode.parentElement && !textNode.parentElement.dataset.xunleiProcessed) {
                matches.forEach(magnetLink => {
                    const infoHash = extractInfoHash(magnetLink);
                    const container = findItemContainer(textNode.parentElement);
                    if (container && container.querySelector(`.xunlei-download-btn[data-hash="${infoHash}"]`)) {
                        return;
                    }
                    foundAny = true;
                    const span = document.createElement('span');
                    span.style.cssText = 'display: inline-block; margin: 0 4px;';
                    textNode.parentElement.insertBefore(span, textNode.nextSibling);
                    addDownloadButton(span, magnetLink);
                });
                textNode.parentElement.dataset.xunleiProcessed = 'true';
            }
        });

        // ---------------------------------------------------------------------
        // 动态防盗链网站按钮探测 (如 ext.to 的 .search-magnet-btn)
        // ---------------------------------------------------------------------
        const dynamicButtons = Array.from(document.querySelectorAll('.search-magnet-btn, a[data-id][title*="Download magnet link"], a[data-id][title*="magnet" i]'));
        dynamicButtons.forEach(btn => {
            if (btn.dataset.xunleiProcessed) return;
            const torrentId = btn.getAttribute('data-id') || '';
            const container = findItemContainer(btn);
            if (torrentId && container.querySelector(`.xunlei-download-btn[data-ext-id="${torrentId}"]`)) return;

            addDownloadButton(btn, '', '', { isExt: true, nativeBtn: btn, torrentId });
            foundAny = true;
        });

        // ---------------------------------------------------------------------
        // 种子文件与论坛附件扫描（全面兼容 1lou、NexusPHP、Discuz 等各站点 .torrent）
        // ---------------------------------------------------------------------
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
        // 补充扫描：链接文本以 .torrent 结尾的超链接
        document.querySelectorAll('a').forEach(a => {
            if (!torrentLinks.includes(a)) {
                const text = (a.innerText || a.textContent || '').trim();
                if (/\.torrent$/i.test(text)) {
                    torrentLinks.push(a);
                }
            }
        });

        const activeTorrentHashMap = GM_getValue('xl_torrent_hash_map', {});

        torrentLinks.forEach(el => {
            if (el.dataset.xunleiProcessed) return;

            // 过滤：包裹性超链接
            if (el.querySelector('div, p, table, ul, ol, section')) return;

            const href = el.getAttribute('href') || el.href || '';
            if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
            if (href.startsWith('magnet:') || href.includes('magnet:?xt=')) return;

            let fullUrl = href;
            try {
                fullUrl = new URL(href, window.location.href).href;
            } catch(e) {}

            const container = findItemContainer(el);
            const knownHash = activeTorrentHashMap[fullUrl];
            if (knownHash && container.querySelector(`.xunlei-download-btn[data-hash="${knownHash}"]`)) {
                return;
            }
            if (container.querySelector(`.xunlei-download-btn[data-torrent-url="${fullUrl}"]`)) {
                return;
            }

            addDownloadButton(el, '', fullUrl);
            foundAny = true;
        });

        return foundAny;
    }

    // -------------------------------------------------------------------------
    // 动态剪贴板与原生 API 劫持兜底：当页面纯靠 JS 点击复制时，0毫秒捕获挂载
    // -------------------------------------------------------------------------
    let lastClickedTarget = null;
    document.addEventListener('click', (e) => {
        const target = e.target;
        if (target && target.nodeType === Node.ELEMENT_NODE) {
            lastClickedTarget = target.closest('button, a, div, span, [role="button"], input') || target;
        }
    }, true);

    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            const originalWriteText = navigator.clipboard.writeText;
            navigator.clipboard.writeText = function (text) {
                try {
                    if (typeof text === 'string' && (text.includes('magnet:?') || text.startsWith('magnet:'))) {
                        const m = text.match(/magnet:\?[^\s"'<>]+/i);
                        if (m) {
                            const mag = m[0];
                            const targetBtn = lastClickedTarget || document.querySelector('button, a, span, div');
                            if (targetBtn && !targetBtn.dataset.xunleiProcessed) {
                                setTimeout(() => {
                                    const infoHash = extractInfoHash(mag);
                                    const container = findItemContainer(targetBtn);
                                    if (!container.querySelector(`.xunlei-download-btn[data-hash="${infoHash}"]`)) {
                                        addDownloadButton(targetBtn, mag);
                                    }
                                }, 50);
                            }
                        }
                    }
                } catch (err) {}
                return originalWriteText.apply(this, arguments);
            };
        }
    } catch (e) {}

    document.addEventListener('copy', (e) => {
        try {
            setTimeout(() => {
                const target = lastClickedTarget || e.target;
                if (!target) return;
                const btn = target.closest ? target.closest('button, a, div, span, .btn, .button') : null;
                if (btn && !btn.dataset.xunleiProcessed) {
                    detectMagnetLinks();
                }
            }, 100);
        } catch (err) {}
    }, true);

    // 初始化检测与定时扫描
    setInterval(detectMagnetLinks, 1500);
    const hasMagnets = detectMagnetLinks();

    // 仅当页面中实际检测到磁链时，才向群晖同步任务状态以节省流量与算力
    if (hasMagnets) {
        setTimeout(syncNasTasks, 1500);
    }
})();