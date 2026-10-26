const { createServer, request } = require('node:http')

// An actual receiver can observe page-exit keepalive requests after browser interception detaches.
exports.startLocalApi = async (frontend, respond) => {
  const target = new URL(frontend)
  if (target.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) {
    throw new Error('Browser fixtures require a local HTTP frontend')
  }
  const server = createServer((incoming, outgoing) => {
    let url
    try {
      url = new URL(incoming.url, target)
    } catch {
      outgoing.writeHead(400).end()
      return
    }
    if (url.origin !== target.origin) {
      outgoing.writeHead(400).end()
      return
    }
    if (url.pathname.startsWith('/api/')) {
      outgoing.writeHead(200, { 'content-type': 'application/json' })
      outgoing.end(JSON.stringify(respond(url.pathname, incoming.method)))
      return
    }
    const proxy = request(
      {
        hostname: target.hostname,
        port: target.port,
        path: url.pathname + url.search,
        headers: { ...incoming.headers, host: target.host },
      },
      (response) => {
        outgoing.writeHead(response.statusCode, response.headers)
        response.pipe(outgoing)
      },
    )
    proxy.on('error', () => outgoing.destroy())
    incoming.pipe(proxy)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () =>
      new Promise((resolve) => {
        server.close(resolve)
        server.closeAllConnections()
      }),
  }
}
