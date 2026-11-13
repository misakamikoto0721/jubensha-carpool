const time = require('./time')

const ROLE_TEXT = {
  player: '玩家',
  dm: 'DM',
  admin: '管理员'
}

const STATUS_TEXT = {
  open: '报名中',
  full: '已满',
  closed: '已截止',
  completed: '已结束',
  drawn: '已抽签'
}

const KIND_TEXT = {
  weekly: '周常',
  private: '私车'
}

const MARK_TEXT = {
  joined: '已上车',
  waiting: '等待抽签',
  missed: '未抽中',
  attended: '到场',
  no_show: '爽约',
  dropped: '已取消'
}

function decorateUser(user) {
  if (!user) return null
  const banned = user.creditStatus === 'restricted' && user.banUntil > Date.now()
  return Object.assign({}, user, {
    roleText: ROLE_TEXT[user.role] || '玩家',
    banText: banned ? '限制报名至 ' + time.formatDateTime(user.banUntil) : ''
  })
}

function timeRange(session) {
  const startText = time.formatDateTime(session.startTime)
  if (!session.endTime) return startText
  const endText = time.formatDateTime(session.endTime)
  if (startText.slice(0, 10) === endText.slice(0, 10)) {
    return startText + ' – ' + endText.slice(11)
  }
  return startText + ' – ' + endText
}

function remainText(session) {
  if (session.kind === 'weekly') {
    if (session.status === 'completed') return '已结束'
    if (session.drawStatus === 'done' || session.status === 'drawn') return '已抽签'
    if (session.drawDeadline && session.drawDeadline <= Date.now()) return '待抽签'
    if (session.status === 'closed') return '已截止'
    return (session.applicantCount || 0) + ' 人等待抽签'
  }
  const left = session.capacity - session.joinedCount
  if (session.status === 'completed') return '已结束'
  if (session.status === 'closed') return '已截止'
  if (session.status === 'full' || left <= 0) return '已满'
  return '还差 ' + left + ' 人'
}

function decorateSession(session) {
  const weekly = session.kind === 'weekly'
  const drawn = weekly && (session.drawStatus === 'done' || session.status === 'drawn')
  const pendingMark = session.status !== 'completed' && session.startTime <= Date.now()
  const left = session.capacity - session.joinedCount
  return Object.assign({}, session, {
    kindText: KIND_TEXT[session.kind] || '私车',
    timeText: timeRange(session),
    drawText: weekly && session.drawDeadline ? '抽签截止 ' + time.formatDateTime(session.drawDeadline) : '',
    statusText: pendingMark ? '待标记' : (STATUS_TEXT[session.status] || session.status),
    seatText: drawn
      ? session.joinedCount + ' / ' + session.capacity + ' 人'
      : (weekly ? '计划 ' + session.capacity + ' 人' : session.joinedCount + ' / ' + session.capacity + ' 人'),
    remainText: remainText(session),
    remainOpen: weekly ? session.status === 'open' && !drawn : session.status === 'open' && left > 0,
    pendingMark: pendingMark
  })
}

function decorateMember(member) {
  return Object.assign({}, member, {
    statusText: MARK_TEXT[member.status] || member.status
  })
}

module.exports = {
  decorateUser: decorateUser,
  decorateSession: decorateSession,
  decorateMember: decorateMember
}
