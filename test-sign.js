// 用百度云官方文档「生成认证字符串」里的完整示例校验 AK/SK 签名实现。
// 来源：https://cloud.baidu.com/doc/Reference/s/njwvz1yfu
// 运行：node test-sign.js
const assert = require('assert');
const { bceSignature } = require('./server.js');

const r = bceSignature({
  ak: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  sk: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  timestamp: '2015-04-27T08:23:49Z',
  expire: 1800,
  method: 'PUT',
  pathname: '/v1/test/myfolder/readme.txt',
  searchParams: new URLSearchParams('partNumber=9&uploadId=a44cc9bab11cbd156984767aad637851'),
  signHeaders: {
    Host: 'bj.bcebos.com',
    'Content-Type': 'text/plain',
    'Content-Length': '8',
    'Content-Md5': 'NFzcPqhviddjRNnSOGo4rw==',
    'x-bce-date': '2015-04-27T08:23:49Z',
  },
});

assert.strictEqual(r.canonicalRequest, [
  'PUT',
  '/v1/test/myfolder/readme.txt',
  'partNumber=9&uploadId=a44cc9bab11cbd156984767aad637851',
  'content-length:8',
  'content-md5:NFzcPqhviddjRNnSOGo4rw%3D%3D',
  'content-type:text%2Fplain',
  'host:bj.bcebos.com',
  'x-bce-date:2015-04-27T08%3A23%3A49Z',
].join('\n'));
assert.strictEqual(r.signingKey, '1d5ce5f464064cbee060330d973218821825ac6952368a482a592e6615aef479');
assert.strictEqual(r.signature, 'd74a04362e6a848f5b39b15421cb449427f419c95a480fd6b8cf9fc783e2999e');
console.log('BCE V1 签名与百度官方示例一致 ✔');
