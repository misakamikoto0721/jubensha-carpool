const api = require('../../../utils/api')
const sessionApi = require('../../../utils/session')
const format = require('../../../utils/format')
const config = require('../../../config')

Page({
  data: {
    loading: true,
    missing: false,
    session: null,
    members: [],
    draft: [],
    needBind: false,
    applicants: [],
    missed: [],
    canJoin: false,
    canCancel: false,
    canMark: false,
    canPull: false,
    mySeat: '',
    pullStudentId: '',
    joinBlockReason: ''
  },

  onLoad(query) {
    this.sessionId = query.id || ''
  },

  onShow() {
    this.load()
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh())
  },

  load() {
    if (!this.sessionId) {
      this.setData({ loading: false, missing: true })
      return Promise.resolve()
    }
    this.setData({ loading: true, missing: false })
    return sessionApi.loadMe()
      .catch(() => null)
      .then(() => api.call('getSession', { sessionId: this.sessionId }))
      .then((result) => {
        const session = format.decorateSession(result.session)
        const members = (result.members || []).map(format.decorateMember)
        const permissions = result.permissions || {}
        const draft = members
          .filter((member) => member.status === 'joined')
          .map((member) => ({
            uid: member.uid,
            name: member.name,
            status: 'attended'
          }))
        this.setData({
          loading: false,
          session: session,
          members: members,
          applicants: (result.applicants || []).map(format.decorateMember),
          missed: (result.missed || []).map(format.decorateMember),
          draft: draft,
          needBind: !!permissions.needBind,
          canJoin: !!permissions.canJoin,
          canCancel: !!permissions.canCancel,
          canMark: !!permissions.canMark,
          canPull: !!permissions.canPull,
          mySeat: permissions.mySeat || '',
          joinBlockReason: permissions.joinBlockReason || ''
        })
      })
      .catch((err) => {
        this.setData({ loading: false, missing: err.reason === 'not_found', session: null })
        if (err.reason !== 'not_found') api.showError(err)
      })
  },

  goLogin() {
    const redirect = encodeURIComponent('/pages/session/detail/detail?id=' + this.sessionId)
    wx.navigateTo({ url: '/pages/login/login?redirect=' + redirect })
  },

  goHome() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
      return
    }
    wx.reLaunch({ url: '/pages/index/index' })
  },

  join() {
    api.withLoading(() => api.call('joinSession', { sessionId: this.sessionId }))
      .then(() => this.load())
      .catch(() => {})
  },

  cancelJoin() {
    api.withLoading(() => api.call('cancelJoin', { sessionId: this.sessionId }))
      .then(() => this.load())
      .catch(() => {})
  },

  onPullStudentId(event) {
    this.setData({ pullStudentId: event.detail.value })
  },

  pullMember() {
    const studentId = String(this.data.pullStudentId || '').trim()
    if (!studentId) {
      wx.showToast({ title: '先填写学号', icon: 'none' })
      return
    }
    api.withLoading(() => api.call('pullMember', {
      sessionId: this.sessionId,
      studentId: studentId
    })).then(() => {
      this.setData({ pullStudentId: '' })
      return this.load()
    }).catch(() => {})
  },

  pickMark(event) {
    const uid = event.currentTarget.dataset.uid
    const status = event.currentTarget.dataset.status
    const draft = this.data.draft.map((item) => {
      if (item.uid !== uid) return item
      return Object.assign({}, item, { status: status })
    })
    this.setData({ draft: draft })
  },

  submitMarks() {
    wx.showModal({
      title: '提交到场记录',
      content: '提交后不能在小程序里修改。标成爽约的人会累计次数。',
      success: (res) => {
        if (!res.confirm) return
        api.withLoading(() => api.call('markAttendance', {
          sessionId: this.sessionId,
          attendance: this.data.draft.map((item) => ({
            uid: item.uid,
            status: item.status
          }))
        })).then(() => this.load()).catch(() => {})
      }
    })
  },

  copyLibrary() {
    wx.setClipboardData({ data: config.libraryRoomUrl })
  },

  onShareAppMessage() {
    const session = this.data.session
    if (!session) {
      return { title: '剧本杀拼车', path: '/pages/index/index' }
    }
    const share = {
      title: session.scriptName + ' · ' + session.timeText,
      path: '/pages/session/detail/detail?id=' + session.id
    }
    if (config.shareHrefBase) {
      share.href = config.shareHrefBase + '?id=' + encodeURIComponent(session.id)
    }
    return share
  }
})
