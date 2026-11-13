const api = require('../../../utils/api')
const session = require('../../../utils/session')
const time = require('../../../utils/time')

Page({
  data: {
    scriptName: '',
    location: '',
    capacity: 6,
    kind: 'private',
    kindNote: '先到先得，满了就不能再自己上车。DM 可以在车次页把人超额拉进来。',
    capacityLabel: '人数上限',
    date: '',
    time: '',
    endDate: '',
    endClock: '',
    drawDate: '',
    drawClock: ''
  },

  onLoad() {
    const start = time.defaultStart()
    const startParts = time.splitTimestamp(start)
    const endParts = time.splitTimestamp(start + 4 * 60 * 60 * 1000)
    const drawParts = time.splitTimestamp(start - 30 * 60 * 1000)
    this.setData({
      date: startParts.date,
      time: startParts.time,
      endDate: endParts.date,
      endClock: endParts.time,
      drawDate: drawParts.date,
      drawClock: drawParts.time
    })
    this.ready = false
  },

  onShow() {
    if (this.ready) return
    this.ready = true
    session.loadMe().then((me) => {
      const user = me.user
      if (!user || (user.role !== 'dm' && user.role !== 'admin')) {
        wx.showModal({
          title: '需要 DM 身份',
          content: '只有 DM 或管理员可以发布车次。请管理员在「我的」里把你设为 DM。',
          showCancel: false,
          success: () => {
            wx.navigateBack({
              fail: () => wx.redirectTo({ url: '/pages/index/index' })
            })
          }
        })
      }
    }).catch((err) => {
      api.showError(err)
    })
  },

  onScriptName(event) {
    this.setData({ scriptName: event.detail.value })
  },

  onLocation(event) {
    this.setData({ location: event.detail.value })
  },

  onDate(event) {
    this.setData({ date: event.detail.value })
  },

  onTime(event) {
    this.setData({ time: event.detail.value })
  },

  onEndDate(event) {
    this.setData({ endDate: event.detail.value })
  },

  onEndClock(event) {
    this.setData({ endClock: event.detail.value })
  },

  onDrawDate(event) {
    this.setData({ drawDate: event.detail.value })
  },

  onDrawClock(event) {
    this.setData({ drawClock: event.detail.value })
  },

  pickKind(event) {
    const kind = event.currentTarget.dataset.kind
    const weekly = kind === 'weekly'
    this.setData({
      kind: weekly ? 'weekly' : 'private',
      capacityLabel: weekly ? '计划人数' : '人数上限',
      kindNote: weekly
        ? '报名不设上限，到抽签截止为止。截止后按计划人数随机抽一次，抽中的人上车。'
        : '先到先得，满了就不能再自己上车。DM 可以在车次页把人超额拉进来。'
    })
  },

  changeCapacity(event) {
    const step = Number(event.currentTarget.dataset.step)
    const next = this.data.capacity + step
    if (next < 1 || next > 20) return
    this.setData({ capacity: next })
  },

  submit() {
    const startTime = time.combineDateTime(this.data.date, this.data.time)
    const endTime = time.combineDateTime(this.data.endDate, this.data.endClock)
    const payload = {
      scriptName: this.data.scriptName,
      location: this.data.location,
      capacity: this.data.capacity,
      kind: this.data.kind,
      startTime: startTime,
      endTime: endTime
    }
    if (this.data.kind === 'weekly') {
      payload.drawDeadline = time.combineDateTime(this.data.drawDate, this.data.drawClock)
    }
    api.withLoading(() => api.call('createSession', payload)).then((result) => {
      wx.redirectTo({ url: '/pages/session/detail/detail?id=' + result.sessionId })
    }).catch(() => {})
  }
})
