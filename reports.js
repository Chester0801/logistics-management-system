// Reports JS
let currentTab = 'daily';
let reportChartInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;
  
  const user = getUser();
  if (user && user.role !== 'admin') {
    const usersLink = document.getElementById('usersNavLink');
    if (usersLink) usersLink.style.display = 'none';
  }

  // Set defaults
  const today = new Date();
  document.getElementById('dailyDate').value = today.toISOString().split('T')[0];
  
  // Week start (Sunday)
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  document.getElementById('weeklyStart').value = weekStart.toISOString().split('T')[0];
  
  // Year selector
  const yearSelect = document.getElementById('monthlyYear');
  for (let y = today.getFullYear(); y >= today.getFullYear() - 5; y--) {
    yearSelect.innerHTML += `<option value="${y}" ${y === today.getFullYear() ? 'selected' : ''}>${y}</option>`;
  }
  document.getElementById('monthlyMonth').value = today.getMonth() + 1;
  
  // Auto-load daily
  await loadDailyReport();
});

function switchTab(tab) {
  currentTab = tab;
  ['daily', 'weekly', 'monthly'].forEach(t => {
    document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}`).classList.toggle('active', t === tab);
    document.getElementById(`panel${t.charAt(0).toUpperCase() + t.slice(1)}`).classList.toggle('hidden', t !== tab);
  });
}

function renderReportSummary(summary, title) {
  return `
    <div class="report-summary-grid">
      <div class="summary-card">
        <div class="s-value" style="color:var(--primary);">${summary.truckCount}</div>
        <div class="s-label">Total Trucks</div>
      </div>
      <div class="summary-card">
        <div class="s-value" style="color:var(--accent);">${parseFloat(summary.totalWeight).toFixed(2)}</div>
        <div class="s-label">Total Weight (Tons)</div>
      </div>
      <div class="summary-card">
        <div class="s-value" style="color:var(--success);">${summary.truckCount > 0 ? (parseFloat(summary.totalWeight) / summary.truckCount).toFixed(2) : '0.00'}</div>
        <div class="s-label">Avg Weight/Truck (T)</div>
      </div>
    </div>
  `;
}

function renderMaterialTable(materialSummary) {
  if (!materialSummary.length) return '<div class="empty-state"><div class="empty-icon">📦</div><p>No material data</p></div>';
  const total = materialSummary.reduce((s, m) => s + m.count, 0);
  return `
    <table class="report-material-table">
      <thead>
        <tr><th>Material</th><th>Trucks</th><th>% Share</th><th>Total Weight (T)</th><th>Avg Weight (T)</th></tr>
      </thead>
      <tbody>
        ${materialSummary.map(m => `
          <tr>
            <td><span class="badge ${getMaterialBadgeClass(m.materialType)}">${m.materialType}</span></td>
            <td><strong>${m.count}</strong></td>
            <td>
              <div style="display:flex;align-items:center;gap:8px;">
                <div class="progress-bar-wrapper" style="width:60px;flex-shrink:0;">
                  <div class="progress-bar" style="width:${(m.count/total*100).toFixed(0)}%;background:${getMaterialColor(m.materialType)};"></div>
                </div>
                ${(m.count/total*100).toFixed(1)}%
              </div>
            </td>
            <td>${parseFloat(m.totalWeight).toFixed(2)}</td>
            <td>${(parseFloat(m.totalWeight)/m.count).toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderTransportTable(transportSummary) {
  if (!transportSummary.length) return '<p style="color:var(--text-muted);font-size:13px;">No data</p>';
  return `
    <table class="report-material-table">
      <thead>
        <tr><th>Transport Name</th><th>Trucks</th><th>Total Weight (T)</th></tr>
      </thead>
      <tbody>
        ${transportSummary.map(t => `
          <tr>
            <td>${t.transportName}</td>
            <td><strong>${t.count}</strong></td>
            <td>${parseFloat(t.totalWeight).toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderEntriesTable(entries) {
  if (!entries.length) return '<div class="empty-state"><div class="empty-icon">🚛</div><p>No entries</p></div>';
  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr><th>#</th><th>Transport</th><th>Driver</th><th>Truck No.</th><th>Material</th><th>Weight (T)</th><th>Time In</th><th>Time Out</th><th>Remarks</th></tr>
        </thead>
        <tbody>
          ${entries.map(e => `
            <tr>
              <td style="color:var(--text-muted);font-size:11px;">#${e.id}</td>
              <td>${e.transportName}</td>
              <td>${e.driverName}</td>
              <td><span class="font-mono" style="font-size:12px;background:var(--bg-tertiary);padding:2px 6px;border-radius:4px;">${e.truckNumber}</span></td>
              <td><span class="badge ${getMaterialBadgeClass(e.materialType)}">${e.materialType}</span></td>
              <td><strong>${formatWeight(e.weight)}</strong></td>
              <td>${e.timeIn}</td>
              <td>${e.timeOut || '—'}</td>
              <td style="color:var(--text-muted);">${e.remarks || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderDailyBreakdownChart(data, containerId) {
  const canvas = document.getElementById(containerId);
  if (!canvas || !data.length) return;
  
  if (reportChartInstance) reportChartInstance.destroy();
  
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#64748b' : '#94a3b8';
  
  reportChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.map(d => {
        const dt = new Date(d.date + 'T00:00:00');
        return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      }),
      datasets: [
        {
          label: 'Trucks',
          data: data.map(d => d.count),
          backgroundColor: 'rgba(249,115,22,0.8)',
          borderRadius: 4,
          yAxisID: 'y'
        },
        {
          label: 'Weight (T)',
          data: data.map(d => parseFloat(d.totalWeight).toFixed(2)),
          type: 'line',
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.1)',
          borderWidth: 2,
          pointRadius: 3,
          fill: true,
          tension: 0.4,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: textColor, font: { size: 11 } }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: textColor, font: { size: 11 } } },
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { size: 11 } },
          beginAtZero: true,
          title: { display: true, text: 'Trucks', color: textColor }
        },
        y1: {
          position: 'right',
          grid: { display: false },
          ticks: { color: '#3b82f6', font: { size: 11 } },
          beginAtZero: true,
          title: { display: true, text: 'Weight (T)', color: '#3b82f6' }
        }
      }
    }
  });
}

async function loadDailyReport() {
  const date = document.getElementById('dailyDate').value;
  const container = document.getElementById('dailyReportContent');
  container.innerHTML = `<div style="text-align:center;padding:40px;"><div class="spinner" style="margin:0 auto;"></div></div>`;
  
  try {
    const data = await apiRequest(`/reports/daily?date=${date}`);
    
    container.innerHTML = `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <span class="card-title">📅 Daily Report — ${formatDate(data.date)}</span>
        </div>
        <div class="card-body">
          ${renderReportSummary(data.summary, 'Daily')}
        </div>
      </div>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
        <div class="card">
          <div class="card-header"><span class="card-title">📦 Material-wise Summary</span></div>
          <div class="card-body" style="padding:0;">
            ${renderMaterialTable(data.materialSummary)}
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">🚛 Transport-wise Summary</span></div>
          <div class="card-body" style="padding:0;">
            ${renderTransportTable(data.transportSummary)}
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-header">
          <span class="card-title">📋 All Entries for ${formatDate(data.date)}</span>
          <span class="badge badge-primary">${data.entries.length} entries</span>
        </div>
        <div class="card-body" style="padding:0;">
          ${renderEntriesTable(data.entries)}
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="card"><div class="card-body"><div class="empty-state"><div class="empty-icon">❌</div><p>Failed to generate report: ${err.message}</p></div></div></div>`;
  }
}

async function loadWeeklyReport() {
  const weekStart = document.getElementById('weeklyStart').value;
  const container = document.getElementById('weeklyReportContent');
  container.innerHTML = `<div style="text-align:center;padding:40px;"><div class="spinner" style="margin:0 auto;"></div></div>`;
  
  try {
    const data = await apiRequest(`/reports/weekly?weekStart=${weekStart}`);
    
    container.innerHTML = `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <span class="card-title">📆 Weekly Report — ${formatDate(data.startDate)} to ${formatDate(data.endDate)}</span>
        </div>
        <div class="card-body">
          ${renderReportSummary(data.summary, 'Weekly')}
          ${data.dailyBreakdown.length > 0 ? `
            <div style="margin-top:16px;">
              <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">Day-wise Breakdown</div>
              <div class="chart-container" style="height:200px;"><canvas id="weeklyChart"></canvas></div>
            </div>
          ` : ''}
        </div>
      </div>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
        <div class="card">
          <div class="card-header"><span class="card-title">📦 Material-wise Summary</span></div>
          <div class="card-body" style="padding:0;">${renderMaterialTable(data.materialSummary)}</div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">🚛 Transport-wise Summary</span></div>
          <div class="card-body" style="padding:0;">${renderTransportTable(data.transportSummary)}</div>
        </div>
      </div>
    `;
    
    renderDailyBreakdownChart(data.dailyBreakdown, 'weeklyChart');
  } catch (err) {
    container.innerHTML = `<div class="card"><div class="card-body"><div class="empty-state"><div class="empty-icon">❌</div><p>${err.message}</p></div></div></div>`;
  }
}

async function loadMonthlyReport() {
  const year = document.getElementById('monthlyYear').value;
  const month = document.getElementById('monthlyMonth').value;
  const container = document.getElementById('monthlyReportContent');
  container.innerHTML = `<div style="text-align:center;padding:40px;"><div class="spinner" style="margin:0 auto;"></div></div>`;
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  try {
    const data = await apiRequest(`/reports/monthly?year=${year}&month=${month}`);
    
    container.innerHTML = `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <span class="card-title">🗓️ Monthly Report — ${monthNames[parseInt(month) - 1]} ${year}</span>
        </div>
        <div class="card-body">
          ${renderReportSummary(data.summary, 'Monthly')}
          ${data.dailyBreakdown.length > 0 ? `
            <div style="margin-top:16px;">
              <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">Daily Activity</div>
              <div class="chart-container" style="height:220px;"><canvas id="monthlyChart"></canvas></div>
            </div>
          ` : ''}
        </div>
      </div>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
        <div class="card">
          <div class="card-header"><span class="card-title">📦 Material-wise Summary</span></div>
          <div class="card-body" style="padding:0;">${renderMaterialTable(data.materialSummary)}</div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">🚛 Transport-wise Summary</span></div>
          <div class="card-body" style="padding:0;">${renderTransportTable(data.transportSummary)}</div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-header">
          <span class="card-title">📋 Day-wise Breakdown</span>
          <span class="badge badge-primary">${data.dailyBreakdown.length} active days</span>
        </div>
        <div class="card-body" style="padding:0;">
          <table class="report-material-table">
            <thead><tr><th>Date</th><th>Truck Count</th><th>Total Weight (T)</th><th>Avg Weight (T)</th></tr></thead>
            <tbody>
              ${data.dailyBreakdown.map(d => `
                <tr>
                  <td>${formatDate(d.date)}</td>
                  <td><strong>${d.count}</strong></td>
                  <td>${parseFloat(d.totalWeight).toFixed(2)}</td>
                  <td>${(parseFloat(d.totalWeight)/d.count).toFixed(2)}</td>
                </tr>
              `).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">No data</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    renderDailyBreakdownChart(data.dailyBreakdown, 'monthlyChart');
  } catch (err) {
    container.innerHTML = `<div class="card"><div class="card-body"><div class="empty-state"><div class="empty-icon">❌</div><p>${err.message}</p></div></div></div>`;
  }
}
