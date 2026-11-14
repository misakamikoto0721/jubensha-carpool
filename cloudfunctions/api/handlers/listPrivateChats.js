const messages = require('../messages')
const domain = require('../domain')
const users = require('../users')

module.exports = async function listPrivateChats(event, cloud) {
  const db = cloud.database()
  const now = Date.now()
  const loaded = await messages.requireMember(db, cloud, now)
  if (!loaded.ok) return loaded

  const threads = await users.safeList(
    db.collection('private_threads').where({ uids: loaded.user.uid }).limit(50).get()
  )
  threads.sort((left, right) => (right.last_at || 0) - (left.last_at || 0))
  const peerIds = threads.map((thread) => {
    const pair = thread.uids || []
    return pair[0] === loaded.user.uid ? pair[1] : pair[0]
  })
  const userMap = await users.loadUsersByUids(db, db.command, peerIds)
  return {
    ok: true,
    chats: threads.map((thread, index) => {
      const peer = userMap[peerIds[index]]
      return {
        peerUid: peerIds[index],
        peerName: peer ? domain.displayName(peer) : peerIds[index],
        peerStudentId: peer ? (peer.student_id || peer.uid) : peerIds[index],
        lastText: thread.last_text || '',
        lastAt: thread.last_at || 0
      }
    })
  }
}
