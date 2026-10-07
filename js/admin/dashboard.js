import { mountAdmin, adminApi, skeletonRows, tableState } from './core.js';
import { revenueChart, statusBars } from './charts.js';
import { icon } from '../icons.js';
import { esc, formatPrice, formatDate, cdn } from '../utils.js';
import { statusBadge, errorState } from '../components.js';

const stat = (iconName, label, value, hint = '', tone = '') => `
  <article class="stat ${tone}"><span class="stat__icon">${icon(iconName, 22)}</span><div><p>${label}</p><strong>${value}</strong>${hint ? `<small>${hint}</small>` : ''}</div></article>`;

(async () => {
  const el = await mountAdmin({ active: 'dashboard', title: 'Dashboard' });
  el.innerHTML = `<div class="stats">${'<div class="skeleton" style="height:96px;border-radius:18px"></div>'.repeat(8)}</div><div class="skeleton" style="height:360px;border-radius:20px;margin-top:1.4rem"></div>`;

  const load = async () => {
    try {
      const d = await adminApi('/admin/stats');
      const s = d.statusCounts;
      el.innerHTML = `
        <section class="stats" aria-label="Key numbers">
          ${stat('users', 'Total users', d.totalUsers.toLocaleString(), d.blockedUsers ? `${d.blockedUsers} blocked` : 'None blocked')}
          ${stat('package', 'Products', d.totalProducts.toLocaleString())}
          ${stat('receipt', 'Total orders', d.totalOrders.toLocaleString())}
          ${stat('trend', 'Revenue', formatPrice(d.revenue), 'Excludes cancelled', 'stat--accent')}
          ${stat('clock', 'Pending', s.Pending, 'Need a call', 'stat--warn')}
          ${stat('refresh', 'Processing', s.Processing)}
          ${stat('truck', 'Shipped', s.Shipped)}
          ${stat('check', 'Delivered', s.Delivered, '', 'stat--ok')}
        </section>
        <section class="adm-grid">
          <article class="card-box"><header><h2>Revenue, last 14 days</h2><span class="muted">${formatPrice(d.daily.reduce((n, x) => n + x.revenue, 0))} in total</span></header>${revenueChart(d.daily)}</article>
          <article class="card-box"><header><h2>Orders by status</h2></header>${statusBars(s)}</article>
        </section>
        <section class="adm-grid adm-grid--wide">
          <article class="card-box"><header><h2>Recent orders</h2><a class="link" href="/admin/orders.html">View all</a></header>
            ${d.recentOrders.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead><tbody>${d.recentOrders.map((o) => `<tr><td data-label="Order"><div><a class="link" href="/admin/orders.html?id=${esc(o.orderId)}">#${esc(o.orderId)}</a><small>${formatDate(o.createdAt)}</small></div></td><td data-label="Customer">${esc(o.customer.name)}</td><td data-label="Total">${formatPrice(o.total)}</td><td data-label="Status">${statusBadge(o.status)}</td></tr>`).join('')}</tbody></table></div>` : tableState('receipt', 'No orders yet', 'New orders will appear here as customers place them.')}
          </article>
          <article class="card-box"><header><h2>Low stock</h2><a class="link" href="/admin/products.html">Products</a></header>
            ${d.lowStock.length ? `<ul class="low-list">${d.lowStock.map((p) => `<li><span class="thumb-sm">${p.images?.[0] ? `<img src="${esc(cdn(p.images[0].url, 100))}" alt="">` : ''}</span><a class="link" href="/admin/product-form.html?id=${p._id}">${esc(p.title)}</a><b class="${p.stock === 0 ? 'is-out' : ''}">${p.stock === 0 ? 'Sold out' : `${p.stock} left`}</b></li>`).join('')}</ul>` : tableState('check', 'Stock looks healthy', 'Products with 5 or fewer units show up here.')}
          </article>
        </section>`;
    } catch (err) {
      el.innerHTML = errorState('Unable to load dashboard stats');
      el.querySelector('[data-retry]').addEventListener('click', load);
    }
  };
  load();
})();
