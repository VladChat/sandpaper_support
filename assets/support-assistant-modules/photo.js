// assets/support-assistant-modules/photo.js
// Purpose: browser-side photo selection, resize, compression, preview, pending transfer, and payload creation for AI support chat.
(function (shared) {
  if (!shared) {
    return;
  }

  const PENDING_PHOTO_KEY = "equalle_support_pending_photo_v1";
  const MAX_ORIGINAL_BYTES = 12 * 1024 * 1024;
  const MAX_PROCESSED_BYTES = 1 * 1024 * 1024;
  const MAX_DIMENSION = 1280;
  const MIN_DIMENSION = 200;
  const JPEG_QUALITIES = [0.82, 0.75, 0.68];
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
  const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "heic", "heif"];

  let observerStarted = false;

  function fileExtension(fileName) {
    const value = String(fileName || "").toLowerCase();
    const parts = value.split(".");
    return parts.length > 1 ? parts.pop() : "";
  }

  function isAllowedFile(file) {
    const type = String(file && file.type ? file.type : "").toLowerCase();
    const ext = fileExtension(file && file.name ? file.name : "");
    return ALLOWED_TYPES.indexOf(type) !== -1 || ALLOWED_EXTENSIONS.indexOf(ext) !== -1;
  }

  function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (!Number.isFinite(value) || value <= 0) {
      return "";
    }
    if (value >= 1024 * 1024) {
      return (value / (1024 * 1024)).toFixed(1).replace(/\.0$/, "") + " MB";
    }
    return Math.max(1, Math.round(value / 1024)) + " KB";
  }

  function showError(container, message) {
    const error = container ? container.querySelector("[data-support-photo-error]") : null;
    if (!error) {
      return;
    }
    error.textContent = message || "Could not process this image. Please try another photo.";
    error.hidden = false;
  }

  function clearError(container) {
    const error = container ? container.querySelector("[data-support-photo-error]") : null;
    if (!error) {
      return;
    }
    error.textContent = "";
    error.hidden = true;
  }

  function readBlobAsDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || "")); };
      reader.onerror = function () { reject(new Error("Image could not be read.")); };
      reader.readAsDataURL(blob);
    });
  }

  function canvasToBlob(canvas, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (!blob) {
          reject(new Error("Image could not be compressed."));
          return;
        }
        resolve(blob);
      }, "image/jpeg", quality);
    });
  }

  function loadBitmap(file) {
    if (typeof window.createImageBitmap === "function") {
      return window.createImageBitmap(file, { imageOrientation: "from-image" });
    }

    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Image could not be opened."));
      };
      img.src = url;
    });
  }

  function getBitmapSize(bitmap) {
    return {
      width: Number(bitmap.width || bitmap.naturalWidth || 0),
      height: Number(bitmap.height || bitmap.naturalHeight || 0),
    };
  }

  function resizeDimensions(width, height) {
    const largest = Math.max(width, height);
    if (largest <= MAX_DIMENSION) {
      return { width: width, height: height };
    }
    const scale = MAX_DIMENSION / largest;
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    };
  }

  async function processPhoto(file) {
    if (!file) {
      throw new Error("No image selected.");
    }
    if (!isAllowedFile(file)) {
      throw new Error("Unsupported image type. Please upload JPG, PNG, WEBP, or HEIC.");
    }
    if (file.size > MAX_ORIGINAL_BYTES) {
      throw new Error("Image is too large. Max 12 MB.");
    }

    const bitmap = await loadBitmap(file);
    const size = getBitmapSize(bitmap);
    if (size.width < MIN_DIMENSION || size.height < MIN_DIMENSION) {
      if (typeof bitmap.close === "function") {
        bitmap.close();
      }
      throw new Error("Image is too small. Please upload a clearer photo.");
    }

    const target = resizeDimensions(size.width, size.height);
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      if (typeof bitmap.close === "function") {
        bitmap.close();
      }
      throw new Error("Could not process this image. Please try another photo.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, target.width, target.height);
    context.drawImage(bitmap, 0, 0, target.width, target.height);
    if (typeof bitmap.close === "function") {
      bitmap.close();
    }

    let finalBlob = null;
    for (let index = 0; index < JPEG_QUALITIES.length; index += 1) {
      const blob = await canvasToBlob(canvas, JPEG_QUALITIES[index]);
      finalBlob = blob;
      if (blob.size <= MAX_PROCESSED_BYTES) {
        break;
      }
    }

    if (!finalBlob || finalBlob.size > MAX_PROCESSED_BYTES) {
      throw new Error("Could not make this image small enough. Please try another photo.");
    }

    const dataUrl = await readBlobAsDataUrl(finalBlob);
    return {
      dataUrl: dataUrl,
      mimeType: "image/jpeg",
      width: target.width,
      height: target.height,
      sizeBytes: finalBlob.size,
      detail: "low",
    };
  }

  function createSvgIcon() {
    return [
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">',
      '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h2.1l1.1-1.6A1 1 0 0 1 10.5 3h3a1 1 0 0 1 .8.4L15.4 5h2.1A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
      '<circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/>',
      '</svg>',
    ].join("");
  }

  function createFallbackButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "support-tool-button support-photo-button";
    button.setAttribute("data-support-photo-button", "");
    button.setAttribute("aria-label", "Add photo");
    button.title = "Add photo";
    button.innerHTML = createSvgIcon() + '<span>Add Photo</span>';
    return button;
  }

  function resolveForm(shellOrForm) {
    if (!shellOrForm) {
      return null;
    }
    if (shellOrForm.form) {
      return shellOrForm.form;
    }
    if (shellOrForm.matches && (shellOrForm.matches("form") || shellOrForm.classList.contains("support-search-form"))) {
      return shellOrForm;
    }
    if (shellOrForm.querySelector) {
      return shellOrForm.querySelector("form, .support-search-form, [data-ai-form], [data-solution-followup-form]");
    }
    return null;
  }

  function resolveInput(shellOrForm, form) {
    if (shellOrForm && shellOrForm.input) {
      return shellOrForm.input;
    }
    return form ? form.querySelector("[data-ai-input], [data-solution-followup-input], [data-support-search], .chat-input, .support-search-input") : null;
  }

  function findPreviewContainer(form) {
    const parent = form && form.parentNode ? form.parentNode : null;
    if (!parent) {
      return form;
    }
    if (
      parent.classList &&
      (parent.classList.contains("support-followup-bar-shell") ||
        parent.classList.contains("support-search-shell") ||
        parent.classList.contains("chat-shell"))
    ) {
      return parent;
    }
    return parent;
  }

  function attachPhotoInput(shellOrForm) {
    const form = resolveForm(shellOrForm);
    if (!form) {
      return null;
    }

    if (form.__equalleSupportPhotoController) {
      return form.__equalleSupportPhotoController;
    }

    const input = resolveInput(shellOrForm, form);
    let currentImage = null;
    let previewUrl = "";

    const cameraInput = document.createElement("input");
    cameraInput.type = "file";
    cameraInput.accept = "image/*,.jpg,.jpeg,.png,.webp,.heic,.heif";
    cameraInput.hidden = true;
    cameraInput.setAttribute("capture", "environment");
    cameraInput.setAttribute("data-support-photo-camera-input", "");

    const libraryInput = document.createElement("input");
    libraryInput.type = "file";
    libraryInput.accept = "image/*,.jpg,.jpeg,.png,.webp,.heic,.heif";
    libraryInput.hidden = true;
    libraryInput.setAttribute("data-support-photo-library-input", "");

    let button = form.querySelector("[data-support-photo-button], .support-photo-button");
    if (!button) {
      button = createFallbackButton();
      const sendButton = form.querySelector("button[type='submit'], [data-support-search-submit], .support-search-button, .chat-send");
      if (sendButton && sendButton.parentNode === form) {
        form.insertBefore(button, sendButton);
      } else {
        form.appendChild(button);
      }
    }

    button.setAttribute("data-support-photo-button", "");
    button.setAttribute("aria-label", "Add photo");
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", "false");
    button.title = "Add photo";

    const pickerWrap = document.createElement("div");
    pickerWrap.className = "support-photo-picker-wrap";
    if (button.parentNode) {
      button.parentNode.insertBefore(pickerWrap, button);
      pickerWrap.appendChild(button);
    }

    const menu = document.createElement("div");
    menu.className = "support-photo-menu";
    menu.hidden = true;
    menu.setAttribute("role", "menu");

    const takePhotoButton = document.createElement("button");
    takePhotoButton.type = "button";
    takePhotoButton.className = "support-photo-menu-button";
    takePhotoButton.setAttribute("role", "menuitem");
    takePhotoButton.textContent = "Take Photo";

    const photoLibraryButton = document.createElement("button");
    photoLibraryButton.type = "button";
    photoLibraryButton.className = "support-photo-menu-button";
    photoLibraryButton.setAttribute("role", "menuitem");
    photoLibraryButton.textContent = "Photo Library";

    menu.appendChild(takePhotoButton);
    menu.appendChild(photoLibraryButton);
    pickerWrap.appendChild(menu);

    const preview = document.createElement("div");
    preview.className = "support-photo-preview";
    preview.hidden = true;
    preview.setAttribute("data-support-photo-preview", "");

    const error = document.createElement("div");
    error.className = "support-photo-error";
    error.hidden = true;
    error.setAttribute("data-support-photo-error", "");
    error.setAttribute("aria-live", "polite");

    function clearPreviewUrl() {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = "";
      }
    }

    function clear() {
      currentImage = null;
      cameraInput.value = "";
      libraryInput.value = "";
      clearPreviewUrl();
      preview.innerHTML = "";
      preview.hidden = true;
      error.hidden = true;
      error.textContent = "";
      button.classList.remove("support-photo-button-attached");
      button.disabled = false;
      closeMenu();
    }

    function renderPreview(file, image) {
      clearPreviewUrl();
      preview.innerHTML = "";
      previewUrl = URL.createObjectURL(file);

      const thumb = document.createElement("img");
      thumb.className = "support-photo-thumb";
      thumb.src = previewUrl;
      thumb.alt = "Attached photo preview";
      thumb.decoding = "async";

      const meta = document.createElement("div");
      meta.className = "support-photo-preview-meta";

      const title = document.createElement("span");
      title.className = "support-photo-preview-title";
      title.textContent = "Photo attached";

      const size = document.createElement("span");
      size.className = "support-photo-preview-size";
      size.textContent = formatBytes(image.sizeBytes);

      meta.appendChild(title);
      if (size.textContent) {
        meta.appendChild(size);
      }

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "support-photo-remove";
      remove.textContent = "Remove";
      remove.addEventListener("click", clear);

      preview.appendChild(thumb);
      preview.appendChild(meta);
      preview.appendChild(remove);
      preview.hidden = false;
      button.classList.add("support-photo-button-attached");
    }

    function openMenu() {
      if (button.disabled) {
        return;
      }
      menu.hidden = false;
      button.setAttribute("aria-expanded", "true");
    }

    function closeMenu() {
      menu.hidden = true;
      button.setAttribute("aria-expanded", "false");
    }

    function toggleMenu() {
      if (menu.hidden) {
        openMenu();
        return;
      }
      closeMenu();
    }

    function processSelectedFile(file, sourceInput) {
      if (!file) {
        return;
      }

      clearError(error.parentNode || form);
      button.disabled = true;
      button.classList.add("support-photo-button-loading");

      processPhoto(file).then(function (image) {
        currentImage = image;
        renderPreview(file, image);
        if (input && typeof input.focus === "function") {
          input.focus();
        }
      }).catch(function (reason) {
        currentImage = null;
        sourceInput.value = "";
        clearPreviewUrl();
        preview.innerHTML = "";
        preview.hidden = true;
        showError(error.parentNode || form, reason && reason.message ? reason.message : "Could not process this image. Please try another photo.");
      }).finally(function () {
        button.disabled = false;
        button.classList.remove("support-photo-button-loading");
      });
    }

    button.addEventListener("click", function (event) {
      event.preventDefault();
      if (button.disabled) {
        return;
      }
      toggleMenu();
    });

    takePhotoButton.addEventListener("click", function () {
      closeMenu();
      cameraInput.click();
    });

    photoLibraryButton.addEventListener("click", function () {
      closeMenu();
      libraryInput.click();
    });

    document.addEventListener("click", function (event) {
      if (menu.hidden) {
        return;
      }
      if (pickerWrap.contains(event.target)) {
        return;
      }
      closeMenu();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape" || menu.hidden) {
        return;
      }
      closeMenu();
      if (input && typeof input.focus === "function") {
        input.focus();
      }
    });

    cameraInput.addEventListener("change", function () {
      const file = cameraInput.files && cameraInput.files[0] ? cameraInput.files[0] : null;
      processSelectedFile(file, cameraInput);
    });

    libraryInput.addEventListener("change", function () {
      const file = libraryInput.files && libraryInput.files[0] ? libraryInput.files[0] : null;
      processSelectedFile(file, libraryInput);
    });

    form.appendChild(cameraInput);
    form.appendChild(libraryInput);

    const previewContainer = findPreviewContainer(form);
    if (previewContainer && form.parentNode === previewContainer) {
      form.insertAdjacentElement("afterend", preview);
      preview.insertAdjacentElement("afterend", error);
    } else if (previewContainer) {
      previewContainer.appendChild(preview);
      previewContainer.appendChild(error);
    } else {
      form.appendChild(preview);
      form.appendChild(error);
    }

    const controller = {
      getImages: function () {
        return currentImage ? [currentImage] : [];
      },
      hasImage: function () {
        return Boolean(currentImage);
      },
      clear: clear,
      form: form,
      input: input,
    };

    form.__equalleSupportPhotoController = controller;
    return controller;
  }

  function getControllerFromElement(element) {
    if (!element) {
      return null;
    }
    const form = element.form || (element.closest ? element.closest("form, .support-search-form, [data-ai-form], [data-solution-followup-form]") : null);
    return form ? (form.__equalleSupportPhotoController || attachPhotoInput(form)) : null;
  }

  function savePendingPhotoFromElement(element) {
    const controller = getControllerFromElement(element);
    const images = controller && typeof controller.getImages === "function" ? controller.getImages() : [];
    if (!images.length) {
      try { sessionStorage.removeItem(PENDING_PHOTO_KEY); } catch (_error) { return false; }
      return false;
    }

    try {
      sessionStorage.setItem(PENDING_PHOTO_KEY, JSON.stringify({
        images: images.slice(0, 1),
        savedAt: new Date().toISOString(),
      }));
      return true;
    } catch (_error) {
      return false;
    }
  }

  function consumePendingPhoto() {
    let raw = "";
    try {
      raw = sessionStorage.getItem(PENDING_PHOTO_KEY) || "";
      sessionStorage.removeItem(PENDING_PHOTO_KEY);
    } catch (_error) {
      return [];
    }

    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      return parsed && Array.isArray(parsed.images) ? parsed.images.slice(0, 1) : [];
    } catch (_error) {
      return [];
    }
  }

  function setupPhotoInputs(root) {
    const scope = root && root.querySelectorAll ? root : document;
    Array.prototype.slice.call(scope.querySelectorAll(".support-search-form, .chat-form, [data-ai-form], [data-solution-followup-form]")).forEach(attachPhotoInput);

    if (observerStarted || !window.MutationObserver) {
      return;
    }

    observerStarted = true;
    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        Array.prototype.slice.call(mutation.addedNodes || []).forEach(function (node) {
          if (!node || node.nodeType !== 1) {
            return;
          }
          if (node.matches && node.matches(".support-search-form, .chat-form, [data-ai-form], [data-solution-followup-form]")) {
            attachPhotoInput(node);
          }
          if (node.querySelectorAll) {
            Array.prototype.slice.call(node.querySelectorAll(".support-search-form, .chat-form, [data-ai-form], [data-solution-followup-form]")).forEach(attachPhotoInput);
          }
        });
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  document.addEventListener("support-search-bar:ready", function (event) {
    setupPhotoInputs(event && event.detail && event.detail.root ? event.detail.root : document);
  });

  Object.assign(shared, {
    attachPhotoInput: attachPhotoInput,
    setupPhotoInputs: setupPhotoInputs,
    savePendingPhotoFromElement: savePendingPhotoFromElement,
    consumePendingPhoto: consumePendingPhoto,
  });
})(window.eQualleSupportAssistantShared = window.eQualleSupportAssistantShared || {});
