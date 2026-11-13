const domain = require('../domain')
const errors = require('../errors')
const users = require('../users')

module.exports = async function pullMember(event, cloud) {
  const db = cloud.database()
  const now = Date.now()
  const sessionId = String((event && event.sessionId) || '')
  if (!sessionId) return { ok: false, reason: 'not_found', message: '车次不存在' }
  const studentId = domain.normalizeStudentId(event && event.studentId)
  if (!/^[A-Z0-9]{4,20}$/.test(studentId)) {
    return { ok: false, reason: 'invalid_student_id', message: '学号需要是 4 到 20 位字母或数字' }
  }

  const loaded = await users.requireUser(db, cloud, now)
  if (!loaded.ok) return loaded
  if (!loaded.user) return { ok: false, reason: 'unbound', message: '登录后才能拉人' }
  const target = await users.findUserByLoginId(db, studentId)
  if (!target) return { ok: false, reason: 'missing_user', message: '这个学号还没有登录过小程序' }
  await users.ensureCollection(db, 'signups')

  try {
    return await db.runTransaction(async (transaction) => {
      const sessionSnap = await transaction.collection('sessions').doc(sessionId).get()
      const session = sessionSnap.data
      if (!session) errors.raise('not_found', '车次不存在')
      const targetSnap = await transaction.collection('users').doc(target._id).get()
      const members = (session.member_uids || []).slice()
      const alreadyJoined = members.indexOf(target.uid) >= 0
      errors.fromResult(domain.decidePullIn({
        actor: loaded.user,
        target: targetSnap.data,
        session: session,
        now: now,
        alreadyJoined: alreadyJoined
      }))
      members.push(target.uid)
      const applicants = (session.applicant_uids || []).filter((uid) => uid !== target.uid)
      const signupRef = transaction.collection('signups').doc(domain.signupDocId(sessionId, target.uid))
      const signup = await readOptional(signupRef)
      if (signup) {
        await signupRef.update({ data: { status: 'joined', created_at: now } })
      } else {
        await signupRef.set({
          data: {
            session_id: sessionId,
            uid: target.uid,
            status: 'joined',
            created_at: now
          }
        })
      }
      const joinedCount = members.length
      await transaction.collection('sessions').doc(sessionId).update({
        data: {
          member_uids: members,
          joined_count: joinedCount,
          applicant_uids: applicants,
          applicant_count: applicants.length,
          status: domain.nextSeatStatus(session, joinedCount)
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
