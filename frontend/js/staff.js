/**
 * InnerSpark - Staff Dashboard Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verify Auth
    const authData = Auth.checkAuth(['Staff']);
    if (!authData) return;

    const { user } = authData;
    document.getElementById('mentorName').textContent = user.name;

    // 2. Modals Logic
    const courseModal = document.getElementById('courseModal');
    const uploadModal = document.getElementById('uploadModal');

    document.getElementById('newCourseBtn').addEventListener('click', () => courseModal.style.display = 'flex');
    document.getElementById('closeModal').addEventListener('click', () => courseModal.style.display = 'none');
    document.getElementById('closeUploadModal').addEventListener('click', () => uploadModal.style.display = 'none');

    // 3. Load Courses
    loadCourses();

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
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.textContent = 'Transmitting...';
        btn.disabled = true;

        try {
            UI.showLoader();
            const res = await fetch(`${Auth.apiBase}/staff/content`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: formData
            });

            if (res.ok) {
                UI.success("Material transmitted! Awaiting Admin's enlightenment.");
                uploadModal.style.display = 'none';
            } else {
                const err = await res.json();
                UI.error('Transmission failed: ' + err.message);
            }
        } catch (err) {
            UI.error('The signal is lost in the void.');
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

let currentSection = 'courses';

function switchSection(section) {
    currentSection = section;
    const sections = ['courses', 'students', 'live'];
    sections.forEach(s => {
        document.getElementById(s + 'Section').style.display = s === section ? 'block' : 'none';
    });

    // Update Nav
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('onclick')?.includes(section)) link.classList.add('active');
    });

    if (section === 'students') loadStudentInsights();
    if (section === 'live') loadSchedules();
    if (section === 'courses') loadCourses();
}

async function loadStudentInsights() {
    const list = document.getElementById('studentInsightList');
    try {
        const res = await fetch(`${Auth.apiBase}/staff/students`, { headers: Auth.getHeaders() });
        const enrollments = await res.json();

        if (enrollments.length === 0) {
            list.innerHTML = '<tr><td colspan="4" style="padding:20px; text-align:center;">No seekers have joined your paths yet.</td></tr>';
            return;
        }

        list.innerHTML = enrollments.map(e => `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 15px; display: flex; align-items: center; gap: 10px;">
                    <img src="${e.studentID?.profilePic || '../assets/default-avatar.png'}" style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover;">
                    <div>
                        <div style="font-weight: 600;">${e.studentID?.name}</div>
                        <div style="font-size: 0.75rem; color: #999;">${e.studentID?.email}</div>
                    </div>
                </td>
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

        list.innerHTML = courses.map(c => `
            <div class="course-list-item">
                <div>
                    <strong>${c.title}</strong>
                    <p style="font-size: 0.8rem; color: var(--color-text-secondary);">${c.category} | status: <span style="color: var(--color-saffron)">${c.status}</span></p>
                </div>
                <div>
                    <button class="btn-primary" onclick="openUploadModal('${c._id}', '${c.title}')" style="background: var(--color-golden); padding: 5px 15px; font-size: 0.8rem;">+ Add Content</button>
                    <button class="btn-primary" style="padding: 5px 15px; font-size: 0.8rem;">Edit</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error(err);
    }
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
