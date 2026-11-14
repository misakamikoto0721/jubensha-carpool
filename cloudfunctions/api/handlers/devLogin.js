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

  const identity = await users.findIdentity(db, openid)
  const holders = await users.safeList(
    db.collection('auth_identities').where({ uid: account.id }).limit(100).get()
  )
  const decision = devUser.assignDevLogin({
    openid: openid,
    configuredId: account.id,
    identity: identity,
    holders: holders
  })

  if (decision.action === 'keep') {
    const existing = await users.findUserByUid(db, decision.uid)
    if (existing) return { ok: true, bound: true, devLogin: true, user: users.presentUser(existing) }
  }

  const chosen = decision.action === 'configured' ? account : await firstFreeGuest(db)
  if (!chosen) return { ok: false, reason: 'dev_login_full', message: '临时账号已经发完' }

  const user = await upsertAccount(db, chosen, now, decision.action === 'configured')
  await bindOpenId(db, identity, openid, user.uid, provider, now)
  return { ok: true, bound: true, devLogin: true, user: users.presentUser(user) }
}

async function firstFreeGuest(db) {
  for (let index = 2; index < 200; index += 1) {
    const guest = devUser.guestAccount(index)
    const existing = await users.findUserByUid(db, guest.id)
    if (!existing) return guest
  }
  return null
}

async function upsertAccount(db, account, now, refreshRole) {
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
    return {
      _id: added._id,
      uid: account.id,
      student_id: account.studentId,
      name: account.name,
      role: account.role,
      credit_status: 'normal',
      ban_until: null,
      no_show_count: 0
    }
  }
  if (refreshRole) {
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
  return user
}

async function bindOpenId(db, identity, openid, uid, provider, now) {
  if (identity) {
    await db.collection('auth_identities').doc(identity._id).update({
      data: { uid: uid, provider: provider, bound_at: identity.bound_at || now }
    })
    return
  }
  await db.collection('auth_identities').add({
    data: {
      provider: provider,
      openid: openid,
      uid: uid,
      bound_at: now
    }
  })
}
