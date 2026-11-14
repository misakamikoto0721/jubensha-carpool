const domain = require('../domain')
const messages = require('../messages')
const users = require('../users')

module.exports = async function sendSessionMessage(event, cloud) {
  const db = cloud.database()
  const now = Date.now()
  const sessionId = String((event && event.sessionId) || '')
  if (!sessionId) return { ok: false, reason: 'not_found', message: '车次不存在' }
  const loaded = await messages.requireMember(db, cloud, now)
  if (!loaded.ok) return loaded
  const text = domain.validateMessageText(event && event.text)
  if (!text.ok) return text
  const session = await messages.loadSession(db, sessionId)
  if (!session) return { ok: false, reason: 'not_found', message: '车次不存在' }
  if (!domain.canAccessSessionChat(loaded.user, session)) {
    return { ok: false, reason: 'forbidden', message: '你不在这个群里' }
  }

  await users.ensureCollection(db, 'session_messages')
  await db.collection('session_messages').add({
    data: {
      session_id: sessionId,
      from_uid: loaded.user.uid,
      text: text.text,
      created_at: now
    }
  })
  return { ok: true, sessionId: sessionId }
}
