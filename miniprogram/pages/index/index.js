const api = require('../../utils/api')
const session = require('../../utils/session')
const format = require('../../utils/format')

const ROLE_VALUES = ['player', 'dm', 'admin']

Page({
  data: {
    loading: true,
    sessions: [],
    user: null,
    canCreate: false,
    roleStudentId: '',
    roleIndex: 1,
    roleLabels: ['玩家', 'DM', '管理员']
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

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/session/create/create' })
  },

  openDetail(event) {
    const id = event.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/session/detail/detail?id=' + id })
  },

  onRoleStudentId(event) {
    this.setData({ roleStudentId: event.detail.value })
  },

  onRolePick(event) {
    this.setData({ roleIndex: Number(event.detail.value) })
  },

  submitRole() {
    const studentId = this.data.roleStudentId
    const role = ROLE_VALUES[this.data.roleIndex]
    api.withLoading(() => api.call('setRole', { studentId: studentId, role: role }))
      .then(() => {
        this.setData({ roleStudentId: '' })
        wx.showToast({ title: '已保存', icon: 'success' })
        return this.refresh()
      })
      .catch(() => {})
  }
})
