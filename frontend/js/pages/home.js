/* =============================================
   RUBHI - Home Feed Page
   ============================================= */

const HomeFeed = {
  page: 1,
  loading: false,
  done: false,

  async init() {
    this.page = 1;
    this.loading = false;
    this.done = false;
    const feed = document.getElementById('feed-posts');
    if (feed) feed.innerHTML = '';
    await this.loadStories();
    await this.loadPosts();
    await this.loadSuggestions();
    this.setupInfiniteScroll();
  },

  async loadStories() {
    const res = await api.getStories();
    if (!res.ok) return;
    const { story_groups } = res.data;
    const row = document.getElementById('stories-scroll');
    if (!row) return;
    row.innerHTML = '';

    // Fetch fresh user data so profile pic is always current
    const meRes = await api.getMe();
    const me = meRes.ok ? meRes.data.user : Auth.user;

    const myPic = me?.profile_picture
      ? `<img src="${RubhiUtils.escapeHtml(me.profile_picture)}" class="story-avatar-img" alt="" onerror="this.style.display='none'">`
      : `<div class="story-avatar-img" style="display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:var(--accent);background:var(--surface-3)">${(me?.full_name||me?.username||'?').charAt(0).toUpperCase()}</div>`;

    row.innerHTML += `
      <div class="story-item" onclick="StoryCreator.open()">
        <div class="story-avatar-wrapper">
          ${myPic}
          <div class="story-ring story-ring-own"></div>
          <div class="story-add-btn">+</div>
        </div>
        <span class="story-username">Your Story</span>
      </div>`;

    story_groups.forEach((g, gi) => {
      const ringClass = g.has_unseen ? 'story-ring-unseen' : 'story-ring-seen';
      const pic = g.profile_picture
        ? `<img src="${RubhiUtils.escapeHtml(g.profile_picture)}" class="story-avatar-img" alt="" onerror="this.style.display='none'">`
        : `<div class="story-avatar-img" style="display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:var(--accent);background:var(--surface-3)">${(g.full_name||g.username||'?').charAt(0).toUpperCase()}</div>`;
      row.innerHTML += `
        <div class="story-item" onclick="StoryViewer.open(${gi})">
          <div class="story-avatar-wrapper">
            ${pic}
            <div class="story-ring ${ringClass}"></div>
          </div>
          <span class="story-username">${RubhiUtils.escapeHtml(g.username)}</span>
        </div>`;
    });

    window._storyGroups = story_groups;
  },

  async loadPosts() {
    if (this.loading || this.done) return;
    this.loading = true;
    const feed = document.getElementById('feed-posts');
    const loader = document.getElementById('feed-loader');
    if (loader) loader.style.display = 'flex';

    const res = await api.getFeed(this.page);
    if (loader) loader.style.display = 'none';
    this.loading = false;

    if (!res.ok) { RubhiUtils.showToast('Failed to load feed.', 'error'); return; }
    const { posts } = res.data;
    if (!posts || posts.length === 0) {
      this.done = true;
      if (this.page === 1) {
        feed.innerHTML = `<div class="empty-state">
          <div class="empty-state-icon">${homeIcon()}</div>
          <p class="empty-state-title">Your feed is empty</p>
          <p class="empty-state-desc">Follow people to see their posts here.</p>
          <button class="btn btn-primary btn-sm mt-4" onclick="Router.navigate('search')">Discover People</button>
        </div>`;
      }
      return;
    }
    posts.forEach(post => { feed.insertAdjacentHTML('beforeend', PostCard.render(post)); });
    PostCard.attachHandlers();
    this.page++;
  },

  setupInfiniteScroll() {
    window.removeEventListener('scroll', this._scrollHandler);
    this._scrollHandler = RubhiUtils.debounce(() => {
      if (Router.current !== 'home') return;
      const scrolled = window.innerHeight + window.scrollY;
      if (scrolled >= document.body.offsetHeight - 400) this.loadPosts();
    }, 200);
    window.addEventListener('scroll', this._scrollHandler);
  },

  async loadSuggestions() {
    const panel = document.getElementById('suggestions-list');
    if (!panel) return;
    const res = await api.getSuggestions();
    if (!res.ok || !res.data.users.length) {
      const right = panel.closest('.feed-right');
      if (right) right.style.display = 'none';
      return;
    }
    const me = Auth.user;
    panel.innerHTML = `
      <div class="flex items-center justify-between px-4 mb-2">
        <span class="text-xs tracking-wider uppercase text-muted weight-semi">Suggestions</span>
      </div>`;
    res.data.users.slice(0, 5).forEach(u => {
      panel.innerHTML += `
        <div class="user-list-item" onclick="Router.navigate('profile',{username:'${RubhiUtils.escapeHtml(u.username)}'})">
          ${RubhiUtils.avatarHtml(u, 'avatar-sm')}
          <div class="user-list-info">
            <div class="user-list-name">${RubhiUtils.escapeHtml(u.full_name)}${u.is_verified ? RubhiUtils.verifiedBadge() : ''}</div>
            <div class="user-list-username">@${RubhiUtils.escapeHtml(u.username)}</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();FollowBtn.toggle(this,${u.id})">Follow</button>
        </div>`;
    });
    const meEl = document.getElementById('sidebar-me');
    if (meEl && me) {
      meEl.innerHTML = `
        <div class="flex items-center gap-3 px-4 mt-4 cursor-pointer" onclick="Router.navigate('profile',{username:'${RubhiUtils.escapeHtml(me.username)}'})">
          ${RubhiUtils.avatarHtml(me, 'avatar-sm')}
          <div class="user-list-info">
            <div class="user-list-name">${RubhiUtils.escapeHtml(me.full_name)}${me.is_verified ? RubhiUtils.verifiedBadge() : ''}</div>
            <div class="user-list-username">@${RubhiUtils.escapeHtml(me.username)}</div>
          </div>
        </div>`;
    }
  }
};

Router.register('home', () => HomeFeed.init());
