import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

const siteRoot = resolve('website/dist');
const port = Number.parseInt(process.env.PORT ?? '4174', 10);
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
    const pathname = decodeURIComponent(url.pathname);
    let filePath = resolve(siteRoot, `.${pathname}`);

    if (filePath !== siteRoot && !filePath.startsWith(`${siteRoot}${sep}`)) {
      sendError(response, 403, 'Forbidden');
      return;
    }

    try {
      const fileStats = await stat(filePath);
      if (fileStats.isDirectory()) filePath = join(filePath, 'index.html');
    } catch {
      filePath = pathname.includes('.') ? filePath : `${filePath}.html`;
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
  console.error(`Website server failed: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Beelzebub website: http://127.0.0.1:${port}/`);
});

function stop() {
  server.close(() => {
    process.exitCode = 0;
  });
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
