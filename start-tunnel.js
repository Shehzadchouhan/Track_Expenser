const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
require('@next/env').loadEnvConfig(__dirname);

const cloudflaredPath = path.join(__dirname, 'cloudflared.exe');
if (!fs.existsSync(cloudflaredPath)) {
  console.error('Error: cloudflared.exe not found in ' + __dirname);
  process.exit(1);
}

console.log('========================================================');
console.log('  Starting Cloudflare Tunnel for Track Expenser...');
console.log('  Connecting local port 3000 to Meta WhatsApp Cloud API');
console.log('========================================================\n');

const child = spawn(cloudflaredPath, ['tunnel', '--url', 'http://localhost:3000'], {
  stdio: ['ignore', 'pipe', 'pipe']
});

let detectedUrl = null;

function processOutput(chunk) {
  const text = chunk.toString();
  // Look for https://*.trycloudflare.com
  const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  if (match && !detectedUrl) {
    detectedUrl = match[0];
    const webhookUrl = `${detectedUrl}/api/webhook/whatsapp`;
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

    console.log('\n========================================================================');
    console.log('✅ CLOUDFLARE TUNNEL IS ONLINE!');
    console.log('========================================================================');
    console.log(`🌐 Public Tunnel URL: ${detectedUrl}`);
    console.log(`🔗 Webhook Callback:  ${webhookUrl}`);
    console.log(
      `🔑 Verify Token:      ${verifyToken ? 'Use WHATSAPP_VERIFY_TOKEN from your environment' : 'Not configured; webhook verification will fail'}`
    );
    console.log('========================================================================');
    console.log('👉 META DEVELOPER PORTAL SETUP:');
    console.log('1. Go to: https://developers.facebook.com/apps/1886927829336799/whatsapp-business/configuration/');
    console.log('2. In "Webhook" section, click "Edit"');
    console.log(`3. Paste Callback URL: ${webhookUrl}`);
    console.log('4. Enter the configured WHATSAPP_VERIFY_TOKEN');
    console.log('5. Click "Verify and Save"');
    console.log('========================================================================\n');
    console.log('Listening for incoming WhatsApp messages and screenshots...\n');

    try {
      fs.writeFileSync(path.join(__dirname, 'tunnel-url.txt'), webhookUrl, 'utf8');
    } catch {}
  }
}

child.stdout.on('data', processOutput);
child.stderr.on('data', processOutput);

child.on('close', (code) => {
  console.log(`\nCloudflare Tunnel stopped (exit code: ${code}).`);
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
  process.exit();
});
process.on('SIGTERM', () => {
  child.kill('SIGTERM');
  process.exit();
});
