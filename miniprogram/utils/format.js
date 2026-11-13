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
  completed: '已结束'
}

const MARK_TEXT = {
  joined: '已上车',
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

function remainText(session) {
  const left = session.capacity - session.joinedCount
  if (session.status === 'completed') return '已结束'
  if (session.status === 'closed') return '已截止'
  if (session.status === 'full' || left <= 0) return '已满'
  return '还差 ' + left + ' 人'
}

function decorateSession(session) {
  const pendingMark = session.status !== 'completed' && session.startTime <= Date.now()
  const left = session.capacity - session.joinedCount
  return Object.assign({}, session, {
    timeText: time.formatDateTime(session.startTime),
    statusText: pendingMark ? '待标记' : (STATUS_TEXT[session.status] || session.status),
    seatText: session.joinedCount + ' / ' + session.capacity,
    remainText: remainText(session),
    remainOpen: session.status === 'open' && left > 0,
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
