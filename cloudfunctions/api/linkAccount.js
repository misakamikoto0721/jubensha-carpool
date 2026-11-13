const domain = require('./domain')
const users = require('./users')

async function linkAccount(db, options) {
  const openid = options.openid
  const provider = options.provider === 'qq' ? 'qq' : 'wechat'
  const studentId = options.studentId
  const name = options.name
  const now = options.now
  const gid = options.gid || ''
  const identity = await users.findIdentity(db, openid)

  if (identity && identity.uid === studentId) {
    const current = await users.findUserByUid(db, studentId)
    if (!current) return { ok: false, reason: 'missing_user', message: '绑定记录不完整，请联系管理员核对数据库' }
    const patch = { name: name }
    if (gid) patch.gid = gid
    await db.collection('users').doc(current._id).update({ data: patch })
    current.name = name
    if (gid) current.gid = gid
    return { ok: true, bound: true, user: users.presentUser(current) }
  }

  if (identity && identity.uid !== studentId) {
    const movable = await canRetarget(db, identity)
    if (!movable) {
      return {
        ok: false,
        reason: 'bound_elsewhere',
        message: '这个微信已经绑定了学号 ' + identity.uid + '。有报名或爽约记录后不能自行修改。'
      }
    }
  }

  const existing = await users.findUserByUid(db, studentId)
  let becameAdmin = false
  let user = existing

  if (!existing) {
    const carryAdmin = identity ? await wasOnlyAdmin(db, identity.uid) : false
    let isFirst = false
    if (!carryAdmin) {
      try {
        const count = await db.collection('users').count()
        isFirst = !count.total
      } catch (err) {
        if (!users.isMissingCollection(err)) throw err
        isFirst = true
      }
    }
    const role = domain.resolveRole({
      listedAdmin: users.isListedAdmin(studentId),
      carryAdmin: carryAdmin,
      isFirst: isFirst
    })
    becameAdmin = role === 'admin'
    const added = await db.collection('users').add({
      data: {
        uid: studentId,
        student_id: studentId,
        gid: gid || null,
        name: name,
        role: role,
        credit_status: 'normal',
        ban_until: null,
        no_show_count: 0,
        created_at: now
      }
    })
    user = {
      _id: added._id,
      uid: studentId,
      student_id: studentId,
      gid: gid || null,
      name: name,
      role: role,
      credit_status: 'normal',
      ban_until: null,
      no_show_count: 0
    }
  } else {
    const patch = {}
    if (users.isListedAdmin(studentId) && existing.role !== 'admin') {
      patch.role = 'admin'
      existing.role = 'admin'
      becameAdmin = true
    }
    if (existing.name !== name) patch.name = name
    if (gid && existing.gid !== gid) patch.gid = gid
    if (Object.keys(patch).length) {
      await db.collection('users').doc(existing._id).update({ data: patch })
      existing.name = name
      if (gid) existing.gid = gid
    }
  }

  if (identity) {
    await db.collection('auth_identities').doc(identity._id).update({
      data: { uid: studentId, provider: provider, bound_at: now }
    })
    const oldUser = await users.findUserByUid(db, identity.uid)
    if (oldUser && oldUser.uid !== studentId) {
      if (oldUser.role === 'admin' && user.role !== 'admin') {
        const admins = await db.collection('users').where({ role: 'admin' }).count()
        if (admins.total <= 1) {
          await db.collection('users').doc(user._id).update({ data: { role: 'admin' } })
          user.role = 'admin'
          becameAdmin = true
        }
      }
      const left = await users.safeList(db.collection('auth_identities').where({ uid: oldUser.uid }).limit(1).get())
      if (!left.length) await db.collection('users').doc(oldUser._id).remove()
    }
  } else {
    await db.collection('auth_identities').add({
      data: {
        provider: provider,
        openid: openid,
        uid: studentId,
        bound_at: now
      }
    })
  }

  return {
    ok: true,
    bound: true,
    becameAdmin: becameAdmin,
    user: users.presentUser(user)
  }
}

async function canRetarget(db, identity) {
  const signups = await users.safeList(db.collection('signups').where({ uid: identity.uid }).limit(1).get())
  if (signups.length) return false
  const user = await users.findUserByUid(db, identity.uid)
  if (user && user.no_show_count > 0) return false
  const identities = await users.safeList(db.collection('auth_identities').where({ uid: identity.uid }).get())
  return identities.every((item) => item._id === identity._id)
}

async function wasOnlyAdmin(db, uid) {
  const user = await users.findUserByUid(db, uid)
  return !!(user && user.role === 'admin')
}

module.exports = linkAccount
