const config = require('./config')
const domain = require('./domain')

function currentOpenId(cloud) {
  const ctx = cloud.getWXContext()
  return (ctx && ctx.OPENID) || ''
}

function providerOf(event) {
  return event && event.provider === 'qq' ? 'qq' : 'wechat'
}

function isMissingCollection(err) {
  const msg = String((err && (err.errMsg || err.message)) || '')
  const code = Number(err && err.errCode)
  return msg.indexOf('not exist') >= 0 || msg.indexOf('DATABASE_COLLECTION_NOT_EXIST') >= 0 || msg.indexOf('不存在') >= 0 || code === -502005
}

function isListedAdmin(studentId) {
  const target = domain.normalizeStudentId(studentId)
  return (config.adminStudentIds || []).some((item) => domain.normalizeStudentId(item) === target)
}

async function safeList(promise) {
  try {
    const result = await promise
    return (result && result.data) || []
  } catch (err) {
    if (isMissingCollection(err)) return []
    throw err
  }
}

async function findIdentity(db, openid) {
  const rows = await safeList(db.collection('auth_identities').where({ openid: openid }).limit(1).get())
  return rows[0] || null
}

async function findUserByUid(db, uid) {
  const rows = await safeList(db.collection('users').where({ uid: uid }).limit(1).get())
  return rows[0] || null
}

async function findUserByLoginId(db, id) {
  const normalized = domain.normalizeStudentId(id)
  const byUid = await findUserByUid(db, normalized)
  if (byUid) return byUid
  const rows = await safeList(db.collection('users').where({ student_id: normalized }).limit(1).get())
  return rows[0] || null
}

async function clearExpiredBan(db, user, now) {
  if (!user) return user
  if (user.credit_status === 'restricted' && user.ban_until && user.ban_until <= now) {
    await db.collection('users').doc(user._id).update({
      data: { credit_status: 'normal', ban_until: null }
    })
    user.credit_status = 'normal'
    user.ban_until = null
  }
  return user
}

async function promoteConfiguredAdmin(db, user) {
  if (!user || user.role === 'admin' || !isListedAdmin(user.uid)) return user
  await db.collection('users').doc(user._id).update({ data: { role: 'admin' } })
  user.role = 'admin'
  return user
}

function presentUser(user) {
  if (!user) return null
  return {
    uid: user.uid,
    studentId: user.student_id || user.uid,
    name: user.name,
    role: user.role || 'player',
    creditStatus: user.credit_status || 'normal',
    banUntil: user.ban_until || null,
    noShowCount: user.no_show_count || 0
  }
}

async function loadUsersByUids(db, _, uids) {
  const unique = []
  const seen = {}
  uids.forEach((uid) => {
    if (uid && !seen[uid]) {
      seen[uid] = true
      unique.push(uid)
    }
  })
  const map = {}
  for (let index = 0; index < unique.length; index += 10) {
    const chunk = unique.slice(index, index + 10)
    const rows = await safeList(db.collection('users').where({ uid: _.in(chunk) }).get())
    rows.forEach((user) => {
      map[user.uid] = user
    })
  }
  return map
}

async function requireUser(db, cloud, now) {
  const openid = currentOpenId(cloud)
  if (!openid) {
    return { ok: false, reason: 'no_openid', message: '没有拿到微信登录态，请在模拟器或手机里打开后再试' }
  }
  const identity = await findIdentity(db, openid)
  if (!identity) return { ok: true, openid: openid, user: null }
  let user = await findUserByUid(db, identity.uid)
  if (!user) return { ok: true, openid: openid, user: null, identity: identity }
  user = await clearExpiredBan(db, user, now)
  user = await promoteConfiguredAdmin(db, user)
  return { ok: true, openid: openid, user: user, identity: identity }
}

module.exports = {
  currentOpenId: currentOpenId,
  providerOf: providerOf,
  isMissingCollection: isMissingCollection,
  isListedAdmin: isListedAdmin,
  safeList: safeList,
  findIdentity: findIdentity,
  findUserByUid: findUserByUid,
  findUserByLoginId: findUserByLoginId,
  clearExpiredBan: clearExpiredBan,
  presentUser: presentUser,
  loadUsersByUids: loadUsersByUids,
  requireUser: requireUser
}
