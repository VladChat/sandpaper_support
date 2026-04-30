// assets/support-assistant-modules/photo.js
// Purpose: browser-side photo selection, resize, compression, preview, and payload creation for AI support chat.
(function (shared) {
  if (!shared) {
    return;
  }

  const MAX_ORIGINAL_BYTES = 12 * 1024 * 1024;
  const MAX_PROCESSED_BYTES = 1 * 1024 * 1024;
  const MAX_DIMENSION = 1280;
  const MIN_DIMENSION = 200;
  const JPEG_QUALITIES = [0.82, 0.75, 0.68];
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
  const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "heic", "heif"];

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

  function showError(root, message) {
    const error = root ? root.querySelector("[data-support-photo-error]") : null;
    if (!error) {
      return;
    }
    error.textContent = message || "Could not process this image. Please try another photo.";
    error.hidden = false;
  }

  function clearError(root) {
    const error = root ? root.querySelector("[data-support-photo-error]") : null;
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

  function attachPhotoInput(shell) {
    if (!shell || !shell.form || !shell.input) {
      return null;
    }
    if (shell.form.querySelector("[data-support-photo-input]")) {
      return null;
    }

    let currentImage = null;
    let previewUrl = "";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif";
    fileInput.hidden = true;
    fileInput.setAttribute("data-support-photo-input", "");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "support-photo-button";
    button.setAttribute("data-support-photo-button", "");
    button.setAttribute("aria-label", "Add photo");
    button.innerHTML = createSvgIcon() + '<span class="support-photo-button-text">Add Photo</span>';

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
      fileInput.value = "";
      clearPreviewUrl();
      preview.innerHTML = "";
      preview.hidden = true;
      clearError(shell.form);
      button.classList.remove("support-photo-button-attached");
      button.disabled = false;
    }

    function renderPreview(file, image) {
      clearPreviewUrl();
      preview.innerHTML = "";
      previewUrl = URL.createObjectURL(file);

      const img = document.createElement("img");
      img.src = previewUrl;
      img.alt = "Attached photo preview";
      img.decoding = "async";

      const meta = document.createElement("span");
      meta.className = "support-photo-preview-meta";
      meta.textContent = "Photo attached · " + Math.round(image.sizeBytes / 1024) + " KB";

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "support-photo-remove";
      remove.textContent = "Remove";
      remove.addEventListener("click", clear);

      preview.appendChild(img);
      preview.appendChild(meta);
      preview.appendChild(remove);
      preview.hidden = false;
      button.classList.add("support-photo-button-attached");
    }

    button.addEventListener("click", function () {
      if (button.disabled) {
        return;
      }
      fileInput.click();
    });

    fileInput.addEventListener("change", function () {
      const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
      if (!file) {
        return;
      }

      clearError(shell.form);
      button.disabled = true;
      button.classList.add("support-photo-button-loading");

      processPhoto(file).then(function (image) {
        currentImage = image;
        renderPreview(file, image);
      }).catch(function (error) {
        currentImage = null;
        fileInput.value = "";
        clearPreviewUrl();
        preview.innerHTML = "";
        preview.hidden = true;
        showError(shell.form, error && error.message ? error.message : "Could not process this image. Please try another photo.");
      }).finally(function () {
        button.disabled = false;
        button.classList.remove("support-photo-button-loading");
      });
    });

    const sendButton = shell.form.querySelector("button[type='submit']");
    shell.form.appendChild(fileInput);
    if (sendButton && sendButton.parentNode === shell.form) {
      shell.form.insertBefore(button, sendButton);
    } else {
      shell.form.appendChild(button);
    }
    shell.form.appendChild(preview);
    shell.form.appendChild(error);

    return {
      getImages: function () {
        return currentImage ? [currentImage] : [];
      },
      hasImage: function () {
        return Boolean(currentImage);
      },
      clear: clear,
    };
  }

  Object.assign(shared, {
    attachPhotoInput: attachPhotoInput,
  });
})(window.eQualleSupportAssistantShared = window.eQualleSupportAssistantShared || {});
