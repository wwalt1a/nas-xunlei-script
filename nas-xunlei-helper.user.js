// ==UserScript==
// @name         迅雷下载助手脚本版
// @namespace    https://github.com/saaak/xunlei-docker-ext
// @version      1.3.1
// @description  基于 saaak/xunlei-docker-ext 扩展移植重构，专为迅雷 NAS (群晖 DSM / Docker / 威联通 QNAP) 与 Firefox / Chrome 深度适配。一键抓取全网磁力链接推送到远程 NAS，支持双向下载状态实时同步与目录平铺直存。
// @author       Community
// @license      MIT
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @connect      xluser-ssl.xunlei.com
// @connect      api-pan.xunlei.com
// ==/UserScript==

(function () {
    'use strict';

    const CLIENT_ID = 'Xp6vsxz_7IYVw2BB';
    const CLIENT_VERSION = '8.31.0.9726';
    const PACKAGE_NAME = 'com.xunlei.downloadprovider';
    const REDIRECT_URI = 'xlaccsdk01://xunlei.com/callback?state=harbor';

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

    /**
     * 全网智能标题推导引擎（兼容 1337x / Nyaa / Sukebei / 蜜柑及任意站点）
     */
    function extractSmartTitle(targetElement, magnetLink) {
        // 1. 优先从磁链自带的 dn 参数提取（最权威真实文件名，1337x 和 Nyaa 均完整包含）
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

        // 2. 表格行内查找（Nyaa、Sukebei、蜜柑、DMHY）
        const row = targetElement.closest('tr, li, .torrent-item, .item');
        if (row) {
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

        // 3. 详情页全局标题查找（1337x 详情页 h1、Nyaa 详情页 h3）
        const h1337x = document.querySelector('.box-info-heading h1, .torrent-detail-page h1');
        if (h1337x && h1337x.innerText.trim()) return h1337x.innerText.trim();

        const nyaaHead = document.querySelector('.panel-heading .panel-title, h3.panel-title');
        if (nyaaHead && nyaaHead.innerText.trim()) return nyaaHead.innerText.trim();

        // 4. 目标元素自身或 title 属性
        if (targetElement.title && targetElement.title.length > 5) return targetElement.title.trim();

        const text = targetElement.innerText ? targetElement.innerText.trim() : '';
        if (text && text.length > 4 && !/magnet|download|下载|磁链/i.test(text)) {
            return text;
        }

        // 5. 网页标题兜底
        return document.title.replace(/ - (1337x|Nyaa|Sukebei|蜜柑计划).*$/i, '').trim() || '迅雷远程下载';
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
    function updateButtonState(btn, state, progress) {
        btn.dataset.state = state;
        if (state === 'COMPLETE') {
            btn.dataset.pushed = 'true';
            btn.textContent = '✔ 已完成';
            btn.style.backgroundColor = '#059669'; // 翡翠绿
            btn.style.borderColor = '#047857';
            btn.style.color = '#ffffff';
            btn.title = '群晖 NAS 已完整下载入库！点击可选择重新推送下载';
        } else if (state === 'DOWNLOADING') {
            btn.dataset.pushed = 'true';
            const progressText = (progress !== undefined && progress !== null && progress > 0) ? ` ${progress}%` : '';
            btn.textContent = `⏳ 正在下载${progressText}`;
            btn.style.backgroundColor = '#d97706'; // 暖橙色
            btn.style.borderColor = '#b45309';
            btn.style.color = '#ffffff';
            btn.title = '任务正在群晖 NAS 下载中...';
        } else if (state === 'ERROR') {
            btn.dataset.pushed = 'false';
            btn.textContent = '❌ 下载异常';
            btn.style.backgroundColor = '#dc2626';
            btn.style.borderColor = '#b91c1c';
            btn.style.color = '#ffffff';
            btn.title = '群晖端下载遇到异常，点击可重试';
        } else { // INITIAL
            btn.dataset.pushed = 'false';
            btn.textContent = '⚡ 迅雷直推';
            btn.style.backgroundColor = '#0284c7';
            btn.style.borderColor = '#0369a1';
            btn.style.color = '#ffffff';
            btn.title = '一键推送到迅雷 NAS';
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
                        updateButtonState(btn, 'COMPLETE');
                    } else if (info.phase === 'PHASE_TYPE_RUNNING' || info.phase === 'PHASE_TYPE_PENDING') {
                        updateButtonState(btn, 'DOWNLOADING', info.progress);
                    } else if (info.phase === 'PHASE_TYPE_ERROR') {
                        updateButtonState(btn, 'ERROR');
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

    GM_registerMenuCommand('⚙️ 迅雷 NAS 设置与教程', showConfigModal);
    GM_registerMenuCommand('🔄 强制刷新群晖下载状态', () => {
        showToast('正在同步', '正在向群晖请求最新的任务完成状态...', 'info');
        syncNasTasks();
    });

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

    function addDownloadButton(targetElement, magnetLink) {
        if (targetElement.dataset.xunleiProcessed) return;

        const title = extractSmartTitle(targetElement, magnetLink);
        const infoHash = extractInfoHash(magnetLink);
        const history = GM_getValue('xl_pushed_hashes', {});
        const cachedItem = infoHash ? history[infoHash] : null;

        const button = document.createElement('button');
        button.className = 'xunlei-download-btn';
        button.dataset.hash = infoHash;

        // 针对 Bulma / Bootstrap 等常见 CSS 框架的按键群组优化
        if (targetElement.classList && targetElement.classList.contains('button')) {
            button.classList.add('button', 'is-small');
        } else if (targetElement.classList && targetElement.classList.contains('btn')) {
            button.classList.add('btn', 'btn-sm');
        }

        button.style.cssText = `
            margin: 0 4px; padding: 2px 8px; border-radius: 4px;
            font-size: 11px; font-weight: 600; cursor: pointer;
            height: 24px; min-height: 24px; line-height: 22px;
            display: inline-flex; align-items: center; justify-content: center;
            vertical-align: middle; flex-shrink: 0; box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            white-space: nowrap; transition: all 0.2s ease;
            box-shadow: 0 1px 2px rgba(0,0,0,0.08); border: 1px solid #0369a1;
            background-color: #0284c7; color: #ffffff; text-decoration: none;
        `;

        if (cachedItem) {
            if (cachedItem.phase === 'PHASE_TYPE_COMPLETE') {
                updateButtonState(button, 'COMPLETE');
            } else if (cachedItem.phase === 'PHASE_TYPE_ERROR') {
                updateButtonState(button, 'ERROR');
            } else {
                updateButtonState(button, 'COMPLETE');
            }
        } else {
            updateButtonState(button, 'INITIAL');
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
            button.textContent = '⏳ 提交中...';
            button.style.backgroundColor = '#64748b';

            try {
                const res = await pushDownloadTask(magnetLink, title);
                showToast(`已成功添加至群晖 [${res.name}]`, res.cleanName, 'success');
                updateButtonState(button, 'DOWNLOADING');
            } catch (err) {
                if (err.message === 'AUTH_REQUIRED') {
                    showConfigModal();
                } else {
                    showToast('推送失败', err.message || '未知错误', 'error');
                }
                button.textContent = originalText;
                updateButtonState(button, button.dataset.state || 'INITIAL');
            } finally {
                button.disabled = false;
            }
        });

        // 插入在目标按钮之后
        targetElement.insertAdjacentElement('afterend', button);
        targetElement.dataset.xunleiProcessed = 'true';
    }

    function detectMagnetLinks() {
        // 全面兼容各主流站点的磁力链接与图片/图标包装
        const selector = 'a[href^="magnet:"], a[href*="magnet:?"], a[data-clipboard-text^="magnet:"], a[data-clipboard-text*="magnet:?"], button[data-clipboard-text^="magnet:"], a.js-magnet, a.magnet-link, [data-magnet]';
        const directElements = Array.from(document.querySelectorAll(selector));

        let foundAny = false;
        const candidateMap = new Map();

        directElements.forEach(el => {
            let mag = el.getAttribute('data-clipboard-text') || el.getAttribute('data-magnet') || el.href || '';
            if (!mag.includes('magnet:?') && el.dataset.clipboardText) {
                mag = el.dataset.clipboardText;
            }

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

        return foundAny;
    }

    // 初始化检测与定时扫描
    setInterval(detectMagnetLinks, 1500);
    const hasMagnets = detectMagnetLinks();

    // 仅当页面中实际检测到磁链时，才向群晖同步任务状态以节省流量与算力
    if (hasMagnets) {
        setTimeout(syncNasTasks, 1500);
    }
})();