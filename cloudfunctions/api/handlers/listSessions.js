const domain = require('../domain')
const present = require('../present')
const users = require('../users')

module.exports = async function listSessions(event, cloud) {
  const db = cloud.database()
  const _ = db.command
  const now = Date.now()
  const rows = await users.safeList(
    db.collection('sessions').where({
      status: _.in(['open', 'full', 'drawn']),
      start_time: _.gt(now)
    }).limit(100).get()
  )
  const visible = rows.filter((row) => domain.visibleOnBoard(row, now))
  visible.sort((left, right) => left.start_time - right.start_time)
  const userMap = await users.loadUsersByUids(db, _, visible.map((row) => row.dm_uid))
  return {
    ok: true,
    sessions: visible.map((row) => {
      const dm = userMap[row.dm_uid]
      return present.presentSession(row, dm ? dm.name : '')
    })
  }
}
