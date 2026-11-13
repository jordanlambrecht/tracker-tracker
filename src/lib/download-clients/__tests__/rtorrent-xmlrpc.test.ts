// src/lib/download-clients/__tests__/rtorrent-xmlrpc.test.ts

import { describe, expect, it } from "vitest"
import { decodeMethodResponse, encodeMethodCall, XmlRpcFault } from "../rtorrent/xmlrpc"

function response(value: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><methodResponse><params><param><value>${value}</value></param></params></methodResponse>`
}

function fault(code: number, message: string): string {
  return `<?xml version="1.0"?><methodResponse><fault><value><struct><member><name>faultCode</name><value><i4>${code}</i4></value></member><member><name>faultString</name><value><string>${message}</string></value></member></struct></value></fault></methodResponse>`
}

describe("encodeMethodCall", () => {
  it("encodes system.multicall", () => {
    const xml = encodeMethodCall("system.multicall", [
      [{ methodName: "throttle.global_up.rate", params: [""] }],
    ])
    expect(xml).toContain("<methodName>system.multicall</methodName>")
    expect(xml).toContain(
      "<member><name>methodName</name><value><string>throttle.global_up.rate</string></value></member>"
    )
    expect(xml).toContain("<array><data>")
  })

  it("escapes strings", () => {
    expect(encodeMethodCall("d.name", ["a&b<c>"])).toContain("a&amp;b&lt;c&gt;")
  })

  it("encodes integers as i4 and booleans", () => {
    const xml = encodeMethodCall("x", [7, true])
    expect(xml).toContain("<i4>7</i4>")
    expect(xml).toContain("<boolean>1</boolean>")
  })
})

describe("decodeMethodResponse", () => {
  it("decodes nested arrays of i8 and string", () => {
    const xml = response(
      "<array><data><value><array><data><value><string>ABC</string></value><value><i8>123</i8></value></data></array></value></data></array>"
    )
    expect(decodeMethodResponse(xml)).toEqual([["ABC", 123]])
  })

  it("decodes xmlrpc-c's line-broken output", () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\r\n<methodResponse>\r\n<params>\r\n<param><value><array><data>\r\n<value><string>alice</string></value>\r\n<value><i8>0</i8></value>\r\n</data></array></value></param>\r\n</params>\r\n</methodResponse>\r\n'
    expect(decodeMethodResponse(xml)).toEqual(["alice", 0])
  })

  it("decodes an empty array", () => {
    expect(decodeMethodResponse(response("<array><data></data></array>"))).toEqual([])
  })

  it("keeps numeric-looking strings", () => {
    expect(decodeMethodResponse(response("<string>1E5</string>"))).toBe("1E5")
    expect(decodeMethodResponse(response("0042"))).toBe("0042")
    expect(decodeMethodResponse(response("<string></string>"))).toBe("")
  })

  it("decodes entities", () => {
    expect(decodeMethodResponse(response("<string>Ada &amp; Bob &lt;3</string>"))).toBe(
      "Ada & Bob <3"
    )
  })

  it("decodes int, boolean, double and struct", () => {
    const xml = response(
      "<struct><member><name>a</name><value><int>5</int></value></member><member><name>b</name><value><boolean>1</boolean></value></member><member><name>c</name><value><double>1.5</double></value></member></struct>"
    )
    expect(decodeMethodResponse(xml)).toEqual({ a: 5, b: true, c: 1.5 })
  })

  it("throws XmlRpcFault without faultString", () => {
    let caught: unknown
    try {
      decodeMethodResponse(fault(-506, "secret passkey here"))
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(XmlRpcFault)
    expect((caught as XmlRpcFault).faultCode).toBe(-506)
    expect((caught as Error).message).not.toContain("passkey")
  })

  it("throws SyntaxError on HTML", () => {
    expect(() => decodeMethodResponse("<html><body>Login</body></html>")).toThrow(SyntaxError)
    expect(() => decodeMethodResponse("not xml at all")).toThrow(SyntaxError)
  })
})
