// A tiny static file server for game/ (Node 22, standard library only),
// so the entry can be played locally with no build step:
//   node serve.ts                    -> http://localhost:8080
//   node serve.ts --port 9000        -> http://localhost:9000
//   node serve.ts --host 0.0.0.0 --port 9000
// It serves only files under game/, sends the MIME types a browser game
// needs, logs each request on one line, and does nothing else clever —
// a development convenience, not a web server for the internet.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const gameRoot = resolve(fileURLToPath(new URL('./game', import.meta.url)));

function flagValue(argv: string[], flag: string, fallback: string): string {
  const at = argv.indexOf(flag);
  return at === -1 || at + 1 >= argv.length ? fallback : argv[at + 1];
}

function pickPort(argv: string[]): number {
  const n = Number(flagValue(argv, '--port', '8080'));
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : 8080;
}

const MEDIA: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8',
};

const argv = process.argv.slice(2);
const port = pickPort(argv);
const host = flagValue(argv, '--host', '127.0.0.1');

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    response.writeHead(400).end('bad request');
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const filePath = resolve(join(gameRoot, normalize(pathname)));
  if (filePath !== gameRoot && !filePath.startsWith(gameRoot + sep)) {
    response.writeHead(403).end('forbidden');
    return;
  }
  let size: number;
  try {
    const stats = statSync(filePath);
    if (!stats.isFile()) throw new Error('not a file');
    size = stats.size;
  } catch {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, {
    'content-type': MEDIA[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    'content-length': size,
    'cache-control': 'no-store',
  });
  console.log(`${request.method} ${pathname} -> 200 (${size} bytes)`);
  createReadStream(filePath).pipe(response);
}).listen(port, host, () => {
  console.log(`ZENITH is playable at http://${host}:${port}`);
});
