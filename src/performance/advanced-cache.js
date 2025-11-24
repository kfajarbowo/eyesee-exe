/**
 * Advanced Caching System
 *
 * Multi-layer caching with intelligent invalidation and compression.
 * Phase 2 Implementation - Advanced Performance Optimization
 */

export class AdvancedCache {
	constructor() {
		// Multi-layer cache system
		this.memoryCache = new Map(); // L1: Fastest access
		this.sessionCache = new Map(); // L2: Session persistence
		this.persistentCache = new Map(); // L3: Persistent storage

		// Cache configuration
		this.config = {
			maxMemorySize: 50 * 1024 * 1024, // 50MB
			maxSessionSize: 100 * 1024 * 1024, // 100MB
			maxPersistentSize: 200 * 1024 * 1024, // 200MB
			compressionThreshold: 1024 * 1024, // 1MB
			defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
			maxEntries: 1000,
		};

		// Performance metrics
		this.metrics = {
			hits: { l1: 0, l2: 0, l3: 0 },
			misses: { l1: 0, l2: 0, l3: 0 },
			evictions: { l1: 0, l2: 0, l3: 0 },
			compressionRatio: 0,
			totalRequests: 0,
			averageAccessTime: 0,
		};

		this.isInitialized = false;
	}

	/**
	 * Initialize the advanced cache system
	 */
	async initialize() {
		if (this.isInitialized) return;

		console.log('Initializing advanced cache system...');

		// Load persistent cache from storage
		await this.loadPersistentCache();

		// Start cleanup interval
		this.startCleanupInterval();

		this.isInitialized = true;
		console.log('Advanced cache system initialized');
	}

	/**
	 * Get data from cache (multi-layer)
	 */
	async get(key) {
		const startTime = performance.now();

		try {
			// L1: Memory cache
			if (this.memoryCache.has(key)) {
				this.metrics.hits.l1++;
				return this.memoryCache.get(key);
			}

			// L2: Session cache
			if (this.sessionCache.has(key)) {
				const data = this.sessionCache.get(key);
				// Promote to L1
				this.memoryCache.set(key, data);
				this.metrics.hits.l2++;
				return data;
			}

			// L3: Persistent cache
			if (this.persistentCache.has(key)) {
				const data = this.persistentCache.get(key);
				// Promote to L1 and L2
				this.memoryCache.set(key, data);
				this.sessionCache.set(key, data);
				this.metrics.hits.l3++;
				return data;
			}

			// Cache miss
			this.metrics.misses.l1++;
			this.metrics.totalRequests++;

			const accessTime = performance.now() - startTime;
			this.updateAverageAccessTime(accessTime);

			return null;
		} catch (error) {
			console.error('Error getting from cache:', error);
			return null;
		}
	}

	/**
	 * Set data in cache (multi-layer)
	 */
	async set(key, data, options = {}) {
		const {
			ttl = this.config.defaultTTL,
			compress = true,
			priority = 'normal', // high, normal, low
		} = options;

		try {
			const now = Date.now();
			const expiresAt = now + ttl;

			// Prepare cache entry
			let cacheData = data;
			let compressed = false;

			// Compress data if enabled and large enough
			if (compress && this.shouldCompress(data)) {
				cacheData = await this.compressData(data);
				compressed = true;
			}

			const cacheEntry = {
				data: cacheData,
				compressed,
				timestamp: now,
				expiresAt,
				accessCount: 0,
				size: this.getDataSize(cacheData),
			};

			// Store in all layers based on priority
			if (priority === 'high') {
				// High priority: store in all layers
				this.memoryCache.set(key, cacheEntry);
				this.sessionCache.set(key, cacheEntry);
				await this.setPersistentCache(key, cacheEntry);
			} else if (priority === 'normal') {
				// Normal priority: L1 and L2
				this.memoryCache.set(key, cacheEntry);
				this.sessionCache.set(key, cacheEntry);
			} else {
				// Low priority: L1 only
				this.memoryCache.set(key, cacheEntry);
			}

			console.log(
				`Cached data for key: ${key} (compressed: ${compressed}, priority: ${priority})`
			);
		} catch (error) {
			console.error('Error setting cache:', error);
		}
	}

	/**
	 * Check if data should be compressed
	 */
	shouldCompress(data) {
		if (typeof data !== 'string') return false;

		// Compress if larger than threshold
		return data.length > this.config.compressionThreshold;
	}

	/**
	 * Compress data using simple compression
	 */
	async compressData(data) {
		try {
			// Simple compression: replace repeated patterns
			let compressed = data;

			// Replace common patterns
			const patterns = [
				{ pattern: / {/g, replacement: '{' },
				{ pattern: /"/g, replacement: '"' },
				{ pattern: /\\s+/g, replacement: ' ' },
				{ pattern: /\\t+/g, replacement: '\\t' },
			];

			for (const { pattern, replacement } of patterns) {
				compressed = compressed.replace(pattern, replacement);
			}

			// Calculate compression ratio
			const originalSize = this.getDataSize(data);
			const compressedSize = this.getDataSize(compressed);
			const compressionRatio = 1 - compressedSize / originalSize;

			this.metrics.compressionRatio =
				(this.metrics.compressionRatio + compressionRatio) / 2;

			return compressed;
		} catch (error) {
			console.error('Error compressing data:', error);
			return data;
		}
	}

	/**
	 * Get data size
	 */
	getDataSize(data) {
		if (typeof data === 'string') {
			return new Blob([data]).size;
		} else if (data && typeof data === 'object') {
			return new Blob([JSON.stringify(data)]).size;
		}
		return 0;
	}

	/**
	 * Invalidate cache entries
	 */
	async invalidate(pattern) {
		console.log('Invalidating cache with pattern:', pattern);

		const regex = new RegExp(pattern);
		let invalidatedCount = 0;

		// Invalidate from all layers
		for (const [key, entry] of this.memoryCache.entries()) {
			if (regex.test(key)) {
				this.memoryCache.delete(key);
				invalidatedCount++;
			}
		}

		for (const [key, entry] of this.sessionCache.entries()) {
			if (regex.test(key)) {
				this.sessionCache.delete(key);
				invalidatedCount++;
			}
		}

		for (const [key, entry] of this.persistentCache.entries()) {
			if (regex.test(key)) {
				this.persistentCache.delete(key);
				invalidatedCount++;
			}
		}

		// Update persistent cache
		await this.savePersistentCache();

		console.log(`Invalidated ${invalidatedCount} cache entries`);
	}

	/**
	 * Load persistent cache from storage
	 */
	async loadPersistentCache() {
		try {
			const stored = localStorage.getItem('advanced-cache-persistent');
			if (stored) {
				const data = JSON.parse(stored);
				const now = Date.now();

				// Filter expired entries
				for (const [key, entry] of Object.entries(data)) {
					if (entry.expiresAt < now) {
						delete data[key];
					} else {
						this.persistentCache.set(key, entry);
					}
				}

				console.log(
					`Loaded ${this.persistentCache.size} entries from persistent cache`
				);
			}
		} catch (error) {
			console.error('Error loading persistent cache:', error);
		}
	}

	/**
	 * Save persistent cache to storage
	 */
	async savePersistentCache() {
		try {
			const data = {};
			for (const [key, entry] of this.persistentCache.entries()) {
				data[key] = entry;
			}

			localStorage.setItem('advanced-cache-persistent', JSON.stringify(data));
			console.log(
				`Saved ${this.persistentCache.size} entries to persistent cache`
			);
		} catch (error) {
			console.error('Error saving persistent cache:', error);
		}
	}

	/**
	 * Start cleanup interval
	 */
	startCleanupInterval() {
		// Cleanup every 5 minutes
		setInterval(() => {
			this.cleanup();
		}, 5 * 60 * 1000);
	}

	/**
	 * Cleanup expired entries
	 */
	cleanup() {
		const now = Date.now();
		let cleanedCount = 0;

		// Cleanup memory cache
		for (const [key, entry] of this.memoryCache.entries()) {
			if (entry.expiresAt < now) {
				this.memoryCache.delete(key);
				this.metrics.evictions.l1++;
				cleanedCount++;
			}
		}

		// Cleanup session cache
		for (const [key, entry] of this.sessionCache.entries()) {
			if (entry.expiresAt < now) {
				this.sessionCache.delete(key);
				this.metrics.evictions.l2++;
				cleanedCount++;
			}
		}

		// Cleanup persistent cache
		let persistentCleaned = 0;
		for (const [key, entry] of this.persistentCache.entries()) {
			if (entry.expiresAt < now) {
				this.persistentCache.delete(key);
				this.metrics.evictions.l3++;
				persistentCleaned++;
			}
		}

		// Save persistent cache if cleaned
		if (persistentCleaned > 0) {
			this.savePersistentCache();
		}

		// Enforce size limits
		this.enforceSizeLimits();

		console.log(`Cache cleanup: ${cleanedCount} entries removed`);
	}

	/**
	 * Enforce cache size limits
	 */
	enforceSizeLimits() {
		// Memory cache LRU eviction
		if (this.memoryCache.size > this.config.maxEntries) {
			const entries = Array.from(this.memoryCache.entries());
			entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

			// Remove oldest entries
			const toRemove = entries.slice(this.config.maxEntries);
			for (const [key] of toRemove) {
				this.memoryCache.delete(key);
				this.metrics.evictions.l1++;
			}
		}

		// Session cache LRU eviction
		if (this.sessionCache.size > this.config.maxEntries / 2) {
			const entries = Array.from(this.sessionCache.entries());
			entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

			// Remove oldest entries
			const toRemove = entries.slice(this.config.maxEntries / 2);
			for (const [key] of toRemove) {
				this.sessionCache.delete(key);
				this.metrics.evictions.l2++;
			}
		}
	}

	/**
	 * Update average access time
	 */
	updateAverageAccessTime(accessTime) {
		const totalTime =
			this.metrics.averageAccessTime * (this.metrics.totalRequests - 1) +
			accessTime;
		this.metrics.averageAccessTime = totalTime / this.metrics.totalRequests;
	}

	/**
	 * Get cache statistics
	 */
	getStats() {
		const totalHits =
			this.metrics.hits.l1 + this.metrics.hits.l2 + this.metrics.hits.l3;
		const totalMisses =
			this.metrics.misses.l1 + this.metrics.misses.l2 + this.metrics.misses.l3;
		const totalRequests = totalHits + totalMisses;

		return {
			layers: {
				l1: {
					size: this.memoryCache.size,
					maxSize: this.config.maxMemorySize,
					hits: this.metrics.hits.l1,
					misses: this.metrics.misses.l1,
				},
				l2: {
					size: this.sessionCache.size,
					maxSize: this.config.maxSessionSize,
					hits: this.metrics.hits.l2,
					misses: this.metrics.misses.l2,
				},
				l3: {
					size: this.persistentCache.size,
					maxSize: this.config.maxPersistentSize,
					hits: this.metrics.hits.l3,
					misses: this.metrics.misses.l3,
				},
			},
			metrics: this.metrics,
			efficiency:
				totalRequests > 0 ? Math.round((totalHits / totalRequests) * 100) : 0,
			compressionRatio: this.metrics.compressionRatio,
			totalRequests,
		};
	}

	/**
	 * Clear all caches
	 */
	clear() {
		console.log('Clearing all caches...');

		this.memoryCache.clear();
		this.sessionCache.clear();
		this.persistentCache.clear();

		// Clear persistent storage
		localStorage.removeItem('advanced-cache-persistent');

		// Reset metrics
		this.metrics = {
			hits: { l1: 0, l2: 0, l3: 0 },
			misses: { l1: 0, l2: 0, l3: 0 },
			evictions: { l1: 0, l2: 0, l3: 0 },
			compressionRatio: 0,
			totalRequests: 0,
			averageAccessTime: 0,
		};

		console.log('All caches cleared');
	}

	/**
	 * Destroy the cache system
	 */
	destroy() {
		if (!this.isInitialized) return;

		console.log('Destroying advanced cache system...');

		this.clear();
		this.isInitialized = false;
	}
}
