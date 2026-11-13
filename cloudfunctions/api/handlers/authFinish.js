const ustcAuth = require('../ustcAuth')
const users = require('../users')
const linkAccount = require('../linkAccount')

module.exports = async function authFinish(event, cloud) {
  if (!ustcAuth.isConfigured()) {
    return { ok: false, reason: 'oauth_unconfigured', message: '统一认证还没配置' }
  }

  const openid = users.currentOpenId(cloud)
  if (!openid) {
    return { ok: false, reason: 'no_openid', message: '没有拿到微信登录态，请在模拟器或手机里打开后再试' }
  }

  const code = String((event && event.code) || '').trim()
  const state = String((event && event.state) || '').trim()
  if (code.length < 4 || code.length > 512 || !/^[A-Za-z0-9_-]+$/.test(state)) {
    return { ok: false, reason: 'bad_state', message: '登录回调不完整，请重新发起科大登录' }
  }

  const db = cloud.database()
  const now = Date.now()
  let saved = null
  try {
    const snap = await db.collection('oauth_states').doc(state).get()
    saved = snap.data
  } catch (err) {
    saved = null
  }
  if (!saved || saved.openid !== openid) {
    return { ok: false, reason: 'bad_state', message: '登录状态无效，请重新发起科大登录' }
  }
  if (saved.expires_at < now) {
    await db.collection('oauth_states').doc(state).remove()
    return { ok: false, reason: 'state_expired', message: '登录已过期，请重新发起科大登录' }
  }
  await db.collection('oauth_states').doc(state).remove()

  const profile = await ustcAuth.exchangeCode(code)
  if (!profile.ok) return profile

  return linkAccount(db, {
    openid: openid,
    provider: users.providerOf(event),
    studentId: profile.studentId,
    name: profile.name,
    gid: profile.gid,
    now: now
  })
}
