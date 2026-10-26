import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
import { test } from 'node:test'
import { startLocalApi } from '../packages/web/e2e/local-api.cjs'

async function serve(handler) {
  const server = createServer((incoming, outgoing) => {
    outgoing.setHeader('content-type', 'text/plain; charset=utf-8')
    handler(incoming, outgoing)
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

function read(origin, path) {
  return new Promise((resolve, reject) => {
    const pending = request(origin, { path }, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => (body += chunk))
      response.on('end', () => resolve({ status: response.statusCode, body }))
    })
    pending.on('error', reject)
    pending.end()
  })
}

test('the local browser fixture proxies frontend paths and queries', async () => {
  const frontend = await serve((incoming, outgoing) => outgoing.end(incoming.url))
  const fixture = await startLocalApi(frontend.origin, () => ({}))
  try {
    assert.deepEqual(await read(fixture.origin, '/probe?color=rose'), {
      status: 200,
      body: '/probe?color=rose',
    })
  } finally {
    await fixture.close()
    await frontend.close()
  }
})

test('a request cannot redirect the browser fixture to another server', async () => {
  let foreignRequests = 0
  const frontend = await serve((_incoming, outgoing) => outgoing.end('frontend'))
  const foreign = await serve((_incoming, outgoing) => {
    foreignRequests++
    outgoing.end('private fixture')
  })
  const fixture = await startLocalApi(frontend.origin, () => ({}))
  try {
    assert.equal((await read(fixture.origin, `${foreign.origin}/private`)).status, 400)
    assert.equal((await read(fixture.origin, 'http://[')).status, 400)
    assert.equal(foreignRequests, 0)
  } finally {
    await fixture.close()
    await frontend.close()
    await foreign.close()
  }
})

test('browser fixtures refuse nonlocal frontend configuration', async () => {
  await assert.rejects(
    startLocalApi('https://example.test', () => ({})),
    /local HTTP frontend/,
  )
})
