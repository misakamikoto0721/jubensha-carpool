const api = require('../../../utils/api')
const format = require('../../../utils/format')

Page({
  data: {
    messages: [],
    members: [],
    draft: '',
    failed: '',
    anchor: '',
    title: '车次群',
    timeText: '',
    memberCount: 0,
    drawer: false,
    profile: null,
    statusBar: 20,
    headHeight: 88,
    capsuleGap: 96
  },

  onLoad(query) {
    this.sessionId = query.id || ''
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const menu = wx.getMenuButtonBoundingClientRect()
    const statusBar = windowInfo.statusBarHeight || 20
    this.setData({
      statusBar: statusBar,
      headHeight: statusBar + 72,
      capsuleGap: Math.max(24, windowInfo.windowWidth - menu.left + 8)
    })
  },

  onShow() {
    this.load(false)
    this.loadMembers()
    this.arm()
  },

  onHide() {
    this.disarm()
  },

  onUnload() {
    this.disarm()
  },

  arm() {
    this.disarm()
    this.poll = setInterval(() => this.load(true), 4000)
  },

  disarm() {
    if (this.poll) clearInterval(this.poll)
    this.poll = null
  },

  load(quiet) {
    return api.call('listSessionMessages', { sessionId: this.sessionId })
      .then((result) => {
        const timeText = result.startTime
          ? format.timeRange({ startTime: result.startTime, endTime: result.endTime })
          : ''
        this.setData({
          title: result.title || '车次群',
          timeText: timeText,
          memberCount: result.memberCount || 0,
          messages: result.messages || [],
          failed: '',
          anchor: ''
        })
        this.setData({ anchor: 'bottom' })
      })
      .catch((err) => {
        this.setData({ failed: err.message || '没有打开这个群' })
        if (!quiet) api.showError(err)
      })
  },

  loadMembers() {
    return api.call('listSessionMembers', { sessionId: this.sessionId })
      .then((result) => {
        const members = result.members || []
        this.setData({ members: members, memberCount: members.length })
        return members
      })
      .catch(() => [])
  },

  onDraft(event) {
    this.setData({ draft: event.detail.value })
  },

  send() {
    const text = String(this.data.draft || '').trim()
    if (!text) return
    api.withLoading(() => api.call('sendSessionMessage', {
      sessionId: this.sessionId,
      text: text
    })).then(() => {
      this.setData({ draft: '' })
      return this.load(true)
    }).catch(() => {})
  },

  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
      return
    }
    wx.switchTab({ url: '/pages/messages/messages' })
  },

  toggleDrawer() {
    const drawer = !this.data.drawer
    this.setData({ drawer: drawer })
    if (drawer) this.loadMembers()
  },

  closeDrawer() {
    this.setData({ drawer: false })
  },

  openProfile(event) {
    const uid = event.currentTarget.dataset.uid
    if (!uid) return
    const show = (members) => {
      const member = (members || []).filter((item) => item.uid === uid)[0]
      const message = (this.data.messages || []).filter((item) => item.fromUid === uid)[0]
      const source = member || message
      if (!source) return
      this.setData({
        profile: {
          uid: uid,
          nickname: member ? member.nickname : message.nickname,
          avatar: member ? member.avatar : message.avatar,
          initial: member ? member.initial : message.initial,
          studentId: member ? member.studentId : message.studentId,
          seatText: member ? member.seatText : '',
          mine: member ? member.mine : !!message.mine
        }
      })
    }
    if (this.data.members.length) {
      show(this.data.members)
      return
    }
    this.loadMembers().then((members) => show(members))
  },

  closeProfile() {
    this.setData({ profile: null })
  },

  hold() {},

  openPrivate(event) {
    const studentId = event.currentTarget.dataset.studentId
    if (!studentId) return
    wx.navigateTo({
      url: '/pages/chat/private/private?studentId=' + encodeURIComponent(studentId)
    })
  }
})
