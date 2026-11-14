const domain = require('../domain')
const errors = require('../errors')
const users = require('../users')

module.exports = async function completeSession(event, cloud) {
  const db = cloud.database()
  const now = Date.now()
  const sessionId = String((event && event.sessionId) || '')
  if (!sessionId) return { ok: false, reason: 'not_found', message: '车次不存在' }

  const loaded = await users.requireUser(db, cloud, now)
  if (!loaded.ok) return loaded
  if (!loaded.user) return { ok: false, reason: 'unbound', message: '登录后才能完成车次' }

  let session
  try {
    const snap = await db.collection('sessions').doc(sessionId).get()
    session = snap.data
  } catch (err) {
    if (users.isMissingCollection(err)) {
      return { ok: false, reason: 'not_found', message: '车次不存在' }
    }
    throw err
  }
  if (!session) return { ok: false, reason: 'not_found', message: '车次不存在' }
  const userMap = await users.loadUsersByUids(db, db.command, session.member_uids || [])

  try {
    const settled = await db.runTransaction(async (transaction) => {
      const sessionSnap = await transaction.collection('sessions').doc(sessionId).get()
      const session = sessionSnap.data
      if (!session) errors.raise('not_found', '车次不存在')
      if (!domain.canManageSession(loaded.user, session)) {
        errors.raise('forbidden', '只有本场 DM 或管理员可以完成这场')
      }
      if (session.status === 'completed') errors.raise('completed', '这场已经完成')
      if (Number(session.start_time) > now) errors.raise('not_started', '还没到开车时间')
      if (!domain.needsMark(session, now)) errors.raise('closed', '这场不能在这里完成')

      const members = session.member_uids || []
      const scriptName = session.script_name
      for (let index = 0; index < members.length; index += 1) {
        const uid = members[index]
        const found = userMap[uid]
        if (!found) errors.raise('missing_user', '找不到学号 ' + uid)
        const freshSnap = await transaction.collection('users').doc(found._id).get()
        const fresh = freshSnap.data
        if (!fresh) errors.raise('missing_user', '找不到学号 ' + uid)
        await transaction.collection('users').doc(found._id).update({
          data: { played_scripts: domain.withPlayedScript(fresh, scriptName) }
        })
        const signupRef = transaction.collection('signups').doc(domain.signupDocId(sessionId, uid))
        const signup = await readSignup(signupRef)
        if (signup && signup.status === 'joined') {
          await signupRef.update({ data: { status: 'attended' } })
        }
      }
      await transaction.collection('sessions').doc(sessionId).update({
        data: { status: 'completed', completed_at: now }
      })
      return members.length
    })
    return { ok: true, settled: settled }
  } catch (err) {
    const response = errors.toResponse(err)
    if (response) return response
    throw err
  }
}

async function readSignup(ref) {
  try {
    const snap = await ref.get()
    return snap.data || null
  } catch (err) {
    const msg = String((err && (err.message || err.errMsg)) || '')
    if (msg.indexOf('does not exist') >= 0 || msg.indexOf('不存在') >= 0) return null
    throw err
  }
}
