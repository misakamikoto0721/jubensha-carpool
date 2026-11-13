const api = require('../../utils/api')
const format = require('../../utils/format')
const session = require('../../utils/session')

Page({
  data: {
    loading: true,
    user: null,
    initial: '',
    dmStudentId: '',
    pending: []
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
      .then((me) => {
        const user = me.user
        const initial = user && user.name ? user.name.slice(0, 1) : ''
        this.setData({ loading: false, user: user, initial: initial })
        if (!user || (user.role !== 'dm' && user.role !== 'admin')) {
          this.setData({ pending: [] })
          return null
        }
        return api.call('listPendingMarks').catch((err) => {
          api.showError(err)
          return null
        })
      })
      .then((result) => {
        if (!result) return
        const pending = (result.sessions || []).map(format.decorateSession)
        this.setData({ pending: pending })
      })
      .catch((err) => {
        this.setData({ loading: false, user: null, pending: [] })
        api.showError(err)
      })
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  logout() {
    api.withLoading(() => api.call('logout'))
      .then(() => {
        getApp().globalData.user = null
        wx.reLaunch({ url: '/pages/login/login' })
      })
      .catch(() => {})
  },

  openDetail(event) {
    const id = event.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/session/detail/detail?id=' + id })
  },

  onDmStudentId(event) {
    this.setData({ dmStudentId: event.detail.value })
  },

  grantDm() {
    this.changeDm('dm', '已加入 DM')
  },

  revokeDm() {
    this.changeDm('player', '已移出 DM')
  },

  changeDm(role, title) {
    const studentId = this.data.dmStudentId
    api.withLoading(() => api.call('setRole', { studentId: studentId, role: role }))
      .then(() => {
        this.setData({ dmStudentId: '' })
        wx.showToast({ title: title, icon: 'success' })
      })
      .catch(() => {})
  }
})
