const domain = require('../domain')
const users = require('../users')

module.exports = async function setRole(event, cloud) {
  const db = cloud.database()
  const now = Date.now()
  const loaded = await users.requireUser(db, cloud, now)
  if (!loaded.ok) return loaded

  const studentId = domain.normalizeStudentId(event && event.studentId)
  if (!/^[A-Z0-9]{4,20}$/.test(studentId)) {
    return { ok: false, reason: 'invalid_student_id', message: '学号需要是 4 到 20 位字母或数字' }
  }

  const target = await users.findUserByLoginId(db, studentId)
  const decision = domain.decideRoleChange(loaded.user, target, event && event.role)
  if (!decision.ok) return decision

  await db.collection('users').doc(target._id).update({ data: { role: decision.role } })
  return { ok: true, uid: target.uid, role: decision.role }
}
