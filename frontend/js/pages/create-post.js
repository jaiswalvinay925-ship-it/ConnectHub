/* =============================================
   RUBHI - Create Post Page
   ============================================= */

let cropperInstance    = null;
let currentCropFile    = null;
let currentCropFileIndex = -1;
let currentAspectRatio = 4 / 5;  // default portrait — matches feed display
let _renderPreviews    = null;    // hoisted so cropAndSave can call it
let _files             = [];      // shared reference

Router.register('create-post', () => {
  const dropzone    = document.getElementById('post-dropzone');
  const fileInput   = document.getElementById('post-file-input');
  const previewGrid = document.getElementById('post-preview-grid');
  const captionEl   = document.getElementById('post-caption');
  const charCount   = document.getElementById('post-caption-count');
  const submitBtn   = document.getElementById('post-submit');
  const form        = document.getElementById('create-post-form');

  if (!form) return;

  _files = [];
  RubhiUtils.setupCharCounter(captionEl, charCount, 2200);

  // ---- Drag & drop ----
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover',  (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    addFiles(Array.from(e.dataTransfer.files));
  });
  fileInput.addEventListener('change', () => {
    addFiles(Array.from(fileInput.files));
    fileInput.value = '';
  });

  function addFiles(newFiles) {
    const allowed = ['image/jpeg','image/png','image/webp','video/mp4'];
    const valid = newFiles.filter(f => allowed.includes(f.type));
    if (_files.length + valid.length > 10) {
      RubhiUtils.showToast('Maximum 10 files.', 'warning');
      valid.splice(10 - _files.length);
    }
    _files.push(...valid);
    renderPreviews();
  }

  // Expose renderPreviews globally so cropAndSave can reach it
  _renderPreviews = renderPreviews;

  function renderPreviews() {
    previewGrid.innerHTML = '';
    if (_files.length === 0) { dropzone.style.display = ''; return; }
    dropzone.style.display = 'none';

    _files.forEach((file, i) => {
      const item = document.createElement('div');
      item.className = 'upload-preview-item';
      const url = URL.createObjectURL(file);

      if (file.type.startsWith('video/')) {
        item.innerHTML = `<video src="${url}" style="width:100%;height:100%;object-fit:cover"></video>`;
      } else {
        item.innerHTML = `<img src="${url}" alt="preview" style="width:100%;height:100%;object-fit:cover">`;
      }

      // Crop overlay (images only)
      if (file.type.startsWith('image/')) {
        item.innerHTML += `
          <div class="upload-preview-overlay">
            <button class="btn btn-sm btn-secondary" onclick="cropImage(${i})" style="font-size:12px;padding:5px 12px">
              ✎ Crop
            </button>
          </div>`;
      }

      item.innerHTML += `<button class="upload-preview-remove" onclick="removeFile(${i})">×</button>`;
      previewGrid.appendChild(item);
    });

    // Add more (+) tile
    if (_files.length < 10) {
      const addBtn = document.createElement('div');
      addBtn.className = 'upload-preview-item';
      addBtn.style.cssText = 'display:flex;align-items:center;justify-content:center;cursor:pointer;border:2px dashed var(--border-2);border-radius:var(--radius-lg)';
      addBtn.innerHTML = `<span style="color:var(--white-30);font-size:28px">+</span>`;
      addBtn.addEventListener('click', () => fileInput.click());
      previewGrid.appendChild(addBtn);
    }
  }

  window.removeFile = (i) => {
    _files.splice(i, 1);
    renderPreviews();
    if (_files.length === 0) dropzone.style.display = '';
  };

  window.cropImage = (i) => {
    const file = _files[i];
    if (!file || !file.type.startsWith('image/')) {
      RubhiUtils.showToast('Only images can be cropped.', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => openCropModal(e.target.result, file, i);
    reader.readAsDataURL(file);
  };

  // ---- Submit ----
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (_files.length === 0) {
      RubhiUtils.showToast('Add at least one photo or video.', 'warning');
      return;
    }
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner spinner-sm"></span> Sharing…`;

    const formData = new FormData();
    _files.forEach(f => formData.append('media', f));
    if (captionEl.value.trim()) formData.append('caption', captionEl.value.trim());

    const res = await api.createPost(formData);
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Share Post';

    if (res.ok) {
      _files = [];
      captionEl.value = '';
      renderPreviews();
      RubhiUtils.showToast('Post shared!', 'success');
      Router.navigate('home');
    } else {
      RubhiUtils.showToast(res.data.error || 'Failed to create post.', 'error');
    }
  };
});

/* =============================================
   CROP MODAL — opened from cropImage()
   ============================================= */
function openCropModal(imageSrc, file, index) {
  const cropImg = document.getElementById('crop-image');
  if (!cropImg) return;

  cropImg.src = imageSrc;
  currentCropFile      = file;
  currentCropFileIndex = index;

  if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }

  // Highlight default ratio button (4:5)
  _updateRatioButtons(currentAspectRatio);

  RubhiUtils.openModal('crop-image-modal');

  setTimeout(() => {
    cropperInstance = new Cropper(cropImg, {
      aspectRatio:          currentAspectRatio,
      viewMode:             1,
      autoCropArea:         0.85,
      responsive:           true,
      guides:               true,
      center:               true,
      highlight:            true,
      cropBoxMovable:       true,
      cropBoxResizable:     true,
      toggleDragModeOnDblclick: false,
    });
  }, 80);
}

function _updateRatioButtons(ratio) {
  document.querySelectorAll('.ratio-btn[data-ratio]').forEach(btn => {
    const v = btn.dataset.ratio;
    const active =
      (v === '1'    && !isNaN(ratio) && Math.abs(ratio - 1)    < 0.01) ||
      (v === '4/5'  && !isNaN(ratio) && Math.abs(ratio - 4/5)  < 0.01) ||
      (v === '16/9' && !isNaN(ratio) && Math.abs(ratio - 16/9) < 0.01) ||
      (v === 'free' && isNaN(ratio));
    btn.classList.toggle('ratio-active', active);
  });
}

window.cropSetAspectRatio = (ratioStr) => {
  const ratio = ratioStr === 'free' ? NaN : Number(ratioStr);
  currentAspectRatio = ratio;
  if (cropperInstance) cropperInstance.setAspectRatio(isNaN(ratio) ? NaN : ratio);
  _updateRatioButtons(ratio);
};

window.cropAndSave = () => {
  if (!cropperInstance || currentCropFileIndex < 0) return;

  // Pick output dimensions based on ratio
  let outW = 1080, outH = 1350; // default 4:5
  const r = currentAspectRatio;
  if (!isNaN(r)) {
    if      (Math.abs(r - 1)      < 0.01) { outW = 1080; outH = 1080; }
    else if (Math.abs(r - 4/5)    < 0.01) { outW = 1080; outH = 1350; }
    else if (Math.abs(r - 16/9)   < 0.01) { outW = 1920; outH = 1080; }
    else                                   { outW = 1080; outH = Math.round(1080 / r); }
  }

  const canvas = cropperInstance.getCroppedCanvas({
    width:  outW, height: outH,
    fillColor: '#000',
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
  });

  canvas.toBlob((blob) => {
    if (!blob) { RubhiUtils.showToast('Crop failed.', 'error'); return; }

    const croppedFile = new File([blob], currentCropFile?.name || 'cropped.jpg', { type: 'image/jpeg' });
    _files[currentCropFileIndex] = croppedFile;

    cropperInstance.destroy();
    cropperInstance    = null;
    currentCropFile    = null;
    currentCropFileIndex = -1;

    RubhiUtils.closeModal('crop-image-modal');
    if (_renderPreviews) _renderPreviews();
    RubhiUtils.showToast('Cropped!', 'success');
  }, 'image/jpeg', 0.95);
};
