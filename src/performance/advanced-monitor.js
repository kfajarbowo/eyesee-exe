/**
 * Advanced Performance Monitoring Module
 *
 * Provides comprehensive performance monitoring with real-time alerts,
 * historical data analysis, and performance regression detection.
 * Phase 2 Implementation - Advanced Performance Optimization
 */

export class AdvancedMonitor {
	constructor() {
		this.metricsHistory = [];
		this.maxHistorySize = 1000; // Keep last 1000 metrics
		this.alertThresholds = {
			memoryUsage: 80, // 80% of threshold
			responseTime: 2000, // 2 seconds
			errorRate: 5, // 5 errors per minute
			performanceScore: 70, // Score below 70
		};

		this.baselineMetrics = {
			averageMemoryUsage: 0,
			averageResponseTime: 0,
			averagePerformanceScore: 0,
			errorRate: 0,
		};

		this.isInitialized = false;
		this.monitoringInterval = null;
		this.alertSystem = null;
	}

	/**
	 * Initialize advanced monitoring
	 */
	async initialize() {
		if (this.isInitialized) return;

		console.log('Initializing advanced performance monitor...');

		// Calculate baseline metrics
		await this.calculateBaseline();

		// Start monitoring interval
		this.startMonitoring();

		// Initialize alert system
		this.initializeAlertSystem();

		this.isInitialized = true;
		console.log('Advanced performance monitor initialized');
	}

	/**
	 * Calculate baseline metrics
	 */
	async calculateBaseline() {
		console.log('Calculating baseline metrics...');

		// Collect metrics over 5 minutes
		const metrics = [];
		const startTime = Date.now();

		while (Date.now() - startTime < 5 * 60 * 1000) {
			// 5 minutes
			const currentMetrics = await this.collectCurrentMetrics();
			metrics.push(currentMetrics);
			await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second
		}

		// Calculate baseline
		this.baselineMetrics = {
			averageMemoryUsage:
				metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / metrics.length,
			averageResponseTime:
				metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length,
			averagePerformanceScore:
				metrics.reduce((sum, m) => sum + m.performanceScore, 0) /
				metrics.length,
			errorRate:
				metrics.reduce((sum, m) => sum + m.errorCount, 0) / metrics.length,
		};

		console.log('Baseline metrics calculated:', this.baselineMetrics);
	}

	/**
	 * Start monitoring interval
	 */
	startMonitoring() {
		this.monitoringInterval = setInterval(() => {
			this.collectAndAnalyzeMetrics();
		}, 5000); // Every 5 seconds
	}

	/**
	 * Collect and analyze current metrics
	 */
	async collectAndAnalyzeMetrics() {
		try {
			const metrics = await this.collectCurrentMetrics();
			this.addToHistory(metrics);
			this.analyzeMetrics(metrics);
			this.checkAlerts(metrics);
		} catch (error) {
			console.error('Error collecting metrics:', error);
		}
	}

	/**
	 * Collect current performance metrics
	 */
	async collectCurrentMetrics() {
		// Get memory info
		const memoryInfo = await this.getMemoryInfo();

		// Get network info
		const networkInfo = this.getNetworkInfo();

		// Get rendering info
		const renderingInfo = this.getRenderingInfo();

		// Get webview info
		const webviewInfo = this.getWebviewInfo();

		// Calculate performance score
		const performanceScore = this.calculatePerformanceScore({
			memory: memoryInfo,
			network: networkInfo,
			rendering: renderingInfo,
			webview: webviewInfo,
		});

		return {
			timestamp: Date.now(),
			memory: memoryInfo,
			network: networkInfo,
			rendering: renderingInfo,
			webview: webviewInfo,
			performanceScore,
			errorCount: this.getRecentErrorCount(),
		};
	}

	/**
	 * Get memory information
	 */
	async getMemoryInfo() {
		if (window.performance && window.performance.memory) {
			return {
				usedJSHeapSize: window.performance.memory.usedJSHeapSize,
				totalJSHeapSize: window.performance.memory.totalJSHeapSize,
				jsHeapSizeLimit: window.performance.memory.jsHeapSizeLimit,
			};
		}

		return { usedJSHeapSize: 0 };
	}

	/**
	 * Get network information
	 */
	getNetworkInfo() {
		if (navigator.connection) {
			return {
				type: navigator.connection.effectiveType,
				downlink: navigator.connection.downlink,
				rtt: navigator.connection.rtt,
				saveData: navigator.connection.saveData,
			};
		}

		return { type: 'unknown' };
	}

	/**
	 * Get rendering information
	 */
	getRenderingInfo() {
		const fps = this.calculateFPS();
		const frameDrops = this.getFrameDrops();

		return {
			fps,
			frameDrops,
			averageFrameTime: this.getAverageFrameTime(),
		};
	}

	/**
	 * Get webview information
	 */
	getWebviewInfo() {
		const webview = document.querySelector('webview');
		if (!webview) return { loadTime: 0, navigationCount: 0 };

		// Get webview metrics from performance controller if available
		if (window.performanceController) {
			const webviewMetrics = window.performanceController.getMetrics();
			return {
				loadTime: webviewMetrics.webviewPool
					? webviewMetrics.webviewPool.averageCreationTime || 0
					: 0,
				navigationCount: webviewMetrics.webviewPool
					? webviewMetrics.webviewPool.totalWebviewsCreated || 0
					: 0,
			};
		}

		return { loadTime: 0, navigationCount: 0 };
	}

	/**
	 * Calculate FPS
	 */
	calculateFPS() {
		let lastTime = performance.now();
		let frames = 0;

		const measureFPS = () => {
			frames++;
			const currentTime = performance.now();
			const elapsed = currentTime - lastTime;

			if (elapsed >= 1000) {
				// 1 second
				const fps = Math.round((frames / elapsed) * 1000);
				frames = 0;
				lastTime = currentTime;
				return fps;
			}
		};

		// Start measuring
		const animationId = requestAnimationFrame(measureFPS);

		// Stop after 5 seconds
		setTimeout(() => {
			cancelAnimationFrame(animationId);
			return frames / 5; // Average over 5 seconds
		}, 5000);

		return 0;
	}

	/**
	 * Get frame drops
	 */
	getFrameDrops() {
		// This would need to be implemented with frame timing
		return 0;
	}

	/**
	 * Get average frame time
	 */
	getAverageFrameTime() {
		// This would need to be implemented with frame timing
		return 0;
	}

	/**
	 * Calculate overall performance score
	 */
	calculatePerformanceScore(metrics) {
		let score = 100; // Start with perfect score

		// Memory score (40% weight)
		if (metrics.memory && metrics.memory.usedJSHeapSize) {
			const memoryUsage =
				metrics.memory.usedJSHeapSize / metrics.memory.jsHeapSizeLimit;
			const memoryScore = Math.max(0, 100 - memoryUsage * 100) * 0.4;
			score -= memoryScore;
		}

		// Network score (30% weight)
		if (metrics.network && metrics.network.rtt) {
			const latencyScore = Math.max(0, 100 - metrics.network.rtt / 1000) * 0.3;
			score -= latencyScore;
		}

		// Rendering score (30% weight)
		if (metrics.rendering && metrics.rendering.fps) {
			const fpsScore = Math.min(100, metrics.rendering.fps / 60) * 0.3;
			score -= fpsScore;
		}

		return Math.max(0, Math.round(score));
	}

	/**
	 * Get recent error count
	 */
	getRecentErrorCount() {
		const now = Date.now();
		const oneMinuteAgo = now - 60 * 1000;

		return this.metricsHistory.filter(
			m => m.errorCount > 0 && m.timestamp > oneMinuteAgo
		).length;
	}

	/**
	 * Add metrics to history
	 */
	addToHistory(metrics) {
		this.metricsHistory.push(metrics);

		// Keep only recent metrics
		if (this.metricsHistory.length > this.maxHistorySize) {
			this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
		}
	}

	/**
	 * Analyze metrics for trends
	 */
	analyzeMetrics(metrics) {
		const analysis = {
			memoryTrend: this.analyzeMemoryTrend(),
			networkTrend: this.analyzeNetworkTrend(),
			performanceTrend: this.analyzePerformanceTrend(),
			recommendations: this.generateRecommendations(metrics),
		};

		console.log('Metrics analysis:', analysis);
		return analysis;
	}

	/**
	 * Analyze memory usage trend
	 */
	analyzeMemoryTrend() {
		if (this.metricsHistory.length < 10) return 'stable';

		const recent = this.metricsHistory.slice(-10);
		const memoryUsages = recent.map(m => m.memory.usedJSHeapSize);

		const average =
			memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length;
		const oldest = memoryUsages[0];
		const newest = memoryUsages[memoryUsages.length - 1];

		if (newest > oldest * 1.5) {
			return 'increasing';
		} else if (newest < oldest * 0.5) {
			return 'decreasing';
		} else {
			return 'stable';
		}
	}

	/**
	 * Analyze network performance trend
	 */
	analyzeNetworkTrend() {
		if (this.metricsHistory.length < 10) return 'stable';

		const recent = this.metricsHistory.slice(-10);
		const networkLatencies = recent.map(m => (m.network ? m.network.rtt : 0));

		const average =
			networkLatencies.reduce((sum, m) => sum + m, 0) / networkLatencies.length;
		const oldest = networkLatencies[0];
		const newest = networkLatencies[networkLatencies.length - 1];

		if (newest > oldest * 1.2) {
			return 'degrading';
		} else if (newest < oldest * 0.8) {
			return 'improving';
		} else {
			return 'stable';
		}
	}

	/**
	 * Analyze performance score trend
	 */
	analyzePerformanceTrend() {
		if (this.metricsHistory.length < 10) return 'stable';

		const recent = this.metricsHistory.slice(-10);
		const scores = recent.map(m => m.performanceScore);

		const average = scores.reduce((sum, m) => sum + m, 0) / scores.length;
		const oldest = scores[0];
		const newest = scores[scores.length - 1];

		if (newest > oldest * 1.1) {
			return 'degrading';
		} else if (newest < oldest * 0.95) {
			return 'improving';
		} else {
			return 'stable';
		}
	}

	/**
	 * Generate performance recommendations
	 */
	generateRecommendations(metrics) {
		const recommendations = [];

		// Memory recommendations
		if (
			metrics.memory &&
			metrics.memory.usedJSHeapSize > metrics.memory.jsHeapSizeLimit * 0.8
		) {
			recommendations.push({
				type: 'memory',
				severity: 'high',
				message:
					'High memory usage detected. Consider optimizing memory usage or increasing heap size limit.',
				action: 'optimize-memory',
			});
		}

		// Network recommendations
		if (metrics.network && metrics.network.rtt > 500) {
			recommendations.push({
				type: 'network',
				severity: 'medium',
				message:
					'High network latency detected. Consider optimizing network requests or using CDN.',
				action: 'optimize-network',
			});
		}

		// Performance recommendations
		if (metrics.performanceScore < 70) {
			recommendations.push({
				type: 'performance',
				severity: 'medium',
				message:
					'Performance score below optimal. Consider optimizing rendering or reducing resource usage.',
				action: 'optimize-performance',
			});
		}

		// Error recommendations
		if (metrics.errorCount > 3) {
			recommendations.push({
				type: 'errors',
				severity: 'high',
				message:
					'High error rate detected. Check error logs and fix critical issues.',
				action: 'fix-errors',
			});
		}

		return recommendations;
	}

	/**
	 * Check alerts and trigger notifications
	 */
	checkAlerts(metrics) {
		const alerts = [];

		// Memory usage alert
		if (
			metrics.memory &&
			metrics.memory.usedJSHeapSize > this.alertThresholds.memoryUsage
		) {
			alerts.push({
				type: 'memory',
				severity: 'warning',
				message: `Memory usage at ${Math.round(
					metrics.memory.usedJSHeapSize / 1024 / 1024
				)}MB`,
				threshold: this.alertThresholds.memoryUsage,
				current: metrics.memory.usedJSHeapSize,
				percentage: Math.round(
					(metrics.memory.usedJSHeapSize / metrics.memory.jsHeapSizeLimit) * 100
				),
			});
		}

		// Response time alert
		if (
			metrics.network &&
			metrics.network.rtt > this.alertThresholds.responseTime
		) {
			alerts.push({
				type: 'network',
				severity: 'warning',
				message: `Network response time at ${metrics.network.rtt}ms`,
				threshold: this.alertThresholds.responseTime,
				current: metrics.network.rtt,
			});
		}

		// Performance score alert
		if (metrics.performanceScore < this.alertThresholds.performanceScore) {
			alerts.push({
				type: 'performance',
				severity: 'warning',
				message: `Performance score at ${metrics.performanceScore}`,
				threshold: this.alertThresholds.performanceScore,
				current: metrics.performanceScore,
			});
		}

		// Error rate alert
		if (metrics.errorCount > this.alertThresholds.errorRate) {
			alerts.push({
				type: 'errors',
				severity: 'critical',
				message: `Error rate at ${metrics.errorCount} per minute`,
				threshold: this.alertThresholds.errorRate,
				current: metrics.errorCount,
			});
		}

		// Trigger notifications for alerts
		if (alerts.length > 0) {
			this.triggerAlerts(alerts);
		}

		return alerts;
	}

	/**
	 * Initialize alert system
	 */
	initializeAlertSystem() {
		this.alertSystem = {
			activeAlerts: new Map(),
			alertHistory: [],
			maxAlerts: 10,
		};

		console.log('Alert system initialized');
	}

	/**
	 * Trigger alerts
	 */
	triggerAlerts(alerts) {
		alerts.forEach(alert => {
			const alertId = this.generateAlertId();

			// Store alert
			this.alertSystem.activeAlerts.set(alertId, {
				...alert,
				timestamp: Date.now(),
				acknowledged: false,
			});

			// Add to history
			this.alertSystem.alertHistory.push({
				...alert,
				id: alertId,
				timestamp: Date.now(),
			});

			// Keep only recent alerts
			if (this.alertSystem.alertHistory.length > this.alertSystem.maxAlerts) {
				this.alertSystem.alertHistory = this.alertSystem.alertHistory.slice(
					-this.alertSystem.maxAlerts
				);
			}

			// Show notification
			this.showNotification(alert);

			console.warn('Alert triggered:', alert);
		});
	}

	/**
	 * Generate alert ID
	 */
	generateAlertId() {
		return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Show notification
	 */
	showNotification(alert) {
		if (!('Notification' in window)) {
			console.warn('Notifications not supported');
			return;
		}

		const notification = new Notification(alert.message, {
			icon: 'warning',
			tag: 'performance-alert',
		});

		notification.onclick = () => {
			this.acknowledgeAlert(alert.id);
		};

		// Auto-dismiss after 10 seconds
		setTimeout(() => {
			notification.close();
		}, 10000);
	}

	/**
	 * Acknowledge alert
	 */
	acknowledgeAlert(alertId) {
		const alert = this.alertSystem.activeAlerts.get(alertId);
		if (alert) {
			alert.acknowledged = true;
			console.log('Alert acknowledged:', alertId);
		}
	}

	/**
	 * Get monitoring statistics
	 */
	getStats() {
		return {
			historySize: this.metricsHistory.length,
			maxHistorySize: this.maxHistorySize,
			baselineMetrics: this.baselineMetrics,
			currentAlerts: this.alertSystem.activeAlerts.size,
			alertHistorySize: this.alertSystem.alertHistory.length,
			maxAlerts: this.alertSystem.maxAlerts,
			alerts: this.alertSystem.alertHistory.slice(-10), // Last 10 alerts
		};
	}

	getPerformanceReport() {
		if (this.metricsHistory.length === 0) {
			return {
				message: 'No performance data available',
				data: null,
			};
		}

		const latest = this.metricsHistory[this.metricsHistory.length - 1];
		const analysis = this.analyzeMetrics(latest);

		return {
			timestamp: latest.timestamp,
			metrics: latest,
			analysis,
			alerts: this.checkAlerts(latest),
			recommendations: analysis.recommendations,
			trends: {
				memory: this.analyzeMemoryTrend(),
				network: this.analyzeNetworkTrend(),
				performance: this.analyzePerformanceTrend(),
			},
		};
	}

	/**
	 * Destroy advanced monitor
	 */
	destroy() {
		if (!this.isInitialized) return;

		console.log('Destroying advanced performance monitor...');

		// Clear monitoring interval
		if (this.monitoringInterval) {
			clearInterval(this.monitoringInterval);
			this.monitoringInterval = null;
		}

		// Clear alert system
		this.alertSystem = null;

		this.isInitialized = false;
		console.log('Advanced performance monitor destroyed');
	}
}
