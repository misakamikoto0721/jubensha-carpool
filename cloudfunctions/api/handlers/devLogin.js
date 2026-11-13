const devUser = require('../devUser')
const users = require('../users')

module.exports = async function devLogin(event, cloud) {
  const accountResult = devUser.readAccount()
  if (!accountResult.ok) return accountResult
  const account = accountResult.account

  const openid = users.currentOpenId(cloud)
  if (!openid) {
    return { ok: false, reason: 'no_openid', message: '没有拿到微信登录态，请在模拟器或手机里打开后再试' }
  }

  const db = cloud.database()
  const now = Date.now()
  const provider = users.providerOf(event)
  await users.ensureCollection(db, 'users')
  await users.ensureCollection(db, 'auth_identities')

  let user = await users.findUserByUid(db, account.id)
  if (!user) {
    const added = await db.collection('users').add({
      data: {
        uid: account.id,
        student_id: account.studentId,
        gid: null,
        name: account.name,
        role: account.role,
        credit_status: 'normal',
        ban_until: null,
        no_show_count: 0,
        created_at: now
      }
    })
    user = {
      _id: added._id,
      uid: account.id,
      student_id: account.studentId,
      name: account.name,
      role: account.role,
      credit_status: 'normal',
      ban_until: null,
      no_show_count: 0
    }
  } else {
    await db.collection('users').doc(user._id).update({
      data: {
        student_id: account.studentId,
        name: account.name,
        role: account.role
      }
    })
    user.student_id = account.studentId
    user.name = account.name
    user.role = account.role
  }

  const identity = await users.findIdentity(db, openid)
  if (identity) {
    await db.collection('auth_identities').doc(identity._id).update({
      data: { uid: account.id, provider: provider, bound_at: now }
    })
  } else {
    await db.collection('auth_identities').add({
      data: {
        provider: provider,
        openid: openid,
        uid: account.id,
        bound_at: now
      }
    })
  }

  return {
    ok: true,
    bound: true,
    devLogin: true,
    user: users.presentUser(user)
  }
}
