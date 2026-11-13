const api = require('../../utils/api')
const session = require('../../utils/session')
const format = require('../../utils/format')

Page({
  data: {
    loading: true,
    sessions: [],
    user: null,
    canCreate: false
  },

  onShow() {
    this.refresh()
  },

  onPullDownRefresh() {
    this.refresh().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  refresh() {
    this.setData({ loading: true })
    return session.loadMe()
      .catch(() => ({ user: null }))
      .then((me) => {
        const user = me.user
        this.setData({
          user: user,
          canCreate: !!(user && (user.role === 'dm' || user.role === 'admin'))
        })
        return api.call('listSessions')
      })
      .then((result) => {
        this.setData({
          loading: false,
          sessions: (result.sessions || []).map(format.decorateSession)
        })
      })
      .catch((err) => {
        this.setData({ loading: false, sessions: [] })
        api.showError(err)
      })
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/session/create/create' })
  },

  openDetail(event) {
    const id = event.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/session/detail/detail?id=' + id })
  }
})
