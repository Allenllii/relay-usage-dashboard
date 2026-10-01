// 用量面板 · 本地模式服务（可选）
// 网页版（GitHub Pages）在浏览器里直连各接口；以下两种情况需要用本地模式：
//   - 百度 AK/SK 鉴权：签名需要的 x-bce-date 请求头不在百度允许的跨域请求头里，浏览器发不出去；
//   - new-api 管理接口默认不带跨域响应头，浏览器直连会被拦截。
// 本服务的作用：
//   1) 提供页面（index.html / models.js / demo.js）；
//   2) 把 /api/v1/* 转发到百度接入域名，并完成鉴权（Bearer，或按 BCE V1 规范做 AK/SK 签名，SK 只在本机参与计算）；
//   3) 把 /newapi/api/* 转发到 new-api（只放行几个只读接口）。
//
// 凭证来源（页面上填的优先）：页面「连接」区域，或同目录 config.json（参考 config.example.json）。
//
// 启动：node server.js   → 打开 http://127.0.0.1:8787

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')); } catch { return {}; }
}

const STATIC = { '/': 'index.html', '/index.html': 'index.html', '/models.js': 'models.js', '/demo.js': 'demo.js' };

// 兜底：任何意外错误都回给页面一条错误信息，而不是让服务崩掉
const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    console.error('请求处理出错：', e);
    if (!res.headersSent) sendJson(res, 500, { success: false, code: 'LocalError', message: `本地服务出错：${e.message}`, request_id: 'local' });
    else res.end();
  });
});

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (STATIC[url.pathname]) {
    const file = STATIC[url.pathname];
    res.writeHead(200, {
      'Content-Type': file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    return fs.createReadStream(path.join(__dirname, file)).pipe(res);
  }
  if (url.pathname === '/config') {
    // 只告诉页面「配置了什么」，不回传任何密钥
    const c = loadConfig();
    return sendJson(res, 200, {
      proxy: true, // 页面据此判断：走本机转发（本地模式），否则直连（网页模式）
      upstream: c.upstream || '',
      auth: c.auth || '',
      hasApiKey: !!c.apiKey,
      hasAkSk: !!(c.ak && c.sk),
      newapiBase: c.newapiBase || '',
      hasNewapiToken: !!c.newapiToken,
    });
  }
  if (url.pathname.startsWith('/newapi/api/')) {
    return proxyNewapi(req, url, res);
  }
  if (!url.pathname.startsWith('/api/v1/')) {
    return sendJson(res, 404, { code: 'NotFound', message: 'not found', request_id: 'local' });
  }

  const body = await readBody(req);
  const cfg = loadConfig();
  const h = (name) => String(req.headers[name] || '').trim();
  const upstream = (h('x-upstream') || cfg.upstream || '').replace(/\/+$/, '');
  const mode = h('x-auth-mode') || cfg.auth || 'bearer';
  const apiKey = h('x-api-key') || cfg.apiKey || '';
  const ak = h('x-bce-ak') || cfg.ak || '';
  const sk = h('x-bce-sk') || cfg.sk || '';

  if (!upstream) return localErr(res, 400, '还没填接入域名');
  if (mode === 'bearer' && !apiKey) return localErr(res, 400, '还没填 API Key');
  if (mode === 'aksk' && !(ak && sk)) return localErr(res, 400, '还没填 AK / SK');

  let target;
  try {
    target = new URL(url.pathname + url.search, upstream.includes('://') ? upstream : `https://${upstream}`);
  } catch {}
  if (!target || !['http:', 'https:'].includes(target.protocol)) {
    return localErr(res, 400, `接入域名格式不对：「${upstream}」，例如 aigw.bce.baidu.com`);
  }

  const headers = { Accept: 'application/json', Host: target.host };
  if (body.length) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = String(body.length);
  }
  if (mode === 'aksk') {
    Object.assign(headers, signBce({ ak, sk, method: req.method, url: target, headers }));
  } else {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const lib = target.protocol === 'http:' ? http : https;
  const upReq = lib.request(target, { method: req.method, headers, timeout: 30000 }, (upRes) => {
    res.writeHead(upRes.statusCode, {
      'Content-Type': upRes.headers['content-type'] || 'application/json',
      'Cache-Control': 'no-store',
    });
    upRes.pipe(res);
  });
  upReq.on('timeout', () => upReq.destroy(new Error('上游 30 秒无响应')));
  upReq.on('error', (e) => {
    if (!res.headersSent) localErr(res, 502, `连不上接入域名：${e.message}`, 'LocalProxyError');
  });
  upReq.end(body);
}

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`用量面板已启动：http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}`);
    const c = loadConfig();
    if (c.upstream) console.log(`已读取 config.json：接入域名 ${c.upstream}，鉴权方式 ${c.auth || 'bearer'}`);
  });
}

// ---------------- new-api 管理接口转发 ----------------
// 页面请求 /newapi/api/xxx → 转发到 {new-api 地址}/api/xxx，只放行下面几个只读接口。
// 鉴权：Authorization: Bearer <管理员访问令牌>；旧版 new-api 还要求 New-Api-User: <用户ID>（新版会忽略）。
const NEWAPI_ALLOW = new Set(['/api/status', '/api/data/', '/api/data/users', '/api/data/flow', '/api/user/', '/api/log/stat']);

function proxyNewapi(req, url, res) {
  const apiPath = url.pathname.slice('/newapi'.length);
  if (req.method !== 'GET' || !NEWAPI_ALLOW.has(apiPath)) {
    return sendJson(res, 404, { success: false, message: `面板未放行该接口：${req.method} ${apiPath}` });
  }
  const cfg = loadConfig();
  const h = (name) => String(req.headers[name] || '').trim();
  const base = (h('x-newapi-base') || cfg.newapiBase || '').replace(/\/+$/, '');
  const token = h('x-newapi-token') || cfg.newapiToken || '';
  const userId = h('x-newapi-user') || cfg.newapiUserId || '';
  if (!base) return sendJson(res, 400, { success: false, message: '还没填 new-api 地址' });
  if (!token && apiPath !== '/api/status') return sendJson(res, 400, { success: false, message: '还没填 new-api 访问令牌' });

  let target;
  try { target = new URL(apiPath + url.search, base.includes('://') ? base : `https://${base}`); } catch {}
  if (!target || !['http:', 'https:'].includes(target.protocol)) {
    return sendJson(res, 400, { success: false, message: `new-api 地址格式不对：「${base}」。应为 https://你们的域名 这种形式，前后不要有多余字符` });
  }

  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (userId) headers['New-Api-User'] = userId;
  const lib = target.protocol === 'http:' ? http : https;
  const upReq = lib.request(target, { method: 'GET', headers, timeout: 30000 }, (upRes) => {
    res.writeHead(upRes.statusCode, { 'Content-Type': upRes.headers['content-type'] || 'application/json', 'Cache-Control': 'no-store' });
    upRes.pipe(res);
  });
  upReq.on('timeout', () => upReq.destroy(new Error('new-api 30 秒无响应')));
  upReq.on('error', (e) => {
    if (!res.headersSent) sendJson(res, 502, { success: false, message: `连不上 new-api：${e.message}` });
  });
  upReq.end();
}

// ---------------- 百度云 BCE V1 签名 ----------------
// 规范：Authorization = bce-auth-v1/{AK}/{timestamp}/{expire}/{signedHeaders}/{signature}
//   signingKey = HMAC-SHA256-HEX(SK, "bce-auth-v1/{AK}/{timestamp}/{expire}")
//   CanonicalRequest = Method \n CanonicalURI \n CanonicalQueryString \n CanonicalHeaders
//   signature = HMAC-SHA256-HEX(signingKey, CanonicalRequest)
// 注意：CanonicalURI 只放路径，查询参数单独放 CanonicalQueryString（文档特别强调过）。

function uriEncode(s, keepSlash = false) {
  return encodeURIComponent(s)
    .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%2F/g, keepSlash ? '/' : '%2F');
}

// 纯计算部分，单独拆出来便于用百度官方示例做校验（见 test-sign.js）
function bceSignature({ ak, sk, timestamp, expire, method, pathname, searchParams, signHeaders }) {
  const canonicalUri = uriEncode(decodeURIComponent(pathname), true) || '/';
  const canonicalQuery = [...searchParams]
    .filter(([k]) => k.toLowerCase() !== 'authorization')
    .map(([k, v]) => `${uriEncode(k)}=${uriEncode(v)}`)
    .sort()
    .join('&');
  const lower = Object.fromEntries(Object.entries(signHeaders).map(([k, v]) => [k.toLowerCase(), String(v).trim()]));
  const names = Object.keys(lower).sort();
  const canonicalHeaders = names.map((n) => `${uriEncode(n)}:${uriEncode(lower[n])}`).sort().join('\n');
  const canonicalRequest = [method.toUpperCase(), canonicalUri, canonicalQuery, canonicalHeaders].join('\n');

  const prefix = `bce-auth-v1/${ak}/${timestamp}/${expire}`;
  const signingKey = crypto.createHmac('sha256', sk).update(prefix).digest('hex');
  const signature = crypto.createHmac('sha256', signingKey).update(canonicalRequest).digest('hex');
  return { canonicalRequest, signingKey, signature, signedHeaders: names.join(';'), prefix };
}

function signBce({ ak, sk, method, url, headers, now = new Date(), expire = 1800 }) {
  const timestamp = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const signHeaders = { host: url.host, 'x-bce-date': timestamp };
  if (headers['Content-Type']) signHeaders['content-type'] = headers['Content-Type'];
  const r = bceSignature({ ak, sk, timestamp, expire, method, pathname: url.pathname, searchParams: url.searchParams, signHeaders });
  return {
    Authorization: `${r.prefix}/${r.signedHeaders}/${r.signature}`,
    'x-bce-date': timestamp,
  };
}

// ---------------- 工具 ----------------
function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function localErr(res, status, message, code = 'LocalConfig') {
  return sendJson(res, status, { code, message, request_id: 'local' });
}

module.exports = { signBce, bceSignature };
