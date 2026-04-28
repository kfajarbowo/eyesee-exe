const https = require('https');
const http = require('http');

class SiteSelector {
	constructor() {
		this.sites = [];
		this.appName = '';
		this.appKey = '';
		this.total = 0;
		this.lastFetch = null;
		this.cacheDuration = 5 * 60 * 1000; // 5 minutes cache
	}

	/**
	 * Fetch sites from API
	 * @param {string} apiUrl - The API endpoint URL
	 * @returns {Promise<{sites: Array, appName: string, total: number}>}
	 */
	async fetchSites(apiUrl) {
		// Return cached data if still valid
		if (
			this.lastFetch &&
			Date.now() - this.lastFetch < this.cacheDuration &&
			this.sites.length > 0
		) {
			return {
				sites: this.sites,
				appName: this.appName,
				total: this.total,
			};
		}

		try {
			const data = await this._httpGet(apiUrl);
			const response = JSON.parse(data);

			if (response.status === 'success' && response.data) {
				this.sites = response.data.sites || [];
				this.appName = response.data.appName || '';
				this.appKey = response.data.appKey || '';
				this.total = response.data.total || 0;
				this.lastFetch = Date.now();

				console.log(
					`[SiteSelector] Fetched ${this.sites.length} sites for ${this.appName}`
				);
				return {
					sites: this.sites,
					appName: this.appName,
					total: this.total,
				};
			}

			throw new Error('Invalid API response format');
		} catch (error) {
			console.error('[SiteSelector] Failed to fetch sites:', error.message);
			throw error;
		}
	}

	/**
	 * Build webview URL from a site object
	 * @param {Object} site - Site object from API
	 * @returns {string} URL for webview
	 */
	buildSiteUrl(site) {
		return `http://${site.ip}:${site.port}`;
	}

	/**
	 * Get cached sites without fetching
	 * @returns {Array}
	 */
	getCachedSites() {
		return this.sites;
	}

	/**
	 * Find a site by siteCode
	 * @param {string} siteCode
	 * @returns {Object|null}
	 */
	findSite(siteCode) {
		return this.sites.find(s => s.siteCode === siteCode) || null;
	}

	/**
	 * HTTP GET request (no external dependencies)
	 * @param {string} url
	 * @returns {Promise<string>}
	 */
	_httpGet(url) {
		return new Promise((resolve, reject) => {
			const client = url.startsWith('https') ? https : http;
			const timeout = 10000; // 10 seconds

			const req = client.get(url, { timeout }, res => {
				let data = '';
				res.on('data', chunk => {
					data += chunk;
				});
				res.on('end', () => {
					if (res.statusCode >= 200 && res.statusCode < 300) {
						resolve(data);
					} else {
						reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
					}
				});
			});

			req.on('error', reject);
			req.on('timeout', () => {
				req.destroy();
				reject(new Error('Request timeout'));
			});
		});
	}
}

// Singleton
const siteSelector = new SiteSelector();
module.exports = { siteSelector, SiteSelector };
