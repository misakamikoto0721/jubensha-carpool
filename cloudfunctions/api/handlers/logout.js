const users = require('../users')

module.exports = async function logout(event, cloud) {
  const openid = users.currentOpenId(cloud)
  if (!openid) {
    return { ok: false, reason: 'no_openid', message: '没有拿到微信登录态，请在模拟器或手机里打开后再试' }
  }
  const db = cloud.database()
  const identity = await users.findIdentity(db, openid)
  if (identity) {
    await db.collection('auth_identities').doc(identity._id).remove()
  }
  return { ok: true }
}
