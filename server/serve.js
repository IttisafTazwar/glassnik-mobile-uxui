/**
 * Glassnik production server.
 *
 * Native Expo:
 *   GET / or /manifest + expo-platform header -> native manifest
 *   static-build/* -> native bundles/assets
 *
 * Web:
 *   Normal browser requests -> Expo web export in dist/
 *   Unknown browser routes -> dist/index.html for Expo Router
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const STATIC_ROOT = path.resolve(__dirname, '..', 'static-build');
const WEB_ROOT = path.resolve(__dirname, '..', 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json',
};

function sendFile(filePath, res) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.writeHead(200, {
    'content-type': contentType,
    'cache-control':
      ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });

  fs.createReadStream(filePath).pipe(res);
  return true;
}

function serveManifest(platform, res) {
  const manifestPath = path.join(STATIC_ROOT, platform, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        error: `Manifest not found for platform: ${platform}`,
      }),
    );
    return;
  }

  const manifest = fs.readFileSync(manifestPath, 'utf-8');

  res.writeHead(200, {
    'content-type': 'application/json',
    'expo-protocol-version': '1',
    'expo-sfv-version': '0',
  });

  res.end(manifest);
}

function safeResolve(root, urlPath) {
  const relativePath = urlPath.replace(/^\/+/, '');
  const resolved = path.resolve(root, relativePath);

  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return null;
  }

  return resolved;
}

function serveNativeStatic(pathname, res) {
  const filePath = safeResolve(STATIC_ROOT, pathname);
  if (!filePath) return false;
  return sendFile(filePath, res);
}

function serveWeb(pathname, res) {
  const requested = safeResolve(WEB_ROOT, pathname);

  if (requested && sendFile(requested, res)) {
    return;
  }

  // Expo Router client-side fallback.
  const indexPath = path.join(WEB_ROOT, 'index.html');

  if (!sendFile(indexPath, res)) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Web build not found');
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);
  const platform = req.headers['expo-platform'];

  // Expo Go/native clients request the manifest here.
  if (
    (pathname === '/' || pathname === '/manifest') &&
    (platform === 'ios' || platform === 'android')
  ) {
    return serveManifest(platform, res);
  }

  /*
   * Native manifests reference files inside static-build.
   * Try native static files before web fallback.
   */
  if (pathname !== '/' && serveNativeStatic(pathname, res)) {
    return;
  }

  // Everything else is the browser build.
  serveWeb(pathname, res);
});

const port = parseInt(process.env.PORT || '8080', 10);

server.listen(port, '0.0.0.0', () => {
  console.log(`Glassnik production server listening on port ${port}`);
  console.log(`Native root: ${STATIC_ROOT}`);
  console.log(`Web root: ${WEB_ROOT}`);
});
