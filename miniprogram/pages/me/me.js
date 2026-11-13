const api = require('../../utils/api')
const session = require('../../utils/session')

Page({
  data: {
    loading: true,
    user: null,
    initial: '',
    dmStudentId: ''
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
      })
      .catch((err) => {
        this.setData({ loading: false, user: null })
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
