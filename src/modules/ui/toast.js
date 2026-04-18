/**
 * Toast management for Backlog2Redmine Extension.
 */


function showToast(message, type = "info") {
  ensureToastShell();
  const toast = modalElements.toast;
  toast.textContent = message;
  toast.dataset.type = type;
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add("tb-toast--visible"));

  window.clearTimeout(toast._tbTimer);
  toast._tbTimer = window.setTimeout(() => {
    toast.classList.remove("tb-toast--visible");
    window.setTimeout(() => {
      toast.hidden = true;
    }, 200);
  }, 3000);
}

function ensureToastShell() {
  if (modalElements?.toast) return;

  const toast = document.createElement("div");
  toast.className = "tb-toast";
  toast.hidden = true;
  document.body.appendChild(toast);

  modalElements = modalElements ?? {};
  modalElements.toast = toast;
}
