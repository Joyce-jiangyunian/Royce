// 第三方优化版（2026-10-28）：不再做任何离线缓存/更新拦截。
// 作用：安装后立即清空本站所有旧缓存并注销自己，让手机从此每次都拿最新页面，
// 根治「旧缓存一直显示部分未刷新 / 更新弹窗」等问题。离线功能随之停用（不影响正常在线使用）。
self.addEventListener('install', function (e) { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    try {
      var ks = await caches.keys();
      for (var i = 0; i < ks.length; i++) { try { await caches.delete(ks[i]); } catch (er) {} }
    } catch (er2) {}
    try { await self.clients.claim(); } catch (er3) {}
    try { await self.registration.unregister(); } catch (er4) {}
  })());
});
// 不注册 fetch 处理器：所有请求直接走网络。
