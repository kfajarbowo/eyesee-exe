const getControlsHeight = () => {
  const controls = document.querySelector("#controls");
  if (controls) {
    return controls.offsetHeight;
  }
  return 0;
};

const showLoadingScreen = () => {
  // Check if loading screen already exists
  if (document.querySelector("#loading-screen")) {
    return;
  }

  // Create loading screen
  const loadingScreen = document.createElement("div");
  loadingScreen.id = "loading-screen";
  loadingScreen.className = "loading-screen";
  loadingScreen.innerHTML = `
    <div class="loading-content">
      <div class="loading-spinner"></div>
      <h2>Loading...</h2>
      <p>Please wait while the page loads</p>
    </div>
  `;
  
  document.body.appendChild(loadingScreen);
};

const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    // Try adding https:// if no protocol specified
    try {
      new URL('https://' + string);
      return true;
    } catch (_) {
      return false;
    }
  }
};

const normalizeUrl = (url) => {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return 'https://' + url;
  }
  return url;
};

const showUrlModal = () => {
  const modal = document.getElementById('url-modal');
  const urlInput = document.getElementById('url-input');
  const cancelBtn = document.getElementById('url-cancel');
  const submitBtn = document.getElementById('url-submit');

  // Show modal
  modal.classList.remove('hidden');
  
  // Focus and select input
  setTimeout(() => {
    urlInput.focus();
    urlInput.select();
  }, 100);

  // Handle cancel
  const handleCancel = () => {
    modal.classList.add('hidden');
    window.electron.sendUrlInputResponse(null);
    cleanup();
  };

  // Handle submit
  const handleSubmit = () => {
    const url = urlInput.value.trim();
    if (url) {
      modal.classList.add('hidden');
      window.electron.sendUrlInputResponse(url);
      cleanup();
    }
  };

  // Cleanup function to remove event listeners
  const cleanup = () => {
    cancelBtn.removeEventListener('click', handleCancel);
    submitBtn.removeEventListener('click', handleSubmit);
    urlInput.removeEventListener('keydown', handleKeydown);
    modal.removeEventListener('click', handleModalClick);
  };

  // Handle keyboard events
  const handleKeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  // Handle modal background click
  const handleModalClick = (e) => {
    if (e.target === modal) {
      handleCancel();
    }
  };

  // Add event listeners
  cancelBtn.addEventListener('click', handleCancel);
  submitBtn.addEventListener('click', handleSubmit);
  urlInput.addEventListener('keydown', handleKeydown);
  modal.addEventListener('click', handleModalClick);

  // Clear previous input
  urlInput.value = 'https://';
};

const calculateLayoutSize = () => {
  const webview = document.querySelector("webview");
  const windowWidth = document.documentElement.clientWidth;
  const windowHeight = document.documentElement.clientHeight;
  const controlsHeight = getControlsHeight();
  const webviewHeight = windowHeight - controlsHeight;

  webview.style.width = windowWidth + "px";
  webview.style.height = webviewHeight + "px";
};

window.addEventListener("DOMContentLoaded", () => {
  const webview = document.querySelector("webview");
  calculateLayoutSize();

  // Show loading screen only on first load
  showLoadingScreen();
  webview.style.display = "none";

  let firstLoad = true;

  webview.addEventListener("did-stop-loading", () => {
    console.log("Finished loading page");
    const loadingScreen = document.querySelector("#loading-screen");
    if (loadingScreen) {
      loadingScreen.remove();
    }
    webview.style.display = "";
    firstLoad = false;
  });

  // Listen for navigation events from menu bar
  if (window.electron) {
    // Show URL input modal
    window.electron.onShowUrlInputModal(() => {
      showUrlModal();
    });

    // Navigate to URL
    window.electron.onNavigateWebview((event, url) => {
      if (url && isValidUrl(url)) {
        const normalizedUrl = normalizeUrl(url);
        // Do NOT show loading screen again, just hide webview
        webview.style.display = "none";
        webview.src = normalizedUrl;
      }
    });

    // Go back
    window.electron.onWebviewGoBack(() => {
      if (webview.canGoBack()) {
        webview.goBack();
      }
    });

    // Go forward
    window.electron.onWebviewGoForward(() => {
      if (webview.canGoForward()) {
        webview.goForward();
      }
    });

    // Reload
    window.electron.onWebviewReload(() => {
      webview.reload();
    });

    // Go home
    window.electron.onWebviewGoHome(() => {
      const home = webview.getAttribute("data-home");
      if (home) {
        webview.style.display = "none";
        webview.src = home;
      }
    });
  }

  // Dynamic resize function (responsive)
  window.onresize = calculateLayoutSize;
});
