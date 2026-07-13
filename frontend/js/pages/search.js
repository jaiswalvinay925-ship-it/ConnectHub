/* =============================================
   RUBHI - Search Page
   ============================================= */

Router.register('search', () => {
  const input   = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  if (!input) return;
  input.focus();

  const doSearch = RubhiUtils.debounce(async () => {
    const q = input.value.trim();
    if (!q) { results.innerHTML = ''; return; }
    results.innerHTML = `<div class="flex justify-center p-6"><span class="spinner"></span></div>`;
    const res = await api.searchUsers(q);
    results.innerHTML = '';
    if (!res.ok || !res.data.users.length) {
      results.innerHTML = `<div class="empty-state"><p class="empty-state-title">No results for "${RubhiUtils.escapeHtml(q)}"</p></div>`;
      return;
    }
    res.data.users.forEach(u => {
      results.innerHTML += `
        <div class="user-list-item" style="padding:var(--sp-4)" onclick="Router.navigate('profile',{username:'${RubhiUtils.escapeHtml(u.username)}'})">
          ${RubhiUtils.avatarHtml(u, 'avatar-md')}
          <div class="user-list-info">
            <div class="user-list-name">${RubhiUtils.escapeHtml(u.full_name)}${u.is_verified ? RubhiUtils.verifiedBadge() : ''}</div>
            <div class="user-list-username">@${RubhiUtils.escapeHtml(u.username)}</div>
          </div>
          <button class="btn ${u.is_following ? 'btn-secondary' : 'btn-primary'} btn-sm"
            onclick="event.stopPropagation();FollowBtn.toggle(this,${u.id})">
            ${u.is_following ? 'Following' : 'Follow'}
          </button>
        </div>`;
    });
  }, 350);

  input.addEventListener('input', doSearch);
});
