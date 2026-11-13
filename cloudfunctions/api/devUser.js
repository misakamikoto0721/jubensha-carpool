// 临时：统一认证接通后，删除本文件、handlers/devLogin.js，以及登录页的「临时账号」。
// 改下面的 account 后重新部署云函数，再在登录页点一次，当前微信号就变成这个人。

const domain = require('./domain')

const config = {
  enabled: true,
  account: {
    id: 'PB000001',
    studentId: 'PB000001',
    name: '测试甲',
    role: 'admin'
  }
}

function readAccount(source) {
  const file = source || config
  if (!file.enabled) {
    return { ok: false, reason: 'dev_login_disabled', message: '临时登录已关闭' }
  }
  const account = file.account || {}
  const id = domain.normalizeStudentId(account.id)
  const studentId = domain.normalizeStudentId(account.studentId || account.id)
  const name = String(account.name || '').trim()
  const role = account.role
  if (!/^[A-Z0-9]{4,20}$/.test(id) || !/^[A-Z0-9]{4,20}$/.test(studentId)) {
    return { ok: false, reason: 'invalid_student_id', message: '临时账号的 id 和学号需要是 4 到 20 位字母或数字' }
  }
  if (name.length < 1 || name.length > 20) {
    return { ok: false, reason: 'invalid_name', message: '临时账号的姓名需要是 1 到 20 个字' }
  }
  if (role !== 'player' && role !== 'dm' && role !== 'admin') {
    return { ok: false, reason: 'invalid_role', message: '临时账号的身份只能是 player、dm 或 admin' }
  }
  return {
    ok: true,
    account: {
      id: id,
      studentId: studentId,
      name: name,
      role: role
    }
  }
}

module.exports = {
  enabled: config.enabled,
  readAccount: readAccount
}
