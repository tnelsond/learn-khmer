const C='vow-lao-1';const F=['./','index.html','game.js','content.js','audio.js','three.module.min.js','noto-sans-lao-400.woff2','noto-sans-lao-700.woff2','peakaudio.js','peak.wasm','tnefar.wasm','lao/aux/lo-audio-tnefar.slab','manifest.json','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(F)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{const cp=res.clone();caches.open(C).then(c=>c.put(e.request,cp));return res;}))));
