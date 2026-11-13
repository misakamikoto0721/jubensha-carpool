const test = require('node:test')
const assert = require('node:assert/strict')
const ustcAuth = require('../cloudfunctions/api/ustcAuth')

const env = {
  USTC_CLIENT_ID: 'oauth_test_client_id',
  USTC_CLIENT_SECRET: 'secret-value',
  USTC_REDIRECT_URI: 'https://webapp.ustc.edu.cn/callback'
}

const profileBody = {
  active: true,
  id: '45433',
  attributes: {
    gid: '9202420483',
    name: '张三',
    email: 'zhangsan@mail.ustc.edu.cn',
    zjhm: '45433'
  }
}

test('authorize url follows the USTC code flow', () => {
  const url = new URL(ustcAuth.buildAuthorizeUrl('abc123', env))
  assert.equal(url.origin + url.pathname, ustcAuth.AUTHORIZE_URL)
  assert.equal(url.searchParams.get('response_type'), 'code')
  assert.equal(url.searchParams.get('client_id'), 'oauth_test_client_id')
  assert.equal(url.searchParams.get('redirect_uri'), env.USTC_REDIRECT_URI)
  assert.equal(url.searchParams.get('scope'), 'gid email name')
  assert.equal(url.searchParams.get('state'), 'abc123')
  assert.equal(url.searchParams.get('client_secret'), null)
})

test('credentials stay unconfigured until all three values exist', () => {
  assert.equal(ustcAuth.isConfigured({}), false)
  assert.equal(ustcAuth.isConfigured({ USTC_CLIENT_ID: 'a', USTC_CLIENT_SECRET: 'b' }), false)
  assert.equal(ustcAuth.publicStatus(env).mode, 'ustc')
})

test('profile uses the verified student number as uid and keeps gid', () => {
  const parsed = ustcAuth.parseProfile(profileBody)
  assert.equal(parsed.ok, true)
  assert.equal(parsed.uid, '45433')
  assert.equal(parsed.studentId, '45433')
  assert.equal(parsed.gid, '9202420483')
  assert.equal(parsed.name, '张三')
})

test('exchange posts the code, then the access token', async () => {
  const calls = []
  const result = await ustcAuth.exchangeCode('OC-9-code', env, {
    postForm: async (url, fields) => {
      calls.push({ url: url, fields: fields })
      if (url === ustcAuth.TOKEN_URL) {
        return { status: 200, json: { access_token: 'AT-98', token_type: 'bearer', expires_in: 28800 } }
      }
      return { status: 200, json: profileBody }
    }
  })
  assert.equal(result.studentId, '45433')
  assert.equal(calls[0].url, ustcAuth.TOKEN_URL)
  assert.equal(calls[0].fields.grant_type, 'authorization_code')
  assert.equal(calls[0].fields.client_secret, 'secret-value')
  assert.equal(calls[0].fields.redirect_uri, env.USTC_REDIRECT_URI)
  assert.equal(calls[0].fields.code, 'OC-9-code')
  assert.equal(calls[1].url, ustcAuth.PROFILE_URL)
  assert.equal(calls[1].fields.access_token, 'AT-98')
  assert.equal(calls[1].fields.client_secret, undefined)
})

test('missing credentials do not call the identity server', async () => {
  let called = false
  const result = await ustcAuth.exchangeCode('OC-9-code', {}, {
    postForm: async () => {
      called = true
      return { status: 200, json: {} }
    }
  })
  assert.equal(called, false)
  assert.equal(result.reason, 'oauth_unconfigured')
})
