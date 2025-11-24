/**
 * Prerendering Engine
 *
 * Prerenders pages in background for instant navigation.
 * Phase 2 Implementation - Advanced Performance Optimization
 */

export class Prerenderer {
	constructor() {
		this.prerenderCache = new Map();
		this.prerenderQueue = [];
		this.maxCacheSize = 10; // Maximum prerendered pages to cache
		this.isPrerendering = false;

		// Performance metrics
		this.metrics = {
			prerendersCompleted: 0,
			cacheHits: 0,
			cacheMisses: 0,
			averagePrerenderTime: 0,
			totalPrerenders: 0,
		};
	}

	/**
	 * Initialize the prerenderer
	 */
	async initialize() {
		console.log('Initializing prerendering engine...');

		// Start processing prerender queue
		this.processPrerenderQueue();

		console.log('Prerendering engine initialized');
	}

	/**
	 * Prerender a URL
	 */
	async prerenderUrl(url) {
		if (this.prerenderCache.has(url)) {
			console.log('URL already prerendered:', url);
			return this.prerenderCache.get(url);
		}

		// Add to queue
		this.prerenderQueue.push(url);
		this.processPrerenderQueue();
	}

	/**
	 * Process the prerender queue
	 */
	async processPrerenderQueue() {
		if (this.isPrerendering || this.prerenderQueue.length === 0) return;

		this.isPrerendering = true;
		const url = this.prerenderQueue.shift();

		try {
			const startTime = performance.now();
			console.log('Prerendering URL:', url);

			// Create hidden webview for prerendering
			const webview = await this.createPrerenderWebview();

			// Navigate to URL
			await this.navigateToUrl(webview, url);

			// Wait for page to fully load
			await this.waitForPageLoad(webview);

			// Capture the rendered content
			const content = await this.capturePageContent(webview);

			// Store in cache
			this.prerenderCache.set(url, {
				content,
				timestamp: Date.now(),
				url,
				loadTime: performance.now() - startTime,
			});

			// Update metrics
			this.updatePrerenderMetrics(performance.now() - startTime);

			console.log('Prerender completed for:', url);
		} catch (error) {
			console.error('Error prerendering URL:', url, error);
		} finally {
			this.isPrerendering = false;

			// Process next in queue
			setTimeout(() => this.processPrerenderQueue(), 100);
		}
	}

	/**
	 * Create a webview for prerendering
	 */
	async createPrerenderWebview() {
		return new Promise(resolve => {
			const webview = document.createElement('webview');
			webview.style.display = 'none';
			webview.style.position = 'absolute';
			webview.style.left = '-9999px';
			webview.style.top = '-9999px';
			webview.style.width = '1024px';
			webview.style.height = '768px';

			document.body.appendChild(webview);

			webview.addEventListener(
				'dom-ready',
				() => {
					resolve(webview);
				},
				{ once: true }
			);
		});
	}

	/**
	 * Navigate to URL in webview
	 */
	async navigateToUrl(webview, url) {
		return new Promise(resolve => {
			const handleLoad = () => {
				webview.removeEventListener('did-stop-loading', handleLoad);
				resolve();
			};

			webview.addEventListener('did-stop-loading', handleLoad, { once: true });
			webview.src = url;
		});
	}

	/**
	 * Wait for page to load
	 */
	async waitForPageLoad(webview) {
		return new Promise(resolve => {
			const timeout = setTimeout(() => {
				console.warn('Page load timeout for:', webview.src);
				resolve();
			}, 10000); // 10 second timeout

			const handleLoad = () => {
				clearTimeout(timeout);
				resolve();
			};

			webview.addEventListener('did-stop-loading', handleLoad, { once: true });
		});
	}

	/**
	 * Capture page content
	 */
	async capturePageContent(webview) {
		try {
			// Execute JavaScript in webview to capture content
			const content = await webview.executeJavaScript(`
                // Capture the entire page content
                const pageContent = {
                    html: document.documentElement.outerHTML,
                    title: document.title,
                    url: window.location.href,
                    timestamp: Date.now(),
                    
                    // Capture important meta tags
                    metaTags: Array.from(document.querySelectorAll('meta')).map(tag => ({
                        name: tag.name || tag.property,
                        content: tag.content
                    })),
                    
                    // Capture important links
                    links: Array.from(document.querySelectorAll('a')).map(link => ({
                        href: link.href,
                        text: link.textContent.trim(),
                        title: link.title
                    })),
                    
                    // Capture images
                    images: Array.from(document.querySelectorAll('img')).map(img => ({
                        src: img.src,
                        alt: img.alt,
                        width: img.width,
                        height: img.height
                    }))
                };
                
                pageContent;
            `);

			return content;
		} catch (error) {
			console.error('Error capturing page content:', error);
			return null;
		}
	}

	/**
	 * Get prerendered content for a URL
	 */
	getPrerenderedContent(url) {
		const cached = this.prerenderCache.get(url);
		if (!cached) return null;

		// Check if cache is still valid (5 minutes)
		const maxAge = 5 * 60 * 1000; // 5 minutes
		if (Date.now() - cached.timestamp > maxAge) {
			this.prerenderCache.delete(url);
			return null;
		}

		this.metrics.cacheHits++;
		console.log('Using prerendered content for:', url);
		return cached;
	}

	/**
	 * Apply prerendered content to a webview
	 */
	async applyPrerenderedContent(webview, url) {
		const prerendered = this.getPrerenderedContent(url);
		if (!prerendered) return false;

		try {
			console.log('Applying prerendered content to webview');

			// Apply the captured content
			await webview.executeJavaScript(`
                // Replace page content with prerendered version
                document.documentElement.innerHTML = \`${prerendered.content.html.replace(
									/\\/g,
									'\\\\'
								)}\`;
                
                // Restore title
                document.title = \`${prerendered.content.title.replace(
									/'/g,
									"\\'"
								)}\`;
                
                // Update URL without triggering reload
                history.replaceState({}, '', '${prerendered.content.url}');
                
                // Trigger any post-load scripts
                if (window.prerenderComplete) {
                    window.prerenderComplete();
                }
            `);

			return true;
		} catch (error) {
			console.error('Error applying prerendered content:', error);
			return false;
		}
	}

	/**
	 * Update prerender metrics
	 */
	updatePrerenderMetrics(renderTime) {
		this.metrics.prerendersCompleted++;
		this.metrics.totalPrerenders++;

		const totalTime =
			this.metrics.averagePrerenderTime *
				(this.metrics.prerendersCompleted - 1) +
			renderTime;
		this.metrics.averagePrerenderTime =
			totalTime / this.metrics.prerendersCompleted;
	}

	/**
	 * Preload frequently used URLs
	 */
	async preloadFrequentUrls(urls) {
		console.log('Preloading frequently used URLs for prerendering:', urls);

		for (const url of urls) {
			await this.prerenderUrl(url);
			// Small delay between prerenders
			await new Promise(resolve => setTimeout(resolve, 200));
		}
	}

	/**
	 * Get prerenderer statistics
	 */
	getStats() {
		return {
			cacheSize: this.prerenderCache.size,
			maxCacheSize: this.maxCacheSize,
			queueSize: this.prerenderQueue.length,
			isPrerendering: this.isPrerendering,
			metrics: this.metrics,
			efficiency: this.calculateEfficiency(),
		};
	}

	/**
	 * Calculate prerender efficiency
	 */
	calculateEfficiency() {
		const total = this.metrics.cacheHits + this.metrics.cacheMisses;
		if (total === 0) return 0;

		return Math.round((this.metrics.cacheHits / total) * 100);
	}

	/**
	 * Cleanup old prerendered content
	 */
	cleanup() {
		console.log('Cleaning up prerenderer...');

		const now = Date.now();
		const maxAge = 5 * 60 * 1000; // 5 minutes

		// Remove old prerendered content
		for (const [url, cached] of this.prerenderCache.entries()) {
			if (now - cached.timestamp > maxAge) {
				this.prerenderCache.delete(url);
				console.log('Removed expired prerender for:', url);
			}
		}

		// Clear queue
		this.prerenderQueue = [];
		this.isPrerendering = false;

		console.log('Prerenderer cleaned up');
	}

	/**
	 * Clear all prerendered content
	 */
	clearCache() {
		console.log('Clearing prerender cache...');
		this.prerenderCache.clear();
		this.prerenderQueue = [];

		// Reset metrics
		this.metrics = {
			prerendersCompleted: 0,
			cacheHits: 0,
			cacheMisses: 0,
			averagePrerenderTime: 0,
			totalPrerenders: 0,
		};
	}

	/**
	 * Destroy the prerenderer
	 */
	destroy() {
		console.log('Destroying prerenderer...');
		this.clearCache();
	}
}
