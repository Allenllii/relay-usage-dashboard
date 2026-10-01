// 模型清单（接口文档附录 A）：[系列, 端点编码, 模型名]。新模型上线时在这里追加。
// 浏览器和 server.js 共用这一份。
const MODELS = [
  ['bce', 'bce-fe-e0', 'claude-fable-5'], ['bce', 'bce-hu-d5', 'claude-haiku-4-5-20251001'], ['bce', 'bce-os-d5', 'claude-opus-4-5-20251101'],
  ['bce', 'bce-os-d6', 'claude-opus-4-6'], ['bce', 'bce-os-d7', 'claude-opus-4-7'], ['bce', 'bce-os-d8', 'claude-opus-4-8'],
  ['bce', 'bce-os-e0', 'claude-opus-5'], ['bce', 'bce-st-d5', 'claude-sonnet-4-5-20250929'], ['bce', 'bce-st-d6', 'claude-sonnet-4-6'],
  ['bce', 'bce-st-e0', 'claude-sonnet-5'],
  ['bpt', 'bpt-do', 'gpt-4o'], ['bpt', 'bpt-do-mini', 'gpt-4o-mini'], ['bpt', 'bpt-e', 'gpt-5'], ['bpt', 'bpt-e3-cx', 'gpt-5.3-codex'],
  ['bpt', 'bpt-e4', 'gpt-5.4'], ['bpt', 'bpt-e4-mi', 'gpt-5.4-mini'], ['bpt', 'bpt-e4-no', 'gpt-5.4-nano'], ['bpt', 'bpt-e4-po', 'gpt-5.4-pro'],
  ['bpt', 'bpt-e5', 'gpt-5.5'], ['bpt', 'bpt-e6-luna', 'gpt-5.6-luna'], ['bpt', 'bpt-e6-sol', 'gpt-5.6-sol'], ['bpt', 'bpt-e6-terra', 'gpt-5.6-terra'],
  ['deepseek', 'deepseek-r1', 'deepseek-r1-250528'], ['deepseek', 'deepseek-v3', 'deepseek-v3'], ['deepseek', 'deepseek-v3.1', 'deepseek-v3.1'],
  ['deepseek', 'deepseek-v3.2', 'deepseek-v3.2'], ['deepseek', 'deepseek-v4-flash', 'deepseek-v4-flash'], ['deepseek', 'deepseek-v4-flash-0731', 'deepseek-v4-flash-0731'],
  ['deepseek', 'deepseek-v4-pro', 'deepseek-v4-pro'], ['deepseek', 'deepseek-v4-pro-0813', 'deepseek-v4-pro-0813'],
  ['qwen', 'qwen-3.5', 'qwen3.5-397b-a17b'], ['qwen', 'qwen-3.5-plus', 'qwen3.5-plus'], ['qwen', 'qwen-3.6', 'qwen3.6-35b-a3b'],
  ['glm', 'glm-5', 'glm-5'], ['glm', 'glm-5.1', 'glm-5.1'], ['glm', 'glm-5.2', 'glm-5.2'], ['glm', 'glm-5.3', 'glm-5.3'],
  ['kimi', 'kimi-k2.5', 'kimi-k2.5'], ['kimi', 'kimi-k2.6', 'kimi-k2.6'], ['kimi', 'kimi-k2.7-code', 'kimi-k2.7-code'], ['kimi', 'kimi-k3', 'kimi-k3'],
  ['seedance', 'seedance-2.0', 'doubao-seedance-2-0-260128'], ['seedance', 'seedance-2.0-fast', 'doubao-seedance-2-0-fast-260128'],
  ['seedance', 'seedance-2.0-mini', 'doubao-seedance-2-0-mini-260615'], ['seedance', 'seedance-2.5', 'doubao-seedance-2-5-260628'],
  ['text', 'text-embedding-v4', 'text-embedding-v4'],
];
if (typeof module !== 'undefined') module.exports = MODELS;
