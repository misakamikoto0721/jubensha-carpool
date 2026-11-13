const api = require('../../utils/api')
const session = require('../../utils/session')

Page({
  data: {
    studentId: '',
    name: '',
    boundUser: null,
    ustcConfigured: false,
    oauthCode: '',
    oauthState: ''
  },

  onLoad(query) {
    this.redirect = query.redirect ? decodeURIComponent(query.redirect) : ''
    if (query.oauthCode && query.oauthState) {
      this.pendingOAuth = {
        code: decodeURIComponent(query.oauthCode),
        state: decodeURIComponent(query.oauthState)
      }
      this.setData({
        oauthCode: this.pendingOAuth.code,
        oauthState: this.pendingOAuth.state
      })
    }
  },

  onShow() {
    session.loadMe().then((me) => {
      this.setData({
        boundUser: me.user,
        ustcConfigured: !!(me.auth && me.auth.configured)
      })
    }).catch(() => {})
    if (this.pendingOAuth) {
      const pending = this.pendingOAuth
      this.pendingOAuth = null
      this.finishWith(pending.code, pending.state)
    }
  },

  onStudentId(event) {
    this.setData({ studentId: event.detail.value })
  },

  onName(event) {
    this.setData({ name: event.detail.value })
  },

  onOAuthCode(event) {
    this.setData({ oauthCode: event.detail.value })
  },

  onOAuthState(event) {
    this.setData({ oauthState: event.detail.value })
  },

  openUstc() {
    api.withLoading(() => api.call('authStart', { provider: api.provider() }))
      .then((result) => {
        if (!result.configured || !result.authorizeUrl) {
          wx.showToast({ title: '统一认证还没配置', icon: 'none' })
          return
        }
        wx.setClipboardData({
          data: result.authorizeUrl,
          complete: () => {
            wx.navigateTo({
              url: '/pages/auth/webview?url=' + encodeURIComponent(result.authorizeUrl)
            })
          }
        })
      })
      .catch(() => {})
  },

  finishUstc() {
    this.finishWith(this.data.oauthCode, this.data.oauthState)
  },

  finishWith(code, state) {
    api.withLoading(() => api.call('authFinish', {
      code: code,
      state: state,
      provider: api.provider()
    })).then((result) => this.afterBind(result)).catch(() => {})
  },

  submit() {
    api.withLoading(() => api.call('bindUid', {
      studentId: this.data.studentId,
      name: this.data.name,
      provider: api.provider()
    })).then((result) => this.afterBind(result)).catch(() => {})
  },

  afterBind(result) {
    getApp().globalData.user = result.user
    const title = result.becameAdmin ? '你已成为管理员' : '绑定成功'
    wx.showToast({ title: title, icon: 'success' })
    setTimeout(() => this.leave(), 400)
  },

  leave() {
    if (this.redirect) {
      wx.redirectTo({ url: this.redirect })
      return
    }
    wx.navigateBack({
      fail: () => {
        wx.redirectTo({ url: '/pages/index/index' })
      }
    })
  }
})
