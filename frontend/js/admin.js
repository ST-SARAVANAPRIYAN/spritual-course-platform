/**
 * InnerSpark - Admin Command Center Logic
 */

let selectedContentID = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verify Auth
    const authData = Auth.checkAuth(['Admin']);
    if (!authData) return;

    // 2. Load Dashboard Stats
    loadStats();

    // 3. Initial Load
    loadQueue();

    // 4. Form Handlers
    document.getElementById('broadcastForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        try {
            UI.showLoader();
            const res = await fetch(`${Auth.apiBase}/admin/broadcast`, {
                method: 'POST',
                headers: Auth.getHeaders(),
                body: JSON.stringify(data)
            });
            if (res.ok) {
                UI.success('Broadcast sent to all seekers.');
                e.target.reset();
            }
        } catch (err) { UI.error('Broadcast failed.'); }
        finally { UI.hideLoader(); }
    });

    document.getElementById('overrideForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        try {
            UI.showLoader();
            const res = await fetch(`${Auth.apiBase}/admin/override`, {
                method: 'POST',
                headers: Auth.getHeaders(),
                body: JSON.stringify(data)
            });
            if (res.ok) {
                UI.success('Access granted to seeker.');
                e.target.reset();
            } else {
                const err = await res.json();
                UI.error(err.message);
            }
        } catch (err) { UI.error('Override failed.'); }
        finally { UI.hideLoader(); }
    });

    document.getElementById('bannerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        try {
            UI.showLoader();
            const res = await fetch(`${Auth.apiBase}/admin/banners`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: formData
            });
            if (res.ok) {
                UI.success('Banner illuminated!');
                e.target.reset();
                loadBanners();
            }
        } catch (err) { UI.error('Banner upload failed.'); }
        finally { UI.hideLoader(); }
    });

    document.getElementById('blogForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        try {
            UI.showLoader();
            const res = await fetch(`${Auth.apiBase}/extra/blogs`, {
                method: 'POST',
                headers: Auth.getHeaders(),
                body: JSON.stringify(data)
            });
            if (res.ok) {
                UI.success('Insight published and illuminated.');
                e.target.reset();
            }
        } catch (err) { UI.error('Failed to publish insight.'); }
        finally { UI.hideLoader(); }
    });

    document.getElementById('eventForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        try {
            UI.showLoader();
            const res = await fetch(`${Auth.apiBase}/extra/events`, {
                method: 'POST',
                headers: Auth.getHeaders(),
                body: JSON.stringify(data)
            });
            if (res.ok) {
                UI.success('Gathering established in the stars.');
                e.target.reset();
            }
        } catch (err) { UI.error('Failed to establish gathering.'); }
        finally { UI.hideLoader(); }
    });
});

async function switchSection(section) {
    const sections = ['queue', 'analytics', 'ledger', 'broadcast', 'override', 'banners', 'blogs', 'events', 'certificates', 'staff'];
    sections.forEach(s => {
        const el = document.getElementById(s + 'Section');
        if (el) {
            el.style.display = s === section ? 'block' : 'none';
            if (s === section) el.classList.add('fade-in');
        }
    });

    // Update Nav
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('onclick')?.includes(section)) link.classList.add('active');
    });

    if (section === 'analytics') loadAnalytics();
    if (section === 'ledger') loadLedger();
    if (section === 'override') loadOverrideCourses();
    if (section === 'queue') loadQueue();
    if (section === 'banners') loadBanners();
    if (section === 'certificates') loadCertificates();
}

async function loadAnalytics() {
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/admin/analytics`, { headers: Auth.getHeaders() });
        const data = await res.json();

        // Populate Stats
        document.getElementById('avgProgress').textContent = `${Math.round(data.completion?.avgCompletion || 0)}%`;
        document.getElementById('conversionRate').textContent = `${data.conversion.rate}%`;
        document.getElementById('totalImpressions').textContent = data.conversion.totalImpressions;
        document.getElementById('totalEnrollments').textContent = data.conversion.totalEnrollments;
        document.getElementById('activeRatio').textContent = `${data.activity.active}/${data.activity.total}`;

        const ctx = document.getElementById('growthChart').getContext('2d');
        if (window.myChart) window.myChart.destroy();

        const labels = data.growth.map(g => {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return months[g._id - 1];
        });
        const values = data.growth.map(g => g.revenue);

        window.myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.length ? labels : ['Awaiting Data'],
                datasets: [{
                    label: 'Revenue (USD)',
                    data: values.length ? values : [0],
                    borderColor: '#FF9933',
                    borderWidth: 3,
                    pointBackgroundColor: '#FF9933',
                    tension: 0.4,
                    fill: true,
                    backgroundColor: 'rgba(255, 153, 51, 0.05)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.02)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    } catch (err) { UI.error('The stream of insights is blocked.'); }
    finally { UI.hideLoader(); }
}

async function loadCertificates() {
    const list = document.getElementById('certificatesList');
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/admin/certificates`, { headers: Auth.getHeaders() });
        const certs = await res.json();

        if (certs.length === 0) {
            list.innerHTML = '<p style="padding: 30px; text-align: center; color: #999;">The archive is empty. No certifications yet issued.</p>';
            return;
        }

        list.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead style="background: rgba(0,0,0,0.02); font-size: 0.85rem; text-transform: uppercase;">
                    <tr>
                        <th style="padding: 15px;">Seeker</th>
                        <th style="padding: 15px;">Path</th>
                        <th style="padding: 15px;">Issue Date</th>
                        <th style="padding: 15px; text-align: right;">Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${certs.map(c => `
                        <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
                            <td style="padding: 15px;">
                                <div style="font-weight: 600;">${c.studentID?.name}</div>
                                <div style="font-size: 0.75rem; color: #999;">${c.studentID?.email}</div>
                            </td>
                            <td style="padding: 15px;">${c.courseID?.title}</td>
                            <td style="padding: 15px; color: #666;">${new Date(c.issueDate).toLocaleDateString()}</td>
                            <td style="padding: 15px; text-align: right;">
                                <button onclick="revokeCert('${c._id}')" class="btn-primary" style="background: var(--color-error); padding: 5px 12px; font-size: 0.75rem; border-radius: 20px;">Revoke</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (err) { UI.error('Archive retrieval failed.'); }
    finally { UI.hideLoader(); }
}

async function revokeCert(id) {
    if (!confirm("Are you sure you want to withdraw this certificate of enlightenment?")) return;
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/admin/certificates/${id}`, {
            method: 'DELETE',
            headers: Auth.getHeaders()
        });
        if (res.ok) {
            UI.success('Certificate revoked.');
            loadCertificates();
        }
    } catch (err) { UI.error('Revocation failed.'); }
    finally { UI.hideLoader(); }
}

async function loadLedger() {
    const list = document.getElementById('ledgerList');
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/admin/ledger`, { headers: Auth.getHeaders() });
        const ledger = await res.json();

        list.innerHTML = ledger.map(p => `
            <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
                <td style="padding: 15px;">
                    <div style="font-weight: 600;">${p.transactionID}</div>
                    <small style="color: #999;">${new Date(p.createdAt).toLocaleDateString()}</small>
                </td>
                <td style="padding: 15px;">
                    <div style="font-weight: 500;">${p.studentID?.name}</div>
                    <div style="font-size: 0.75rem; color: #999;">${p.studentID?.email}</div>
                </td>
                <td style="padding: 15px;">${p.courseID?.title || 'External'}</td>
                <td style="padding: 15px; font-weight: 700; color: var(--color-saffron);">$${p.amount}</td>
                <td style="padding: 15px;"><span class="badge" style="background: rgba(40, 167, 69, 0.1); color: #28a745;">Illuminated</span></td>
            </tr>
        `).join('');
    } catch (err) { list.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Ledger failed to materialize.</td></tr>'; }
    finally { UI.hideLoader(); }
}

async function loadQueue() {
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/admin/pending`, { headers: Auth.getHeaders() });
        const data = await res.json();
        const list = document.getElementById('pendingQueue');

        if (data.content.length === 0 && data.exams.length === 0) {
            list.innerHTML = '<div style="text-align: center; padding: 50px;"><i class="fas fa-check-circle" style="font-size: 3rem; color: var(--color-success); opacity: 0.3; margin-bottom: 15px;"></i><p style="color: var(--color-text-secondary);">The sanctuary is clean. No pending reviews.</p></div>';
            return;
        }

        let html = '';

        // Render Content
        data.content.forEach(item => {
            html += `
                <div class="review-card glass-premium" style="background: white; border-radius: 15px; margin-bottom: 15px; border-left: 4px solid var(--color-saffron);">
                    <div>
                        <strong style="font-size: 1.1rem; color: #1a1a1a;">${item.courseID?.title || 'Unknown Path'}</strong>
                        <p style="font-size: 0.85rem; color: var(--color-text-secondary); margin-top: 5px;">${item.type} Material by ${item.uploadedBy?.name || 'Mentor'}</p>
                    </div>
                    <button class="btn-primary" onclick="openReviewModal('${item._id}', '${item.fileUrl}', '${item.type}', 'Content')" style="padding: 10px 25px; font-size: 0.85rem; border-radius: 20px;">Review Space</button>
                </div>
            `;
        });

        // Render Exams
        data.exams.forEach(exam => {
            html += `
                <div class="review-card glass-premium" style="background: white; border-radius: 15px; margin-bottom: 15px; border-left: 4px solid var(--color-golden);">
                    <div>
                        <strong style="font-size: 1.1rem; color: #1a1a1a;">${exam.courseID?.title || 'Unknown Path'}</strong>
                        <p style="font-size: 0.85rem; color: var(--color-text-secondary); margin-top: 5px;">Assessment: ${exam.title} by ${exam.mentorID?.name || 'Mentor'}</p>
                    </div>
                    <button class="btn-primary" onclick="openReviewModal('${exam._id}', '#', 'Assessment', 'Exam')" style="padding: 10px 25px; font-size: 0.85rem; background: var(--color-golden); border-radius: 20px;">Review Exam</button>
                </div>
            `;
        });

        list.innerHTML = html;
    } catch (err) { UI.error('Queue scanning failed.'); }
    finally { UI.hideLoader(); }
}

async function submitReview(status) {
    const remarks = document.getElementById('adminRemarks').value;

    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/admin/review`, {
            method: 'POST',
            headers: Auth.getHeaders(),
            body: JSON.stringify({
                itemID: selectedContentID,
                itemType: selectedItemType,
                status: status,
                adminRemarks: remarks
            })
        });

        if (res.ok) {
            UI.success(`Judgment rendered: ${status}`);
            document.getElementById('reviewModal').style.display = 'none';
            document.getElementById('adminRemarks').value = '';
            loadQueue();
            loadStats();
        }
    } catch (err) { UI.error('Finalizing judgment failed.'); }
    finally { UI.hideLoader(); }
}

async function loadBanners() {
    const list = document.getElementById('bannerList');
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/admin/banners`, { headers: Auth.getHeaders() });
        const banners = await res.json();

        list.innerHTML = banners.map(b => `
            <div class="review-card glass-premium" style="background: white; display: flex; align-items: center; padding: 15px; border-radius: 12px; margin-bottom: 15px;">
                <img src="${b.imageUrl}" style="width: 120px; height: 60px; border-radius: 8px; object-fit: cover; margin-right: 20px;">
                <div style="flex: 1;">
                    <strong style="font-size: 1rem;">${b.title}</strong>
                    <p style="font-size: 0.8rem; color: #999; margin-top: 4px;">${b.link || 'Internal Connection'}</p>
                </div>
                <button class="btn-primary" style="background: var(--color-error); padding: 8px 18px; font-size: 0.75rem; border-radius: 20px;">Dimmed</button>
            </div>
        `).join('');
    } catch (err) { console.error(err); }
    finally { UI.hideLoader(); }
}

async function loadOverrideCourses() {
    const select = document.getElementById('overrideCourseSelect');
    try {
        const res = await fetch(`${Auth.apiBase}/courses/marketplace`);
        const courses = await res.json();
        select.innerHTML = courses.map(c => `<option value="${c._id}">${c.title}</option>`).join('');
    } catch (err) { console.error(err); }
}
async function loadStats() {
    try {
        const res = await fetch(`${Auth.apiBase}/admin/stats`, { headers: Auth.getHeaders() });
        const stats = await res.json();

        document.getElementById('statUsers').textContent = stats.totalUsers;
        document.getElementById('statMentors').textContent = stats.totalMentors;
        document.getElementById('statCourses').textContent = stats.totalCourses;
        document.getElementById('statRevenue').textContent = `$${stats.revenue.toLocaleString()}`;
    } catch (err) {
        console.error('Stats error:', err);
    }
}

async function loadQueue() {
    try {
        const res = await fetch(`${Auth.apiBase}/admin/pending`, { headers: Auth.getHeaders() });
        const data = await res.json();
        const list = document.getElementById('pendingQueue');

        if (data.content.length === 0 && data.exams.length === 0) {
            list.innerHTML = '<p style="color: var(--color-text-secondary);">The sanctuary is clean. No pending reviews.</p>';
            return;
        }

        let html = '';

        // Render Content
        data.content.forEach(item => {
            html += `
                <div class="review-card">
                    <div>
                        <strong>${item.courseID?.title || 'Unknown Path'}</strong>
                        <p style="font-size: 0.8rem; color: var(--color-text-secondary);">${item.type} Material by ${item.uploadedBy?.name || 'Mentor'}</p>
                    </div>
                    <button class="btn-primary" onclick="openReviewModal('${item._id}', '${item.fileUrl}', '${item.type}', 'Content')" style="padding: 5px 15px; font-size: 0.8rem;">Review</button>
                </div>
            `;
        });

        // Render Exams
        data.exams.forEach(exam => {
            html += `
                <div class="review-card" style="border-left: 4px solid var(--color-golden);">
                    <div>
                        <strong>${exam.courseID?.title || 'Unknown Path'}</strong>
                        <p style="font-size: 0.8rem; color: var(--color-text-secondary);">Assessment: ${exam.title} by ${exam.mentorID?.name || 'Mentor'}</p>
                    </div>
                    <button class="btn-primary" onclick="openReviewModal('${exam._id}', '#', 'Assessment', 'Exam')" style="padding: 5px 15px; font-size: 0.8rem; background: var(--color-golden);">Review Exam</button>
                </div>
            `;
        });

        list.innerHTML = html;
    } catch (err) {
        console.error('Queue error:', err);
    }
}

let selectedItemType = 'Content';

function openReviewModal(id, url, label, type) {
    selectedContentID = id;
    selectedItemType = type;
    const modal = document.getElementById('reviewModal');
    const preview = document.getElementById('filePreview');

    if (type === 'Exam') {
        preview.innerHTML = `<p style="font-weight:600;">Full Assessment Audit Required</p><small>Review questions for spiritual alignment and clarity.</small>`;
    } else {
        preview.innerHTML = `<a href="${url}" target="_blank" style="color: var(--color-saffron); font-weight: 600;">
            <i class="fas fa-external-link-alt"></i> View ${label} Material
        </a>`;
    }

    modal.style.display = 'flex';
}

async function submitReview(status) {
    const remarks = document.getElementById('adminRemarks').value;

    try {
        const res = await fetch(`${Auth.apiBase}/admin/review`, {
            method: 'POST',
            headers: Auth.getHeaders(),
            body: JSON.stringify({
                itemID: selectedContentID,
                itemType: selectedItemType,
                status: status,
                adminRemarks: remarks
            })
        });

        if (res.ok) {
            alert(`Item ${status} successfully.`);
            document.getElementById('reviewModal').style.display = 'none';
            document.getElementById('adminRemarks').value = '';
            loadQueue();
            loadStats();
        }
    } catch (err) {
        alert('Review submission failed.');
    }
}

async function loadBanners() {
    const list = document.getElementById('bannerList');
    try {
        const res = await fetch(`${Auth.apiBase}/admin/banners`, { headers: Auth.getHeaders() });
        const banners = await res.json();

        list.innerHTML = banners.map(b => `
            <div class="review-card">
                <img src="${b.imageUrl}" style="width: 100px; height: 50px; border-radius: 4px; object-fit: cover; margin-right: 15px;">
                <div style="flex: 1;">
                    <strong>${b.title}</strong>
                    <p style="font-size: 0.8rem; color: #999;">${b.link || 'No Link'}</p>
                </div>
                <button class="btn-primary" style="background: var(--color-error); padding: 5px 15px;">Disable</button>
            </div>
        `).join('');
    } catch (err) { console.error(err); }
}

async function addStaff() {
    const form = document.getElementById('addStaffForm');
    const data = Object.fromEntries(new FormData(form).entries());

    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/admin/add-staff`, {
            method: 'POST',
            headers: Auth.getHeaders(),
            body: JSON.stringify(data)
        });

        const result = await res.json();
        if (res.ok) {
            UI.success(`Guardian ordained. ID: ${result.studentID}`);
            form.reset();
        } else {
            UI.error(result.message || 'Ordination failed.');
        }
    } catch (err) {
        UI.error('Connection failed.');
    } finally {
        UI.hideLoader();
    }
}
