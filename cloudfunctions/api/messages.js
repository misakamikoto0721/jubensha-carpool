const domain = require('./domain')
const users = require('./users')

async function requireMember(db, cloud, now) {
  const loaded = await users.requireUser(db, cloud, now)
  if (!loaded.ok) return loaded
  if (!loaded.user) return { ok: false, reason: 'unbound', message: '登录后才能发消息' }
  return loaded
}

async function loadSession(db, sessionId) {
  try {
    const snap = await db.collection('sessions').doc(sessionId).get()
    const session = snap.data
    if (!session) return null
    if (!session._id) session._id = sessionId
    return session
  } catch (err) {
    const msg = String((err && (err.errMsg || err.message)) || '')
    if (users.isMissingCollection(err) || msg.indexOf('does not exist') >= 0 || msg.indexOf('不存在') >= 0) {
      return null
    }
    throw err
  }
}

async function resolvePeer(db, event) {
  const key = domain.normalizeStudentId((event && (event.studentId || event.peerUid)) || '')
  if (!/^[A-Z0-9]{4,20}$/.test(key)) {
    return { ok: false, reason: 'invalid_student_id', message: '学号需要是 4 到 20 位字母或数字' }
  }
  const peer = await users.findUserByLoginId(db, key)
  return { ok: true, peer: peer, key: key }
}

function latestMessages(rows) {
  return (rows || []).slice().sort((left, right) => (left.created_at || 0) - (right.created_at || 0)).slice(-80)
}

function presentMessage(doc, userMap, mineUid) {
  const person = userMap[doc.from_uid]
  const nickname = person ? domain.displayName(person) : doc.from_uid
  return {
    id: doc._id,
    fromUid: doc.from_uid,
    name: nickname,
    nickname: nickname,
    initial: nickname ? String(nickname).slice(0, 1) : '?',
    avatar: person && person.avatar_file_id ? person.avatar_file_id : '',
    studentId: person ? (person.student_id || doc.from_uid) : doc.from_uid,
    text: doc.text,
    createdAt: doc.created_at,
    mine: doc.from_uid === mineUid
  }
}

module.exports = {
  requireMember: requireMember,
  loadSession: loadSession,
  resolvePeer: resolvePeer,
  latestMessages: latestMessages,
  presentMessage: presentMessage
}
