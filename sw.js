// 第三方缓存版（2026-10-28c）：纯缓存优先——命中零网络秒回，杜绝每次加载的后台抓取风暴。
// 机制：预缓存全站 + 纯缓存优先；更新靠发版时 bump CACHE 版本号，无强制重载、无弹窗、无后台抓取。
// 发版说明：改任何 js/静态文件后，请把下面 CACHE 版本号改一下，SW 会自动换新缓存。
const CACHE = 'mochi-royce-20261028m';
const PRECACHE = [
'./',
'./index.html',
'./manifest.json',
'./icon-192.png',
'./icon-512.png',
'./icon-180.png',
'./icon-maskable-512.png',
'./notice.json',
'./js/device.js',
'./js/idb.js',
'./js/contacts.js',
'./js/applock.js',
'./js/card-lock.js',
'./js/dcp-master.js',
'./js/media-pool.js',
'./js/storage-slim.js',
'./js/perf-check.js',
'./js/energy-check.js',
'./js/flash-check.js',
'./js/img-compress.js',
'./js/img-ingest.js',
'./js/clock.js',
'./js/tabs.js',
'./js/desktop-slider.js',
'./js/quote-cards.js',
'./js/personalize.js',
'./js/chat.js',
'./js/group-chat.js',
'./js/chatcard.js',
'./js/chat-settings.js',
'./js/reply-settings.js',
'./js/fav-settings.js',
'./js/default-cards-data.js',
'./js/dict-ext-data.js',
'./js/default-cards.js',
'./js/quote-spell.js',
'./js/dream-free.js',
'./js/mood-followup-data.js',
'./js/mood-reply-cards.js',
'./js/ta-mood-data.js',
'./js/ta-mood.js',
'./js/fav-reason-data.js',
'./js/fav-reason.js',
'./js/music-player.js',
'./js/calendar.js',
'./js/divination.js',
'./js/avatar-lib.js',
'./js/ta-ask.js',
'./js/ck-question.js',
'./js/incoming-requests.js',
'./js/ta-invite.js',
'./js/bg-keep.js',
'./js/records.js',
'./js/call.js',
'./js/mail.js',
'./js/feed.js',
'./js/loc-lib.js',
'./js/p2-features.js',
'./js/gift-shop.js',
'./js/memo-app.js',
'./js/memo-arc.js',
'./js/my-arc.js',
'./js/period.js',
'./js/accounting.js',
'./js/garden.js',
'./js/room.js',
'./js/drift-bottle.js',
'./js/decision.js',
'./js/group-decision.js',
'./js/pong.js',
'./js/snake-game.js',
'./js/breakout.js',
'./js/connect-four.js',
'./js/coop-mine.js',
'./js/fishing.js',
'./js/memory-game.js',
'./js/gomoku.js',
'./js/linkup.js',
'./js/match3.js',
'./js/auction.js',
'./js/arcade.js',
'./js/mood-diary.js',
'./js/sfx.js',
'./js/fullscreen.js',
'./js/data-backup.js',
'./js/feature-data.js',
'./js/pwa.js',
'./js/cjian.js',
'./js/feature-hub.js',
'./js/settings-help.js',
'./js/onboarding.js',
'./js/page-coach.js',
'./js/card-audit.js',
'./js/storage-guide.js',
'./js/mobile-adapt.js',
];

self.addEventListener('install', function (event) {
  event.waitUntil((async function () {
    try {
      var c = await caches.open(CACHE);
      await Promise.all(PRECACHE.map(function (u) {
        return c.add(u).catch(function () {}); // 单文件失败不阻断其余
      }));
    } catch (e) {}
    try { await self.skipWaiting(); } catch (e) {}
  })());
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    try {
      var ks = await caches.keys();
      await Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k).catch(function () {}); }));
    } catch (e) {}
    try { await self.clients.claim(); } catch (e) {}
  })());
});

self.addEventListener('fetch', function (event) {
  // 纯缓存优先：命中立即返回，不发起后台网络抓取（避免每次加载全站后台重下，
  // 抢占进入页面的网络/CPU 造成卡顿）。未命中才走网络并写入缓存。
  try {
    if (event.request.method !== 'GET') return;
    var url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return; // 只管本站请求
    event.respondWith((async function () {
      var c = await caches.open(CACHE);
      var hit = await c.match(event.request);
      if (hit) return hit; // 秒回缓存：零网络、零重绘竞争
      var r = await fetch(event.request);
      if (r && r.status === 200) c.put(event.request, r.clone()).catch(function () {});
      if (r) return r;
      if (event.request.mode === 'navigate') {
        var idx = await c.match('./index.html');
        if (idx) return idx; // 离线兜底
      }
      return new Response('offline-no-cache', { status: 504 });
    })());
  } catch (e) {}
});
