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
  await users.ensureCollection(db, 'signups')

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
      const applicants = (session.applicant_uids || []).slice()
      const uid = loaded.user.uid
      const onCar = signup && signup.status === 'joined' && members.indexOf(uid) >= 0
      const waiting = signup && signup.status === 'waiting' && applicants.indexOf(uid) >= 0
      if (onCar || (domain.sessionKind(session) === 'weekly' && waiting)) {
        return {
          ok: true,
          idempotent: true,
          placement: onCar ? 'joined' : 'waiting',
          joinedCount: session.joined_count || members.length,
          applicantCount: session.applicant_count || applicants.length,
          capacity: session.capacity,
          replay: domain.hasPlayed(userSnap.data, session.script_name)
        }
      }
      const decision = errors.fromResult(domain.decideJoin({ user: userSnap.data, session: session, now: now }))
      const replay = domain.hasPlayed(userSnap.data, session.script_name)
      if (decision.placement === 'waiting') {
        if (applicants.indexOf(uid) < 0) applicants.push(uid)
        await writeSignup(signupRef, signup, sessionId, uid, 'waiting', now)
        await transaction.collection('sessions').doc(sessionId).update({
          data: {
            applicant_uids: applicants,
            applicant_count: applicants.length,
            status: 'open'
          }
        })
        return { ok: true, placement: 'waiting', applicantCount: applicants.length, capacity: session.capacity, replay: replay }
      }
      if (members.indexOf(uid) < 0) members.push(uid)
      const joinedCount = members.length
      await writeSignup(signupRef, signup, sessionId, uid, 'joined', now)
      await transaction.collection('sessions').doc(sessionId).update({
        data: {
          member_uids: members,
          joined_count: joinedCount,
          status: domain.nextSeatStatus(session, joinedCount)
        }
      })
      return { ok: true, placement: 'joined', joinedCount: joinedCount, capacity: session.capacity, replay: replay }
    })
  } catch (err) {
    const response = errors.toResponse(err)
    if (response) return response
    throw err
  }
}

async function writeSignup(ref, existing, sessionId, uid, status, now) {
  if (existing) {
    await ref.update({ data: { status: status, created_at: now } })
    return
  }
  await ref.set({
    data: {
      session_id: sessionId,
      uid: uid,
      status: status,
      created_at: now
    }
  })
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
