/* =============================================
   RUBHI - Profile Page (Fixed)
   ============================================= */

Router.register('profile', async (params) => {
  const username = params?.username || Auth.user?.username;
  if (!username) return Router.navigate('home');

  const page = document.getElementById('page-profile');
  if (!page) return;

  page.querySelector('.profile-content').innerHTML =
    `<div style="display:flex;justify-content:center;padding:80px"><span class="spinner spinner-lg"></span></div>`;

  const res = await api.getUser(username);
  if (!res.ok) {
    page.querySelector('.profile-content').innerHTML =
      `<div class="empty-state"><p class="empty-state-title">User not found.</p></div>`;
    return;
  }

  const { user, posts, isOwn, followStatus } = res.data;
  window._profileUser = user;

  // Check block status for other users
  let blockStatus = { i_blocked: false, they_blocked: false };
  if (!isOwn) {
    const br = await api.checkBlock(user.id);
    if (br.ok) blockStatus = br.data;
  }

  let actionBtns = '';
  if (isOwn) {
    actionBtns = `
      <button class="btn btn-secondary btn-sm" onclick="EditProfile.open()">Edit Profile</button>
      <button class="btn btn-secondary btn-sm" onclick="openVerificationModal()">Request Verification</button>`;
  } else if (blockStatus.they_blocked) {
    actionBtns = `<span class="badge badge-surface" style="padding:8px 14px">You are blocked</span>`;
  } else {
    const followLabel = followStatus === 'accepted' ? 'Following'
                      : followStatus === 'pending'  ? 'Requested' : 'Follow';
    const followClass = followStatus ? 'btn-secondary' : 'btn-primary';
    const blockLabel  = blockStatus.i_blocked ? 'Unblock' : 'Block';
    actionBtns = `
      <button class="btn ${followClass} btn-sm" id="profile-follow-btn"
        onclick="FollowBtn.toggleProfile(this,${user.id},'${followStatus||''}')">${followLabel}</button>
      <button class="btn btn-secondary btn-sm"
        onclick="Router.navigate('messages',{userId:${user.id},username:'${RubhiUtils.escapeHtml(user.username)}'})">Message</button>
      <button class="btn btn-ghost btn-sm" style="color:var(--red)"
        onclick="BlockUser.toggle(this,${user.id},${blockStatus.i_blocked})">${blockLabel}</button>`;
  }

  page.querySelector('.profile-content').innerHTML = `
    <div style="width:100%;max-width:640px;padding:48px 24px 60px">
      <!-- CENTERED PROFILE HEADER -->
      <div style="display:flex;flex-direction:column;align-items:center;text-align:center;margin-bottom:32px">
        <div style="position:relative;cursor:pointer;margin-bottom:16px" ${isOwn ? 'onclick="EditProfile.open()"' : ''}>
          <div id="profile-avatar-display" style="width:110px;height:110px;border-radius:50%;overflow:hidden;border:3px solid var(--accent);background:var(--surface-3);flex-shrink:0">
            ${user.profile_picture
              ? `<img src="${user.profile_picture}?t=${Date.now()}" style="width:100%;height:100%;object-fit:cover" id="profile-pic-img">`
              : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:42px;font-weight:700;color:var(--accent)">${(user.full_name||user.username||'?').charAt(0).toUpperCase()}</div>`}
          </div>
          ${isOwn ? `<div style="position:absolute;bottom:4px;right:4px;width:28px;height:28px;background:var(--accent);border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid var(--black-2)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--black)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </div>` : ''}
        </div>

        <h1 style="font-size:22px;font-weight:600;color:var(--white);margin-bottom:4px;display:flex;align-items:center;gap:8px;justify-content:center">
          ${RubhiUtils.escapeHtml(user.username)}
          ${user.is_verified ? RubhiUtils.verifiedBadge('verified-badge-lg') : ''}
        </h1>
        <p style="font-size:14px;color:var(--white-50);margin-bottom:12px">${RubhiUtils.escapeHtml(user.full_name)}</p>
        ${user.bio ? `<p style="font-size:14px;color:var(--white-70);max-width:400px;line-height:1.6;margin-bottom:14px;white-space:pre-line">${RubhiUtils.escapeHtml(user.bio)}</p>` : ''}

        <!-- Stats Row -->
        <div style="display:flex;gap:40px;margin-bottom:20px">
          <div style="cursor:pointer;text-align:center">
            <div style="font-size:18px;font-weight:700;color:var(--white)">${RubhiUtils.formatNumber(user.posts_count)}</div>
            <div style="font-size:12px;color:var(--white-50);text-transform:uppercase;letter-spacing:.05em">Posts</div>
          </div>
          <div style="cursor:pointer;text-align:center" onclick="showFollowList(${user.id},'followers')">
            <div style="font-size:18px;font-weight:700;color:var(--white)">${RubhiUtils.formatNumber(user.followers_count)}</div>
            <div style="font-size:12px;color:var(--white-50);text-transform:uppercase;letter-spacing:.05em">Followers</div>
          </div>
          <div style="cursor:pointer;text-align:center" onclick="showFollowList(${user.id},'following')">
            <div style="font-size:18px;font-weight:700;color:var(--white)">${RubhiUtils.formatNumber(user.following_count)}</div>
            <div style="font-size:12px;color:var(--white-50);text-transform:uppercase;letter-spacing:.05em">Following</div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">${actionBtns}</div>
      </div>

      <!-- POSTS GRID -->
      <div style="border-top:1px solid var(--border);padding-top:24px">
        <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:20px;color:var(--white-50);font-size:12px;letter-spacing:.1em;text-transform:uppercase;font-weight:600">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          Posts
        </div>
        <div id="profile-posts-grid">
          ${posts.length === 0
            ? `<div class="empty-state"><p class="empty-state-title">No posts yet</p></div>`
            : `<div class="profile-grid">${posts.map(p => `
                <div class="profile-grid-item" onclick="ProfilePostModal.open(${p.id})">
                  ${p.media_type === 'video'
                    ? `<video src="${p.thumbnail}" style="width:100%;height:100%;object-fit:cover;display:block" muted></video>`
                    : `<img src="${p.thumbnail}" alt="post" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block">`}
                  ${p.media_count > 1 ? `<div class="multi-media-badge">${multiIcon()}</div>` : ''}
                  <div class="profile-grid-overlay">
                    <div class="profile-grid-stat">${heartIcon(true)}<span>${RubhiUtils.formatNumber(p.likes_count)}</span></div>
                    <div class="profile-grid-stat">${commentGridIcon()}<span>${RubhiUtils.formatNumber(p.comments_count)}</span></div>
                  </div>
                  <!-- Share button on hover -->
                  <button class="profile-grid-share-btn"
                    onclick="event.stopPropagation();SharePost.open(${p.id},'${RubhiUtils.escapeHtml(user.username)}','${RubhiUtils.escapeHtml((p.caption||'').slice(0,60))}')"
                    title="Share post">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </button>
                </div>`).join('')}
              </div>`}
        </div>
      </div>
    </div>`;
});

// ---- Profile Post Modal (opens full post like feed) ----
const ProfilePostModal = {
  async open(postId) {
    const res = await api.getPost(postId);
    if (!res.ok) return;
    const post = res.data.post;
    const me = Auth.user;
    const isOwn = me?.id === post.user_id;

    const overlay = document.getElementById('profile-post-modal');
    const body = document.getElementById('profile-post-modal-body');

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;max-height:90vh">
        <!-- Post Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:10px;cursor:pointer" onclick="RubhiUtils.closeModal('profile-post-modal');Router.navigate('profile',{username:'${RubhiUtils.escapeHtml(post.username)}'})">
            ${RubhiUtils.avatarHtml(post,'avatar-sm')}
            <div>
              <div style="font-weight:600;font-size:14px;color:var(--white);display:flex;align-items:center;gap:5px">
                ${RubhiUtils.escapeHtml(post.username)}${post.is_verified?RubhiUtils.verifiedBadge():''}
              </div>
              <div style="font-size:12px;color:var(--white-30)">${RubhiUtils.timeAgo(post.created_at)}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            ${isOwn ? `
              <button class="btn btn-ghost btn-sm" onclick="ProfilePostModal.editCaption(${post.id},this)">Edit</button>
              <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="ProfilePostModal.deletePost(${post.id})">Delete</button>` : ''}
            <button class="btn-icon btn-ghost" onclick="RubhiUtils.closeModal('profile-post-modal')">✕</button>
          </div>
        </div>
        <!-- Media -->
        <div style="background:var(--black-4);overflow:hidden">
          ${PostCard.renderMedia(post.media || [], post.id)}
        </div>
        <!-- Actions -->
        <div style="padding:10px 16px 6px;display:flex;align-items:center;gap:4px">
          <button class="post-action-btn like-btn ${post.is_liked?'liked':''}" data-post-id="${post.id}" data-liked="${post.is_liked}" onclick="PostCard.toggleLike(this,${post.id})">
            ${heartIcon(post.is_liked)}
            <span class="post-action-count" data-likes="${post.id}">${RubhiUtils.formatNumber(post.likes_count)}</span>
          </button>
          <button class="post-action-btn">
            ${commentIconSm()}
            <span class="post-action-count">${RubhiUtils.formatNumber(post.comments_count)}</span>
          </button>
        </div>
        ${post.caption ? `<div style="padding:0 18px 10px;font-size:14px;color:var(--white-90)"><span style="font-weight:600;margin-right:6px">${RubhiUtils.escapeHtml(post.username)}</span>${RubhiUtils.escapeHtml(post.caption)}</div>` : ''}
        <!-- Comments -->
        <div id="ppm-comments" style="flex:1;overflow-y:auto;max-height:220px;border-top:1px solid var(--border);padding:10px 18px"></div>
        <!-- Comment input -->
        <div style="display:flex;align-items:center;gap:10px;padding:12px 18px;border-top:1px solid var(--border)">
          ${RubhiUtils.avatarHtml(me,'avatar-xs')}
          <input id="ppm-comment-input" type="text" class="form-input" placeholder="Add a comment…" style="flex:1" onkeydown="if(event.key==='Enter')ProfilePostModal.submitComment(${post.id})">
          <button class="btn btn-primary btn-sm" onclick="ProfilePostModal.submitComment(${post.id})">Post</button>
        </div>
      </div>`;

    RubhiUtils.openModal('profile-post-modal');
    PostCard.attachHandlers();
    this.loadComments(post.id);
  },

  async loadComments(postId) {
    const list = document.getElementById('ppm-comments');
    if (!list) return;
    const res = await api.getComments(postId);
    if (!res.ok) return;
    list.innerHTML = '';
    if (!res.data.comments.length) {
      list.innerHTML = `<p style="color:var(--white-30);font-size:13px;text-align:center;padding:12px">No comments yet</p>`;
      return;
    }
    res.data.comments.forEach(c => {
      const isOwn = c.user_id === Auth.user?.id;
      list.innerHTML += `
        <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
          ${RubhiUtils.avatarHtml(c,'avatar-xs')}
          <div style="flex:1">
            <span style="font-weight:600;font-size:13px;margin-right:6px">${RubhiUtils.escapeHtml(c.username)}</span>
            <span style="font-size:13px;color:var(--white-90)">${RubhiUtils.escapeHtml(c.comment)}</span>
            <div style="font-size:11px;color:var(--white-30);margin-top:3px;display:flex;gap:10px">
              <span>${RubhiUtils.timeAgo(c.created_at)}</span>
              ${isOwn ? `<button style="color:var(--red);background:none;border:none;cursor:pointer;font-size:11px" onclick="PostCard.deleteComment(${c.id},this)">Delete</button>` : ''}
            </div>
          </div>
        </div>`;
    });
    list.scrollTop = list.scrollHeight;
  },

  async submitComment(postId) {
    const input = document.getElementById('ppm-comment-input');
    const text = input.value.trim();
    if (!text) return;
    const res = await api.addComment(postId, text);
    if (res.ok) { input.value = ''; this.loadComments(postId); }
  },

  editCaption(postId, btn) {
    const captionEl = document.querySelector(`#profile-post-modal-body .post-caption-text`);
    const current = captionEl?.textContent || '';
    const newCaption = prompt('Edit caption:', current);
    if (newCaption === null) return;
    api.updatePost(postId, { caption: newCaption }).then(res => {
      if (res.ok) {
        RubhiUtils.showToast('Caption updated.', 'success');
        if (captionEl) captionEl.textContent = newCaption;
      }
    });
  },

  deletePost(postId) {
    RubhiUtils.confirmAction('Delete this post permanently?', async () => {
      const res = await api.deletePost(postId);
      if (res.ok) {
        RubhiUtils.closeModal('profile-post-modal');
        RubhiUtils.showToast('Post deleted.', 'success');
        // Remove from grid
        const username = window._profileUser?.username;
        if (username) Router.navigate('profile', { username });
      }
    }, true);
  }
};

function heartIcon(f) {
  return `<svg viewBox="0 0 24 24" width="16" height="16" stroke="white" fill="${f?'white':'none'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`;
}
function commentGridIcon() {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`;
}
function commentIconSm() {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`;
}
function multiIcon() {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 1px 3px rgba(0,0,0,.7))"><rect x="7" y="3" width="14" height="14" rx="2"/><path d="M3 7v11a2 2 0 002 2h11"/></svg>`;
}

// ---- Follow Button ----
const FollowBtn = {
  async toggle(btn, userId) {
    const isFollowing = btn.textContent.trim() === 'Following' || btn.textContent.trim() === 'Requested';
    if (isFollowing) {
      const res = await api.unfollow(userId);
      if (res.ok) { btn.textContent = 'Follow'; btn.className = 'btn btn-primary btn-sm'; }
    } else {
      const res = await api.follow(userId);
      if (res.ok) {
        btn.textContent = res.data.status === 'pending' ? 'Requested' : 'Following';
        btn.className = 'btn btn-secondary btn-sm';
      }
    }
  },

  async toggleProfile(btn, userId, status) {
    if (status === 'accepted' || status === 'pending') {
      const res = await api.unfollow(userId);
      if (res.ok) {
        btn.textContent = 'Follow'; btn.className = 'btn btn-primary btn-sm';
        btn.onclick = () => FollowBtn.toggleProfile(btn, userId, '');
      }
    } else {
      const res = await api.follow(userId);
      if (res.ok) {
        const newStatus = res.data.status;
        btn.textContent = newStatus === 'pending' ? 'Requested' : 'Following';
        btn.className = 'btn btn-secondary btn-sm';
        btn.onclick = () => FollowBtn.toggleProfile(btn, userId, newStatus);
      }
    }
  }
};

// ---- Block User ----
const BlockUser = {
  async toggle(btn, userId, isBlocked) {
    if (isBlocked) {
      RubhiUtils.confirmAction('Unblock this user?', async () => {
        const res = await api.unblockUser(userId);
        if (res.ok) {
          RubhiUtils.showToast('User unblocked.', 'success');
          const username = window._profileUser?.username;
          if (username) Router.navigate('profile', { username });
        }
      });
    } else {
      RubhiUtils.confirmAction('Block this user? They will not be able to message you or see your posts.', async () => {
        const res = await api.blockUser(userId);
        if (res.ok) {
          RubhiUtils.showToast('User blocked.', 'success');
          const username = window._profileUser?.username;
          if (username) Router.navigate('profile', { username });
        }
      }, true);
    }
  }
};

// ---- Show followers/following list ----
async function showFollowList(userId, type) {
  const title = document.getElementById('follow-list-title');
  const list  = document.getElementById('follow-list-content');
  title.textContent = type === 'followers' ? 'Followers' : 'Following';
  list.innerHTML = `<div style="display:flex;justify-content:center;padding:24px"><span class="spinner"></span></div>`;
  RubhiUtils.openModal('follow-list-modal');

  const res = type === 'followers' ? await api.getFollowers(userId) : await api.getFollowing(userId);
  list.innerHTML = '';
  if (!res.ok || !res.data.users.length) {
    list.innerHTML = `<div class="empty-state"><p class="empty-state-title">No ${type} yet</p></div>`;
    return;
  }
  res.data.users.forEach(u => {
    list.innerHTML += `
      <div class="user-list-item" onclick="RubhiUtils.closeModal('follow-list-modal');Router.navigate('profile',{username:'${RubhiUtils.escapeHtml(u.username)}'})">
        ${RubhiUtils.avatarHtml(u, 'avatar-sm')}
        <div class="user-list-info">
          <div class="user-list-name">${RubhiUtils.escapeHtml(u.full_name)}${u.is_verified ? RubhiUtils.verifiedBadge() : ''}</div>
          <div class="user-list-username">@${RubhiUtils.escapeHtml(u.username)}</div>
        </div>
      </div>`;
  });
}

function openVerificationModal() { RubhiUtils.openModal('verification-request-modal'); }

// ---- Edit Profile with interactive crop ----
const EditProfile = {
  _croppedBlob: null,
  // Crop state
  _img: null,
  _imgW: 0, _imgH: 0,
  _scale: 1, _minScale: 1,
  _offsetX: 0, _offsetY: 0,
  _dragging: false,
  _lastX: 0, _lastY: 0,
  _CROP_SIZE: 280,

  async open() {
    const user = Auth.user;
    document.getElementById('ep-fullname').value = user.full_name || '';
    document.getElementById('ep-username').value = user.username  || '';
    document.getElementById('ep-bio').value       = user.bio       || '';
    const toggle = document.getElementById('ep-private');
    if (toggle) toggle.checked = !!user.is_private;

    const preview = document.getElementById('ep-avatar-preview');
    if (preview) {
      preview.innerHTML = user.profile_picture
        ? `<img src="${user.profile_picture}?t=${Date.now()}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
        : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:var(--accent)">${(user.full_name||'?').charAt(0).toUpperCase()}</div>`;
    }

    this._croppedBlob = null;
    const cropSection = document.getElementById('crop-section');
    if (cropSection) cropSection.style.display = 'none';
    RubhiUtils.openModal('edit-profile-modal');
  },

  handlePicSelect(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const cropSection = document.getElementById('crop-section');
      cropSection.style.display = 'flex';
      const img = new Image();
      img.onload = () => this._initCropState(img);
      img.src = e.target.result;
      this._img = img;
    };
    reader.readAsDataURL(file);
  },

  _initCropState(img) {
    const C = this._CROP_SIZE;
    this._imgW = img.naturalWidth;
    this._imgH = img.naturalHeight;
    // Scale so the smaller dimension fills the crop circle
    this._minScale = Math.max(C / img.naturalWidth, C / img.naturalHeight);
    this._scale = this._minScale;
    // Center the image
    this._offsetX = (img.naturalWidth * this._scale - C) / 2;
    this._offsetY = (img.naturalHeight * this._scale - C) / 2;
    this._drawCrop();
    this._bindCropEvents();
  },

  _drawCrop() {
    const canvas = document.getElementById('crop-canvas');
    if (!canvas || !this._img) return;
    const C = this._CROP_SIZE;
    canvas.width = C; canvas.height = C;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, C, C);

    // Draw the image region
    const sw = C / this._scale;
    const sh = C / this._scale;
    const sx = this._offsetX / this._scale;
    const sy = this._offsetY / this._scale;
    ctx.drawImage(this._img, sx, sy, sw, sh, 0, 0, C, C);

    // Dark vignette outside circle
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, C, C);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(C / 2, C / 2, C / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Gold circle border
    ctx.strokeStyle = 'rgba(181,190,78,0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(C / 2, C / 2, C / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  },

  _clampOffset() {
    const C = this._CROP_SIZE;
    const scaledW = this._imgW * this._scale;
    const scaledH = this._imgH * this._scale;
    this._offsetX = Math.max(0, Math.min(this._offsetX, scaledW - C));
    this._offsetY = Math.max(0, Math.min(this._offsetY, scaledH - C));
  },

  _bindCropEvents() {
    const canvas = document.getElementById('crop-canvas');
    if (!canvas) return;
    // Always rebind — replace with clone to remove old listeners
    const fresh = canvas.cloneNode(true);
    canvas.parentNode.replaceChild(fresh, canvas);

    fresh.addEventListener('mousedown', (e) => {
      this._dragging = true;
      this._lastX = e.clientX; this._lastY = e.clientY;
      fresh.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', (e) => {
      if (!this._dragging) return;
      this._offsetX -= (e.clientX - this._lastX);
      this._offsetY -= (e.clientY - this._lastY);
      this._lastX = e.clientX; this._lastY = e.clientY;
      this._clampOffset(); this._drawCrop();
    });
    window.addEventListener('mouseup', () => {
      this._dragging = false;
      fresh.style.cursor = 'grab';
    });

    fresh.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      this._dragging = true; this._lastX = t.clientX; this._lastY = t.clientY;
    }, { passive: true });
    fresh.addEventListener('touchmove', (e) => {
      if (!this._dragging) return;
      const t = e.touches[0];
      this._offsetX -= (t.clientX - this._lastX);
      this._offsetY -= (t.clientY - this._lastY);
      this._lastX = t.clientX; this._lastY = t.clientY;
      this._clampOffset(); this._drawCrop();
      e.preventDefault();
    }, { passive: false });
    fresh.addEventListener('touchend', () => { this._dragging = false; });

    fresh.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      const newScale = Math.max(this._minScale, Math.min(this._scale + delta * this._scale, this._minScale * 5));
      const C = this._CROP_SIZE;
      this._offsetX = (this._offsetX + C / 2) * (newScale / this._scale) - C / 2;
      this._offsetY = (this._offsetY + C / 2) * (newScale / this._scale) - C / 2;
      this._scale = newScale;
      this._clampOffset(); this._drawCrop();
    }, { passive: false });
  },

  zoomIn()  { this._zoom(0.1); },
  zoomOut() { this._zoom(-0.1); },
  _zoom(delta) {
    const C = this._CROP_SIZE;
    const newScale = Math.max(this._minScale, Math.min(this._scale + delta * this._scale, this._minScale * 5));
    this._offsetX = (this._offsetX + C / 2) * (newScale / this._scale) - C / 2;
    this._offsetY = (this._offsetY + C / 2) * (newScale / this._scale) - C / 2;
    this._scale = newScale;
    this._clampOffset(); this._drawCrop();
  },

  applyCrop() {
    const canvas = document.getElementById('crop-canvas');
    if (!canvas || !this._img) return;

    // Render final 400×400 circle-clipped image
    const out = document.createElement('canvas');
    const SIZE = 400;
    out.width = SIZE; out.height = SIZE;
    const ctx = out.getContext('2d');

    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    const C = this._CROP_SIZE;
    const sw = C / this._scale;
    const sh = C / this._scale;
    const sx = this._offsetX / this._scale;
    const sy = this._offsetY / this._scale;
    ctx.drawImage(this._img, sx, sy, sw, sh, 0, 0, SIZE, SIZE);

    out.toBlob(blob => {
      this._croppedBlob = blob;
      // Update the small avatar preview circle in the modal
      const preview = document.getElementById('ep-avatar-preview');
      if (preview) preview.innerHTML = `<img src="${canvas.toDataURL()}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      // Hide crop section
      document.getElementById('crop-section').style.display = 'none';
      RubhiUtils.showToast('Photo cropped! Hit Save to apply.', 'success');
    }, 'image/jpeg', 0.92);
  },

  cancelCrop() {
    document.getElementById('crop-section').style.display = 'none';
    document.getElementById('ep-profile-pic').value = '';
  },

  async save() {
    const formData = new FormData();
    formData.append('full_name', document.getElementById('ep-fullname').value.trim());
    formData.append('username',  document.getElementById('ep-username').value.trim());
    formData.append('bio',       document.getElementById('ep-bio').value.trim());
    formData.append('is_private', document.getElementById('ep-private')?.checked ? 'true' : 'false');

    if (this._croppedBlob) {
      formData.append('profile_picture', this._croppedBlob, 'profile.jpg');
    } else {
      const raw = document.getElementById('ep-profile-pic')?.files[0];
      if (raw) formData.append('profile_picture', raw);
    }

    const btn = document.getElementById('ep-save-btn');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner spinner-sm"></span> Saving…`;
    const res = await api.updateProfile(formData);
    btn.disabled = false;
    btn.innerHTML = 'Save Changes';

    if (res.ok) {
      const updated = res.data.user;
      Auth.setUser({ ...Auth.user, ...updated });
      RubhiUtils.closeModal('edit-profile-modal');
      RubhiUtils.showToast('Profile updated!', 'success');
      updateSidebarUser(updated);
      Router.navigate('profile', { username: updated.username });
    } else {
      RubhiUtils.showToast(res.data.error || res.data.errors?.[0]?.msg || 'Update failed.', 'error');
    }
  }
};

function updateSidebarUser(user) {
  const nameEl  = document.querySelector('.sidebar-user-name');
  const unameEl = document.querySelector('.sidebar-user-username');
  const avatarWrap = document.getElementById('sidebar-avatar-wrap');
  if (nameEl)  nameEl.textContent  = user.full_name;
  if (unameEl) unameEl.textContent = '@' + user.username;
  if (avatarWrap) avatarWrap.innerHTML = RubhiUtils.avatarHtml(user, 'avatar-sm');
}

window.FollowBtn       = FollowBtn;
window.BlockUser       = BlockUser;
window.EditProfile     = EditProfile;
window.ProfilePostModal = ProfilePostModal;
window.showFollowList  = showFollowList;
window.openVerificationModal = openVerificationModal;
