const domain = require('../domain')
const errors = require('../errors')
const users = require('../users')

module.exports = async function joinSession(event, cloud) {
  const db = cloud.database()
  const now = Date.now()
  const sessionId = String((event && event.sessionId) || '')
  if (!sessionId) return { ok: false, reason: 'not_found', message: '车次不存在' }

  const loaded = await users.requireUser(db, cloud, now)
  if (!loaded.ok) return loaded
  if (!loaded.user) return { ok: false, reason: 'unbound', message: '绑定学号后才能上车' }

  try {
    return await db.runTransaction(async (transaction) => {
      const sessionSnap = await transaction.collection('sessions').doc(sessionId).get()
      const session = sessionSnap.data
      if (!session) errors.raise('not_found', '车次不存在')
      const userSnap = await transaction.collection('users').doc(loaded.user._id).get()
      if (!userSnap.data) errors.raise('missing_user', '找不到当前用户，请重新绑定学号')
      const signupRef = transaction.collection('signups').doc(domain.signupDocId(sessionId, loaded.user.uid))
      const signup = await readOptional(signupRef)
      const members = (session.member_uids || []).slice()
      if (signup && signup.status === 'joined' && members.indexOf(loaded.user.uid) >= 0) {
        return {
          ok: true,
          idempotent: true,
          joinedCount: session.joined_count || members.length,
          capacity: session.capacity
        }
      }
      errors.fromResult(domain.decideJoin({ user: userSnap.data, session: session, now: now }))
      if (members.indexOf(loaded.user.uid) < 0) members.push(loaded.user.uid)
      const joinedCount = members.length
      const status = joinedCount >= session.capacity ? 'full' : 'open'
      if (signup) {
        await signupRef.update({
          data: { status: 'joined', created_at: now }
        })
      } else {
        await signupRef.set({
          data: {
            session_id: sessionId,
            uid: loaded.user.uid,
            status: 'joined',
            created_at: now
          }
        })
      }
      await transaction.collection('sessions').doc(sessionId).update({
        data: {
          member_uids: members,
          joined_count: joinedCount,
          status: status
        }
      })
      return { ok: true, joinedCount: joinedCount, capacity: session.capacity }
    })
  } catch (err) {
    const response = errors.toResponse(err)
    if (response) return response
    throw err
  }
}

async function readOptional(ref) {
  try {
    const snap = await ref.get()
    return snap.data || null
  } catch (err) {
    const msg = String((err && (err.message || err.errMsg)) || '')
    if (msg.indexOf('does not exist') >= 0 || msg.indexOf('不存在') >= 0) return null
    throw err
  }
}
