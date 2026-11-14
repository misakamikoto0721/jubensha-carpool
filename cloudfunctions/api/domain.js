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

const BOARD_STATUS = { open: true, full: true, drawn: true }

function visibleOnBoard(session, now) {
  if (!session || !BOARD_STATUS[session.status]) return false
  return Number(session.start_time) > now
}

function needsMark(session, now) {
  if (!session || !BOARD_STATUS[session.status]) return false
  return Number(session.start_time) <= now
}

function sessionKind(session) {
  return session && session.kind === 'weekly' ? 'weekly' : 'private'
}

function timeInWindow(ts, now) {
  return Number.isFinite(ts) && ts >= now - DAY_MS && ts <= now + 180 * DAY_MS
}

function validateSessionInput(input, now) {
  const source = input || {}
  const scriptName = String(source.scriptName || '').trim()
  const location = String(source.location || '').trim()
  const capacity = Math.floor(Number(source.capacity))
  const startTime = Number(source.startTime)
  const endTime = Number(source.endTime)
  const kind = source.kind
  if (scriptName.length < 1 || scriptName.length > 40) {
    return fail('invalid_script', '剧本名需要在 1 到 40 个字之间')
  }
  if (location.length < 1 || location.length > 40) {
    return fail('invalid_location', '地点需要在 1 到 40 个字之间')
  }
  if (!Number.isFinite(capacity) || capacity < 1 || capacity > 20) {
    return fail('invalid_capacity', '人数需要是 1 到 20 的整数')
  }
  if (kind !== 'weekly' && kind !== 'private') {
    return fail('invalid_kind', '请选择周常或私车')
  }
  if (!Number.isFinite(startTime)) {
    return fail('invalid_time', '请选择开始时间')
  }
  if (!timeInWindow(startTime, now)) {
    return fail('invalid_time', '开始时间需要在昨天到半年之内')
  }
  if (!Number.isFinite(endTime)) {
    return fail('invalid_time', '请选择结束时间')
  }
  if (endTime <= startTime) {
    return fail('invalid_time', '结束时间要晚于开始时间')
  }
  if (!timeInWindow(endTime, now)) {
    return fail('invalid_time', '结束时间需要在昨天到半年之内')
  }
  let drawDeadline = null
  if (kind === 'weekly') {
    drawDeadline = Number(source.drawDeadline)
    if (!Number.isFinite(drawDeadline)) {
      return fail('invalid_time', '请选择抽签截止时间')
    }
    if (drawDeadline >= startTime) {
      return fail('invalid_time', '抽签截止要早于开始时间')
    }
    if (!timeInWindow(drawDeadline, now)) {
      return fail('invalid_time', '抽签截止时间需要在昨天到半年之内')
    }
  }
  return {
    ok: true,
    scriptName: scriptName,
    location: location,
    capacity: capacity,
    kind: kind,
    startTime: startTime,
    endTime: endTime,
    drawDeadline: drawDeadline
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

function joinGate({ user, session, now }) {
  if (!user) return fail('unbound', '绑定学号后才能上车')
  if (banActive(user, now)) {
    return fail('restricted', '限制报名至 ' + formatDateTime(user.ban_until), {
      banUntil: user.ban_until
    })
  }
  if (!session) return fail('not_found', '车次不存在')
  if (session.status === 'completed') return fail('completed', '这场已经结束')
  if (sessionKind(session) === 'weekly' && weeklyDrawState(session) === 'done') {
    return fail('drawn', '已经抽过签')
  }
  if (sessionKind(session) === 'weekly' && weeklySignupFrozen(session, now)) {
    return fail('draw_closed', '抽签已截止')
  }
  if (session.status !== 'open' && session.status !== 'full') {
    return fail('closed', '这场已停止报名')
  }
  if (session.start_time <= now) return fail('started', '已经开始，不能再上车')
  return { ok: true }
}

function decidePrivateJoin(session) {
  const joinedCount = session.joined_count || 0
  if (session.status === 'full' || joinedCount >= session.capacity) {
    return fail('full', '已经满员')
  }
  return { ok: true, placement: 'joined' }
}

function decideWeeklyJoin() {
  return { ok: true, placement: 'waiting' }
}

function decideJoin(input) {
  const gate = joinGate(input)
  if (!gate.ok) return gate
  if (sessionKind(input.session) === 'weekly') return decideWeeklyJoin()
  return decidePrivateJoin(input.session)
}

function weeklyDrawState(session) {
  if (session && (session.draw_status === 'done' || session.status === 'drawn')) return 'done'
  return 'pending'
}

function canAccessSessionChat(user, session) {
  if (!user || !session) return false
  if (user.uid === session.dm_uid) return true
  const members = session.member_uids || []
  if (members.indexOf(user.uid) >= 0) return true
  if (weeklyDrawState(session) === 'done') return false
  const applicants = session.applicant_uids || []
  return applicants.indexOf(user.uid) >= 0
}

function sessionChatRoster(session) {
  if (!session) return []
  const rows = []
  const seen = {}
  const add = (uid, seat) => {
    if (!uid || seen[uid]) return
    seen[uid] = true
    rows.push({ uid: uid, seat: seat })
  }
  add(session.dm_uid, 'dm')
  ;(session.member_uids || []).forEach((uid) => add(uid, 'member'))
  if (weeklyDrawState(session) !== 'done') {
    ;(session.applicant_uids || []).forEach((uid) => add(uid, 'applicant'))
  }
  return rows
}

function validateMessageText(text) {
  const value = String(text || '').trim()
  if (!value) return fail('empty_message', '请输入内容')
  if (value.length > 500) return fail('invalid_message', '一条消息最多 500 字')
  return { ok: true, text: value }
}

function privateThreadId(left, right) {
  const pair = [String(left || ''), String(right || '')].sort()
  return pair[0] + '_' + pair[1]
}

function decidePrivatePeer(me, peer) {
  if (!me) return fail('unbound', '登录后才能发消息')
  if (!peer) return fail('missing_user', '这个学号还没有登录过小程序')
  if (me.uid === peer.uid) return fail('self_chat', '不能和自己私聊')
  return { ok: true, threadId: privateThreadId(me.uid, peer.uid) }
}

function weeklySignupFrozen(session, now) {
  if (!session || sessionKind(session) !== 'weekly') return false
  if (weeklyDrawState(session) === 'done') return true
  return Number(session.draw_deadline) > 0 && now >= Number(session.draw_deadline)
}

function decideDraw(session, now) {
  if (!session) return fail('not_found', '车次不存在')
  if (sessionKind(session) !== 'weekly') return fail('wrong_kind', '只有周常要抽签')
  if (weeklyDrawState(session) === 'done') return { ok: true, alreadyDrawn: true }
  if (session.status === 'completed') return fail('completed', '这场已经结束')
  if (!Number(session.draw_deadline)) return fail('no_deadline', '这场周常没有抽签截止时间')
  if (now < Number(session.draw_deadline)) return fail('too_early', '还没到抽签截止时间')
  return { ok: true, alreadyDrawn: false }
}

function drawWinners(uids, capacity, randomBelow) {
  const pool = (uids || []).slice()
  const seats = Math.max(0, Math.floor(Number(capacity) || 0))
  const take = Math.min(pool.length, seats)
  for (let index = 0; index < take; index += 1) {
    const span = pool.length - index
    const offset = randomBelow(span)
    const swapIndex = index + offset
    const current = pool[index]
    pool[index] = pool[swapIndex]
    pool[swapIndex] = current
  }
  return {
    selected: pool.slice(0, take),
    missed: pool.slice(take)
  }
}

function nextSeatStatus(session, joinedCount) {
  if (sessionKind(session) === 'weekly') return 'open'
  return joinedCount >= session.capacity ? 'full' : 'open'
}

function decidePullIn({ actor, target, session, now, alreadyJoined }) {
  if (!session) return fail('not_found', '车次不存在')
  if (!canManageSession(actor, session)) {
    return fail('forbidden', '只有本场 DM 或管理员可以拉人')
  }
  if (sessionKind(session) !== 'private') {
    return fail('wrong_kind', '周常不在这里拉人，报名的人在等抽签')
  }
  if (!target) return fail('missing_user', '这个学号还没有登录过小程序')
  if (banActive(target, now)) {
    return fail('restricted', '这个人限制报名至 ' + formatDateTime(target.ban_until), {
      banUntil: target.ban_until
    })
  }
  if (session.status === 'completed') return fail('completed', '这场已经结束')
  if (session.start_time <= now) return fail('started', '已经开始，不能再拉人')
  if (session.status !== 'open' && session.status !== 'full') {
    return fail('closed', '这场已停止报名')
  }
  if (alreadyJoined) return fail('already_joined', '这个人已经在车上')
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

function playedScripts(user) {
  if (!user || !Array.isArray(user.played_scripts)) return []
  return user.played_scripts.filter((name) => !!name)
}

function hasPlayed(user, scriptName) {
  const name = String(scriptName || '').trim()
  if (!name) return false
  return playedScripts(user).indexOf(name) >= 0
}

function withPlayedScript(user, scriptName) {
  const name = String(scriptName || '').trim()
  const list = playedScripts(user).slice()
  if (name && list.indexOf(name) < 0) list.push(name)
  return list
}

function displayName(user) {
  if (!user) return ''
  const nickname = String(user.nickname || '').trim()
  if (nickname) return nickname
  return user.name || user.uid || ''
}

function validateNickname(input) {
  const nickname = String(input || '').trim()
  if (nickname.length < 1 || nickname.length > 20) {
    return fail('invalid_nickname', '昵称需要 1 到 20 个字')
  }
  return { ok: true, nickname: nickname }
}

function validateAvatarFileId(input, uid) {
  if (input === '' || input === null) return { ok: true, avatarFileId: '' }
  const value = String(input || '').trim()
  const owned = !uid || value.indexOf('avatars/' + uid + '-') >= 0
  if (value.indexOf('cloud://') !== 0 || value.length > 300 || !owned) {
    return fail('invalid_avatar', '头像需要从相册上传')
  }
  return { ok: true, avatarFileId: value }
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
  visibleOnBoard: visibleOnBoard,
  needsMark: needsMark,
  sessionKind: sessionKind,
  validateSessionInput: validateSessionInput,
  validateRole: validateRole,
  banActive: banActive,
  decideJoin: decideJoin,
  weeklySignupFrozen: weeklySignupFrozen,
  decideDraw: decideDraw,
  canAccessSessionChat: canAccessSessionChat,
  sessionChatRoster: sessionChatRoster,
  validateMessageText: validateMessageText,
  privateThreadId: privateThreadId,
  decidePrivatePeer: decidePrivatePeer,
  drawWinners: drawWinners,
  nextSeatStatus: nextSeatStatus,
  decidePullIn: decidePullIn,
  applyNoShow: applyNoShow,
  canCreate: canCreate,
  canManageSession: canManageSession,
  decideRoleChange: decideRoleChange,
  displayName: displayName,
  playedScripts: playedScripts,
  hasPlayed: hasPlayed,
  withPlayedScript: withPlayedScript,
  validateNickname: validateNickname,
  validateAvatarFileId: validateAvatarFileId,
  signupDocId: signupDocId,
  sameMembers: sameMembers
}
