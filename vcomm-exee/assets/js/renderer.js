// Get the webview element
const webview = document.querySelector('webview');

// Configure webview security settings
webview.addEventListener('dom-ready', () => {
	// Allow insecure content in the webview
	webview.executeJavaScript(`
    // This will allow mixed content in the webview
    console.log('Webview is ready and configured for insecure origins');
  `);
});

// Home button exists
if (document.querySelector('#home')) {
	const homeButton = document.querySelector('#home');
	const homeUrl = webview.getAttribute('data-home') || 'https://github.com';

	homeButton.addEventListener('click', () => {
		webview.src = homeUrl;
	});
}

// Print button exists
if (document.querySelector('#print_button')) {
	const printButton = document.querySelector('#print_button');

	printButton.addEventListener('click', () => {
		// Check if electronAPI is available (from preload.js)
		if (window.electronAPI && window.electronAPI.print) {
			window.electronAPI.print();
		} else {
			// Fallback: print the webview directly
			webview.print();
		}
	});
}

// Handle webview events
webview.addEventListener('dom-ready', () => {
	console.log('Webview is ready');
});

// Handle permission requests from the webview (CRITICAL for WebRTC)
// The webview DOM element gates permissions. Even if the main process allows it,
// the embedder (renderer) must explicitly allow it here.
webview.addEventListener('permissionrequest', (e) => {
	console.log('Webview requested permission:', e.permission);
	const allowed = ['media', 'fullscreen', 'display-capture', 'notifications'];
	if (allowed.includes(e.permission)) {
		e.request.allow();
	}
});

webview.addEventListener('did-fail-load', event => {
	console.error('Failed to load:', event);
});

// Handle navigation
webview.addEventListener('did-navigate', event => {
	console.log('Navigated to:', event.url);
});

webview.addEventListener('did-navigate-in-page', event => {
	console.log('Navigated in page to:', event.url);
});
