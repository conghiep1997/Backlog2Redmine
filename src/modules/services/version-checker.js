/**
 * Injected script to communicate with the Dev Tool Platform webpage
 * Sends extension version to the webpage for automatic detection
 */

(function() {
  'use strict'

  // Get current extension version from manifest
  const manifest = chrome.runtime.getManifest()
  const version = manifest.version

  console.log('[B2R] Extension version:', version)

  // Send version to webpage via postMessage
  const sendVersionToPage = () => {
    window.postMessage(
      {
        type: 'EXTENSION_VERSION',
        version: version,
        timestamp: Date.now(),
      },
      '*' // Target all origins (safe because webpage listens specifically)
    )
    console.log('[B2R] Sent version to webpage:', version)
  }

  // Send version when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sendVersionToPage)
  } else {
    sendVersionToPage()
  }

  // Also send version when navigating to versions/download page
  const observer = new MutationObserver(() => {
    const currentUrl = window.location.href
    if (
      currentUrl.includes('/versions') ||
      currentUrl.includes('/download')
    ) {
      sendVersionToPage()
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })
})()
