const domain = require('../domain')
const users = require('../users')

module.exports = async function createSession(event, cloud) {
  const db = cloud.database()
  const now = Date.now()
  const loaded = await users.requireUser(db, cloud, now)
  if (!loaded.ok) return loaded
  if (!domain.canCreate(loaded.user)) {
    return { ok: false, reason: 'forbidden', message: '只有 DM 或管理员可以发布车次' }
  }
  const input = domain.validateSessionInput(event, now)
  if (!input.ok) return input
  await users.ensureCollection(db, 'sessions')

  const added = await db.collection('sessions').add({
    data: {
      dm_uid: loaded.user.uid,
      script_name: input.scriptName,
      kind: input.kind,
      start_time: input.startTime,
      end_time: input.endTime,
      draw_deadline: input.drawDeadline,
      draw_status: input.kind === 'weekly' ? 'pending' : 'none',
      location: input.location,
      capacity: input.capacity,
      status: 'open',
      joined_count: 0,
      member_uids: [],
      missed_uids: [],
      applicant_count: 0,
      applicant_uids: [],
      created_at: now
    }
  })

  return {
    ok: true,
    sessionId: added._id,
    sharePath: '/pages/session/detail/detail?id=' + added._id
  }
}
