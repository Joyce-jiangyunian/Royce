// === Royce 离线缓存 v2（2026-10-29 第三方加固版）===
// 目标：手机长稳。三条铁律：
//   ① HTML 残缺体绝不进缓存（写前校验 __MOCHI_EOF__），杜绝"缓存了截断页→永久白屏/卡加载"；
//   ② 导航：有缓存先秒回（零等待），后台静默校验更新；带 ?_heal= 强制走网络（截断自愈通道）；
//   ③ 静态资源：缓存优先 + 后台更新（SWR），进站时不再发起几十个文件的后台抓取风暴。
// 更新：改本文件 VERSION 即触发热替（skipWaiting+claim）。
var VERSION = 'mochi-royce-cache-v2-20261029a';

// 首次安装只预热最小外壳，其余运行时按需进缓存——安装快、弱网不易失败。
var SHELL = [
  './', './index.html', './manifest.json', './notice.json',
  './icon-180.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  './js/idb.js', './js/clock.js', './js/tabs.js', './js/contacts.js',
  './js/applock.js', './js/card-lock.js', './js/dcp-master.js',
  './js/storage-slim.js', './js/perf-check.js', './js/personalize.js',
  './js/chat.js', './js/chatcard.js', './js/mobile-adapt.js'
];

var MAX_ENTRIES = 260; // 运行时缓存条目上限，超额淘汰最旧

function openCache() { return caches.open(VERSION); }

function isNav(req, url) {
  try {
    if (req.mode === 'navigate') return true;
    var p = url.pathname;
    return p === '/' || p === '/Royce/' || p === '/Royce/index.html' || /(^|\/)index\.html$/.test(p);
  } catch (e) { return false; }
}

self.addEventListener('install', function (event) {
  event.waitUntil((async function () {
    try {
      var c = await openCache();
      // 外壳预热：HTML（./ 与 ./index.html）必须过了 EOF 校验才入库，
      // 残缺体绝不进缓存；静态文件单点失败不阻断安装。
      var jobs = SHELL.map(function (u) {
        if (u === './' || u === './index.html') {
          return fetchWithTimeout(new Request(u, { cache: 'reload' }), 15000).then(function (r) {
            if (!r || r.status !== 200) return;
            return r.text().then(function (t) {
              if (t.indexOf('__MOCHI_EOF__') < 0) return;
              return c.put(u, new Response(t, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })).catch(function () {});
            });
          }).catch(function () {});
        }
        return c.add(u).catch(function () {});
      });
      await Promise.all(jobs);
      await trimCache(c);
    } catch (e) {}
    try { await self.skipWaiting(); } catch (e2) {}
  })());
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    try {
      var ks = await caches.keys();
      await Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) {
        return caches.delete(k).catch(function () {});
      }));
    } catch (e) {}
    try { await self.clients.claim(); } catch (e2) {}
  })());
});

function fetchWithTimeout(req, ms) {
  return new Promise(function (resolve) {
    var done = false;
    function fin(v) { if (!done) { done = true; clearTimeout(t); resolve(v); } }
    var t = setTimeout(function () { fin(null); }, ms);
    try { fetch(req).then(function (r) { fin(r); }, function () { fin(null); }); }
    catch (e) { fin(null); }
  });
}

async function storeNav(c, r) {
  // 完整性校验 + 双键入库（./ 与 ./index.html）
  try {
    var t = await r.clone().text();
    if (t.indexOf('__MOCHI_EOF__') < 0) return false;
    await safePut(c, './index.html', r.clone());
    await safePut(c, './', r.clone());
    return true;
  } catch (e) { return false; }
}

function bgRefreshNav(req) {
  // 后台静默校验更新：只写完整体，绝不打扰当前页
  fetchWithTimeout(req.clone ? req.clone() : req, 6000).then(function (r) {
    if (!r || r.status !== 200) return;
    openCache().then(function (cc) { storeNav(cc, r).then(function () { trimCache(cc); }); }).catch(function () {});
  });
}

async function safePut(c, req, r) {
  try { await c.put(req, r); }
  catch (e) {
    try { // 多半是配额：淘汰约 1/3 最旧条目后重试一次
      var ks = await c.keys();
      var cut = ks.slice(0, Math.ceil(ks.length / 3) + 8);
      for (var i = 0; i < cut.length; i++) { try { await c.delete(cut[i]); } catch (e2) {} }
      await c.put(req, r.clone ? r.clone() : r);
    } catch (e3) {}
  }
}

async function trimCache(c) {
  try {
    var ks = await c.keys();
    if (ks.length <= MAX_ENTRIES) return;
    var cut = ks.slice(0, ks.length - MAX_ENTRIES);
    for (var i = 0; i < cut.length; i++) { try { await c.delete(cut[i]); } catch (e) {} }
  } catch (e2) {}
}

self.addEventListener('fetch', function (event) {
  try {
    var req = event.request;
    if (req.method !== 'GET') return;
    var url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    var heal = /[?&]_heal=/.test(url.search); // 截断自愈：强制过网络、忽略缓存
    var nav = isNav(req, url);
    if (!nav && url.search) { /* 静态资源带查询串：缓存键含串，按原样处理 */ }

    event.respondWith((async function () {
      var c = await openCache();
      var cached;
      if (heal) cached = null;
      else if (nav) cached = await (c.match(req) || c.match('./index.html') || c.match('./'));
      else cached = await c.match(req);

      if (cached) {
        // 缓存秒回（零网络、零等待），后台静默更新；下次生效
        if (nav) bgRefreshNav(req);
        else fetchWithTimeout(req.clone ? req.clone() : req, 8000).then(function (r2) {
          if (!r2 || r2.status !== 200) return;
          openCache().then(function (cc) { safePut(cc, req, r2); trimCache(cc); }).catch(function () {});
        });
        return cached;
      }

      // 无缓存（首次访问 / 自愈 / 逐出后）：走网络
      var net = await fetchWithTimeout(req.clone ? req.clone() : req, nav ? 5000 : 12000);
      if (net && net.status === 200) {
        if (nav) { try { await storeNav(c, net.clone()); } catch (e3) {} }
        else { try { await safePut(c, req, net.clone()); } catch (e4) {} }
        return net;
      }
      if (net) return net;
      if (nav) {
        // 网络不可用又无缓存：兜底页，自动带 ?_heal 重试
        return new Response('<meta name="viewport" content="width=device-width,initial-scale=1"><p style="padding:2em;font-family:sans-serif;font-size:15px">网络暂时不可用，正在自动重试…</p><script>setTimeout(function(){try{location.replace(location.pathname+(location.search?location.search+"&":"?")+"_heal="+Date.now())}catch(e){}},1500)</' + 'script>', { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
      return new Response('offline', { status: 504 });
    })());
  } catch (e) {}
});

// 页面协议（保持与旧版兼容）：PURGE_INDEX→PURGE_DONE、PRECACHE_NOW、SKIP_WAITING
self.addEventListener('message', function (event) {
  var d = event.data || {};
  if (d.type === 'SKIP_WAITING') { self.skipWaiting(); return; }
  if (d.type === 'PURGE_INDEX') {
    event.waitUntil((async function () {
      try {
        var c = await openCache();
        await c.delete('./index.html');
        await c.delete('./');
      } catch (e) {}
      try { if (event.source) event.source.postMessage({ type: 'PURGE_DONE' }); } catch (e2) {}
    })());
    return;
  }
  if (d.type === 'PRECACHE_NOW' && d.urls) {
    event.waitUntil((async function () {
      try {
        var c = await openCache();
        await Promise.all((d.urls || []).map(function (u) { return c.add(u).catch(function () {}); }));
        await trimCache(c);
      } catch (e) {}
    })());
    return;
  }
});
