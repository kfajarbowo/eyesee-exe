/**
 * Performance Monitoring Module
 *
 * Monitors and tracks various performance metrics for the webview application.
 * Phase 1 implementation focuses on:
 * - Core Web Vitals monitoring (FCP, LCP, FID, CLS)
 * - Memory usage tracking
 * - Navigation timing
 * - Basic performance scoring
 */

export class PerformanceMonitor {
	constructor() {
		this.isInitialized = false;
		this.observers = [];
		this.metrics = {
			// Core Web Vitals
			fcp: 0, // First Contentful Paint
			lcp: 0, // Largest Contentful Paint
			fid: 0, // First Input Delay
			cls: 0, // Cumulative Layout Shift

			// Navigation metrics
			ttfb: 0, // Time to First Byte
			domContentLoaded: 0,
			loadComplete: 0,

			// Resource metrics
			resourceCount: 0,
			resourceSize: 0,

			// Memory metrics
			memoryUsage: 0,
			memoryPeak: 0,

			// Custom metrics
			navigationCount: 0,
			errorCount: 0,

			// Timing
			sessionStart: Date.now(),
			lastNavigation: null,
		};

		this.thresholds = {
			fcp: { good: 1800, poor: 3000 },
			lcp: { good: 2500, poor: 4000 },
			fid: { good: 100, poor: 300 },
			cls: { good: 0.1, poor: 0.25 },
			ttfb: { good: 800, poor: 1800 },
		};
	}

	/**
	 * Initialize performance monitoring
	 */
	async initialize() {
		if (this.isInitialized) return;

		try {
			console.log('Initializing performance monitoring...');

			// Start monitoring Core Web Vitals
			this.startCoreWebVitalsMonitoring();

			// Start navigation timing monitoring
			this.startNavigationTimingMonitoring();

			// Start resource monitoring
			this.startResourceMonitoring();

			// Start memory monitoring
			this.startMemoryMonitoring();

			// Setup error tracking
			this.setupErrorTracking();

			this.isInitialized = true;
			console.log('Performance monitor initialized successfully');
		} catch (error) {
			console.error('Failed to initialize performance monitor:', error);
			throw error;
		}
	}

	/**
	 * Start monitoring Core Web Vitals
	 */
	startCoreWebVitalsMonitoring() {
		// First Contentful Paint (FCP)
		this.observePaintTiming();

		// Largest Contentful Paint (LCP)
		this.observeLargestContentfulPaint();

		// First Input Delay (FID)
		this.observeFirstInputDelay();

		// Cumulative Layout Shift (CLS)
		this.observeCumulativeLayoutShift();
	}

	/**
	 * Observe paint timing for FCP
	 */
	observePaintTiming() {
		try {
			const observer = new PerformanceObserver(list => {
				const entries = list.getEntries();
				const fcpEntry = entries.find(
					entry => entry.name === 'first-contentful-paint'
				);

				if (fcpEntry) {
					this.metrics.fcp = fcpEntry.startTime;
					this.reportMetric('FCP', fcpEntry.startTime);
					console.log(`FCP: ${Math.round(fcpEntry.startTime)}ms`);
				}
			});

			observer.observe({ entryTypes: ['paint'] });
			this.observers.push(observer);
		} catch (error) {
			console.warn('Paint timing not supported:', error);
		}
	}

	/**
	 * Observe Largest Contentful Paint (LCP)
	 */
	observeLargestContentfulPaint() {
		try {
			const observer = new PerformanceObserver(list => {
				const entries = list.getEntries();
				const lastEntry = entries[entries.length - 1];

				this.metrics.lcp = lastEntry.startTime;
				this.reportMetric('LCP', lastEntry.startTime);
				console.log(`LCP: ${Math.round(lastEntry.startTime)}ms`);
			});

			observer.observe({ entryTypes: ['largest-contentful-paint'] });
			this.observers.push(observer);
		} catch (error) {
			console.warn('Largest Contentful Paint not supported:', error);
		}
	}

	/**
	 * Observe First Input Delay (FID)
	 */
	observeFirstInputDelay() {
		try {
			const observer = new PerformanceObserver(list => {
				const entries = list.getEntries();
				entries.forEach(entry => {
					this.metrics.fid = entry.processingStart - entry.startTime;
					this.reportMetric('FID', this.metrics.fid);
					console.log(`FID: ${Math.round(this.metrics.fid)}ms`);
				});
			});

			observer.observe({ entryTypes: ['first-input'] });
			this.observers.push(observer);
		} catch (error) {
			console.warn('First Input Delay not supported:', error);
		}
	}

	/**
	 * Observe Cumulative Layout Shift (CLS)
	 */
	observeCumulativeLayoutShift() {
		try {
			let clsValue = 0;

			const observer = new PerformanceObserver(list => {
				const entries = list.getEntries();
				entries.forEach(entry => {
					if (!entry.hadRecentInput) {
						clsValue += entry.value;
						this.metrics.cls = clsValue;
						this.reportMetric('CLS', clsValue);
						console.log(`CLS: ${clsValue.toFixed(3)}`);
					}
				});
			});

			observer.observe({ entryTypes: ['layout-shift'] });
			this.observers.push(observer);
		} catch (error) {
			console.warn('Cumulative Layout Shift not supported:', error);
		}
	}

	/**
	 * Start navigation timing monitoring
	 */
	startNavigationTimingMonitoring() {
		try {
			const observer = new PerformanceObserver(list => {
				const entries = list.getEntries();
				entries.forEach(entry => {
					if (entry.entryType === 'navigation') {
						this.metrics.ttfb = entry.responseStart - entry.requestStart;
						this.metrics.domContentLoaded =
							entry.domContentLoadedEventEnd - entry.navigationStart;
						this.metrics.loadComplete =
							entry.loadEventEnd - entry.navigationStart;
						this.metrics.navigationCount++;
						this.metrics.lastNavigation = Date.now();

						this.reportMetric('TTFB', this.metrics.ttfb);
						this.reportMetric('DOMContent', this.metrics.domContentLoaded);
						this.reportMetric('LoadComplete', this.metrics.loadComplete);

						console.log(
							`Navigation timing - TTFB: ${Math.round(
								this.metrics.ttfb
							)}ms, DOM: ${Math.round(
								this.metrics.domContentLoaded
							)}ms, Load: ${Math.round(this.metrics.loadComplete)}ms`
						);
					}
				});
			});

			observer.observe({ entryTypes: ['navigation'] });
			this.observers.push(observer);
		} catch (error) {
			console.warn('Navigation timing not supported:', error);
		}
	}

	/**
	 * Start resource monitoring
	 */
	startResourceMonitoring() {
		try {
			const observer = new PerformanceObserver(list => {
				const entries = list.getEntries();
				entries.forEach(entry => {
					if (entry.entryType === 'resource') {
						this.metrics.resourceCount++;

						if (entry.transferSize) {
							this.metrics.resourceSize += entry.transferSize;
						}

						// Report slow resources
						if (entry.duration > 1000) {
							console.warn(
								`Slow resource detected: ${entry.name} took ${Math.round(
									entry.duration
								)}ms`
							);
							this.reportSlowResource(entry);
						}
					}
				});
			});

			observer.observe({ entryTypes: ['resource'] });
			this.observers.push(observer);
		} catch (error) {
			console.warn('Resource monitoring not supported:', error);
		}
	}

	/**
	 * Start memory monitoring
	 */
	startMemoryMonitoring() {
		try {
			// Monitor memory usage every 10 seconds
			setInterval(() => {
				if (performance.memory) {
					const memoryInfo = performance.memory;
					this.metrics.memoryUsage = memoryInfo.usedJSHeapSize;

					if (memoryInfo.usedJSHeapSize > this.metrics.memoryPeak) {
						this.metrics.memoryPeak = memoryInfo.usedJSHeapSize;
					}

					// Report memory usage if it's high
					if (memoryInfo.usedJSHeapSize > 50 * 1024 * 1024) {
						// 50MB
						this.reportMemoryUsage(memoryInfo);
					}
				}
			}, 10000);
		} catch (error) {
			console.warn('Memory monitoring not supported:', error);
		}
	}

	/**
	 * Setup error tracking
	 */
	setupErrorTracking() {
		// Track JavaScript errors
		window.addEventListener('error', event => {
			this.metrics.errorCount++;
			this.reportError({
				type: 'javascript',
				message: event.message,
				filename: event.filename,
				lineno: event.lineno,
				colno: event.colno,
				timestamp: Date.now(),
			});
		});

		// Track unhandled promise rejections
		window.addEventListener('unhandledrejection', event => {
			this.metrics.errorCount++;
			this.reportError({
				type: 'promise',
				message: event.reason,
				timestamp: Date.now(),
			});
		});
	}

	/**
	 * Report a performance metric
	 */
	reportMetric(name, value) {
		const metric = {
			name,
			value,
			timestamp: Date.now(),
			url: window.location?.href || 'unknown',
		};

		// Send to main process for analytics
		if (window.electron && window.electron.reportPerformanceMetric) {
			window.electron.reportPerformanceMetric(metric);
		}

		// Store for local reporting
		this.storeMetric(metric);
	}

	/**
	 * Report slow resource
	 */
	reportSlowResource(entry) {
		const resource = {
			name: entry.name,
			duration: entry.duration,
			size: entry.transferSize,
			type: entry.initiatorType,
			timestamp: Date.now(),
		};

		if (window.electron && window.electron.reportSlowResource) {
			window.electron.reportSlowResource(resource);
		}
	}

	/**
	 * Report memory usage
	 */
	reportMemoryUsage(memoryInfo) {
		const memory = {
			used: memoryInfo.usedJSHeapSize,
			total: memoryInfo.totalJSHeapSize,
			limit: memoryInfo.jsHeapSizeLimit,
			timestamp: Date.now(),
		};

		if (window.electron && window.electron.reportMemoryUsage) {
			window.electron.reportMemoryUsage(memory);
		}
	}

	/**
	 * Report an error
	 */
	reportError(error) {
		if (window.electron && window.electron.reportError) {
			window.electron.reportError(error);
		}
	}

	/**
	 * Store metric locally
	 */
	storeMetric(metric) {
		// Store in localStorage for debugging
		try {
			const stored = localStorage.getItem('performanceMetrics') || '[]';
			const metrics = JSON.parse(stored);
			metrics.push(metric);

			// Keep only last 100 metrics
			if (metrics.length > 100) {
				metrics.splice(0, metrics.length - 100);
			}

			localStorage.setItem('performanceMetrics', JSON.stringify(metrics));
		} catch (error) {
			console.warn('Failed to store metric:', error);
		}
	}

	/**
	 * Get current metrics
	 */
	getCurrentMetrics() {
		return { ...this.metrics };
	}

	/**
	 * Generate performance report
	 */
	generateReport() {
		const score = this.calculatePerformanceScore();
		const recommendations = this.getRecommendations();

		return {
			timestamp: Date.now(),
			metrics: this.metrics,
			score,
			grade: this.getGrade(score),
			recommendations,
			sessionDuration: Date.now() - this.metrics.sessionStart,
		};
	}

	/**
	 * Calculate overall performance score
	 */
	calculatePerformanceScore() {
		const weights = {
			fcp: 0.2,
			lcp: 0.25,
			fid: 0.25,
			cls: 0.15,
			ttfb: 0.15,
		};

		let score = 0;
		let totalWeight = 0;

		Object.keys(weights).forEach(metric => {
			const value = this.metrics[metric];
			if (value > 0) {
				const normalizedValue = this.normalizeMetric(metric, value);
				score += normalizedValue * weights[metric];
				totalWeight += weights[metric];
			}
		});

		return totalWeight > 0 ? Math.round((score / totalWeight) * 100) : 0;
	}

	/**
	 * Normalize metric value to 0-1 scale
	 */
	normalizeMetric(metric, value) {
		const threshold = this.thresholds[metric];
		if (!threshold) return 1;

		if (value <= threshold.good) return 1;
		if (value >= threshold.poor) return 0;

		return 1 - (value - threshold.good) / (threshold.poor - threshold.good);
	}

	/**
	 * Get performance grade
	 */
	getGrade(score) {
		if (score >= 90) return 'A';
		if (score >= 80) return 'B';
		if (score >= 70) return 'C';
		if (score >= 60) return 'D';
		return 'F';
	}

	/**
	 * Get performance recommendations
	 */
	getRecommendations() {
		const recommendations = [];

		if (this.metrics.fcp > this.thresholds.fcp.good) {
			recommendations.push(
				'Optimize server response time and reduce render-blocking resources'
			);
		}

		if (this.metrics.lcp > this.thresholds.lcp.good) {
			recommendations.push(
				'Optimize images and use lazy loading for offscreen content'
			);
		}

		if (this.metrics.fid > this.thresholds.fid.good) {
			recommendations.push(
				'Reduce JavaScript execution time and break up long tasks'
			);
		}

		if (this.metrics.cls > this.thresholds.cls.good) {
			recommendations.push(
				'Ensure dimensions for images and videos to prevent layout shifts'
			);
		}

		if (this.metrics.ttfb > this.thresholds.ttfb.good) {
			recommendations.push(
				'Improve server response time and use CDN for static assets'
			);
		}

		if (this.metrics.memoryUsage > 50 * 1024 * 1024) {
			recommendations.push(
				'High memory usage detected. Consider implementing memory optimization'
			);
		}

		if (this.metrics.errorCount > 5) {
			recommendations.push(
				'Multiple errors detected. Check error logs and fix critical issues'
			);
		}

		return recommendations;
	}

	/**
	 * Reset all metrics
	 */
	reset() {
		Object.keys(this.metrics).forEach(key => {
			if (typeof this.metrics[key] === 'number') {
				this.metrics[key] = 0;
			}
		});

		this.metrics.sessionStart = Date.now();
		console.log('Performance metrics reset');
	}

	/**
	 * Destroy performance monitor
	 */
	destroy() {
		if (!this.isInitialized) return;

		// Disconnect all observers
		this.observers.forEach(observer => {
			observer.disconnect();
		});
		this.observers = [];

		this.isInitialized = false;
		console.log('Performance monitor destroyed');
	}
}
