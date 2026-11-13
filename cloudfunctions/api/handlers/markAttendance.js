const config = require('../config')
const domain = require('../domain')
const errors = require('../errors')
const users = require('../users')

module.exports = async function markAttendance(event, cloud) {
  const db = cloud.database()
  const now = Date.now()
  const sessionId = String((event && event.sessionId) || '')
  if (!sessionId) return { ok: false, reason: 'not_found', message: '车次不存在' }

  const loaded = await users.requireUser(db, cloud, now)
  if (!loaded.ok) return loaded
  if (!loaded.user) return { ok: false, reason: 'unbound', message: '请先绑定学号' }

  const attendance = Array.isArray(event.attendance) ? event.attendance : null
  if (!attendance) return { ok: false, reason: 'invalid_attendance', message: '请标记每位已上车的成员' }

  const seen = {}
  const normalized = []
  for (let index = 0; index < attendance.length; index += 1) {
    const item = attendance[index] || {}
    const uid = domain.normalizeStudentId(item.uid)
    if (!uid || seen[uid]) {
      return { ok: false, reason: 'invalid_attendance', message: '到场名单里有重复或空的学号' }
    }
    if (item.status !== 'attended' && item.status !== 'no_show') {
      return { ok: false, reason: 'invalid_attendance', message: '每位成员只能标成到场或爽约' }
    }
    seen[uid] = item.status
    normalized.push({ uid: uid, status: item.status })
  }

  const userMap = await users.loadUsersByUids(db, db.command, normalized.map((item) => item.uid))

  try {
    const restrictedUids = await db.runTransaction(async (transaction) => {
      const sessionSnap = await transaction.collection('sessions').doc(sessionId).get()
      const session = sessionSnap.data
      if (!session) errors.raise('not_found', '车次不存在')
      if (!domain.canManageSession(loaded.user, session)) {
        errors.raise('forbidden', '只有这场的 DM 或管理员可以标记')
      }
      if (session.status === 'completed') errors.raise('completed', '这场已经标记过了')

      const members = session.member_uids || []
      const markedIds = normalized.map((item) => item.uid)
      if (!domain.sameMembers(members, markedIds)) {
        errors.raise('invalid_attendance', '请为每位已上车的成员标记到场或爽约')
      }

      const banned = []
      for (let index = 0; index < normalized.length; index += 1) {
        const item = normalized[index]
        const signupRef = transaction.collection('signups').doc(domain.signupDocId(sessionId, item.uid))
        const signupSnap = await signupRef.get()
        if (!signupSnap.data || signupSnap.data.status !== 'joined') {
          errors.raise('invalid_attendance', '有成员不在车上，请刷新后再标记')
        }
        await signupRef.update({ data: { status: item.status } })
        if (item.status !== 'no_show') continue

        const user = userMap[item.uid]
        if (!user) errors.raise('missing_user', '找不到学号 ' + item.uid)
        const freshSnap = await transaction.collection('users').doc(user._id).get()
        const next = domain.applyNoShow(freshSnap.data, now, config)
        await transaction.collection('users').doc(user._id).update({ data: next })
        if (next.credit_status === 'restricted') banned.push(item.uid)
      }

      await transaction.collection('sessions').doc(sessionId).update({
        data: { status: 'completed' }
      })
      return banned
    })
    return { ok: true, restrictedUids: restrictedUids }
  } catch (err) {
    const response = errors.toResponse(err)
    if (response) return response
    throw err
  }
}
