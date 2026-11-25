/* Kesug Slots V30.2 mobile reel stability release. */
const CACHE_VERSION='kesug-slots-v30-2';
const SHELL_CACHE=`${CACHE_VERSION}-shell`;
const RUNTIME_CACHE=`${CACHE_VERSION}-runtime`;
const PRECACHE_URLS=[
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./assets/machines/5lions.webp",
  "./assets/machines/bandit.webp",
  "./assets/machines/bigbass.webp",
  "./assets/machines/bookofra.webp",
  "./assets/machines/chaoscrew.webp",
  "./assets/machines/classic.webp",
  "./assets/machines/cyber.webp",
  "./assets/machines/deadordealive.webp",
  "./assets/machines/divinefortune.webp",
  "./assets/machines/doghouse.webp",
  "./assets/machines/doghouse2.webp",
  "./assets/machines/dragon.webp",
  "./assets/machines/firestrike.webp",
  "./assets/machines/gatesofolympus.webp",
  "./assets/machines/gonzo.webp",
  "./assets/machines/greatrhino.webp",
  "./assets/machines/jackbeanstalk.webp",
  "./assets/machines/jars.webp",
  "./assets/machines/jungle.webp",
  "./assets/machines/madamedestiny.webp",
  "./assets/machines/moneytrain.webp",
  "./assets/machines/moneytrain3.webp",
  "./assets/machines/moonprincess.webp",
  "./assets/machines/ocean.webp",
  "./assets/machines/pets.webp",
  "./assets/machines/razortooth.webp",
  "./assets/machines/reactoonz.webp",
  "./assets/machines/riseofolympus.webp",
  "./assets/machines/sanquentin.webp",
  "./assets/machines/snakearena.webp",
  "./assets/machines/starburst.webp",
  "./assets/machines/stars.webp",
  "./assets/machines/templetumble.webp",
  "./assets/machines/tombstone.webp",
  "./assets/machines/twinspin.webp",
  "./assets/machines/wildmachine.webp",
  "./assets/machines/wildswarm.webp",
  "./assets/machines/winter.webp",
  "./assets/machines/wolfgold.webp"
];
self.addEventListener('install',event=>{event.waitUntil((async()=>{const c=await caches.open(SHELL_CACHE);await c.addAll(PRECACHE_URLS);await self.skipWaiting();})());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('kesug-slots-')&&!k.startsWith(CACHE_VERSION)).map(k=>caches.delete(k)));await self.clients.claim();})());});
self.addEventListener('message',event=>{const data=event.data;if(!data||data.type!=='KESUG_PREPARE_OFFLINE'||!Array.isArray(data.urls))return;event.waitUntil((async()=>{const c=await caches.open(RUNTIME_CACHE);const urls=[...new Set(data.urls)].slice(0,160);await Promise.all(urls.map(async value=>{try{const url=new URL(value,self.location.href);if(!['http:','https:'].includes(url.protocol))return;const req=new Request(url.href,{mode:url.origin===self.location.origin?'same-origin':'no-cors',credentials:'omit'});const res=await fetch(req);if(res.ok||res.type==='opaque')await c.put(req,res.clone());}catch(_){}}));})());});
self.addEventListener('fetch',event=>{const req=event.request;if(req.method!=='GET')return;const url=new URL(req.url);if(req.mode==='navigate'){event.respondWith((async()=>{try{const res=await fetch(req);if(res.ok){const c=await caches.open(SHELL_CACHE);c.put('./index.html',res.clone()).catch(()=>{});}return res;}catch(_){return(await caches.match(req))||(await caches.match('./index.html'))||Response.error();}})());return;}const same=url.origin===self.location.origin;const isStatic=same&&(url.pathname.includes('/assets/')||/\.(?:png|jpe?g|webp|svg|css|js|woff2?)$/i.test(url.pathname));if(isStatic||req.destination==='image'){event.respondWith((async()=>{const cached=await caches.match(req);if(cached)return cached;try{const res=await fetch(req);if(res.ok||res.type==='opaque'){const c=await caches.open(RUNTIME_CACHE);c.put(req,res.clone()).catch(()=>{});}return res;}catch(_){return(await caches.match(req))||Response.error();}})());}});
