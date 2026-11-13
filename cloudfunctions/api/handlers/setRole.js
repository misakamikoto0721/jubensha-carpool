const domain = require('../domain')
const users = require('../users')

module.exports = async function setRole(event, cloud) {
  const db = cloud.database()
  const now = Date.now()
  const loaded = await users.requireUser(db, cloud, now)
  if (!loaded.ok) return loaded
  if (!loaded.user || loaded.user.role !== 'admin') {
    return { ok: false, reason: 'forbidden', message: '只有管理员可以设置身份' }
  }

  const studentId = domain.normalizeStudentId(event && event.studentId)
  const roleResult = domain.validateRole(event && event.role)
  if (!/^[A-Z0-9]{4,20}$/.test(studentId)) {
    return { ok: false, reason: 'invalid_student_id', message: '学号需要是 4 到 20 位字母或数字' }
  }
  if (!roleResult.ok) return roleResult

  const target = await users.findUserByLoginId(db, studentId)
  if (!target) {
    return { ok: false, reason: 'missing_user', message: '这个学号还没有绑定过小程序' }
  }
  if (loaded.user.uid === target.uid && roleResult.role !== 'admin') {
    const admins = await db.collection('users').where({ role: 'admin' }).count()
    if (admins.total <= 1) {
      return { ok: false, reason: 'last_admin', message: '至少要留下一名管理员' }
    }
  }

  await db.collection('users').doc(target._id).update({ data: { role: roleResult.role } })
  return { ok: true, uid: target.uid, role: roleResult.role }
}
