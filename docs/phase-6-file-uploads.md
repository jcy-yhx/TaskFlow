# Phase 6 学习文档：文件上传

## 本阶段目标

实现文件上传功能：任务附件上传/下载/删除、用户头像上传。展示 Node.js 流式文件处理、multer 中间件、前端拖拽上传组件。

## 核心概念

### 1. multer 的工作原理

multer 是 Node.js 最强的文件上传中间件。处理流程：

```
HTTP POST (multipart/form-data)
  │
  ▼
multer.single('avatar') 或 array('files', 5)
  │
  ├── fileFilter: 校验文件类型
  ├── limits: { fileSize: 10MB, files: 5 }
  ├── storage: memoryStorage → file.buffer (内存中)
  │
  ▼
Controller: storeFile(file, subDir)
  ├── 生成唯一文件名 (CUID + 原始扩展名)
  ├── fs.writeFile(路径, file.buffer)
  └── 返回 storageKey → 存入 Attachment 表
```

**为什么用 memoryStorage 而非 diskStorage？**
- `diskStorage` 直接存硬盘 → 文件名不可控，重复名会覆盖
- `memoryStorage` 存内存 → 控制器层决定文件名和存储位置
- 内存存储方便后续切 S3（只需改 `storeFile` 函数）

### 2. StorageProvider 抽象层

这是本项目最重要的可扩展性设计之一：

```
                  ┌─ LocalStorageProvider (本阶段，fs.writeFile)
storeFile() ──────┤
                  └─ S3StorageProvider (Phase 9 可切换，s3.putObject)

接口一致，实现可替换。调用方不关心文件存在哪里。
```

当前 `attachment.service.ts` 中的 `storeFile()` 和 `readFile()` 是本地磁盘实现。production 部署时只需替换这两个函数，其余代码不变。

### 3. 文件安全实践

**服务端防护**：
```typescript
// 1. 类型白名单
const allowed = ['image/png', 'image/jpeg', 'application/pdf', ...];
if (!allowed.includes(file.mimetype)) cb(new Error('Not allowed'));

// 2. 大小限制
limits: { fileSize: 10 * 1024 * 1024, files: 5 }

// 3. 扩展名保留但路径危险字符已处理
// CUID 生成的文件名保证了唯一性，原始扩展名只是辅助
const storageKey = `${subDir}/${createId()}${ext}`;  // "attachments/abc123.pdf"
```

**为什么不在 uploads/ 目录中直接用原始文件名？**
- 用户上传 `../../../etc/passwd` → 路径穿越攻击
- 两个用户上传 `report.pdf` → 命名冲突
- 解决方案：用 CUID 做存储名，原始文件名存 DB

**Serving 文件时**：
```typescript
res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(att.fileName)}"`);
```
- `inline` 让浏览器尝试预览（图片、PDF），而非强制下载
- `encodeURIComponent` 防止文件名注入 header

### 4. 前端拖拽上传组件设计

`FileUpload` 组件融合了三个交互模式：

```
┌─────────────────────────────┐
│   拖拽区 (Drop Zone)         │
│   ┌───────────────────────┐ │
│   │  📎 Drop files here   │ │  ← onDragOver/onDrop/onClick
│   │  or click to browse   │ │
│   │  Max 10MB per file    │ │
│   └───────────────────────┘ │
│   <input type="file" hidden> │  ← 点击触发原生文件选择
└─────────────────────────────┘

文件列表：
  📄 report.pdf   (245KB) · Jun 29  [×]
  🖼️ screenshot.png (1.2MB) · Jun 29  [×]
```

**事件处理**：
- `onDragOver` → 设置 `dragging=true`，展示蓝色边框
- `onDragLeave` → `dragging=false`
- `onDrop` → 提取 `e.dataTransfer.files` → `uploadMut.mutate(files)`
- `onClick` → 触发隐藏的 `<input type="file">`
- `onChange` (input) → 提取 `e.target.files` → upload

### 5. FormData 上传

前端使用 `FormData` API 构建 multipart 请求：

```typescript
// 与 JSON API 不同——不能用 application/json Content-Type
const form = new FormData();
Array.from(files).forEach((f) => form.append('files', f));

await apiClient.post(`/tasks/${taskId}/attachments`, form, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
```

**关键点**：Axios 会自动检测 FormData 并设置正确的 `Content-Type` (含 boundary)。如果手动设置会被覆盖。

### 6. 头像上传的"替换旧文件"模式

```typescript
// 上传新头像时，先删除旧文件
const user = await prisma.user.findUnique({ where: { id }, select: { avatarUrl } });
if (user?.avatarUrl?.startsWith('/uploads/')) {
  await deleteFile(user.avatarUrl.replace('/uploads/', ''));
}
const stored = await storeFile(file, 'avatars');
await prisma.user.update({ where: { id }, data: { avatarUrl: `/uploads/${stored.storageKey}` } });
```

防止磁盘上堆积废弃的头像文件。

## 关键代码走读

### 文件 1：`packages/backend/src/services/attachment.service.ts`

核心的三个函数：

**`storeFile(file, subDir)`** — 文件持久化。创建目录 → 生成 CUID 文件名 → 写入磁盘 → 返回元数据。这是与"存储介质"的唯一边界，切 S3 只需改这里。

**`readFile(storageKey)`** — 磁盘读取 + MIME 类型推断。用文件扩展名查表获取 MIME 类型（因为 multer 的 `mimetype` 在存 DB 时已丢失上下文）。

**`deleteFile(storageKey)`** — 删除文件（幂等，文件不存在也不报错）。

### 文件 2：`packages/backend/src/controllers/attachment.controller.ts`

multer 配置 + 控制器。`upload.array('files', 5)` 表示最多 5 个文件，字段名为 "files"。

### 文件 3：`packages/frontend/src/components/common/FileUpload.tsx`

完整的 Drop Zone 组件。三个交互触发同一条通路：`uploadMut.mutate(files)` → FormData → API。

### 文件 4：`packages/frontend/src/pages/ProfilePage.tsx`

头像上传 + 预览 + hover camera 图标。点击头像 → 触发文件选择 → `apiClient.post('/users/me/avatar', form)` → 成功后更新 `authStore.user.avatarUrl` → 头像立即刷新。

## 踩坑记录

### 坑 1：Vite 代理不转发 `/uploads`
**现象**：前端 `<img src="/uploads/avatars/xxx.png">` 返回 404  
**原因**：Vite 开发服务器只代理了 `/api` 和 `/socket.io`，没有代理静态文件路径  
**解决**：在 `vite.config.ts` 中添加 `/uploads` proxy

### 坑 2：multer 的 fileFilter 必须是同步的
**现象**：异步检查文件类型时 multer 忽略回调  
**原因**：multer 的 `fileFilter` 预期同步调用 `cb()`  
**解决**：用同步的白名单匹配

## 延伸阅读

- [multer 官方文档](https://github.com/expressjs/multer)
- [OWASP File Upload Security](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [FormData API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/FormData)
- [Express Static Files](https://expressjs.com/en/starter/static-files.html)

---

## 新增/修改文件清单

```
packages/backend/
├── src/
│   ├── services/attachment.service.ts     ✅ 新增 (storeFile/readFile/deleteFile)
│   ├── controllers/attachment.controller.ts ✅ 新增 (multer + upload/list/download/remove)
│   ├── controllers/user.controller.ts      ✅ 修改 (uploadAvatar)
│   ├── routes/attachment.routes.ts         ✅ 新增
│   ├── routes/user.routes.ts               ✅ 修改 (avatar upload)
│   └── app.ts                              ✅ 修改 (attachment routes + static /uploads)

packages/frontend/
├── src/
│   ├── api/attachments.ts                  ✅ 新增
│   ├── components/common/FileUpload.tsx    ✅ 新增 (拖拽上传)
│   ├── components/task/TaskDetailSheet.tsx  ✅ 修改 (接入 FileUpload)
│   ├── pages/ProfilePage.tsx               ✅ 修改 (头像上传)
│   └── vite.config.ts                      ✅ 修改 (/uploads proxy)

docs/
└── phase-6-file-uploads.md                 ✅ 本文档
```

## API 端点

```
POST   /api/tasks/:taskId/attachments  → 上传文件 (multipart, 最多5个)
GET    /api/tasks/:taskId/attachments  → 列表附件
GET    /api/attachments/:id/download   → 下载/预览文件
DELETE /api/attachments/:id            → 删除附件

POST   /api/users/me/avatar            → 上传头像 (multipart, 单文件)
GET    /uploads/*                      → 静态文件访问
```

**下一步**：Phase 7 — 全文搜索
