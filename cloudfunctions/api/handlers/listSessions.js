const present = require('../present')
const users = require('../users')

module.exports = async function listSessions(event, cloud) {
  const db = cloud.database()
  const _ = db.command
  const now = Date.now()
  const rows = await users.safeList(
    db.collection('sessions').where({ status: _.in(['open', 'full']) }).limit(100).get()
  )
  rows.sort((left, right) => {
    const leftPast = left.start_time < now
    const rightPast = right.start_time < now
    if (leftPast !== rightPast) return leftPast ? 1 : -1
    if (leftPast && rightPast) return right.start_time - left.start_time
    return left.start_time - right.start_time
  })
  const userMap = await users.loadUsersByUids(db, _, rows.map((row) => row.dm_uid))
  return {
    ok: true,
    sessions: rows.map((row) => {
      const dm = userMap[row.dm_uid]
      return present.presentSession(row, dm ? dm.name : '')
    })
  }
}
