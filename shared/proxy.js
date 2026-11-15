'use strict';
const http = require('node:http');

// Reuse the same mount/redirect rules for /coach on the student gateway and
// /member on the dedicated coach origin. Browser URLs always stay same-origin.
function proxy(targetPort, { prefix = '' } = {}) {
  return (req, res) => {
    const headers = { ...req.headers, host: `localhost:${targetPort}`,
      'x-dojo-proxy': '1', 'x-dojo-mount': prefix };
    const outgoing = http.request({ hostname: '127.0.0.1', port: targetPort,
      path: req.url, method: req.method, headers }, incoming => {
      const responseHeaders = { ...incoming.headers };
      const location = responseHeaders.location;
      if (prefix && location && location.startsWith('/') && !location.startsWith('//') &&
          location !== prefix && !location.startsWith(prefix + '/') && !location.startsWith(prefix + '?')) {
        responseHeaders.location = prefix + location;
      }
      res.writeHead(incoming.statusCode, responseHeaders);
      incoming.pipe(res);
    });
    outgoing.on('error', () => {
      if (res.headersSent) return res.destroy();
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bad Gateway');
    });
    req.on('aborted', () => outgoing.destroy());
    req.pipe(outgoing);
  };
}
module.exports = { proxy };
