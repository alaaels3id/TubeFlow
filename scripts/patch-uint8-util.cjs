const fs = require('fs');
const path = require('path');

const filesToPatch = [
  {
    file: path.resolve(__dirname, '../node_modules/uint8-util/dist/src/node.js'),
    buggy: "export const arr2hex = (data) => Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('hex');",
    fixed: "export const arr2hex = (data) => typeof data === 'string' ? data : Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('hex');"
  },
  {
    file: path.resolve(__dirname, '../node_modules/uint8-util/dist/src/browser.js'),
    buggy: "export const arr2hex = (data) => data.toHex();",
    fixed: "export const arr2hex = (data) => typeof data === 'string' ? data : (typeof data.toHex === 'function' ? data.toHex() : Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(''));"
  }
];

for (const { file, buggy, fixed } of filesToPatch) {
  try {
    if (fs.existsSync(file)) {
      let content = fs.readFileSync(file, 'utf8');
      if (content.includes(buggy)) {
        content = content.replace(buggy, fixed);
        fs.writeFileSync(file, content, 'utf8');
        console.log(`[patch-uint8-util] Patched ${path.basename(file)} for WebTorrent compatibility`);
      }
    }
  } catch (err) {
    console.warn(`[patch-uint8-util] Could not patch ${path.basename(file)}:`, err.message);
  }
}
