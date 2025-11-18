const getControlsHeight = () => {
	const controls = document.querySelector('#controls');
	if (controls) {
		return controls.offsetHeight;
	}
	return 0;
};

// const showLoadingScreen = () => {
// 	// Check if loading screen already exists
// 	if (document.querySelector('#loading-screen')) {
// 		return;
// 	}

// 	// Create loading screen
// 	const loadingScreen = document.createElement('div');
// 	loadingScreen.id = 'loading-screen';
// 	loadingScreen.className = 'loading-screen';
// 	loadingScreen.innerHTML = `
//     <div class="loading-content">
//       <div class="loading-spinner"></div>
//       <h2>Loading...</h2>
//       <p>Please wait while the page loads</p>
//     </div>
//   `;

// 	document.body.appendChild(loadingScreen);
// };

// Light loading indicator for faster navigation
const showLightLoading = () => {
	// Check if loading indicator already exists
	if (document.querySelector('#loading-indicator')) {
		return;
	}

	// Create light loading indicator
	const loadingIndicator = document.createElement('div');
	loadingIndicator.id = 'loading-indicator';
	loadingIndicator.className = 'loading-indicator';
	loadingIndicator.innerHTML = `<div class="mini-spinner"></div>`;

	document.body.appendChild(loadingIndicator);
};

const hideLightLoading = () => {
	const loadingIndicator = document.querySelector('#loading-indicator');
	if (loadingIndicator) {
		loadingIndicator.remove();
	}
};

const isValidUrl = string => {
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

const normalizeUrl = url => {
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
	const handleKeydown = e => {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleSubmit();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			handleCancel();
		}
	};

	// Handle modal background click
	const handleModalClick = e => {
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

// Webview cache for faster navigation
const webviewCache = new Map();

const loadUrlWithCache = url => {
	if (webviewCache.has(url)) {
		// Use cached version if available
		return webviewCache.get(url);
	}

	// Load and cache
	const webview = document.querySelector('webview');
	webview.src = url;
	webviewCache.set(url, webview);

	// Clear cache after 10 minutes
	setTimeout(() => {
		webviewCache.delete(url);
	}, 600000);
};

const calculateLayoutSize = () => {
	const webview = document.querySelector('webview');
	if (!webview) return;

	const windowWidth = document.documentElement.clientWidth;
	const windowHeight = document.documentElement.clientHeight;
	const controlsHeight = getControlsHeight();
	const webviewHeight = windowHeight - controlsHeight;

	webview.style.width = windowWidth + 'px';
	webview.style.height = webviewHeight + 'px';
};

// Debounce function for resize event
let resizeTimeout;
const debouncedResize = () => {
	clearTimeout(resizeTimeout);
	resizeTimeout = setTimeout(calculateLayoutSize, 100);
};

// Memory management cleanup
const cleanup = () => {
	// Remove all event listeners
	window.removeEventListener('resize', debouncedResize);

	// Clear webview cache
	webviewCache.clear();

	// Remove loading indicators
	const loadingScreen = document.querySelector('#loading-screen');
	const loadingIndicator = document.querySelector('#loading-indicator');
	if (loadingScreen) loadingScreen.remove();
	if (loadingIndicator) loadingIndicator.remove();

	// Clean up IPC event listeners
	if (window.eventCleanupFunctions && window.electron) {
		Object.values(window.eventCleanupFunctions).forEach(cleanupFn => {
			if (typeof cleanupFn === 'function') {
				cleanupFn();
			}
		});
	}

	// Remove all IPC listeners
	if (window.electron && window.electron.removeAllListeners) {
		window.electron.removeAllListeners('navigate-webview');
		window.electron.removeAllListeners('webview-go-back');
		window.electron.removeAllListeners('webview-go-forward');
		window.electron.removeAllListeners('webview-reload');
		window.electron.removeAllListeners('webview-go-home');
		window.electron.removeAllListeners('show-url-input-modal');
	}
};

window.addEventListener('DOMContentLoaded', async () => {
	const webview = document.querySelector('webview');
	calculateLayoutSize();

	// Initialize performance modules
	try {
		// Load performance modules dynamically
		const { performanceController } = await import(
			'../src/performance/index.js'
		);
		await performanceController.initialize();
		console.log('Performance modules initialized successfully');

		// Make performance controller globally available
		window.performanceController = performanceController;
	} catch (error) {
		console.error('Failed to initialize performance modules:', error);
	}

	// Show loading screen only on first load
	showLoadingScreen();
	webview.style.display = 'none';

	let firstLoad = true;

	webview.addEventListener('did-stop-loading', () => {
		console.log('Finished loading page');
		const loadingScreen = document.querySelector('#loading-screen');
		const loadingIndicator = document.querySelector('#loading-indicator');

		if (loadingScreen) {
			loadingScreen.remove();
		}
		if (loadingIndicator) {
			loadingIndicator.remove();
		}

		webview.style.display = '';
		firstLoad = false;

		// Trigger performance analysis after page load
		setTimeout(() => {
			if (window.performanceController) {
				const metrics = window.performanceController.getMetrics();
				console.log('Current performance metrics:', metrics);
			}
		}, 2000);
	});

	// Listen for navigation events from menu bar
	if (window.electron) {
		// Show URL input modal
		const cleanupShowUrlModal = window.electron.onShowUrlInputModal(() => {
			showUrlModal();
		});

		// Navigate to URL
		const cleanupNavigateWebview = window.electron.onNavigateWebview(
			(event, url) => {
				if (url && isValidUrl(url)) {
					const normalizedUrl = normalizeUrl(url);
					// Show light loading indicator instead of full screen
					showLightLoading();
					webview.style.display = 'none';
					webview.src = normalizedUrl;
				}
			}
		);

		// Go back
		const cleanupWebviewGoBack = window.electron.onWebviewGoBack(() => {
			if (webview.canGoBack()) {
				webview.goBack();
			}
		});

		// Go forward
		const cleanupWebviewGoForward = window.electron.onWebviewGoForward(() => {
			if (webview.canGoForward()) {
				webview.goForward();
			}
		});

		// Reload
		const cleanupWebviewReload = window.electron.onWebviewReload(() => {
			webview.reload();
		});

		// Go home
		const cleanupWebviewGoHome = window.electron.onWebviewGoHome(() => {
			const home = webview.getAttribute('data-home');
			if (home) {
				showLightLoading();
				webview.style.display = 'none';
				webview.src = home;
			}
		});

		// Store cleanup functions for proper event listener removal
		window.eventCleanupFunctions = {
			cleanupShowUrlModal,
			cleanupNavigateWebview,
			cleanupWebviewGoBack,
			cleanupWebviewGoForward,
			cleanupWebviewReload,
			cleanupWebviewGoHome,
		};
	}

	// Dynamic resize function (responsive) with debounce
	window.addEventListener('resize', debouncedResize);

	// Add performance monitoring shortcuts
	document.addEventListener('keydown', event => {
		// Ctrl+Shift+P: Show performance metrics
		if (event.ctrlKey && event.shiftKey && event.key === 'P') {
			event.preventDefault();
			if (window.performanceController) {
				const report = window.performanceController.getMetrics();
				console.log('Performance Report:', report);

				// Show performance report in UI
				showPerformanceReport(report);
			}
		}

		// Ctrl+Shift+M: Force memory cleanup
		if (event.ctrlKey && event.shiftKey && event.key === 'M') {
			event.preventDefault();
			if (window.performanceController) {
				window.performanceController.forceCleanup();
				console.log('Forced memory cleanup');
			}
		}
	});

	// Performance report display function
	const showPerformanceReport = metrics => {
		const reportDiv = document.createElement('div');
		reportDiv.id = 'performance-report';
		reportDiv.style.cssText = `
			position: fixed;
			top: 20px;
			right: 20px;
			background: rgba(0, 0, 0, 0.9);
			color: white;
			padding: 20px;
			border-radius: 8px;
			font-family: monospace;
			font-size: 12px;
			z-index: 10000;
			max-width: 400px;
			max-height: 300px;
			overflow-y: auto;
		`;

		const memoryUsage = metrics.memory
			? Math.round(metrics.memory.current / 1024 / 1024)
			: 'N/A';
		const performanceScore = metrics.performance
			? metrics.performance.score || 'N/A'
			: 'N/A';

		reportDiv.innerHTML = `
			<h3>Performance Report</h3>
			<p><strong>Memory Usage:</strong> ${memoryUsage}MB</p>
			<p><strong>Performance Score:</strong> ${performanceScore}</p>
			<p><strong>Cache Size:</strong> ${
				metrics.resources ? metrics.resources.cachedItems || 0 : 0
			} items</p>
			<p><strong>Cleanup Count:</strong> ${
				metrics.memory ? metrics.memory.cleanupCount || 0 : 0
			}</p>
			<button onclick="this.parentElement.remove()" style="
				margin-top: 10px;
				padding: 5px 10px;
				background: #007AFF;
				color: white;
				border: none;
				border-radius: 4px;
				cursor: pointer;
			">Close</button>
		`;

		document.body.appendChild(reportDiv);

		// Auto-remove after 10 seconds
		setTimeout(() => {
			const report = document.getElementById('performance-report');
			if (report) report.remove();
		}, 10000);
	};

	// Add cleanup on window unload
	window.addEventListener('beforeunload', () => {
		// Cleanup performance modules
		if (window.performanceController) {
			window.performanceController.destroy();
		}
		cleanup();
	});
});
