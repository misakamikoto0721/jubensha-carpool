const domain = require('../domain')
const present = require('../present')
const users = require('../users')

module.exports = async function getSession(event, cloud) {
  const db = cloud.database()
  const now = Date.now()
  const sessionId = String((event && event.sessionId) || '')
  if (!sessionId) return { ok: false, reason: 'not_found', message: '车次不存在' }

  let session
  try {
    const snap = await db.collection('sessions').doc(sessionId).get()
    session = snap.data
  } catch (err) {
    const msg = String((err && (err.errMsg || err.message)) || '')
    if (users.isMissingCollection(err) || msg.indexOf('does not exist') >= 0 || msg.indexOf('不存在') >= 0) {
      return { ok: false, reason: 'not_found', message: '车次不存在或已被删除' }
    }
    throw err
  }
  if (!session) return { ok: false, reason: 'not_found', message: '车次不存在或已被删除' }
  if (!session._id) session._id = sessionId

  const loaded = await users.requireUser(db, cloud, now)
  if (!loaded.ok) return loaded
  const user = loaded.user
  const memberIds = session.member_uids || []
  const userMap = await users.loadUsersByUids(db, db.command, memberIds.concat([session.dm_uid]))
  const signups = await users.safeList(
    db.collection('signups').where({ session_id: sessionId }).limit(50).get()
  )
  const signupByUid = {}
  signups.forEach((row) => {
    signupByUid[row.uid] = row
  })

  const members = memberIds.map((uid) => {
    const person = userMap[uid]
    const signup = signupByUid[uid]
    return {
      uid: uid,
      name: person ? person.name : uid,
      studentId: person ? (person.student_id || uid) : uid,
      status: signup ? signup.status : 'joined'
    }
  }).filter((member) => member.status !== 'dropped')

  const mySignup = user ? signupByUid[user.uid] : null
  const joined = !!(mySignup && mySignup.status === 'joined')
  const decision = domain.decideJoin({ user: user, session: session, now: now })
  const dm = userMap[session.dm_uid]

  return {
    ok: true,
    session: present.presentSession(session, dm ? dm.name : ''),
    members: members,
    permissions: {
      needBind: !user,
      canJoin: !!(user && decision.ok && !joined),
      canCancel: joined && session.status !== 'completed',
      canMark: domain.canManageSession(user, session) && session.status !== 'completed',
      joinBlockReason: joined || decision.ok ? '' : decision.message
    }
  }
}
