// ============================================================
// CAMPAIGN.JS – Handles: campaign.html, campaign-details.html, create-campaign.html
// Includes Review & Modify modal with custom reset confirmation
// ============================================================

import {
  loadDatabase,
  getCampaignById,
  getCampaignNames,
  createCampaign,
  getGoogleDriveSpreadsheets,
  getRecommendationBadgeClass,
  getStatusBadgeClass,
  sameId,
  refreshDatabase
} from '../Assets/js/dataService.js';
import { showToast } from '../Assets/js/toast.js';

let db = null;
let currentCampaignId = null;
const API_BASE = "https://acerecruitmentai.onrender.com/api";
const NOT_ASSESSED_FILTER = '__not_assessed__';

function recommendationCategoryFromValue(value) {
  const recommendation = String(value || '').trim().toLowerCase();
  if (!recommendation || /^(not assessed|n\/?a)$/i.test(recommendation)) return { value: NOT_ASSESSED_FILTER, label: 'Not Assessed', rank: 0 };
  if (recommendation.includes('excellent') || recommendation.includes('exceptional') || recommendation.includes('highly recommended')) return { value: 'excellent', label: 'Excellent', rank: 5 };
  if (recommendation.includes('conditional') || recommendation.includes('worth interviewing') || recommendation.includes('worth interview')) return { value: 'conditional', label: 'Conditional', rank: 3 };
  if (recommendation.includes('strong')) return { value: 'strong', label: 'Strong', rank: 4 };
  if (recommendation.includes('possible')) return { value: 'possible', label: 'Possible', rank: 2 };
  if (recommendation.includes('not recommended') || recommendation.includes('reject') || recommendation.includes('unsuitable')) return { value: 'not_recommended', label: 'Not Recommended', rank: 1 };
  return { value: 'other', label: 'Other', rank: 1 };
}

async function readApiError(response, fallback) {
  const raw = (await response.text()).trim();
  if (!raw) return fallback;
  try {
    const payload = JSON.parse(raw);
    return payload.message || payload.title || fallback;
  } catch {
    return raw;
  }
}


// ─── LOCALSTORAGE HELPERS ────────────────────────────────────────
function getMatrixKey(campaignId) {
  return `scoring_matrix_${campaignId}`;
}

function saveMatrix(campaignId, matrix) {
  localStorage.setItem(getMatrixKey(campaignId), JSON.stringify(matrix));
}

function loadMatrix(campaignId) {
  try {
    const data = localStorage.getItem(getMatrixKey(campaignId));
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

function resetMatrix(campaignId) {
  localStorage.removeItem(getMatrixKey(campaignId));
}

function getCriteriaKey(campaignId) {
  return `campaign_criteria_${campaignId}`;
}

function saveCriteria(campaignId, criteriaText) {
  localStorage.setItem(getCriteriaKey(campaignId), criteriaText);
}

function loadCriteria(campaignId) {
  return localStorage.getItem(getCriteriaKey(campaignId)) || '';
}

function getPdfInfoKey(campaignId) {
  return `campaign_pdf_info_${campaignId}`;
}

function savePdfInfo(campaignId, fileName, fileSize) {
  localStorage.setItem(getPdfInfoKey(campaignId), JSON.stringify({ fileName, fileSize, uploadedAt: new Date().toISOString() }));
}

function loadPdfInfo(campaignId) {
  try {
    const data = localStorage.getItem(getPdfInfoKey(campaignId));
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

// ─── RENDER CAMPAIGN LIST ────────────────────────────────────────
function renderCampaignTable(campaigns) {

    const list = document.getElementById('campaign-list');

    if (!list) return;

    if (!campaigns || campaigns.length === 0) {

        list.innerHTML =
            `<tr>
                <td colspan="7"
                    style="text-align:center;padding:2rem;color:var(--text-muted);">
                    No campaigns found
                </td>
            </tr>`;

        return;
    }

    const applicants = db?.applicants || [];

    list.innerHTML = campaigns.map(c => {

        const status =
            String(c.status || '')
                .trim()
                .toLowerCase();

        const statusClass = getStatusBadgeClass(status);

        const rowClass =
            status === 'inactive'
                ? 'row-status-closed'
                : '';

        const count =
            applicants.filter(
                a => sameId(a.campaignId, c.id)
            ).length;

        return `
            <tr class="${rowClass}" data-status="${status}">

                <td>
                    <a href="https://b3ngz.github.io/Campaign/campaign-details.html?id=${c.id}">
                        ${c.jobTitle}
                    </a>
                </td>

                <td>${c.clientName}</td>

                <td>${c.jobTitle}</td>

                <td>
                    <span class="badge ${statusClass}">
                        ${c.status}
                    </span>
                </td>

                <td>${count}</td>

                <td>
                    ${c.createdDate
                        ? new Date(c.createdDate).toLocaleDateString()
                        : 'N/A'}
                </td>

                <td>
                    <a
                        href="https://b3ngz.github.io/Campaign/campaign-details.html?id=${c.id}"
                        class="btn btn-secondary">
                        View
                    </a>
                </td>

            </tr>
        `;

    }).join('');

}

// ─── CAMPAIGN LIST PAGE ──────────────────────────────────────────
async function renderCampaignList() {
  console.log('Rendering campaign list');

  const statusDropdown = document.getElementById('status-filter');
  if (statusDropdown) {
    const statusItems = statusDropdown.querySelector('.dropdown-items');
    if (statusItems) {
      const statusOptions = [
        { value: 'all', label: 'All Statuses' },
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' }
      ];
      statusItems.innerHTML = statusOptions.map(opt =>
        `<div class="dropdown-item ${opt.value === 'all' ? 'active' : ''}" data-value="${opt.value}">${opt.label} <span class="check">✓</span></div>`
      ).join('');

      statusDropdown.addEventListener('dropdownChange', function(e) {
        const value = e.detail.value;
        const filtered =
    value === 'all'
        ? db.campaigns
        : db.campaigns.filter(
            c =>
                String(c.status)
                    .toLowerCase() === value
        );
      });
    }
  }

  const searchInput = document.getElementById('search-campaign');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      const query = this.value.toLowerCase().trim();
      const selectedValue = statusDropdown?.dataset?.value || 'all';
      const filtered =
    selectedValue === 'all'
        ? db.campaigns
        : db.campaigns.filter(
            c =>
                String(c.status)
                    .toLowerCase() === selectedValue
        );
      renderCampaignTable(searched);
    });
  }

  renderCampaignTable(db.campaigns);
}

// ─── RENDER SCORING MATRIX ──────────────────────────────────────
function renderScoringMatrix(campaign) {
  const container = document.getElementById('scoring-matrix');
  if (!container) return;

  const savedMatrix = loadMatrix(campaign.id);
  const matrix = savedMatrix || campaign.scoringMatrix;

  if (matrix) {
    container.innerHTML = Object.entries(matrix).map(([key, value]) =>
      `<tr><td>${key}</td><td>${value}%</td></tr>`
    ).join('');
  } else {
    container.innerHTML = '<tr><td colspan="2" style="text-align:center;color:var(--text-muted);">No scoring matrix available</td></tr>';
  }
}

// ─── SETUP MATRIX MODAL ─────────────────────────────────────────
function setupMatrixModal(campaign) {
  const modal = document.getElementById('matrixModal');
  const openBtn = document.getElementById('review-matrix-btn');
  const closeBtn = document.getElementById('close-matrix-modal');
  const cancelBtn = document.getElementById('cancel-matrix-btn');
  const resetBtn = document.getElementById('reset-matrix-btn');
  const form = document.getElementById('matrix-form');
  const fieldsContainer = document.getElementById('matrix-fields');

  // ─── Reset confirmation modal elements ──────────────────────
  const resetConfirmModal = document.getElementById('reset-confirm-modal');
  const confirmResetBtn = document.getElementById('confirm-reset-btn');
  const cancelResetBtn = document.getElementById('cancel-reset-btn');

  if (!modal || !openBtn) return;

  // ─── Open main modal ─────────────────────────────────────────
  openBtn.addEventListener('click', () => {
    const savedMatrix = loadMatrix(campaign.id);
    const currentMatrix = savedMatrix || campaign.scoringMatrix;

    if (!currentMatrix) {
      showToast('No scoring matrix to modify.', 'warning');
      return;
    }

    fieldsContainer.innerHTML = Object.entries(currentMatrix).map(([key, value]) => `
      <div>
        <label style="display:block;font-weight:600;margin-bottom:0.3rem;font-size:0.85rem;color:var(--text-secondary);">${key}</label>
        <input type="number" class="matrix-weight-input" data-key="${key}" value="${value}" min="0" max="100" style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--border-light);background:var(--bg-body);color:var(--text-primary);font-family:var(--font-base);" />
      </div>
    `).join('');

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  });

  // ─── Close main modal ────────────────────────────────────────
  function closeModal() {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') closeModal();
  });

  // ─── Reset functions ─────────────────────────────────────────
  function openResetConfirmModal() {
    resetConfirmModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeResetConfirmModal() {
    resetConfirmModal.style.display = 'none';
    document.body.style.overflow = '';
  }

  resetBtn.addEventListener('click', openResetConfirmModal);

  confirmResetBtn.addEventListener('click', () => {
    if (!campaign.scoringMatrix) {
      showToast('No original matrix to reset to.', 'warning');
      closeResetConfirmModal();
      return;
    }

    resetMatrix(campaign.id);

    const inputs = fieldsContainer.querySelectorAll('.matrix-weight-input');
    inputs.forEach(input => {
      const key = input.dataset.key;
      if (campaign.scoringMatrix[key] !== undefined) {
        input.value = campaign.scoringMatrix[key];
      }
    });

    renderScoringMatrix(campaign);
    closeResetConfirmModal();
    showToast('Matrix reset to original values.', 'info');
  });

  cancelResetBtn.addEventListener('click', closeResetConfirmModal);
  resetConfirmModal.addEventListener('click', (e) => {
    if (e.target === resetConfirmModal) closeResetConfirmModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && resetConfirmModal.style.display === 'flex') closeResetConfirmModal();
  });

  // ─── Save form ───────────────────────────────────────────────
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const inputs = fieldsContainer.querySelectorAll('.matrix-weight-input');
    const newMatrix = {};
    let total = 0;

    inputs.forEach(input => {
      const key = input.dataset.key;
      const value = parseInt(input.value);
      if (isNaN(value) || value < 0) {
        showToast(`Invalid weight for "${key}". Please enter a number between 0 and 100.`, 'error');
        return;
      }
      newMatrix[key] = value;
      total += value;
    });

    if (total !== 100) {
      if (!confirm(`The total weight is ${total}%. Do you want to save this?`)) {
        return;
      }
    }

    saveMatrix(campaign.id, newMatrix);
    renderScoringMatrix(campaign);
    closeModal();
    showToast('Scoring matrix updated successfully!', 'success');
  });
}

// ─── COMPARE APPLICANTS WITH CRITERIA ───────────────────────────
function compareApplicantsWithCriteria(campaignId, criteriaText) {
  const container = document.getElementById('comparison-list');
  const resultsContainer = document.getElementById('comparison-results');
  if (!container) return;

  if (!criteriaText || criteriaText.trim() === '') {
    showToast('No criteria to compare. Please upload and extract a PDF first.', 'warning');
    return;
  }

  const applicants = db.applicants.filter(a => sameId(a.campaignId, campaignId));
  if (applicants.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);">No applicants to compare.</p>';
    resultsContainer.style.display = 'block';
    return;
  }

  const keywords = criteriaText.toLowerCase().split(/[\s,.;:()\-]+/).filter(w => w.length > 3);
  const uniqueKeywords = [...new Set(keywords)];

  const scores = applicants.map(app => {
    const profileText = [
      app.fullName,
      app.currentPosition,
      app.employer,
      app.certificates || '',
      ...Object.values(app.additionalAnswers || {})
    ].join(' ').toLowerCase();

    let matchCount = 0;
    uniqueKeywords.forEach(keyword => {
      if (profileText.includes(keyword)) matchCount++;
    });

    const score = uniqueKeywords.length > 0 ? Math.round((matchCount / uniqueKeywords.length) * 100) : 0;

    return {
      ...app,
      matchScore: score,
      matchCount,
      totalKeywords: uniqueKeywords.length
    };
  });

  scores.sort((a, b) => b.matchScore - a.matchScore);

  container.innerHTML = scores.map((app, index) => {
    const scoreClass = app.matchScore >= 80 ? 'badge-excellent' :
                       app.matchScore >= 60 ? 'badge-strong' :
                       app.matchScore >= 40 ? 'badge-worth' :
                       app.matchScore >= 20 ? 'badge-possible' : 'badge-not';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0;border-bottom:1px solid var(--border-light);">
      <span><strong>#${index + 1}</strong> <a href="https://b3ngz.github.io/Applicants/applicant-details.html?id=${app.id}" style="color:var(--link-color);text-decoration:none;">${app.fullName}</a></span>
      <span><span class="badge ${scoreClass}">${app.matchScore}%</span> <span style="font-size:0.75rem;color:var(--text-muted);">(${app.matchCount}/${app.totalKeywords} keywords)</span></span>
    </div>`;
  }).join('');

  resultsContainer.style.display = 'block';
}

// ─── SETUP PDF EXTRACTION ──────────────────────────────────────
function setupPdfExtraction(campaignId) {
    const fileInput = document.getElementById("criteria-pdf-upload");
    const saveBtn = document.getElementById("save-criteria-btn");
    const compareBtn = document.getElementById("compare-with-applicants-btn");
    const textarea = document.getElementById("extracted-criteria");
    const statusEl = document.getElementById("criteria-status");

    if (!fileInput || !saveBtn || !compareBtn) return;
    if (saveBtn.dataset.criteriaHandlersBound === String(campaignId)) return;
    saveBtn.dataset.criteriaHandlersBound = String(campaignId);
    compareBtn.dataset.criteriaHandlersBound = String(campaignId);

    // Save (Upload Requirement PDF + AI Processing)
    saveBtn.addEventListener("click", async () => {

        const file = fileInput.files[0];

        if (!file) {
            showToast("Please select a Requirement PDF.", "warning");
            return;
        }

        if (file.type !== "application/pdf") {
            showToast("Only PDF files are allowed.", "error");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        try {

            saveBtn.disabled = true;
            compareBtn.disabled = true;

         

            const response = await fetch(
                `${API_BASE}/RequirementDocument/${campaignId}/process`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`
                    },
                    body: formData
                }
            );

            if (!response.ok)
                throw new Error(await readApiError(response, "Unable to process the criteria PDF."));

            const campaign = await response.json();

            if (textarea && campaign.requirementText) {
                textarea.value = campaign.requirementText;
            }

            statusEl.textContent = "✅ Requirement processed successfully.";

            showToast(
                "Requirement processed successfully.",
                "success"
            );

            await renderCampaignDetails();

        }
        catch (error) {

            console.error(error);

            statusEl.textContent = "❌ Failed to process requirement.";

            showToast(
                error.message || "Processing failed.",
                "error"
            );

        }
        finally {

           

            saveBtn.disabled = false;
            compareBtn.disabled = false;

        }

    });

    // Reassess Applicants
    compareBtn.addEventListener("click", async () => {

        try {

            saveBtn.disabled = true;
            compareBtn.disabled = true;

           

            const response = await fetch(
               `${API_BASE}/Campaign/${campaignId}/process-applicants`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`
                    }
                }
            );

            if (!response.ok)
                throw new Error(await readApiError(response, "Unable to process campaign applicants."));

            await renderCampaignDetails();

            showToast(
                "Assessment completed successfully.",
                "success"
            );

        }
        catch (error) {

            console.error(error);

            const message = /requirements? (?:have|has) not been processed|criteria.*not.*processed/i.test(error.message || '')
              ? "You haven't added and processed a criteria PDF yet. Upload one and click Save Criteria before processing applicants."
              : (error.message || "Unable to process campaign applicants.");

            showToast(message, "error");

        }
        finally {

            

            saveBtn.disabled = false;
            compareBtn.disabled = false;

        }

    });
}

// ─── CAMPAIGN DETAILS PAGE ───────────────────────────────────────
async function renderCampaignDetails() {
  console.log('Rendering campaign details');

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    document.getElementById('campaign-title').textContent = 'No campaign specified';
    return;
  }

  currentCampaignId = id;

  const campaign = await getCampaignById(id);
  if (!campaign) {
    document.getElementById('campaign-title').textContent = 'Campaign not found';
    return;
  }

  document.getElementById('campaign-title').textContent = campaign.jobTitle;
  document.getElementById('campaign-client').textContent = campaign.clientName;
  document.getElementById('campaign-job-title').textContent = campaign.jobTitle;
  document.getElementById('campaign-created').textContent = campaign.createdAt || 'N/A';

  const statusBadge = document.getElementById('campaign-status');
  if (statusBadge) {
    const statusClass = getStatusBadgeClass(campaign.status);
    statusBadge.textContent = campaign.status;
    statusBadge.className = 'badge ' + statusClass;
  }

  const applicants = db.applicants.filter(a => sameId(a.campaignId, campaign.id));
  const countEl = document.getElementById('campaign-applicants-count');
  if (countEl) countEl.textContent = applicants.length;

  const descEl = document.getElementById('campaign-description');
  if (descEl) descEl.textContent = campaign.jobDescription || 'No description provided.';

  const importBtn = document.getElementById('import-applicants-btn');
  const importStatus = document.getElementById('import-applicants-status');
  if (importBtn && !importBtn.dataset.bound) {
    importBtn.dataset.bound = 'true';
    importBtn.addEventListener('click', async () => {
      const label = importBtn.querySelector('span');
      const originalLabel = label?.textContent || 'Import Applicants';
      try {
        importBtn.disabled = true;
        importBtn.classList.add('is-loading');
        if (label) label.textContent = 'Importing…';
        if (importStatus) importStatus.textContent = 'Importing applicants from the connected campaign source.';

        const response = await fetch(`${API_BASE}/ApplicantImport/${encodeURIComponent(campaign.id)}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) {
          const message = (await response.text()).trim();
          throw new Error(message || `Applicant import failed (${response.status}).`);
        }

        db = await refreshDatabase();
        if (importStatus) importStatus.textContent = 'Applicants imported successfully.';
        showToast('Applicants imported successfully.', 'success');
        await renderCampaignDetails();
      } catch (error) {
        console.error('Applicant import failed:', error);
        if (importStatus) importStatus.textContent = 'Applicant import failed.';
        showToast(error.message || 'Unable to import applicants.', 'error');
      } finally {
        importBtn.disabled = false;
        importBtn.classList.remove('is-loading');
        if (label) label.textContent = originalLabel;
      }
    });
  }


  const applicantList = document.getElementById('applicant-list');
  const applicantRows = applicants.map(applicant => ({
    applicant,
    assessment: db.assessments.find(assessment => sameId(assessment.applicantId, applicant.id) && sameId(assessment.campaignId, applicant.campaignId))
  }));
  const recommendationFilter = document.getElementById('campaign-applicant-filter');
  const recommendationItems = recommendationFilter?.querySelector('.dropdown-items');
  const recommendationCategories = new Map();
  applicantRows.forEach(row => {
    const category = recommendationCategoryFromValue(row.assessment?.recommendation);
    const current = recommendationCategories.get(category.value) || { ...category, count: 0 };
    current.count += 1;
    recommendationCategories.set(category.value, current);
  });
  [...recommendationCategories.values()]
    .sort((a, b) => b.rank - a.rank || a.label.localeCompare(b.label))
    .forEach(category => {
      const item = document.createElement('div');
      item.className = 'dropdown-item';
      item.dataset.value = category.value;
      item.textContent = category.label;
      const count = document.createElement('small');
      count.textContent = category.count;
      item.appendChild(count);
      recommendationItems?.appendChild(item);
    });

  const renderApplicants = () => {
    if (!applicantList) return;
    const query = document.getElementById('campaign-applicant-search')?.value.trim().toLowerCase() || '';
    const recommendation = recommendationFilter?.dataset.value || 'all';
    const sort = document.getElementById('campaign-applicant-sort')?.dataset.value || 'name-asc';
    const rows = applicantRows.filter(({ applicant, assessment }) => {
      const matchesSearch = !query || [applicant.fullName, applicant.currentPosition, applicant.yearsExperience]
        .some(value => String(value ?? '').toLowerCase().includes(query));
      return matchesSearch && (recommendation === 'all' || recommendationCategoryFromValue(assessment?.recommendation).value === recommendation);
    });
    rows.sort((left, right) => {
      const byName = left.applicant.fullName.localeCompare(right.applicant.fullName);
      if (sort === 'name-desc') return -byName;
      if (sort === 'score-desc') return (Number(right.assessment?.overallScore) || -1) - (Number(left.assessment?.overallScore) || -1);
      if (sort === 'score-asc') return (Number(left.assessment?.overallScore) || Infinity) - (Number(right.assessment?.overallScore) || Infinity);
      if (sort === 'experience-desc') return (Number(right.applicant.yearsExperience) || 0) - (Number(left.applicant.yearsExperience) || 0);
      return byName;
    });
    if (rows.length === 0) {
      applicantList.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted);">No applicants for this campaign</td></tr>';
    } else {
      applicantList.innerHTML = rows.map(({ applicant: a, assessment }) => {
        const score = assessment?.overallScore || 'N/A';
        const rec = assessment?.recommendation || 'Not Assessed';
        const recClass = getRecommendationBadgeClass(rec);
        return `<tr>
          <td><a href="https://b3ngz.github.io/Applicants/applicant-details.html?id=${a.id}" style="color:var(--link-color);text-decoration:none;">${a.fullName}</a></td>
          <td>${a.currentPosition}</td>
          <td>${a.yearsExperience} yrs</td>
          <td>${score}</td>
          <td><span class="badge ${recClass} recommendation-preview">${rec}</span></td>
          <td><a href="https://b3ngz.github.io/Applicants/applicant-details.html?id=${a.id}" class="btn btn-secondary" style="padding:0.2rem 0.8rem;font-size:0.8rem;">View</a></td>
        </tr>`;
      }).join('');
    }
  };
  renderApplicants();
  ['campaign-applicant-search', 'campaign-applicant-filter', 'campaign-applicant-sort'].forEach(controlId => {
    const control = document.getElementById(controlId);
    control?.addEventListener(controlId.includes('search') ? 'input' : 'dropdownChange', renderApplicants);
  });

  setupPdfExtraction(campaign.id);

  const editBtn = document.getElementById('edit-campaign-btn');
  if (editBtn) {
    editBtn.addEventListener('click', function(e) {
      e.preventDefault();
      showToast('Edit campaign functionality will open the edit form.', 'info');
    });
  }

  const breadcrumbEl = document.getElementById('breadcrumb-campaign-title');
  if (breadcrumbEl) breadcrumbEl.textContent = campaign.jobTitle;
}

// ─── CREATE CAMPAIGN PAGE ────────────────────────────────────────
async function populateGoogleSheetDropdown() {
  const sheetSelect = document.getElementById('google-sheet-id');
  if (!sheetSelect) return;

  try {
    const spreadsheets = await getGoogleDriveSpreadsheets();

    sheetSelect.replaceChildren(new Option('Select a spreadsheet', ''));
    spreadsheets.forEach(spreadsheet => {
      const option = new Option(spreadsheet.name || spreadsheet.id, spreadsheet.id);
      option.dataset.sheetName = spreadsheet.name;
      sheetSelect.add(option);
    });

    sheetSelect.disabled = spreadsheets.length === 0;
    if (spreadsheets.length === 0) {
      sheetSelect.options[0].textContent = 'No spreadsheets available';
    }
  } catch (error) {
    console.error('Failed to load Google Drive spreadsheets:', error);
    sheetSelect.replaceChildren(new Option('Unable to load spreadsheets', ''));
    sheetSelect.disabled = true;
    showToast('Unable to load Google Drive spreadsheets.', 'error');
  }

}

function setupCreateCampaignForm() {
  console.log('Setting up create campaign form');

  const form = document.getElementById('create-campaign-form');
  if (!form) return;

  populateGoogleSheetDropdown();

  const statusDropdown = document.getElementById('campaign-status');
  if (statusDropdown) {
    const items = statusDropdown.querySelector('.dropdown-items');
    if (items) {
      const options = ['Active', 'Inactive'];
      items.innerHTML = options.map(opt =>
        `<div class="dropdown-item" data-value="${opt}">${opt} <span class="check">✓</span></div>`
      ).join('');
    }
  }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const request = {
            clientName: document.getElementById("client-name").value,
            jobTitle: document.getElementById("job-title").value,
            jobDescription: document.getElementById("job-description").value,
            googleSheetID: document.getElementById("google-sheet-id").value,
            googleSheetName:
              document.getElementById("google-sheet-id")
                .selectedOptions[0]?.dataset?.sheetName || undefined,
            status: document.getElementById("campaign-status")?.dataset?.value || "Active",
            createdBy: JSON.parse(localStorage.getItem("user"))?.fullName || "Unknown"
        };

        if (!request.clientName || !request.jobTitle) {
            showToast("Client Name and Job Title are required.", "warning");
            return;
        }

        try {

            await createCampaign(request);

            showToast(
                "Campaign created successfully!",
                "success");

            setTimeout(() => {

                window.location.href =
                    "/Campaign/campaign.html";

            }, 800);

        }
        catch (err) {

            console.error(err);

            showToast(
                err.message,
                "error");
        }

    });

}

// ─── MAIN EXPORT ──────────────────────────────────────────────────
export default async function initCampaigns() {
  try {
    db = await loadDatabase();
    if (!db) {
      showToast('Could not load database', 'error');
      return;
    }

    const nameEl = document.getElementById('recruiter-name');
    if (nameEl && db.users?.length) {
      nameEl.textContent = db.users[0].fullName;
    }

    const isDetailsPage = document.getElementById('campaign-description') !== null;
    const isCreatePage = document.getElementById('create-campaign-form') !== null;
    const isListPage = document.getElementById('campaign-list') !== null;

    if (isDetailsPage) {
      await renderCampaignDetails();
    } else if (isCreatePage) {
      setupCreateCampaignForm();
    } else if (isListPage) {
      await renderCampaignList();
    } else {
      console.warn('Unknown campaign page');
    }

    console.log('✅ Campaign page initialised');

  } catch (error) {
    console.error('Campaign error:', error);
    showToast('Error loading campaign page', 'error');
    throw error;
  }
}
