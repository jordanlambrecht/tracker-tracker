// src/lib/download-clients/rtorrent/xmlrpc.ts
//
// Functions:
//   encodeMethodCall     - A methodCall document for one method and its params
//   decodeMethodResponse - The single value of a methodResponse, or its fault thrown

import { XMLParser } from "fast-xml-parser"

export type XmlRpcValue =
  | string
  | number
  | boolean
  | null
  | XmlRpcValue[]
  | { [key: string]: XmlRpcValue }

/**
 * A fault rTorrent answered with. The fault string is host-sent and can quote a
 * tracker URL, so only the code is kept.
 */
export class XmlRpcFault extends Error {
  readonly faultCode: number

  constructor(faultCode: number) {
    super(`XML-RPC fault ${faultCode}`)
    this.name = "XmlRpcFault"
    this.faultCode = faultCode
  }
}

const INT32_MIN = -(2 ** 31)
const INT32_MAX = 2 ** 31 - 1

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function encodeValue(value: XmlRpcValue): string {
  if (value === null) return "<value><nil/></value>"
  if (typeof value === "string") return `<value><string>${escapeXml(value)}</string></value>`
  if (typeof value === "boolean") return `<value><boolean>${value ? 1 : 0}</boolean></value>`
  if (typeof value === "number") {
    if (!Number.isInteger(value)) return `<value><double>${value}</double></value>`
    const tag = value >= INT32_MIN && value <= INT32_MAX ? "i4" : "i8"
    return `<value><${tag}>${value}</${tag}></value>`
  }
  if (Array.isArray(value)) {
    return `<value><array><data>${value.map(encodeValue).join("")}</data></array></value>`
  }
  const members = Object.entries(value)
    .map(([name, v]) => `<member><name>${escapeXml(name)}</name>${encodeValue(v)}</member>`)
    .join("")
  return `<value><struct>${members}</struct></value>`
}

export function encodeMethodCall(method: string, params: XmlRpcValue[]): string {
  const encoded = params.map((p) => `<param>${encodeValue(p)}</param>`).join("")
  return `<?xml version="1.0"?><methodCall><methodName>${escapeXml(method)}</methodName><params>${encoded}</params></methodCall>`
}

const parser = new XMLParser({
  // Hashes and names can look numeric, so every value stays a string until its
  // XML-RPC type says otherwise.
  parseTagValue: false,
  ignoreAttributes: true,
  processEntities: true,
  isArray: (name) => name === "value" || name === "member" || name === "param",
})

type Node = Record<string, unknown>

function isNode(x: unknown): x is Node {
  return x !== null && typeof x === "object" && !Array.isArray(x)
}

function text(x: unknown): string {
  if (typeof x === "string") return x
  if (typeof x === "number" || typeof x === "boolean") return String(x)
  return ""
}

function toNumber(x: unknown): number {
  const n = Number(text(x))
  if (!Number.isFinite(n)) throw new SyntaxError("XML-RPC number did not parse")
  return n
}

function decodeValue(node: unknown): XmlRpcValue {
  // A value with no type element is a string.
  if (!isNode(node)) return text(node)
  if ("string" in node) return text(node.string)
  if ("i4" in node) return toNumber(node.i4)
  if ("int" in node) return toNumber(node.int)
  if ("i8" in node) return toNumber(node.i8)
  if ("double" in node) return toNumber(node.double)
  if ("boolean" in node) return text(node.boolean).trim() === "1"
  if ("nil" in node || "ex:nil" in node) return null
  if ("base64" in node) return text(node.base64)
  if ("array" in node) {
    const data = isNode(node.array) ? node.array.data : undefined
    const values = isNode(data) && Array.isArray(data.value) ? data.value : []
    return values.map(decodeValue)
  }
  if ("struct" in node) {
    const members = isNode(node.struct) && Array.isArray(node.struct.member) ? node.struct.member : []
    const out: Record<string, XmlRpcValue> = {}
    for (const m of members) {
      if (!isNode(m)) continue
      const value = Array.isArray(m.value) ? m.value[0] : ""
      out[text(m.name)] = decodeValue(value)
    }
    return out
  }
  throw new SyntaxError("XML-RPC value had an unknown type")
}

export function decodeMethodResponse(xml: string): XmlRpcValue {
  // XML-RPC never carries a DTD. Refusing one keeps entity expansion out of the parser.
  if (/<!DOCTYPE/i.test(xml)) throw new SyntaxError("XML-RPC response carried a DTD")
  let doc: unknown
  try {
    doc = parser.parse(xml)
  } catch (err) {
    throw new SyntaxError("XML-RPC response was not XML", { cause: err })
  }
  const root = isNode(doc) ? doc.methodResponse : undefined
  if (!isNode(root)) throw new SyntaxError("XML-RPC response had no methodResponse")

  if ("fault" in root) {
    const faultValue = isNode(root.fault) && Array.isArray(root.fault.value) ? root.fault.value[0] : undefined
    const decoded = decodeValue(faultValue)
    const code =
      isNode(decoded) && typeof decoded.faultCode === "number" ? decoded.faultCode : 0
    throw new XmlRpcFault(code)
  }

  const params = isNode(root.params) && Array.isArray(root.params.param) ? root.params.param : []
  const first = params[0]
  if (!isNode(first) || !Array.isArray(first.value)) {
    throw new SyntaxError("XML-RPC response had no value")
  }
  return decodeValue(first.value[0])
}
