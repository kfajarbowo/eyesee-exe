/**
 * Memory Management Module
 *
 * Handles memory optimization, cleanup, and monitoring for the webview application.
 * Phase 1 implementation focuses on:
 * - Memory usage monitoring
 * - Automatic cleanup when thresholds are exceeded
 * - Webview memory optimization
 */

export class MemoryManager {
	constructor() {
		this.memoryThreshold = 100 * 1024 * 1024; // 100MB threshold
		this.criticalThreshold = 150 * 1024 * 1024; // 150MB critical threshold
		this.cleanupInterval = 30000; // 30 seconds
		this.isInitialized = false;
		this.cleanupTimer = null;
		this.webview = null;
		this.memoryStats = {
			current: 0,
			peak: 0,
			cleanupCount: 0,
			lastCleanup: null,
		};
	}

	/**
	 * Initialize memory management
	 */
	async initialize() {
		if (this.isInitialized) return;

		try {
			// Get reference to webview
			this.webview = document.querySelector('webview');
			if (!this.webview) {
				throw new Error('Webview element not found');
			}

			// Start memory monitoring
			this.startMemoryMonitoring();

			// Setup webview memory optimization
			this.setupWebviewOptimization();

			this.isInitialized = true;
			console.log('Memory manager initialized successfully');
		} catch (error) {
			console.error('Failed to initialize memory manager:', error);
			throw error;
		}
	}

	/**
	 * Start continuous memory monitoring
	 */
	startMemoryMonitoring() {
		this.cleanupTimer = setInterval(() => {
			this.checkMemoryUsage();
		}, this.cleanupInterval);

		// Initial check
		this.checkMemoryUsage();
	}

	/**
	 * Check current memory usage and perform cleanup if needed
	 */
	async checkMemoryUsage() {
		try {
			const memoryInfo = await this.getMemoryInfo();
			this.memoryStats.current = memoryInfo.usedJSHeapSize;

			// Update peak memory usage
			if (this.memoryStats.current > this.memoryStats.peak) {
				this.memoryStats.peak = this.memoryStats.current;
			}

			// Log memory usage
			console.log(
				`Memory usage: ${Math.round(this.memoryStats.current / 1024 / 1024)}MB`
			);

			// Check if cleanup is needed
			if (this.memoryStats.current > this.criticalThreshold) {
				console.warn(
					'Critical memory usage detected, performing emergency cleanup'
				);
				await this.performEmergencyCleanup();
			} else if (this.memoryStats.current > this.memoryThreshold) {
				console.log('Memory usage above threshold, performing cleanup');
				await this.performCleanup();
			}
		} catch (error) {
			console.error('Error checking memory usage:', error);
		}
	}

	/**
	 * Get detailed memory information
	 */
	async getMemoryInfo() {
		if (!this.webview) {
			return process.memoryUsage();
		}

		try {
			// Get webview memory metrics
			const webContents = this.webview.getWebContents();
			const webviewMetrics = await webContents.getPerformanceMetrics();

			// Get process memory metrics
			const processMetrics = process.memoryUsage();

			return {
				...processMetrics,
				webviewMetrics,
				usedJSHeapSize:
					webviewMetrics.JSHeapUsedSize || processMetrics.heapUsed,
				totalJSHeapSize:
					webviewMetrics.JSHeapTotalSize || processMetrics.heapTotal,
			};
		} catch (error) {
			console.error('Error getting memory info:', error);
			return process.memoryUsage();
		}
	}

	/**
	 * Perform standard memory cleanup
	 */
	async performCleanup() {
		try {
			console.log('Performing memory cleanup...');

			// Force garbage collection in webview
			await this.forceGarbageCollection();

			// Clear unused caches
			await this.clearCaches();

			// Optimize webview memory
			await this.optimizeWebviewMemory();

			// Update cleanup stats
			this.memoryStats.cleanupCount++;
			this.memoryStats.lastCleanup = Date.now();

			console.log('Memory cleanup completed');
		} catch (error) {
			console.error('Error during memory cleanup:', error);
		}
	}

	/**
	 * Perform emergency cleanup for critical memory situations
	 */
	async performEmergencyCleanup() {
		try {
			console.warn('Performing emergency memory cleanup...');

			// Force aggressive garbage collection
			await this.forceGarbageCollection(true);

			// Clear all caches
			await this.clearAllCaches();

			// Reload webview if memory is still critical
			const memoryInfo = await this.getMemoryInfo();
			if (memoryInfo.usedJSHeapSize > this.criticalThreshold) {
				console.warn('Memory still critical after cleanup, reloading webview');
				await this.reloadWebview();
			}

			// Update cleanup stats
			this.memoryStats.cleanupCount++;
			this.memoryStats.lastCleanup = Date.now();

			console.log('Emergency memory cleanup completed');
		} catch (error) {
			console.error('Error during emergency cleanup:', error);
		}
	}

	/**
	 * Force garbage collection in webview
	 */
	async forceGarbageCollection(aggressive = false) {
		if (!this.webview) return;

		try {
			await this.webview.executeJavaScript(`
                // Force garbage collection if available
                if (window.gc) {
                    window.gc();
                    ${aggressive ? 'window.gc(); window.gc();' : ''}
                }
                
                // Clear unused variables and references
                if (window.performance && window.performance.memory) {
                    // Trigger memory cleanup
                    const unused = [];
                    for (let i = 0; i < 100; i++) {
                        unused.push(new Array(1000).fill(0));
                    }
                    unused.length = 0;
                }
            `);
		} catch (error) {
			console.error('Error forcing garbage collection:', error);
		}
	}

	/**
	 * Clear various caches
	 */
	async clearCaches() {
		if (!this.webview) return;

		try {
			await this.webview.executeJavaScript(`
                // Clear application caches
                if (window.caches) {
                    caches.keys().then(cacheNames => {
                        return Promise.all(
                            cacheNames.map(cacheName => caches.delete(cacheName))
                        );
                    });
                }
                
                // Clear session storage
                if (window.sessionStorage) {
                    sessionStorage.clear();
                }
                
                // Clear large objects from memory
                if (window.largeDataCache) {
                    window.largeDataCache.clear();
                }
            `);
		} catch (error) {
			console.error('Error clearing caches:', error);
		}
	}

	/**
	 * Clear all caches aggressively
	 */
	async clearAllCaches() {
		if (!this.webview) return;

		try {
			await this.webview.executeJavaScript(`
                // Clear all storage
                if (window.localStorage) {
                    localStorage.clear();
                }
                
                if (window.sessionStorage) {
                    sessionStorage.clear();
                }
                
                // Clear all caches
                if (window.caches) {
                    caches.keys().then(cacheNames => {
                        return Promise.all(
                            cacheNames.map(cacheName => caches.delete(cacheName))
                        );
                    });
                }
                
                // Clear IndexedDB
                if (window.indexedDB) {
                    indexedDB.databases().then(databases => {
                        databases.forEach(db => {
                            indexedDB.deleteDatabase(db.name);
                        });
                    });
                }
                
                // Clear any global caches
                delete window.largeDataCache;
                delete window.imageCache;
                delete window.resourceCache;
            `);
		} catch (error) {
			console.error('Error clearing all caches:', error);
		}
	}

	/**
	 * Optimize webview memory usage
	 */
	async optimizeWebviewMemory() {
		if (!this.webview) return;

		try {
			await this.webview.executeJavaScript(`
                // Remove unused event listeners
                const elements = document.querySelectorAll('*');
                elements.forEach(el => {
                    if (el._eventListeners && el._eventListeners.length > 10) {
                        // Keep only the most recent listeners
                        el._eventListeners = el._eventListeners.slice(-5);
                    }
                });
                
                // Optimize images
                const images = document.querySelectorAll('img');
                images.forEach(img => {
                    if (!img.visible && img.src) {
                        img.src = '';
                    }
                });
                
                // Remove hidden elements from DOM
                const hiddenElements = document.querySelectorAll('[style*="display: none"], [hidden]');
                hiddenElements.forEach(el => {
                    if (!el.dataset.keepInDOM) {
                        el.remove();
                    }
                });
                
                // Clear console to free memory
                console.clear();
            `);
		} catch (error) {
			console.error('Error optimizing webview memory:', error);
		}
	}

	/**
	 * Reload webview to free memory
	 */
	async reloadWebview() {
		if (!this.webview) return;

		try {
			const currentUrl = this.webview.getURL();
			console.log('Reloading webview to free memory...');

			// Clear webview
			this.webview.src = 'about:blank';

			// Wait a bit then reload
			setTimeout(() => {
				this.webview.src = currentUrl;
			}, 1000);
		} catch (error) {
			console.error('Error reloading webview:', error);
		}
	}

	/**
	 * Setup webview memory optimization
	 */
	setupWebviewOptimization() {
		if (!this.webview) return;

		// Monitor webview memory usage
		this.webview.addEventListener('did-finish-load', () => {
			this.optimizeWebviewMemory();
		});

		// Cleanup on page unload
		this.webview.addEventListener('will-navigate', () => {
			this.performCleanup();
		});
	}

	/**
	 * Get current memory usage statistics
	 */
	getMemoryUsage() {
		return {
			...this.memoryStats,
			threshold: this.memoryThreshold,
			criticalThreshold: this.criticalThreshold,
			usagePercentage: Math.round(
				(this.memoryStats.current / this.memoryThreshold) * 100
			),
		};
	}

	/**
	 * Force immediate cleanup
	 */
	forceCleanup() {
		return this.performEmergencyCleanup();
	}

	/**
	 * Destroy memory manager and cleanup resources
	 */
	destroy() {
		if (!this.isInitialized) return;

		// Clear cleanup timer
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = null;
		}

		// Final cleanup
		this.performCleanup();

		this.isInitialized = false;
		console.log('Memory manager destroyed');
	}
}
