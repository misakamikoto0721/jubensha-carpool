const https = require('https')

const AUTHORIZE_URL = 'https://id.ustc.edu.cn/cas/oauth2.0/authorize'
const TOKEN_URL = 'https://id.ustc.edu.cn/cas/oauth2.0/accessToken'
const PROFILE_URL = 'https://id.ustc.edu.cn/cas/oauth2.0/profile'
const SCOPE = 'gid email name'
const STATE_TTL_MS = 10 * 60 * 1000

function readConfig(env) {
  const source = env || process.env || {}
  return {
    clientId: String(source.USTC_CLIENT_ID || '').trim(),
    clientSecret: String(source.USTC_CLIENT_SECRET || '').trim(),
    redirectUri: String(source.USTC_REDIRECT_URI || '').trim()
  }
}

function isConfigured(env) {
  const cfg = readConfig(env)
  return !!(cfg.clientId && cfg.clientSecret && cfg.redirectUri)
}

function publicStatus(env) {
  const configured = isConfigured(env)
  return {
    configured: configured,
    mode: configured ? 'ustc' : 'student_id'
  }
}

function buildAuthorizeUrl(state, env) {
  const cfg = readConfig(env)
  const query = [
    ['response_type', 'code'],
    ['client_id', cfg.clientId],
    ['redirect_uri', cfg.redirectUri],
    ['scope', SCOPE],
    ['state', state]
  ].map((pair) => pair[0] + '=' + encodeURIComponent(pair[1])).join('&')
  return AUTHORIZE_URL + '?' + query
}

function formBody(fields) {
  return Object.keys(fields).map((key) => {
    return key + '=' + encodeURIComponent(fields[key] == null ? '' : String(fields[key]))
  }).join('&')
}

function postForm(url, fields) {
  const body = formBody(fields)
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const req = https.request({
      protocol: target.protocol,
      hostname: target.hostname,
      path: target.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        let json = null
        try {
          json = JSON.parse(text)
        } catch (err) {
          json = null
        }
        resolve({ status: res.statusCode, json: json })
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function cleanId(value) {
  return String(value || '').trim().toUpperCase()
}

function parseProfile(body) {
  const profile = body || {}
  const attributes = profile.attributes || {}
  if (profile.active === false) {
    return { ok: false, reason: 'profile_inactive', message: '统一认证没有返回有效身份' }
  }
  const studentId = cleanId(profile.id || attributes.zjhm || attributes.login)
  const gid = cleanId(attributes.gid)
  const uid = studentId || gid
  const name = String(attributes.name || '').trim()
  if (!uid) {
    return { ok: false, reason: 'profile_incomplete', message: '统一认证没有返回学工号或 GID' }
  }
  if (!name) {
    return { ok: false, reason: 'profile_incomplete', message: '统一认证没有返回姓名' }
  }
  return {
    ok: true,
    uid: uid,
    studentId: studentId || gid,
    gid: gid,
    name: name
  }
}

async function exchangeCode(code, env, deps) {
  const cfg = readConfig(env)
  if (!isConfigured(env)) {
    return { ok: false, reason: 'oauth_unconfigured', message: '统一认证还没配置' }
  }
  const send = (deps && deps.postForm) || postForm
  const tokenRes = await send(TOKEN_URL, {
    grant_type: 'authorization_code',
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    code: code
  })
  const accessToken = tokenRes.json && tokenRes.json.access_token
  if (!accessToken) {
    return { ok: false, reason: 'token_failed', message: '统一认证没有发回访问令牌，请重新登录' }
  }
  const profileRes = await send(PROFILE_URL, { access_token: accessToken })
  if (!profileRes.json) {
    return { ok: false, reason: 'profile_failed', message: '统一认证没有发回身份信息' }
  }
  return parseProfile(profileRes.json)
}

module.exports = {
  AUTHORIZE_URL: AUTHORIZE_URL,
  TOKEN_URL: TOKEN_URL,
  PROFILE_URL: PROFILE_URL,
  STATE_TTL_MS: STATE_TTL_MS,
  readConfig: readConfig,
  isConfigured: isConfigured,
  publicStatus: publicStatus,
  buildAuthorizeUrl: buildAuthorizeUrl,
  parseProfile: parseProfile,
  exchangeCode: exchangeCode
}
