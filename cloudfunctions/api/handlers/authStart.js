const crypto = require('crypto')
const ustcAuth = require('../ustcAuth')
const users = require('../users')

module.exports = async function authStart(event, cloud) {
  const openid = users.currentOpenId(cloud)
  if (!openid) {
    return { ok: false, reason: 'no_openid', message: '没有拿到微信登录态，请在模拟器或手机里打开后再试' }
  }
  if (!ustcAuth.isConfigured()) {
    return { ok: true, configured: false, mode: 'student_id' }
  }

  const db = cloud.database()
  const now = Date.now()
  const state = crypto.randomBytes(16).toString('hex')
  await db.collection('oauth_states').doc(state).set({
    data: {
      openid: openid,
      created_at: now,
      expires_at: now + ustcAuth.STATE_TTL_MS
    }
  })

  return {
    ok: true,
    configured: true,
    mode: 'ustc',
    state: state,
    expiresAt: now + ustcAuth.STATE_TTL_MS,
    authorizeUrl: ustcAuth.buildAuthorizeUrl(state)
  }
}
