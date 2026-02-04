/**
 * InnerSpark - Staff Dashboard Logic
 */

// Navigation function to switch between sections
function switchSection(sectionName) {
    // Hide all sections
    const sections = ['overviewSection', 'coursesSection', 'materialsSection', 'studentsSection', 'notificationsSection', 'liveSection'];
    sections.forEach(id => {
        const section = document.getElementById(id);
        if (section) section.style.display = 'none';
    });

    // Show the selected section
    const targetSection = document.getElementById(`${sectionName}Section`);
    if (targetSection) {
        targetSection.style.display = 'block';
    }

    // Update active state in nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    event?.target?.closest('.nav-link')?.classList.add('active');

    // Load data for the selected section
    if (sectionName === 'overview') {
        loadOverview();
    } else if (sectionName === 'materials') {
        loadMyMaterials();
    } else if (sectionName === 'students') {
        loadEnrolledStudents();
    } else if (sectionName === 'notifications') {
        loadNotifications();
    } else if (sectionName === 'live') {
        loadSchedules();
    }
}

// Make switchSection available globally for onclick attributes
window.switchSection = switchSection;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verify Auth
    const authData = Auth.checkAuth(['Staff']);
    if (!authData) return;

    const { user } = authData;
    document.getElementById('mentorName').textContent = user.name;

    // Set staff name and avatar in top header
    if (user) {
        document.getElementById('staffName').textContent = user.name || 'Mentor';
        const avatar = document.getElementById('staffAvatar');
        avatar.textContent = (user.name || 'M').charAt(0).toUpperCase();
    }

    // 2. Modals Logic
    const courseModal = document.getElementById('courseModal');
    const uploadModal = document.getElementById('uploadModal');

    document.getElementById('newCourseBtn').addEventListener('click', () => courseModal.style.display = 'flex');
    document.getElementById('closeModal').addEventListener('click', () => courseModal.style.display = 'none');
    document.getElementById('closeUploadModal').addEventListener('click', () => uploadModal.style.display = 'none');

    // 3. Load Overview (Default) and Courses
    loadOverview();
    loadCourses();
    checkDeletedCourses();

    // 4. Create Course
    document.getElementById('courseForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());

        try {
            UI.showLoader();
            const res = await fetch(`${Auth.apiBase}/staff/courses`, {
                method: 'POST',
                headers: Auth.getHeaders(),
                body: JSON.stringify(data)
            });
            if (res.ok) {
                UI.success('Course draft created!');
                courseModal.style.display = 'none';
                loadCourses();
            }
        } catch (err) {
            UI.error('Could not initiate the course draft.');
        } finally {
            UI.hideLoader();
        }
    });

    // 5. Upload Content
    document.getElementById('uploadForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        console.log('📤 Upload initiated...');
        console.log('Form data entries:', Array.from(formData.entries()));

        // Add title field if not present (use filename as title)
        if (!formData.get('title')) {
            const fileInput = e.target.querySelector('input[type="file"]');
            const fileName = fileInput.files[0]?.name || 'Untitled Material';
            formData.append('title', fileName.split('.')[0]);
        }

        // Add category based on type
        const type = formData.get('type');
        const categoryMap = {
            'Video': 'video',
            'PDF': 'pdf',
            'Audio': 'audio',
            'Note': 'pdf'
        };
        formData.append('category', categoryMap[type] || 'pdf');

        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.textContent = 'Uploading...';
        btn.disabled = true;

        try {
            UI.showLoader();
            console.log('📡 Sending request to:', `${Auth.apiBase}/courses/materials/upload`);

            const res = await fetch(`${Auth.apiBase}/courses/materials/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: formData
            });

            console.log('📥 Response status:', res.status);

            if (res.ok) {
                const data = await res.json();
                console.log('✅ Upload successful:', data);
                UI.success("Material uploaded successfully! Awaiting admin approval.");
                uploadModal.style.display = 'none';
                e.target.reset();
                // Reload materials if on materials section
                if (currentSection === 'materials') {
                    loadMyMaterials();
                }
            } else {
                const err = await res.json();
                console.error('❌ Upload failed with error:', err);
                UI.error('Upload failed: ' + (err.message || 'Unknown error'));
            }
        } catch (err) {
            console.error('💥 Upload caught exception:', err);
            UI.error('Upload failed: ' + err.message + '. Check MongoDB connection.');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
            UI.hideLoader();
        }
    });

    // Material Type Toggle
    document.getElementById('materialType').addEventListener('change', (e) => {
        const group = document.getElementById('previewDurationGroup');
        group.style.display = e.target.value === 'Video' ? 'block' : 'none';
    });

    // 6. Create Exam
    document.getElementById('examForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            courseID: formData.get('courseID'),
            title: formData.get('title'),
            duration: formData.get('duration'),
            passingScore: formData.get('passingScore'),
            questions: []
        };

        const qBlocks = document.querySelectorAll('.q-block');
        qBlocks.forEach(block => {
            const q = block.querySelector('.q-text').value;
            const opts = Array.from(block.querySelectorAll('.opt-text')).map(input => input.value);
            const correct = block.querySelector('.correct-idx').value;
            data.questions.push({ question: q, options: opts, correctAnswerIndex: correct });
        });

        try {
            UI.showLoader();
            const res = await fetch(`${Auth.apiBase}/exams/create`, {
                method: 'POST',
                headers: Auth.getHeaders(),
                body: JSON.stringify(data)
            });
            if (res.ok) {
                UI.success('Assessment established successfully!');
                examModal.style.display = 'none';
            }
        } catch (err) { UI.error('Assessment creation failed.'); }
        finally { UI.hideLoader(); }
    });

    // 7. Schedule Flow
    document.getElementById('scheduleForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());

        try {
            UI.showLoader();
            const res = await fetch(`${Auth.apiBase}/schedules`, {
                method: 'POST',
                headers: Auth.getHeaders(),
                body: JSON.stringify(data)
            });
            if (res.ok) {
                UI.success('Live flow scheduled!');
                document.getElementById('scheduleModal').style.display = 'none';
                if (currentSection === 'live') loadSchedules();
            }
        } catch (err) { UI.error('Scheduling failed.'); }
        finally { UI.hideLoader(); }
    });

    document.getElementById('closeScheduleModal').addEventListener('click', () => {
        document.getElementById('scheduleModal').style.display = 'none';
    });
});

let currentSection = 'overview';

// Load Overview Statistics
async function loadOverview() {
    const container = document.getElementById('overviewStats');
    
    try {
        // Fetch all required data in parallel
        const [coursesRes, studentsRes, materialsRes] = await Promise.all([
            fetch(`${Auth.apiBase}/staff/courses`, { headers: Auth.getHeaders() }),
            fetch(`${Auth.apiBase}/staff/students`, { headers: Auth.getHeaders() }),
            fetch(`${Auth.apiBase}/courses/materials/my`, { headers: Auth.getHeaders() })
        ]);

        const courses = await coursesRes.json();
        const enrollments = await studentsRes.json();
        const materials = await materialsRes.json();

        // Calculate statistics
        const totalCourses = courses.length;
        const publishedCourses = courses.filter(c => c.approvalStatus === 'Published').length;
        const draftCourses = courses.filter(c => c.approvalStatus === 'Draft').length;
        const approvedCourses = courses.filter(c => c.approvalStatus === 'Approved').length;
        
        const uniqueStudents = new Set(enrollments.map(e => e.studentID?._id).filter(id => id)).size;
        const totalEnrollments = enrollments.length;
        
        const totalMaterials = materials.length;
        const approvedMaterials = materials.filter(m => m.approvalStatus === 'Approved').length;
        const pendingMaterials = materials.filter(m => m.approvalStatus === 'Pending').length;

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 25px; margin-bottom: 30px;">
                <!-- Courses Card -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 15px; color: white; box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                        <div>
                            <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 8px;">Total Courses</div>
                            <div style="font-size: 2.5rem; font-weight: bold;">${totalCourses}</div>
                        </div>
                        <i class="fas fa-book-open" style="font-size: 3rem; opacity: 0.3;"></i>
                    </div>
                    <div style="display: flex; gap: 15px; font-size: 0.85rem;">
                        <span><i class="fas fa-check-circle"></i> ${publishedCourses} Published</span>
                        <span><i class="fas fa-clock"></i> ${draftCourses} Draft</span>
                    </div>
                </div>

                <!-- Students Card -->
                <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; border-radius: 15px; color: white; box-shadow: 0 10px 25px rgba(240, 147, 251, 0.3);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                        <div>
                            <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 8px;">Total Students</div>
                            <div style="font-size: 2.5rem; font-weight: bold;">${uniqueStudents}</div>
                        </div>
                        <i class="fas fa-users" style="font-size: 3rem; opacity: 0.3;"></i>
                    </div>
                    <div style="font-size: 0.85rem;">
                        <i class="fas fa-graduation-cap"></i> ${totalEnrollments} Total Enrollments
                    </div>
                </div>

                <!-- Materials Card -->
                <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 30px; border-radius: 15px; color: white; box-shadow: 0 10px 25px rgba(79, 172, 254, 0.3);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                        <div>
                            <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 8px;">Course Materials</div>
                            <div style="font-size: 2.5rem; font-weight: bold;">${totalMaterials}</div>
                        </div>
                        <i class="fas fa-file-alt" style="font-size: 3rem; opacity: 0.3;"></i>
                    </div>
                    <div style="display: flex; gap: 15px; font-size: 0.85rem;">
                        <span><i class="fas fa-check"></i> ${approvedMaterials} Approved</span>
                        <span><i class="fas fa-hourglass-half"></i> ${pendingMaterials} Pending</span>
                    </div>
                </div>
            </div>

            <!-- Recent Activity Section -->
            <div style="background: white; border-radius: 15px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.08);">
                <h4 style="margin-bottom: 20px; color: #333;"><i class="fas fa-chart-line"></i> Quick Stats</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                    <div style="padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid var(--color-success);">
                        <div style="font-size: 0.8rem; color: #666; margin-bottom: 5px;">Approved Courses</div>
                        <div style="font-size: 1.5rem; font-weight: bold; color: var(--color-success);">${approvedCourses}</div>
                    </div>
                    <div style="padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid var(--color-saffron);">
                        <div style="font-size: 0.8rem; color: #666; margin-bottom: 5px;">Avg. Students/Course</div>
                        <div style="font-size: 1.5rem; font-weight: bold; color: var(--color-saffron);">${totalCourses > 0 ? Math.round(totalEnrollments / totalCourses) : 0}</div>
                    </div>
                    <div style="padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #17a2b8;">
                        <div style="font-size: 0.8rem; color: #666; margin-bottom: 5px;">Materials per Course</div>
                        <div style="font-size: 1.5rem; font-weight: bold; color: #17a2b8;">${totalCourses > 0 ? Math.round(totalMaterials / totalCourses) : 0}</div>
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        console.error('Error loading overview:', err);
        container.innerHTML = '<p style="color: var(--color-error);">Failed to load statistics.</p>';
    }
}

async function loadEnrolledStudents() {
    const list = document.getElementById('studentInsightList');
    const filterDropdown = document.getElementById('studentCourseFilter');
    
    try {
        const res = await fetch(`${Auth.apiBase}/staff/students`, { headers: Auth.getHeaders() });
        const enrollments = await res.json();

        if (enrollments.length === 0) {
            list.innerHTML = '<tr><td colspan="6" style="padding:20px; text-align:center;">No seekers have joined your paths yet.</td></tr>';
            if (filterDropdown) {
                filterDropdown.innerHTML = '<option value="">All Courses</option>';
            }
            return;
        }

        // Extract unique courses from enrollments
        const uniqueCourses = [...new Map(
            enrollments
                .filter(e => e.courseID && e.courseID._id)
                .map(e => [e.courseID._id, e.courseID])
        ).values()];

        // Populate filter dropdown with courses
        if (filterDropdown) {
            filterDropdown.innerHTML = '<option value="">All Courses</option>' + 
                uniqueCourses.map(course => 
                    `<option value="${course._id}">${course.title}</option>`
                ).join('');
        }

        list.innerHTML = enrollments.map((e, index) => `
            <tr style="border-bottom: 1px solid #eee; background-color: ${index % 2 === 0 ? '#f9f9f9' : 'white'};" data-course-id="${e.courseID?._id || ''}">
                <td style="padding: 15px; text-align: center; color: #666;">${index + 1}</td>
                <td style="padding: 15px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="${e.studentID?.profilePic || '../assets/default-avatar.png'}" style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover;">
                        <div>
                            <div style="font-weight: 600;">${e.studentID?.name}</div>
                            <div style="font-size: 0.75rem; color: #999;">${e.studentID?.email}</div>
                        </div>
                    </div>
                </td>
                <td style="padding: 15px; color: #666; font-family: monospace;">${e.studentID?._id?.substring(0, 8) || 'N/A'}</td>
                <td style="padding: 15px;">${e.courseID?.title}</td>
                <td style="padding: 15px;">${new Date(e.enrolledAt).toLocaleDateString()}</td>
                <td style="padding: 15px;">
                    <div style="width: 100px; height: 6px; background: #eee; border-radius: 3px; overflow: hidden;">
                        <div style="width: ${e.percentComplete || 0}%; height: 100%; background: var(--color-saffron);"></div>
                    </div>
                    <small style="color: var(--color-text-secondary);">${e.percentComplete || 0}%</small>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        list.innerHTML = '<tr><td colspan="4">Error loading insights.</td></tr>';
        if (filterDropdown) {
            filterDropdown.innerHTML = '<option value="">All Courses</option>';
        }
    }
}

async function loadSchedules() {
    const list = document.getElementById('scheduleList');
    try {
        const res = await fetch(`${Auth.apiBase}/schedules/my-timetable`, { headers: Auth.getHeaders() });
        const schedules = await res.json();

        if (schedules.length === 0) {
            list.innerHTML = '<p>No live flows scheduled.</p>';
            return;
        }

        list.innerHTML = schedules.map(s => `
            <div class="course-list-item">
                <div>
                    <strong>${s.title}</strong>
                    <p style="font-size: 0.8rem; color: var(--color-text-secondary);">
                        ${new Date(s.startTime).toLocaleString()} | Course: ${s.courseID?.title || 'Unknown'}
                    </p>
                </div>
                <div>
                    <button class="btn-primary" onclick="startLiveSession('${s.meetingLink || s._id}')" style="background: var(--color-saffron); padding: 5px 15px; font-size: 0.8rem;">Start Class</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        list.innerHTML = '<p>Error loading schedules.</p>';
    }
}

function startLiveSession(room) {
    const domain = 'meet.jit.si';
    const roomName = room || 'InnerSpark-General';
    const url = `https://${domain}/${roomName}`;
    window.open(url, '_blank');
}

function openUploadModal(id, title) {
    document.getElementById('uploadCourseID').value = id;
    document.getElementById('uploadCourseTitle').textContent = `Adding material to: ${title}`;
    document.getElementById('uploadModal').style.display = 'flex';
}

let qCount = 0;
function addQuestionField() {
    qCount++;
    const container = document.getElementById('questionContainer');
    const div = document.createElement('div');
    div.className = 'q-block';
    div.style.padding = '15px';
    div.style.background = '#f9f9f9';
    div.style.borderRadius = '8px';
    div.style.marginBottom = '15px';

    div.innerHTML = `
        <label>Question ${qCount}</label>
        <input type="text" class="form-control q-text" placeholder="The question..." required style="margin-bottom:10px;">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px;">
            <input type="text" class="opt-text form-control" placeholder="Option 1" required>
            <input type="text" class="opt-text form-control" placeholder="Option 2" required>
            <input type="text" class="opt-text form-control" placeholder="Option 3" required>
            <input type="text" class="opt-text form-control" placeholder="Option 4" required>
        </div>
        <label>Correct Option Index (0-3)</label>
        <input type="number" class="correct-idx form-control" min="0" max="3" value="0" required>
    `;
    container.appendChild(div);
}

async function loadCourses() {
    try {
        const res = await fetch(`${Auth.apiBase}/staff/courses`, {
            headers: Auth.getHeaders()
        });
        const courses = await res.json();
        localStorage.setItem('staffCourses', JSON.stringify(courses));
        const list = document.getElementById('courseList');

        if (courses.length === 0) {
            list.innerHTML = '<p>You haven\'t started any sanctuary projects yet.</p>';
            return;
        }

        list.innerHTML = courses.map(c => {
            // Display Logic: Prefer Approval Status if not Approved
            let displayStatus = c.status;
            if (c.approvalStatus && c.approvalStatus !== 'Approved') {
                displayStatus = c.approvalStatus;
            } else if (c.approvalStatus === 'Approved' && c.status === 'Draft') {
                displayStatus = 'Approved (Unpublished)';
            }
            // Simple color map
            const colorMap = {
                'Published': '#28a745', 'Approved': '#28a745',
                'Draft': '#666', 'Pending': '#fd7e14',
                'Rejected': '#dc3545'
            };
            const statusColor = colorMap[displayStatus.split(' ')[0]] || '#666';

            return `
            <div class="course-list-item" data-course-id="${c._id}">
                <div>
                    <strong>${c.title}</strong>
                    <p style="font-size: 0.8rem; color: var(--color-text-secondary); margin-top:5px;">
                        ${c.category} | 
                        <span style="color:white; background:${statusColor}; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem;">${displayStatus}</span>
                    </p>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <a href="course-preview.html?id=${c._id}" class="btn-primary" style="background: #17a2b8; padding: 5px 15px; font-size: 0.8rem; text-decoration: none; display: inline-flex; align-items: center; gap: 5px;">
                        <i class="fas fa-eye"></i> Preview
                    </a>
                    <a href="module-manager.html?courseId=${c._id}" class="btn-primary" style="background: var(--color-golden); padding: 5px 15px; font-size: 0.8rem; text-decoration: none; display: inline-flex; align-items: center; gap: 5px;">
                        <i class="fas fa-book"></i> Manage Modules
                    </a>
                </div>
            </div>
        `;
        }).join('');
    } catch (err) {
        console.error(err);
    }
}

async function checkDeletedCourses() {
    // This function is now deprecated - notifications are loaded via loadNotifications()
    // Keeping this function to avoid breaking references, but it does nothing
    console.log('checkDeletedCourses called - now using notification system instead');
}

document.getElementById('newExamBtn').addEventListener('click', () => {
    const select = document.getElementById('examCourseSelect');
    const courses = JSON.parse(localStorage.getItem('staffCourses') || '[]');
    select.innerHTML = courses.map(c => `<option value="${c._id}">${c.title}</option>`).join('');
    document.getElementById('examModal').style.display = 'flex';
});

document.getElementById('closeExamModal').addEventListener('click', () => {
    document.getElementById('examModal').style.display = 'none';
});

function openScheduleModal() {
    const select = document.getElementById('scheduleCourseSelect');
    const courses = JSON.parse(localStorage.getItem('staffCourses') || '[]');
    select.innerHTML = courses.map(c => `<option value="${c._id}">${c.title}</option>`).join('');
    document.getElementById('scheduleModal').style.display = 'flex';
}
// My Materials Management
async function loadMyMaterials() {
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/courses/materials/my`, {
            headers: Auth.getHeaders()
        });

        if (!res.ok) throw new Error('Failed to load materials');

        const materials = await res.json();
        const list = document.getElementById('myMaterialsList');

        if (materials.length === 0) {
            list.innerHTML = '<p style="color: var(--color-text-secondary);">No materials uploaded yet.</p>';
            return;
        }

        // Group materials by course for hierarchical display
        const groupedByCourse = {};
        materials.forEach(material => {
            const courseTitle = material.courseID?.title || 'Unassigned';
            const courseId = material.courseID?._id || 'none';
            if (!groupedByCourse[courseId]) {
                groupedByCourse[courseId] = {
                    title: courseTitle,
                    materials: []
                };
            }
            groupedByCourse[courseId].materials.push(material);
        });

        // Group by approval status for summary
        const pending = materials.filter(m => m.approvalStatus === 'Pending');
        const approved = materials.filter(m => m.approvalStatus === 'Approved');
        const rejected = materials.filter(m => m.approvalStatus === 'Rejected');

        let html = '';

        // Summary cards
        html += `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
                <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 25px; border-radius: 12px; color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <div style="font-size: 2rem; font-weight: bold; margin-bottom: 5px;">${pending.length}</div>
                    <div style="font-size: 0.9rem; opacity: 0.95;"><i class="fas fa-clock"></i> Pending Approval</div>
                </div>
                <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 25px; border-radius: 12px; color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <div style="font-size: 2rem; font-weight: bold; margin-bottom: 5px;">${approved.length}</div>
                    <div style="font-size: 0.9rem; opacity: 0.95;"><i class="fas fa-check-circle"></i> Approved</div>
                </div>
                <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 25px; border-radius: 12px; color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <div style="font-size: 2rem; font-weight: bold; margin-bottom: 5px;">${rejected.length}</div>
                    <div style="font-size: 0.9rem; opacity: 0.95;"><i class="fas fa-times-circle"></i> Needs Correction</div>
                </div>
            </div>
        `;

        // Display materials grouped by course
        html += '<h3 style="margin: 30px 0 20px; color: #333;"><i class="fas fa-layer-group"></i> Materials by Course</h3>';

        Object.keys(groupedByCourse).forEach(courseId => {
            const courseGroup = groupedByCourse[courseId];
            const courseMaterials = courseGroup.materials;

            // Count statuses for this course
            const coursePending = courseMaterials.filter(m => m.approvalStatus === 'Pending').length;
            const courseApproved = courseMaterials.filter(m => m.approvalStatus === 'Approved').length;
            const courseRejected = courseMaterials.filter(m => m.approvalStatus === 'Rejected').length;

            html += `
                <div style="background: white; border-radius: 12px; padding: 25px; margin-bottom: 25px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #f0f0f0;">
                        <div>
                            <h4 style="margin: 0; color: var(--color-golden); font-size: 1.3rem;">
                                <i class="fas fa-book-open"></i> ${courseGroup.title}
                            </h4>
                            <p style="margin: 5px 0 0 0; color: #666; font-size: 0.9rem;">
                                ${courseMaterials.length} material(s) uploaded
                            </p>
                        </div>
                        <div style="display: flex; gap: 15px; font-size: 0.85rem;">
                            ${coursePending > 0 ? `<span style="color: var(--color-saffron); font-weight: 600;"><i class="fas fa-clock"></i> ${coursePending} Pending</span>` : ''}
                            ${courseApproved > 0 ? `<span style="color: var(--color-success); font-weight: 600;"><i class="fas fa-check"></i> ${courseApproved} Approved</span>` : ''}
                            ${courseRejected > 0 ? `<span style="color: var(--color-error); font-weight: 600;"><i class="fas fa-times"></i> ${courseRejected} Rejected</span>` : ''}
                        </div>
                    </div>
                    <div>
                        ${courseMaterials.map(m => renderMaterialCard(m, m.approvalStatus !== 'Approved')).join('')}
                    </div>
                </div>
            `;
        });

        list.innerHTML = html;
    } catch (err) {
        console.error(err);
        UI.error('Failed to load materials');
    } finally {
        UI.hideLoader();
    }
}

function renderMaterialCard(material, canEdit) {
    const statusColors = {
        'Pending': 'var(--color-saffron)',
        'Approved': 'var(--color-success)',
        'Rejected': 'var(--color-error)'
    };

    const icons = {
        'video': 'fa-video',
        'pdf': 'fa-file-pdf',
        'audio': 'fa-music'
    };

    return `
        <div class="course-list-item" style="margin-bottom: 15px;">
            <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <i class="fas ${icons[material.category] || 'fa-file'}" 
                       style="font-size: 1.5rem; color: ${statusColors[material.approvalStatus]};"></i>
                    <div>
                        <strong>${material.title}</strong>
                        <p style="font-size: 0.85rem; color: var(--color-text-secondary); margin-top: 5px;">
                            ${material.type} | 
                            <span style="color: ${statusColors[material.approvalStatus]}; font-weight: 600;">
                                ${material.approvalStatus}
                            </span>
                        </p>
                        ${material.rejectionReason ? `
                            <div style="background: rgba(239, 68, 68, 0.1); padding: 10px; border-radius: 8px; margin-top: 10px;">
                                <strong style="color: var(--color-error); font-size: 0.85rem;">
                                    <i class="fas fa-exclamation-circle"></i> Corrections Needed:
                                </strong>
                                <p style="color: var(--color-error); font-size: 0.85rem; margin-top: 5px;">
                                    ${material.rejectionReason}
                                </p>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            <div style="display: flex; gap: 10px;">
                ${canEdit ? `
                    <button class="btn-primary" onclick="openEditMaterial('${material._id}')" 
                            style="padding: 8px 16px; font-size: 0.85rem; background: var(--color-golden);">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                ` : `
                    <button class="btn-primary" onclick="viewMaterial('${material._id}')" 
                            style="padding: 8px 16px; font-size: 0.85rem;">
                        <i class="fas fa-eye"></i> View
                    </button>
                `}
            </div>
        </div>
    `;
}

async function openEditMaterial(materialId) {
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/courses/materials/${materialId}`, {
            headers: Auth.getHeaders()
        });

        if (!res.ok) throw new Error('Failed to load material');

        const material = await res.json();

        // Populate edit form
        document.getElementById('editMaterialId').value = material._id;
        document.getElementById('editMaterialTitle').value = material.title;
        document.getElementById('editMaterialType').value = material.type;
        document.getElementById('editPreviewDuration').value = material.previewDuration || 30;

        // Show modal
        document.getElementById('editMaterialModal').style.display = 'flex';
    } catch (err) {
        console.error(err);
        UI.error('Failed to load material for editing');
    } finally {
        UI.hideLoader();
    }
}

document.getElementById('closeEditMaterialModal').addEventListener('click', () => {
    document.getElementById('editMaterialModal').style.display = 'none';
    document.getElementById('editMaterialForm').reset();
});

document.getElementById('editMaterialForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const materialId = document.getElementById('editMaterialId').value;
    const formData = new FormData();

    formData.append('title', document.getElementById('editMaterialTitle').value);
    formData.append('previewDuration', document.getElementById('editPreviewDuration').value);

    const fileInput = document.getElementById('editMaterialFile');
    if (fileInput.files[0]) {
        formData.append('file', fileInput.files[0]);
    }

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Updating...';
    btn.disabled = true;

    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/courses/materials/${materialId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: formData
        });

        if (res.ok) {
            UI.success('Material updated successfully!');
            document.getElementById('editMaterialModal').style.display = 'none';
            loadMyMaterials(); // Reload the list
        } else {
            const err = await res.json();
            UI.error('Update failed: ' + err.message);
        }
    } catch (err) {
        console.error(err);
        UI.error('Update failed. Please try again.');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
        UI.hideLoader();
    }
});

let currentViewMaterialUrl = null;

async function viewMaterial(materialId) {
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/courses/materials/${materialId}`, {
            headers: Auth.getHeaders()
        });

        if (!res.ok) throw new Error('Failed to load material');

        const material = await res.json();
        currentViewMaterialUrl = material.fileUrl;

        const statusColors = {
            'Pending': 'var(--color-saffron)',
            'Approved': 'var(--color-success)',
            'Rejected': 'var(--color-error)'
        };

        const icons = {
            'video': 'fa-video',
            'pdf': 'fa-file-pdf',
            'audio': 'fa-music'
        };

        // Build preview content based on file type
        let previewHTML = '';
        const fileUrl = material.fileUrl;

        if (material.category === 'video' && fileUrl) {
            previewHTML = `
                <div style="margin: 20px 0; background: #000; border-radius: 8px; overflow: hidden;">
                    <video controls style="width: 100%; max-height: 400px;">
                        <source src="${fileUrl}" type="video/mp4">
                        Your browser does not support video playback.
                    </video>
                </div>
            `;
        } else if (material.category === 'pdf' && fileUrl) {
            previewHTML = `
                <div style="margin: 20px 0; background: #f5f5f5; border-radius: 8px; padding: 20px; text-align: center;">
                    <i class="fas fa-file-pdf" style="font-size: 4rem; color: #dc3545; margin-bottom: 15px;"></i>
                    <p style="font-weight: 600; margin-bottom: 10px;">PDF Document</p>
                    <p style="font-size: 0.9rem; color: #666;">Click "Download" below to view the PDF file.</p>
                </div>
            `;
        } else if (material.category === 'audio' && fileUrl) {
            previewHTML = `
                <div style="margin: 20px 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; padding: 30px; text-align: center;">
                    <i class="fas fa-music" style="font-size: 3rem; color: white; margin-bottom: 15px;"></i>
                    <audio controls style="width: 100%; margin-top: 10px;">
                        <source src="${fileUrl}" type="audio/mpeg">
                        Your browser does not support audio playback.
                    </audio>
                </div>
            `;
        }

        document.getElementById('viewMaterialContent').innerHTML = `
            <div style="text-align: center; margin-bottom: 25px;">
                <div style="width: 80px; height: 80px; background: ${statusColors[material.approvalStatus]}20; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;">
                    <i class="fas ${icons[material.category] || 'fa-file'}" style="color: ${statusColors[material.approvalStatus]}; font-size: 2.5rem;"></i>
                </div>
                <h3 style="margin: 0 0 10px 0; color: #333;">${material.title}</h3>
                <span style="padding: 5px 12px; background: ${statusColors[material.approvalStatus]}20; color: ${statusColors[material.approvalStatus]}; border-radius: 15px; font-size: 0.85rem; font-weight: 600;">
                    ${material.approvalStatus}
                </span>
            </div>
            
            ${previewHTML}
            
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
                <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
                    <div style="font-size: 0.8rem; color: #999; margin-bottom: 5px;">Type</div>
                    <div style="font-weight: 600;">${material.type}</div>
                </div>
                <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
                    <div style="font-size: 0.8rem; color: #999; margin-bottom: 5px;">Category</div>
                    <div style="font-weight: 600;">${material.category.toUpperCase()}</div>
                </div>
                <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
                    <div style="font-size: 0.8rem; color: #999; margin-bottom: 5px;">Course</div>
                    <div style="font-weight: 600;">${material.courseID?.title || 'Unknown'}</div>
                </div>
                <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
                    <div style="font-size: 0.8rem; color: #999; margin-bottom: 5px;">File Size</div>
                    <div style="font-weight: 600;">${material.fileSize ? (material.fileSize / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown'}</div>
                </div>
                <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
                    <div style="font-size: 0.8rem; color: #999; margin-bottom: 5px;">Uploaded On</div>
                    <div style="font-weight: 600;">${new Date(material.createdAt).toLocaleDateString()}</div>
                </div>
                <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
                    <div style="font-size: 0.8rem; color: #999; margin-bottom: 5px;">Preview Duration</div>
                    <div style="font-weight: 600;">${material.previewDuration || 0} seconds</div>
                </div>
            </div>
            
            ${material.adminRemarks ? `
                <div style="padding: 15px; background: #e3f2fd; border-left: 4px solid #2196f3; border-radius: 8px; margin-bottom: 15px;">
                    <div style="font-size: 0.8rem; color: #1976d2; font-weight: 600; margin-bottom: 5px;">Admin Remarks:</div>
                    <div style="color: #333;">${material.adminRemarks}</div>
                </div>
            ` : ''}
            
            ${material.rejectionReason ? `
                <div style="padding: 15px; background: #f8d7da; border-left: 4px solid #dc3545; border-radius: 8px; margin-bottom: 15px;">
                    <div style="font-size: 0.8rem; color: #721c24; font-weight: 600; margin-bottom: 5px;">
                        <i class="fas fa-exclamation-circle"></i> Rejection Reason:
                    </div>
                    <div style="color: #333;">${material.rejectionReason}</div>
                </div>
            ` : ''}
        `;

        // Show modal
        document.getElementById('viewMaterialModal').style.display = 'flex';
    } catch (err) {
        console.error(err);
        UI.error('Failed to load material details');
    } finally {
        UI.hideLoader();
    }
}

// Close view modal handler
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('closeViewMaterialModal')?.addEventListener('click', () => {
        document.getElementById('viewMaterialModal').style.display = 'none';
        currentViewMaterialUrl = null;
    });

    document.getElementById('downloadMaterialBtn')?.addEventListener('click', () => {
        if (currentViewMaterialUrl) {
            window.open(currentViewMaterialUrl, '_blank');
        } else {
            UI.error('No file URL available');
        }
    });
});

// ============================================
// NEW UI ENHANCEMENTS
// ============================================

// Toggle Messages Panel
function toggleMessagesPanel() {
    const panel = document.getElementById('messagesPanel');
    if (panel) {
        panel.classList.toggle('open');
    }
}

// Load and Display Notifications
let allNotifications = [];
async function loadNotifications() {
    console.log('📬 Loading notifications...');
    const container = document.getElementById('notificationsList');
    
    if (!container) {
        console.error('❌ notificationsList container not found!');
        return;
    }

    // Show loading state
    container.innerHTML = '<p style="color: var(--color-text-secondary); text-align: center; padding: 20px;">Loading notifications...</p>';
    
    try {
        const url = `${Auth.apiBase}/staff/deleted-courses`;
        console.log('🌐 Fetching from:', url);
        
        const res = await fetch(url, {
            headers: Auth.getHeaders()
        });

        console.log('📡 Response status:', res.status);

        if (res.ok) {
            const deletedCourses = await res.json();
            console.log('📦 Deleted courses received:', deletedCourses);
            
            // Convert deleted courses to notification format
            allNotifications = deletedCourses.map(course => ({
                id: course._id,
                type: 'course_deleted',
                title: `Course "${course.title}" was deleted`,
                message: `Your course "${course.title}" (${course.category || 'General'}) has been removed from the platform by an administrator.`,
                timestamp: course.deletedAt || course.updatedAt || course.createdAt || new Date(),
                seen: false
            }));
            
            console.log('✅ Notifications created:', allNotifications.length);
        } else {
            console.warn('⚠️ Failed to fetch deleted courses:', res.status);
            const errorText = await res.text();
            console.warn('Error response:', errorText);
            allNotifications = [];
        }
    } catch (err) {
        console.error('❌ Error loading notifications:', err);
        allNotifications = [];
    } finally {
        // Always display notifications (even if empty)
        console.log('🎨 Displaying notifications...');
        displayNotifications(allNotifications);
        updateNotificationBadge();
    }
}

// Display Notifications in List
function displayNotifications(notifications) {
    console.log('🎨 displayNotifications called with', notifications.length, 'notifications');
    const container = document.getElementById('notificationsList');
    
    if (!container) {
        console.error('❌ notificationsList container not found in displayNotifications!');
        return;
    }

    if (notifications.length === 0) {
        console.log('📭 No notifications to display');
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--color-text-secondary);">
                <i class="fas fa-bell-slash" style="font-size: 48px; opacity: 0.3; margin-bottom: 16px;"></i>
                <p>No notifications</p>
            </div>
        `;
        return;
    }

    // Sort by date (newest first)
    notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    console.log('✅ Rendering', notifications.length, 'notifications');
    
    container.innerHTML = notifications.map(notif => `
        <div class="notification-item ${notif.seen ? 'seen' : 'unseen'}" data-id="${notif.id}">
            <div class="notification-content">
                <div class="notification-title">
                    ${notif.seen ? '' : '<span class="unread-dot"></span>'}
                    ${notif.title}
                </div>
                <div class="notification-message">${notif.message}</div>
                <div class="notification-time">${formatTimestamp(notif.timestamp)}</div>
            </div>
            <div class="notification-actions">
                ${notif.seen ? 
                    `<button onclick="markAsUnread('${notif.id}')" class="notification-action-btn" title="Mark as unread">
                        <i class="fas fa-envelope"></i>
                    </button>` :
                    `<button onclick="markAsSeen('${notif.id}')" class="notification-action-btn" title="Mark as read">
                        <i class="fas fa-envelope-open"></i>
                    </button>`
                }
                <button onclick="deleteNotification('${notif.id}')" class="notification-action-btn" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    console.log('✅ Notifications rendered successfully');
}

// Filter Notifications
function filterNotifications(filter) {
    // Get filter value from dropdown if not provided
    if (!filter) {
        const dropdown = document.getElementById('notificationFilter');
        filter = dropdown ? dropdown.value : 'all';
    }
    
    let filtered = [...allNotifications];
    
    if (filter === 'unseen') {
        filtered = filtered.filter(n => !n.seen);
    } else if (filter === 'seen') {
        filtered = filtered.filter(n => n.seen);
    }
    
    displayNotifications(filtered);
}

// Mark Notification as Seen
function markAsSeen(notificationId) {
    const notification = allNotifications.find(n => n.id === notificationId);
    if (notification) {
        notification.seen = true;
        displayNotifications(allNotifications);
        updateNotificationBadge();
    }
}

// Mark Notification as Unread
function markAsUnread(notificationId) {
    const notification = allNotifications.find(n => n.id === notificationId);
    if (notification) {
        notification.seen = false;
        displayNotifications(allNotifications);
        updateNotificationBadge();
    }
}

// Delete Notification
function deleteNotification(notificationId) {
    if (confirm('Delete this notification?')) {
        allNotifications = allNotifications.filter(n => n.id !== notificationId);
        displayNotifications(allNotifications);
        updateNotificationBadge();
    }
}

// Update Badge Count
function updateNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;
    
    const unseenCount = allNotifications.filter(n => !n.seen).length;
    
    if (unseenCount > 0) {
        badge.textContent = unseenCount > 99 ? '99+' : unseenCount;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

// Format Timestamp
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Search/Filter Functions for Courses
function searchCourses() {
    const searchTerm = document.getElementById('courseSearchInput')?.value.toLowerCase();
    const filterStatus = document.getElementById('courseStatusFilter')?.value;
    const courseCards = document.querySelectorAll('#courseList .course-list-item');
    
    courseCards.forEach(card => {
        const title = card.querySelector('strong')?.textContent.toLowerCase() || '';
        const statusSpan = card.querySelector('span[style*="background"]');
        const status = statusSpan?.textContent.toLowerCase() || '';
        
        const matchesSearch = !searchTerm || title.includes(searchTerm);
        const matchesFilter = !filterStatus || filterStatus === '' || status.includes(filterStatus.toLowerCase());
        
        card.style.display = matchesSearch && matchesFilter ? '' : 'none';
    });
}

// Search/Filter Functions for Materials
function searchMaterials() {
    const searchTerm = document.getElementById('materialSearchInput')?.value.toLowerCase();
    const filterType = document.getElementById('materialTypeFilter')?.value;
    const materialCards = document.querySelectorAll('#myMaterialsList .course-list-item');
    
    materialCards.forEach(card => {
        const title = card.querySelector('strong')?.textContent.toLowerCase() || '';
        const type = card.querySelector('p')?.textContent.toLowerCase() || '';
        
        const matchesSearch = !searchTerm || title.includes(searchTerm);
        const matchesFilter = !filterType || filterType === '' || type.includes(filterType.toLowerCase());
        
        card.style.display = matchesSearch && matchesFilter ? '' : 'none';
    });
}

// Search Students
function searchStudents() {
    const searchTerm = document.getElementById('studentSearchInput')?.value.toLowerCase();
    const filterCourse = document.getElementById('studentCourseFilter')?.value;
    const studentRows = document.querySelectorAll('#studentInsightList tr');
    
    studentRows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const courseId = row.getAttribute('data-course-id');
        
        const matchesSearch = !searchTerm || text.includes(searchTerm);
        const matchesCourse = !filterCourse || filterCourse === '' || courseId === filterCourse;
        
        row.style.display = matchesSearch && matchesCourse ? '' : 'none';
    });
}

// Make toggleMessagesPanel global for onclick attribute
window.toggleMessagesPanel = toggleMessagesPanel;
window.markAsSeen = markAsSeen;
window.markAsUnread = markAsUnread;
window.deleteNotification = deleteNotification;

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    // Don't load notifications on page load, only when tab is clicked
    // loadNotifications() will be called by switchSection('notifications')
    
    // Setup search/filter event listeners
    document.getElementById('courseSearchInput')?.addEventListener('input', searchCourses);
    document.getElementById('courseStatusFilter')?.addEventListener('change', searchCourses);
    document.getElementById('materialSearchInput')?.addEventListener('input', searchMaterials);
    document.getElementById('materialTypeFilter')?.addEventListener('change', searchMaterials);
    document.getElementById('studentSearchInput')?.addEventListener('input', searchStudents);
    document.getElementById('studentCourseFilter')?.addEventListener('change', searchStudents);
});