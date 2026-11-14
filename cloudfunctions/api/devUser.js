// 临时：统一认证接通后，删除本文件、handlers/devLogin.js，以及登录页的「临时登录」。
// account 是第一个点「临时登录」的微信号。之后每个微信号各有一条 users，再点还是同一条。

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

function assignDevLogin(input) {
  const openid = input.openid
  const configuredId = input.configuredId
  const identity = input.identity || null
  const holders = input.holders || []
  if (identity && identity.uid && identity.uid !== configuredId) {
    return { action: 'keep', uid: identity.uid }
  }
  const others = holders.filter((row) => row.openid && row.openid !== openid)
  if (others.length === 0) return { action: 'configured' }
  const earliestOther = others.reduce((best, row) => {
    if (!best || earlierHolder(row, best)) return row
    return best
  }, null)
  const mine = holders.filter((row) => row.openid === openid)[0] || (identity && identity.openid === openid ? identity : null)
  if (mine && earlierHolder(mine, earliestOther)) return { action: 'configured' }
  return { action: 'allocate' }
}

function earlierHolder(left, right) {
  const leftAt = Number(left.bound_at || 0)
  const rightAt = Number(right.bound_at || 0)
  if (leftAt !== rightAt) return leftAt < rightAt
  return String(left.openid) < String(right.openid)
}

function guestAccount(index) {
  const id = 'PB' + String(index).padStart(6, '0')
  return {
    id: id,
    studentId: id,
    name: '测试' + index,
    role: 'player'
  }
}

module.exports = {
  enabled: config.enabled,
  readAccount: readAccount,
  assignDevLogin: assignDevLogin,
  guestAccount: guestAccount
}
