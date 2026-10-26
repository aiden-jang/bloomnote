const { createServer, request } = require('node:http')

// An actual receiver can observe page-exit keepalive requests after browser interception detaches.
exports.startLocalApi = async (frontend, respond) => {
  const server = createServer((incoming, outgoing) => {
    const url = new URL(incoming.url, frontend)
    if (url.pathname.startsWith('/api/')) {
      outgoing.writeHead(200, { 'content-type': 'application/json' })
      outgoing.end(JSON.stringify(respond(url.pathname, incoming.method)))
      return
    }
    const proxy = request(url, { headers: { ...incoming.headers, host: url.host } }, (response) => {
      outgoing.writeHead(response.statusCode, response.headers)
      response.pipe(outgoing)
    })
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
