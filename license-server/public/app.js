/**
 * EyeSee License Server Admin Panel - JavaScript
 * Handles all API communication and UI interactions
 */

// ============================================================================
// Configuration
// ============================================================================

const API_BASE = window.location.origin;
const ADMIN_TOKEN = 'admin123'; // Change this in production

// Store data
let allGeneratedKeys = [];
let allLicenses = [];
let stats = null;

// ============================================================================
// Initialize
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Load initial data
    refreshAll();

    // Setup form handlers
    document.getElementById('generateForm').addEventListener('submit', handleGenerateKeys);
});

// ============================================================================
// API Functions
// ============================================================================

async function apiCall(method, endpoint, body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ADMIN_TOKEN}`
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ============================================================================
// Data Loading Functions
// ============================================================================

async function loadStats() {
    try {
        const response = await apiCall('GET', '/api/admin/stats');
        stats = response.stats; // Unwrap stats from the response wrapper
        updateStatsUI();
    } catch (error) {
        console.error('Failed to load stats:', error);
        showError('Gagal memuat statistik');
    }
}

async function loadGeneratedKeys() {
    try {
        const response = await apiCall('GET', '/api/admin/generated-keys');
        allGeneratedKeys = response.keys || [];
        displayGeneratedKeys();
    } catch (error) {
        console.error('Failed to load generated keys:', error);
        document.getElementById('generatedKeysTable').innerHTML = 
            '<tr><td colspan="5" class="no-data">Gagal memuat data</td></tr>';
    }
}

async function loadLicenses() {
    try {
        const response = await apiCall('GET', '/api/admin/licenses');
        // API returns camelCase, convert to snake_case for consistency
        allLicenses = (response.licenses || []).map(l => ({
            id: l.id,
            license_key: l.licenseKey,
            hardware_id: l.hardwareId,
            device_name: l.deviceName,
            product_code: l.productCode,
            activated_at: l.activatedAt,
            last_check_at: l.lastCheckAt,
            is_revoked: l.isRevoked,
            revoked_at: l.revokedAt,
            revoked_reason: l.revokedReason
        }));
        displayLicenses();
    } catch (error) {
        console.error('Failed to load licenses:', error);
        document.getElementById('licensesTable').innerHTML = 
            '<tr><td colspan="8" class="no-data">Gagal memuat data</td></tr>';
    }
}

function refreshAll() {
    loadStats();
    loadGeneratedKeys();
    loadLicenses();
}

// ============================================================================
// UI Update Functions
// ============================================================================

function updateStatsUI() {
    if (!stats) return;

    // API returns nested structure: stats.generatedKeys and stats.activatedLicenses
    const keyStats = stats.generatedKeys || {};
    const licenseStats = stats.activatedLicenses || {};

    document.getElementById('totalKeys').textContent = keyStats.total || 0;
    document.getElementById('activeLicenses').textContent = licenseStats.active || 0;
    document.getElementById('revokedLicenses').textContent = licenseStats.revoked || 0;
    document.getElementById('unusedKeys').textContent = keyStats.unused || 0;
}

function displayGeneratedKeys() {
    const tbody = document.getElementById('generatedKeysTable');
    
    if (allGeneratedKeys.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="no-data">Tidak ada data</td></tr>';
        return;
    }

    // Apply filters
    const filtered = filterKeys();
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="no-data">Tidak ada hasil</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(key => `
        <tr>
            <td class="license-key-cell">${key.license_key}</td>
            <td>
                <span class="badge badge-gray">${key.product_code}</span>
            </td>
            <td>
                ${key.is_used 
                    ? '<span class="badge badge-success">Used</span>' 
                    : '<span class="badge badge-warning">Unused</span>'}
            </td>
            <td class="text-small text-muted">
                ${formatDate(key.generated_at)}
            </td>
            <td>
                <button class="btn-secondary btn-sm" onclick="copyToClipboard('${key.license_key}')">
                    Copy
                </button>
            </td>
        </tr>
    `).join('');
}

function displayLicenses() {
    const tbody = document.getElementById('licensesTable');
    
    if (allLicenses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="no-data">Tidak ada lisensi aktif</td></tr>';
        return;
    }

    // Apply filters
    const filtered = filterLicenseList();
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="no-data">Tidak ada hasil</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(license => `
        <tr>
            <td class="hardware-id-cell">${license.hardware_id.substring(0, 35)}</td>
            <td>${license.device_name || '-'}</td>
            <td>
                <span class="badge badge-gray">${license.product_code}</span>
            </td>
            <td class="license-key-cell">${license.license_key}</td>
            <td class="text-small text-muted">
                ${formatDate(license.activated_at)}
            </td>
            <td class="text-small text-muted">
                ${formatDate(license.last_check_at)}
            </td>
            <td>
                ${license.is_revoked 
                    ? '<span class="badge badge-danger">Revoked</span>' 
                    : '<span class="badge badge-success">Active</span>'}
            </td>
            <td>
                <div class="action-buttons">
                    ${license.is_revoked 
                        ? `<button class="btn-success btn-sm" onclick="reactivateLicense('${license.hardware_id}')">Reactivate</button>`
                        : `<button class="btn-danger btn-sm" onclick="revokeLicense('${license.hardware_id}')">Revoke</button>`
                    }
                    <button class="btn-secondary btn-sm" onclick="deleteLicense('${license.hardware_id}')" style="margin-left: 5px;">🗑️ Delete</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ============================================================================
// Filter Functions
// ============================================================================

function filterKeys() {
    const productFilter = document.getElementById('filterProduct').value;
    const searchTerm = document.getElementById('searchKey').value.toLowerCase();

    return allGeneratedKeys.filter(key => {
        const matchProduct = !productFilter || key.product_code === productFilter;
        const matchSearch = !searchTerm || key.license_key.toLowerCase().includes(searchTerm);
        return matchProduct && matchSearch;
    });
}

function filterLicenseList() {
    const productFilter = document.getElementById('filterLicenseProduct').value;
    const statusFilter = document.getElementById('filterStatus').value;

    return allLicenses.filter(license => {
        const matchProduct = !productFilter || license.product_code === productFilter;
        const matchStatus = !statusFilter || 
            (statusFilter === 'active' && !license.is_revoked) ||
            (statusFilter === 'revoked' && license.is_revoked);
        return matchProduct && matchStatus;
    });
}

function filterGeneratedKeys() {
    displayGeneratedKeys();
}

function filterLicenses() {
    displayLicenses();
}

// ============================================================================
// Form Handlers
// ============================================================================

async function handleGenerateKeys(e) {
    e.preventDefault();

    const productCode = document.getElementById('productCode').value;
    const quantity = parseInt(document.getElementById('quantity').value);
    const resultDiv = document.getElementById('generateResult');

    if (!productCode || quantity < 1) {
        alert('Harap isi semua field dengan benar');
        return;
    }

    try {
        // Disable button
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Generating...';

        const response = await apiCall('POST', '/api/admin/generate-keys', {
            productCode,
            quantity
        });

        // Show result
        // API returns array of objects: {key: "XXXX-XXXX-XXXX-XXXX", productCode: "BM01", productName: "BMS"}
        const keyStrings = response.keys.map(k => k.key); // Extract just the key strings
        
        resultDiv.innerHTML = `
            <h4 style="margin-bottom: 1rem; color: var(--success-700);">
                ✅ Berhasil generate ${response.keys.length} license keys
            </h4>
            ${keyStrings.map(key => `
                <div class="key-item">${key}</div>
            `).join('')}
            <button class="btn-secondary btn-sm mt-2" onclick="copyAllGeneratedKeys(${JSON.stringify(keyStrings).replace(/"/g, '&quot;')})">
                Copy All
            </button>
        `;
        resultDiv.classList.remove('hidden');

        // Reset form
        e.target.reset();

        // Refresh data
        setTimeout(() => {
            refreshAll();
        }, 500);

    } catch (error) {
        alert('Gagal generate keys: ' + error.message);
    } finally {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Generate Keys';
    }
}

// ============================================================================
// License Actions
// ============================================================================

async function revokeLicense(hardwareId) {
    const reason = prompt('Alasan revoke (opsional):') || 'Revoked by admin';
    
    if (!confirm('Yakin ingin revoke lisensi ini?')) return;

    try {
        await apiCall('POST', '/api/admin/revoke', {
            hardwareId,
            reason
        });
        
        alert('Lisensi berhasil di-revoke');
        refreshAll();
    } catch (error) {
        alert('Gagal revoke lisensi: ' + error.message);
    }
}

async function reactivateLicense(hardwareId) {
    if (!confirm('Yakin ingin reactivate lisensi ini?')) return;

    try {
        await apiCall('POST', '/api/admin/reactivate', {
            hardwareId
        });
        
        alert('Lisensi berhasil di-reactivate');
        refreshAll();
    } catch (error) {
        alert('Gagal reactivate lisensi: ' + error.message);
    }
}

async function deleteLicense(hardwareId) {
    // Find and confirm the specific license
    const license = allLicenses.find(l => l.hardware_id === hardwareId);
    if (!license) {
        alert('License not found!');
        return;
    }

    if (!confirm(`⚠️ HAPUS LICENSE?\n\nHardware ID: ${hardwareId.substring(0, 30)}...\nProduct: ${license.product_code}\nKey: ${license.license_key}\n\nYakin?`)) return;
    if (!confirm('Konfirmasi: Data tidak dapat dikembalikan!')) return;

    // Disable all delete buttons
    document.querySelectorAll('.btn-secondary').forEach(btn => btn.disabled = true);

    try {
        await apiCall('DELETE', `/api/admin/licenses/${encodeURIComponent(hardwareId)}`);
        alert(`✓ License dihapus!\n${hardwareId.substring(0, 20)}...`);
        refreshAll();
    } catch (error) {
        alert('Gagal menghapus: ' + error.message);
        document.querySelectorAll('.btn-secondary').forEach(btn => btn.disabled = false);
    }
}


// ============================================================================
// Utility Functions
// ============================================================================

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Visual feedback
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied';
        btn.style.background = 'var(--success-500)';
        btn.style.color = 'white';
        
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
            btn.style.color = '';
        }, 1500);
    }).catch(err => {
        alert('Gagal copy: ' + err.message);
    });
}

function copyAllGeneratedKeys(keys) {
    const text = keys.join('\n');
    copyToClipboard(text);
}

function showError(message) {
    alert('Error: ' + message);
}

// ============================================================================
// Modal Functions
// ============================================================================

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}
