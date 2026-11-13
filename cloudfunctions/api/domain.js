const DAY_MS = 24 * 60 * 60 * 1000
const ROLES = ['player', 'dm', 'admin']

function fail(reason, message, extra) {
  return Object.assign({ ok: false, reason: reason, message: message }, extra || {})
}

function formatDateTime(ts) {
  const date = new Date(ts)
  const pad = (number) => String(number).padStart(2, '0')
  return (
    date.getFullYear() +
    '-' +
    pad(date.getMonth() + 1) +
    '-' +
    pad(date.getDate()) +
    ' ' +
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes())
  )
}

function normalizeStudentId(input) {
  return String(input || '').trim().toUpperCase()
}

function validateProfile(studentId, name) {
  const id = normalizeStudentId(studentId)
  const displayName = String(name || '').trim()
  if (!/^[A-Z0-9]{4,20}$/.test(id)) {
    return fail('invalid_student_id', '学号需要是 4 到 20 位字母或数字')
  }
  if (displayName.length < 1 || displayName.length > 20) {
    return fail('invalid_name', '请填写 1 到 20 个字的姓名')
  }
  return { ok: true, studentId: id, name: displayName }
}

function validateSessionInput(input, now) {
  const source = input || {}
  const scriptName = String(source.scriptName || '').trim()
  const location = String(source.location || '').trim()
  const capacity = Math.floor(Number(source.capacity))
  const startTime = Number(source.startTime)
  if (scriptName.length < 1 || scriptName.length > 40) {
    return fail('invalid_script', '剧本名需要在 1 到 40 个字之间')
  }
  if (location.length < 1 || location.length > 40) {
    return fail('invalid_location', '地点需要在 1 到 40 个字之间')
  }
  if (!Number.isFinite(capacity) || capacity < 1 || capacity > 20) {
    return fail('invalid_capacity', '人数上限需要是 1 到 20 的整数')
  }
  if (!Number.isFinite(startTime)) {
    return fail('invalid_time', '请选择开始时间')
  }
  if (startTime < now - DAY_MS || startTime > now + 180 * DAY_MS) {
    return fail('invalid_time', '开始时间需要在昨天到半年之内')
  }
  return {
    ok: true,
    scriptName: scriptName,
    location: location,
    capacity: capacity,
    startTime: startTime
  }
}

function validateRole(role) {
  if (ROLES.indexOf(role) < 0) {
    return fail('invalid_role', '身份只能是玩家、DM 或管理员')
  }
  return { ok: true, role: role }
}

function banActive(user, now) {
  if (!user) return false
  return user.credit_status === 'restricted' && Number(user.ban_until) > now
}

function decideJoin({ user, session, now }) {
  if (!user) return fail('unbound', '绑定学号后才能上车')
  if (banActive(user, now)) {
    return fail('restricted', '限制报名至 ' + formatDateTime(user.ban_until), {
      banUntil: user.ban_until
    })
  }
  if (!session) return fail('not_found', '车次不存在')
  if (session.status === 'completed') return fail('completed', '这场已经结束')
  const joinedCount = session.joined_count || 0
  if (session.status === 'full' || joinedCount >= session.capacity) {
    return fail('full', '已经满员')
  }
  if (session.status !== 'open') return fail('closed', '这场已停止报名')
  if (session.start_time <= now) return fail('started', '已经开始，不能再上车')
  return { ok: true }
}

function applyNoShow(user, now, config) {
  const noShowCount = (user.no_show_count || 0) + 1
  if (noShowCount >= config.noShowThreshold) {
    return {
      no_show_count: noShowCount,
      credit_status: 'restricted',
      ban_until: now + config.banDays * DAY_MS
    }
  }
  const stillBanned = banActive(user, now)
  return {
    no_show_count: noShowCount,
    credit_status: stillBanned ? 'restricted' : 'normal',
    ban_until: stillBanned ? user.ban_until : null
  }
}

function canCreate(user) {
  return !!user && (user.role === 'dm' || user.role === 'admin')
}

function canManageSession(user, session) {
  if (!user || !session) return false
  if (user.role === 'admin') return true
  return user.role === 'dm' && user.uid === session.dm_uid
}

function decideRoleChange(actor, target, role) {
  if (!actor || actor.role !== 'admin') {
    return fail('forbidden', '只有管理员可以把别人加入 DM')
  }
  if (!target) return fail('missing_user', '这个学号还没有绑定过小程序')
  if (target.role === 'admin') return fail('forbidden', '不能改管理员的身份')
  if (role !== 'dm' && role !== 'player') {
    return fail('invalid_role', '只能加入或移出 DM')
  }
  return { ok: true, role: role }
}

function signupDocId(sessionId, uid) {
  return sessionId + '_' + uid
}

function sameMembers(expected, received) {
  if (expected.length !== received.length) return false
  const seen = {}
  expected.forEach((uid) => {
    seen[uid] = true
  })
  return received.every((uid) => seen[uid])
}

module.exports = {
  DAY_MS: DAY_MS,
  fail: fail,
  formatDateTime: formatDateTime,
  normalizeStudentId: normalizeStudentId,
  validateProfile: validateProfile,
  validateSessionInput: validateSessionInput,
  validateRole: validateRole,
  banActive: banActive,
  decideJoin: decideJoin,
  applyNoShow: applyNoShow,
  canCreate: canCreate,
  canManageSession: canManageSession,
  decideRoleChange: decideRoleChange,
  signupDocId: signupDocId,
  sameMembers: sameMembers
}
