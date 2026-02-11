/**
 * Staff Assessment Management Functions
 */

let currentEditingExamId = null;

async function loadMyAssessments() {
    const list = document.getElementById('assessmentsList');
    
    // Show loading state
    list.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: var(--color-saffron); margin-bottom: 20px;"></i>
            <h4 style="color: #666;">Loading Your Assessments...</h4>
        </div>
    `;
    
    try {
        const res = await fetch(`${Auth.apiBase}/exams/my-assessments`, {
            headers: Auth.getHeaders()
        });
        
        if (!res.ok) throw new Error('Failed to fetch assessments');
        
        const assessments = await res.json();
        
        if (assessments.length === 0) {
            list.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                    <i class="fas fa-clipboard-check" style="font-size: 4rem; color: #ddd; margin-bottom: 20px;"></i>
                    <h4 style="color: #666; margin-bottom: 10px;">No Assessments Created Yet</h4>
                    <p style="color: #999; margin-bottom: 25px;">Create your first assessment to evaluate student learning</p>
                    <button class="btn-primary" onclick="document.getElementById('newExamBtn').click()" 
                            style="background: var(--color-golden);">
                        <i class="fas fa-plus"></i> Create First Assessment
                    </button>
                </div>
            `;
            return;
        }
        
        list.innerHTML = assessments.map(exam => {
            const statusColors = {
                'Pending': { bg: '#fff3cd', border: '#ffc107', text: '#856404', icon: 'hourglass-half' },
                'Approved': { bg: '#d4edda', border: '#28a745', text: '#155724', icon: 'check-circle' },
                'Rejected': { bg: '#f8d7da', border: '#dc3545', text: '#721c24', icon: 'times-circle' }
            };
            
            const status = statusColors[exam.approvalStatus] || statusColors['Pending'];
            
            return `
                <div class="assessment-card glass-card" style="padding: 0; overflow: hidden; border-left: 4px solid ${status.border}; transition: all 0.3s ease;">
                    <div style="padding: 20px;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                            <div style="flex: 1;">
                                <h4 style="margin: 0 0 8px 0; color: #333; font-size: 1.2rem;">
                                    <i class="fas fa-clipboard-check" style="color: var(--color-saffron);"></i>
                                    ${exam.title}
                                </h4>
                                <p style="margin: 0; color: #666; font-size: 0.9rem;">
                                    <i class="fas fa-book"></i> ${exam.courseID?.title || 'Unknown Course'}
                                </p>
                            </div>
                            <span style="background: ${status.bg}; color: ${status.text}; padding: 6px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; border: 1px solid ${status.border}; white-space: nowrap;">
                                <i class="fas fa-${status.icon}"></i> ${exam.approvalStatus}
                            </span>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                            <div style="text-align: center;">
                                <div style="font-size: 0.75rem; color: #666; margin-bottom: 4px;">Questions</div>
                                <div style="font-size: 1.3rem; font-weight: bold; color: var(--color-saffron);">
                                    ${exam.questions?.length || 0}
                                </div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 0.75rem; color: #666; margin-bottom: 4px;">Duration</div>
                                <div style="font-size: 1.3rem; font-weight: bold; color: #17a2b8;">
                                    ${exam.duration} min
                                </div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 0.75rem; color: #666; margin-bottom: 4px;">Pass Score</div>
                                <div style="font-size: 1.3rem; font-weight: bold; color: #28a745;">
                                    ${exam.passingScore}%
                                </div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 0.75rem; color: #666; margin-bottom: 4px;">Threshold</div>
                                <div style="font-size: 1.3rem; font-weight: bold; color: #6c757d;">
                                    ${exam.activationThreshold}%
                                </div>
                            </div>
                        </div>
                        
                        ${exam.approvalStatus === 'Rejected' && exam.rejectionReason ? `
                            <div style="background: #f8d7da; border-left: 3px solid #dc3545; padding: 12px; border-radius: 6px; margin: 15px 0;">
                                <strong style="color: #721c24; font-size: 0.85rem;">
                                    <i class="fas fa-exclamation-triangle"></i> Rejection Reason:
                                </strong>
                                <p style="margin: 5px 0 0 0; color: #721c24; font-size: 0.9rem;">${exam.rejectionReason}</p>
                            </div>
                        ` : ''}
                        
                        <div style="font-size: 0.8rem; color: #999; margin-top: 12px;">
                            <i class="fas fa-clock"></i> Created ${new Date(exam.createdAt).toLocaleDateString()}
                        </div>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 15px; display: flex; gap: 10px; border-top: 1px solid #e0e0e0;">
                        <button onclick="viewAssessment('${exam._id}')" class="btn-primary" 
                                style="flex: 1; background: #17a2b8; padding: 10px;">
                            <i class="fas fa-eye"></i> Preview
                        </button>
                        <button onclick="editAssessment('${exam._id}')" class="btn-primary" 
                                style="flex: 1; background: var(--color-golden); padding: 10px;">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button onclick="deleteAssessment('${exam._id}', '${exam.title}')" class="btn-primary" 
                                style="flex: 1; background: #dc3545; padding: 10px;">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (err) {
        console.error('Error loading assessments:', err);
        list.innerHTML = '<p style="color: var(--color-error); text-align: center;">Failed to load assessments.</p>';
    }
}

async function viewAssessment(examId) {
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/exams/${examId}`, {
            headers: Auth.getHeaders()
        });
        const exam = await res.json();
        
        // Create preview modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content glass-card" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 15px 15px 0 0; color: white; margin: -20px -20px 20px -20px;">
                    <h2 style="margin: 0 0 10px 0; font-family: var(--font-heading);">
                        <i class="fas fa-clipboard-check"></i> ${exam.title}
                    </h2>
                    <p style="margin: 0; opacity: 0.9; font-size: 0.95rem;">
                        <i class="fas fa-book"></i> ${exam.courseID?.title || 'Unknown Course'}
                    </p>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px;">
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 0.85rem; color: #666; margin-bottom: 5px;">Total Questions</div>
                        <div style="font-size: 2rem; font-weight: bold; color: var(--color-saffron);">${exam.questions.length}</div>
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 0.85rem; color: #666; margin-bottom: 5px;">Duration</div>
                        <div style="font-size: 2rem; font-weight: bold; color: #17a2b8;">${exam.duration} min</div>
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 0.85rem; color: #666; margin-bottom: 5px;">Passing Score</div>
                        <div style="font-size: 2rem; font-weight: bold; color: #28a745;">${exam.passingScore}%</div>
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 0.85rem; color: #666; margin-bottom: 5px;">Activation Threshold</div>
                        <div style="font-size: 2rem; font-weight: bold; color: #6c757d;">${exam.activationThreshold}%</div>
                    </div>
                </div>
                
                <h3 style="color: var(--color-saffron); margin-bottom: 15px;">
                    <i class="fas fa-list"></i> Questions
                </h3>
                
                <div style="max-height: 400px; overflow-y: auto; padding-right: 10px;">
                    ${exam.questions.map((q, index) => `
                        <div style="background: white; border: 2px solid #e0e0e0; border-radius: 10px; padding: 20px; margin-bottom: 15px;">
                            <div style="font-weight: 600; margin-bottom: 12px; color: #333; font-size: 1.05rem;">
                                <span style="background: var(--color-saffron); color: white; padding: 4px 10px; border-radius: 5px; margin-right: 10px;">${index + 1}</span>
                                ${q.questionText}
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-left: 35px;">
                                ${q.options.map((opt, i) => {
                                    const isCorrect = q.correctOptionIndices.includes(i);
                                    return `
                                        <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: ${isCorrect ? '#d4edda' : '#f8f9fa'}; border-radius: 6px; ${isCorrect ? 'border: 2px solid #28a745;' : 'border: 1px solid #e0e0e0;'}">
                                            <span style="background: ${isCorrect ? '#28a745' : '#6c757d'}; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">
                                                ${String.fromCharCode(65 + i)}
                                            </span>
                                            <span style="flex: 1;">${opt}</span>
                                            ${isCorrect ? '<i class="fas fa-check-circle" style="color: #28a745; font-size: 1.2rem;"></i>' : ''}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <button onclick="this.closest('.modal').remove()" class="btn-primary" 
                        style="width: 100%; margin-top: 20px; padding: 12px; background: #6c757d;">
                    <i class="fas fa-times"></i> Close
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
    } catch (err) {
        console.error('Error viewing assessment:', err);
        UI.error('Failed to load assessment details');
    } finally {
        UI.hideLoader();
    }
}

async function editAssessment(examId) {
    try {
        UI.showLoader();
        
        // Fetch both exam data and courses in parallel
        const [examRes, coursesRes] = await Promise.all([
            fetch(`${Auth.apiBase}/exams/${examId}`, { headers: Auth.getHeaders() }),
            fetch(`${Auth.apiBase}/staff/courses`, { headers: Auth.getHeaders() })
        ]);
        
        if (!examRes.ok || !coursesRes.ok) {
            throw new Error('Failed to fetch data');
        }
        
        const exam = await examRes.json();
        const courses = await coursesRes.json();
        
        // Ensure courses is an array
        const coursesArray = Array.isArray(courses) ? courses : [];
        
        currentEditingExamId = examId;
        
        // Populate course dropdown first
        const courseSelect = document.getElementById('examCourseSelect');
        courseSelect.innerHTML = '<option value="">Choose a course...</option>' + 
            coursesArray.map(c => `<option value="${c._id}">${c.title}</option>`).join('');
        
        // Populate form with existing data
        document.getElementById('examCourseSelect').value = exam.courseID._id;
        document.getElementById('examTitle').value = exam.title;
        document.getElementById('examDuration').value = exam.duration;
        document.getElementById('examPassingScore').value = exam.passingScore;
        document.getElementById('examThreshold').value = exam.activationThreshold;
        
        // Clear and populate questions
        const container = document.getElementById('questionContainer');
        container.innerHTML = '';
        qCount = 0;
        
        exam.questions.forEach(q => {
            addQuestionField();
            const blocks = document.querySelectorAll('.q-block');
            const currentBlock = blocks[blocks.length - 1];
            
            currentBlock.querySelector('.q-text').value = q.questionText;
            const optInputs = currentBlock.querySelectorAll('.opt-text');
            q.options.forEach((opt, i) => {
                if (optInputs[i]) optInputs[i].value = opt;
            });
            
            // Set correct answers
            const optionLabels = currentBlock.querySelectorAll('.option-label');
            q.correctOptionIndices.forEach(idx => {
                if (optionLabels[idx]) {
                    optionLabels[idx].dataset.correct = 'true';
                    optionLabels[idx].style.background = '#28a745';
                    optionLabels[idx].style.borderColor = '#28a745';
                }
            });
        });
        
        // Change form submit to update mode
        const form = document.getElementById('examForm');
        form.onsubmit = handleUpdateExam;
        
        // Change submit button text
        document.getElementById('examSubmitBtn').innerHTML = '<i class="fas fa-save"></i> Update Assessment';
        
        // Open modal
        document.getElementById('examModal').style.display = 'flex';
        currentExamStep = 1;
        updateExamStepUI();
        
    } catch (err) {
        console.error('Error loading assessment for edit:', err);
        UI.error('Failed to load assessment');
    } finally {
        UI.hideLoader();
    }
}

async function handleUpdateExam(e) {
    e.preventDefault();
    
    if (!validateExamStep(3)) return;
    
    const formData = new FormData(e.target);
    const data = {
        courseID: formData.get('courseID'),
        title: formData.get('title').trim(), // Ensure consistent title formatting
        duration: parseInt(formData.get('duration')),
        passingScore: parseInt(formData.get('passingScore')),
        activationThreshold: parseInt(formData.get('activationThreshold')),
        questions: []
    };

    const qBlocks = document.querySelectorAll('.q-block');
    qBlocks.forEach(block => {
        const q = block.querySelector('.q-text').value;
        const opts = Array.from(block.querySelectorAll('.opt-text')).map(input => input.value);
        
        const correctIndices = [];
        const optionLabels = block.querySelectorAll('.option-label');
        optionLabels.forEach((label, index) => {
            if (label.dataset.correct === 'true') {
                correctIndices.push(index);
            }
        });
        
        data.questions.push({ 
            question: q, 
            options: opts, 
            correctAnswerIndices: correctIndices 
        });
    });

    try {
        UI.showLoader();
        
        console.log(`[UPDATE] Updating assessment ${currentEditingExamId} with data:`, data);
        
        const res = await fetch(`${Auth.apiBase}/exams/${currentEditingExamId}`, {
            method: 'PUT',
            headers: Auth.getHeaders(),
            body: JSON.stringify(data)
        });
        
        const result = await res.json();
        
        if (res.ok) {
            UI.success('Assessment updated successfully! Your changes have been submitted for admin review.');
            document.getElementById('examModal').style.display = 'none';
            resetExamForm();
            
            // Reset form submit handler
            document.getElementById('examForm').onsubmit = null;
            document.getElementById('examSubmitBtn').innerHTML = '<i class="fas fa-check"></i> Create Assessment';
            currentEditingExamId = null;
            
            // Reload the assessments list to see updated status
            loadMyAssessments();
        } else {
            console.error('Update failed:', result);
            UI.error(result.message || 'Update failed');
        }
    } catch (err) { 
        console.error('Exam update error:', err);
        UI.error('Assessment update failed. Please try again.'); 
    }
    finally { UI.hideLoader(); }
}

async function deleteAssessment(examId, title) {
    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
        return;
    }
    
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/exams/${examId}`, {
            method: 'DELETE',
            headers: Auth.getHeaders()
        });
        
        if (res.ok) {
            UI.success('Assessment deleted successfully');
            loadMyAssessments();
        } else {
            const result = await res.json();
            UI.error(result.message || 'Delete failed');
        }
    } catch (err) {
        console.error('Error deleting assessment:', err);
        UI.error('Failed to delete assessment');
    } finally {
        UI.hideLoader();
    }
}
