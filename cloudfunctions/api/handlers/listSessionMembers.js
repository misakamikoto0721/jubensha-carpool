const domain = require('../domain')
const messages = require('../messages')
const users = require('../users')

const seatText = {
  dm: 'DM',
  member: '车上',
  applicant: '报名中'
}

module.exports = async function listSessionMembers(event, cloud) {
  const db = cloud.database()
  const now = Date.now()
  const sessionId = String((event && event.sessionId) || '')
  if (!sessionId) return { ok: false, reason: 'not_found', message: '车次不存在' }
  const loaded = await messages.requireMember(db, cloud, now)
  if (!loaded.ok) return loaded
  const session = await messages.loadSession(db, sessionId)
  if (!session) return { ok: false, reason: 'not_found', message: '车次不存在' }
  if (!domain.canAccessSessionChat(loaded.user, session)) {
    return { ok: false, reason: 'forbidden', message: '你不在这个群里' }
  }

  const roster = domain.sessionChatRoster(session)
  const userMap = await users.loadUsersByUids(db, db.command, roster.map((row) => row.uid))
  return {
    ok: true,
    sessionId: sessionId,
    title: session.script_name,
    members: roster.map((row) => presentMember(row, userMap, loaded.user.uid))
  }
}

function presentMember(row, userMap, mineUid) {
  const person = userMap[row.uid]
  const nickname = person ? domain.displayName(person) : row.uid
  return {
    uid: row.uid,
    studentId: person ? (person.student_id || row.uid) : row.uid,
    nickname: nickname,
    initial: nickname ? String(nickname).slice(0, 1) : '?',
    avatar: person && person.avatar_file_id ? person.avatar_file_id : '',
    seat: row.seat,
    seatText: seatText[row.seat] || '',
    mine: row.uid === mineUid
  }
}
