// ネットが つながらない ときも ひらけるように、アプリの ファイルを 端末に とっておく
// いつもは ネットの 最新を つかい(なおした ところが すぐ 出るように)、つながらない ときだけ とっておいた ものを つかう
// 同じ ドメイン(github.io など)の ほかの アプリと まざらないように、
// この アプリの 場所(scope)を 名まえに 入れ、消すのも 読むのも この アプリの ものだけに する
const PREFIX = `yarukoto:${self.registration.scope}:`;
const CACHE = `${PREFIX}v1`;
const FILES = ['./', './index.html', './style.css', './app.js', './icon.svg', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k.startsWith(PREFIX) && k !== CACHE) // この アプリの ふるい ものだけ
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.open(CACHE).then((c) => c.match(req, { ignoreSearch: true })
        .then((hit) => hit || c.match('./index.html')))),
  );
});
