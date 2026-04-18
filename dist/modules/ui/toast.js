/**
 * Toast management for Backlog2Redmine Extension.
 */

// Local state for toast element (avoid conflict with modal.js global)
let toastElement = null;

function showToast(message, type = "info") {
  ensureToastShell();
  toastElement.textContent = message;
  toastElement.dataset.type = type;
  toastElement.hidden = false;
  requestAnimationFrame(() => toastElement.classList.add("tb-toast--visible"));

  window.clearTimeout(toastElement._tbTimer);
  toastElement._tbTimer = window.setTimeout(() => {
    toastElement.classList.remove("tb-toast--visible");
    window.setTimeout(() => {
      toastElement.hidden = true;
    }, 200);
  }, 3000);
}

function ensureToastShell() {
  if (toastElement) {
    return;
  }

  toastElement = document.createElement("div");
  toastElement.className = "tb-toast";
  toastElement.hidden = true;
  document.body.appendChild(toastElement);
}
