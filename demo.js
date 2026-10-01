// 演示数据：地址填 "demo" 时，页面不发任何网络请求，直接由这里按接口文档的规则返回模拟结果。
// 百度部分遵循《数据查询接口》文档；new-api 部分字段与 new-api main 分支源码一致。
(function (root) {
  const MODELS = root.MODELS || (typeof require !== 'undefined' ? require('./models.js') : []);

  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const rid = () => 'demo-' + Math.random().toString(16).slice(2, 10);
  const err = (status, code, message) => ({ status, data: { code, message, request_id: rid() } });

  // ---------------- 百度 ----------------
  const KEYS = [
    ['api-key-011', 'cust-星河科技', true, false, null, 1789900000],
    ['api-key-010', 'cust-蓝鲸教育', true, false, null, 1789000000],
    ['api-key-009', 'cust-小鹿 AI', true, false, 1798761599, 1788500000],
    ['api-key-008', 'relay-pool-b', true, false, null, 1787000000],
    ['api-key-006', 'relay-pool-a', true, false, null, 1786000000],
    ['api-key-005', 'batch-job', false, false, 1798761599, 1756000000],
    ['api-key-004', 'prod-service', true, false, null, 1757000000],
    ['api-key-002', 'legacy', true, true, 1780000000, 1740000000],
  ].map(([id, name, en, ex, exp, ct]) => ({
    api_key_id: id, api_key_name: name,
    key_preview: `sk-${hash(id).toString(16).padStart(8, '0')}******************${hash(id + 'x').toString(16).slice(0, 6).padStart(6, '0')}`,
    is_enabled: en, is_expired: ex, expired_at: exp, created_at: ct,
  }));
  const POPULAR = ['claude-opus-5', 'claude-sonnet-5', 'claude-fable-5', 'gpt-5.5', 'deepseek-v4-pro', 'qwen3.5-plus', 'glm-5.3', 'kimi-k3', 'claude-haiku-4-5-20251001', 'gpt-5.4-mini', 'deepseek-v4-flash'];
  const PRICE = { completion_tokens: 1.625e-5, prompt_cache_hit_tokens: 3.25e-7, prompt_cache_miss_tokens: 3.25e-6, ephemeral_5m_input_tokens: 4.06e-6, ephemeral_1h_input_tokens: 6.5e-6, web_search_requests: 0.07 };

  function baidu(method, path, query, body, authed) {
    if (!authed) return err(401, 'Unauthorized', 'unauthorized');
    if (path === '/api/v1/api-keys' && method === 'GET') {
      const page = query.has('page') ? Number(query.get('page')) : 1;
      const size = query.has('page_size') ? Number(query.get('page_size')) : 20;
      if (!Number.isInteger(page) || page < 1 || !Number.isInteger(size) || size < 1 || size > 100) return err(400, 'InvalidParam', 'invalid page or page_size: invalid parameter');
      return { status: 200, data: { list: KEYS.slice((page - 1) * size, page * size), pagination: { page, page_size: size, total: KEYS.length } } };
    }
    if (path !== '/api/v1/usage' || method !== 'POST') return err(404, 'NotFound', 'not found');

    const { start_time: st, granularity: g = 0, include_cost: cost = false, filters = [] } = body || {};
    let et = body?.end_time;
    if (!(st > 0) || !(et > st)) return err(400, 'InvalidParam', 'start_time/end_time invalid: invalid parameter');
    if (![0, 1, 60, 1440].includes(g)) return err(400, 'InvalidParam', 'granularity must be 1/60/1440: invalid parameter');
    if (et - st > { 0: 31, 1: 1, 60: 7, 1440: 31 }[g] * 86400) return err(400, 'InvalidParam', `time span exceeds limit for granularity ${g}: invalid parameter`);
    if (g === 1 && cost) return err(400, 'InvalidParam', 'include_cost is not supported with granularity=1: invalid parameter');
    const f = {};
    for (const it of filters) {
      if (f[it.key]) return err(400, 'InvalidParam', `duplicate filter ${it.key}: invalid parameter`);
      f[it.key] = (it.value || []).flatMap((v) => String(v).split(',')).map((s) => s.trim()).filter(Boolean);
    }
    if (!f.api_key_id?.length) return err(400, 'InvalidParam', 'filter api_key_id is required: invalid parameter');
    if (!f.model?.length) return err(400, 'InvalidParam', 'filter model is required: invalid parameter');
    if (f.api_key_id.length > 3 || f.model.length > 3) return err(400, 'InvalidParam', 'too many filter values (max 3): invalid parameter');
    if (f.api_key_id.some((k) => !KEYS.find((d) => d.api_key_id === k))) return err(403, 'Forbidden', 'api_key_id not owned by the account');
    const models = [];
    for (const m of f.model) {
      const row = MODELS.find((x) => x[1] === m || x[2] === m);
      if (!row) return err(400, 'InvalidParam', `unknown model ${m}: invalid parameter`);
      models.push(row);
    }

    const now = Math.floor(Date.now() / 1000);
    if (et > now) et = now;
    const step = g ? g * 60 : 0, off = g === 1440 ? 57600 : 0;
    const buckets = [];
    if (step) { for (let t = Math.floor((st - off) / step) * step + off; t < et; t += step) buckets.push(Math.max(t, 0)); }
    else buckets.push(null);

    const list = [];
    for (const ts of buckets) {
      for (const key of f.api_key_id) {
        const ki = KEYS.findIndex((d) => d.api_key_id === key);
        for (const [, ep, name] of models) {
          const pi = POPULAR.indexOf(name);
          if (pi < 0 || hash(key + name) % 3 === 0 || pi > 4 + (ki % 6)) continue;
          if (key === 'api-key-002' && (ts ?? st) > 1780000000) continue;
          const seed = hash(`${key}|${ep}|${ts}`);
          if (ts !== null && seed % 7 === 0) continue;
          const span = step || (et - st);
          const hour = ts === null ? 12 : new Date((ts + 28800) * 1000).getUTCHours();
          const day = ts === null ? 0.7 : (hour >= 9 && hour <= 23 ? 1 : 0.25);
          const scale = span / 3600 * day * (0.4 + (seed % 100) / 100) * (1.6 - pi * 0.12) * (ki < 3 ? 1.8 : 1);
          const items = {
            completion_tokens: Math.round(140000 * scale),
            prompt_cache_hit_tokens: Math.round(18000000 * scale),
            prompt_cache_miss_tokens: Math.round(600000 * scale * ((seed % 5) / 4)),
            ephemeral_5m_input_tokens: Math.round(2400000 * scale),
            ephemeral_1h_input_tokens: Math.round(1300000 * scale * ((seed % 3) / 2)),
          };
          if (seed % 11 === 0) items.web_search_requests = 1 + (seed % 40);
          const usdShare = name.startsWith('gpt') ? 0.35 : seed % 4 === 0 ? 0.15 : 0;
          const parts = cost && usdShare ? [['RMB', 1 - usdShare], ['USD', usdShare]] : [[cost ? 'RMB' : null, 1]];
          for (const [cur, share] of parts) {
            const bi = {};
            for (const [k, v] of Object.entries(items)) {
              if (f.bill_item && !f.bill_item.includes(k)) continue;
              const val = Math.round(v * share);
              if (!val) continue;
              bi[k] = { value: val };
              if (cost) bi[k].cost = Number((val * PRICE[k] * (cur === 'USD' ? 0.14 : 1)).toFixed(8));
            }
            if (!Object.keys(bi).length) continue;
            const row = { api_key_id: key, model_endpoint: ep, model: name, ts };
            if (cur) row.currency = cur;
            row.bill_items = bi;
            list.push(row);
          }
        }
      }
    }
    list.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0) || a.api_key_id.localeCompare(b.api_key_id) || a.model_endpoint.localeCompare(b.model_endpoint));
    return { status: 200, data: { start_time: st, end_time: et, granularity: g || null, list } };
  }

  // ---------------- new-api ----------------
  // [id, username, 显示名, 分组, 角色, 剩余额度（quota，500000 = $1）, 用量倍数]
  const NA_USERS = [
    [1, 'root', '管理员', 'default', 100, 9e9, 0],
    [2, 'xinghe', '星河科技', 'vip', 1, 4.2e8, 3],
    [3, 'lanjing', '蓝鲸教育', 'default', 1, 1.6e8, 1],
    [4, 'xiaolu', '小鹿 AI', 'vip', 1, 3.5e6, 2],
    [5, 'mofang', '魔方工作室', 'default', 1, 2.4e7, 1],
    [6, 'qingcheng', '青橙数据', 'default', 1, 9.5e7, 1],
    [7, 'beichen', '北辰律所', 'vip', 1, 3.1e8, 1],
    [8, 'tester', '测试账号', 'default', 1, 2e6, 0.05],
    [9, 'yunfan', '云帆出海', 'default', 1, 1.2e6, 0],
  ];
  const NA_MODELS = ['claude-opus-5', 'claude-sonnet-5', 'gpt-5.5', 'deepseek-v4-pro', 'qwen3.5-plus', 'claude-fable-5', 'glm-5.3'];

  function naRows(st, et) {
    const rows = [];
    for (let t = Math.ceil(st / 3600) * 3600; t <= et; t += 3600) {
      const hour = new Date((t + 28800) * 1000).getUTCHours();
      const day = hour >= 9 && hour <= 23 ? 1 : 0.2;
      for (const [uid, username, , group, , , weight] of NA_USERS) {
        if (!weight) continue;
        for (let mi = 0; mi < NA_MODELS.length; mi++) {
          const seed = hash(`${username}|${mi}|${t}`);
          if (hash(username + mi) % 3 === 0 || seed % 5 === 0) continue;
          const count = Math.max(1, Math.round(40 * day * weight * (1.4 - mi * 0.15) * (0.5 + (seed % 100) / 100)));
          const tokenUsed = count * (8000 + (seed % 9000));
          const quota = Math.round(tokenUsed * (mi < 2 ? 2.2 : 0.9) * (group === 'vip' ? 0.9 : 1));
          rows.push({ user_id: uid, username, use_group: group, model_name: NA_MODELS[mi], created_at: t,
            channel_id: mi < 3 ? 1 : 2, token_used: tokenUsed, count, quota });
        }
      }
    }
    return rows;
  }
  function sum(rows, keyFn, pick) {
    const m = new Map();
    for (const r of rows) {
      const k = keyFn(r);
      const a = m.get(k) || { ...pick(r), count: 0, quota: 0, token_used: 0 };
      a.count += r.count; a.quota += r.quota; a.token_used += r.token_used; m.set(k, a);
    }
    return [...m.values()];
  }

  function newapi(path, query, token) {
    const ok = (data) => ({ status: 200, data: { success: true, message: '', data } });
    if (path === '/api/status') return ok({ quota_per_unit: 500000, display_in_currency: true, usd_exchange_rate: 7.3, enable_data_export: true });
    if (!/^nap_\w+$|^[a-zA-Z0-9]{32}$/.test(token || '')) return { status: 401, data: { success: false, message: '无效的访问令牌（演示模式请填 nap_ 开头的任意字符）' } };
    const st = Number(query.get('start_timestamp')) || 0, et = Number(query.get('end_timestamp')) || Math.floor(Date.now() / 1000);
    if (path === '/api/data/users') return ok(sum(naRows(st, et), (r) => r.username + '|' + r.created_at, (r) => ({ username: r.username, created_at: r.created_at })));
    if (path === '/api/data/') {
      const u = query.get('username');
      const rows = naRows(st, et).filter((r) => !u || r.username === u);
      const pick = (r) => u
        ? { user_id: r.user_id, username: r.username, model_name: r.model_name, created_at: r.created_at }
        : { model_name: r.model_name, created_at: r.created_at };
      return ok(sum(rows, (r) => r.model_name + '|' + r.created_at, pick));
    }
    if (path === '/api/data/flow') {
      if (!(st > 0) || !(et > 0)) return { status: 200, data: { success: false, message: 'invalid start_timestamp' } };
      const rows = sum(naRows(st, et), (r) => [r.user_id, r.use_group, r.model_name, r.channel_id].join('|'),
        (r) => ({ user_id: r.user_id, username: r.username, use_group: r.use_group, model_name: r.model_name, channel_id: r.channel_id, channel_name: r.channel_id === 1 ? '百度-主' : '百度-备' }));
      return ok(rows.sort((a, b) => b.quota - a.quota));
    }
    if (path === '/api/user/') {
      const p = Number(query.get('p') || 1), size = Math.min(100, Number(query.get('page_size') || 10));
      const items = NA_USERS.map(([id, username, display_name, group, role, quota]) => ({
        id, username, display_name, group, role, status: id === 8 ? 2 : 1, quota,
        used_quota: 2e8 + id * 1e7, request_count: 1000 * id, created_at: 1780000000 + id * 86400,
      }));
      return ok({ page: p, page_size: size, total: items.length, items: items.slice((p - 1) * size, p * size) });
    }
    if (path === '/api/log/stat') return ok({ quota: 0, rpm: 12, tpm: 98000 });
    return { status: 404, data: { success: false, message: 'not found' } };
  }

  root.Demo = { baidu, newapi };
  if (typeof module !== 'undefined') module.exports = root.Demo;
})(typeof window !== 'undefined' ? window : globalThis);
