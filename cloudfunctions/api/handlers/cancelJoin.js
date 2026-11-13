const domain = require('../domain')
const errors = require('../errors')
const users = require('../users')

module.exports = async function cancelJoin(event, cloud) {
  const db = cloud.database()
  const now = Date.now()
  const sessionId = String((event && event.sessionId) || '')
  if (!sessionId) return { ok: false, reason: 'not_found', message: '车次不存在' }

  const loaded = await users.requireUser(db, cloud, now)
  if (!loaded.ok) return loaded
  if (!loaded.user) return { ok: false, reason: 'unbound', message: '绑定学号后才能取消' }

  try {
    return await db.runTransaction(async (transaction) => {
      const sessionSnap = await transaction.collection('sessions').doc(sessionId).get()
      const session = sessionSnap.data
      if (!session) errors.raise('not_found', '车次不存在')
      if (session.status === 'completed') errors.raise('completed', '这场已经结束，不能取消')
      const signupRef = transaction.collection('signups').doc(domain.signupDocId(sessionId, loaded.user.uid))
      let signup = null
      try {
        const snap = await signupRef.get()
        signup = snap.data
      } catch (err) {
        signup = null
      }
      if (!signup || signup.status !== 'joined') errors.raise('not_joined', '你不在这场车上')
      const members = (session.member_uids || []).filter((uid) => uid !== loaded.user.uid)
      const joinedCount = members.length
      const status = joinedCount >= session.capacity ? 'full' : 'open'
      await signupRef.update({ data: { status: 'dropped' } })
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
