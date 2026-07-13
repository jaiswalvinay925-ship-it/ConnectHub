/* =============================================
   RUBHI - Notifications Page
   ============================================= */

Router.register('notifications', async () => {
  const list = document.getElementById('notif-list');
  const markAllBtn = document.getElementById('notif-mark-all');
  if (!list) return;

  list.innerHTML = `<div class="flex justify-center p-8"><span class="spinner spinner-lg"></span></div>`;

  const res = await api.getNotifications();
  list.innerHTML = '';

  if (!res.ok) {
    list.innerHTML = `<div class="empty-state"><p class="empty-state-title">Failed to load notifications.</p></div>`;
    return;
  }

  const { notifications, unread_count } = res.data;

  // Update badge
  updateNotifBadge(unread_count);

  if (markAllBtn) {
    markAllBtn.style.display = unread_count > 0 ? '' : 'none';
    markAllBtn.onclick = async () => {
      await api.markAllRead();
      document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
      markAllBtn.style.display = 'none';
      updateNotifBadge(0);
    };
  }

  if (!notifications.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${bellIcon()}</div>
        <p class="empty-state-title">No notifications yet</p>
        <p class="empty-state-desc">When someone likes or comments on your posts, you'll see it here.</p>
      </div>`;
    return;
  }

  notifications.forEach(n => {
    const text = getNotifText(n);
    list.innerHTML += `
      <div class="notif-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}"
           onclick="handleNotifClick(${n.id},'${n.type}',${n.reference_id})">
        <div style="position:relative">
          ${RubhiUtils.avatarHtml(n, 'avatar-md')}
          <div style="position:absolute;bottom:-2px;right:-2px;width:20px;height:20px;border-radius:50%;background:var(--surface-2);display:flex;align-items:center;justify-content:center">
            ${notifTypeIcon(n.type)}
          </div>
        </div>
        <div class="notif-content">
          <p class="notif-text">${text}</p>
          <p class="notif-time">${RubhiUtils.timeAgo(n.created_at)}</p>
        </div>
        ${!n.is_read ? '<div class="unread-dot" style="flex-shrink:0;margin-top:4px"></div>' : ''}
      </div>`;
  });
});

function getNotifText(n) {
  const name = `<strong>${RubhiUtils.escapeHtml(n.full_name || n.username)}</strong>`;
  switch (n.type) {
    case 'like':            return `${name} liked your post`;
    case 'comment':         return `${name} commented on your post`;
    case 'follow':          return `${name} started following you`;
    case 'follow_request':  return `${name} sent you a follow request`;
    case 'follow_accepted': return `${name} accepted your follow request`;
    default:                return `${name} interacted with you`;
  }
}

function notifTypeIcon(type) {
  const icons = {
    like:            `<svg viewBox="0 0 24 24" width="11" height="11" fill="var(--red)" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`,
    comment:         `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="var(--blue)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
    follow:          `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`,
    follow_request:  `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="var(--yellow)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    follow_accepted: `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
  };
  return icons[type] || icons.follow;
}

async function handleNotifClick(id, type, refId) {
  await api.markRead(id);
  const el = document.querySelector(`.notif-item[data-id="${id}"]`);
  if (el) { el.classList.remove('unread'); el.querySelector('.unread-dot')?.remove(); }

  if (type === 'like' || type === 'comment') {
    PostCard.openComments(refId);
  } else if (type === 'follow' || type === 'follow_accepted') {
    Router.navigate('profile', { username: '' });
  }
}

function updateNotifBadge(count) {
  document.querySelectorAll('[data-notif-badge]').forEach(el => {
    el.textContent = count > 0 ? (count > 99 ? '99+' : count) : '';
    el.style.display = count > 0 ? '' : 'none';
  });
}

function bellIcon() {
  return `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>`;
}

window.handleNotifClick = handleNotifClick;
window.updateNotifBadge = updateNotifBadge;
