import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { research } from './lib/research.js';

const publicRoot = new URL('./public/', import.meta.url);
const assets = new Map([['/', ['index.html','text/html']], ['/app.js',['app.js','text/javascript']], ['/domain.js',['domain.js','text/javascript']], ['/styles.css',['styles.css','text/css']]]);

export function createApp(researchImpl = research) {
  const cache = new Map();
  let active = 0;
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    const json = (status, value) => { res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method !== 'GET') return json(405, { error:'Only GET requests are supported.' });
      if (url.pathname === '/api/research') {
        const vin = url.searchParams.get('vin') || '';
        const year = url.searchParams.get('year') || '';
        const key = `${vin.trim().toUpperCase()}:${year}`;
        const hit = cache.get(key);
        if (hit && Date.now() - hit.time < 15 * 60 * 1000) return json(200, hit.value);
        if (active >= 3) return json(429, { error:'Several lookups are running. Try again in a moment.' });
        active++;
        try {
          const result = await researchImpl(vin, year);
          if ([result.recalls,result.complaints,result.fuel,result.ratings].every(source => source && ['available','not-covered'].includes(source.status))) {
            if (cache.size >= 50) cache.delete(cache.keys().next().value);
            cache.set(key, { time:Date.now(), value:result });
          }
          return json(200, result);
        } finally { active--; }
      }
      const asset = assets.get(url.pathname);
      if (!asset) return json(404, { error:'Not found' });
      const data = await readFile(new URL(asset[0], publicRoot));
      res.writeHead(200, { 'Content-Type':`${asset[1]}; charset=utf-8` });
      res.end(data);
    } catch (error) { json(error.status || 500, { error:error.status ? error.message : 'Something went wrong. Please retry.' }); }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8000);
  createApp().listen(port, '127.0.0.1', () => console.log(`Car Research is ready at http://127.0.0.1:${port}`));
}
