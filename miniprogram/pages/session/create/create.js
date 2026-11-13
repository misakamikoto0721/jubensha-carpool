const api = require('../../../utils/api')
const session = require('../../../utils/session')
const time = require('../../../utils/time')

Page({
  data: {
    scriptName: '',
    location: '',
    capacity: 6,
    date: '',
    time: ''
  },

  onLoad() {
    const parts = time.splitTimestamp(time.defaultStart())
    this.setData(parts)
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
          content: '只有 DM 或管理员可以发布车次。请管理员在首页用学号把你设为 DM。',
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

  changeCapacity(event) {
    const step = Number(event.currentTarget.dataset.step)
    const next = this.data.capacity + step
    if (next < 1 || next > 20) return
    this.setData({ capacity: next })
  },

  submit() {
    const startTime = time.combineDateTime(this.data.date, this.data.time)
    api.withLoading(() => api.call('createSession', {
      scriptName: this.data.scriptName,
      location: this.data.location,
      capacity: this.data.capacity,
      startTime: startTime
    })).then((result) => {
      wx.redirectTo({ url: '/pages/session/detail/detail?id=' + result.sessionId })
    }).catch(() => {})
  }
})
