const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const CFG_PATH = path.join(ROOT, 'opencode.json');

function loadConfig() {
  const raw = fs.readFileSync(CFG_PATH, 'utf8');
  const cfg = JSON.parse(raw);
  const p = cfg.provider && cfg.provider.xkiro ? cfg.provider.xkiro : null;
  if (!p || !p.options || !p.options.baseURL || !p.options.apiKey) {
    throw new Error('opencode.json sin provider.xkiro.options.baseURL/apiKey');
  }
  return {
    baseURL: p.options.baseURL.replace(/\/+$/, ''),
    apiKey: p.options.apiKey,
    models: Object.keys(p.models || {})
  };
}

function postJson(urlStr, apiKey, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === 'https:' ? https : http;
    const body = JSON.stringify(payload);
    const req = lib.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout ' + timeoutMs + 'ms')));
    req.write(body);
    req.end();
  });
}

async function main() {
  const prompt = process.argv.slice(2).join(' ') || 'Hola, responde con: OK qwen 3.8 max funcionando';
  const cfg = loadConfig();
  const wanted = process.env.QWEN_MODEL || 'qwen/qwen3.8-max';
  const candidates = [wanted].concat(cfg.models.filter((m) => m !== wanted));
  const url = cfg.baseURL + '/chat/completions';
  console.log('POST ' + url);
  console.log('Modelos en opencode.json: ' + (cfg.models.join(', ') || '(ninguno)'));
  let lastErr = null;
  for (const model of candidates) {
    console.log('Probando modelo: ' + model);
    try {
      const r = await postJson(url, cfg.apiKey, {
        model: model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.7
      }, 60000);
      if (r.status >= 200 && r.status < 300) {
        let j;
        try {
          j = JSON.parse(r.body);
        } catch (e) {
          console.log('Respuesta no-JSON: ' + r.body.slice(0, 1000));
          return;
        }
        const text = j.choices && j.choices[0] && j.choices[0].message
          ? j.choices[0].message.content
          : JSON.stringify(j).slice(0, 2000);
        console.log('OK con modelo: ' + model);
        console.log('---RESPUESTA---');
        console.log(text);
        if (j.usage) console.log('USAGE ' + JSON.stringify(j.usage));
        return;
      }
      console.log('HTTP ' + r.status + ' con ' + model + ' -> ' + r.body.slice(0, 1000));
      lastErr = new Error('HTTP ' + r.status + ' ' + r.body.slice(0, 300));
      if (r.status === 401) break;
    } catch (e) {
      console.log('Fallo red con ' + model + ' -> ' + e.message);
      lastErr = e;
    }
  }
  console.error('No responde qwen. Ultimo error: ' + (lastErr ? lastErr.message : 'desconocido'));
  process.exit(1);
}

main();
