// ========== MATERIALS MANAGEMENT FOR ADMIN ==========

let currentMaterialsCourseId = null;
let currentMaterialsData = null;
let currentMaterialId = null;

async function openMaterialsModal(courseId, courseTitle) {
    currentMaterialsCourseId = courseId;

    try {
        UI.showLoader();

        // Fetch materials for this course
        const res = await fetch(`${Auth.apiBase}/courses/${courseId}/materials`, {
            headers: Auth.getHeaders()
        });

        if (!res.ok) throw new Error('Failed to fetch materials');

        currentMaterialsData = await res.json();

        // Update course name in modal
        document.getElementById('materialsCourseName').textContent = courseTitle;

        // Render stats
        renderMaterialStats(currentMaterialsData.stats);

        // Render materials by category
        renderMaterialsByCategory(currentMaterialsData.materials);

        // Render pending approvals
        renderPendingApprovals(currentMaterialsData.materials);

        // Show modal
        document.getElementById('materialsModal').style.display = 'flex';

    } catch (error) {
        console.error(error);
        UI.error('Failed to load materials');
    } finally {
        UI.hideLoader();
    }
}

function closeMaterialsModal() {
    document.getElementById('materialsModal').style.display = 'none';
    currentMaterialsCourseId = null;
    currentMaterialsData = null;
}

function renderMaterialStats(stats) {
    const statsContainer = document.getElementById('materialStats');

    statsContainer.innerHTML = `
        <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; color: white;">
            <div style="font-size: 2.2rem; font-weight: 700; margin-bottom: 5px;">${stats.total}</div>
            <div style="font-size: 0.85rem; opacity: 0.9;">Total Materials</div>
        </div>
        <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 10px; color: white;">
            <div style="font-size: 2.2rem; font-weight: 700; margin-bottom: 5px;">${stats.byCategory.pdf}</div>
            <div style="font-size: 0.85rem; opacity: 0.9;"><i class="fas fa-file-pdf"></i> PDFs</div>
        </div>
        <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); border-radius: 10px; color: white;">
            <div style="font-size: 2.2rem; font-weight: 700; margin-bottom: 5px;">${stats.byCategory.video}</div>
            <div style="font-size: 0.85rem; opacity: 0.9;"><i class="fas fa-video"></i> Videos</div>
        </div>
        <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); border-radius: 10px; color: white;">
            <div style="font-size: 2.2rem; font-weight: 700; margin-bottom: 5px;">${stats.byCategory.audio}</div>
            <div style="font-size: 0.85rem; opacity: 0.9;"><i class="fas fa-headphones"></i> Audio</div>
        </div>
        <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%); border-radius: 10px; color: white;">
            <div style="font-size: 2.2rem; font-weight: 700; margin-bottom: 5px;">${stats.byCategory.module || 0}</div>
            <div style="font-size: 0.85rem; opacity: 0.9;"><i class="fas fa-layer-group"></i> Modules</div>
        </div>
    `;
}

function renderMaterialsByCategory(materials) {
    const container = document.getElementById('materialsByCategory');

    const paramMaterials = materials || []; // Safety check
    const approved = paramMaterials.filter(m => m.approvalStatus === 'Approved');
    const categories = ['module', 'pdf', 'video', 'audio'];

    let html = '';

    categories.forEach(cat => {
        const categoryMaterials = approved.filter(m => m.category === cat);

        if (categoryMaterials.length === 0) return;

        const icons = {
            'pdf': 'fa-file-pdf',
            'video': 'fa-video',
            'audio': 'fa-headphones',
            'module': 'fa-layer-group'
        };

        const colors = {
            'pdf': '#dc3545',
            'video': '#007bff',
            'audio': '#28a745',
            'module': '#6610f2'
        };

        html += `
            <div style="margin-bottom: 25px;">
                <h3 style="color: #333; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
                    <i class="fas ${icons[cat]}" style="color: ${colors[cat]};"></i>
                    ${cat.toUpperCase()} Materials (${categoryMaterials.length})
                </h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px;">
                    ${categoryMaterials.map(m => `
                        <div style="background: white; border: 1px solid #e0e0e0; border-radius: 10px; padding: 15px; cursor: pointer; transition: all 0.3s;"
                            onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'; this.style.transform='translateY(-2px)'"
                            onmouseout="this.style.boxShadow='none'; this.style.transform='translateY(0)'"
                            onmouseout="this.style.boxShadow='none'; this.style.transform='translateY(0)'"
                            onclick="viewMaterial('${m._id}', ${m.isModule})">
                            <div style="display: flex; align-items: start; gap: 12px;">
                                <div style="width: 40px; height: 40px; background: ${colors[cat]}20; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                    <i class="fas ${icons[cat]}" style="color: ${colors[cat]}; font-size: 1.2rem;"></i>
                                </div>
                                <div style="flex: 1; min-width: 0;">
                                    <div style="font-weight: 600; color: #333; margin-bottom: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${m.title}">
                                        ${m.title}
                                    </div>
                                    <div style="font-size: 0.75rem; color: #999;">
                                        Uploaded by ${m.uploadedBy?.name || 'Unknown'}
                                    </div>
                                    ${m.fileSize ? `
                                        <div style="font-size: 0.75rem; color: #666; margin-top: 5px;">
                                            ${(m.fileSize / 1024 / 1024).toFixed(2)} MB
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });

    if (html === '') {
        html = `
            <div style="text-align: center; padding: 40px; color: #999;">
                <i class="fas fa-folder-open" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                <p style="margin: 0;">No approved materials yet</p>
            </div>
        `;
    }

    container.innerHTML = html;
}

function renderPendingApprovals(materials) {
    const container = document.getElementById('pendingMaterialsList');
    const pending = materials.filter(m => m.approvalStatus === 'Pending');

    if (pending.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 30px; background: #f8f9fa; border-radius: 10px; color: #999;">
                <i class="fas fa-check-circle" style="font-size: 2.5rem; margin-bottom: 10px; color: var(--color-success);"></i>
                <p style="margin: 0;">All materials have been reviewed</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="background: #fff8e1; border-left: 4px solid #ffc107; border-radius: 8px; padding: 20px;">
            <div style="display: grid; gap: 15px;">
                ${pending.map(m => {
        const icons = {
            'pdf': 'fa-file-pdf',
            'video': 'fa-video',
            'audio': 'fa-headphones',
            'module': 'fa-layer-group'
        };

        const colors = {
            'pdf': '#dc3545',
            'video': '#007bff',
            'audio': '#28a745',
            'module': '#6610f2'
        };

        return `
                        <div style="background: white; border-radius: 8px; padding: 15px; display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; align-items: center; gap: 15px; flex: 1;">
                                <div style="width: 45px; height: 45px; background: ${colors[m.category]}20; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                                    <i class="fas ${icons[m.category]}" style="color: ${colors[m.category]}; font-size: 1.3rem;"></i>
                                </div>
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; color: #333; margin-bottom: 3px;">${m.title}</div>
                                    <div style="font-size: 0.8rem; color: #666;">
                                        Uploaded by ${m.uploadedBy?.name || 'Unknown'} 
                                        ${m.uploadedBy?.role === 'Staff' ? '<span style="background: #e3f2fd; color: #1976d2; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; margin-left: 5px;">STAFF</span>' : ''}
                                    </div>
                                    <div style="font-size: 0.75rem; color: #999; margin-top: 3px;">
                                        ${new Date(m.createdAt).toLocaleDateString()} • ${m.fileSize ? (m.fileSize / 1024 / 1024).toFixed(2) + ' MB' : 'Size unknown'}
                                    </div>
                                </div>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button class="btn-primary" 
                                    style="padding: 8px 15px; font-size: 0.85rem; background: var(--color-primary);"
                                    onclick="viewMaterialForApproval('${m._id}', ${m.isModule})"
                                    title="Review & Approve">
                                    <i class="fas fa-eye"></i> Review
                                </button>
                            </div>
                        </div>
                    `;
    }).join('')}
            </div>
        </div>
    `;
}

async function viewMaterial(materialId) {
    try {
        UI.showLoader();

        const res = await fetch(`${Auth.apiBase}/courses/materials/${materialId}`, {
            headers: Auth.getHeaders()
        });

        if (!res.ok) throw new Error('Failed to fetch material');

        const material = await res.json();

        // Show in action modal (view-only for approved materials)
        document.getElementById('materialActionTitle').textContent = 'Material Details';

        const icons = {
            'pdf': 'fa-file-pdf',
            'video': 'fa-video',
            'audio': 'fa-headphones'
        };

        const colors = {
            'pdf': '#dc3545',
            'video': '#007bff',
            'audio': '#28a745'
        };

        document.getElementById('materialActionContent').innerHTML = `
            <div style="text-align: center; margin-bottom: 25px;">
                <div style="width: 80px; height: 80px; background: ${colors[material.category]}20; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;">
                    <i class="fas ${icons[material.category]}" style="color: ${colors[material.category]}; font-size: 2.5rem;"></i>
                </div>
                <h3 style="margin: 0 0 10px 0; color: #333;">${material.title}</h3>
                <span style="padding: 5px 12px; background: #e6f4ea; color: #1e7e34; border-radius: 15px; font-size: 0.85rem; font-weight: 600;">
                    <i class="fas fa-check-circle"></i> Approved
                </span>
            </div>
            
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
                    <div style="font-size: 0.8rem; color: #999; margin-bottom: 5px;">Uploaded By</div>
                    <div style="font-weight: 600;">${material.uploadedBy?.name || 'Unknown'}</div>
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
                    <div style="font-size: 0.8rem; color: #999; margin-bottom: 5px;">Approved By</div>
                    <div style="font-weight: 600;">${material.approvedBy?.name || 'N/A'}</div>
                </div>
            </div>
            
            ${material.adminRemarks ? `
                <div style="padding: 15px; background: #e3f2fd; border-left: 4px solid #2196f3; border-radius: 8px;">
                    <div style="font-size: 0.8rem; color: #1976d2; font-weight: 600; margin-bottom: 5px;">Admin Remarks:</div>
                    <div style="color: #333;">${material.adminRemarks}</div>
                </div>
            ` : ''}
            
            <div style="margin-top: 20px; padding: 15px; background: #f0f0f0; border-radius: 8px;">
                <div style="font-size: 0.8rem; color: #666; margin-bottom: 8px;">File Path:</div>
                <div style="font-family: monospace; font-size: 0.85rem; color: #333; word-break: break-all;">${material.fileUrl}</div>
            </div>
        `;

        document.getElementById('materialActionFooter').innerHTML = `
            <button onclick="closeMaterialActionModal()" class="btn-primary" style="background: #999;">
                Close
            </button>
        `;

        document.getElementById('materialActionModal').style.display = 'flex';

    } catch (error) {
        console.error(error);
        UI.error('Failed to load material details');
    } finally {
        UI.hideLoader();
    }
}

let isCurrentItemModule = false;

async function viewMaterialForApproval(materialId, isModule = false) {
    try {
        currentMaterialId = materialId;
        isCurrentItemModule = isModule;

        let material;

        if (isModule) {
            // Find in local data first to avoid extra fetch if possible, or fetch from module API
            // The backend list didn't include full content for all modules to save bandwidth?
            // Let's fetch the single module
            UI.showLoader();
            const res = await fetch(`${Auth.apiBase}/modules/${materialId}`, { headers: Auth.getHeaders() });
            const data = await res.json();
            material = data.module;

            // Normalize for UI
            material.category = 'module';
            material.type = 'Module';
            material.uploadedBy = material.createdBy;
            material.fileUrl = '#';
            UI.hideLoader();
        } else {
            UI.showLoader();
            const res = await fetch(`${Auth.apiBase}/courses/materials/${materialId}`, { headers: Auth.getHeaders() });
            if (!res.ok) throw new Error('Failed to fetch material');
            material = await res.json();
            UI.hideLoader();
        }


        // Show in action modal with approval options
        document.getElementById('materialActionTitle').textContent = isModule ? 'Review Module' : 'Review Material';

        const icons = { 'pdf': 'fa-file-pdf', 'video': 'fa-video', 'audio': 'fa-headphones', 'module': 'fa-layer-group' };
        const colors = { 'pdf': '#dc3545', 'video': '#007bff', 'audio': '#28a745', 'module': '#6610f2' };
        const statusColors = { 'Pending': { bg: '#fff3cd', text: '#856404' }, 'Rejected': { bg: '#f8d7da', text: '#721c24' } };

        const statusColor = statusColors[material.approvalStatus] || statusColors['Pending'];

        const contentPreview = isModule
            ? `<div style="background:white; padding:15px; border:1px solid #eee; height:300px; overflow-y:auto;">${material.content}</div>`
            : `<div style="font-family: monospace; font-size: 0.85rem; color: #333; word-break: break-all;">${material.fileUrl}</div>`;

        document.getElementById('materialActionContent').innerHTML = `
            <div style="text-align: center; margin-bottom: 25px;">
                <div style="width: 80px; height: 80px; background: ${colors[material.category]}20; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;">
                    <i class="fas ${icons[material.category]}" style="color: ${colors[material.category]}; font-size: 2.5rem;"></i>
                </div>
                <h3 style="margin: 0 0 10px 0; color: #333;">${material.title}</h3>
                <span style="padding: 5px 12px; background: ${statusColor.bg}; color: ${statusColor.text}; border-radius: 15px; font-size: 0.85rem; font-weight: 600;">
                    ${material.approvalStatus}
                </span>
            </div>
            
            <div style="margin-bottom: 20px; padding: 15px; background: #f0f0f0; border-radius: 8px;">
                <div style="font-size: 0.8rem; color: #666; margin-bottom: 8px;">${isModule ? 'Content Preview:' : 'File Path:'}</div>
                ${contentPreview}
            </div>
            
            <div style="margin-top: 20px;">
                <label style="font-weight: 600; color: #333; margin-bottom: 8px; display: block;">Remarks:</label>
                <textarea id="materialRemarks" class="form-control" style="min-height: 100px;" placeholder="Enter remarks..."></textarea>
            </div>
        `;

        document.getElementById('materialActionFooter').innerHTML = `
            <button onclick="closeMaterialActionModal()" class="btn-primary" style="background: #999;">Cancel</button>
            <button onclick="approveMaterial()" class="btn-primary" style="background: var(--color-success);"><i class="fas fa-check"></i> Approve</button>
        `;

        document.getElementById('materialActionModal').style.display = 'flex';

    } catch (error) {
        console.error(error);
        UI.error('Failed to load details');
        UI.hideLoader();
    }
}

function closeMaterialActionModal() {
    document.getElementById('materialActionModal').style.display = 'none';
    currentMaterialId = null;
}

async function approveMaterial() {
    if (!currentMaterialId) return;
    const remarks = document.getElementById('materialRemarks').value.trim();

    try {
        UI.showLoader();
        let url, body;

        if (isCurrentItemModule) {
            // Use Admin Controller Review Endpoint
            url = `${Auth.apiBase}/admin/review`;
            body = {
                itemType: 'Module',
                itemID: currentMaterialId,
                status: 'Approved',
                adminRemarks: remarks
            };
        } else {
            // Legacy Content Endpoint
            url = `${Auth.apiBase}/courses/materials/${currentMaterialId}/approve`;
            body = { adminRemarks: remarks };
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: Auth.getHeaders(),
            body: JSON.stringify(body)
        });

        if (!res.ok) throw new Error('Failed to approval');

        UI.success('Approved successfully');
        closeMaterialActionModal();

        // Reload materials
        const courseTitle = document.getElementById('materialsCourseName').textContent;
        openMaterialsModal(currentMaterialsCourseId, courseTitle);

    } catch (error) {
        console.error(error);
        UI.error('Failed to approve');
    } finally {
        UI.hideLoader();
    }
}

async function requestMaterialCorrections() {
    if (!currentMaterialId) return;

    const rejectionReason = document.getElementById('materialRemarks').value.trim();

    if (!rejectionReason || rejectionReason.length < 10) {
        UI.error('Please provide detailed correction instructions (minimum 10 characters)');
        document.getElementById('materialRemarks').focus();
        return;
    }

    try {
        UI.showLoader();

        const res = await fetch(`${Auth.apiBase}/courses/materials/${currentMaterialId}/corrections`, {
            method: 'POST',
            headers: Auth.getHeaders(),
            body: JSON.stringify({ rejectionReason })
        });

        if (!res.ok) throw new Error('Failed to request corrections');

        UI.success('Corrections requested successfully. Staff will be notified.');
        closeMaterialActionModal();

        // Reload materials
        const courseTitle = document.getElementById('materialsCourseName').textContent;
        openMaterialsModal(currentMaterialsCourseId, courseTitle);

    } catch (error) {
        console.error(error);
        UI.error('Failed to request corrections');
    } finally {
        UI.hideLoader();
    }
}

function confirmDeleteMaterial(materialId, materialTitle) {
    currentMaterialId = materialId;

    document.getElementById('deleteMaterialInfo').innerHTML = `
        You are about to <strong>permanently delete</strong>:<br>
        <strong style="color: #333;">${materialTitle}</strong><br><br>
        This will remove the material from the course and cannot be recovered.
    `;

    document.getElementById('confirmDeleteMaterialBtn').onclick = deleteMaterialPermanently;

    // Close the action modal first
    closeMaterialActionModal();

    // Show delete confirmation
    document.getElementById('deleteMaterialModal').style.display = 'flex';
}

function closeDeleteMaterialModal() {
    document.getElementById('deleteMaterialModal').style.display = 'none';
    currentMaterialId = null;
}

async function deleteMaterialPermanently() {
    if (!currentMaterialId) return;

    try {
        UI.showLoader();

        const res = await fetch(`${Auth.apiBase}/courses/materials/${currentMaterialId}`, {
            method: 'DELETE',
            headers: Auth.getHeaders()
        });

        if (!res.ok) throw new Error('Failed to delete material');

        UI.success('Material deleted permanently');
        closeDeleteMaterialModal();

        // Reload materials
        const courseTitle = document.getElementById('materialsCourseName').textContent;
        openMaterialsModal(currentMaterialsCourseId, courseTitle);

    } catch (error) {
        console.error(error);
        UI.error('Failed to delete material');
    } finally {
        UI.hideLoader();
    }
}
