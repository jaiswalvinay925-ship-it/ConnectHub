/* =============================================
   RUBHI - Register Page
   ============================================= */

Router.register('register', () => {
  const { showToast, setupCharCounter } = RubhiUtils;

  const form        = document.getElementById('register-form');
  const fullNameEl  = document.getElementById('reg-fullname');
  const usernameEl  = document.getElementById('reg-username');
  const emailEl     = document.getElementById('reg-email');
  const passEl      = document.getElementById('reg-password');
  const picInput    = document.getElementById('reg-profile-pic');
  const picPreview  = document.getElementById('reg-pic-preview');
  const picBtn      = document.getElementById('reg-pic-btn');
  const submitBtn   = document.getElementById('reg-submit');
  const errEl       = document.getElementById('reg-error');
  const toggleBtn   = document.getElementById('reg-toggle-pw');

  if (!form) return;

  // Password toggle
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const isText = passEl.type === 'text';
      passEl.type = isText ? 'password' : 'text';
      toggleBtn.innerHTML = isText
        ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
        : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
    });
  }

  // Profile pic preview
  if (picBtn && picInput) {
    picBtn.addEventListener('click', () => picInput.click());
    picInput.addEventListener('change', () => {
      const file = picInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          picPreview.src = e.target.result;
          picPreview.style.display = 'block';
          picBtn.style.display = 'none';
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Username sanitise
  if (usernameEl) {
    usernameEl.addEventListener('input', () => {
      usernameEl.value = usernameEl.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    });
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    errEl.textContent = '';
    errEl.style.display = 'none';

    const formData = new FormData();
    formData.append('full_name', fullNameEl.value.trim());
    formData.append('username', usernameEl.value.trim());
    formData.append('email', emailEl.value.trim());
    formData.append('password', passEl.value);
    if (picInput.files[0]) formData.append('profile_picture', picInput.files[0]);

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner spinner-sm"></span> Creating account...`;

    const res = await api.register(formData);

    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Create Account';

    if (res.ok) {
      showToast('Account created! Please sign in.', 'success');
      Router.navigate('login');
    } else {
      const msg = res.data.error || res.data.errors?.[0]?.msg || 'Registration failed.';
      errEl.textContent = msg;
      errEl.style.display = 'block';
    }
  };
});
