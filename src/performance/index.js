/**
 * Performance Optimization Module - Phase 1
 *
 * This module handles all performance-related optimizations for the webview application.
 * Phase 1 focuses on:
 * - Memory management
 * - Basic performance monitoring
 * - Resource cleanup
 */

import { MemoryManager } from './memory-manager.js';
import { PerformanceMonitor } from './performance-monitor.js';
import { ResourceManager } from './resource-manager.js';

/**
 * Main performance controller that coordinates all optimization modules
 */
export class PerformanceController {
	constructor() {
		this.memoryManager = new MemoryManager();
		this.performanceMonitor = new PerformanceMonitor();
		this.resourceManager = new ResourceManager();
		this.isInitialized = false;
	}

	/**
	 * Initialize all performance optimization modules
	 */
	async initialize() {
		if (this.isInitialized) {
			console.warn('Performance controller already initialized');
			return;
		}

		try {
			console.log('Initializing performance optimization modules...');

			// Initialize memory management
			await this.memoryManager.initialize();
			console.log('✓ Memory manager initialized');

			// Initialize performance monitoring
			await this.performanceMonitor.initialize();
			console.log('✓ Performance monitor initialized');

			// Initialize resource management
			await this.resourceManager.initialize();
			console.log('✓ Resource manager initialized');

			this.isInitialized = true;
			console.log('✓ All performance modules initialized successfully');

			// Start periodic performance checks
			this.startPeriodicChecks();
		} catch (error) {
			console.error('Failed to initialize performance modules:', error);
			throw error;
		}
	}

	/**
	 * Start periodic performance checks and cleanup
	 */
	startPeriodicChecks() {
		// Check memory usage every 30 seconds
		setInterval(() => {
			this.memoryManager.checkMemoryUsage();
		}, 30000);

		// Generate performance report every 60 seconds
		setInterval(() => {
			const report = this.performanceMonitor.generateReport();
			console.log('Performance Report:', report);

			// Send report to main process for analytics
			if (window.electron && window.electron.reportPerformanceMetrics) {
				window.electron.reportPerformanceMetrics(report);
			}
		}, 60000);

		// Cleanup resources every 5 minutes
		setInterval(() => {
			this.resourceManager.performCleanup();
		}, 300000);
	}

	/**
	 * Get current performance metrics
	 */
	getMetrics() {
		return {
			memory: this.memoryManager.getMemoryUsage(),
			performance: this.performanceMonitor.getCurrentMetrics(),
			resources: this.resourceManager.getResourceStats(),
		};
	}

	/**
	 * Force cleanup of all resources
	 */
	forceCleanup() {
		this.memoryManager.forceCleanup();
		this.resourceManager.forceCleanup();
		this.performanceMonitor.reset();
	}

	/**
	 * Cleanup all modules when application is closing
	 */
	destroy() {
		if (!this.isInitialized) return;

		console.log('Cleaning up performance modules...');

		this.memoryManager.destroy();
		this.performanceMonitor.destroy();
		this.resourceManager.destroy();

		this.isInitialized = false;
		console.log('✓ Performance modules cleaned up');
	}
}

// Export singleton instance
export const performanceController = new PerformanceController();
