/**
 * Rendering Optimization Module
 *
 * Optimizes rendering performance with virtual scrolling, lazy loading, and efficient animations.
 * Phase 2 Implementation - Advanced Performance Optimization
 */

export class RenderOptimizer {
	constructor() {
		this.virtualScrollers = new Map();
		this.lazyLoadObserver = null;
		this.animationFrameId = null;
		this.isInitialized = false;

		// Performance metrics
		this.metrics = {
			virtualScrollsCreated: 0,
			lazyElementsLoaded: 0,
			animationsOptimized: 0,
			frameDrops: 0,
			averageFrameTime: 0,
		};
	}

	/**
	 * Initialize rendering optimizer
	 */
	async initialize() {
		if (this.isInitialized) return;

		console.log('Initializing rendering optimizer...');

		// Setup lazy loading observer
		this.setupLazyLoadingObserver();

		// Setup animation frame optimization
		this.setupAnimationFrameOptimization();

		this.isInitialized = true;
		console.log('Rendering optimizer initialized');
	}

	/**
	 * Setup lazy loading observer
	 */
	setupLazyLoadingObserver() {
		if (!('IntersectionObserver' in window)) {
			console.warn('IntersectionObserver not supported');
			return;
		}

		this.lazyLoadObserver = new IntersectionObserver(
			entries => {
				entries.forEach(entry => {
					if (entry.isIntersecting) {
						this.loadLazyElement(entry.target);
					}
				});
			},
			{
				rootMargin: '50px',
				threshold: 0.1,
			}
		);

		// Observe all images and iframes
		document
			.querySelectorAll('img[data-lazy], iframe[data-lazy]')
			.forEach(el => {
				this.lazyLoadObserver.observe(el);
			});
	}

	/**
	 * Setup animation frame optimization
	 */
	setupAnimationFrameOptimization() {
		// Override requestAnimationFrame for better performance
		const originalRAF = window.requestAnimationFrame;

		window.requestAnimationFrame = callback => {
			const startTime = performance.now();

			originalRAF(() => {
				const endTime = performance.now();
				const frameTime = endTime - startTime;

				// Update metrics
				this.updateFrameMetrics(frameTime);

				callback();
			});
		};
	}

	/**
	 * Create virtual scroller for large lists
	 */
	createVirtualScroller(container, options = {}) {
		const scrollerId = `virtual-scroller-${Date.now()}`;

		const scroller = {
			id: scrollerId,
			container,
			itemHeight: options.itemHeight || 50,
			visibleItems: options.visibleItems || 10,
			scrollTop: 0,
			items: [],
			isScrolling: false,
			lastScrollTime: 0,
		};

		// Create virtual scroller container
		const virtualContainer = document.createElement('div');
		virtualContainer.className = 'virtual-scroller';
		virtualContainer.style.cssText = `
            height: ${options.visibleItems * options.itemHeight}px;
            overflow-y: auto;
            position: relative;
        `;

		// Create viewport
		const viewport = document.createElement('div');
		viewport.className = 'virtual-viewport';
		viewport.style.cssText = `
            height: ${options.visibleItems * options.itemHeight}px;
            overflow: hidden;
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
        `;

		virtualContainer.appendChild(viewport);
		container.appendChild(virtualContainer);

		// Store scroller
		this.virtualScrollers.set(scrollerId, scroller);

		// Update metrics
		this.metrics.virtualScrollsCreated++;

		return scroller;
	}

	/**
	 * Update virtual scroller
	 */
	updateVirtualScroller(scrollerId, items) {
		const scroller = this.virtualScrollers.get(scrollerId);
		if (!scroller) return;

		scroller.items = items;
		scroller.totalItems = items.length;

		// Update viewport
		this.updateVirtualViewport(scroller);

		// Update metrics
		this.metrics.averageFrameTime = this.calculateAverageFrameTime();
	}

	/**
	 * Update virtual viewport
	 */
	updateVirtualViewport(scroller) {
		const viewport = scroller.container.querySelector('.virtual-viewport');
		const scrollTop = scroller.scrollTop;

		// Calculate visible range
		const startIndex = Math.floor(scrollTop / scroller.itemHeight);
		const endIndex = Math.min(
			startIndex + scroller.visibleItems,
			scroller.totalItems - 1
		);

		// Update visible items
		const fragment = document.createDocumentFragment();
		for (let i = startIndex; i <= endIndex; i++) {
			const item = scroller.items[i];
			const element = this.createVirtualItem(item, i * scroller.itemHeight);
			fragment.appendChild(element);
		}

		viewport.innerHTML = '';
		viewport.appendChild(fragment);

		// Update scroller state
		scroller.lastScrollTime = performance.now();
		scroller.isScrolling = false;
	}

	/**
	 * Create virtual item element
	 */
	createVirtualItem(item, index) {
		const element = document.createElement('div');
		element.className = 'virtual-item';
		element.style.cssText = `
            position: absolute;
            top: ${index}px;
            left: 0;
            right: 0;
            width: 100%;
            height: ${this.itemHeight}px;
            box-sizing: border-box;
        `;

		// Set item data
		element.textContent = item.text || `Item ${index + 1}`;
		element.dataset.index = index;

		return element;
	}

	/**
	 * Load lazy element
	 */
	loadLazyElement(element) {
		const src = element.dataset.src;
		if (!src) return;

		// Create image and set src
		const img = new Image();
		img.onload = () => {
			element.src = src;
			element.classList.remove('lazy-loading');
			this.metrics.lazyElementsLoaded++;
		};

		img.onerror = () => {
			element.classList.add('lazy-error');
			console.error('Failed to load lazy image:', src);
		};

		element.classList.add('lazy-loading');
		img.src = src;
	}

	/**
	 * Optimize animations
	 */
	optimizeAnimations(container) {
		const elements = container.querySelectorAll('*');

		elements.forEach(element => {
			// Use CSS transforms instead of position changes
			if (
				element.style.position === 'absolute' ||
				element.style.position === 'fixed'
			) {
				element.style.transform = 'translateZ(0)';
				element.style.willChange = 'transform';
			}

			// Use opacity for fade effects
			if (
				element.style.transition &&
				element.style.transition.includes('opacity')
			) {
				element.style.willChange = 'opacity';
			}
		});

		this.metrics.animationsOptimized += elements.length;
	}

	/**
	 * Update frame metrics
	 */
	updateFrameMetrics(frameTime) {
		const totalFrames = this.metrics.frameDrops + 1;
		this.metrics.averageFrameTime =
			(this.metrics.averageFrameTime * (totalFrames - 1) + frameTime) /
			totalFrames;
	}

	/**
	 * Handle frame drops
	 */
	handleFrameDrop() {
		this.metrics.frameDrops++;
		console.warn('Frame drop detected');
	}

	/**
	 * Get rendering statistics
	 */
	getStats() {
		return {
			virtualScrollsCreated: this.metrics.virtualScrollsCreated,
			lazyElementsLoaded: this.metrics.lazyElementsLoaded,
			animationsOptimized: this.metrics.animationsOptimized,
			frameDrops: this.metrics.frameDrops,
			averageFrameTime: this.metrics.averageFrameTime,
			activeVirtualScrollers: this.virtualScrollers.size,
		};
	}

	/**
	 * Destroy rendering optimizer
	 */
	destroy() {
		if (!this.isInitialized) return;

		console.log('Destroying rendering optimizer...');

		// Disconnect lazy loading observer
		if (this.lazyLoadObserver) {
			this.lazyLoadObserver.disconnect();
		}

		// Cancel animation frame
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
		}

		// Clean up virtual scrollers
		this.virtualScrollers.forEach(scroller => {
			const container = scroller.container;
			if (container && container.parentNode) {
				container.parentNode.removeChild(container);
			}
		});

		this.virtualScrollers.clear();

		this.isInitialized = false;
		console.log('Rendering optimizer destroyed');
	}
}
