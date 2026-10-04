/* 通信がなくてもアプリを開けるようにするための仕組み。
   アプリを更新したら VERSION を 1 つ上げる(古い控えが片付く) */
var VERSION = "v1";
var CACHE = "fitness-log-" + VERSION;
var CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];
/* ジムなど電波の弱い場所で待たされないよう、この時間で控えに切り替える */
var NET_WAIT_MS = 3000;

self.addEventListener("install", function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(CORE); }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k.indexOf("fitness-log-") === 0 && k !== CACHE; })
      .map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

/* アプリ本体:まず最新を取りに行き、取れなければ(または遅ければ)控えを使う */
function networkFirst(req){
  return caches.open(CACHE).then(function(cache){
    return new Promise(function(resolve){
      var settled = false;
      var finish = function(res){ if(!settled && res){ settled = true; resolve(res); } };
      var fromCache = function(){
        return cache.match(req, {ignoreSearch:true}).then(function(r){
          return r || (req.mode === "navigate" ? cache.match("./index.html") : null);
        });
      };
      var timer = setTimeout(function(){ fromCache().then(finish); }, NET_WAIT_MS);
      fetch(req).then(function(res){
        clearTimeout(timer);
        if(res && res.ok) cache.put(req, res.clone());
        finish(res);
      }).catch(function(){
        clearTimeout(timer);
        fromCache().then(function(r){ finish(r || Response.error()); });
      });
    });
  });
}

/* 文字(Google Fonts):一度取れたら控えを使い続ける */
function cacheFirst(req){
  return caches.open(CACHE).then(function(cache){
    return cache.match(req).then(function(hit){
      return hit || fetch(req).then(function(res){
        if(res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
        return res;
      });
    });
  });
}

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;
  var url = new URL(req.url);
  if(url.origin === self.location.origin){ e.respondWith(networkFirst(req)); return; }
  if(url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com"){ e.respondWith(cacheFirst(req)); }
});
