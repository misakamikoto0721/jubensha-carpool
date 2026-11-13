const domain = require('../domain')
const users = require('../users')
const linkAccount = require('../linkAccount')

module.exports = async function bindUid(event, cloud) {
  const profile = domain.validateProfile(event && event.studentId, event && event.name)
  if (!profile.ok) return profile

  const openid = users.currentOpenId(cloud)
  if (!openid) {
    return { ok: false, reason: 'no_openid', message: '没有拿到微信登录态，请在模拟器或手机里打开后再试' }
  }

  return linkAccount(cloud.database(), {
    openid: openid,
    provider: users.providerOf(event),
    studentId: profile.studentId,
    name: profile.name,
    now: Date.now()
  })
}
