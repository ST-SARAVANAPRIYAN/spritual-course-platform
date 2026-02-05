/**
 * InnerSpark - Student Dashboard Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verify Auth
    const authData = Auth.checkAuth(['Student']);
    if (!authData) return;

    const { user } = authData;

    // 2. Populate UI
    const welcomeNameEl = document.getElementById('welcomeName');
    if (welcomeNameEl) welcomeNameEl.textContent = user.name.split(' ')[0];

    // Set student name and avatar in top header
    if (user) {
        document.getElementById('studentName').textContent = user.name || 'Seeker';
        const avatar = document.getElementById('studentAvatar');
        avatar.textContent = (user.name || 'S').charAt(0).toUpperCase();
    }

    const avatarEl = document.getElementById('userAvatar');
    // Only show profile pic if it's valid base64 or HTTP URL
    if (user.profilePic && (user.profilePic.startsWith('data:') || user.profilePic.startsWith('http'))) {
        avatarEl.innerHTML = `<img src="${user.profilePic}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" onerror="this.textContent = '${(user.name || 'U').charAt(0)}'">`;
    } else {
        avatarEl.textContent = user.name.charAt(0);
    }

    // 3. Load Initial Data
    loadEnrolledCourses();
    checkAffirmation();
    loadStats();

    // 4. ID Card Generation
    const downloadBtn = document.getElementById('downloadIDBtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            generateIDCard(user);
        });
    }

    // 5. Support Form Submission
    const supportForm = document.getElementById('supportForm');
    if (supportForm) {
        supportForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(supportForm);
            const data = Object.fromEntries(formData.entries());

            try {
                UI.showLoader();
                const res = await fetch(`${Auth.apiBase}/support/create`, {
                    method: 'POST',
                    headers: Auth.getHeaders(),
                    body: JSON.stringify(data)
                });
                const result = await res.json();
                UI.success(result.message);
                supportForm.reset();
                loadTickets();
            } catch (err) {
                UI.error('Sacred transmission failed. Check your connection.');
            } finally {
                UI.hideLoader();
            }
        });
    }

    // Initialize Charts if Analytics Section exists
    if (document.getElementById('activityChart')) {
        loadCharts();
    }
});

// Expose functions to global scope for HTML onclick attributes
window.switchSection = switchSection;
window.handleProfileUpload = handleProfileUpload;
window.loadMarketplace = loadMarketplace;
window.checkAndTakeExam = checkAndTakeExam;
window.joinLive = joinLive;
window.downloadCertificate = downloadCertificate;
window.purchaseCourse = purchaseCourse;
window.updateProfile = updateProfile;
window.openChangePasswordModal = openChangePasswordModal;
window.submitPasswordChange = submitPasswordChange;
window.closeProfileModal = closeProfileModal;
window.closeAffirmation = closeAffirmation;
window.calculateAge = calculateAge;
window.toggleSpouseFields = toggleSpouseFields;

function getThumbnail(url) {
    if (!url || url.includes('via.placeholder.com')) {
        return 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80';
    }
    return url;
}

function switchSection(section) {
    // This was moved from HTML for cleanliness
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('onclick')?.includes(section)) link.classList.add('active');
    });

    // Hide all sections including analyticsSection
    ['journey', 'timetable', 'payments', 'tickets', 'support', 'certificates', 'marketplace', 'profile', 'analytics'].forEach(s => {
        const el = document.getElementById(s + 'Section');
        if (el) el.style.display = 'none';
    });

    const target = document.getElementById(section + 'Section');
    if (target) {
        target.style.display = 'block';
        target.classList.add('fade-in'); // Add a little transition class if exists
    }

    // Load data for specific sections
    if (section === 'timetable') loadTimetable();
    if (section === 'payments') loadPayments();
    if (section === 'tickets') loadMyTickets();
    if (section === 'support') loadTickets();
    if (section === 'certificates') loadCertificates();
    if (section === 'marketplace') loadMarketplace();
    if (section === 'profile') loadProfile();
}

async function loadStats() {
    try {
        const res = await fetch(`${Auth.apiBase}/courses/enrolled`, { headers: Auth.getHeaders() });
        const courses = await res.json();
        document.getElementById('enrolledCount').textContent = courses.length;

        const attRes = await fetch(`${Auth.apiBase}/attendance/my`, { headers: Auth.getHeaders() });
        const attendance = await attRes.json();
        document.getElementById('attendanceRate').textContent = attendance.length;
    } catch (e) { }
}

function checkAffirmation() {
    const last = localStorage.getItem('lastAffirmation');
    const today = new Date().toDateString();
    if (last !== today) {
        const affirmations = [
            "I am grounded, peaceful, and centered.",
            "My inner light shines brighter every day.",
            "I release all that no longer serves my highest good.",
            "I am a magnet for positive energy and divine wisdom.",
            "My path is clear, and I walk it with grace."
        ];
        const random = affirmations[Math.floor(Math.random() * affirmations.length)];
        document.getElementById('affirmationText').textContent = random;
        document.getElementById('affirmationModal').style.display = 'flex';
    }
}

function closeAffirmation() {
    document.getElementById('affirmationModal').style.display = 'none';
    localStorage.setItem('lastAffirmation', new Date().toDateString());
}

async function loadEnrolledCourses() {
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/courses/enrolled`, { headers: Auth.getHeaders() });
        const courses = await res.json();
        localStorage.setItem('enrolledCourses', JSON.stringify(courses));
        const container = document.querySelector('.course-grid');

        if (courses.length === 0) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 40px;">You haven\'t joined any spiritual paths yet. Visit the Course Catalog to begin.</p>';
            return;
        }

        container.innerHTML = courses.map(c => `
            <div class="course-card glass-premium">
                <div class="course-thumb" style="background: url('${getThumbnail(c.thumbnail)}'); background-size: cover;"></div>
                <div class="course-info">
                    <h4>${c.title}</h4>
                    <p style="color: var(--color-text-secondary); font-size: 0.85rem; margin-bottom: 15px;">By ${c.mentorID?.name || 'Mentor'}</p>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <button onclick="window.location.href='player.html?course=${c._id}&content=first'" class="btn-primary" style="width: 100%; padding: 8px;">Continue Journey</button>
                        <button onclick="checkAndTakeExam('${c._id}')" class="btn-primary" style="width: 100%; padding: 8px; background: var(--color-golden);">Take Assessment</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        UI.error('Failed to load your journey.');
    } finally {
        UI.hideLoader();
    }
}

async function checkAndTakeExam(courseID) {
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/exams/eligibility/${courseID}`, { headers: Auth.getHeaders() });
        const data = await res.json();

        if (data.eligible) {
            UI.success('Assessment path cleared.');
            setTimeout(() => window.location.href = `exam.html?id=${data.examID}`, 1000);
        } else {
            UI.info(data.message || 'You are not yet eligible for this assessment.');
        }
    } catch (err) {
        UI.error('Could not verify availability.');
    } finally {
        UI.hideLoader();
    }
}

async function generateIDCard(paramUser) {
    try {
        UI.showLoader();
        // Fetch fresh profile data
        const res = await fetch(`${Auth.apiBase}/auth/profile`, { headers: Auth.getHeaders() });
        const response = await res.json();
        const user = response.data?.user || response.user || response;

        const { jsPDF } = window.jspdf;
        // CR80 Size (Credit Card): 85.6mm x 53.98mm -> Round to 86x54
        const width = 86;
        const height = 54;
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: [width, height]
        });

        // Colors
        const saffron = [255, 153, 51];
        const golden = [255, 195, 0];
        const deepBlue = [20, 30, 60];
        const white = [255, 255, 255];
        const textGray = [80, 80, 80];

        // Background
        doc.setFillColor(255, 252, 245); // Warm cream
        doc.rect(0, 0, width, height, 'F');

        // --- HEADER ---
        doc.setFillColor(...saffron);
        doc.rect(0, 0, width, 14, 'F');
        doc.setFillColor(...golden);
        doc.rect(0, 14, width, 0.8, 'F');

        // Branding
        doc.setTextColor(...white);
        doc.setFont('times', 'bold');
        doc.setFontSize(10);
        doc.text('INNERSPARK', 5, 6);

        // Org Address (Right aligned in header)
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(4.5);
        doc.setTextColor(255, 235, 200);
        const orgAddr = "6, 2nd cross, Gowripuram Extension,\nGowripuram, Karur, Tamil Nadu 639002";
        doc.text(orgAddr, width - 5, 5, { align: 'right', lineHeightFactor: 1.2 });

        // --- CONTENT ---
        const photoY = 19;
        const photoSize = 18;
        const photoX = 6;

        // Photo Border
        doc.setDrawColor(...golden);
        doc.setLineWidth(0.5);

        // Photo Placeholder/Image
        if (user.profilePic && (user.profilePic.startsWith('data:') || user.profilePic.startsWith('http'))) {
            try {
                const img = new Image();
                img.crossOrigin = 'Anonymous';
                img.src = user.profilePic;
                await new Promise((resolve) => {
                    img.onload = () => {
                        doc.rect(photoX, photoY, photoSize, photoSize); // Border
                        doc.addImage(img, 'JPEG', photoX, photoY, photoSize, photoSize);
                        resolve();
                    };
                    img.onerror = resolve;
                });
            } catch (e) { }
        } else {
            doc.setFillColor(230, 230, 230);
            doc.rect(photoX, photoY, photoSize, photoSize, 'F');
            doc.rect(photoX, photoY, photoSize, photoSize); // Border
            doc.setTextColor(150, 150, 150);
            doc.setFontSize(14);
            doc.text((user.name || 'U').charAt(0).toUpperCase(), photoX + (photoSize / 2), photoY + (photoSize / 2) + 2, { align: 'center' });
        }

        // Role Badge (Under Photo)
        doc.setFillColor(...deepBlue);
        doc.roundedRect(photoX, photoY + photoSize + 2, photoSize, 4, 1, 1, 'F');
        doc.setTextColor(...white);
        doc.setFontSize(5);
        doc.setFont('helvetica', 'bold');
        doc.text((user.role || 'STUDENT').toUpperCase(), photoX + (photoSize / 2), photoY + photoSize + 5, { align: 'center' });

        // Details Column (Right of photo)
        const col1X = 28;
        let cursorY = 21;
        const lineHeight = 3.5;

        // Helper for rows
        const addRow = (label, value) => {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5);
            doc.setTextColor(120, 120, 120);
            doc.text(label.toUpperCase(), col1X, cursorY);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(...deepBlue);

            // Handle long text (Address)
            let val = value || '-';
            if (label === 'Address') {
                doc.setFontSize(6);
                const lines = doc.splitTextToSize(val, 50);
                doc.text(lines, col1X + 18, cursorY);
                cursorY += (lines.length * 2.5) + 1;
            } else {
                doc.text(val, col1X + 18, cursorY);
                cursorY += lineHeight;
            }
        };

        const fullName = `${user.name || ''} ${user.initial || ''}`.trim().toUpperCase();
        addRow('Name', fullName);
        addRow('ID No.', user.studentID);
        addRow('Phone', user.phone || user.whatsappNumber || '-');

        const dob = user.dob ? new Date(user.dob).toLocaleDateString() : '-';
        addRow('DOB', dob);

        const joined = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-';
        addRow('Joined', joined);

        // User Address
        let userAddr = '-';
        if (user.address) {
            const { doorNumber, streetName, town, district, pincode } = user.address;
            const parts = [doorNumber, streetName, town, district, pincode].filter(Boolean);
            if (parts.length > 0) userAddr = parts.join(', ');
        }
        addRow('Address', userAddr);

        // --- FOOTER ---
        doc.setFillColor(...deepBlue);
        doc.rect(0, height - 4, width, 4, 'F');
        doc.setTextColor(...white);
        doc.setFont('times', 'italic');
        doc.setFontSize(6);
        doc.text('"Be the Light"', width / 2, height - 1.5, { align: 'center' });

        // --- PREVIEW ---
        const pdfData = doc.output('datauristring');
        const frame = document.getElementById('idCardFrame');
        if (frame) frame.src = pdfData;

        const modal = document.getElementById('idCardModal');
        if (modal) modal.style.display = 'flex';

        // Setup Download
        const btn = document.getElementById('confirmDownloadIDBtn');
        if (btn) {
            btn.onclick = () => {
                doc.save(`InnerSpark_ID_${user.studentID}.pdf`);
            };
        }

    } catch (err) {
        console.error(err);
        UI.error('Could not generate ID card.');
    } finally {
        UI.hideLoader();
    }
}

async function loadTimetable() {
    const container = document.getElementById('timetableGrid');
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/schedules/my-timetable`, { headers: Auth.getHeaders() });
        const schedules = await res.json();

        if (schedules.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 40px;">Your path is currently quiet. No live flows scheduled.</p>';
            return;
        }

        container.innerHTML = schedules.map(s => `
            <div class="glass-premium" style="padding: 20px; display: flex; justify-content: space-between; align-items: center; border-radius: 12px; margin-bottom: 10px;">
                <div>
                    <h4 style="color: var(--color-saffron);">${s.title}</h4>
                    <p style="font-size: 0.9rem; margin: 5px 0;">Course: ${s.courseID.title}</p>
                    <small style="color: var(--color-text-secondary);">
                        <i class="far fa-clock"></i> ${new Date(s.startTime).toLocaleString()} - ${new Date(s.endTime).toLocaleTimeString()}
                    </small>
                </div>
                <button onclick="joinLive('${s.courseID._id}', '${s._id}', '${s.meetingLink}')" class="btn-primary" style="padding: 10px 25px;">
                    ${s.type === 'Live' ? 'Join Flow' : 'Watch Premiere'}
                </button>
            </div>
        `).join('');
    } catch (err) {
        UI.error('Divine connection failed.');
    } finally {
        UI.hideLoader();
    }
}

async function joinLive(courseID, scheduleID, meetingLink) {
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/attendance/mark`, {
            method: 'POST',
            headers: Auth.getHeaders(),
            body: JSON.stringify({ courseID, scheduleID })
        });
        const data = await res.json();
        UI.info(data.message);
        if (meetingLink) setTimeout(() => window.open(meetingLink, '_blank'), 500);
        loadTimetable();
    } catch (err) {
        UI.error('Could not join session.');
    } finally {
        UI.hideLoader();
    }
}

async function loadPayments() {
    const container = document.getElementById('paymentsList');
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/payments/my`, { headers: Auth.getHeaders() });
        const payments = await res.json();

        if (payments.length === 0) {
            container.innerHTML = '<p style="padding: 20px;">No offerings recorded yet.</p>';
            return;
        }

        container.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead>
                    <tr style="background: rgba(0,0,0,0.02); border-bottom: 2px solid #eee;">
                        <th style="padding: 15px;">Date</th>
                        <th style="padding: 15px;">Course</th>
                        <th style="padding: 15px;">Amount</th>
                        <th style="padding: 15px;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${payments.map(p => `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 15px;">${new Date(p.date).toLocaleDateString()}</td>
                            <td style="padding: 15px;">${p.courseID?.title || 'Unknown'}</td>
                            <td style="padding: 15px;">₹${p.amount}</td>
                            <td style="padding: 15px;">
                                <span style="color: ${p.status === 'Success' ? 'var(--color-success)' : 'var(--color-error)'}; font-weight: 600;">
                                    ${p.status}
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (err) {
        UI.error('History unavailable.');
    } finally {
        UI.hideLoader();
    }
}

async function loadTickets() {
    const container = document.getElementById('ticketsList');
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/support/my-tickets`, { headers: Auth.getHeaders() });
        const tickets = await res.json();

        if (tickets.length === 0) {
            container.innerHTML = `
                <div class="glass-card" style="padding: 60px 40px; text-align: center; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);">
                    <i class="fas fa-inbox" style="font-size: 4rem; color: var(--color-saffron); opacity: 0.5; margin-bottom: 20px;"></i>
                    <h4 style="margin: 0 0 10px 0; color: var(--color-primary);">No Support Tickets Yet</h4>
                    <p style="color: var(--color-text-secondary); margin: 0;">You haven't raised any concerns. If you need assistance, use the form above.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = tickets.map(t => `
            <div class="glass-card" style="padding: 30px; border-radius: 15px; border-left: 5px solid ${t.status === 'Open' ? 'var(--color-saffron)' : '#28a745'}; transition: all 0.3s ease; background: white;" onmouseover="this.style.transform='translateY(-5px)'; this.style.boxShadow='0 15px 40px rgba(0,0,0,0.15)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 10px 30px rgba(0,0,0,0.1)'">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 8px 0; color: var(--color-primary); font-size: 1.2rem; display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-file-alt" style="color: var(--color-saffron); font-size: 1rem;"></i>
                            ${t.subject}
                        </h4>
                        <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                            <small style="color: #999; display: flex; align-items: center; gap: 5px;">
                                <i class="fas fa-clock"></i>
                                ${new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </small>
                            <small style="color: #999;">Ticket ID: #${t._id.substring(t._id.length - 6).toUpperCase()}</small>
                        </div>
                    </div>
                    <span style="font-size: 0.85rem; padding: 8px 16px; border-radius: 25px; font-weight: 600; white-space: nowrap; background: ${t.status === 'Open' ? 'linear-gradient(135deg, rgba(255, 153, 51, 0.15) 0%, rgba(255, 153, 51, 0.25) 100%)' : 'linear-gradient(135deg, rgba(40, 167, 69, 0.15) 0%, rgba(40, 167, 69, 0.25) 100%)'}; color: ${t.status === 'Open' ? '#d97706' : '#28a745'}; border: 2px solid ${t.status === 'Open' ? 'rgba(255, 153, 51, 0.3)' : 'rgba(40, 167, 69, 0.3)'}; display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-${t.status === 'Open' ? 'circle-notch fa-spin' : 'check-circle'}"></i>
                        ${t.status}
                    </span>
                </div>
                <div style="background: #f8f9fa; padding: 15px 20px; border-radius: 10px; margin-bottom: ${t.response ? '15px' : '0'};">
                    <p style="margin: 0; font-size: 0.95rem; color: var(--color-text-primary); line-height: 1.6;">${t.message}</p>
                </div>
                ${t.response ? `
                    <div style="background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); padding: 20px; border-radius: 10px; border-left: 4px solid #28a745;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                            <i class="fas fa-user-shield" style="color: #28a745; font-size: 1.2rem;"></i>
                            <strong style="color: #28a745; font-size: 0.95rem;">Support Team Response</strong>
                        </div>
                        <p style="margin: 0; color: #2e7d32; line-height: 1.6; font-size: 0.95rem;">${t.response}</p>
                    </div>
                ` : `
                    <div style="background: #fff3cd; padding: 15px 20px; border-radius: 10px; border-left: 4px solid #ffc107; display: flex; align-items: center; gap: 12px;">
                        <i class="fas fa-hourglass-half" style="color: #f59e0b; font-size: 1.2rem;"></i>
                        <small style="color: #856404; font-size: 0.9rem; margin: 0;">
                            <strong>Awaiting Response</strong> - Our support team will get back to you within 24 hours.
                        </small>
                    </div>
                `}
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = `
            <div class="glass-card" style="padding: 40px; text-align: center; background: #fff0f0;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #dc3545; margin-bottom: 15px;"></i>
                <h4 style="color: #dc3545; margin: 0 0 10px 0;">Unable to Load Tickets</h4>
                <p style="color: #666; margin: 0;">Please refresh the page or try again later.</p>
            </div>
        `;
        console.error('Error loading tickets:', err);
    } finally {
        UI.hideLoader();
    }
}

async function loadCertificates() {
    const container = document.getElementById('certificatesGrid');
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/certificates/my`, { headers: Auth.getHeaders() });
        const certs = await res.json();

        if (!certs || certs.length === 0) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 40px;">No certifications earned yet. Complete your paths to receive them.</p>';
            return;
        }

        container.innerHTML = certs.map(c => `
            <div class="glass-premium" style="padding: 20px; text-align: center; border-radius: 15px;">
                <div style="position: relative; display: inline-block;">
                    <i class="fas fa-certificate" style="font-size: 3.5rem; color: var(--color-golden); margin-bottom: 15px;"></i>
                    <i class="fas fa-check" style="position: absolute; top: 10px; right: -5px; color: white; background: var(--color-success); border-radius: 50%; font-size: 0.8rem; padding: 3px;"></i>
                </div>
                <h4 style="font-family: var(--font-heading);">${c.courseID?.title || 'Course Completion'}</h4>
                <p style="font-size: 0.8rem; color: var(--color-text-secondary); margin: 10px 0;">Awarded on cosmic date ${new Date(c.issueDate).toLocaleDateString()}</p>
                <button onclick="downloadCertificate('${c._id}')" class="btn-primary" style="width: 100%; padding: 8px; font-size: 0.8rem;">Download PDF</button>
            </div>
        `).join('');
    } catch (err) {
        UI.error('Connection lost with the archive.');
    } finally {
        UI.hideLoader();
    }
}

async function downloadCertificate(certID) {
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/certificates/${certID}`, { headers: Auth.getHeaders() });
        const cert = await res.json();

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape', 'mm', 'a4');

        // PREMIUM BACKGROUND
        doc.setFillColor(255, 252, 248); // Paper texture substitute
        doc.rect(0, 0, 297, 210, 'F');

        // ORNATE BORDER
        doc.setDrawColor(255, 153, 51); // Saffron
        doc.setLineWidth(1.5);
        doc.rect(10, 10, 277, 190);
        doc.setDrawColor(255, 195, 0); // Golden inner
        doc.setLineWidth(0.5);
        doc.rect(12, 12, 273, 186);

        // CORNER ACCENTS (Simulated)
        doc.setFillColor(255, 153, 51);
        doc.triangle(10, 10, 30, 10, 10, 30, 'F');
        doc.triangle(287, 10, 267, 10, 287, 30, 'F');
        doc.triangle(10, 200, 30, 200, 10, 180, 'F');
        doc.triangle(287, 200, 267, 200, 287, 180, 'F');

        // HEADER
        doc.setTextColor(255, 153, 51);
        doc.setFont('times', 'bold');
        doc.setFontSize(28);
        doc.text('INNERSPARK SANCTUARY', 148.5, 35, { align: 'center' });

        doc.setFontSize(12);
        doc.setTextColor(150, 150, 150);
        doc.text('WHERE TECHNOLOGY MEETS TRADITION', 148.5, 42, { align: 'center' });

        // MAIN TITLE
        doc.setTextColor(51, 51, 51);
        doc.setFontSize(42);
        doc.text('CERTIFICATE OF ENLIGHTENMENT', 148.5, 75, { align: 'center' });

        // DESCRIPTION
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(18);
        doc.text('Thus it is decreed that', 148.5, 95, { align: 'center' });

        // STUDENT NAME - HIGH FIDELITY
        doc.setFont('times', 'italic');
        doc.setFontSize(48);
        doc.setTextColor(255, 153, 51);
        doc.text(cert.studentID.name.toUpperCase(), 148.5, 115, { align: 'center' });

        // GOLD FOIL DECOR UNDER NAME
        doc.setDrawColor(255, 195, 0);
        doc.setLineWidth(0.8);
        doc.line(70, 120, 227, 120);

        // COMPLETION TEXT
        doc.setTextColor(51, 51, 51);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(18);
        doc.text(`has successfully transcended the challenges of`, 148.5, 135, { align: 'center' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.text(cert.courseID.title, 148.5, 150, { align: 'center' });

        // GOLD FOIL SEAL
        const sealX = 245, sealY = 165, sealR = 20;
        doc.setFillColor(255, 195, 0);
        doc.circle(sealX, sealY, sealR, 'F');

        // SEAL RAYS
        doc.setDrawColor(255, 153, 51);
        for (let i = 0; i < 360; i += 15) {
            const rad = i * Math.PI / 180;
            doc.line(
                sealX + Math.cos(rad) * sealR,
                sealY + Math.sin(rad) * sealR,
                sealX + Math.cos(rad) * (sealR + 3),
                sealY + Math.sin(rad) * (sealR + 3)
            );
        }

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.text('AUTHENTIC', sealX, sealY - 4, { align: 'center' });
        doc.setFontSize(14);
        doc.text('IS', sealX, sealY + 2, { align: 'center' });
        doc.setFontSize(9);
        doc.text('SANCTUARY', sealX, sealY + 8, { align: 'center' });

        // FOOTER INFO
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Date of Ascension: ${new Date(cert.issueDate).toLocaleDateString()}`, 40, 175);
        doc.text(`Verification ID: ${cert.uniqueCertID || cert._id}`, 40, 182);

        doc.save(`InnerSpark_Enlightenment_${cert.studentID.name.replace(' ', '_')}.pdf`);
        UI.success('Your certification has materialized.');
    } catch (err) {
        UI.error('Could not generate certificate.');
    } finally {
        UI.hideLoader();
    }
}

async function loadMarketplace() {
    const category = document.getElementById('marketplaceCategory')?.value || 'All';
    const container = document.getElementById('marketplaceGrid');

    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/courses?category=${category}`, { headers: Auth.getHeaders() });
        const courses = await res.json();

        let enrolledIds = [];
        try {
            const enrolled = JSON.parse(localStorage.getItem('enrolledCourses') || '[]');
            enrolledIds = enrolled.map(c => c._id);
        } catch (e) { }

        if (courses.length === 0) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--color-text-secondary);">No paths found for this category at the moment.</p>';
            return;
        }

        container.innerHTML = courses.map(c => {
            const isEnrolled = enrolledIds.includes(c._id);
            return `
            <div class="course-card glass-premium" style="display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <div class="course-thumb" style="background: url('${getThumbnail(c.thumbnail)}'); background-size: cover; height: 160px;">
                        <span class="badge" style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.6); backdrop-filter: blur(5px); color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.75rem;">${c.category}</span>
                    </div>
                    <div class="course-info" style="padding: 15px;">
                        <h4 style="margin: 0 0 5px; font-size: 1.1rem; color: var(--color-primary);">${c.title}</h4>
                        <p style="color: var(--color-text-secondary); font-size: 0.85rem; margin-bottom: 10px;">By <span style="color: var(--color-saffron);">${c.mentorID?.name || 'Mentor'}</span></p>
                        <p style="font-size: 0.9rem; margin-bottom: 15px; color: #666; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${c.description}</p>
                    </div>
                </div>
                <div style="padding: 0 15px 15px;">
                     <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-top: 1px solid #eee; padding-top: 10px;">
                        <span style="font-weight: bold; font-size: 1.2rem; color: var(--color-primary);">₹${c.price}</span>
                        <span style="font-size: 0.8rem; color: #777;"><i class="fas fa-video"></i> ${c.totalLessons || 0} Lessons</span>
                    </div>
                    ${isEnrolled ?
                    `<button onclick="switchSection('journey')" class="btn-primary" style="width: 100%; padding: 10px; background: var(--color-success); border: none;"><i class="fas fa-check"></i> Enrolled</button>` :
                    c.status === 'Approved' ?
                    `<button onclick="openNotifyModal('${c._id}', '${c.title.replace(/'/g, "\\'")}')" class="btn-secondary" style="width: 100%; padding: 10px; background: #F59E0B; color: white; border: none;"><i class="fas fa-bell"></i> Notify Me</button>` :
                    `<button onclick="purchaseCourse('${c._id}', '${c.price}')" class="btn-primary" style="width: 100%; padding: 10px;"><i class="fas fa-cart-plus"></i> Enroll Now</button>`
                }
                </div>
            </div>
        `}).join('');

    } catch (err) {
        UI.error('Course catalog temporarily unavailable.');
    } finally {
        UI.hideLoader();
    }
}

async function purchaseCourse(courseID, amount) {
    if (!checkProfileCompletion()) {
        document.getElementById('profileRestrictionModal').style.display = 'flex';
        return;
    }

    if (!confirm(`Do you wish to offer ₹${amount} for this sacred path?`)) return;

    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/payments/create`, {
            method: 'POST',
            headers: Auth.getHeaders(),
            body: JSON.stringify({
                courseID,
                amount,
                paymentMethod: 'Manual'
            })
        });

        const data = await res.json();

        if (res.ok) {
            UI.success('Enrollment successful! May your journey be fruitful.');
            await loadEnrolledCourses();
            loadMarketplace();
            setTimeout(() => switchSection('journey'), 1500);
        } else {
            UI.error(data.message || 'Transaction failed.');
        }

    } catch (err) {
        UI.error('Could not process enrollment.');
    } finally {
        UI.hideLoader();
    }
}

// --- PROFILE MANAGEMENT ---

async function loadProfile() {
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/auth/profile`, { headers: Auth.getHeaders() });

        if (!res.ok) {
            throw new Error('Failed to load profile');
        }

        const response = await res.json();
        const user = response.data?.user || response.user || response;

        console.log('Profile loaded:', user); // Debug log

        // Populate fields
        if (user.name) {
            document.getElementById('p_name').value = user.name.toUpperCase();
        }
        if (user.initial) document.getElementById('p_initial').value = user.initial;
        if (user.fatherName) document.getElementById('p_fatherName').value = user.fatherName;
        if (user.motherName) document.getElementById('p_motherName').value = user.motherName;

        if (user.dob) {
            const dobValue = user.dob.split('T')[0];
            document.getElementById('p_dob').value = dobValue;
            calculateAge();
        }

        if (user.gender) document.getElementById('p_gender').value = user.gender;
        if (user.maritalStatus) {
            document.getElementById('p_maritalStatus').value = user.maritalStatus;
            toggleSpouseFields();
        }

        if (user.spouseName) document.getElementById('p_spouseName').value = user.spouseName;
        if (user.spouseContact) document.getElementById('p_spouseContact').value = user.spouseContact;

        if (user.address) {
            const addr = user.address;
            if (addr.doorNumber) document.getElementById('p_doorNumber').value = addr.doorNumber;
            if (addr.streetName) document.getElementById('p_streetName').value = addr.streetName;
            if (addr.town) document.getElementById('p_town').value = addr.town;
            if (addr.district) document.getElementById('p_district').value = addr.district;
            if (addr.pincode) document.getElementById('p_pincode').value = addr.pincode;
            if (addr.state) document.getElementById('p_state').value = addr.state;
        }

        if (user.workDetails) {
            if (user.workDetails.type) document.getElementById('p_workType').value = user.workDetails.type;
            if (user.workDetails.name) document.getElementById('p_workName').value = user.workDetails.name;
        }

        if (user.whatsappNumber) document.getElementById('p_whatsapp').value = user.whatsappNumber;

        // Display profile photo
        const photoPreview = document.getElementById('profilePhotoPreview');
        if (photoPreview) {
            // Only display if it's a valid base64 data URI or HTTP URL
            if (user.profilePic && (user.profilePic.startsWith('data:') || user.profilePic.startsWith('http'))) {
                photoPreview.innerHTML = `<img src="${user.profilePic}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.innerHTML='<i class=\"fas fa-user\" style=\"font-size: 3rem; color: #999;\"></i>';">`;
            } else {
                // Fallback to default icon if invalid or file path
                photoPreview.innerHTML = '<i class="fas fa-user" style="font-size: 3rem; color: #999;"></i>';
            }
        }

        checkProfileCompletion(); // Perform check after populating
    } catch (err) {
        UI.error('Could not load profile details.');
    } finally {
        UI.hideLoader();
    }
}

async function updateProfile() {
    const data = {
        initial: document.getElementById('p_initial').value,
        fatherName: document.getElementById('p_fatherName').value,
        motherName: document.getElementById('p_motherName').value,
        dob: document.getElementById('p_dob').value,
        gender: document.getElementById('p_gender').value,
        maritalStatus: document.getElementById('p_maritalStatus').value,
        spouseName: document.getElementById('p_spouseName').value,
        spouseContact: document.getElementById('p_spouseContact').value,
        whatsappNumber: document.getElementById('p_whatsapp').value,
        address: {
            doorNumber: document.getElementById('p_doorNumber').value,
            streetName: document.getElementById('p_streetName').value,
            town: document.getElementById('p_town').value,
            district: document.getElementById('p_district').value,
            pincode: document.getElementById('p_pincode').value,
            state: 'Tamil Nadu'
        },
        workDetails: {
            type: document.getElementById('p_workType').value,
            name: document.getElementById('p_workName').value
        }
    };

    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/auth/profile`, {
            method: 'PUT',
            headers: Auth.getHeaders(),
            body: JSON.stringify(data)
        });

        if (res.ok) {
            UI.success('Profile updated successfully.');
        } else {
            UI.error('Update failed.');
        }
    } catch (err) {
        UI.error('Connection failed.');
    } finally {
        UI.hideLoader();
    }
}

function calculateAge() {
    const dob = new Date(document.getElementById('p_dob').value);
    const diff_ms = Date.now() - dob.getTime();
    const age_dt = new Date(diff_ms);
    const age = Math.abs(age_dt.getUTCFullYear() - 1970);
    document.getElementById('p_age').value = age;
}

function toggleSpouseFields() {
    const status = document.getElementById('p_maritalStatus').value;
    const fields = document.getElementById('spouseFields');
    fields.style.display = status === 'Married' ? 'grid' : 'none';
}

function openChangePasswordModal() {
    document.getElementById('passwordModal').style.display = 'flex';
}

async function submitPasswordChange() {
    const currentPassword = document.getElementById('cp_current').value;
    const newPassword = document.getElementById('cp_new').value;

    // Basic frontend check for new password strength could be added here similar to register

    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/auth/change-password`, {
            method: 'PUT',
            headers: Auth.getHeaders(),
            body: JSON.stringify({ currentPassword, newPassword })
        });

        const result = await res.json();
        if (res.ok) {
            UI.success('Password changed. Please login again.');
            document.getElementById('passwordModal').style.display = 'none';
            setTimeout(() => Auth.logout(), 2000);
        } else {
            UI.error(result.message);
        }
    } catch (err) {
        UI.error('Password change failed.');
    } finally {
        UI.hideLoader();
    }
}

// Assuming initDashboard is a new function or an existing one where dashboard-related
// initializations happen. Since it's not present, I'm creating a placeholder.
// If you intended to call loadCharts() within an existing function, please specify.
async function initDashboard() {
    await loadEnrolledCourses();
    loadCharts();
    // Any other dashboard initialization logic can go here
}

// Check Profile Completion Percentage
function checkProfileCompletion() {
    // We'll read from DOM inputs since `loadProfile` populates them.
    const fields = [
        document.getElementById('p_initial')?.value,
        document.getElementById('p_fatherName')?.value,
        document.getElementById('p_motherName')?.value,
        document.getElementById('p_dob')?.value,
        document.getElementById('p_gender')?.value,
        document.getElementById('p_doorNumber')?.value,
        document.getElementById('p_streetName')?.value,
        document.getElementById('p_town')?.value,
        document.getElementById('p_district')?.value,
        document.getElementById('p_pincode')?.value
    ];

    const filled = fields.filter(f => f && f.trim() !== '').length;
    const total = fields.length;
    const percent = Math.round((filled / total) * 100);

    renderProfileWarning(percent);
    return percent === 100;
}

function renderProfileWarning(percent) {
    const alertBox = document.getElementById('profileAlertContainer');
    if (!alertBox) return;

    if (percent < 100) {
        alertBox.style.display = 'flex';
        document.getElementById('profileAlertPercent').textContent = `${percent}%`;
        document.getElementById('profileAlertBar').style.width = `${percent}%`;
    } else {
        alertBox.style.display = 'none';
    }
}

function closeProfileModal() {
    document.getElementById('profileRestrictionModal').style.display = 'none';
}

// --- Charts ---
async function loadCharts() {
    try {
        const analyticsSection = document.getElementById('analyticsSection');
        if (analyticsSection) analyticsSection.style.display = 'block';

        const ctx1 = document.getElementById('activityChart');
        const ctx2 = document.getElementById('focusChart');

        // Destroy existing charts if any
        if (window.activityChartInstance) window.activityChartInstance.destroy();
        if (window.focusChartInstance) window.focusChartInstance.destroy();

        if (ctx1) {
            window.activityChartInstance = new Chart(ctx1, {
                type: 'line',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        label: 'Study Hours',
                        data: [2, 4, 3, 5, 2, 4, 6],
                        borderColor: '#FF9933',
                        backgroundColor: 'rgba(255, 153, 51, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: { responsive: true }
            });
        }

        if (ctx2) {
            window.focusChartInstance = new Chart(ctx2, {
                type: 'doughnut',
                data: {
                    labels: ['Meditation', 'Yoga', 'Philosophy', 'Reading'],
                    datasets: [{
                        data: [35, 25, 20, 20],
                        backgroundColor: ['#FF9933', '#FFC300', '#201E3C', '#AAAAAA']
                    }]
                },
                options: { responsive: true }
            });
        }
    } catch (e) {
        console.error('Chart load error:', e);
    }
}

// --- Profile Upload ---
async function handleProfileUpload(input) {
    console.log('handleProfileUpload called', input);

    if (input.files && input.files[0]) {
        const file = input.files[0];
        console.log('File selected:', file.name, file.size, file.type);

        // Validation
        const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            UI.error('Invalid format. Use JPG/PNG.');
            console.error('Invalid file type:', file.type);
            return;
        }

        if (file.size < 5120 || file.size > 51200) {
            UI.error(`Size must be between 5KB and 50KB. Current: ${(file.size / 1024).toFixed(2)}KB`);
            console.error('Invalid file size:', file.size);
            return;
        }

        const formData = new FormData();
        formData.append('profilePic', file);
        formData.append('type', 'profile'); // Tell server this is a profile photo

        try {
            UI.showLoader();
            console.log('Uploading to:', `${Auth.apiBase}/auth/profile`);

            const res = await fetch(`${Auth.apiBase}/auth/profile`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            const data = await res.json();
            console.log('Upload response:', data);

            if (res.ok) {
                UI.success('Photo updated successfully!');
                const profilePicUrl = data.data?.user?.profilePic || data.user?.profilePic;
                console.log('Profile pic URL:', profilePicUrl);

                // Only update if it's valid base64 or HTTP URL
                if (profilePicUrl && (profilePicUrl.startsWith('data:') || profilePicUrl.startsWith('http'))) {
                    // Update top header avatar
                    const avatar = document.getElementById('userAvatar');
                    if (avatar) {
                        avatar.innerHTML = `<img src="${profilePicUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" onerror="this.textContent='${user.name ? user.name.charAt(0) : 'U'}';">`;
                    }

                    // Update profile photo preview
                    const photoPreview = document.getElementById('profilePhotoPreview');
                    if (photoPreview) {
                        photoPreview.innerHTML = `<img src="${profilePicUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.innerHTML='<i class=\\"fas fa-user\\" style=\\"font-size: 3rem; color: #999;\\"></i>';">`;
                    }
                } else {
                    console.error('Invalid profile pic URL format:', profilePicUrl);
                }
            } else {
                console.error('Upload failed:', data);
                UI.error(data.message || 'Upload failed');
            }
        } catch (err) {
            console.error('Upload error:', err);
            UI.error('Server connection failed: ' + err.message);
        } finally {
            UI.hideLoader();
            // Reset input to allow uploading same file again
            input.value = '';
        }
    } else {
        console.log('No file selected');
    }
}

// ====== TICKET FUNCTIONS ======
async function loadMyTickets() {
    const container = document.getElementById('myTicketsContainer');
    if (!container) return;

    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;"><i class="fas fa-spinner fa-spin"></i> Loading tickets...</div>';

    try {
        const res = await fetch(`${Auth.apiBase}/tickets/my`, { headers: Auth.getHeaders() });
        const tickets = await res.json();

        if (tickets.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #999;">
                    <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                    <p style="font-size: 1.1rem;">No tickets yet</p>
                    <p style="font-size: 0.9rem;">Click "Create New Ticket" to get support</p>
                </div>
            `;
            return;
        }

        const ticketCards = tickets.map(ticket => {
            const statusClass = ticket.status === 'Open' ? 'status-open' :
                ticket.status === 'In Progress' ? 'status-progress' : 'status-closed';
            const priorityClass = ticket.priority === 'Urgent' ? 'priority-urgent' :
                ticket.priority === 'High' ? 'priority-high' :
                    ticket.priority === 'Medium' ? 'priority-medium' : 'priority-low';

            const created = new Date(ticket.createdAt).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
            });

            return `
                <div class="ticket-card" onclick="viewStudentTicket('${ticket._id}')" style="cursor: pointer; transition: all 0.3s;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                                <span style="font-weight: 600; color: #333; font-size: 0.95rem;">Ticket #${ticket.ticketID || 'N/A'}</span>
                                <span class="${priorityClass}" style="padding: 3px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">${ticket.priority || 'Medium'}</span>
                            </div>
                            <h4 style="margin: 0; color: var(--color-primary); font-size: 1.1rem;">${ticket.subject}</h4>
                        </div>
                        <span class="${statusClass}" style="padding: 6px 14px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; white-space: nowrap;">${ticket.status}</span>
                    </div>
                    <p style="color: #666; margin: 0 0 12px 0; font-size: 0.9rem; line-height: 1.5; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${ticket.description}</p>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid #f0f0f0;">
                        <span style="font-size: 0.85rem; color: #999;">
                            <i class="far fa-calendar"></i> ${created}
                        </span>
                        ${ticket.replies && ticket.replies.length > 0 ? `<span style="font-size: 0.85rem; color: #667eea;"><i class="far fa-comment"></i> Last reply: ${new Date(ticket.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = ticketCards;
    } catch (err) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #e74c3c;">
                <i class="fas fa-exclamation-circle" style="font-size: 3rem; margin-bottom: 15px;"></i>
                <p>Failed to load tickets</p>
            </div>
        `;
    }
}

function openCreateTicketModal() {
    document.getElementById('createTicketModal').style.display = 'flex';
    document.getElementById('ticketSubject').value = '';
    document.getElementById('ticketDescription').value = '';
}

function closeCreateTicketModal() {
    document.getElementById('createTicketModal').style.display = 'none';
}

async function handleCreateTicket(e) {
    e.preventDefault();

    const subject = document.getElementById('ticketSubject').value;
    const description = document.getElementById('ticketDescription').value;

    if (!subject || !description) {
        if (typeof UI !== 'undefined' && UI.showToast) {
            UI.showToast('Please fill all fields', 'error');
        } else {
            alert('Please fill all fields');
        }
        return;
    }

    try {
        const res = await fetch(`${Auth.apiBase}/tickets`, {
            method: 'POST',
            headers: Auth.getHeaders(),
            body: JSON.stringify({ subject, description })
        });

        if (!res.ok) throw new Error('Failed to create ticket');

        if (typeof UI !== 'undefined' && UI.showToast) {
            UI.showToast('Ticket created successfully!', 'success');
        } else {
            alert('Ticket created successfully!');
        }

        closeCreateTicketModal();

        // Ensure we're on tickets section and reload immediately
        if (typeof switchSection === 'function') {
            switchSection('tickets');
        }
        await loadMyTickets(); // Await to ensure instant update
    } catch (err) {
        if (typeof UI !== 'undefined' && UI.showToast) {
            UI.showToast('Failed to create ticket', 'error');
        } else {
            alert('Failed to create ticket');
        }
    }
}

async function viewStudentTicket(ticketId) {
    const modal = document.getElementById('viewTicketModal');
    const content = document.getElementById('viewTicketContent');

    content.innerHTML = '<div style="text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--color-primary);"></i></div>';
    modal.style.display = 'flex';

    try {
        const res = await fetch(`${Auth.apiBase}/tickets/${ticketId}`, { headers: Auth.getHeaders() });
        const ticket = await res.json();

        const statusClass = ticket.status === 'Open' ? 'status-open' :
            ticket.status === 'In Progress' ? 'status-progress' : 'status-closed';
        const priorityClass = ticket.priority === 'Urgent' ? 'priority-urgent' :
            ticket.priority === 'High' ? 'priority-high' :
                ticket.priority === 'Medium' ? 'priority-medium' : 'priority-low';

        const replies = ticket.replies || [];
        const conversationHTML = replies.map(reply => {
            const replier = reply.repliedBy || { name: 'Unknown', role: 'N/A' };
            const isStudent = replier.role === 'Student';
            const isAdmin = replier.role === 'Admin';

            return `
                <div style="display: flex; gap: 15px; margin-bottom: 20px; ${isStudent ? 'flex-direction: row-reverse;' : ''}">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: ${isStudent ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : isAdmin ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' : 'linear-gradient(135deg, #ffa726 0%, #fb8c00 100%)'}; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">
                        ${replier.name.charAt(0).toUpperCase()}
                    </div>
                    <div style="flex: 1; max-width: 70%;">
                        <div style="background: ${isStudent ? '#f8f9ff' : isAdmin ? '#fff5f5' : '#fff8e1'}; padding: 15px; border-radius: 12px; border-left: 4px solid ${isStudent ? '#667eea' : isAdmin ? '#f5576c' : '#ffa726'};">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <strong style="color: #333;">${replier.name} <span style="font-size: 0.75rem; opacity: 0.7; font-weight: normal;">(${replier.role})</span></strong>
                                <span style="font-size: 0.8rem; color: #999;">${new Date(reply.repliedAt).toLocaleString()}</span>
                            </div>
                            <p style="margin: 0; color: #666; line-height: 1.6;">${reply.message}</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        content.innerHTML = `
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 12px; margin-bottom: 25px; color: white;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                            <span style="background: rgba(255,255,255,0.2); padding: 5px 12px; border-radius: 15px; font-size: 0.85rem; font-weight: 600;">${ticket.ticketID || 'N/A'}</span>
                            <span class="${priorityClass}" style="padding: 5px 12px; border-radius: 15px; font-size: 0.85rem; font-weight: 600; background: rgba(255,255,255,0.9); color: #333;">${ticket.priority || 'Medium'}</span>
                        </div>
                        <h3 style="margin: 0; font-size: 1.5rem;">${ticket.subject}</h3>
                    </div>
                    <span class="${statusClass}" style="padding: 8px 16px; border-radius: 20px; font-size: 0.9rem; font-weight: 600; background: rgba(255,255,255,0.9);">${ticket.status}</span>
                </div>
                <p style="margin: 0; opacity: 0.9; line-height: 1.6;">${ticket.description}</p>
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.2); font-size: 0.9rem; opacity: 0.8;">
                    <i class="far fa-calendar"></i> Created: ${new Date(ticket.createdAt).toLocaleString()}
                </div>
            </div>

            <div style="margin-bottom: 25px;">
                <h4 style="color: #333; margin-bottom: 20px; font-size: 1.2rem; display: flex; align-items: center; gap: 10px;">
                    <i class="far fa-comments"></i>
                    Conversation
                </h4>
                <div style="max-height: 400px; overflow-y: auto; padding-right: 10px;">
                    ${conversationHTML || '<p style="text-align: center; color: #999; padding: 20px;">No replies yet</p>'}
                </div>
            </div>

            ${ticket.status !== 'Closed' ? `
                <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; border: 2px solid #e0e0e0;">
                    <h4 style="margin: 0 0 15px 0; color: #333; font-size: 1.1rem;">Add Reply</h4>
                    <textarea id="replyMessage" rows="4" placeholder="Type your message..." style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-family: inherit; resize: vertical;"></textarea>
                    <button onclick="sendStudentReply('${ticketId}')" class="btn-primary" style="margin-top: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 12px 25px; border-radius: 8px; font-weight: 600;">
                        <i class="fas fa-paper-plane"></i> Send Reply
                    </button>
                </div>
            ` : '<div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px; color: #999;">This ticket is closed. No further replies allowed.</div>'}
        `;
    } catch (err) {
        content.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #e74c3c;">
                <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 15px;"></i>
                <p>Failed to load ticket details</p>
            </div>
        `;
    }
}

function closeViewTicketModal() {
    document.getElementById('viewTicketModal').style.display = 'none';
}

async function sendStudentReply(ticketId) {
    const messageTextarea = document.getElementById('replyMessage');
    const message = messageTextarea.value.trim();

    if (!message) {
        if (typeof UI !== 'undefined' && UI.showToast) {
            UI.showToast('Please enter a message', 'error');
        } else {
            alert('Please enter a message');
        }
        return;
    }

    try {
        const res = await fetch(`${Auth.apiBase}/tickets/${ticketId}/reply`, {
            method: 'POST',
            headers: Auth.getHeaders(),
            body: JSON.stringify({ message })
        });

        if (!res.ok) throw new Error('Failed to send reply');

        // Clear textarea immediately
        messageTextarea.value = '';

        if (typeof UI !== 'undefined' && UI.showToast) {
            UI.showToast('Reply sent successfully!', 'success');
        } else {
            alert('Reply sent successfully!');
        }

        // Reload ticket to show new reply immediately
        await viewStudentTicket(ticketId);

        // Also reload the tickets list to update last reply time
        await loadMyTickets();
    } catch (err) {
        if (typeof UI !== 'undefined' && UI.showToast) {
            UI.showToast('Failed to send reply', 'error');
        } else {
            alert('Failed to send reply');
        }
    }
}

// Setup create ticket form handler
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('createTicketForm');
    if (form) {
        form.addEventListener('submit', handleCreateTicket);
    }
});

// Ensure exports are available
window.switchSection = switchSection;
window.handleProfileUpload = handleProfileUpload;
window.loadMarketplace = loadMarketplace;
window.checkAndTakeExam = checkAndTakeExam;
window.joinLive = joinLive;
window.downloadCertificate = downloadCertificate;
window.purchaseCourse = purchaseCourse;
window.updateProfile = updateProfile;
window.openChangePasswordModal = openChangePasswordModal;
window.submitPasswordChange = submitPasswordChange;
window.closeProfileModal = closeProfileModal;
window.closeAffirmation = closeAffirmation;
window.calculateAge = calculateAge;
window.toggleSpouseFields = toggleSpouseFields;
window.loadMyTickets = loadMyTickets;
window.openCreateTicketModal = openCreateTicketModal;
window.closeCreateTicketModal = closeCreateTicketModal;
window.viewStudentTicket = viewStudentTicket;
window.closeViewTicketModal = closeViewTicketModal;

// --- COURSE SUBSCRIPTION / NOTIFY ME FEATURE ---

function openNotifyModal(courseId, courseTitle) {
    window.currentNotifyCourseId = courseId;
    window.currentNotifyCourseTitle = courseTitle;
    
    // Create modal if it doesn't exist
    if (!document.getElementById('notifyMeModal')) {
        const modalHTML = `
            <div id="notifyMeModal" class="modal" style="display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); backdrop-filter: blur(5px); overflow-y: auto; padding: 20px;">
                <div class="modal-content glass-card" style="position: relative; margin: auto; padding: 0; max-width: 500px; width: 100%; max-height: calc(100vh - 40px); overflow-y: auto; border-radius: 16px; animation: slideDown 0.3s ease; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
                    <div style="background: linear-gradient(135deg, #D97706 0%, #F59E0B 100%); padding: 25px; border-radius: 16px 16px 0 0; color: white;">
                        <h2 style="margin: 0; font-size: 1.5rem; display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-bell"></i> Get Notified
                        </h2>
                        <p style="margin: 8px 0 0; opacity: 0.95; font-size: 0.9rem;" id="notifyCourseTitle"></p>
                    </div>
                    <div style="padding: 30px;">
                        <p style="color: #666; margin-bottom: 25px; line-height: 1.6;">
                            Subscribe to get notified when this course becomes available. We'll send you an email with all the details!
                        </p>
                        <form id="notifyMeForm">
                            <div class="form-group" style="margin-bottom: 20px;">
                                <label style="display: block; margin-bottom: 8px; color: #333; font-weight: 500;">Name <span style="color: red;">*</span></label>
                                <input type="text" id="notifyName" class="form-control" placeholder="Your full name" required style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem;">
                            </div>
                            <div class="form-group" style="margin-bottom: 20px;">
                                <label style="display: block; margin-bottom: 8px; color: #333; font-weight: 500;">Email <span style="color: red;">*</span></label>
                                <input type="email" id="notifyEmail" class="form-control" placeholder="your.email@example.com" required style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem;">
                            </div>
                            <div class="form-group" style="margin-bottom: 25px;">
                                <label style="display: block; margin-bottom: 8px; color: #333; font-weight: 500;">Phone Number <span style="color: red;">*</span></label>
                                <input type="tel" id="notifyPhone" class="form-control" placeholder="10-digit phone number" required maxlength="10" pattern="[0-9]{10}" oninput="validateNotifyPhone()" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem;">
                                <div id="phoneValidationMsg" style="margin-top: 5px; font-size: 0.85rem;"></div>
                            </div>
                            <div style="display: flex; gap: 12px;">
                                <button type="button" onclick="closeNotifyModal()" class="btn-secondary" style="flex: 1; padding: 12px; border: 1px solid #ddd; background: white; color: #666; border-radius: 8px; font-size: 1rem; cursor: pointer;">
                                    Cancel
                                </button>
                                <button type="submit" id="submitNotifyBtn" class="btn-primary" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #D97706 0%, #F59E0B 100%); color: white; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer;">
                                    <i class="fas fa-bell"></i> Notify Me
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add form submit handler
        document.getElementById('notifyMeForm').addEventListener('submit', handleNotifySubmit);
    }
    
    // Show modal and set course title
    document.getElementById('notifyCourseTitle').textContent = courseTitle;
    document.getElementById('notifyMeModal').style.display = 'block';
    
    // Clear form
    document.getElementById('notifyMeForm').reset();
    document.getElementById('phoneValidationMsg').textContent = '';
}

function closeNotifyModal() {
    document.getElementById('notifyMeModal').style.display = 'none';
}

function validateNotifyPhone() {
    const phoneInput = document.getElementById('notifyPhone');
    const validationMsg = document.getElementById('phoneValidationMsg');
    
    // Remove non-numeric characters
    phoneInput.value = phoneInput.value.replace(/\D/g, '');
    
    const phone = phoneInput.value;
    const remaining = 10 - phone.length;
    
    if (phone.length === 0) {
        validationMsg.textContent = '';
        validationMsg.style.color = '';
    } else if (phone.length < 10) {
        validationMsg.textContent = `${remaining} more digit${remaining > 1 ? 's' : ''} required`;
        validationMsg.style.color = '#DC2626';
    } else if (phone.length === 10) {
        validationMsg.innerHTML = '<i class="fas fa-check-circle"></i> Valid phone number';
        validationMsg.style.color = '#10B981';
    }
}

async function handleNotifySubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('notifyName').value.trim();
    const email = document.getElementById('notifyEmail').value.trim();
    const phone = document.getElementById('notifyPhone').value.trim();
    
    // Validate phone
    if (!/^[0-9]{10}$/.test(phone)) {
        UI.error('Please enter a valid 10-digit phone number');
        return;
    }
    
    const submitBtn = document.getElementById('submitNotifyBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subscribing...';
    
    try {
        const res = await fetch(`${Auth.apiBase}/subscribers/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                courseID: window.currentNotifyCourseId,
                name,
                email,
                phone
            })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            UI.success(data.message || 'Successfully subscribed! We will notify you when the course is available.');
            closeNotifyModal();
        } else {
            UI.error(data.message || 'Subscription failed. Please try again.');
        }
    } catch (err) {
        console.error('Subscription error:', err);
        UI.error('Network error. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-bell"></i> Notify Me';
    }
}

window.openNotifyModal = openNotifyModal;
window.closeNotifyModal = closeNotifyModal;
window.validateNotifyPhone = validateNotifyPhone;
window.sendStudentReply = sendStudentReply;
