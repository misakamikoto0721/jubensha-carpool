const users = require('../users')
const ustcAuth = require('../ustcAuth')

module.exports = async function login(event, cloud) {
  const db = cloud.database()
  const now = Date.now()
  const openid = users.currentOpenId(cloud)
  if (!openid) {
    return { ok: false, reason: 'no_openid', message: '没有拿到微信登录态，请在模拟器或手机里打开后再试' }
  }
  const loaded = await users.requireUser(db, cloud, now)
  if (!loaded.ok) return loaded
  const auth = ustcAuth.publicStatus()
  if (!loaded.user) return { ok: true, bound: false, auth: auth }
  return { ok: true, bound: true, user: users.presentUser(loaded.user), auth: auth }
}
