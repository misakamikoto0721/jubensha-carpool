const api = require('../../utils/api')
const format = require('../../utils/format')
const session = require('../../utils/session')

Page({
  data: {
    loading: true,
    user: null,
    initial: '',
    dmStudentId: '',
    nickname: '',
    pending: [],
    played: []
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
        const initial = user && (user.displayName || user.name) ? (user.displayName || user.name).slice(0, 1) : ''
        this.setData({
          loading: false,
          user: user,
          initial: initial,
          nickname: user && user.nickname ? user.nickname : '',
          played: user && user.playedScripts ? user.playedScripts : []
        })
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
        this.setData({ loading: false, user: null, pending: [], played: [] })
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

  onNickname(event) {
    this.setData({ nickname: event.detail.value })
  },

  applyUser(user) {
    const decorated = format.decorateUser(user)
    getApp().globalData.user = decorated
    const shown = decorated.displayName || decorated.name || ''
    this.setData({
      user: decorated,
      initial: shown.slice(0, 1),
      nickname: decorated.nickname || '',
      played: decorated.playedScripts || []
    })
  },

  saveNickname() {
    api.withLoading(() => api.call('updateProfile', { nickname: this.data.nickname }))
      .then((result) => {
        this.applyUser(result.user)
        wx.showToast({ title: '已保存', icon: 'success' })
      })
      .catch(() => {})
  },

  changeAvatar() {
    const user = this.data.user
    if (!user) return
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0]
        if (!file) return
        wx.showLoading({ title: '请稍候', mask: true })
        wx.cloud.uploadFile({
          cloudPath: 'avatars/' + user.uid + '-' + Date.now() + '.jpg',
          filePath: file.tempFilePath,
          success: (upload) => {
            api.call('updateProfile', { avatarFileId: upload.fileID })
              .then((result) => {
                wx.hideLoading()
                this.applyUser(result.user)
              })
              .catch((err) => api.showError(err))
          },
          fail: (err) => {
            wx.hideLoading()
            api.showError({ message: (err && err.errMsg) || '头像上传失败' })
          }
        })
      }
    })
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
