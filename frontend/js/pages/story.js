/* =============================================
   RUBHI - Story Viewer & Creator (Fixed)
   ============================================= */

const StoryViewer = {
  groups: [], groupIdx: 0, storyIdx: 0, timer: null, DURATION: 5000,

  open(groupIdx = 0) {
    this.groups = window._storyGroups || [];
    if (!this.groups.length) return;
    this.groupIdx = groupIdx; this.storyIdx = 0;
    document.getElementById('story-viewer-overlay').classList.add('active');
    document.body.style.overflow = 'hidden';
    this.render();
  },

  close() {
    clearTimeout(this.timer);
    document.getElementById('story-viewer-overlay').classList.remove('active');
    document.body.style.overflow = '';
  },

  render() {
    clearTimeout(this.timer);
    const group = this.groups[this.groupIdx];
    if (!group) { this.close(); return; }
    const story = group.stories[this.storyIdx];
    if (!story) { this.nextGroup(); return; }
    const isOwn = story.user_id === Auth.user?.id;

    // Swap media element
    const container = document.getElementById('story-media-container');
    if (story.media_type === 'video') {
      container.innerHTML = `<video id="story-media" class="story-media" src="${story.media_url}" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover"></video>`;
    } else {
      container.innerHTML = `<img id="story-media" class="story-media" src="${story.media_url}" style="width:100%;height:100%;object-fit:cover">`;
    }

    // Text overlay
    const textOverlay = document.getElementById('story-text-overlay');
    if (textOverlay) {
      if (story.text_overlay) {
        textOverlay.style.display = 'flex';
        textOverlay.textContent = story.text_overlay;
      } else {
        textOverlay.style.display = 'none';
        textOverlay.textContent = '';
      }
    }

    document.getElementById('story-user-name').textContent = group.username;
    document.getElementById('story-time-ago').textContent = RubhiUtils.timeAgo(story.created_at);
    document.getElementById('story-header-avatar').innerHTML = RubhiUtils.avatarHtml(group, 'avatar-xs');

    // Show/hide delete button
    const deleteBtn = document.getElementById('story-delete-btn');
    if (deleteBtn) deleteBtn.style.display = isOwn ? 'flex' : 'none';
    if (deleteBtn) deleteBtn.onclick = () => StoryViewer.deleteStory(story.id);

    // Progress bars
    const bar = document.getElementById('story-progress-bar');
    bar.innerHTML = group.stories.map((_, i) =>
      `<div class="story-progress-segment"><div class="story-progress-fill${i < this.storyIdx ? ' done' : ''}" id="spf-${i}"></div></div>`
    ).join('');

    api.viewStory(story.id).catch(() => {});

    const fill = document.getElementById(`spf-${this.storyIdx}`);
    if (fill) {
      fill.style.width = '0%';
      void fill.offsetWidth; // force reflow
      fill.style.transition = `width ${this.DURATION}ms linear`;
      fill.style.width = '100%';
    }

    this.timer = setTimeout(() => this.nextStory(), this.DURATION);
  },

  nextStory() {
    const group = this.groups[this.groupIdx];
    if (this.storyIdx < group.stories.length - 1) { this.storyIdx++; this.render(); }
    else this.nextGroup();
  },

  prevStory() {
    if (this.storyIdx > 0) { this.storyIdx--; this.render(); }
    else if (this.groupIdx > 0) { this.groupIdx--; this.storyIdx = this.groups[this.groupIdx].stories.length - 1; this.render(); }
  },

  nextGroup() {
    if (this.groupIdx < this.groups.length - 1) { this.groupIdx++; this.storyIdx = 0; this.render(); }
    else this.close();
  },

  async deleteStory(storyId) {
    RubhiUtils.confirmAction('Delete this story?', async () => {
      const res = await api.deleteStory(storyId);
      if (res.ok) {
        RubhiUtils.showToast('Story deleted.', 'success');
        // Remove from group
        const group = this.groups[this.groupIdx];
        group.stories.splice(this.storyIdx, 1);
        if (!group.stories.length) {
          this.groups.splice(this.groupIdx, 1);
          if (!this.groups.length) { this.close(); HomeFeed.loadStories(); return; }
          this.groupIdx = Math.min(this.groupIdx, this.groups.length - 1);
          this.storyIdx = 0;
        } else {
          this.storyIdx = Math.min(this.storyIdx, group.stories.length - 1);
        }
        this.render();
        HomeFeed.loadStories();
      } else {
        RubhiUtils.showToast('Failed to delete story.', 'error');
      }
    }, true);
  }
};

const StoryCreator = {
  _selectedFile: null,
  _textValue: '',

  open() {
    // Show story creation modal instead of direct upload
    RubhiUtils.openModal('story-create-modal');
    document.getElementById('story-text-input').value = '';
    document.getElementById('story-preview-area').innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;color:var(--white-30);padding:40px 0">
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        <p style="font-size:13px">Tap to add a photo or video</p>
      </div>`;
    document.getElementById('story-file-input').value = '';
    this._selectedFile = null;
  },

  handleFileSelect(input) {
    const file = input.files[0];
    if (!file) return;
    this._selectedFile = file;
    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith('video/');
    document.getElementById('story-preview-area').innerHTML = isVideo
      ? `<video src="${url}" style="max-width:100%;max-height:260px;border-radius:8px;display:block;margin:0 auto" muted controls></video>`
      : `<img src="${url}" style="max-width:100%;max-height:260px;border-radius:8px;display:block;margin:0 auto">`;
  },

  async post() {
    const textVal = document.getElementById('story-text-input').value.trim();
    if (!this._selectedFile && !textVal) {
      RubhiUtils.showToast('Add a photo, video, or text.', 'warning');
      return;
    }
    const btn = document.getElementById('story-post-btn');
    btn.disabled = true; btn.innerHTML = `<span class="spinner spinner-sm"></span> Posting…`;

    const form = new FormData();
    if (this._selectedFile) form.append('media', this._selectedFile);
    if (textVal) form.append('text_overlay', textVal);

    const res = await api.createStory(form);
    btn.disabled = false; btn.innerHTML = 'Share Story';

    if (res.ok) {
      RubhiUtils.closeModal('story-create-modal');
      RubhiUtils.showToast('Story posted!', 'success');
      HomeFeed.loadStories();
    } else {
      RubhiUtils.showToast(res.data?.error || 'Failed to post story.', 'error');
    }
    this._selectedFile = null;
  }
};

window.StoryViewer = StoryViewer;
window.StoryCreator = StoryCreator;
