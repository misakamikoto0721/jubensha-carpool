const domain = require('../domain')
const messages = require('../messages')
const users = require('../users')

module.exports = async function listPrivateMessages(event, cloud) {
  const db = cloud.database()
  const now = Date.now()
  const loaded = await messages.requireMember(db, cloud, now)
  if (!loaded.ok) return loaded
  const found = await messages.resolvePeer(db, event)
  if (!found.ok) return found
  const decision = domain.decidePrivatePeer(loaded.user, found.peer)
  if (!decision.ok) return decision

  const rows = await users.safeList(
    db.collection('private_messages').where({ thread_id: decision.threadId }).limit(100).get()
  )
  const ordered = messages.latestMessages(rows)
  const userMap = await users.loadUsersByUids(db, db.command, [loaded.user.uid, found.peer.uid])
  return {
    ok: true,
    threadId: decision.threadId,
    peer: {
      uid: found.peer.uid,
      name: found.peer.name,
      studentId: found.peer.student_id || found.peer.uid
    },
    messages: ordered.map((row) => messages.presentMessage(row, userMap, loaded.user.uid))
  }
}
