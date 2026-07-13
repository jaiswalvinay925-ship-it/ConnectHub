/* =============================================
   RUBHI - Messages Page (Fixed)
   ============================================= */

Router.register('messages', async (params) => {
  const convList  = document.getElementById('conv-list');
  const chatPanel = document.getElementById('chat-panel');
  const emptyChat = document.getElementById('chat-empty');
  if (!convList) return;

  // Build the sidebar with search + new chat button
  const sidebar = convList.closest ? convList.parentElement : null;
  if (sidebar && !document.getElementById('msg-search-input')) {
    convList.insertAdjacentHTML('beforebegin', `
      <div style="padding:12px 14px;border-bottom:1px solid var(--border);display:flex;gap:8px;align-items:center">
        <div style="position:relative;flex:1">
          <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--white-30)" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input id="msg-search-input" type="text" class="form-input" placeholder="Search conversations…" style="padding-left:32px;font-size:13px;height:36px" oninput="MessagesPage.searchConvs(this.value)">
        </div>
        <button class="btn btn-primary btn-sm" title="New message" onclick="MessagesPage.openNewChat()" style="padding:0;width:36px;height:36px;border-radius:8px;flex-shrink:0">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>`);
  }

  await MessagesPage.loadConversations();

  if (params?.userId) {
    await openChat(params.userId, params.username || '', params.full_name || '', null);
  }
});

const MessagesPage = {
  _allConvs: [],

  async loadConversations() {
    const convList = document.getElementById('conv-list');
    if (!convList) return;
    convList.innerHTML = `<div style="display:flex;justify-content:center;padding:24px"><span class="spinner"></span></div>`;

    const res = await api.getConversations();
    convList.innerHTML = '';

    if (!res.ok) {
      convList.innerHTML = `<div style="padding:16px;color:var(--white-50);font-size:13px;text-align:center">Could not load conversations.</div>`;
      return;
    }

    this._allConvs = res.data.conversations || [];

    if (!this._allConvs.length) {
      convList.innerHTML = `
        <div style="padding:32px 16px;text-align:center">
          <p style="color:var(--white-50);font-size:14px;margin-bottom:12px">No messages yet</p>
          <button class="btn btn-primary btn-sm" onclick="MessagesPage.openNewChat()">Start a conversation</button>
        </div>`;
      return;
    }

    this.renderConvList(this._allConvs);
  },

  renderConvList(convs) {
    const convList = document.getElementById('conv-list');
    if (!convList) return;
    convList.innerHTML = '';
    convs.forEach(c => {
      const isMe = c.last_sender_id === Auth.user?.id;
      const preview = c.last_message || (c.last_media_url ? '📎 Media' : 'Say hello!');
      const item = document.createElement('div');
      item.className = 'conv-item';
      item.dataset.userId = c.other_user;
      item.style.cssText = `
        display:flex;align-items:center;gap:12px;
        padding:12px 16px;border-bottom:1px solid var(--border);
        cursor:pointer;transition:background .15s;`;
      item.innerHTML = `
        <div style="position:relative;flex-shrink:0">
          ${RubhiUtils.avatarHtml(c, 'avatar-md')}
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
            <span style="font-size:14px;font-weight:600;color:var(--white);display:flex;align-items:center;gap:4px">
              ${RubhiUtils.escapeHtml(c.full_name || c.username)}
              ${c.is_verified ? RubhiUtils.verifiedBadge() : ''}
            </span>
            <span style="font-size:11px;color:var(--white-30)">${c.last_message_time ? RubhiUtils.timeAgo(c.last_message_time) : ''}</span>
          </div>
          <div style="font-size:12px;color:var(--white-30);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            ${isMe ? 'You: ' : ''}${RubhiUtils.escapeHtml(preview)}
          </div>
        </div>
        ${parseInt(c.unread_count) > 0 ? `<span class="nav-badge" style="flex-shrink:0">${c.unread_count}</span>` : ''}`;
      item.addEventListener('mouseenter', () => item.style.background = 'var(--white-08)');
      item.addEventListener('mouseleave', () => {
        item.style.background = currentChatUserId == c.other_user ? 'var(--white-08)' : '';
      });
      item.addEventListener('click', () => openChat(c.other_user, c.username, c.full_name, c));
      convList.appendChild(item);
    });
  },

  searchConvs(q) {
    if (!q.trim()) { this.renderConvList(this._allConvs); return; }
    const filtered = this._allConvs.filter(c =>
      (c.full_name||'').toLowerCase().includes(q.toLowerCase()) ||
      (c.username||'').toLowerCase().includes(q.toLowerCase())
    );
    this.renderConvList(filtered);
  },

  openNewChat() {
    const overlay = document.getElementById('new-chat-modal');
    const input   = document.getElementById('new-chat-search');
    const results = document.getElementById('new-chat-results');
    if (!overlay) return;
    input.value = '';
    results.innerHTML = `<p style="color:var(--white-30);font-size:13px;text-align:center;padding:20px">Search for a user to message</p>`;
    RubhiUtils.openModal('new-chat-modal');

    const doSearch = RubhiUtils.debounce(async () => {
      const q = input.value.trim();
      if (!q) return;
      results.innerHTML = `<div style="display:flex;justify-content:center;padding:16px"><span class="spinner spinner-sm"></span></div>`;
      const res = await api.searchUsers(q);
      results.innerHTML = '';
      if (!res.ok || !res.data.users.length) {
        results.innerHTML = `<p style="color:var(--white-30);font-size:13px;text-align:center;padding:20px">No users found</p>`;
        return;
      }
      res.data.users.forEach(u => {
        const row = document.createElement('div');
        row.className = 'user-list-item';
        row.style.padding = '10px 16px';
        row.innerHTML = `
          ${RubhiUtils.avatarHtml(u,'avatar-sm')}
          <div class="user-list-info">
            <div class="user-list-name">${RubhiUtils.escapeHtml(u.full_name)}${u.is_verified?RubhiUtils.verifiedBadge():''}</div>
            <div class="user-list-username">@${RubhiUtils.escapeHtml(u.username)}</div>
          </div>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--white-30)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
        row.addEventListener('click', () => {
          RubhiUtils.closeModal('new-chat-modal');
          openChat(u.id, u.username, u.full_name, u);
        });
        results.appendChild(row);
      });
    }, 300);

    input.addEventListener('input', doSearch);
    setTimeout(() => input.focus(), 100);
  }
};

let currentChatUserId = null;
let messageRefreshTimer = null;

async function openChat(userId, username, fullName, userData) {
  userId = parseInt(userId);
  currentChatUserId = userId;
  clearInterval(messageRefreshTimer);

  const chatPanel = document.getElementById('chat-panel');
  const emptyChat = document.getElementById('chat-empty');
  if (emptyChat) emptyChat.style.display = 'none';
  if (chatPanel) chatPanel.style.display = 'flex';

  // Highlight selected conv
  document.querySelectorAll('.conv-item').forEach(el => {
    el.style.background = parseInt(el.dataset.userId) === userId ? 'var(--white-08)' : '';
  });

  // Set header
  document.getElementById('chat-user-name').textContent = fullName || username;
  document.getElementById('chat-username').textContent  = '@' + (username || '');
  document.getElementById('chat-header-avatar').innerHTML = RubhiUtils.avatarHtml(
    userData || { username, full_name: fullName }, 'avatar-sm'
  );
  document.getElementById('chat-header-link').onclick = () => Router.navigate('profile', { username });

  // Block button in header
  let blockBtnEl = document.getElementById('chat-block-btn');
  if (!blockBtnEl) {
    const headerRight = document.getElementById('chat-header-right');
    if (headerRight) {
      headerRight.insertAdjacentHTML('beforeend',
        `<button id="chat-block-btn" class="btn btn-ghost btn-sm" style="color:var(--red);font-size:12px"></button>`);
      blockBtnEl = document.getElementById('chat-block-btn');
    }
  }

  await loadMessages(userId);

  const input   = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send-btn');
  const mediaBtn  = document.getElementById('chat-media-btn');
  const mediaInput = document.getElementById('chat-media-input');

  input.oninput = () => { sendBtn.disabled = !input.value.trim(); };
  sendBtn.onclick = () => sendMessage(userId);
  input.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(userId); } };
  if (mediaBtn && mediaInput) {
    mediaBtn.onclick   = () => mediaInput.click();
    mediaInput.onchange = () => sendMediaMessage(userId, mediaInput);
  }

  // Set block button state
  if (blockBtnEl) {
    const br = await api.checkBlock(userId);
    if (br.ok) {
      const iBlocked = br.data.i_blocked;
      blockBtnEl.textContent = iBlocked ? '🔓 Unblock' : '🚫 Block';
      blockBtnEl.onclick = () => {
        RubhiUtils.confirmAction(iBlocked ? 'Unblock this user?' : 'Block this user?', async () => {
          const res = iBlocked ? await api.unblockUser(userId) : await api.blockUser(userId);
          if (res.ok) {
            RubhiUtils.showToast(iBlocked ? 'Unblocked.' : 'User blocked.', 'success');
            await MessagesPage.loadConversations();
            openChat(userId, username, fullName, userData);
          }
        }, !iBlocked);
      };
    }
  }

  messageRefreshTimer = setInterval(() => loadMessages(userId, true), 5000);
}

async function loadMessages(userId, silent = false) {
  const msgArea = document.getElementById('messages-area');
  const inputArea = document.getElementById('chat-input-area');
  if (!msgArea) return;

  if (!silent) msgArea.innerHTML = `<div style="display:flex;justify-content:center;padding:40px"><span class="spinner"></span></div>`;

  const res = await api.getMessages(userId);
  if (!res.ok) {
    msgArea.innerHTML = `<div style="padding:24px;text-align:center;color:var(--white-30);font-size:13px">${res.data?.error || 'Failed to load messages.'}</div>`;
    if (inputArea) inputArea.style.display = 'none';
    return;
  }

  const { messages, they_blocked, i_blocked } = res.data;

  // Show/hide input based on block status
  if (inputArea) {
    if (they_blocked) {
      inputArea.style.display = 'none';
      msgArea.insertAdjacentHTML('afterend',
        `<div id="block-notice" style="padding:12px;text-align:center;background:var(--surface-2);font-size:13px;color:var(--red)">You have been blocked by this user.</div>`);
    } else if (i_blocked) {
      inputArea.style.display = 'none';
      const existing = document.getElementById('block-notice');
      if (!existing) msgArea.insertAdjacentHTML('afterend',
        `<div id="block-notice" style="padding:12px;text-align:center;background:var(--surface-2);font-size:13px;color:var(--white-50)">You have blocked this user. Unblock to send messages.</div>`);
    } else {
      inputArea.style.display = 'flex';
      document.getElementById('block-notice')?.remove();
    }
  }

  const wasAtBottom = msgArea.scrollHeight - msgArea.scrollTop <= msgArea.clientHeight + 80;
  msgArea.innerHTML = '';

  if (!messages.length) {
    msgArea.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;opacity:.5">
      <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
      <p style="font-size:14px">No messages yet. Say hello!</p>
    </div>`;
    return;
  }

  let lastDate = null;
  messages.forEach(m => {
    const msgDate = RubhiUtils.parseDate(m.created_at).toDateString();
    if (msgDate !== lastDate) {
      lastDate = msgDate;
      msgArea.innerHTML += `<div style="text-align:center;margin:12px 0">
        <span style="font-size:11px;color:var(--white-30);background:var(--surface-2);padding:3px 12px;border-radius:999px">
          ${RubhiUtils.formatFullDate(m.created_at)}
        </span></div>`;
    }
    msgArea.innerHTML += renderMessage(m);
  });

  if (!silent || wasAtBottom) msgArea.scrollTop = msgArea.scrollHeight;
}

function renderMessage(m) {
  const isMe = m.sender_id === Auth.user?.id;
  const deleted = m.is_deleted_for_everyone;
  const statusIcon = isMe ? (m.status === 'seen' ? '👁' : m.status === 'delivered' ? '✓✓' : '✓') : '';

  let content = '';
  if (deleted) {
    content = `<em style="font-size:12px;opacity:.5">Message deleted</em>`;
  } else if (m.media_url && m.media_type === 'video') {
    content = `<video src="${m.media_url}" controls style="max-width:220px;border-radius:10px;display:block"></video>`;
  } else if (m.media_url) {
    content = `<img src="${m.media_url}" style="max-width:220px;border-radius:10px;display:block;cursor:pointer" onclick="window.open('${m.media_url}','_blank')" loading="lazy">`;
  } else {
    content = `<span style="font-size:14px;line-height:1.5">${RubhiUtils.escapeHtml(m.message || '')}</span>`;
  }

  return `
    <div class="msg-row ${isMe ? 'msg-mine' : 'msg-theirs'}" data-msg-id="${m.id}"
         style="display:flex;justify-content:${isMe ? 'flex-end' : 'flex-start'};margin-bottom:6px;padding:0 16px;align-items:flex-end;gap:6px">
      ${!isMe ? `<div style="flex-shrink:0;margin-bottom:2px">${RubhiUtils.avatarHtml({}, 'avatar-xs')}</div>` : ''}
      <div style="max-width:65%;${isMe
        ? 'background:var(--accent);color:var(--black);border-radius:18px 18px 4px 18px'
        : 'background:var(--surface-2);color:var(--white-90);border-radius:18px 18px 18px 4px'};padding:10px 14px;position:relative;word-break:break-word">
        ${content}
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:4px;margin-top:4px">
          <span style="font-size:10px;opacity:.55">${RubhiUtils.timeAgo(m.created_at)}</span>
          ${isMe ? `<span style="font-size:10px;opacity:.6">${statusIcon}</span>` : ''}
        </div>
        ${isMe && !deleted ? `<button class="msg-delete-btn" onclick="deleteMsg(${m.id})"
          style="position:absolute;top:-8px;right:-8px;width:20px;height:20px;background:var(--red);border:2px solid var(--black-2);border-radius:50%;display:none;align-items:center;justify-content:center;cursor:pointer;font-size:11px;color:white;padding:0">×</button>` : ''}
      </div>
    </div>`;
}

document.addEventListener('mouseover', (e) => {
  const row = e.target.closest('.msg-row.msg-mine');
  if (row) { const b = row.querySelector('.msg-delete-btn'); if (b) b.style.display = 'flex'; }
});
document.addEventListener('mouseout', (e) => {
  const row = e.target.closest('.msg-row.msg-mine');
  if (row) { const b = row.querySelector('.msg-delete-btn'); if (b) b.style.display = 'none'; }
});

async function sendMessage(userId) {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  const form = new FormData();
  form.append('receiver_id', userId);
  form.append('message', text);
  input.value = '';
  document.getElementById('chat-send-btn').disabled = true;
  const res = await api.sendMessage(form);
  document.getElementById('chat-send-btn').disabled = false;
  if (res.ok) {
    await loadMessages(userId, true);
    // Refresh conv list silently
    api.getConversations().then(r => { if (r.ok) MessagesPage._allConvs = r.data.conversations; });
  } else {
    RubhiUtils.showToast(res.data?.error || 'Failed to send.', 'error');
  }
}

async function sendMediaMessage(userId, input) {
  const file = input.files[0];
  if (!file) return;
  const form = new FormData();
  form.append('receiver_id', userId);
  form.append('media', file);
  const res = await api.sendMessage(form);
  if (res.ok) await loadMessages(userId, true);
  else RubhiUtils.showToast(res.data?.error || 'Failed to send.', 'error');
  input.value = '';
}

async function deleteMsg(msgId) {
  RubhiUtils.confirmAction('Delete this message for everyone?', async () => {
    const res = await api.deleteMessage(msgId);
    if (res.ok && currentChatUserId) await loadMessages(currentChatUserId, true);
  }, true);
}

window.MessagesPage = MessagesPage;
window.openChat     = openChat;
window.deleteMsg    = deleteMsg;
