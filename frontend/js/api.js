/* =============================================
   RUBHI - API Client
   ============================================= */

const API_BASE = '/api';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('rubhi_token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('rubhi_token', token);
    } else {
      localStorage.removeItem('rubhi_token');
    }
  }

  getHeaders(isFormData = false) {
    const headers = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    if (!isFormData) headers['Content-Type'] = 'application/json';
    return headers;
  }

  async request(method, path, data = null, isFormData = false) {
    const options = {
      method,
      headers: this.getHeaders(isFormData),
    };

    if (data) {
      options.body = isFormData ? data : JSON.stringify(data);
    }

    try {
      const res = await fetch(`${API_BASE}${path}`, options);
      const json = await res.json().catch(() => ({}));

      if (res.status === 401) {
        this.setToken(null);
        window.dispatchEvent(new CustomEvent('auth:logout'));
        return { ok: false, status: 401, data: json };
      }

      return { ok: res.ok, status: res.status, data: json };
    } catch (err) {
      console.error('API error:', err);
      return { ok: false, status: 0, data: { error: 'Network error. Please try again.' } };
    }
  }

  get(path)             { return this.request('GET', path); }
  post(path, data)      { return this.request('POST', path, data); }
  put(path, data)       { return this.request('PUT', path, data); }
  delete(path)          { return this.request('DELETE', path); }
  postForm(path, form)  { return this.request('POST', path, form, true); }
  putForm(path, form)   { return this.request('PUT', path, form, true); }

  // ---- Auth ----
  login(data)          { return this.post('/login', data); }
  register(form)       { return this.postForm('/register', form); }
  logout()             { return this.post('/logout'); }
  getMe()              { return this.get('/me'); }

  // ---- Users ----
  getUser(username)    { return this.get(`/users/${username}`); }
  updateProfile(form)  { return this.putForm('/users/profile', form); }
  searchUsers(q)       { return this.get(`/users/search?q=${encodeURIComponent(q)}`); }
  getSuggestions()     { return this.get('/users/discover/suggestions'); }
  getFollowers(id)     { return this.get(`/users/${id}/followers`); }
  getFollowing(id)     { return this.get(`/users/${id}/following`); }

  // ---- Follow ----
  follow(id)                       { return this.post(`/follow/${id}`); }
  unfollow(id)                     { return this.delete(`/follow/${id}`); }
  getFollowRequests()              { return this.get('/follow/requests/pending'); }
  acceptFollowRequest(followerId)  { return this.put(`/follow/requests/${followerId}/accept`); }
  rejectFollowRequest(followerId)  { return this.delete(`/follow/requests/${followerId}/reject`); }

  // ---- Posts ----
  getFeed(page = 1)           { return this.get(`/posts?page=${page}`); }
  getPost(id)                 { return this.get(`/posts/${id}`); }
  createPost(form)            { return this.postForm('/posts', form); }
  updatePost(id, data)        { return this.put(`/posts/${id}`, data); }
  deletePost(id)              { return this.delete(`/posts/${id}`); }
  likePost(id)                { return this.post(`/posts/${id}/like`); }
  unlikePost(id)              { return this.delete(`/posts/${id}/like`); }
  getComments(postId)         { return this.get(`/posts/${postId}/comments`); }
  addComment(postId, comment) { return this.post(`/posts/${postId}/comments`, { comment }); }
  updateComment(id, comment)  { return this.put(`/posts/comments/${id}`, { comment }); }
  deleteComment(id)           { return this.delete(`/posts/comments/${id}`); }

  // ---- Stories ----
  getStories()          { return this.get('/stories'); }
  createStory(form)     { return this.postForm('/stories', form); }
  deleteStory(id)       { return this.delete(`/stories/${id}`); }
  viewStory(id)         { return this.post(`/stories/${id}/view`); }
  getStoryViewers(id)   { return this.get(`/stories/${id}/viewers`); }

  // ---- Messages ----
  getConversations()        { return this.get('/messages'); }
  getMessages(userId)       { return this.get(`/messages/${userId}`); }
  sendMessage(form)         { return this.postForm('/messages', form); }
  deleteMessage(id)         { return this.delete(`/messages/${id}`); }

  // ---- Notifications ----
  getNotifications()   { return this.get('/notifications'); }
  markAllRead()        { return this.put('/notifications/read-all'); }
  markRead(id)         { return this.put(`/notifications/${id}/read`); }

  // ---- Verification ----
  submitVerification(form)   { return this.postForm('/verification', form); }
  getMyVerification()        { return this.get('/verification/my'); }

  // ---- Reports ----
  submitReport(data)  { return this.post('/reports', data); }

  // ---- Blocks ----
  blockUser(id)       { return this.post(`/blocks/${id}`); }
  unblockUser(id)     { return this.delete(`/blocks/${id}`); }
  getBlocked()        { return this.get('/blocks'); }
  checkBlock(id)      { return this.get(`/blocks/check/${id}`); }

  // ---- Admin ----
  adminDashboard()                    { return this.get('/admin/dashboard'); }
  adminGetUsers(page=1, search='')    { return this.get(`/admin/users?page=${page}&search=${encodeURIComponent(search)}`); }
  adminGetUser(id)                    { return this.get(`/admin/users/${id}`); }
  adminBanUser(id)                    { return this.put(`/admin/users/${id}/ban`); }
  adminUnbanUser(id)                  { return this.put(`/admin/users/${id}/unban`); }
  adminVerifyUser(id, verified=true)  { return this.put(`/admin/users/${id}/verify`, { verified }); }
  adminSetRole(id, role)              { return this.put(`/admin/users/${id}/role`, { role }); }
  adminDeleteUser(id)                 { return this.delete(`/admin/users/${id}`); }
  adminGetPosts(page=1)               { return this.get(`/admin/posts?page=${page}`); }
  adminGetPost(id)                    { return this.get(`/admin/posts/${id}`); }
  adminDeletePost(id)                 { return this.delete(`/admin/posts/${id}`); }
  adminHidePost(id)                   { return this.put(`/admin/posts/${id}/hide`); }
  adminRestorePost(id)                { return this.put(`/admin/posts/${id}/restore`); }
  adminGetComments(page=1)            { return this.get(`/admin/comments?page=${page}`); }
  adminDeleteComment(id)              { return this.delete(`/admin/comments/${id}`); }
  adminGetStories(page=1)             { return this.get(`/admin/stories?page=${page}`); }
  adminDeleteStory(id)                { return this.delete(`/admin/stories/${id}`); }
  adminGetMessages(page=1)            { return this.get(`/admin/messages?page=${page}`); }
  adminDeleteMessage(id)              { return this.delete(`/admin/messages/${id}`); }
  adminGetVerifications()             { return this.get('/admin/verification'); }
  adminApproveVerification(id)        { return this.put(`/admin/verification/${id}/approve`); }
  adminRejectVerification(id)         { return this.put(`/admin/verification/${id}/reject`); }
  adminGetReports()                   { return this.get('/admin/reports'); }
  adminDismissReport(id)              { return this.put(`/admin/reports/${id}/dismiss`); }
  adminDeleteReport(id)               { return this.delete(`/admin/reports/${id}`); }
  adminGetSettings()                  { return this.get('/admin/settings'); }
  adminSaveSettings(data)             { return this.put('/admin/settings', data); }
}

const api = new ApiClient();
window.api = api;
