// ================================================================
// Portal Center — Main Application Logic
// ================================================================
(function () {
	'use strict';

	// ── State ───────────────────────────────────────────────────
	var state = {
		regions: [],
		allSites: [],       // flat list of all sites from API
		currentRegion: null, // selected region code or 'ALL'
		currentApp: 'eyesee',
		siteStatuses: {},   // siteCode -> { online, responseTime }
		statusTimer: null,
		apiOrigin: '',      // API origin (scheme + host) for building image URLs
		manageMode: null,   // null | 'edit' | 'delete'
		posImages: [
			'assets/images/pos-1.png',
			'assets/images/pos-2.png',
			'assets/images/pos-3.png',
		],
	};

	// ── DOM references ──────────────────────────────────────────
	var dom = {
		regionList: document.getElementById('region-list'),
		posGrid: document.getElementById('pos-grid'),
		loadingState: document.getElementById('loading-state'),
		emptyState: document.getElementById('empty-state'),
		contentTitle: document.getElementById('content-title'),
		contentCount: document.getElementById('content-count'),
		searchRegion: document.getElementById('search-region'),
		toolbarStatus: document.getElementById('toolbar-status'),
		toastContainer: document.getElementById('toast-container'),
		contextMenu: document.getElementById('context-menu'),
	};

	// ── Toast ────────────────────────────────────────────────────
	function showToast(message, type) {
		type = type || 'info';
		var el = document.createElement('div');
		el.className = 'toast ' + type;
		el.textContent = message;
		dom.toastContainer.appendChild(el);
		setTimeout(function () {
			el.style.opacity = '0';
			el.style.transform = 'translateX(20px)';
			el.style.transition = '0.3s ease';
			setTimeout(function () { el.remove(); }, 300);
		}, 3000);
	}

	// ── Modal helpers ───────────────────────────────────────────
	window.openModal = function (type) {
		document.getElementById('modal-' + type).classList.add('active');
	};

	window.closeModal = function (type) {
		document.getElementById('modal-' + type).classList.remove('active');
	};

	// Close modal on overlay click
	document.querySelectorAll('.modal-overlay').forEach(function (overlay) {
		overlay.addEventListener('click', function (e) {
			if (e.target === overlay) overlay.classList.remove('active');
		});
	});

	// ── App Tabs ────────────────────────────────────────────────
	document.querySelectorAll('.app-tab').forEach(function (tab) {
		tab.addEventListener('click', function () {
			document.querySelectorAll('.app-tab').forEach(function (t) {
				t.classList.remove('active');
			});
			tab.classList.add('active');
			state.currentApp = tab.dataset.app;
			renderPosGrid();
		});
	});

	// ── Region Search ───────────────────────────────────────────
	dom.searchRegion.addEventListener('input', function () {
		renderRegionList();
	});

	// ── Button Handlers ─────────────────────────────────────────
	document.getElementById('btn-add-pos').addEventListener('click', function () {
		document.getElementById('modal-pos-title').textContent = 'Tambah Pos';
		document.getElementById('pos-edit-code').value = '';
		document.getElementById('pos-code').value = '';
		document.getElementById('pos-code').disabled = false;
		document.getElementById('pos-name').value = '';
		document.getElementById('pos-blockip').value = '';
		document.getElementById('pos-desc').value = '';
		document.getElementById('pos-image').value = '';
		document.getElementById('pos-ip-eyesee').value = '';
		document.getElementById('pos-port-eyesee').value = '';
		document.getElementById('pos-ip-bms').value = '';
		document.getElementById('pos-port-bms').value = '';
		document.getElementById('pos-ip-blm').value = '';
		document.getElementById('pos-port-blm').value = '';
		document.getElementById('pos-ip-vcom').value = '';
		document.getElementById('pos-port-vcom').value = '';
		populateRegionDropdown();
		openModal('pos');
	});

	document.getElementById('btn-add-region').addEventListener('click', function () {
		document.getElementById('modal-region-title').textContent = 'Tambah Wilayah';
		document.getElementById('region-edit-code').value = '';
		document.getElementById('region-code').value = '';
		document.getElementById('region-code').disabled = false;
		document.getElementById('region-name').value = '';
		document.getElementById('region-desc').value = '';
		openModal('region');
	});

	// ── Manage Mode Toggle ────────────────────────────────────
	document.getElementById('btn-edit-mode').addEventListener('click', function () {
		if (state.manageMode === 'edit') {
			exitManageMode();
		} else {
			enterManageMode('edit');
		}
	});

	document.getElementById('btn-delete-mode').addEventListener('click', function () {
		if (state.manageMode === 'delete') {
			exitManageMode();
		} else {
			enterManageMode('delete');
		}
	});

	function enterManageMode(mode) {
		state.manageMode = mode;
		document.getElementById('btn-edit-mode').classList.toggle('active', mode === 'edit');
		document.getElementById('btn-delete-mode').classList.toggle('active', mode === 'delete');
		renderPosGrid();
	}

	function exitManageMode() {
		state.manageMode = null;
		document.getElementById('btn-edit-mode').classList.remove('active');
		document.getElementById('btn-delete-mode').classList.remove('active');
		renderPosGrid();
	}
	window.exitManageMode = exitManageMode;

	// ── Save Region ─────────────────────────────────────────────
	document.getElementById('btn-save-region').addEventListener('click', async function () {
		var editCode = document.getElementById('region-edit-code').value;
		var code = document.getElementById('region-code').value.trim().toUpperCase();
		var name = document.getElementById('region-name').value.trim();
		var desc = document.getElementById('region-desc').value.trim();

		if (!code || !name) {
			showToast('Kode dan nama wilayah wajib diisi', 'error');
			return;
		}

		try {
			if (editCode) {
				await window.portal.updateRegion(editCode, {
					regionName: name,
					description: desc || null,
				});
				showToast('Wilayah berhasil diperbarui', 'success');
			} else {
				await window.portal.createRegion({
					regionCode: code,
					regionName: name,
					description: desc || null,
				});
				showToast('Wilayah berhasil ditambahkan', 'success');
			}
			closeModal('region');
			await loadData();
		} catch (e) {
			showToast('Gagal: ' + (e.message || 'Unknown error'), 'error');
		}
	});

	// ── Save Pos ────────────────────────────────────────────────
	document.getElementById('btn-save-pos').addEventListener('click', async function () {
		var editCode = document.getElementById('pos-edit-code').value;
		var code = document.getElementById('pos-code').value.trim().toUpperCase();
		var name = document.getElementById('pos-name').value.trim();
		var blockIp = document.getElementById('pos-blockip').value.trim();
		var regionId = document.getElementById('pos-region').value;
		var desc = document.getElementById('pos-desc').value.trim();

		if (!code || !name || !blockIp) {
			showToast('Kode, nama, dan block IP wajib diisi', 'error');
			return;
		}

		var ips = [];
		if (document.getElementById('pos-ip-eyesee').value.trim()) ips.push({ appKey: 'eyesee', ipAddress: document.getElementById('pos-ip-eyesee').value.trim(), port: document.getElementById('pos-port-eyesee').value ? parseInt(document.getElementById('pos-port-eyesee').value) : null });
		if (document.getElementById('pos-ip-bms').value.trim()) ips.push({ appKey: 'bms', ipAddress: document.getElementById('pos-ip-bms').value.trim(), port: document.getElementById('pos-port-bms').value ? parseInt(document.getElementById('pos-port-bms').value) : null });
		if (document.getElementById('pos-ip-blm').value.trim()) ips.push({ appKey: 'blm', ipAddress: document.getElementById('pos-ip-blm').value.trim(), port: document.getElementById('pos-port-blm').value ? parseInt(document.getElementById('pos-port-blm').value) : null });
		if (document.getElementById('pos-ip-vcom').value.trim()) ips.push({ appKey: 'vcom', ipAddress: document.getElementById('pos-ip-vcom').value.trim(), port: document.getElementById('pos-port-vcom').value ? parseInt(document.getElementById('pos-port-vcom').value) : null });

		var fileInput = document.getElementById('pos-image');
		var fileObj = null;
		if (fileInput.files.length > 0) {
			var file = fileInput.files[0];
			if (file.size > 5 * 1024 * 1024) {
				showToast('Gambar terlalu besar. Maks 5MB.', 'error');
				return;
			}
			var buffer = await file.arrayBuffer();
			fileObj = { name: file.name, type: file.type, buffer: buffer };
		}

		try {
			if (editCode) {
				var updateData = { siteName: name, blockIp: blockIp, description: desc || null, ips: ips };
				if (regionId) updateData.regionId = parseInt(regionId);
				else updateData.regionId = null;
				await window.portal.updateSite(editCode, { payload: updateData, file: fileObj });
				showToast('Pos berhasil diperbarui', 'success');
			} else {
				var createData = { siteCode: code, siteName: name, blockIp: blockIp, ips: ips };
				if (desc) createData.description = desc;
				if (regionId) createData.regionId = parseInt(regionId);
				await window.portal.createSite({ payload: createData, file: fileObj });
				showToast('Pos berhasil ditambahkan', 'success');
			}
			closeModal('pos');
			await loadData();
		} catch (e) {
			showToast('Gagal: ' + (e.message || 'Unknown error'), 'error');
		}
	});

	// ── Populate Region Dropdown ────────────────────────────────
	function populateRegionDropdown(selectedId) {
		var sel = document.getElementById('pos-region');
		sel.innerHTML = '<option value="">— Pilih Wilayah —</option>';
		state.regions.forEach(function (r) {
			var opt = document.createElement('option');
			opt.value = r.id;
			opt.textContent = r.regionName;
			if (selectedId && r.id === selectedId) opt.selected = true;
			sel.appendChild(opt);
		});
	}

	// ── Context Menu ────────────────────────────────────────────
	var ctxTarget = null;
	var ctxType = null;

	function showContextMenu(e, type, data) {
		e.preventDefault();
		e.stopPropagation();
		ctxTarget = data;
		ctxType = type;
		dom.contextMenu.style.top = e.clientY + 'px';
		dom.contextMenu.style.left = e.clientX + 'px';
		dom.contextMenu.classList.add('active');
	}

	document.addEventListener('click', function () {
		dom.contextMenu.classList.remove('active');
	});

	document.getElementById('ctx-edit').addEventListener('click', function () {
		if (ctxType === 'region') editRegion(ctxTarget);
		else if (ctxType === 'site') editSite(ctxTarget);
	});

	document.getElementById('ctx-delete').addEventListener('click', function () {
		if (ctxType === 'region') confirmDeleteRegion(ctxTarget);
		else if (ctxType === 'site') confirmDeleteSite(ctxTarget);
	});

	// ── Edit Region ─────────────────────────────────────────────
	function editRegion(region) {
		document.getElementById('modal-region-title').textContent = 'Edit Wilayah';
		document.getElementById('region-edit-code').value = region.regionCode;
		document.getElementById('region-code').value = region.regionCode;
		document.getElementById('region-code').disabled = true;
		document.getElementById('region-name').value = region.regionName;
		document.getElementById('region-desc').value = region.description || '';
		openModal('region');
	}

	// ── Edit Site ───────────────────────────────────────────────
	function editSite(site) {
		document.getElementById('modal-pos-title').textContent = 'Edit Pos';
		document.getElementById('pos-edit-code').value = site.siteCode;
		document.getElementById('pos-code').value = site.siteCode;
		document.getElementById('pos-code').disabled = true;
		document.getElementById('pos-name').value = site.siteName;
		document.getElementById('pos-blockip').value = site.blockIp || '';
		document.getElementById('pos-desc').value = site.description || '';
		document.getElementById('pos-image').value = '';
		document.getElementById('pos-ip-eyesee').value = getAppInfo(site, 'eyesee') ? getAppInfo(site, 'eyesee').ip : '';
		document.getElementById('pos-port-eyesee').value = getAppInfo(site, 'eyesee') && getAppInfo(site, 'eyesee').port ? getAppInfo(site, 'eyesee').port : '';
		document.getElementById('pos-ip-bms').value = getAppInfo(site, 'bms') ? getAppInfo(site, 'bms').ip : '';
		document.getElementById('pos-port-bms').value = getAppInfo(site, 'bms') && getAppInfo(site, 'bms').port ? getAppInfo(site, 'bms').port : '';
		document.getElementById('pos-ip-blm').value = getAppInfo(site, 'blm') ? getAppInfo(site, 'blm').ip : '';
		document.getElementById('pos-port-blm').value = getAppInfo(site, 'blm') && getAppInfo(site, 'blm').port ? getAppInfo(site, 'blm').port : '';
		document.getElementById('pos-ip-vcom').value = getAppInfo(site, 'vcom') ? getAppInfo(site, 'vcom').ip : '';
		document.getElementById('pos-port-vcom').value = getAppInfo(site, 'vcom') && getAppInfo(site, 'vcom').port ? getAppInfo(site, 'vcom').port : '';
		populateRegionDropdown(site.regionId);
		openModal('pos');
	}

	// ── Delete Confirm ──────────────────────────────────────────
	var pendingDelete = null;

	function confirmDeleteRegion(region) {
		document.getElementById('delete-message').textContent =
			'Apakah Anda yakin ingin menghapus wilayah "' + region.regionName + '"? Site yang terhubung akan dilepas dari wilayah ini.';
		pendingDelete = { type: 'region', code: region.regionCode };
		openModal('delete');
	}

	function confirmDeleteSite(site) {
		document.getElementById('delete-message').textContent =
			'Apakah Anda yakin ingin menghapus pos "' + site.siteName + '" (' + site.siteCode + ')? Semua data IP terkait akan dihapus.';
		pendingDelete = { type: 'site', code: site.siteCode };
		openModal('delete');
	}

	document.getElementById('btn-confirm-delete').addEventListener('click', async function () {
		if (!pendingDelete) return;
		try {
			if (pendingDelete.type === 'region') {
				await window.portal.deleteRegion(pendingDelete.code);
				showToast('Wilayah berhasil dihapus', 'success');
			} else {
				await window.portal.deleteSite(pendingDelete.code);
				showToast('Pos berhasil dihapus', 'success');
			}
			closeModal('delete');
			pendingDelete = null;
			await loadData();
		} catch (e) {
			showToast('Gagal menghapus: ' + (e.message || 'Unknown error'), 'error');
		}
	});

	// ── Render Region List ──────────────────────────────────────
	function renderRegionList() {
		var query = dom.searchRegion.value.toLowerCase().trim();
		dom.regionList.innerHTML = '';

		// "All" option
		var allItem = document.createElement('li');
		allItem.className = 'region-item' + (state.currentRegion === 'ALL' ? ' active' : '');
		allItem.innerHTML = 'Semua Wilayah <span class="region-count">' + state.allSites.length + '</span>';
		allItem.addEventListener('click', function () {
			state.currentRegion = 'ALL';
			renderRegionList();
			renderPosGrid();
		});
		dom.regionList.appendChild(allItem);

		var filtered = state.regions.filter(function (r) {
			if (!query) return true;
			return r.regionName.toLowerCase().indexOf(query) !== -1 ||
				r.regionCode.toLowerCase().indexOf(query) !== -1;
		});

		filtered.forEach(function (region) {
			var count = region.sites ? region.sites.length : 0;
			var li = document.createElement('li');
			li.className = 'region-item' + (state.currentRegion === region.regionCode ? ' active' : '');
			li.innerHTML = escapeHtml(region.regionName) + ' <span class="region-count">' + count + '</span>';

			li.addEventListener('click', function () {
				state.currentRegion = region.regionCode;
				renderRegionList();
				renderPosGrid();
			});

			li.addEventListener('contextmenu', function (e) {
				showContextMenu(e, 'region', region);
			});

			dom.regionList.appendChild(li);
		});

		// Unassigned sites
		var unassigned = state.allSites.filter(function (s) {
			return !s._regionCode;
		});
		if (unassigned.length > 0) {
			var uItem = document.createElement('li');
			uItem.className = 'region-item' + (state.currentRegion === 'NONE' ? ' active' : '');
			uItem.innerHTML = 'Tanpa Wilayah <span class="region-count">' + unassigned.length + '</span>';
			uItem.addEventListener('click', function () {
				state.currentRegion = 'NONE';
				renderRegionList();
				renderPosGrid();
			});
			dom.regionList.appendChild(uItem);
		}
	}

	// ── Get filtered sites ──────────────────────────────────────
	function getFilteredSites() {
		var sites = state.allSites;
		if (state.currentRegion && state.currentRegion !== 'ALL') {
			if (state.currentRegion === 'NONE') {
				sites = sites.filter(function (s) { return !s._regionCode; });
			} else {
				sites = sites.filter(function (s) { return s._regionCode === state.currentRegion; });
			}
		}
		return sites;
	}

	// ── Get app IP for a site ───────────────────────────────────
	function getAppInfo(site, appKey) {
		if (!site.ips) return null;
		for (var i = 0; i < site.ips.length; i++) {
			if (site.ips[i].appKey === appKey) return site.ips[i];
		}
		return null;
	}

	// ── Render Pos Grid ─────────────────────────────────────────
	function renderPosGrid() {
		var sites = getFilteredSites();

		// Update header
		if (state.currentRegion === 'ALL' || !state.currentRegion) {
			dom.contentTitle.innerHTML = 'Semua <span>Pos</span>';
		} else if (state.currentRegion === 'NONE') {
			dom.contentTitle.innerHTML = 'Pos <span>Tanpa Wilayah</span>';
		} else {
			var reg = state.regions.find(function (r) { return r.regionCode === state.currentRegion; });
			dom.contentTitle.innerHTML = (reg ? escapeHtml(reg.regionName) : state.currentRegion) + ' — <span>' + state.currentApp.toUpperCase() + '</span>';
		}
		dom.contentCount.textContent = sites.length + ' site';

		if (sites.length === 0) {
			dom.posGrid.style.display = 'none';
			dom.emptyState.style.display = 'flex';
			return;
		}

		dom.emptyState.style.display = 'none';
		dom.posGrid.style.display = 'grid';
		dom.posGrid.innerHTML = '';

		// Apply manage mode class to grid
		dom.posGrid.classList.remove('edit-mode', 'delete-mode');
		if (state.manageMode === 'edit') dom.posGrid.classList.add('edit-mode');
		else if (state.manageMode === 'delete') dom.posGrid.classList.add('delete-mode');

		// Show manage mode banner in content header
		var existingBanner = document.querySelector('.manage-mode-banner');
		if (existingBanner) existingBanner.remove();

		if (state.manageMode) {
			var banner = document.createElement('div');
			var isEdit = state.manageMode === 'edit';
			banner.className = 'manage-mode-banner ' + (isEdit ? 'edit-banner' : 'delete-banner');
			banner.innerHTML = (isEdit ? '&#9998; Mode Edit — Klik site untuk mengedit' : '&#128465; Mode Hapus — Klik site untuk menghapus') +
				' <button class="btn-done" onclick="exitManageMode()">✓ Selesai</button>';
			var contentHeader = document.querySelector('.content-header');
			contentHeader.parentNode.insertBefore(banner, contentHeader.nextSibling);
		}

		sites.forEach(function (site, idx) {
			var appInfo = getAppInfo(site, state.currentApp);
			var status = state.siteStatuses[site.siteCode];
			
			// If site has an image from API, use the constructed URL, else fallback to random generic pos image
			var img = site.hasImage && site.imageUrl && state.apiOrigin
				? state.apiOrigin + site.imageUrl
				: state.posImages[idx % state.posImages.length];

			var card = document.createElement('div');
			card.className = 'pos-card';
			card.dataset.siteCode = site.siteCode;
			if (status && status.online === false) card.classList.add('offline');

			// Status dot class
			var statusClass = 'checking';
			if (status) statusClass = status.online ? 'online' : 'offline';

			// Split name into lines for display (e.g. "Pos\nBayangan")
			var nameParts = escapeHtml(site.siteName).split(' ');
			var displayName = nameParts.length > 1
				? nameParts[0] + '<br/>' + nameParts.slice(1).join(' ')
				: nameParts[0];

			// Build manage overlay HTML
			var overlayHtml = '';
			if (state.manageMode === 'edit') {
				overlayHtml = '<div class="manage-overlay edit-overlay"><div class="manage-overlay-icon">&#9998;</div></div>';
			} else if (state.manageMode === 'delete') {
				overlayHtml = '<div class="manage-overlay delete-overlay"><div class="manage-overlay-icon">&#128465;</div></div>';
			}

			card.innerHTML =
				'<div class="pos-card-thumb">' +
					'<img src="' + escapeHtml(img) + '" alt="' + escapeHtml(site.siteName) + '" />' +
					'<div class="pos-card-status ' + statusClass + '"></div>' +
				'</div>' +
				overlayHtml +
				'<div class="pos-card-info">' +
					'<div class="pos-card-name">' + displayName + '</div>' +
					(appInfo ? '<div class="pos-card-ip">' + escapeHtml(appInfo.ip) + (appInfo.port ? ':' + escapeHtml(appInfo.port) : '') + '</div>' : '') +
				'</div>';

			// Click behavior depends on manage mode
			card.addEventListener('click', function () {
				if (state.manageMode === 'edit') {
					editSite(site);
					return;
				}
				if (state.manageMode === 'delete') {
					confirmDeleteSite(site);
					return;
				}

				// Normal mode: open app
				var liveStatus = state.siteStatuses[site.siteCode];

				// Block if no IP for this app
				if (!appInfo || !appInfo.ip) {
					showToast('IP tidak tersedia untuk ' + state.currentApp.toUpperCase() + ' di site ini', 'error');
					return;
				}

				// Block if still checking (unknown) or offline
				if (!liveStatus || liveStatus.online === false) {
					var msg = !liveStatus
						? site.siteName + ' masih dicek, harap tunggu...'
						: site.siteName + ' sedang offline';
					showToast(msg, 'error');
					return;
				}

				var port = appInfo.port || 80;
				window.portal.openSiteApp(appInfo.ip, port, site.siteName, state.currentApp.toUpperCase());
				showToast('Membuka ' + state.currentApp.toUpperCase() + ' — ' + site.siteName, 'info');
			});

			// Right-click context menu
			card.addEventListener('contextmenu', function (e) {
				showContextMenu(e, 'site', site);
			});

			dom.posGrid.appendChild(card);
		});

		updateSummary();
	}

	// ── Update Summary ──────────────────────────────────────────
	function updateSummary() {
		var total = state.allSites.length;
		var online = 0;
		var offline = 0;
		state.allSites.forEach(function (s) {
			var st = state.siteStatuses[s.siteCode];
			if (st) {
				if (st.online) online++;
				else offline++;
			}
		});
		// Update footer status text
		if (dom.toolbarStatus) {
			var statusLabel = offline > 0 ? 'Alert' : 'Optimal';
			dom.toolbarStatus.innerHTML = 'System Status: <span class="optimal">' + statusLabel + '</span> &mdash; ' + online + '/' + total + ' Online';
		}
	}

	// ── Status Checking ─────────────────────────────────────────

	// Get the best available IP for a site (currentApp first, then any app)
	// Aligned with bms-exe/src/site-selector.js approach
	function getBestIpForSite(site) {
		if (!site.ips || site.ips.length === 0) return null;
		var preferred = getAppInfo(site, state.currentApp);
		if (preferred && preferred.ip) return preferred;
		for (var i = 0; i < site.ips.length; i++) {
			if (site.ips[i].ip) return site.ips[i];
		}
		return null;
	}

	// Patch card status dots in-place (no full re-render, avoids flicker)
	function updateCardStatuses() {
		var cards = dom.posGrid.querySelectorAll('.pos-card');
		cards.forEach(function (card) {
			var siteCode = card.dataset.siteCode;
			if (!siteCode) return;
			var status = state.siteStatuses[siteCode];
			if (!status) return;
			var dot = card.querySelector('.pos-card-status');
			if (dot) dot.className = 'pos-card-status ' + (status.online ? 'online' : 'offline');
			if (status.online === false) card.classList.add('offline');
			else card.classList.remove('offline');
		});
	}

	async function checkAllStatuses() {
		var promises = state.allSites.map(async function (site) {
			// Use best IP (any app) — a site with no currentApp IP still gets checked
			var ipInfo = getBestIpForSite(site);
			if (!ipInfo || !ipInfo.ip) {
				state.siteStatuses[site.siteCode] = { online: false, responseTime: 0 };
				return;
			}
			var port = ipInfo.port || 80;
			try {
				var result = await window.portal.checkSiteStatus(ipInfo.ip, port);
				state.siteStatuses[site.siteCode] = result;
			} catch (e) {
				state.siteStatuses[site.siteCode] = { online: false, responseTime: null };
			}
		});

		await Promise.all(promises);
		// Update cards in-place first, then full summary
		updateCardStatuses();
		updateSummary();
		if (dom.toolbarStatus) {
			var total = state.allSites.length;
			var online = state.allSites.filter(function(s) {
				return state.siteStatuses[s.siteCode] && state.siteStatuses[s.siteCode].online;
			}).length;
			var offline = total - online;
			var label = offline > 0
				? '<span style="color:#f87171">Alert</span>'
				: '<span class="optimal">Optimal</span>';
			var now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
			dom.toolbarStatus.innerHTML = 'System: ' + label + ' &mdash; ' + online + '/' + total + ' Online &mdash; Cek: ' + now;
		}
	}

	function startStatusPolling() {
		if (state.statusTimer) clearInterval(state.statusTimer);
		checkAllStatuses();
		state.statusTimer = setInterval(checkAllStatuses, 30000); // matches server-config.json statusCheckInterval
	}

	// ── Load Data ───────────────────────────────────────────────
	async function loadData() {
		dom.loadingState.style.display = 'flex';
		dom.posGrid.style.display = 'none';
		dom.emptyState.style.display = 'none';

		try {
			// Fetch regions, sites (with region info), and apiOrigin in parallel
			var results = await Promise.all([
				window.portal.getRegions(),
				window.portal.getSites('includeRegion=true'),
				window.portal.getApiOrigin && window.portal.getApiOrigin()
			]);

			var regionsData = results[0];
			var sitesData = results[1];
			if (results[2]) state.apiOrigin = results[2];

			state.regions = (regionsData && regionsData.data) ? regionsData.data : [];

			var sites = (sitesData && sitesData.data) ? sitesData.data : [];

			// Extrak semua origin (http://ip:port) untuk dikirim ke main process sebagai cache whitelisting WebRTC
			var origins = [];
			sites.forEach(function (s) {
				if (s.ips) {
					s.ips.forEach(function (ipInfo) {
						if (ipInfo.ip) {
							origins.push('http://' + ipInfo.ip + ':' + (ipInfo.port || 80));
						}
					});
				}
			});
			if (origins.length > 0 && window.portal.saveSiteOrigins) {
				window.portal.saveSiteOrigins(origins);
			}

			// Build a regionId->regionCode lookup
			var regionIdMap = {};
			state.regions.forEach(function (r) {
				regionIdMap[r.id] = r.regionCode;
			});

			state.allSites = sites.map(function (s) {
				// API may return region as nested object or regionId
				var rCode = null;
				if (s.region && s.region.regionCode) {
					rCode = s.region.regionCode;
				} else if (s.regionId && regionIdMap[s.regionId]) {
					rCode = regionIdMap[s.regionId];
				} else {
					// Fallback: scan regions.sites array
					state.regions.forEach(function (r) {
						if (r.sites) {
							r.sites.forEach(function (rs) {
								if (rs.siteCode === s.siteCode) rCode = r.regionCode;
							});
						}
					});
				}
				s._regionCode = rCode;
				return s;
			});

			// Default to first region; stay on current if already set
			if (!state.currentRegion) {
				state.currentRegion = 'ALL';
			}

			dom.loadingState.style.display = 'none';
			renderRegionList();
			renderPosGrid();
			startStatusPolling();
			loadGlobalLogo();
		} catch (e) {
			dom.loadingState.style.display = 'none';
			dom.emptyState.style.display = 'flex';
			console.error('Failed to load data:', e);
			showToast('Gagal memuat data: ' + (e.message || 'Network error'), 'error');
		}
	}

	// ── Helpers ──────────────────────────────────────────────────
	function escapeHtml(text) {
		var div = document.createElement('div');
		div.textContent = text || '';
		return div.innerHTML;
	}

	// ── Close context menu on scroll ────────────────────────────
	document.addEventListener('scroll', function () {
		dom.contextMenu.classList.remove('active');
	}, true);

	// ── Global Logo ─────────────────────────────────────────────
	async function loadGlobalLogo() {
		try {
			var info = await window.portal.getGlobalLogoInfo();
			var p = document.getElementById('global-logo-placeholder');
			var img = document.getElementById('global-logo-img');
			if (info.status === 'success' && info.data.hasLogo && state.apiOrigin) {
				p.style.display = 'none';
				img.style.display = 'block';
				img.src = state.apiOrigin + info.data.logoUrl + '?t=' + (info.data.updatedAt || Date.now());
			} else {
				p.style.display = 'flex';
				img.style.display = 'none';
			}
		} catch (e) {
			console.error('Failed to load global logo:', e);
		}
	}

	if (document.getElementById('btn-change-global-logo')) {
		document.getElementById('btn-change-global-logo').addEventListener('click', function () {
			document.getElementById('global-logo-file').value = '';
			openModal('global-logo');
		});

		document.getElementById('btn-save-global-logo').addEventListener('click', async function () {
			var fileInput = document.getElementById('global-logo-file');
			if (fileInput.files.length === 0) {
				showToast('Pilih file logo terlebih dahulu', 'error');
				return;
			}
			try {
				var file = fileInput.files[0];
				var buffer = await file.arrayBuffer();
				var fileObj = { name: file.name, type: file.type, buffer: buffer };
				await window.portal.updateGlobalLogo(fileObj);
				showToast('Logo berhasil diupload', 'success');
				closeModal('global-logo');
				loadGlobalLogo();
			} catch (e) {
				showToast('Gagal upload logo: ' + (e.message || 'Unknown error'), 'error');
			}
		});

		document.getElementById('btn-delete-global-logo').addEventListener('click', async function () {
			try {
				await window.portal.deleteGlobalLogo();
				showToast('Logo berhasil dihapus', 'success');
				closeModal('global-logo');
				loadGlobalLogo();
			} catch (e) {
				showToast('Gagal menghapus logo: ' + (e.message || 'Unknown error'), 'error');
			}
		});
	}

	// ── Initialize & Events ─────────────────────────────────────
	if (document.getElementById('btn-refresh')) {
		document.getElementById('btn-refresh').addEventListener('click', function() {
			loadData();
		});
	}

	if (window.portal.onReloadData) {
		window.portal.onReloadData(function() {
			loadData();
		});
	}

	loadData();

})();
