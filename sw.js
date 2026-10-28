// 第三方缓存版（2026-10-28）：规范离线缓存——首次下载后秒开，更新随发版自动接管。
// 机制：预缓存全站 → 后台 stale-while-revalidate 静默更新；无强制重载、无更新弹窗，从根上杜绝旧版拉回。
// 发版说明：改任何 js/静态文件后，请把下面 CACHE 版本号改一下，SW 会自动换新缓存。
const CACHE = 'mochi-royce-20261028b';
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
  try {
    if (event.request.method !== 'GET') return;
    var url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return; // 只管本站请求
    event.respondWith((async function () {
      var c = await caches.open(CACHE);
      var hit = await c.match(event.request);
      // 后台一律拉网络更新缓存（SWR）：既秒开，又自动拿到新版；无缓存时等网络
      var net = fetch(event.request).then(function (r) {
        if (r && r.status === 200) { c.put(event.request, r.clone()).catch(function () {}); }
        return r;
      }).catch(function () { return null; });
      if (hit) { return hit; }
      var r = await net;
      if (r) return r;
      if (event.request.mode === 'navigate') {
        var idx = await c.match('./index.html');
        if (idx) return idx; // 离线兜底
      }
      return new Response('offline-no-cache', { status: 504 });
    })());
  } catch (e) {}
});
