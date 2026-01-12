// Get webview element
const webview = document.querySelector('webview');

// Status indicators
let isLoading = false;
let canGoBack = false;
let canGoForward = false;

// Update navigation buttons state
function updateNavigationButtons() {
	const backButton = document.getElementById('back');
	const forwardButton = document.getElementById('forward');

	if (backButton) backButton.disabled = !canGoBack;
	if (forwardButton) forwardButton.disabled = !canGoForward;
}

// Update loading state
function updateLoadingState(loading) {
	isLoading = loading;
	const refreshButton = document.getElementById('refresh');

	if (refreshButton) {
		if (loading) {
			refreshButton.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 6v6m0 0v6m0 0v6"/>
                    </circle>
                </svg>
            `;
			refreshButton.style.animation = 'spin 1s linear infinite';
		} else {
			refreshButton.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-2.21 0-4.2.9-5.65 2.35A8 8 0 0 0 8 8c0 2.21.9 4.2 5.65 2.35A8 8 0 0 0 8 8c0 2.21-.9 4.2-5.65 2.35zm-1.05 8.95l-1.41 1.41L12 20.17l-1.41 1.41L8.59 16.59 10 18l1.41-1.41L12 15.17l1.41-1.41L14.59 16.59 10 18l1.41-1.41z"/>
                </svg>
            `;
			refreshButton.style.animation = '';
		}
	}
}

// Home button
if (document.getElementById('home')) {
	const homeButton = document.getElementById('home');
	const homeUrl =
		webview.getAttribute('data-home') || 'http://192.168.204.102/';

	homeButton.addEventListener('click', () => {
		if (window.electronAPI && window.electronAPI.navigateHome) {
			window.electronAPI.navigateHome();
		} else {
			webview.src = homeUrl;
		}
	});
}

// Back button
if (document.getElementById('back')) {
	const backButton = document.getElementById('back');

	backButton.addEventListener('click', () => {
		if (window.electronAPI && window.electronAPI.navigateBack) {
			window.electronAPI.navigateBack();
		} else if (webview && webview.goBack) {
			webview.goBack();
		}
	});
}

// Forward button
if (document.getElementById('forward')) {
	const forwardButton = document.getElementById('forward');

	forwardButton.addEventListener('click', () => {
		if (window.electronAPI && window.electronAPI.navigateForward) {
			window.electronAPI.navigateForward();
		} else if (webview && webview.goForward) {
			webview.goForward();
		}
	});
}

// Refresh button
if (document.getElementById('refresh')) {
	const refreshButton = document.getElementById('refresh');

	refreshButton.addEventListener('click', () => {
		if (webview) {
			webview.reload();
		}
	});
}

// Print button
if (document.getElementById('print')) {
	const printButton = document.getElementById('print');

	printButton.addEventListener('click', () => {
		if (window.electronAPI && window.electronAPI.print) {
			window.electronAPI.print();
		} else if (webview && webview.print) {
			webview.print();
		}
	});
}

// Developer Tools button
if (document.getElementById('devtools')) {
	const devtoolsButton = document.getElementById('devtools');

	devtoolsButton.addEventListener('click', () => {
		if (window.electronAPI && window.electronAPI.openDevTools) {
			window.electronAPI.openDevTools();
		}
	});
}

// Handle webview events
webview.addEventListener('dom-ready', () => {
	console.log('BLM Webview is ready');
	updateLoadingState(false);
});

webview.addEventListener('did-start-loading', () => {
	console.log('Started loading');
	updateLoadingState(true);
});

webview.addEventListener('did-stop-loading', () => {
	console.log('Stopped loading');
	updateLoadingState(false);
});

webview.addEventListener('did-navigate', event => {
	console.log('Navigated to:', event.url);
	updateNavigationState();
});

webview.addEventListener('did-navigate-in-page', event => {
	console.log('Navigated in page to:', event.url);
});

webview.addEventListener('page-title-updated', event => {
	console.log('Page title updated:', event.title);
	document.title = `BLM Webview - ${event.title}`;
});

// Update navigation state
function updateNavigationState() {
	if (webview) {
		canGoBack = webview.canGoBack();
		canGoForward = webview.canGoForward();
		updateNavigationButtons();
	}
}

// Keyboard shortcuts
document.addEventListener('keydown', event => {
	if (event.target.tagName === 'WEBVIEW') {
		return; // Let webview handle its own keyboard events
	}

	switch (event.key) {
		case 'F5':
		case 'r':
			if (event.ctrlKey || event.metaKey) {
				event.preventDefault();
				if (webview) webview.reload();
			}
			break;
		case 'p':
			if (event.ctrlKey || event.metaKey) {
				event.preventDefault();
				if (window.electronAPI && window.electronAPI.print) {
					window.electronAPI.print();
				}
			}
			break;
	}
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
	console.log('BLM Webview renderer script loaded');
	updateNavigationState();
});
