/**
 * Resource Management Module
 *
 * Manages and optimizes resource loading and usage for webview application.
 * Phase 1 implementation focuses on:
 * - Resource cleanup
 * - Cache management
 * - Resource optimization
 */

export class ResourceManager {
	constructor() {
		this.isInitialized = false;
		this.cleanupInterval = 300000; // 5 minutes
		this.cleanupTimer = null;
		this.webview = null;
		this.resourceStats = {
			cachedItems: 0,
			cacheSize: 0,
			cleanupCount: 0,
			lastCleanup: null,
			optimizedResources: 0,
		};
		this.maxCacheSize = 50 * 1024 * 1024; // 50MB
		this.maxCacheItems = 1000;
	}

	/**
	 * Initialize resource management
	 */
	async initialize() {
		if (this.isInitialized) return;

		try {
			// Get reference to webview
			this.webview = document.querySelector('webview');
			if (!this.webview) {
				throw new Error('Webview element not found');
			}

			// Setup resource optimization
			this.setupResourceOptimization();

			// Start periodic cleanup
			this.startPeriodicCleanup();

			this.isInitialized = true;
			console.log('Resource manager initialized successfully');
		} catch (error) {
			console.error('Failed to initialize resource manager:', error);
			throw error;
		}
	}

	/**
	 * Setup resource optimization for webview
	 */
	setupResourceOptimization() {
		if (!this.webview) return;

		// Optimize resources when page loads
		this.webview.addEventListener('dom-ready', () => {
			this.optimizePageResources();
		});

		// Cleanup resources when navigating away
		this.webview.addEventListener('will-navigate', () => {
			this.cleanupPageResources();
		});

		// Monitor resource usage
		this.webview.addEventListener('did-finish-load', () => {
			this.analyzeResourceUsage();
		});
	}

	/**
	 * Optimize page resources
	 */
	async optimizePageResources() {
		if (!this.webview) return;

		try {
			await this.webview
				.executeJavaScript(
					`
                // Optimize images
                const optimizeImages = () => {
                    const images = document.querySelectorAll('img');
                    let optimizedCount = 0;
                    
                    images.forEach(img => {
                        // Add loading="lazy" to images below the fold
                        if (img.getBoundingClientRect().top > window.innerHeight) {
                            img.loading = 'lazy';
                            optimizedCount++;
                        }
                        
                        // Optimize image attributes
                        if (!img.alt) img.alt = '';
                        if (!img.decoding) img.decoding = 'async';
                        
                        // Add error handling
                        img.onerror = function() {
                            this.style.display = 'none';
                        };
                    });
                    
                    return optimizedCount;
                };

                // Optimize scripts
                const optimizeScripts = () => {
                    const scripts = document.querySelectorAll('script[src]');
                    let optimizedCount = 0;
                    
                    scripts.forEach(script => {
                        // Add defer to non-critical scripts
                        if (!script.hasAttribute('async') && !script.hasAttribute('defer')) {
                            if (!script.textContent.includes('critical')) {
                                script.defer = true;
                                optimizedCount++;
                            }
                        }
                    });
                    
                    return optimizedCount;
                };

                // Optimize stylesheets
                const optimizeStylesheets = () => {
                    const links = document.querySelectorAll('link[rel="stylesheet"]');
                    let optimizedCount = 0;
                    
                    links.forEach(link => {
                        // Add media queries for non-critical styles
                        if (!link.media && link.href.includes('non-critical')) {
                            link.media = 'print';
                            link.onload = function() {
                                this.media = 'all';
                            };
                            optimizedCount++;
                        }
                    });
                    
                    return optimizedCount;
                };

                // Optimize fonts
                const optimizeFonts = () => {
                    const fonts = document.querySelectorAll('link[href*="font"]');
                    let optimizedCount = 0;
                    
                    fonts.forEach(font => {
                        // Add font-display: swap for better loading
                        if (!font.href.includes('display=swap')) {
                            const separator = font.href.includes('?') ? '&' : '?';
                            font.href += separator + 'display=swap';
                            optimizedCount++;
                        }
                    });
                    
                    return optimizedCount;
                };

                // Run optimizations
                const imageOptimizations = optimizeImages();
                const scriptOptimizations = optimizeScripts();
                const styleOptimizations = optimizeStylesheets();
                const fontOptimizations = optimizeFonts();
                
                // Return optimization count
                return {
                    images: imageOptimizations,
                    scripts: scriptOptimizations,
                    styles: styleOptimizations,
                    fonts: fontOptimizations,
                    total: imageOptimizations + scriptOptimizations + styleOptimizations + fontOptimizations
                };
            `
				)
				.then(results => {
					this.resourceStats.optimizedResources += results.total;
					console.log('Resource optimizations:', results);
				});
		} catch (error) {
			console.error('Error optimizing page resources:', error);
		}
	}

	/**
	 * Cleanup page resources
	 */
	async cleanupPageResources() {
		if (!this.webview) return;

		try {
			await this.webview
				.executeJavaScript(
					`
                // Cleanup unused event listeners
                const cleanupEventListeners = () => {
                    const elements = document.querySelectorAll('*');
                    let cleanupCount = 0;
                    
                    elements.forEach(el => {
                        // Remove event listeners from hidden elements
                        if (el.offsetParent === null) {
                            const events = el._eventListeners;
                            if (events && events.length > 0) {
                                el._eventListeners = [];
                                cleanupCount++;
                            }
                        }
                    });
                    
                    return cleanupCount;
                };

                // Cleanup temporary elements
                const cleanupTemporaryElements = () => {
                    const tempElements = document.querySelectorAll('[data-temp], .temp, .temporary');
                    let cleanupCount = 0;
                    
                    tempElements.forEach(el => {
                        el.remove();
                        cleanupCount++;
                    });
                    
                    return cleanupCount;
                };

                // Cleanup large data objects
                const cleanupLargeObjects = () => {
                    let cleanupCount = 0;
                    
                    // Clear large arrays
                    if (window.largeDataArrays) {
                        window.largeDataArrays.forEach(arr => arr.length = 0);
                        window.largeDataArrays = [];
                        cleanupCount++;
                    }
                    
                    // Clear large objects
                    if (window.largeDataObjects) {
                        Object.keys(window.largeDataObjects).forEach(key => {
                            delete window.largeDataObjects[key];
                        });
                        cleanupCount++;
                    }
                    
                    return cleanupCount;
                };

                // Run cleanup
                const listenerCleanup = cleanupEventListeners();
                const elementCleanup = cleanupTemporaryElements();
                const objectCleanup = cleanupLargeObjects();
                
                return {
                    listeners: listenerCleanup,
                    elements: elementCleanup,
                    objects: objectCleanup,
                    total: listenerCleanup + elementCleanup + objectCleanup
                };
            `
				)
				.then(results => {
					console.log('Resource cleanup results:', results);
				});
		} catch (error) {
			console.error('Error cleaning up page resources:', error);
		}
	}

	/**
	 * Analyze resource usage
	 */
	async analyzeResourceUsage() {
		if (!this.webview) return;

		try {
			const analysis = await this.webview.executeJavaScript(`
                // Analyze resource usage
                const analyzeResources = () => {
                    const resources = performance.getEntriesByType('resource');
                    const analysis = {
                        totalResources: resources.length,
                        totalSize: 0,
                        slowResources: [],
                        largeResources: [],
                        resourceTypes: {}
                    };
                    
                    resources.forEach(resource => {
                        // Count by type
                        const type = resource.initiatorType || 'other';
                        analysis.resourceTypes[type] = (analysis.resourceTypes[type] || 0) + 1;
                        
                        // Calculate size
                        if (resource.transferSize) {
                            analysis.totalSize += resource.transferSize;
                            
                            // Track large resources (>1MB)
                            if (resource.transferSize > 1024 * 1024) {
                                analysis.largeResources.push({
                                    name: resource.name,
                                    size: resource.transferSize,
                                    type: type
                                });
                            }
                        }
                        
                        // Track slow resources (>2 seconds)
                        if (resource.duration > 2000) {
                            analysis.slowResources.push({
                                name: resource.name,
                                duration: resource.duration,
                                type: type
                            });
                        }
                    });
                    
                    return analysis;
                };
                
                // Analyze DOM usage
                const analyzeDOM = () => {
                    const elements = document.querySelectorAll('*');
                    const analysis = {
                        totalElements: elements.length,
                        elementsByTag: {},
                        deepDOM: false,
                        memoryUsage: 0
                    };
                    
                    elements.forEach(el => {
                        const tag = el.tagName.toLowerCase();
                        analysis.elementsByTag[tag] = (analysis.elementsByTag[tag] || 0) + 1;
                        
                        // Check for deeply nested DOM
                        let depth = 0;
                        let parent = el;
                        while (parent) {
                            depth++;
                            parent = parent.parentElement;
                            if (depth > 50) {
                                analysis.deepDOM = true;
                                break;
                            }
                        }
                    });
                    
                    // Estimate memory usage
                    if (performance.memory) {
                        analysis.memoryUsage = performance.memory.usedJSHeapSize;
                    }
                    
                    return analysis;
                };
                
                return {
                    resources: analyzeResources(),
                    dom: analyzeDOM()
                };
            `);

			console.log('Resource usage analysis:', analysis);

			// Report issues if found
			if (analysis.resources.slowResources.length > 0) {
				console.warn(
					'Slow resources detected:',
					analysis.resources.slowResources
				);
			}

			if (analysis.resources.largeResources.length > 0) {
				console.warn(
					'Large resources detected:',
					analysis.resources.largeResources
				);
			}

			if (analysis.dom.deepDOM) {
				console.warn('Deep DOM structure detected, consider optimizing');
			}
		} catch (error) {
			console.error('Error analyzing resource usage:', error);
		}
	}

	/**
	 * Start periodic cleanup
	 */
	startPeriodicCleanup() {
		this.cleanupTimer = setInterval(() => {
			this.performCleanup();
		}, this.cleanupInterval);
	}

	/**
	 * Perform resource cleanup
	 */
	async performCleanup() {
		try {
			console.log('Performing resource cleanup...');

			// Cleanup caches
			await this.cleanupCaches();

			// Cleanup storage
			await this.cleanupStorage();

			// Update stats
			this.resourceStats.cleanupCount++;
			this.resourceStats.lastCleanup = Date.now();

			console.log('Resource cleanup completed');
		} catch (error) {
			console.error('Error during resource cleanup:', error);
		}
	}

	/**
	 * Cleanup caches
	 */
	async cleanupCaches() {
		if (!this.webview) return;

		try {
			await this.webview
				.executeJavaScript(
					`
                // Cleanup application caches
                const cleanupCaches = async () => {
                    if ('caches' in window) {
                        const cacheNames = await caches.keys();
                        let deletedCount = 0;
                        
                        for (const cacheName of cacheNames) {
                            // Skip essential caches
                            if (cacheName.includes('essential') || cacheName.includes('critical')) {
                                continue;
                            }
                            
                            const cache = await caches.open(cacheName);
                            const requests = await cache.keys();
                            
                            // Delete old entries (older than 1 day)
                            const now = Date.now();
                            const oneDay = 24 * 60 * 60 * 1000;
                            
                            for (const request of requests) {
                                const response = await cache.match(request);
                                if (response) {
                                    const date = response.headers.get('date');
                                    if (date && (now - new Date(date).getTime()) > oneDay) {
                                        await cache.delete(request);
                                        deletedCount++;
                                    }
                                }
                            }
                            
                            // Delete empty caches
                            const remainingRequests = await cache.keys();
                            if (remainingRequests.length === 0) {
                                await caches.delete(cacheName);
                                deletedCount++;
                            }
                        }
                        
                        return deletedCount;
                    }
                    return 0;
                };
                
                return await cleanupCaches();
            `
				)
				.then(deletedCount => {
					console.log(`Cleaned ${deletedCount} cache entries`);
				});
		} catch (error) {
			console.error('Error cleaning up caches:', error);
		}
	}

	/**
	 * Cleanup storage
	 */
	async cleanupStorage() {
		if (!this.webview) return;

		try {
			await this.webview
				.executeJavaScript(
					`
                // Cleanup localStorage
                const cleanupLocalStorage = () => {
                    let deletedCount = 0;
                    const now = Date.now();
                    const oneDay = 24 * 60 * 60 * 1000;
                    
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        const value = localStorage.getItem(key);
                        
                        try {
                            const data = JSON.parse(value);
                            if (data.timestamp && (now - data.timestamp > oneDay)) {
                                localStorage.removeItem(key);
                                deletedCount++;
                            }
                        } catch (e) {
                            // Skip non-JSON values
                        }
                    }
                    
                    return deletedCount;
                };
                
                // Cleanup sessionStorage
                const cleanupSessionStorage = () => {
                    let deletedCount = 0;
                    
                    for (let i = 0; i < sessionStorage.length; i++) {
                        const key = sessionStorage.key(i);
                        if (key.includes('temp') || key.includes('cache')) {
                            sessionStorage.removeItem(key);
                            deletedCount++;
                        }
                    }
                    
                    return deletedCount;
                };
                
                const localStorageCleanup = cleanupLocalStorage();
                const sessionStorageCleanup = cleanupSessionStorage();
                
                return {
                    localStorage: localStorageCleanup,
                    sessionStorage: sessionStorageCleanup,
                    total: localStorageCleanup + sessionStorageCleanup
                };
            `
				)
				.then(results => {
					console.log('Storage cleanup results:', results);
				});
		} catch (error) {
			console.error('Error cleaning up storage:', error);
		}
	}

	/**
	 * Force immediate cleanup
	 */
	forceCleanup() {
		return this.performCleanup();
	}

	/**
	 * Get resource statistics
	 */
	getResourceStats() {
		return {
			...this.resourceStats,
			maxCacheSize: this.maxCacheSize,
			maxCacheItems: this.maxCacheItems,
		};
	}

	/**
	 * Destroy resource manager
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
		console.log('Resource manager destroyed');
	}
}
