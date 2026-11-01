// Fake HTTP CONNECT proxy plus a local HTTP target, for proxy-canary.test.sh.
//
// Every CONNECT is tunnelled to the local target, whatever host it names. That
// lets the test use a non-loopback hostname (which sgc's proxy-fetch does not
// bypass) without DNS or network access, and count how many requests actually
// went through the proxy.
//
// Usage: node fake-connect-proxy.cjs <state-prefix>
//   writes <prefix>.port      the proxy's port, once listening
//   writes <prefix>.connects  the number of CONNECTs seen so far
const http = require("node:http")
const net = require("node:net")
const fs = require("node:fs")

const prefix = process.argv[2]
if (!prefix) {
  console.error("usage: node fake-connect-proxy.cjs <state-prefix>")
  process.exit(2)
}
let connects = 0
fs.writeFileSync(`${prefix}.connects`, "0")

const target = http.createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/plain" })
  res.end("sgc-proxy-e2e-ok")
})

target.listen(0, "127.0.0.1", () => {
  const targetPort = target.address().port
  const proxy = http.createServer((_req, res) => {
    res.writeHead(405)
    res.end()
  })
  proxy.on("connect", (_req, client, head) => {
    connects++
    fs.writeFileSync(`${prefix}.connects`, String(connects))
    const upstream = net.connect(targetPort, "127.0.0.1", () => {
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n")
      upstream.write(head)
      upstream.pipe(client)
      client.pipe(upstream)
    })
    upstream.on("error", () => client.destroy())
    client.on("error", () => upstream.destroy())
  })
  proxy.listen(0, "127.0.0.1", () => {
    fs.writeFileSync(`${prefix}.port`, String(proxy.address().port))
  })
})
