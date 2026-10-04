import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const port = Number.parseInt(process.env.PORT ?? '4173', 10);

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.webp', 'image/webp']
]);

function sendError(response, statusCode, message) {
  response.writeHead(statusCode, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store'
  });
  response.end(`${message}\n`);
}

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { allow: 'GET, HEAD' });
    response.end();
    return;
  }

  try {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname === '/') {
      response.writeHead(302, { location: '/site/' });
      response.end();
      return;
    }

    const pathname = decodeURIComponent(url.pathname);
    let filePath = resolve(docsRoot, `.${pathname}`);
    if (filePath !== docsRoot && !filePath.startsWith(`${docsRoot}${sep}`)) {
      sendError(response, 403, 'Forbidden');
      return;
    }

    const fileStats = await stat(filePath);
    if (fileStats.isDirectory()) {
      if (!pathname.endsWith('/')) {
        response.writeHead(301, { location: `${pathname}/${url.search}` });
        response.end();
        return;
      }
      filePath = join(filePath, 'index.html');
    }

    const finalStats = await stat(filePath);
    if (!finalStats.isFile()) {
      sendError(response, 404, 'Not found');
      return;
    }

    response.writeHead(200, {
      'content-type': contentTypes.get(extname(filePath)) ?? 'application/octet-stream',
      'content-length': finalStats.size,
      'cache-control': 'no-store'
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    createReadStream(filePath).pipe(response);
  } catch (error) {
    const statusCode = error?.code === 'ENOENT' ? 404 : 400;
    sendError(response, statusCode, statusCode === 404 ? 'Not found' : 'Bad request');
  }
});

server.on('error', (error) => {
  console.error(`Documentation server failed: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Documentation server: http://localhost:${port}/site/`);
});

function stop() {
  server.close(() => {
    process.exitCode = 0;
  });
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
