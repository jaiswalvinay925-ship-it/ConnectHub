/* =============================================
   RUBHI - Post Card Component
   ============================================= */

const PostCard = {
  render(post) {
    const me = Auth.user;
    const isOwn = me?.id === post.user_id;
    const media = post.media || [];
    const hasMulti = media.length > 1;

    return `
    <div class="post-card" data-post-id="${post.id}">
      <div class="post-header">
        <div class="post-header-left" onclick="Router.navigate('profile',{username:'${RubhiUtils.escapeHtml(post.username)}'})">
          ${RubhiUtils.avatarHtml(post, 'avatar-md')}
          <div class="post-user-info">
            <div class="post-username">
              ${RubhiUtils.escapeHtml(post.full_name)}
              ${post.is_verified ? RubhiUtils.verifiedBadge() : ''}
            </div>
            <div class="post-timestamp">${RubhiUtils.timeAgo(post.created_at)}</div>
          </div>
        </div>
        <button class="post-options-btn" onclick="PostCard.showOptions(event,${post.id},${isOwn})" aria-label="Post options">
          ${dotsIcon()}
        </button>
      </div>
      ${media.length > 0 ? PostCard.renderMedia(media, post.id) : ''}
      <div class="post-actions">
        <button class="post-action-btn like-btn ${post.is_liked ? 'liked' : ''}"
          data-post-id="${post.id}" data-liked="${post.is_liked}"
          onclick="PostCard.toggleLike(this,${post.id})">
          ${heartIcon(post.is_liked)}
          <span class="post-action-count" data-likes="${post.id}">${RubhiUtils.formatNumber(post.likes_count)}</span>
        </button>
        <button class="post-action-btn" onclick="PostCard.openComments(${post.id})">
          ${commentIcon()}
          <span class="post-action-count">${RubhiUtils.formatNumber(post.comments_count)}</span>
        </button>
        <button class="post-action-btn" onclick="SharePost.open(${post.id},'${RubhiUtils.escapeHtml(post.username)}','${RubhiUtils.escapeHtml(post.caption || '')}')">
          ${shareIcon()}
        </button>
      </div>
      <div class="post-body">
        ${post.caption ? `<p class="post-caption"><span class="caption-username">${RubhiUtils.escapeHtml(post.username)}</span>${RubhiUtils.escapeHtml(post.caption)}</p>` : ''}
        ${post.comments_count > 0 ? `<div class="post-view-comments" onclick="PostCard.openComments(${post.id})">View all ${post.comments_count} comments</div>` : ''}
      </div>
      <div class="post-comment-input-row">
        ${RubhiUtils.avatarHtml(me, 'avatar-xs')}
        <input type="text" class="post-comment-input" placeholder="Add a comment…"
          data-post-id="${post.id}" oninput="PostCard.onCommentInput(this)">
        <button class="post-comment-submit" onclick="PostCard.submitComment(this)">Post</button>
      </div>
    </div>`;
  },

  renderMedia(media, postId) {
    if (media.length === 1) {
      const m = media[0];
      return `<div class="post-media-container">
        ${m.media_type === 'video'
          ? `<video src="${m.file_url}" controls playsinline style="width:100%;max-height:600px;object-fit:cover"></video>`
          : `<img src="${m.file_url}" alt="Post media" loading="lazy">`}
      </div>`;
    }
    const slides = media.map((m, i) => `
      <div class="carousel-slide">
        ${m.media_type === 'video'
          ? `<video src="${m.file_url}" controls playsinline style="width:100%;max-height:600px;object-fit:cover"></video>`
          : `<img src="${m.file_url}" alt="Post media" loading="lazy" style="width:100%;max-height:600px;object-fit:cover">`}
      </div>`).join('');
    const dots = media.map((_, i) => `<div class="carousel-dot ${i===0?'active':''}" data-idx="${i}"></div>`).join('');
    return `
      <div class="post-media-container">
        <div class="carousel-wrapper" data-post-id="${postId}">
          <div class="carousel-track">${slides}</div>
          <button class="carousel-btn prev" onclick="PostCard.carousel(event,'prev',${postId})">${chevronLeft()}</button>
          <button class="carousel-btn next" onclick="PostCard.carousel(event,'next',${postId})">${chevronRight()}</button>
          <div class="carousel-dots">${dots}</div>
          <div class="media-count-badge">1 / ${media.length}</div>
        </div>
      </div>`;
  },

  carousel(e, dir, postId) {
    e.stopPropagation();
    const wrapper = document.querySelector(`.carousel-wrapper[data-post-id="${postId}"]`);
    if (!wrapper) return;
    const track = wrapper.querySelector('.carousel-track');
    const slides = wrapper.querySelectorAll('.carousel-slide');
    const dots = wrapper.querySelectorAll('.carousel-dot');
    const badge = wrapper.querySelector('.media-count-badge');
    let idx = parseInt(wrapper.dataset.idx || 0);
    idx = dir === 'next' ? Math.min(idx + 1, slides.length - 1) : Math.max(idx - 1, 0);
    wrapper.dataset.idx = idx;
    track.style.transform = `translateX(-${idx * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    if (badge) badge.textContent = `${idx + 1} / ${slides.length}`;
  },

  async toggleLike(btn, postId) {
    const isLiked = btn.dataset.liked === 'true';
    btn.dataset.liked = (!isLiked).toString();
    btn.classList.toggle('liked', !isLiked);
    btn.querySelector('svg').outerHTML = isLiked ? heartIcon(false) : heartIcon(true);
    const countEl = document.querySelector(`[data-likes="${postId}"]`);

    const res = isLiked ? await api.unlikePost(postId) : await api.likePost(postId);
    if (res.ok && countEl) {
      countEl.textContent = RubhiUtils.formatNumber(res.data.likes_count);
    }
  },

  onCommentInput(input) {
    const btn = input.closest('.post-comment-input-row').querySelector('.post-comment-submit');
    btn?.classList.toggle('visible', input.value.trim().length > 0);
  },

  async submitComment(btn) {
    const row = btn.closest('.post-comment-input-row');
    const input = row.querySelector('.post-comment-input');
    const postId = parseInt(input.dataset.postId);
    const comment = input.value.trim();
    if (!comment) return;
    btn.disabled = true;
    const res = await api.addComment(postId, comment);
    btn.disabled = false;
    if (res.ok) {
      input.value = '';
      btn.classList.remove('visible');
      RubhiUtils.showToast('Comment added.', 'success');
    } else {
      RubhiUtils.showToast(res.data.error || 'Failed to add comment.', 'error');
    }
  },

  showOptions(e, postId, isOwn) {
    e.stopPropagation();
    document.querySelectorAll('.dropdown').forEach(d => d.remove());
    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown';
    dropdown.style.cssText = 'position:fixed;z-index:200';
    const rect = e.currentTarget.getBoundingClientRect();
    dropdown.style.top = `${rect.bottom + 6}px`;
    dropdown.style.right = `${window.innerWidth - rect.right}px`;

    let html = '';
    if (isOwn) {
      html += `<button class="dropdown-item" onclick="PostCard.editCaption(${postId})">Edit Caption</button>
               <button class="dropdown-item danger" onclick="PostCard.deletePost(${postId})">Delete Post</button>`;
    } else {
      html += `<button class="dropdown-item danger" onclick="PostCard.reportPost(${postId})">Report Post</button>`;
    }
    dropdown.innerHTML = html;
    document.body.appendChild(dropdown);
  },

  async deletePost(postId) {
    RubhiUtils.confirmAction('Delete this post permanently?', async () => {
      const res = await api.deletePost(postId);
      if (res.ok) {
        document.querySelector(`.post-card[data-post-id="${postId}"]`)?.remove();
        RubhiUtils.showToast('Post deleted.', 'success');
      }
    }, true);
  },

  editCaption(postId) {
    const card = document.querySelector(`.post-card[data-post-id="${postId}"]`);
    const captionEl = card?.querySelector('.post-caption');
    const current = captionEl?.childNodes[1]?.textContent || '';
    const newCaption = prompt('Edit caption:', current);
    if (newCaption === null) return;
    api.updatePost(postId, { caption: newCaption }).then(res => {
      if (res.ok) {
        if (captionEl) captionEl.childNodes[1].textContent = newCaption;
        RubhiUtils.showToast('Caption updated.', 'success');
      }
    });
  },

  reportPost(postId) {
    const reason = prompt('Why are you reporting this post?');
    if (!reason) return;
    api.submitReport({ target_type: 'post', target_id: postId, reason }).then(res => {
      RubhiUtils.showToast(res.ok ? 'Report submitted.' : 'Failed to submit report.', res.ok ? 'success' : 'error');
    });
  },

  async openComments(postId) {
    const overlay = document.getElementById('comments-modal');
    if (!overlay) return;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    const list = document.getElementById('comments-list');
    const input = document.getElementById('comments-input');
    const submitBtn = document.getElementById('comments-submit');
    list.innerHTML = `<div class="flex justify-center p-6"><span class="spinner"></span></div>`;
    overlay.dataset.postId = postId;

    const res = await api.getComments(postId);
    list.innerHTML = '';
    if (!res.ok) { list.innerHTML = '<p class="text-muted p-4">Failed to load comments.</p>'; return; }
    const { comments } = res.data;
    if (!comments.length) {
      list.innerHTML = `<div class="empty-state"><p class="empty-state-title">No comments yet</p></div>`;
    }
    comments.forEach(c => {
      const isOwn = c.user_id === Auth.user?.id;
      list.innerHTML += `
        <div class="comment-item" data-comment-id="${c.id}">
          ${RubhiUtils.avatarHtml(c, 'avatar-xs')}
          <div class="comment-body">
            <p class="comment-text"><span class="comment-author">${RubhiUtils.escapeHtml(c.username)}</span>${RubhiUtils.escapeHtml(c.comment)}</p>
            <div class="comment-meta">
              <span class="comment-time">${RubhiUtils.timeAgo(c.created_at)}</span>
              ${isOwn ? `<button class="comment-action danger" onclick="PostCard.deleteComment(${c.id},this)">Delete</button>` : ''}
            </div>
          </div>
        </div>`;
    });

    submitBtn.onclick = async () => {
      const text = input.value.trim();
      if (!text) return;
      submitBtn.disabled = true;
      const r = await api.addComment(postId, text);
      submitBtn.disabled = false;
      if (r.ok) {
        input.value = '';
        const c = r.data.comment;
        list.innerHTML += `
          <div class="comment-item" data-comment-id="${c.id}">
            ${RubhiUtils.avatarHtml(c, 'avatar-xs')}
            <div class="comment-body">
              <p class="comment-text"><span class="comment-author">${RubhiUtils.escapeHtml(c.username)}</span>${RubhiUtils.escapeHtml(c.comment)}</p>
              <div class="comment-meta">
                <span class="comment-time">just now</span>
                <button class="comment-action danger" onclick="PostCard.deleteComment(${c.id},this)">Delete</button>
              </div>
            </div>
          </div>`;
        list.scrollTop = list.scrollHeight;
      }
    };
  },

  async deleteComment(commentId, btn) {
    const res = await api.deleteComment(commentId);
    if (res.ok) btn.closest('.comment-item').remove();
  },

  attachHandlers() {
    // Dot navigation
    document.querySelectorAll('.carousel-dot').forEach(dot => {
      dot.addEventListener('click', (e) => {
        const idx = parseInt(dot.dataset.idx);
        const wrapper = dot.closest('.carousel-wrapper');
        if (!wrapper) return;
        const postId = parseInt(wrapper.dataset.postId);
        const track = wrapper.querySelector('.carousel-track');
        const dots = wrapper.querySelectorAll('.carousel-dot');
        const badge = wrapper.querySelector('.media-count-badge');
        wrapper.dataset.idx = idx;
        track.style.transform = `translateX(-${idx * 100}%)`;
        dots.forEach((d, i) => d.classList.toggle('active', i === idx));
        if (badge) {
          const total = wrapper.querySelectorAll('.carousel-slide').length;
          badge.textContent = `${idx + 1} / ${total}`;
        }
      });
    });
  }
};

// SVG helpers
function heartIcon(filled) {
  return `<svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="${filled ? 'currentColor' : 'none'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`;
}
function commentIcon() {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`;
}
function shareIcon() {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
}
function dotsIcon() {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>`;
}
function chevronLeft() {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
}
function chevronRight() {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
}
function homeIcon() {
  return `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
}

window.PostCard = PostCard;

/* =============================================
   SHARE POST MODULE
   ============================================= */
const SharePost = {
  _postId: null,
  _postCaption: '',
  _postUsername: '',
  _selected: new Set(),

  async open(postId, username, caption) {
    this._postId = postId;
    this._postUsername = username;
    this._postCaption = caption;
    this._selected = new Set();

    const modal = document.getElementById('share-post-modal');
    if (!modal) return;

    // Reset UI
    const searchInput = document.getElementById('share-search-input');
    const list = document.getElementById('share-people-list');
    const sendBtn = document.getElementById('share-send-btn');
    const selectedCount = document.getElementById('share-selected-count');

    if (searchInput) searchInput.value = '';
    if (selectedCount) selectedCount.textContent = '';
    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = 'Send'; }

    // Set post preview info
    const previewUser = document.getElementById('share-post-preview-user');
    const previewCaption = document.getElementById('share-post-preview-caption');
    if (previewUser) previewUser.textContent = '@' + username;
    if (previewCaption) previewCaption.textContent = caption ? caption.slice(0, 80) + (caption.length > 80 ? '…' : '') : '';

    RubhiUtils.openModal('share-post-modal');
    await this.loadPeople('');

    if (searchInput) {
      searchInput.oninput = RubhiUtils.debounce(() => this.loadPeople(searchInput.value.trim()), 300);
    }
  },

  async loadPeople(query) {
    const list = document.getElementById('share-people-list');
    if (!list) return;
    list.innerHTML = `<div style="display:flex;justify-content:center;padding:20px"><span class="spinner spinner-sm"></span></div>`;

    const res = await api.get('/users/me/connections');
    let people = res.ok ? res.data.users : [];

    // Filter by query
    if (query) {
      const q = query.toLowerCase();
      people = people.filter(u =>
        u.username.toLowerCase().includes(q) ||
        (u.full_name || '').toLowerCase().includes(q)
      );
    }

    list.innerHTML = '';

    if (!people.length) {
      list.innerHTML = `<div style="text-align:center;padding:24px;color:var(--white-30);font-size:13px">
        ${query ? 'No results found.' : 'Follow or get followers to share posts.'}
      </div>`;
      return;
    }

    people.forEach(u => {
      const isSelected = this._selected.has(u.id);
      const row = document.createElement('div');
      row.className = 'share-person-row';
      row.dataset.userId = u.id;
      row.style.cssText = `
        display:flex;align-items:center;gap:12px;padding:10px 16px;
        cursor:pointer;border-radius:10px;transition:background .15s;
        background:${isSelected ? 'rgba(181,190,78,0.12)' : 'transparent'};
        margin-bottom:2px;
      `;
      row.innerHTML = `
        <div style="position:relative;flex-shrink:0">
          ${this._avatarImg(u)}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:600;color:var(--white);display:flex;align-items:center;gap:4px">
            ${RubhiUtils.escapeHtml(u.full_name || u.username)}
            ${u.is_verified ? RubhiUtils.verifiedBadge() : ''}
          </div>
          <div style="font-size:12px;color:var(--white-30)">@${RubhiUtils.escapeHtml(u.username)}</div>
        </div>
        <div class="share-check" style="
          width:22px;height:22px;border-radius:50%;
          border:2px solid ${isSelected ? 'var(--accent)' : 'var(--border-2)'};
          background:${isSelected ? 'var(--accent)' : 'transparent'};
          display:flex;align-items:center;justify-content:center;
          flex-shrink:0;transition:all .15s;
        ">
          ${isSelected ? `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="var(--black)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
        </div>`;

      row.addEventListener('mouseenter', () => {
        if (!this._selected.has(u.id)) row.style.background = 'rgba(255,255,255,0.05)';
      });
      row.addEventListener('mouseleave', () => {
        row.style.background = this._selected.has(u.id) ? 'rgba(181,190,78,0.12)' : 'transparent';
      });
      row.addEventListener('click', () => this.togglePerson(u.id, row));
      list.appendChild(row);
    });
  },

  togglePerson(userId, row) {
    const check = row.querySelector('.share-check');
    if (this._selected.has(userId)) {
      this._selected.delete(userId);
      row.style.background = 'transparent';
      check.style.borderColor = 'var(--border-2)';
      check.style.background = 'transparent';
      check.innerHTML = '';
    } else {
      this._selected.add(userId);
      row.style.background = 'rgba(181,190,78,0.12)';
      check.style.borderColor = 'var(--accent)';
      check.style.background = 'var(--accent)';
      check.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="var(--black)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    }

    const count = this._selected.size;
    const sendBtn = document.getElementById('share-send-btn');
    const selectedCount = document.getElementById('share-selected-count');
    if (sendBtn) sendBtn.disabled = count === 0;
    if (selectedCount) selectedCount.textContent = count > 0 ? `${count} selected` : '';
  },

  async send() {
    if (!this._selected.size || !this._postId) return;
    const btn = document.getElementById('share-send-btn');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner spinner-sm"></span> Sending…`;

    const postUrl = `${window.location.origin}/post/${this._postId}`;
    const messageText = `Check out this post by @${this._postUsername}: ${postUrl}`;

    let sent = 0, failed = 0;
    const promises = [...this._selected].map(async (receiverId) => {
      const form = new FormData();
      form.append('receiver_id', receiverId);
      form.append('message', messageText);
      const res = await api.sendMessage(form);
      res.ok ? sent++ : failed++;
    });

    await Promise.all(promises);

    btn.disabled = false;
    btn.textContent = 'Send';
    RubhiUtils.closeModal('share-post-modal');

    if (sent > 0) {
      RubhiUtils.showToast(
        `Post shared with ${sent} ${sent === 1 ? 'person' : 'people'}!`,
        'success'
      );
    }
    if (failed > 0) {
      RubhiUtils.showToast(`Failed to send to ${failed} ${failed === 1 ? 'person' : 'people'}.`, 'error');
    }
  },

  _avatarImg(u) {
    if (u.profile_picture) {
      return `<img src="${RubhiUtils.escapeHtml(u.profile_picture)}" 
        style="width:40px;height:40px;border-radius:50%;object-fit:cover;background:var(--surface-3)"
        onerror="this.style.display='none'">`;
    }
    const initial = (u.full_name || u.username || '?').charAt(0).toUpperCase();
    return `<div style="width:40px;height:40px;border-radius:50%;background:var(--surface-3);
      display:flex;align-items:center;justify-content:center;
      font-size:16px;font-weight:700;color:var(--accent)">${initial}</div>`;
  }
};

window.SharePost = SharePost;
