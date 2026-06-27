// Dashboard JS
document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;
  
  // Set today's date
  document.getElementById('todayDate').textContent = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  // Show/hide users link based on role
  const user = getUser();
  if (user && user.role !== 'admin') {
    const usersLink = document.getElementById('usersNavLink');
    if (usersLink) usersLink.style.display = 'none';
  }

  // Global search redirect
  document.getElementById('globalSearch')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      window.location.href = `/entries.html?search=${encodeURIComponent(e.target.value.trim())}`;
    }
  });

  await Promise.all([
    loadStats(),
    loadRecentEntries(),
    loadDailyChart(),
    loadMaterialChart(),
    loadTransportersChart()
  ]);
});

async function loadStats() {
  try {
    const stats = await apiRequest('/dashboard/stats');
    
    document.getElementById('statToday').textContent = stats.today.count;
    document.getElementById('statTodayWeight').textContent = `Total: ${parseFloat(stats.today.totalWeight).toFixed(2)} Tons`;
    
    document.getElementById('statWeek').textContent = stats.week.count;
    document.getElementById('statWeekWeight').textContent = `Total: ${parseFloat(stats.week.totalWeight).toFixed(2)} Tons`;
    
    document.getElementById('statMonth').textContent = stats.month.count;
    document.getElementById('statMonthWeight').textContent = `Total: ${parseFloat(stats.month.totalWeight).toFixed(2)} Tons`;
    
    const totalWeight = parseFloat(stats.total.totalWeight);
    document.getElementById('statTotalWeight').textContent = totalWeight >= 1000 ? `${(totalWeight/1000).toFixed(1)}K T` : `${totalWeight.toFixed(1)} T`;
    document.getElementById('statTotalTrucks').textContent = `${stats.total.count} total truck entries`;
    
    // Animate counters
    animateCounter('statToday', 0, stats.today.count);
    animateCounter('statWeek', 0, stats.week.count);
    animateCounter('statMonth', 0, stats.month.count);
  } catch (err) {
    console.error('Stats error:', err);
  }
}

function animateCounter(id, from, to) {
  const el = document.getElementById(id);
  if (!el || from === to) return;
  const duration = 800;
  const start = performance.now();
  const update = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(from + (to - from) * eased);
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

async function loadRecentEntries() {
  try {
    const entries = await apiRequest('/dashboard/recent');
    const tbody = document.getElementById('recentTableBody');
    
    if (!entries.length) {
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">🚛</div><p>No entries found</p></div></td></tr>`;
      return;
    }
    
    tbody.innerHTML = entries.map((e, idx) => `
      <tr class="fade-in" style="animation-delay:${idx * 30}ms">
        <td><span style="color:var(--text-muted);font-size:12px;">#${e.id}</span></td>
        <td class="no-wrap">${formatDate(e.date)}</td>
        <td class="truncate" title="${e.transportName}">${e.transportName}</td>
        <td>${e.driverName}</td>
        <td><span class="font-mono" style="font-size:12px;background:var(--bg-tertiary);padding:2px 6px;border-radius:4px;">${e.truckNumber}</span></td>
        <td><span class="badge ${getMaterialBadgeClass(e.materialType)}">${e.materialType}</span></td>
        <td><strong>${formatWeight(e.weight)}</strong></td>
        <td>${e.timeIn}</td>
        <td>
          <div class="table-actions">
            <button class="btn-icon view" title="View Details" onclick="viewEntry(${e.id})">👁️</button>
            <button class="btn-icon edit" title="Edit" onclick="window.location.href='/entries.html?edit=${e.id}'">✏️</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    document.getElementById('recentTableBody').innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--danger);">Failed to load entries</td></tr>`;
  }
}

let dailyChartInstance = null;
let dailyData = [];

async function loadDailyChart() {
  try {
    dailyData = await apiRequest('/dashboard/daily-chart');
    renderDailyChart('count');
    
    document.getElementById('chartViewSelect')?.addEventListener('change', (e) => {
      renderDailyChart(e.target.value);
    });
  } catch (err) {
    console.error('Daily chart error:', err);
  }
}

function renderDailyChart(view) {
  const ctx = document.getElementById('dailyChart');
  if (!ctx) return;
  
  if (dailyChartInstance) dailyChartInstance.destroy();
  
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#64748b' : '#94a3b8';
  
  const labels = dailyData.map(d => {
    const dt = new Date(d.date + 'T00:00:00');
    return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  });
  
  const values = view === 'count' 
    ? dailyData.map(d => d.count)
    : dailyData.map(d => parseFloat(d.totalWeight).toFixed(2));
  
  dailyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: view === 'count' ? 'Trucks' : 'Weight (Tons)',
        data: values,
        backgroundColor: 'rgba(249,115,22,0.15)',
        borderColor: '#f97316',
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false,
        hoverBackgroundColor: 'rgba(249,115,22,0.3)',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? '#1f2937' : '#1e293b',
          padding: 10,
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(249,115,22,0.3)',
          borderWidth: 1,
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y} ${view === 'count' ? 'trucks' : 'tons'}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textColor, font: { size: 11 }, maxTicksLimit: 10 }
        },
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { size: 11 } },
          beginAtZero: true
        }
      }
    }
  });
}

let materialChartInstance = null;

async function loadMaterialChart() {
  try {
    const data = await apiRequest('/dashboard/material-chart');
    const ctx = document.getElementById('materialChart');
    if (!ctx) return;
    
    if (materialChartInstance) materialChartInstance.destroy();
    
    const colors = data.map(d => getMaterialColor(d.materialType));
    
    materialChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.materialType),
        datasets: [{
          data: data.map(d => d.count),
          backgroundColor: colors.map(c => c + '99'),
          borderColor: colors,
          borderWidth: 2,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#94a3b8' : '#64748b',
              font: { size: 11 },
              padding: 10,
              boxWidth: 12,
              boxHeight: 12
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.parsed} trucks`
            }
          }
        }
      }
    });
  } catch (err) {
    console.error('Material chart error:', err);
  }
}

async function loadTransportersChart() {
  try {
    const data = await apiRequest('/dashboard/transport-chart');
    const container = document.getElementById('transportersBody');
    
    if (!data.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>No data this month</p></div>`;
      return;
    }
    
    const maxCount = data[0].count;
    
    container.innerHTML = data.map((t, i) => `
      <div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
          <span style="font-size:13px;font-weight:500;color:var(--text-primary);">${i + 1}. ${t.transportName}</span>
          <span style="font-size:12px;color:var(--text-secondary);">${t.count} trips · ${parseFloat(t.totalWeight).toFixed(1)}T</span>
        </div>
        <div class="progress-bar-wrapper">
          <div class="progress-bar" style="width:${(t.count / maxCount * 100)}%;background:linear-gradient(90deg, ${['#f97316','#3b82f6','#22c55e','#f59e0b','#8b5cf6'][i]}, ${['#ea580c','#1d4ed8','#16a34a','#d97706','#7c3aed'][i]});"></div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Transporters error:', err);
  }
}

// View entry modal
async function viewEntry(id) {
  try {
    const entry = await apiRequest(`/entries/${id}`);
    showToast('info', 'Entry Details', `Truck ${entry.truckNumber} - ${entry.materialType} (${formatWeight(entry.weight)})`);
  } catch (err) {
    showToast('error', 'Error', 'Could not load entry details');
  }
}

// Re-render charts on theme change
const observer = new MutationObserver(() => {
  if (dailyData.length) renderDailyChart(document.getElementById('chartViewSelect')?.value || 'count');
  loadMaterialChart();
});
observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
