const domain = require('../domain')
const messages = require('../messages')
const users = require('../users')

module.exports = async function listSessionMessages(event, cloud) {
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

  const rows = await users.safeList(
    db.collection('session_messages').where({ session_id: sessionId }).limit(100).get()
  )
  const ordered = messages.latestMessages(rows)
  const userMap = await users.loadUsersByUids(db, db.command, ordered.map((row) => row.from_uid))
  return {
    ok: true,
    sessionId: sessionId,
    title: session.script_name,
    messages: ordered.map((row) => messages.presentMessage(row, userMap, loaded.user.uid))
  }
}
