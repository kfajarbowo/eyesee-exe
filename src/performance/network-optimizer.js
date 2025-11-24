/**
 * Network Optimization Module
 *
 * Optimizes network requests with batching, deduplication, and priority management.
 * Phase 2 Implementation - Advanced Performance Optimization
 */

export class NetworkOptimizer {
	constructor() {
		this.requestQueue = [];
		this.activeRequests = new Map();
		this.requestCache = new Map();
		this.maxConcurrentRequests = 6;
		this.batchDelay = 50; // 50ms batching delay
		this.maxBatchSize = 10;
		this.isInitialized = false;

		// Performance metrics
		this.metrics = {
			totalRequests: 0,
			batchedRequests: 0,
			deduplicatedRequests: 0,
			averageResponseTime: 0,
			failedRequests: 0,
			networkType: 'unknown',
		};

		// Network monitoring
		this.connectionMonitor = {
			type: 'unknown',
			effectiveType: 'unknown',
			downlink: false,
			rtt: 0,
			saveData: false,
		};
	}

	/**
	 * Initialize network optimizer
	 */
	async initialize() {
		if (this.isInitialized) return;

		console.log('Initializing network optimizer...');

		// Start network monitoring
		this.startNetworkMonitoring();

		// Start request processing
		this.startRequestProcessor();

		// Start connection monitoring
		this.startConnectionMonitoring();

		this.isInitialized = true;
		console.log('Network optimizer initialized');
	}

	/**
	 * Start network monitoring
	 */
	startNetworkMonitoring() {
		// Monitor connection type
		if (navigator.connection) {
			this.updateConnectionInfo(navigator.connection);

			navigator.connection.addEventListener('change', () => {
				this.updateConnectionInfo(navigator.connection);
			});
		}

		// Monitor online/offline status
		window.addEventListener('online', () => {
			console.log('Network connection restored');
			this.processOfflineQueue();
		});

		window.addEventListener('offline', () => {
			console.log('Network connection lost');
		});
	}

	/**
	 * Update connection information
	 */
	updateConnectionInfo(connection) {
		this.connectionMonitor.type = connection.effectiveType || 'unknown';
		this.connectionMonitor.effectiveType =
			connection.effectiveType || 'unknown';
		this.connectionMonitor.downlink = connection.downlink || false;
		this.connectionMonitor.rtt = connection.rtt || 0;
		this.connectionMonitor.saveData = connection.saveData || false;

		console.log('Network connection updated:', this.connectionMonitor);
	}

	/**
	 * Start request processor
	 */
	startRequestProcessor() {
		setInterval(() => {
			this.processBatch();
		}, this.batchDelay);
	}

	/**
	 * Add request to queue
	 */
	addRequest(url, options = {}) {
		const requestId = this.generateRequestId();
		const request = {
			id: requestId,
			url,
			options,
			timestamp: Date.now(),
			priority: options.priority || 'normal',
			retryCount: 0,
		};

		this.requestQueue.push(request);
		this.metrics.totalRequests++;

		console.log('Request added to queue:', url);
	}

	/**
	 * Process batch of requests
	 */
	async processBatch() {
		if (this.requestQueue.length === 0) return;

		const batch = this.requestQueue.splice(0, this.maxBatchSize);
		this.metrics.batchedRequests += batch.length;

		console.log(`Processing batch of ${batch.length} requests`);

		const promises = batch.map(request => this.processRequest(request));

		try {
			await Promise.allSettled(promises);
		} catch (error) {
			console.error('Batch processing error:', error);
		}
	}

	/**
	 * Process individual request
	 */
	async processRequest(request) {
		// Check cache first
		const cacheKey = this.generateCacheKey(request.url, request.options);
		if (this.requestCache.has(cacheKey)) {
			this.metrics.totalRequests--;
			this.metrics.averageResponseTime = this.calculateAverageResponseTime(0);
			console.log('Request served from cache:', request.url);
			return this.requestCache.get(cacheKey);
		}

		// Check for duplicate requests
		if (this.isDuplicateRequest(request)) {
			this.metrics.deduplicatedRequests++;
			console.log('Duplicate request detected:', request.url);
			return null;
		}

		// Add to active requests
		this.activeRequests.set(request.id, request);

		try {
			const startTime = performance.now();

			// Create fetch with timeout and retry logic
			const response = await this.fetchWithRetry(request);

			const endTime = performance.now();
			const responseTime = endTime - startTime;

			// Cache successful responses
			if (response.ok && this.shouldCacheResponse(request, response)) {
				this.cacheResponse(cacheKey, response);
			}

			// Update metrics
			this.updateRequestMetrics(request, responseTime, response.ok);

			return response;
		} catch (error) {
			console.error('Request failed:', request.url, error);
			this.metrics.failedRequests++;
			this.updateRequestMetrics(request, 0, false);
			throw error;
		} finally {
			// Remove from active requests
			this.activeRequests.delete(request.id);
		}
	}

	/**
	 * Fetch with retry logic
	 */
	async fetchWithRetry(request) {
		const maxRetries = 3;
		const retryDelay = 1000; // 1 second

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

				const response = await fetch(request.url, {
					...request.options,
					signal: controller.signal,
					headers: {
						...request.options.headers,
						'X-Request-ID': request.id,
						'X-Retry-Attempt': attempt.toString(),
					},
				});

				clearTimeout(timeoutId);

				if (response.ok) {
					return response;
				}

				throw new Error(`Request failed with status: ${response.status}`);
			} catch (error) {
				if (attempt === maxRetries) {
					throw error;
				}

				console.warn(`Request attempt ${attempt} failed, retrying...`);
				await new Promise(resolve => setTimeout(resolve, retryDelay));
			}
		}
	}

	/**
	 * Check if request is duplicate
	 */
	isDuplicateRequest(request) {
		for (const activeRequest of this.activeRequests.values()) {
			if (
				activeRequest.url === request.url &&
				JSON.stringify(activeRequest.options) ===
					JSON.stringify(request.options)
			) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Generate request ID
	 */
	generateRequestId() {
		return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Generate cache key
	 */
	generateCacheKey(url, options) {
		return `${url}_${JSON.stringify(options)}`;
	}

	/**
	 * Check if response should be cached
	 */
	shouldCacheResponse(request, response) {
		// Don't cache error responses
		if (!response.ok) return false;

		// Don't cache large responses (>1MB)
		const contentLength = response.headers.get('content-length');
		if (contentLength && parseInt(contentLength) > 1024 * 1024) return false;

		// Respect cache-control headers
		const cacheControl = response.headers.get('cache-control');
		if (cacheControl && cacheControl.includes('no-cache')) return false;

		// Cache successful GET requests by default
		return request.options.method === 'GET' || request.options.cache !== false;
	}

	/**
	 * Cache response
	 */
	async cacheResponse(key, response) {
		const cacheEntry = {
			response: await response.clone(),
			timestamp: Date.now(),
			headers: response.headers,
		};

		this.requestCache.set(key, cacheEntry);
		console.log('Response cached for:', key);
	}

	/**
	 * Update request metrics
	 */
	updateRequestMetrics(request, responseTime, success) {
		request.retryCount++;

		// Update average response time
		const totalTime =
			this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) +
			responseTime;
		this.metrics.averageResponseTime = totalTime / this.metrics.totalRequests;

		if (!success) {
			this.metrics.failedRequests++;
		}

		console.log(
			`Request completed: ${request.url}, Time: ${responseTime}ms, Success: ${success}`
		);
	}

	/**
	 * Calculate average response time
	 */
	calculateAverageResponseTime(newTime) {
		const totalTime =
			this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) +
			newTime;
		return totalTime / this.metrics.totalRequests;
	}

	/**
	 * Process offline queue
	 */
	processOfflineQueue() {
		// Process requests that were queued while offline
		console.log('Processing offline queue...');

		while (this.requestQueue.length > 0 && navigator.onLine) {
			const request = this.requestQueue.shift();
			this.processRequest(request);
		}
	}

	/**
	 * Optimize request based on network conditions
	 */
	optimizeRequest(request) {
		const optimizedRequest = { ...request };

		// Adjust based on connection type
		if (this.connectionMonitor.effectiveType === 'slow-2g') {
			// Reduce image quality for slow connections
			if (request.url.match(/\.(jpg|jpeg|png|gif)$/i)) {
				optimizedRequest.headers = {
					...optimizedRequest.headers,
					'X-Image-Quality': 'low',
				};
			}
		}

		// Add compression for slow connections
		if (
			this.connectionMonitor.effectiveType === 'slow-2g' ||
			this.connectionMonitor.saveData
		) {
			optimizedRequest.headers = {
				...optimizedRequest.headers,
				'Accept-Encoding': 'gzip, deflate, br',
			};
		}

		// Adjust timeout based on connection
		if (this.connectionMonitor.rtt > 1000) {
			// High latency
			optimizedRequest.options = {
				...optimizedRequest.options,
				timeout: 15000, // 15 seconds
			};
		}

		return optimizedRequest;
	}

	/**
	 * Get network statistics
	 */
	getStats() {
		return {
			queueSize: this.requestQueue.length,
			activeRequests: this.activeRequests.size,
			cacheSize: this.requestCache.size,
			maxConcurrentRequests: this.maxConcurrentRequests,
			batchSize: this.maxBatchSize,
			batchDelay: this.batchDelay,
			metrics: this.metrics,
			connection: this.connectionMonitor,
		};
	}

	/**
	 * Clear cache
	 */
	clearCache() {
		console.log('Clearing network cache...');
		this.requestCache.clear();
	}

	/**
	 * Preload resources
	 */
	async preloadResources(urls) {
		console.log('Preloading resources:', urls);

		for (const url of urls) {
			this.addRequest(url, {
				priority: 'high',
				cache: true,
			});
		}
	}

	/**
	 * Destroy network optimizer
	 */
	destroy() {
		if (!this.isInitialized) return;

		console.log('Destroying network optimizer...');

		// Clear all queues and caches
		this.requestQueue = [];
		this.activeRequests.clear();
		this.requestCache.clear();

		this.isInitialized = false;
	}
}
