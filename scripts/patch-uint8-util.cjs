const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../node_modules/uint8-util/dist/src/node.js');

try {
  if (fs.existsSync(targetFile)) {
    let content = fs.readFileSync(targetFile, 'utf8');
    const buggyCode = "export const arr2hex = (data) => Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('hex');";
    const fixedCode = "export const arr2hex = (data) => typeof data === 'string' ? data : Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('hex');";

    if (content.includes(buggyCode)) {
      content = content.replace(buggyCode, fixedCode);
      fs.writeFileSync(targetFile, content, 'utf8');
      console.log('[patch-uint8-util] Successfully patched uint8-util arr2hex for WebTorrent compatibility');
    }
  }
} catch (err) {
  console.warn('[patch-uint8-util] Could not patch uint8-util:', err.message);
}
