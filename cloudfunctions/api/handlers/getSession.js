const domain = require('../domain')
const draw = require('../draw')
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
  session = await draw.ensureDrawn(db, session, now)

  const loaded = await users.requireUser(db, cloud, now)
  if (!loaded.ok) return loaded
  const user = loaded.user
  const memberIds = session.member_uids || []
  const applicantIds = session.applicant_uids || []
  const missedIds = session.missed_uids || []
  const userMap = await users.loadUsersByUids(
    db,
    db.command,
    memberIds.concat(applicantIds, missedIds, [session.dm_uid])
  )
  const signups = await users.safeList(
    db.collection('signups').where({ session_id: sessionId }).limit(50).get()
  )
  const signupByUid = {}
  signups.forEach((row) => {
    signupByUid[row.uid] = row
  })
  if (user && !signupByUid[user.uid]) {
    const mine = await readSignup(db, domain.signupDocId(sessionId, user.uid))
    if (mine) signupByUid[user.uid] = mine
  }

  const members = memberIds.map((uid) => personOnList(uid, userMap, signupByUid, 'joined', session.script_name))
    .filter((member) => member.status !== 'dropped' && member.status !== 'missed')
  const applicants = applicantIds.map((uid) => personOnList(uid, userMap, signupByUid, 'waiting', session.script_name))
    .filter((member) => member.status === 'waiting')
  const missed = missedIds.map((uid) => personOnList(uid, userMap, signupByUid, 'missed', session.script_name))

  const uid = user ? user.uid : ''
  const onCar = !!(uid && memberIds.indexOf(uid) >= 0)
  const waiting = !!(uid && applicantIds.indexOf(uid) >= 0)
  const missedSeat = !!(uid && missedIds.indexOf(uid) >= 0)
  const decision = domain.decideJoin({ user: user, session: session, now: now })
  const frozen = domain.weeklySignupFrozen(session, now)
  const dm = userMap[session.dm_uid]
  const manageable = domain.canManageSession(user, session) && session.status !== 'completed'

  return {
    ok: true,
    session: present.presentSession(session, dm ? dm.name : ''),
    members: members,
    applicants: applicants,
    missed: missed,
    permissions: {
      needBind: !user,
      canJoin: !!(user && decision.ok && !onCar && !waiting && !missedSeat),
      canCancel: session.status !== 'completed' && (
        (waiting && !frozen) || (onCar && domain.sessionKind(session) !== 'weekly')
      ),
      canMark: manageable,
      canComplete: manageable && domain.needsMark(session, now),
      canPull: manageable && domain.sessionKind(session) === 'private' && session.start_time > now,
      canChat: domain.canAccessSessionChat(user, session),
      mySeat: onCar ? 'joined' : (waiting ? 'waiting' : (missedSeat ? 'missed' : '')),
      joinBlockReason: onCar || (waiting && !frozen) || decision.ok
        ? ''
        : (missedSeat ? '未抽中' : decision.message)
    }
  }
}

async function readSignup(db, id) {
  try {
    const snap = await db.collection('signups').doc(id).get()
    return snap.data || null
  } catch (err) {
    const msg = String((err && (err.errMsg || err.message)) || '')
    if (msg.indexOf('does not exist') >= 0 || msg.indexOf('不存在') >= 0) return null
    throw err
  }
}

function personOnList(uid, userMap, signupByUid, fallback, scriptName) {
  const person = userMap[uid]
  const signup = signupByUid[uid]
  let status = signup ? signup.status : fallback
  if ((status === 'waiting' || status === 'dropped') && (fallback === 'joined' || fallback === 'missed')) {
    status = fallback
  }
  return {
    uid: uid,
    name: person ? person.name : uid,
    studentId: person ? (person.student_id || uid) : uid,
    status: status,
    replay: domain.hasPlayed(person, scriptName)
  }
}
