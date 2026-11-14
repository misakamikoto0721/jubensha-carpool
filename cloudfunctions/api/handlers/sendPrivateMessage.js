const domain = require('../domain')
const messages = require('../messages')
const users = require('../users')

module.exports = async function sendPrivateMessage(event, cloud) {
  const db = cloud.database()
  const now = Date.now()
  const loaded = await messages.requireMember(db, cloud, now)
  if (!loaded.ok) return loaded
  const text = domain.validateMessageText(event && event.text)
  if (!text.ok) return text
  const found = await messages.resolvePeer(db, event)
  if (!found.ok) return found
  const decision = domain.decidePrivatePeer(loaded.user, found.peer)
  if (!decision.ok) return decision

  await users.ensureCollection(db, 'private_messages')
  await users.ensureCollection(db, 'private_threads')
  const pair = [loaded.user.uid, found.peer.uid].sort()
  await db.collection('private_messages').add({
    data: {
      thread_id: decision.threadId,
      from_uid: loaded.user.uid,
      to_uid: found.peer.uid,
      text: text.text,
      created_at: now
    }
  })
  await db.collection('private_threads').doc(decision.threadId).set({
    data: {
      uids: pair,
      last_text: text.text.slice(0, 40),
      last_at: now,
      last_from_uid: loaded.user.uid
    }
  })
  return {
    ok: true,
    threadId: decision.threadId,
    peer: {
      uid: found.peer.uid,
      name: found.peer.name,
      studentId: found.peer.student_id || found.peer.uid
    }
  }
}
