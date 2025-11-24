/**
 * Webview Pool Manager
 *
 * Manages a pool of webview instances for reuse and preloading.
 * Phase 2 Implementation - Advanced Performance Optimization
 */

export class WebviewPool {
	constructor() {
		this.pool = [];
		this.maxPoolSize = 5; // Maximum webviews to keep in pool
		this.preloadQueue = [];
		this.preloadedUrls = new Set();
		this.isInitialized = false;

		// Performance metrics
		this.metrics = {
			poolHits: 0,
			poolMisses: 0,
			preloadsCompleted: 0,
			averageCreationTime: 0,
			totalWebviewsCreated: 0,
		};
	}

	/**
	 * Initialize the webview pool
	 */
	async initialize() {
		if (this.isInitialized) return;

		console.log('Initializing webview pool...');

		// Pre-populate pool with webviews
		for (let i = 0; i < 2; i++) {
			await this.createWebviewForPool();
		}

		this.isInitialized = true;
		console.log(`Webview pool initialized with ${this.pool.length} webviews`);
	}

	/**
	 * Create a webview for the pool
	 */
	async createWebviewForPool() {
		const startTime = performance.now();

		const webview = document.createElement('webview');
		webview.style.display = 'none';
		webview.style.position = 'absolute';
		webview.style.left = '-9999px';
		webview.style.top = '-9999px';
		webview.style.width = '1024px';
		webview.style.height = '768px';

		// Add to DOM for proper initialization
		document.body.appendChild(webview);

		// Wait for webview to be ready
		await new Promise(resolve => {
			webview.addEventListener(
				'dom-ready',
				() => {
					const creationTime = performance.now() - startTime;
					this.updateCreationMetrics(creationTime);
					resolve(webview);
				},
				{ once: true }
			);
		});

		this.metrics.totalWebviewsCreated++;
		return webview;
	}

	/**
	 * Get a webview from the pool
	 */
	getWebview() {
		if (this.pool.length > 0) {
			const webview = this.pool.pop();
			this.metrics.poolHits++;
			console.log('Webview pool hit, remaining:', this.pool.length);
			return webview;
		}

		this.metrics.poolMisses++;
		console.log('Webview pool miss, creating new webview');
		return this.createWebviewForPool();
	}

	/**
	 * Return a webview to the pool
	 */
	returnWebview(webview) {
		if (!webview) return;

		// Reset webview state
		webview.style.display = 'none';
		webview.style.left = '-9999px';
		webview.style.top = '-9999px';
		webview.src = 'about:blank';

		// Clear any event listeners
		this.cleanupWebview(webview);

		// Return to pool if not full
		if (this.pool.length < this.maxPoolSize) {
			this.pool.push(webview);
			console.log('Webview returned to pool, pool size:', this.pool.length);
		} else {
			// Remove from DOM if pool is full
			webview.remove();
			console.log('Webview removed (pool full)');
		}
	}

	/**
	 * Preload a URL
	 */
	async preloadUrl(url) {
		if (this.preloadedUrls.has(url)) {
			console.log('URL already preloaded:', url);
			return;
		}

		this.preloadedUrls.add(url);
		this.preloadQueue.push(url);

		// Process preload queue
		this.processPreloadQueue();
	}

	/**
	 * Process the preload queue
	 */
	async processPreloadQueue() {
		if (this.preloadQueue.length === 0) return;

		const url = this.preloadQueue.shift();
		const webview = this.getWebview();

		try {
			console.log('Preloading URL:', url);
			webview.src = url;

			// Wait for preload to complete
			await new Promise(resolve => {
				webview.addEventListener(
					'did-stop-loading',
					() => {
						this.metrics.preloadsCompleted++;
						console.log('Preload completed for:', url);
						this.returnWebview(webview);
						resolve();
					},
					{ once: true }
				);
			});
		} catch (error) {
			console.error('Error preloading URL:', url, error);
			this.returnWebview(webview);
		}
	}

	/**
	 * Get a preloaded webview for a URL
	 */
	getPreloadedWebview(url) {
		// Check if we have a preloaded webview for this URL
		for (let i = 0; i < this.pool.length; i++) {
			const webview = this.pool[i];
			if (webview.getURL && webview.getURL() === url) {
				this.pool.splice(i, 1);
				this.metrics.poolHits++;
				console.log('Using preloaded webview for:', url);
				return webview;
			}
		}

		return null;
	}

	/**
	 * Cleanup webview event listeners and references
	 */
	cleanupWebview(webview) {
		if (!webview) return;

		// Remove all event listeners
		webview.removeEventListener('dom-ready', null);
		webview.removeEventListener('did-stop-loading', null);
		webview.removeEventListener('will-navigate', null);
		webview.removeEventListener('did-navigate', null);
		webview.removeEventListener('dom-ready', null);

		// Clear any references
		webview._poolCleanup = null;
	}

	/**
	 * Update creation metrics
	 */
	updateCreationMetrics(creationTime) {
		const totalTime =
			this.metrics.averageCreationTime *
				(this.metrics.totalWebviewsCreated - 1) +
			creationTime;
		this.metrics.averageCreationTime =
			totalTime / this.metrics.totalWebviewsCreated;
	}

	/**
	 * Get pool statistics
	 */
	getStats() {
		return {
			poolSize: this.pool.length,
			maxPoolSize: this.maxPoolSize,
			preloadQueueSize: this.preloadQueue.length,
			preloadedUrlsCount: this.preloadedUrls.size,
			metrics: this.metrics,
			efficiency: this.calculateEfficiency(),
		};
	}

	/**
	 * Calculate pool efficiency
	 */
	calculateEfficiency() {
		const total = this.metrics.poolHits + this.metrics.poolMisses;
		if (total === 0) return 0;

		return Math.round((this.metrics.poolHits / total) * 100);
	}

	/**
	 * Preload frequently used URLs
	 */
	async preloadFrequentUrls(urls) {
		console.log('Preloading frequently used URLs:', urls);

		for (const url of urls) {
			await this.preloadUrl(url);
			// Small delay between preloads to prevent overwhelming
			await new Promise(resolve => setTimeout(resolve, 100));
		}
	}

	/**
	 * Cleanup the pool
	 */
	cleanup() {
		console.log('Cleaning up webview pool...');

		// Return all webviews to pool
		while (this.pool.length > 0) {
			const webview = this.pool.pop();
			this.cleanupWebview(webview);
			webview.remove();
		}

		// Clear preload queue
		this.preloadQueue = [];
		this.preloadedUrls.clear();

		// Reset metrics
		this.metrics = {
			poolHits: 0,
			poolMisses: 0,
			preloadsCompleted: 0,
			averageCreationTime: 0,
			totalWebviewsCreated: 0,
		};

		console.log('Webview pool cleaned up');
	}

	/**
	 * Destroy the pool
	 */
	destroy() {
		if (!this.isInitialized) return;

		console.log('Destroying webview pool...');

		this.cleanup();
		this.isInitialized = false;
	}
}
