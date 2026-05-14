#!/usr/bin/env swift

import AppKit
import Foundation

func fail(_ message: String) -> Never {
  FileHandle.standardError.write(Data((message + "\n").utf8))
  exit(1)
}

let args = CommandLine.arguments
guard args.count == 2 else {
  fail("Usage: swift scripts/copy_figma_payload_to_clipboard.swift /path/to/figma-capture.txt")
}

let payloadPath = args[1]
let payloadURL = URL(fileURLWithPath: payloadPath)

let payload: String
do {
  payload = try String(contentsOf: payloadURL, encoding: .utf8)
} catch {
  fail("Failed to read payload: \(error)")
}

guard payload.hasPrefix("<span data-h2d=\"<!--(figh2d)") else {
  fail("Input does not look like a Figma html-to-design payload.")
}

let pasteboard = NSPasteboard.general
pasteboard.clearContents()
pasteboard.setString(payload, forType: .html)
pasteboard.setString("", forType: .string)

let types = pasteboard.types?.map { $0.rawValue }.joined(separator: ", ") ?? "unknown"
print("Wrote \(payload.count) characters to the clipboard as text/html.")
print("Clipboard types: \(types)")
