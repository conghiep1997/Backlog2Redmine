(function () {
  // Prevent duplicate injections
  if (document.getElementById("b2r-sheet-floating-btn")) return;

  // Create floating button
  const button = document.createElement("div");
  button.id = "b2r-sheet-floating-btn";
  button.innerText = "📋 B2R";

  // Style the floating button
  Object.assign(button.style, {
    position: "fixed",
    right: "0px",
    top: "50%",
    transform: "translateY(-50%)",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    padding: "12px 8px 12px 14px",
    borderRadius: "10px 0 0 10px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "bold",
    fontFamily: "sans-serif",
    boxShadow: "-2px 4px 10px rgba(0,0,0,0.15)",
    zIndex: "999999",
    transition: "all 0.3s ease",
    userSelect: "none",
  });

  // Hover effects
  button.addEventListener("mouseenter", () => {
    button.style.backgroundColor = "#1d4ed8";
    button.style.paddingLeft = "18px";
  });
  button.addEventListener("mouseleave", () => {
    button.style.backgroundColor = "#2563eb";
    button.style.paddingLeft = "14px";
  });

  // Create Sidebar Iframe Container
  const sidebarContainer = document.createElement("div");
  sidebarContainer.id = "b2r-sheet-sidebar-container";

  Object.assign(sidebarContainer.style, {
    position: "fixed",
    right: "-420px",
    top: "0px",
    width: "400px",
    height: "100%",
    backgroundColor: "#ffffff",
    boxShadow: "-4px 0 15px rgba(0,0,0,0.15)",
    zIndex: "999998",
    transition: "right 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
    borderLeft: "1px solid #d7dde7",
  });

  const iframe = document.createElement("iframe");
  iframe.src = chrome.runtime.getURL("src/sheets-sidebar.html");
  Object.assign(iframe.style, {
    width: "100%",
    height: "100%",
    border: "none",
  });

  sidebarContainer.appendChild(iframe);
  document.body.appendChild(button);
  document.body.appendChild(sidebarContainer);

  let isOpen = false;

  button.addEventListener("click", () => {
    isOpen = !isOpen;
    if (isOpen) {
      sidebarContainer.style.right = "0px";
      button.style.right = "400px";
      button.innerText = "➡️";
    } else {
      sidebarContainer.style.right = "-420px";
      button.style.right = "0px";
      button.innerText = "📋 B2R";
    }
  });

  // Handle messages from iframe to update spreadsheet URL automatically
  window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "B2R_GET_CURRENT_URL") {
      iframe.contentWindow.postMessage(
        {
          type: "B2R_CURRENT_URL_RESPONSE",
          url: window.location.href,
        },
        "*"
      );
    }
  });
})();
