/* Omar & Ola wedding invitation — v1.0.0 responsive/audio polish hotfix. */
const BUILD='v1.0.0-polish1';
const CACHE=`omar-ola-${BUILD}`;
const SHELL=[
  './','./index.html','./index-base.html','./js/qrcode-local.js?v=1.0.0','./js/app.js?v=1.0.0','./js/polish.js?v=1.0.1','./manifest.webmanifest',
  './img/monogram.webp','./img/name-omar.webp','./img/name-ola.webp','./img/name-wa.webp',
  './img/floral-top.webp','./img/floral-bottom.webp',
  './img/icon-192.png','./img/icon-512.png','./img/apple-touch-icon.png'
];
const PRIVATE_PHOTO=/\/img\/engagement(?:-800)?\.webp$/i;

self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())
));

self.addEventListener('activate',event=>event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
));

const networkFirst=async(req,fallback)=>{
  const cache=await caches.open(CACHE);
  try{
    const res=await fetch(req,{cache:'no-cache'});
    if(res&&res.ok)cache.put(req,res.clone());
    return res;
  }catch(err){
    return(await cache.match(req))||(fallback?await cache.match(fallback):undefined)||Response.error();
  }
};

const staleWhileRevalidate=async req=>{
  const cache=await caches.open(CACHE),hit=await cache.match(req);
  const update=fetch(req).then(res=>{if(res&&res.ok)cache.put(req,res.clone());return res;}).catch(()=>null);
  return hit||(await update)||Response.error();
};

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;

  if(/\.mp3$/i.test(url.pathname)||req.headers.has('range'))return;
  if(/(?:^|\/)admin(?:\.html)?$/i.test(url.pathname)||/(?:^|\/)js\/admin\.js$/i.test(url.pathname)||/(?:^|\/)css\/admin\.css$/i.test(url.pathname))return;

  /* Couple photo: never put it in the app cache. When the site is already controlled,
     direct document navigation to the raw photo URL is rejected. This is deterrence,
     not DRM: a web page cannot stop OS screenshots or a determined developer-tools user. */
  if(PRIVATE_PHOTO.test(url.pathname)){
    if(req.mode==='navigate'){
      event.respondWith(new Response('Not found',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}}));
    }else{
      event.respondWith(fetch(req,{cache:'no-store'}).then(res=>{
        const headers=new Headers(res.headers);
        headers.set('Cache-Control','no-store, no-cache, must-revalidate');
        headers.set('Cross-Origin-Resource-Policy','same-origin');
        return new Response(res.body,{status:res.status,statusText:res.statusText,headers});
      }));
    }
    return;
  }

  if(req.mode==='navigate'){event.respondWith(networkFirst(req,'./index.html'));return;}
  if(/\.(?:js|css)$/i.test(url.pathname)){event.respondWith(networkFirst(req));return;}
  if(/\.(?:png|jpe?g|webp|svg|ico|webmanifest)$/i.test(url.pathname)){event.respondWith(staleWhileRevalidate(req));return;}
  event.respondWith(networkFirst(req));
});
