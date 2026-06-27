// Entries JS
let currentPage = 1;
let currentLimit = 20;
let currentFilters = {};
let currentTotal = 0;
let editingId = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;
  
  const user = getUser();
  if (user && user.role !== 'admin') {
    const usersLink = document.getElementById('usersNavLink');
    if (usersLink) usersLink.style.display = 'none';
  }
  
  // Set default date to today
  document.getElementById('fieldDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('fieldTimeIn').value = new Date().toTimeString().slice(0, 5);
  
  // Check URL params
  const urlParams = new URLSearchParams(window.location.search);
  const searchParam = urlParams.get('search');
  const editParam = urlParams.get('edit');
  const newParam = urlParams.get('new');
  
  if (searchParam) {
    document.getElementById('filterSearch').value = searchParam;
    currentFilters.search = searchParam;
  }
  
  // Load transport names for autocomplete
  loadTransportNames();
  
  // Load entries
  await loadEntries();
  
  if (editParam) openEntryModal(parseInt(editParam));
  if (newParam === '1') openEntryModal();

  // Event listeners
  document.getElementById('addEntryBtn').addEventListener('click', () => openEntryModal());
  document.getElementById('saveEntryBtn').addEventListener('click', saveEntry);
  document.getElementById('applyFilterBtn').addEventListener('click', applyFilters);
  document.getElementById('clearFiltersBtn').addEventListener('click', clearFilters);
  document.getElementById('pageLimitSelect').addEventListener('change', (e) => {
    currentLimit = parseInt(e.target.value);
    currentPage = 1;
    loadEntries();
  });
  
  document.getElementById('globalSearch').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      document.getElementById('filterSearch').value = e.target.value.trim();
      applyFilters();
    }
  });
  
  // Enter to search
  document.getElementById('filterSearch').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyFilters();
  });
  
  // Truck number uppercase
  document.getElementById('fieldTruckNo').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });
  
  // Close modal on overlay click
  document.getElementById('entryModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('entryModal')) closeEntryModal();
  });
});

async function loadTransportNames() {
  try {
    const names = await apiRequest('/transport-names');
    const datalist = document.getElementById('transportList');
    if (datalist) {
      datalist.innerHTML = names.map(n => `<option value="${n}">`).join('');
    }
  } catch (err) {}
}

async function loadEntries() {
  const tbody = document.getElementById('entriesTableBody');
  tbody.innerHTML = `<tr class="loading-row"><td colspan="11"><div style="display:flex;align-items:center;gap:10px;justify-content:center;"><div class="spinner"></div> Loading...</div></td></tr>`;
  
  try {
    const params = new URLSearchParams({
      page: currentPage,
      limit: currentLimit,
      ...Object.fromEntries(Object.entries(currentFilters).filter(([, v]) => v))
    });
    
    const data = await apiRequest(`/entries?${params}`);
    currentTotal = data.total;
    
    document.getElementById('totalBadge').textContent = `${data.total} entries`;
    
    if (!data.entries.length) {
      tbody.innerHTML = `<tr><td colspan="11"><div class="empty-state"><div class="empty-icon">🚛</div><p>No entries found matching your filters</p><button class="btn btn-secondary btn-sm" onclick="clearFilters()" style="margin-top:8px;">Clear Filters</button></div></td></tr>`;
      renderPagination(data);
      return;
    }
    
    tbody.innerHTML = data.entries.map((e, idx) => `
      <tr class="fade-in" style="animation-delay:${idx * 15}ms">
        <td><span style="color:var(--text-muted);font-size:11px;">#${e.id}</span></td>
        <td class="no-wrap">${formatDate(e.date)}</td>
        <td class="truncate" title="${e.transportName}">${e.transportName}</td>
        <td>${e.driverName}</td>
        <td>
          <span class="font-mono" style="font-size:12px;background:var(--bg-tertiary);padding:2px 6px;border-radius:4px;white-space:nowrap;">
            ${e.truckNumber}
          </span>
        </td>
        <td><span class="badge ${getMaterialBadgeClass(e.materialType)}">${e.materialType}</span></td>
        <td><strong>${formatWeight(e.weight)}</strong></td>
        <td>${e.timeIn}</td>
        <td>${e.timeOut || '<span style="color:var(--text-muted);">—</span>'}</td>
        <td class="truncate" title="${e.remarks || ''}" style="max-width:120px;">${e.remarks || '<span style="color:var(--text-muted);">—</span>'}</td>
        <td>
          <div class="table-actions">
            <button class="btn-icon view" title="View Details" onclick="viewEntry(${e.id})">👁️</button>
            <button class="btn-icon edit" title="Edit" onclick="openEntryModal(${e.id})">✏️</button>
            <button class="btn-icon delete" title="Delete" onclick="deleteEntry(${e.id}, '${e.truckNumber}')">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
    
    renderPagination(data);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:30px;color:var(--danger);">Failed to load entries: ${err.message}</td></tr>`;
  }
}

function renderPagination(data) {
  const info = document.getElementById('paginationInfo');
  const controls = document.getElementById('paginationControls');
  
  const start = (data.page - 1) * data.limit + 1;
  const end = Math.min(data.page * data.limit, data.total);
  info.textContent = data.total > 0 ? `Showing ${start}–${end} of ${data.total} entries` : '';
  
  if (data.totalPages <= 1) { controls.innerHTML = ''; return; }
  
  let html = `<button class="page-btn" onclick="goToPage(${data.page - 1})" ${data.page === 1 ? 'disabled' : ''}>‹</button>`;
  
  const pages = getPageNumbers(data.page, data.totalPages);
  pages.forEach(p => {
    if (p === '...') {
      html += `<span style="padding:0 4px;color:var(--text-muted);">…</span>`;
    } else {
      html += `<button class="page-btn ${p === data.page ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>`;
    }
  });
  
  html += `<button class="page-btn" onclick="goToPage(${data.page + 1})" ${data.page === data.totalPages ? 'disabled' : ''}>›</button>`;
  controls.innerHTML = html;
}

function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({length: total}, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
  if (current >= total - 3) return [1, '...', total-4, total-3, total-2, total-1, total];
  return [1, '...', current-1, current, current+1, '...', total];
}

function goToPage(page) {
  currentPage = page;
  loadEntries();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function applyFilters() {
  currentFilters = {
    search: document.getElementById('filterSearch').value.trim(),
    transportName: document.getElementById('filterTransport').value.trim(),
    driverName: document.getElementById('filterDriver').value.trim(),
    truckNumber: document.getElementById('filterTruck').value.trim(),
    materialType: document.getElementById('filterMaterial').value,
    dateFrom: document.getElementById('filterDateFrom').value,
    dateTo: document.getElementById('filterDateTo').value,
  };
  currentPage = 1;
  loadEntries();
}

function clearFilters() {
  document.getElementById('filterSearch').value = '';
  document.getElementById('filterTransport').value = '';
  document.getElementById('filterDriver').value = '';
  document.getElementById('filterTruck').value = '';
  document.getElementById('filterMaterial').value = '';
  document.getElementById('filterDateFrom').value = '';
  document.getElementById('filterDateTo').value = '';
  currentFilters = {};
  currentPage = 1;
  loadEntries();
}

async function openEntryModal(id = null) {
  editingId = id;
  const modal = document.getElementById('entryModal');
  const title = document.getElementById('modalTitle');
  const form = document.getElementById('entryForm');
  const errorDiv = document.getElementById('formError');
  
  errorDiv.style.display = 'none';
  form.reset();
  document.getElementById('entryId').value = '';
  
  // Defaults
  document.getElementById('fieldDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('fieldTimeIn').value = new Date().toTimeString().slice(0, 5);
  
  if (id) {
    title.textContent = '✏️ Edit Truck Entry';
    document.getElementById('saveEntryBtn').textContent = '💾 Update Entry';
    try {
      const entry = await apiRequest(`/entries/${id}`);
      document.getElementById('entryId').value = entry.id;
      document.getElementById('fieldTransport').value = entry.transportName;
      document.getElementById('fieldDriver').value = entry.driverName;
      document.getElementById('fieldTruckNo').value = entry.truckNumber;
      document.getElementById('fieldMaterial').value = entry.materialType;
      document.getElementById('fieldWeight').value = entry.weight;
      document.getElementById('fieldDate').value = entry.date;
      document.getElementById('fieldTimeIn').value = entry.timeIn;
      document.getElementById('fieldTimeOut').value = entry.timeOut || '';
      document.getElementById('fieldRemarks').value = entry.remarks || '';
    } catch (err) {
      showToast('error', 'Error', 'Could not load entry details');
      return;
    }
  } else {
    title.textContent = '🚛 Add Truck Entry';
    document.getElementById('saveEntryBtn').textContent = '💾 Save Entry';
  }
  
  modal.classList.add('open');
  setTimeout(() => document.getElementById('fieldTransport').focus(), 100);
}

function closeEntryModal() {
  document.getElementById('entryModal').classList.remove('open');
  editingId = null;
}

async function saveEntry() {
  const btn = document.getElementById('saveEntryBtn');
  const errorDiv = document.getElementById('formError');
  errorDiv.style.display = 'none';
  
  const data = {
    transportName: document.getElementById('fieldTransport').value.trim(),
    driverName: document.getElementById('fieldDriver').value.trim(),
    truckNumber: document.getElementById('fieldTruckNo').value.trim().toUpperCase(),
    materialType: document.getElementById('fieldMaterial').value,
    weight: parseFloat(document.getElementById('fieldWeight').value),
    date: document.getElementById('fieldDate').value,
    timeIn: document.getElementById('fieldTimeIn').value,
    timeOut: document.getElementById('fieldTimeOut').value || null,
    remarks: document.getElementById('fieldRemarks').value.trim() || null,
  };
  
  // Validate
  const errors = [];
  if (!data.transportName) errors.push('Transport Name is required');
  if (!data.driverName) errors.push('Driver Name is required');
  if (!data.truckNumber) errors.push('Truck Number is required');
  if (!data.materialType) errors.push('Material Type is required');
  if (!data.weight || isNaN(data.weight) || data.weight <= 0) errors.push('Valid weight is required');
  if (!data.date) errors.push('Date is required');
  if (!data.timeIn) errors.push('Time In is required');
  
  if (errors.length) {
    errorDiv.innerHTML = '⚠️ ' + errors.join(', ');
    errorDiv.style.display = 'block';
    return;
  }
  
  btn.disabled = true;
  btn.textContent = '⏳ Saving...';
  
  try {
    if (editingId) {
      await apiRequest(`/entries/${editingId}`, { method: 'PUT', body: data });
      showToast('success', 'Entry Updated', `Truck ${data.truckNumber} updated successfully`);
    } else {
      await apiRequest('/entries', { method: 'POST', body: data });
      showToast('success', 'Entry Added', `Truck ${data.truckNumber} recorded successfully`);
      loadTransportNames(); // Refresh autocomplete
    }
    
    closeEntryModal();
    await loadEntries();
  } catch (err) {
    errorDiv.innerHTML = '⚠️ ' + (err.message || 'Failed to save entry');
    errorDiv.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = editingId ? '💾 Update Entry' : '💾 Save Entry';
  }
}

async function viewEntry(id) {
  try {
    const e = await apiRequest(`/entries/${id}`);
    const modal = document.getElementById('viewModal');
    const body = document.getElementById('viewModalBody');
    
    body.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div>
          <div style="margin-bottom:12px;">
            <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Transport Name</div>
            <div style="font-size:15px;font-weight:600;color:var(--text-primary);">${e.transportName}</div>
          </div>
          <div style="margin-bottom:12px;">
            <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Driver Name</div>
            <div style="font-size:15px;color:var(--text-primary);">${e.driverName}</div>
          </div>
          <div style="margin-bottom:12px;">
            <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Truck Number</div>
            <div style="font-family:monospace;font-size:16px;font-weight:700;color:var(--primary);background:var(--bg-tertiary);padding:4px 10px;border-radius:6px;display:inline-block;">${e.truckNumber}</div>
          </div>
          <div style="margin-bottom:12px;">
            <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Material Type</div>
            <span class="badge ${getMaterialBadgeClass(e.materialType)}" style="font-size:13px;padding:4px 10px;">${e.materialType}</span>
          </div>
        </div>
        <div>
          <div style="margin-bottom:12px;">
            <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Weight</div>
            <div style="font-size:22px;font-weight:700;color:var(--text-primary);">${formatWeight(e.weight)}</div>
          </div>
          <div style="margin-bottom:12px;">
            <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Date</div>
            <div style="font-size:15px;color:var(--text-primary);">${formatDate(e.date)}</div>
          </div>
          <div style="margin-bottom:12px;">
            <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Time In / Time Out</div>
            <div style="font-size:15px;color:var(--text-primary);">${e.timeIn} → ${e.timeOut || 'Not recorded'}</div>
          </div>
          <div style="margin-bottom:12px;">
            <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Entry ID</div>
            <div style="font-size:13px;color:var(--text-muted);">#${e.id}</div>
          </div>
        </div>
      </div>
      ${e.remarks ? `
        <div style="margin-top:8px;padding:12px;background:var(--bg-tertiary);border-radius:8px;border-left:3px solid var(--primary);">
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;">Remarks</div>
          <div style="font-size:14px;color:var(--text-primary);">${e.remarks}</div>
        </div>
      ` : ''}
      <div style="margin-top:12px;font-size:11px;color:var(--text-muted);">Created: ${formatDateTime(e.createdAt)}</div>
    `;
    
    document.getElementById('viewEditBtn').onclick = () => {
      modal.classList.remove('open');
      openEntryModal(id);
    };
    
    modal.classList.add('open');
    modal.onclick = (ev) => { if (ev.target === modal) modal.classList.remove('open'); };
  } catch (err) {
    showToast('error', 'Error', 'Could not load entry details');
  }
}

function deleteEntry(id, truckNo) {
  showConfirm(
    'Delete Entry',
    `Are you sure you want to delete the entry for truck ${truckNo}? This action cannot be undone.`,
    async () => {
      try {
        await apiRequest(`/entries/${id}`, { method: 'DELETE' });
        showToast('success', 'Entry Deleted', `Truck entry #${id} has been removed`);
        await loadEntries();
      } catch (err) {
        showToast('error', 'Delete Failed', err.message);
      }
    }
  );
}
