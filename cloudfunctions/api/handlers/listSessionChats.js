const domain = require('../domain')
const messages = require('../messages')
const users = require('../users')

module.exports = async function listSessionChats(event, cloud) {
  const db = cloud.database()
  const now = Date.now()
  const loaded = await messages.requireMember(db, cloud, now)
  if (!loaded.ok) return loaded
  const uid = loaded.user.uid
  const batches = await Promise.all([
    users.safeList(db.collection('sessions').where({ dm_uid: uid }).limit(50).get()),
    users.safeList(db.collection('sessions').where({ member_uids: uid }).limit(50).get()),
    users.safeList(db.collection('sessions').where({ applicant_uids: uid }).limit(50).get())
  ])
  const seen = {}
  const sessions = []
  batches.forEach((rows) => {
    rows.forEach((row) => {
      if (!row || !row._id || seen[row._id]) return
      if (!domain.canAccessSessionChat(loaded.user, row)) return
      seen[row._id] = true
      sessions.push(row)
    })
  })
  sessions.sort((left, right) => (right.start_time || 0) - (left.start_time || 0))
  const chosen = sessions.slice(0, 30)
  const chats = []
  for (let index = 0; index < chosen.length; index += 1) {
    const session = chosen[index]
    const rows = await users.safeList(
      db.collection('session_messages').where({ session_id: session._id }).limit(30).get()
    )
    const latest = rows.slice().sort((left, right) => (right.created_at || 0) - (left.created_at || 0))[0]
    chats.push({
      sessionId: session._id,
      title: session.script_name,
      kind: session.kind === 'weekly' ? 'weekly' : 'private',
      startTime: session.start_time,
      lastText: latest ? latest.text : '',
      lastAt: latest ? latest.created_at : 0
    })
  }
  chats.sort((left, right) => (right.lastAt || right.startTime || 0) - (left.lastAt || left.startTime || 0))
  return { ok: true, chats: chats }
}
