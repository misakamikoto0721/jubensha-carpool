const domain = require('../domain')
const present = require('../present')
const users = require('../users')

module.exports = async function listPendingMarks(event, cloud) {
  const db = cloud.database()
  const _ = db.command
  const now = Date.now()
  const loaded = await users.requireUser(db, cloud, now)
  if (!loaded.ok) return loaded
  const user = loaded.user
  if (!user || (user.role !== 'dm' && user.role !== 'admin')) {
    return { ok: true, sessions: [] }
  }

  const where = {
    status: _.in(['open', 'full', 'drawn']),
    start_time: _.lte(now)
  }
  if (user.role !== 'admin') where.dm_uid = user.uid
  const rows = await users.safeList(db.collection('sessions').where(where).limit(50).get())
  const pending = rows.filter((row) => domain.needsMark(row, now) && domain.canManageSession(user, row))
  pending.sort((left, right) => right.start_time - left.start_time)
  const userMap = await users.loadUsersByUids(db, _, pending.map((row) => row.dm_uid))
  return {
    ok: true,
    sessions: pending.map((row) => {
      const dm = userMap[row.dm_uid]
      return present.presentSession(row, dm ? dm.name : '')
    })
  }
}
