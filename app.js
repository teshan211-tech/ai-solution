const form = document.querySelector("#poster-form");
const photoInput = document.querySelector("#photo");
const photoPreview = document.querySelector("#photo-preview");
const removePhoto = document.querySelector("#remove-photo");
const uploadBox = document.querySelector("#upload-box");
const generateBtn = document.querySelector("#generate-btn");
const resultImage = document.querySelector("#result-image");
const emptyState = document.querySelector("#empty-state");
const loadingState = document.querySelector("#loading-state");
const resultActions = document.querySelector("#result-actions");
const errorBox = document.querySelector("#error-box");
const statusChip = document.querySelector("#status-chip");
let referenceData = null;
let currentImageUrl = null;

photoInput.addEventListener("change", async () => {
  const file = photoInput.files?.[0];
  clearError();
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    showError("Please choose a PNG, JPG or WebP image.");
    photoInput.value = "";
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showError("The reference image must be 5 MB or smaller.");
    photoInput.value = "";
    return;
  }
  referenceData = await fileToDataUrl(file);
  photoPreview.src = referenceData;
  photoPreview.hidden = false;
  removePhoto.hidden = false;
  uploadBox.classList.add("has-photo");
});
removePhoto.addEventListener("click", () => {
  photoInput.value = "";
  referenceData = null;
  photoPreview.removeAttribute("src");
  photoPreview.hidden = true;
  removePhoto.hidden = true;
  uploadBox.classList.remove("has-photo");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();
  const data = new FormData(form);
  const product = String(data.get("product") || "").trim();
  if (!product) return showError("Please tell us what you are promoting.");
  const payload = {
    businessType: data.get("businessType"),
    businessName: String(data.get("businessName") || "").trim(),
    product,
    price: String(data.get("price") || "").trim(),
    language: data.get("language"),
    details: String(data.get("details") || "").trim(),
    format: data.get("format"),
    style: data.get("style"),
    referenceImage: referenceData
  };
  setLoading(true);
  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Poster generation failed. Please try again.");
    if (!body.imageData) throw new Error("The AI provider returned no image. Please try again.");
    currentImageUrl = body.imageData;
    resultImage.src = currentImageUrl;
    resultImage.hidden = false;
    emptyState.hidden = true;
    resultActions.hidden = false;
    statusChip.textContent = "Poster generated";
    statusChip.classList.remove("busy");
    statusChip.classList.add("ready");
  } catch (error) {
    showError(error.message || "Something went wrong. Please try again.");
    statusChip.textContent = "Needs attention";
    statusChip.classList.remove("busy");
  } finally {
    setLoading(false);
  }
});

document.querySelector("#download-btn").addEventListener("click", () => {
  if (!currentImageUrl) return;
  const a = document.createElement("a");
  a.href = currentImageUrl;
  a.download = `postermint-poster-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
});
document.querySelector("#new-btn").addEventListener("click", () => {
  resultImage.hidden = true;
  resultImage.removeAttribute("src");
  emptyState.hidden = false;
  resultActions.hidden = true;
  currentImageUrl = null;
  statusChip.textContent = "Waiting for brief";
  statusChip.classList.remove("ready", "busy");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

function setLoading(isLoading) {
  generateBtn.disabled = isLoading;
  generateBtn.innerHTML = isLoading ? "<span>✦</span> Creating your poster…" : '<span>✦</span> Generate my poster <span class="arrow">↗</span>';
  loadingState.hidden = !isLoading;
  if (isLoading) {
    emptyState.hidden = true;
    resultImage.hidden = true;
    resultActions.hidden = true;
    statusChip.textContent = "Generating";
    statusChip.classList.add("busy");
    statusChip.classList.remove("ready");
  } else {
    loadingState.hidden = true;
    if (!currentImageUrl && !errorBox.hidden) emptyState.hidden = false;
  }
}
function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}
function clearError() {
  errorBox.hidden = true;
  errorBox.textContent = "";
}
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}
