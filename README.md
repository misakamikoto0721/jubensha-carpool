# 剧本杀拼车

社团内部用的微信小程序。DM 发车，分享到 QQ 群，成员上车，活动结束后标记到场或爽约。累计 2 次爽约会禁止报名 14 天。

后端是一个微信云函数 `api`，前端不直接读写数据库。统一身份认证还没开通时，成员用学号绑定；惩罚记在学号上。

## 本地跑起来

1. 安装微信开发者工具，用管理员微信登录。
2. 导入本目录。把 `project.config.json` 里的 `appid` 从 `touristappid` 换成小程序后台的 AppID。
3. 开通云开发，创建一个环境。如果开发者工具没有自动选中它，把环境 ID 填进 `miniprogram/config.js` 的 `envId`。
4. 在 `cloudfunctions/api` 上右键，选择「上传并部署：云端安装依赖」。
5. 编译。第一位绑定学号的人会成为管理员。管理员在首页把 DM 的学号设成 DM，DM 才能发车。

数据库集合会在第一次写入时自动创建：`users`、`auth_identities`、`sessions`、`signups`。云开发控制台里把这四个集合的权限设成「所有用户不可读写」。云函数使用管理端权限，不受这条限制。

## 目录

- `miniprogram/`：页面。列表、绑定学号、发布车次、车次详情。
- `cloudfunctions/api/`：全部后端。`action` 为 `login`、`authStart`、`authFinish`、`bindUid`、`createSession`、`joinSession`、`cancelJoin`、`markAttendance`、`getSession`、`listSessions`、`setRole`。
- `auth-callback/index.html`：统一认证的回调页。部署后的完整地址填进云函数环境变量 `USTC_REDIRECT_URI`，必须和学校登记的回调地址一致。
- `qq-entry/index.html`：给 QQ 分享用的静态页。部署到 `ustc.edu.cn` 或社团可控的 HTTPS 域名后，把地址填进 `miniprogram/config.js` 的 `shareHrefBase`，不要带问号。
- `test/domain.test.js`：爽约、满员、权限这些纯规则。运行 `node --test test/domain.test.js`。

## 规则

- 上车、取消、满员和爽约计数都在云函数事务里完成，前端改不了结果。
- 开始时间到了就不能再上车。取消上车在标记到场之前都可以。
- 标记提交后车次关闭，不能在小程序里改。
- 研讨室不在小程序里预约。详情页复制 `http://ic.lib.ustc.edu.cn/` ，到浏览器打开。
- 学号绑定没有密码。知道别人学号的人可以抢先绑定，这只是统一认证开通前的临时办法。已经有报名或爽约记录后，不能自行换成另一个学号。

统一认证的接口已经留好，凭据到了之后不用改调用方式。在云函数 `api` 的环境变量里设置 `USTC_CLIENT_ID`、`USTC_CLIENT_SECRET`、`USTC_REDIRECT_URI`，然后重新部署。不要把 secret 写进代码。

- `login`：看当前微信是否已经绑定，并告诉前端统一认证是否已配置。
- `authStart`：生成一次性 `state`，返回科大授权地址。未配置时只返回 `configured: false`，不访问学校接口。
- `authFinish`：校验 `state` 属于当前微信且未过期，用 `code` 换令牌和身份，再把 openid 绑到学工号上。`gid` 另外保存。
- `bindUid`：学号绑定，统一认证未开通时继续用它。

回调页会尽量跳回小程序登录页。没有自动跳回时，把页面上的 code 和 state 填进登录页。

## 验收

1. 管理员把某个学号设为 DM。
2. DM 发布一场车，分享卡片能打开详情。
3. 另一位已绑定成员上车，人数加一；满员后其他人上不了。
4. DM 把其中一人标成爽约，再标一次，这个人在 14 天内上车按钮不可用，并看得到解禁时间。
5. 换一个微信绑定同一个学号，限制仍然在。
