/* =============================================
   RUBHI - Admin Portal JS
   ============================================= */

// ---- Dashboard ----
Router.register('admin', async () => {
  const res = await api.adminDashboard();
  if (!res.ok) return;
  const d = res.data;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = RubhiUtils.formatNumber(val); };
  set('stat-users', d.total_users);
  set('stat-posts', d.total_posts);
  set('stat-comments', d.total_comments);
  set('stat-stories', d.total_stories);
  set('stat-messages', d.total_messages);
  set('stat-verifications', d.pending_verifications);
  set('stat-reports', d.pending_reports);
  const subEl = document.getElementById('stat-new-users');
  if (subEl) subEl.textContent = `+${RubhiUtils.formatNumber(d.new_users_this_week)} this week`;
});

// ---- Users ----
Router.register('admin-users', async () => {
  await AdminUsers.load();
});

const AdminUsers = {
  page: 1,
  search: '',

  async load(page = 1, search = '') {
    this.page = page; this.search = search;
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:var(--sp-8)"><span class="spinner"></span></td></tr>`;
    const res = await api.adminGetUsers(page, search);
    tbody.innerHTML = '';
    if (!res.ok) { tbody.innerHTML = `<tr><td colspan="10" class="text-muted p-4">Failed to load.</td></tr>`; return; }
    const { users, total, limit } = res.data;
    if (!users.length) { tbody.innerHTML = `<tr><td colspan="10" class="text-muted p-4">No users found.</td></tr>`; return; }
    users.forEach(u => {
      tbody.innerHTML += `
        <tr>
          <td class="text-muted text-sm">#${u.id}</td>
          <td>${RubhiUtils.avatarHtml(u,'avatar-xs')}</td>
          <td>${RubhiUtils.escapeHtml(u.full_name)}</td>
          <td class="text-muted">@${RubhiUtils.escapeHtml(u.username)}</td>
          <td class="text-muted text-sm">${RubhiUtils.escapeHtml(u.email)}</td>
          <td class="text-muted text-sm">${RubhiUtils.formatNumber(u.followers_count)}</td>
          <td class="text-muted text-sm">${RubhiUtils.formatNumber(u.following_count)}</td>
          <td><span class="badge ${u.role==='admin'?'badge-accent':'badge-surface'}">${u.role}</span></td>
          <td><span class="badge ${u.is_banned?'badge-red':u.is_verified?'badge-green':'badge-surface'}">${u.is_banned?'Banned':u.is_verified?'Verified':'Active'}</span></td>
          <td class="text-muted text-sm">${RubhiUtils.formatFullDate(u.created_at)}</td>
          <td>
            <div class="flex gap-1">
              <button class="btn btn-ghost btn-sm" onclick="AdminUsers.view(${u.id})" title="View">👁</button>
              <button class="btn btn-ghost btn-sm" onclick="AdminUsers.toggleBan(${u.id},'${u.is_banned}')" title="${u.is_banned?'Unban':'Ban'}">${u.is_banned?'✅':'🚫'}</button>
              <button class="btn btn-ghost btn-sm" onclick="AdminUsers.toggleVerify(${u.id},'${u.is_verified}')" title="${u.is_verified?'Remove Badge':'Verify'}">${u.is_verified?'💙':'🔵'}</button>
              <button class="btn btn-ghost btn-sm" title="Delete" onclick="AdminUsers.deleteUser(${u.id})">🗑</button>
            </div>
          </td>
        </tr>`;
    });
    renderAdminPagination('admin-users-pagination', page, Math.ceil(total/limit), (p) => AdminUsers.load(p, this.search));
  },

  async view(id) {
    const res = await api.adminGetUser(id);
    if (!res.ok) return;
    const { user, recent_posts } = res.data;
    const modal = document.getElementById('admin-user-modal');
    document.getElementById('admin-user-modal-body').innerHTML = `
      <div class="flex gap-4 items-start mb-6">
        ${RubhiUtils.avatarHtml(user,'avatar-xl')}
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span style="font-size:var(--text-lg);font-weight:var(--weight-semi)">${RubhiUtils.escapeHtml(user.full_name)}</span>
            ${user.is_verified ? RubhiUtils.verifiedBadge('verified-badge-lg') : ''}
          </div>
          <div class="text-muted text-sm mb-1">@${RubhiUtils.escapeHtml(user.username)}</div>
          <div class="text-muted text-sm mb-2">${RubhiUtils.escapeHtml(user.email)}</div>
          <div class="flex gap-2 flex-wrap">
            <span class="badge ${user.role==='admin'?'badge-accent':'badge-surface'}">${user.role}</span>
            <span class="badge ${user.is_banned?'badge-red':'badge-green'}">${user.is_banned?'Banned':'Active'}</span>
            ${user.is_verified?'<span class="badge badge-blue">Verified</span>':''}
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--sp-3);margin-bottom:var(--sp-4)">
        ${[['Posts',user.posts_count],['Followers',user.followers_count],['Following',user.following_count],['Stories',user.stories_count]].map(([l,v])=>
          `<div style="background:var(--surface-2);border-radius:var(--radius-lg);padding:var(--sp-3);text-align:center">
            <div style="font-size:var(--text-xl);font-weight:var(--weight-bold)">${RubhiUtils.formatNumber(v)}</div>
            <div class="text-xs text-muted">${l}</div>
          </div>`).join('')}
      </div>
      ${user.bio ? `<p class="text-sm text-muted mb-4">${RubhiUtils.escapeHtml(user.bio)}</p>` : ''}
      <p class="text-xs text-muted">Joined ${RubhiUtils.formatFullDate(user.created_at)}</p>
      <div class="flex gap-2 mt-4 flex-wrap">
        <button class="btn btn-secondary btn-sm" onclick="AdminUsers.toggleBan(${user.id},'${user.is_banned}')">${user.is_banned?'Unban User':'Ban User'}</button>
        <button class="btn btn-secondary btn-sm" onclick="AdminUsers.toggleVerify(${user.id},'${user.is_verified}')">${user.is_verified?'Remove Badge':'Grant Badge'}</button>
        <button class="btn btn-danger btn-sm" onclick="AdminUsers.deleteUser(${user.id})">Delete User</button>
      </div>`;
    RubhiUtils.openModal('admin-user-modal');
  },

  async toggleBan(id, isBanned) {
    const res = isBanned === 'true' ? await api.adminUnbanUser(id) : await api.adminBanUser(id);
    if (res.ok) { RubhiUtils.showToast(res.data.message, 'success'); this.load(this.page, this.search); RubhiUtils.closeAllModals(); }
    else RubhiUtils.showToast('Action failed.', 'error');
  },

  async toggleVerify(id, isVerified) {
    const res = await api.adminVerifyUser(id, isVerified !== 'true');
    if (res.ok) { RubhiUtils.showToast(res.data.message, 'success'); this.load(this.page, this.search); RubhiUtils.closeAllModals(); }
    else RubhiUtils.showToast('Action failed.', 'error');
  },

  async deleteUser(id) {
    RubhiUtils.confirmAction('Permanently delete this user and all their data?', async () => {
      const res = await api.adminDeleteUser(id);
      if (res.ok) { RubhiUtils.showToast(res.data.message, 'success'); this.load(this.page, this.search); RubhiUtils.closeAllModals(); }
      else RubhiUtils.showToast('Failed.', 'error');
    }, true);
  }
};

// ---- Posts ----
Router.register('admin-posts', async () => { await AdminPosts.load(); });

const AdminPosts = {
  page: 1,
  async load(page = 1) {
    this.page = page;
    const tbody = document.getElementById('admin-posts-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:var(--sp-8)"><span class="spinner"></span></td></tr>`;
    const res = await api.adminGetPosts(page);
    tbody.innerHTML = '';
    if (!res.ok) return;
    const { posts, total, limit } = res.data;
    posts.forEach(p => {
      tbody.innerHTML += `
        <tr>
          <td class="text-muted text-sm">#${p.id}</td>
          <td>${p.thumbnail ? `<img src="${p.thumbnail}" style="width:48px;height:48px;object-fit:cover;border-radius:var(--radius-md)">` : '—'}</td>
          <td>@${RubhiUtils.escapeHtml(p.username)}</td>
          <td class="text-muted text-sm">${p.media_count}</td>
          <td class="text-muted text-sm">${RubhiUtils.formatNumber(p.likes_count)}</td>
          <td class="text-muted text-sm">${RubhiUtils.formatNumber(p.comments_count)}</td>
          <td><span class="badge ${p.is_hidden?'badge-red':'badge-green'}">${p.is_hidden?'Hidden':'Visible'}</span></td>
          <td class="text-muted text-sm">${RubhiUtils.formatFullDate(p.created_at)}</td>
          <td>
            <div class="flex gap-1">
              <button class="btn btn-ghost btn-sm" onclick="AdminPosts.toggleHide(${p.id},'${p.is_hidden}')" title="${p.is_hidden?'Restore':'Hide'}">${p.is_hidden?'👁':'🚫'}</button>
              <button class="btn btn-ghost btn-sm" onclick="AdminPosts.deletePost(${p.id})" title="Delete">🗑</button>
            </div>
          </td>
        </tr>`;
    });
    renderAdminPagination('admin-posts-pagination', page, Math.ceil(total/limit), (p) => AdminPosts.load(p));
  },
  async toggleHide(id, isHidden) {
    const res = isHidden === 'true' ? await api.adminRestorePost(id) : await api.adminHidePost(id);
    if (res.ok) { RubhiUtils.showToast(res.data.message,'success'); this.load(this.page); }
  },
  async deletePost(id) {
    RubhiUtils.confirmAction('Delete this post?', async () => {
      const res = await api.adminDeletePost(id);
      if (res.ok) { RubhiUtils.showToast('Post deleted.','success'); this.load(this.page); }
    }, true);
  }
};

// ---- Comments ----
Router.register('admin-comments', async () => { await AdminComments.load(); });

const AdminComments = {
  page: 1,
  async load(page = 1) {
    this.page = page;
    const tbody = document.getElementById('admin-comments-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:var(--sp-8)"><span class="spinner"></span></td></tr>`;
    const res = await api.adminGetComments(page);
    tbody.innerHTML = '';
    if (!res.ok) return;
    const { comments, total, limit } = res.data;
    comments.forEach(c => {
      tbody.innerHTML += `
        <tr>
          <td class="text-muted text-sm">#${c.id}</td>
          <td>@${RubhiUtils.escapeHtml(c.username)}</td>
          <td class="text-muted text-sm">#${c.post_id}</td>
          <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${RubhiUtils.escapeHtml(c.comment)}</td>
          <td class="text-muted text-sm">${RubhiUtils.formatFullDate(c.created_at)}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="AdminComments.del(${c.id})" title="Delete">🗑</button></td>
        </tr>`;
    });
    renderAdminPagination('admin-comments-pagination', page, Math.ceil(total/limit), (p) => AdminComments.load(p));
  },
  async del(id) {
    RubhiUtils.confirmAction('Delete this comment?', async () => {
      const res = await api.adminDeleteComment(id);
      if (res.ok) { RubhiUtils.showToast('Comment deleted.','success'); this.load(this.page); }
    }, true);
  }
};

// ---- Stories ----
Router.register('admin-stories', async () => { await AdminStories.load(); });

const AdminStories = {
  page: 1,
  async load(page = 1) {
    this.page = page;
    const tbody = document.getElementById('admin-stories-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:var(--sp-8)"><span class="spinner"></span></td></tr>`;
    const res = await api.adminGetStories(page);
    tbody.innerHTML = '';
    if (!res.ok) return;
    const { stories, total, limit } = res.data;
    stories.forEach(s => {
      tbody.innerHTML += `
        <tr>
          <td class="text-muted text-sm">#${s.id}</td>
          <td>@${RubhiUtils.escapeHtml(s.username)}</td>
          <td>${s.media_type === 'video'
            ? `<video src="${s.media_url}" style="width:48px;height:48px;object-fit:cover;border-radius:var(--radius-md)" muted></video>`
            : `<img src="${s.media_url}" style="width:48px;height:48px;object-fit:cover;border-radius:var(--radius-md)">`}</td>
          <td><span class="badge ${s.status==='active'?'badge-green':'badge-red'}">${s.status}</span></td>
          <td class="text-muted text-sm">${RubhiUtils.formatFullDate(s.created_at)}</td>
          <td class="text-muted text-sm">${RubhiUtils.formatFullDate(s.expires_at)}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="AdminStories.del(${s.id})" title="Delete">🗑</button></td>
        </tr>`;
    });
    renderAdminPagination('admin-stories-pagination', page, Math.ceil(total/limit), (p) => AdminStories.load(p));
  },
  async del(id) {
    RubhiUtils.confirmAction('Delete this story?', async () => {
      const res = await api.adminDeleteStory(id);
      if (res.ok) { RubhiUtils.showToast('Story deleted.','success'); this.load(this.page); }
    }, true);
  }
};

// ---- Messages ----
Router.register('admin-messages', async () => { await AdminMessages.load(); });

const AdminMessages = {
  page: 1,
  async load(page = 1) {
    this.page = page;
    const tbody = document.getElementById('admin-msgs-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:var(--sp-8)"><span class="spinner"></span></td></tr>`;
    const res = await api.adminGetMessages(page);
    tbody.innerHTML = '';
    if (!res.ok) return;
    const { messages, total, limit } = res.data;
    messages.forEach(m => {
      tbody.innerHTML += `
        <tr>
          <td class="text-muted text-sm">#${m.id}</td>
          <td>@${RubhiUtils.escapeHtml(m.sender_username)}</td>
          <td>@${RubhiUtils.escapeHtml(m.receiver_username)}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.is_deleted_for_everyone ? '<em class="text-muted">Deleted</em>' : RubhiUtils.escapeHtml(m.message || '') || (m.media_url ? '📎 Media' : '')}</td>
          <td><span class="badge badge-surface">${m.status}</span></td>
          <td class="text-muted text-sm">${RubhiUtils.formatFullDate(m.created_at)}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="AdminMessages.del(${m.id})" title="Delete">🗑</button></td>
        </tr>`;
    });
    renderAdminPagination('admin-msgs-pagination', page, Math.ceil(total/limit), (p) => AdminMessages.load(p));
  },
  async del(id) {
    RubhiUtils.confirmAction('Delete this message?', async () => {
      const res = await api.adminDeleteMessage(id);
      if (res.ok) { RubhiUtils.showToast('Message deleted.','success'); this.load(this.page); }
    }, true);
  }
};

// ---- Verification ----
Router.register('admin-verification', async () => { await AdminVerification.load(); });

const AdminVerification = {
  async load() {
    const tbody = document.getElementById('admin-verif-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:var(--sp-8)"><span class="spinner"></span></td></tr>`;
    const res = await api.adminGetVerifications();
    tbody.innerHTML = '';
    if (!res.ok) return;
    const { requests } = res.data;
    if (!requests.length) { tbody.innerHTML = `<tr><td colspan="6" class="text-muted p-4">No verification requests.</td></tr>`; return; }
    requests.forEach(r => {
      tbody.innerHTML += `
        <tr>
          <td class="text-muted text-sm">#${r.id}</td>
          <td>${RubhiUtils.avatarHtml(r,'avatar-xs')} @${RubhiUtils.escapeHtml(r.username)}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${RubhiUtils.escapeHtml(r.reason)}</td>
          <td>${r.document_url ? `<a href="${r.document_url}" target="_blank" class="text-accent text-sm">View Doc</a>` : '—'}</td>
          <td><span class="badge ${r.status==='pending'?'badge-yellow':r.status==='approved'?'badge-green':'badge-red'}">${r.status}</span></td>
          <td class="text-muted text-sm">${RubhiUtils.formatFullDate(r.created_at)}</td>
          <td>
            ${r.status === 'pending' ? `
              <button class="btn btn-primary btn-sm" onclick="AdminVerification.approve(${r.id})">Approve</button>
              <button class="btn btn-danger btn-sm ml-1" onclick="AdminVerification.reject(${r.id})">Reject</button>` : '—'}
          </td>
        </tr>`;
    });
  },
  async approve(id) {
    const res = await api.adminApproveVerification(id);
    if (res.ok) { RubhiUtils.showToast(res.data.message,'success'); this.load(); }
    else RubhiUtils.showToast('Failed.','error');
  },
  async reject(id) {
    const res = await api.adminRejectVerification(id);
    if (res.ok) { RubhiUtils.showToast('Request rejected.','info'); this.load(); }
    else RubhiUtils.showToast('Failed.','error');
  }
};

// ---- Reports ----
Router.register('admin-reports', async () => { await AdminReports.load(); });

const AdminReports = {
  async load() {
    const tbody = document.getElementById('admin-reports-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:var(--sp-8)"><span class="spinner"></span></td></tr>`;
    const res = await api.adminGetReports();
    tbody.innerHTML = '';
    if (!res.ok) return;
    const { reports } = res.data;
    if (!reports.length) { tbody.innerHTML = `<tr><td colspan="6" class="text-muted p-4">No reports.</td></tr>`; return; }
    reports.forEach(r => {
      tbody.innerHTML += `
        <tr>
          <td class="text-muted text-sm">#${r.id}</td>
          <td>@${RubhiUtils.escapeHtml(r.reporter_username)}</td>
          <td><span class="badge badge-surface">${r.target_type}</span> #${r.target_id}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${RubhiUtils.escapeHtml(r.reason)}</td>
          <td><span class="badge ${r.status==='pending'?'badge-yellow':r.status==='dismissed'?'badge-surface':'badge-red'}">${r.status}</span></td>
          <td class="text-muted text-sm">${RubhiUtils.formatFullDate(r.created_at)}</td>
          <td>
            ${r.status==='pending' ? `
              <button class="btn btn-ghost btn-sm" onclick="AdminReports.dismiss(${r.id})">Dismiss</button>
              <button class="btn btn-danger btn-sm" onclick="AdminReports.del(${r.id})">Delete</button>` : '—'}
          </td>
        </tr>`;
    });
  },
  async dismiss(id) {
    const res = await api.adminDismissReport(id);
    if (res.ok) { RubhiUtils.showToast('Report dismissed.','info'); this.load(); }
  },
  async del(id) {
    RubhiUtils.confirmAction('Delete this report?', async () => {
      const res = await api.adminDeleteReport(id);
      if (res.ok) { RubhiUtils.showToast('Report deleted.','success'); this.load(); }
    }, true);
  }
};

// ---- Settings ----
Router.register('admin-settings', async () => {
  const res = await api.adminGetSettings();
  if (!res.ok) return;
  const s = res.data.settings;
  const setToggle = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val === 'true'; };
  setToggle('setting-registrations', s.registrations_enabled);
  setToggle('setting-stories', s.stories_enabled);
  setToggle('setting-messaging', s.messaging_enabled);
  setToggle('setting-verification', s.verification_requests_enabled);
  setToggle('setting-private', s.private_accounts_enabled);
  const sizeEl = document.getElementById('setting-upload-size');
  if (sizeEl) sizeEl.value = s.max_upload_size_mb || 50;
});

async function saveAdminSettings() {
  const get = (id) => document.getElementById(id);
  const data = {
    registrations_enabled:         get('setting-registrations')?.checked,
    stories_enabled:               get('setting-stories')?.checked,
    messaging_enabled:             get('setting-messaging')?.checked,
    verification_requests_enabled: get('setting-verification')?.checked,
    private_accounts_enabled:      get('setting-private')?.checked,
    max_upload_size_mb:            get('setting-upload-size')?.value,
  };
  const res = await api.adminSaveSettings(data);
  RubhiUtils.showToast(res.ok ? 'Settings saved.' : 'Failed to save.', res.ok ? 'success' : 'error');
}

// ---- Helpers ----
function renderAdminPagination(containerId, currentPage, totalPages, onPage) {
  const el = document.getElementById(containerId);
  if (!el || totalPages <= 1) { if (el) el.innerHTML = ''; return; }
  let html = `<div class="flex items-center gap-2" style="justify-content:flex-end;padding:var(--sp-3) 0">`;
  html += `<button class="btn btn-secondary btn-sm" ${currentPage<=1?'disabled':''} onclick="(${onPage.toString()})(${currentPage-1})">← Prev</button>`;
  html += `<span class="text-sm text-muted">Page ${currentPage} of ${totalPages}</span>`;
  html += `<button class="btn btn-secondary btn-sm" ${currentPage>=totalPages?'disabled':''} onclick="(${onPage.toString()})(${currentPage+1})">Next →</button>`;
  html += `</div>`;
  el.innerHTML = html;
}

window.AdminUsers = AdminUsers;
window.AdminPosts = AdminPosts;
window.AdminComments = AdminComments;
window.AdminStories = AdminStories;
window.AdminMessages = AdminMessages;
window.AdminVerification = AdminVerification;
window.AdminReports = AdminReports;
window.saveAdminSettings = saveAdminSettings;
