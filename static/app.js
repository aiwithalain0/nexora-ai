/**
 * RAG Knowledge Assistant – Client Application
 * Multi-page SPA with Chat, Dynamic Knowledge Base, Evaluation, and Settings.
 */

document.addEventListener("DOMContentLoaded", () => {
  // ── Element References ───────────────────────────────────
  const sidebar = document.getElementById("sidebar");
  const sidebarToggle = document.getElementById("sidebarToggle");
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const mobileOverlay = document.getElementById("mobileOverlay");
  const sidebarDot = document.getElementById("sidebarDot");
  const sidebarStatusLabel = document.getElementById("sidebarStatusLabel");
  const mobileStatusDot = document.getElementById("mobileStatusDot");

  const navItems = document.querySelectorAll(".nav-item");
  const pages = document.querySelectorAll(".page");

  // Chat
  const chatMessages = document.getElementById("chatMessages");
  const chatArea = document.getElementById("chatArea");
  const welcomeState = document.getElementById("welcomeState");
  const examplePrompts = document.getElementById("examplePrompts");
  const loadingRow = document.getElementById("loadingRow");
  const loadingLabel = document.getElementById("loadingLabel");
  const askForm = document.getElementById("askForm");
  const questionInput = document.getElementById("questionInput");
  const sendBtn = document.getElementById("sendBtn");
  const clearChatBtn = document.getElementById("clearChatBtn");
  const retrievalBtns = document.querySelectorAll(".retrieval-btn");
  const activeMethodLabel = document.getElementById("activeMethodLabel");

  // Pages
  const knowledgeBody = document.getElementById("knowledgeBody");
  const evaluationBody = document.getElementById("evaluationBody");
  const settingsBody = document.getElementById("settingsBody");
  const refreshKbBtn = document.getElementById("refreshKbBtn");
  const settingsSavedBadge = document.getElementById("settingsSavedBadge");

  // Delete Modal
  const deleteModal = document.getElementById("deleteModal");
  const deleteModalDocName = document.getElementById("deleteModalDocName");
  const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
  const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

  // Toast Container
  const toastContainer = document.getElementById("toastContainer");

  let currentMethod = localStorage.getItem("rag_preferred_method") || "hybrid";
  let isSubmitting = false;
  let healthData = null;
  let docToDelete = null;

  // Initialize UI method buttons
  retrievalBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.method === currentMethod);
  });
  updateActiveMethodLabel(currentMethod);

  // ── Init ─────────────────────────────────────────────────
  fetchHealth();

  // ── Sidebar Toggle ───────────────────────────────────────
  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
    });
  }

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener("click", () => {
      sidebar.classList.add("mobile-open");
      mobileOverlay.classList.add("visible");
    });
  }

  if (mobileOverlay) {
    mobileOverlay.addEventListener("click", closeMobile);
  }

  function closeMobile() {
    sidebar.classList.remove("mobile-open");
    mobileOverlay.classList.remove("visible");
  }

  // ── Navigation ───────────────────────────────────────────
  navItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.page;
      navigateTo(target);
      closeMobile();
    });
  });

  function navigateTo(page) {
    navItems.forEach((b) => {
      b.classList.toggle("active", b.dataset.page === page);
      if (b.dataset.page === page) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    pages.forEach((p) => {
      p.classList.toggle("active", p.id === "page" + capitalize(page));
    });

    if (page === "knowledge") loadKnowledgePage();
    if (page === "evaluation") loadEvaluationPage();
    if (page === "settings") loadSettingsPage();
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ── Health Check ─────────────────────────────────────────
  async function fetchHealth() {
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        healthData = await res.json();
        setStatus(healthData.index_ready);
      } else {
        setStatus(false);
      }
    } catch {
      setStatus(false);
    }
  }

  function setStatus(online) {
    if (!sidebarDot || !sidebarStatusLabel) return;
    sidebarDot.className = "status-dot " + (online ? "online" : "offline");
    sidebarStatusLabel.textContent = online ? "Index ready" : "Index unavailable";
    if (mobileStatusDot) {
      mobileStatusDot.className = "mobile-status " + (online ? "online" : "");
    }
  }

  // ── Retrieval Method ─────────────────────────────────────
  retrievalBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      retrievalBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentMethod = btn.dataset.method;
      localStorage.setItem("rag_preferred_method", currentMethod);
      updateActiveMethodLabel(currentMethod);
    });
  });

  function updateActiveMethodLabel(m) {
    const labels = {
      hybrid: "Hybrid retrieval (BM25 + Vector)",
      bm25: "BM25 retrieval (Keywords)",
      vector: "Vector retrieval (Semantic)",
    };
    if (activeMethodLabel) activeMethodLabel.textContent = labels[m] || m;
  }

  // ── Chat: Input ──────────────────────────────────────────
  if (questionInput) {
    questionInput.addEventListener("input", autoResize);
    questionInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!isSubmitting && questionInput.value.trim()) {
          askForm.dispatchEvent(new Event("submit"));
        }
      }
    });
  }

  if (askForm) {
    askForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = questionInput.value.trim();
      if (!q || isSubmitting) return;
      submitQuestion(q);
    });
  }

  if (examplePrompts) {
    examplePrompts.addEventListener("click", (e) => {
      const chip = e.target.closest(".example-chip");
      if (!chip) return;
      const q = chip.dataset.question;
      if (q) {
        questionInput.value = q;
        autoResize();
        submitQuestion(q);
      }
    });
  }

  if (clearChatBtn) {
    clearChatBtn.addEventListener("click", () => {
      chatArea.innerHTML = "";
      if (welcomeState) {
        chatArea.appendChild(welcomeState);
      }
      showToast("Chat history cleared");
    });
  }

  function autoResize() {
    questionInput.style.height = "auto";
    questionInput.style.height = Math.min(questionInput.scrollHeight, 160) + "px";
  }

  // ── Chat: Submit ─────────────────────────────────────────
  async function submitQuestion(question) {
    isSubmitting = true;
    sendBtn.disabled = true;
    questionInput.disabled = true;

    if (welcomeState && welcomeState.parentNode === chatArea) {
      chatArea.removeChild(welcomeState);
    }

    appendUserMessage(question);
    questionInput.value = "";
    autoResize();

    loadingRow.classList.remove("hidden");
    loadingLabel.textContent = `Retrieving passages via ${currentMethod}…`;
    scrollChatBottom();

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question,
          method: currentMethod,
          k: 5,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown server error" }));
        throw new Error(err.detail || `Server returned ${res.status}`);
      }

      const data = await res.json();
      loadingRow.classList.add("hidden");
      appendAiMessage(data);
    } catch (err) {
      loadingRow.classList.add("hidden");
      appendErrorMessage(err.message, question);
    } finally {
      isSubmitting = false;
      sendBtn.disabled = false;
      questionInput.disabled = false;
      questionInput.focus();
      scrollChatBottom();
    }
  }

  function appendUserMessage(text) {
    const row = el("div", "msg-row user");
    const bubble = el("div", "msg-bubble");
    const header = elHTML("div", "msg-header", `<span class="msg-author">You</span>`);
    const body = elHTML("div", "msg-body", `<p>${esc(text)}</p>`);

    bubble.appendChild(header);
    bubble.appendChild(body);
    row.appendChild(bubble);
    chatArea.appendChild(row);
  }

  function appendAiMessage(data) {
    const row = el("div", "msg-row ai");
    const avatar = avatarEl("ai-avatar", `<img src="/static/nexora-logo.jpg" alt="Nexora AI logo" class="avatar-logo-img" />`);

    const bubble = el("div", "msg-bubble");
    const methodTag = `<span class="msg-meta-tag">${esc(data.method || currentMethod)}</span>`;
    const header = elHTML("div", "msg-header", `<span class="msg-author">Nexora AI</span>${methodTag}`);
    const body = elHTML("div", "msg-body", renderMarkdown(data.answer));

    bubble.appendChild(header);
    bubble.appendChild(body);

    if (data.sources && data.sources.length > 0) {
      const srcBox = el("div", "sources-container");
      srcBox.innerHTML = `
        <div class="sources-heading">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          Sources (${data.sources.length} retrieved)
        </div>
      `;
      const list = el("div", "sources-list");
      data.sources.forEach((s) => {
        const pill = elHTML(
          "button",
          "source-pill",
          `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
           <span>${esc(s.source)} · p.${s.page}</span>`
        );
        pill.title = s.text ? s.text.substring(0, 200) + "…" : "Source passage";
        pill.addEventListener("click", () => {
          showToast(`Passage excerpt: "${(s.text || "").substring(0, 100)}..."`);
        });
        list.appendChild(pill);
      });
      srcBox.appendChild(list);
      bubble.appendChild(srcBox);
    }

    row.appendChild(avatar);
    row.appendChild(bubble);
    chatArea.appendChild(row);
  }

  function appendErrorMessage(msg, retryQuestion) {
    const row = el("div", "msg-row ai");
    const avatar = avatarEl("ai-avatar", `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`);

    const bubble = el("div", "msg-bubble");
    bubble.style.borderColor = "var(--coral)";
    const header = elHTML("div", "msg-header", `<span class="msg-author" style="color:var(--coral)">Error</span>`);
    const body = elHTML("div", "msg-body", `<p style="color:var(--coral)">${esc(msg)}</p>`);

    const retryBtn = elHTML("button", "btn-ghost", `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
      Retry Question
    `);
    retryBtn.style.marginTop = "8px";
    retryBtn.addEventListener("click", () => submitQuestion(retryQuestion));
    body.appendChild(retryBtn);

    bubble.appendChild(header);
    bubble.appendChild(body);
    row.appendChild(avatar);
    row.appendChild(bubble);
    chatArea.appendChild(row);
  }

  function scrollChatBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // ── Knowledge Base Page ──────────────────────────────────
  if (refreshKbBtn) {
    refreshKbBtn.addEventListener("click", () => {
      loadKnowledgePage();
      showToast("Knowledge base refreshed");
    });
  }

  async function loadKnowledgePage() {
    knowledgeBody.innerHTML = `<div class="loading-page"><div class="spinner"></div><span>Loading knowledge base…</span></div>`;
    try {
      const res = await fetch("/api/knowledge");
      if (!res.ok) throw new Error("Failed to load knowledge base");
      const data = await res.json();
      renderKnowledgePage(data);
    } catch (err) {
      knowledgeBody.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <h3>Failed to load knowledge base</h3>
          <p>${esc(err.message)}</p>
          <button class="btn-primary" style="margin-top:14px" onclick="location.reload()">Retry</button>
        </div>
      `;
    }
  }

  function renderKnowledgePage(data) {
    const docs = data.documents || [];

    let html = `
      <!-- Upload Card -->
      <div class="kb-hero-card">
        <div class="upload-dropzone" id="uploadDropzone">
          <input type="file" id="filePicker" multiple accept=".pdf,.txt,.md,.docx" style="display:none" />
          <div class="upload-dropzone-inner">
            <div class="upload-icon-circle">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <div>
              <div class="upload-title">Upload Documents into Knowledge Base</div>
              <div class="upload-subtitle">Drag and drop files here, or browse from your computer</div>
            </div>
            <div class="upload-actions-row">
              <button type="button" class="btn-primary" id="selectFilesBtn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Select Documents
              </button>
            </div>
            <div class="upload-formats-hint">Supported formats: PDF, TXT, Markdown (.md), and Word (.docx) · Up to 25 MB per file</div>
          </div>
        </div>

        <!-- Upload Staging & Progress (hidden by default) -->
        <div class="upload-queue-card hidden" id="uploadQueueCard">
          <div class="queue-title">
            <span id="queueCountLabel">Processing 0 files</span>
            <span class="queue-file-size" id="queueTotalSize">0 MB</span>
          </div>
          <div class="queue-list" id="queueList"></div>
        </div>
      </div>

      <!-- Live Document List -->
      <div class="kb-section-header">
        <div class="kb-section-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Managed Documents (${docs.length})
        </div>
        <div>
          <span style="font-size:12.5px;color:var(--text-secondary)">Total Chunks: <strong>${data.total_vectors || 0}</strong></span>
        </div>
      </div>
    `;

    if (docs.length === 0) {
      html += `
        <div class="kb-table-card">
          <div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
            <h3>No documents in knowledge base</h3>
            <p>Upload your first PDF, TXT, or DOCX document above to automatically index and start querying.</p>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="kb-table-card">
          <table class="kb-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Type</th>
                <th>Size</th>
                <th>Chunks</th>
                <th>Uploaded</th>
                <th>Status</th>
                <th style="text-align:right">Actions</th>
              </tr>
            </thead>
            <tbody>
      `;

      docs.forEach((doc) => {
        const sizeStr = doc.file_size_bytes ? formatBytes(doc.file_size_bytes) : "—";
        const statusClass = (doc.status || "Indexed").toLowerCase();

        html += `
          <tr>
            <td>
              <div class="doc-name-cell">
                <div class="doc-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <span class="doc-name-text" title="${esc(doc.name)}">${esc(doc.name)}</span>
              </div>
            </td>
            <td><span class="doc-type-badge">${esc(doc.type || "DOC")}</span></td>
            <td>${sizeStr}</td>
            <td><strong>${doc.chunks || 0}</strong></td>
            <td>${esc(doc.uploaded_at || "—")}</td>
            <td>
              <span class="status-badge ${statusClass}">
                ${esc(doc.status || "Indexed")}
              </span>
            </td>
            <td style="text-align:right">
              <div class="table-actions" style="justify-content:flex-end">
                <button type="button" class="btn-action-icon reindex-doc-btn" data-filename="${esc(doc.name)}" title="Reindex document">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                </button>
                <button type="button" class="btn-action-icon danger delete-doc-btn" data-filename="${esc(doc.name)}" title="Remove document">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
              </div>
            </td>
          </tr>
        `;
      });

      html += `</tbody></table></div>`;
    }

    knowledgeBody.innerHTML = html;
    setupUploadHandlers();
    setupDocumentActionHandlers();
  }

  // ── Upload Logic ─────────────────────────────────────────
  function setupUploadHandlers() {
    const dropzone = document.getElementById("uploadDropzone");
    const filePicker = document.getElementById("filePicker");
    const selectBtn = document.getElementById("selectFilesBtn");

    if (!dropzone || !filePicker) return;

    selectBtn.addEventListener("click", () => filePicker.click());
    dropzone.addEventListener("click", (e) => {
      if (e.target !== selectBtn && !selectBtn.contains(e.target)) {
        filePicker.click();
      }
    });

    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("drag-active");
    });

    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("drag-active");
    });

    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("drag-active");
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        handleFilesUpload(Array.from(files));
      }
    });

    filePicker.addEventListener("change", () => {
      if (filePicker.files && filePicker.files.length > 0) {
        handleFilesUpload(Array.from(filePicker.files));
      }
    });
  }

  async function handleFilesUpload(files) {
    const queueCard = document.getElementById("uploadQueueCard");
    const queueList = document.getElementById("queueList");
    const countLabel = document.getElementById("queueCountLabel");
    const totalSizeLabel = document.getElementById("queueTotalSize");

    if (!queueCard || !queueList) return;

    queueCard.classList.remove("hidden");
    queueList.innerHTML = "";
    countLabel.textContent = `Processing ${files.length} document${files.length > 1 ? "s" : ""}`;

    const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
    totalSizeLabel.textContent = formatBytes(totalBytes);

    let completed = 0;

    for (const file of files) {
      const itemEl = elHTML(
        "div",
        "queue-item",
        `
          <div style="flex:1">
            <div class="queue-item-info">
              <strong>${esc(file.name)}</strong>
              <span class="queue-file-size">(${formatBytes(file.size)})</span>
              <span class="status-badge processing" id="status_${esc(file.name)}">Uploading…</span>
            </div>
            <div class="queue-progress-bar"><div class="queue-progress-fill" id="prog_${esc(file.name)}"></div></div>
          </div>
        `
      );
      queueList.appendChild(itemEl);

      const statusBadge = itemEl.querySelector(`#status_${CSS.escape(file.name)}`);
      const progFill = itemEl.querySelector(`#prog_${CSS.escape(file.name)}`);

      try {
        if (progFill) progFill.style.width = "40%";
        if (statusBadge) statusBadge.textContent = "Indexing…";

        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ detail: "Upload failed" }));
          throw new Error(errData.detail || `Upload failed with status ${res.status}`);
        }

        const data = await res.json();
        if (progFill) progFill.style.width = "100%";
        if (statusBadge) {
          statusBadge.className = "status-badge indexed";
          statusBadge.textContent = `Indexed (${data.chunks} chunks)`;
        }
        showToast(`Document "${file.name}" indexed successfully!`);
        completed++;
      } catch (err) {
        if (progFill) {
          progFill.style.width = "100%";
          progFill.style.background = "var(--coral)";
        }
        if (statusBadge) {
          statusBadge.className = "status-badge failed";
          statusBadge.textContent = "Failed";
        }
        showToast(`Error uploading "${file.name}": ${err.message}`, "error");
      }
    }

    // Refresh view and health badge after uploads complete
    setTimeout(() => {
      fetchHealth();
      loadKnowledgePage();
    }, 1200);
  }

  // ── Document Action Handlers ─────────────────────────────
  function setupDocumentActionHandlers() {
    // Delete buttons
    document.querySelectorAll(".delete-doc-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const filename = btn.dataset.filename;
        openDeleteModal(filename);
      });
    });

    // Reindex buttons
    document.querySelectorAll(".reindex-doc-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const filename = btn.dataset.filename;
        btn.disabled = true;
        btn.innerHTML = `<div class="spinner" style="width:14px;height:14px;border-width:2px"></div>`;
        try {
          const res = await fetch(`/api/documents/${encodeURIComponent(filename)}/reindex`, {
            method: "POST",
          });
          if (!res.ok) throw new Error("Reindex failed");
          const data = await res.json();
          showToast(`Reindexed "${filename}" (${data.chunks} chunks)`);
          fetchHealth();
          loadKnowledgePage();
        } catch (err) {
          showToast(`Failed to reindex: ${err.message}`, "error");
          loadKnowledgePage();
        }
      });
    });
  }

  function openDeleteModal(filename) {
    docToDelete = filename;
    deleteModalDocName.textContent = filename;
    deleteModal.classList.remove("hidden");
  }

  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener("click", () => {
      deleteModal.classList.add("hidden");
      docToDelete = null;
    });
  }

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", async () => {
      if (!docToDelete) return;
      confirmDeleteBtn.disabled = true;
      confirmDeleteBtn.textContent = "Deleting…";

      try {
        const res = await fetch(`/api/documents/${encodeURIComponent(docToDelete)}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to delete document");
        const data = await res.json();
        deleteModal.classList.add("hidden");
        showToast(`Deleted "${docToDelete}" and purged ${data.removed_chunks || 0} vectors.`);
        fetchHealth();
        loadKnowledgePage();
      } catch (err) {
        showToast(`Failed to delete: ${err.message}`, "error");
      } finally {
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.textContent = "Delete Document";
        docToDelete = null;
      }
    });
  }

  // ── Evaluation Page ──────────────────────────────────────
  let evalLoaded = false;
  async function loadEvaluationPage() {
    evaluationBody.innerHTML = `<div class="loading-page"><div class="spinner"></div><span>Loading evaluation data…</span></div>`;
    try {
      const res = await fetch("/api/evaluation");
      const data = await res.json();
      evalLoaded = true;
      renderEvaluationPage(data);
    } catch {
      evaluationBody.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <h3>Failed to load evaluation</h3>
          <p>Could not fetch benchmark evaluation data from the server.</p>
        </div>
      `;
    }
  }

  function renderEvaluationPage(data) {
    if (!data.available) {
      evaluationBody.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          <h3>No evaluation benchmark found</h3>
          <p>${esc(data.message || "Run the evaluation script to generate results:")}<br><code style="margin-top:8px;display:inline-block">python -m evals.run_eval</code></p>
        </div>
      `;
      return;
    }

    const methods = data.methods || {};
    const order = ["bm25", "vector", "hybrid"];
    const metrics = ["recall_at_1", "recall_at_3", "recall_at_5", "mrr"];
    const metricLabels = { recall_at_1: "Recall@1", recall_at_3: "Recall@3", recall_at_5: "Recall@5", mrr: "MRR" };
    const barClass = { bm25: "bar-bm25", vector: "bar-vector", hybrid: "bar-hybrid" };

    let html = `<div class="eval-summary-cards">`;
    order.forEach((m) => {
      const vals = methods[m];
      if (!vals) return;
      html += `
        <div class="eval-method-card">
          <div class="eval-method-name"><span class="method-dot ${m}"></span>${m.toUpperCase()}</div>
          <div class="eval-metrics">
      `;
      metrics.forEach((metric) => {
        const v = vals[metric] || 0;
        const pct = Math.round(v * 100);
        html += `
          <div class="eval-metric-row">
            <span class="eval-metric-label">${metricLabels[metric]}</span>
            <div class="eval-metric-bar-wrap"><div class="eval-metric-bar ${barClass[m]}" style="width:${pct}%"></div></div>
            <span class="eval-metric-value">${v.toFixed(2)}</span>
          </div>
        `;
      });
      html += `
          <div class="eval-metric-row">
            <span class="eval-metric-label">Avg Latency</span>
            <span class="eval-metric-value">${(vals.avg_latency_ms || 0).toFixed(1)} ms</span>
          </div>
        </div></div>
      `;
    });
    html += `</div>`;

    html += `<div class="eval-comparison-title">Side-by-Side Comparison</div>`;
    html += `<table class="eval-table"><thead><tr><th>Metric</th>`;
    order.forEach((m) => { if (methods[m]) html += `<th>${m.toUpperCase()}</th>`; });
    html += `</tr></thead><tbody>`;

    [...metrics, "avg_latency_ms"].forEach((metric) => {
      const label = metricLabels[metric] || "Avg Latency (ms)";
      html += `<tr><td>${label}</td>`;
      let vals = order.map((m) => methods[m] ? (methods[m][metric] || 0) : null).filter((v) => v !== null);
      let best = metric === "avg_latency_ms" ? Math.min(...vals) : Math.max(...vals);

      order.forEach((m) => {
        if (!methods[m]) return;
        const v = methods[m][metric] || 0;
        const fmt = metric === "avg_latency_ms" ? v.toFixed(1) + " ms" : v.toFixed(4);
        const isBest = v === best;
        html += `<td class="${isBest ? "best" : ""}">${fmt}</td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table>`;

    evaluationBody.innerHTML = html;
  }

  // ── Settings Page ────────────────────────────────────────
  async function loadSettingsPage() {
    settingsBody.innerHTML = `<div class="loading-page"><div class="spinner"></div><span>Loading configuration…</span></div>`;
    try {
      const [healthRes, kbRes] = await Promise.all([
        fetch("/api/health"),
        fetch("/api/knowledge"),
      ]);
      const h = await healthRes.json();
      const kb = await kbRes.json();
      renderSettingsPage(h, kb);
    } catch {
      settingsBody.innerHTML = `
        <div class="empty-state">
          <h3>Failed to load settings</h3>
          <p>Could not fetch configuration details from the server.</p>
        </div>
      `;
    }
  }

  function renderSettingsPage(health, kb) {
    const prefMethod = localStorage.getItem("rag_preferred_method") || "hybrid";

    settingsBody.innerHTML = `
      <div class="settings-container">

        <!-- General Section -->
        <div class="settings-section-card">
          <div class="settings-section-header">
            <div class="settings-section-icon icon-coral">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </div>
            <div>
              <div class="settings-section-title">General Preferences</div>
              <div class="settings-section-desc">Application workspace branding and user interaction defaults</div>
            </div>
          </div>
          <div class="settings-rows-list">
            <div class="settings-item-row">
              <div class="settings-item-info">
                <span class="settings-item-label">Application Name</span>
                <span class="settings-item-hint">Workspace branding shown across headers</span>
              </div>
              <div class="settings-item-control">
                <span class="settings-badge">Nexora AI · Knowledge Assistant</span>
              </div>
            </div>
            <div class="settings-item-row">
              <div class="settings-item-info">
                <span class="settings-item-label">Default Retrieval Method</span>
                <span class="settings-item-hint">Primary method preselected in the chat bar</span>
              </div>
              <div class="settings-item-control">
                <select id="settingsDefaultMethodSelect" class="settings-select">
                  <option value="hybrid" ${prefMethod === "hybrid" ? "selected" : ""}>Hybrid (Vector + BM25)</option>
                  <option value="vector" ${prefMethod === "vector" ? "selected" : ""}>Vector Semantic Only</option>
                  <option value="bm25" ${prefMethod === "bm25" ? "selected" : ""}>BM25 Keywords Only</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- AI & Retrieval Section -->
        <div class="settings-section-card">
          <div class="settings-section-header">
            <div class="settings-section-icon icon-turquoise">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div>
              <div class="settings-section-title">AI & Generation Model</div>
              <div class="settings-section-desc">Safe model status and synthesis provider settings</div>
            </div>
          </div>
          <div class="settings-rows-list">
            <div class="settings-item-row">
              <div class="settings-item-info">
                <span class="settings-item-label">Inference Provider</span>
                <span class="settings-item-hint">Fast cloud LLM inference engine</span>
              </div>
              <div class="settings-item-control">
                <span class="settings-badge">Groq Cloud API</span>
              </div>
            </div>
            <div class="settings-item-row">
              <div class="settings-item-info">
                <span class="settings-item-label">Active LLM Model</span>
                <span class="settings-item-hint">Underlying language model generating responses</span>
              </div>
              <div class="settings-item-control">
                <span class="settings-badge">${esc(health.llm_model || "—")}</span>
              </div>
            </div>
            <div class="settings-item-row">
              <div class="settings-item-info">
                <span class="settings-item-label">API Service Status</span>
                <span class="settings-item-hint">Connectivity to the LLM backend</span>
              </div>
              <div class="settings-item-control">
                <span class="settings-badge success">Available</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Knowledge Base Management Section -->
        <div class="settings-section-card">
          <div class="settings-section-header">
            <div class="settings-section-icon icon-yellow">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            </div>
            <div>
              <div class="settings-section-title">Knowledge Base & Vector Store</div>
              <div class="settings-section-desc">Document chunking parameters, embedding model, and vector indexing</div>
            </div>
          </div>
          <div class="settings-rows-list">
            <div class="settings-item-row">
              <div class="settings-item-info">
                <span class="settings-item-label">Embedding Model</span>
                <span class="settings-item-hint">Dense vector embeddings executed locally</span>
              </div>
              <div class="settings-item-control">
                <span class="settings-badge">${esc(health.embedding_model || "—")}</span>
              </div>
            </div>
            <div class="settings-item-row">
              <div class="settings-item-info">
                <span class="settings-item-label">Vector Store</span>
                <span class="settings-item-hint">Persistent local database</span>
              </div>
              <div class="settings-item-control">
                <span class="settings-badge">ChromaDB (Local persistent)</span>
              </div>
            </div>
            <div class="settings-item-row">
              <div class="settings-item-info">
                <span class="settings-item-label">Indexed Documents</span>
                <span class="settings-item-hint">Total source documents managed</span>
              </div>
              <div class="settings-item-control">
                <span class="settings-badge"><strong>${kb.total_documents || (kb.documents ? kb.documents.length : 0)}</strong> documents</span>
              </div>
            </div>
            <div class="settings-item-row">
              <div class="settings-item-info">
                <span class="settings-item-label">Total Vector Chunks</span>
                <span class="settings-item-hint">Total chunks stored and searchable</span>
              </div>
              <div class="settings-item-control">
                <span class="settings-badge"><strong>${health.chunk_count || kb.total_vectors || 0}</strong> chunks</span>
              </div>
            </div>
            <div class="settings-item-row">
              <div class="settings-item-info">
                <span class="settings-item-label">Chunk Sizing</span>
                <span class="settings-item-hint">Configured words and overlap</span>
              </div>
              <div class="settings-item-control">
                <span class="settings-badge">${kb.chunk_words || 200} words / ${kb.chunk_overlap || 40} overlap</span>
              </div>
            </div>
          </div>
        </div>

        <!-- About Section -->
        <div class="settings-section-card">
          <div class="settings-section-header">
            <div class="settings-section-icon icon-logo-card">
              <img src="/static/nexora-logo.jpg" alt="Nexora AI logo" class="settings-logo-thumb" />
            </div>
            <div>
              <div class="settings-section-title">About Nexora AI & System Health</div>
              <div class="settings-section-desc">Application version, runtime status, and environment architecture</div>
            </div>
          </div>
          <div class="settings-rows-list">
            <div class="settings-item-row">
              <div class="settings-item-info">
                <span class="settings-item-label">Application Version</span>
                <span class="settings-item-hint">Release build</span>
              </div>
              <div class="settings-item-control">
                <span class="settings-badge">v2.1.0</span>
              </div>
            </div>
            <div class="settings-item-row">
              <div class="settings-item-info">
                <span class="settings-item-label">Backend Engine</span>
                <span class="settings-item-hint">REST API Server</span>
              </div>
              <div class="settings-item-control">
                <span class="settings-badge">FastAPI + Python 3.13</span>
              </div>
            </div>
            <div class="settings-item-row">
              <div class="settings-item-info">
                <span class="settings-item-label">System Health</span>
                <span class="settings-item-hint">Server process and vector DB readiness</span>
              </div>
              <div class="settings-item-control">
                <span class="settings-badge success">All Systems Operational</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    `;

    // Listen to changes in settings select
    const sel = document.getElementById("settingsDefaultMethodSelect");
    if (sel) {
      sel.addEventListener("change", () => {
        const val = sel.value;
        currentMethod = val;
        localStorage.setItem("rag_preferred_method", val);
        retrievalBtns.forEach((b) => b.classList.toggle("active", b.dataset.method === val));
        updateActiveMethodLabel(val);

        if (settingsSavedBadge) {
          settingsSavedBadge.classList.remove("hidden");
          setTimeout(() => settingsSavedBadge.classList.add("hidden"), 2500);
        }
        showToast(`Default method updated to ${val.toUpperCase()}`);
      });
    }
  }

  // ── Helpers ──────────────────────────────────────────────
  function el(tag, cls) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  function elHTML(tag, cls, html) {
    const e = el(tag, cls);
    e.innerHTML = html;
    return e;
  }

  function avatarEl(cls, svg) {
    const a = el("div", "msg-avatar " + cls);
    a.innerHTML = svg;
    return a;
  }

  function esc(s) {
    if (!s) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatBytes(bytes) {
    if (!bytes || isNaN(bytes)) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  function showToast(message, type = "success") {
    if (!toastContainer) return;
    const toast = el("div", `toast ${type}`);
    const icon = type === "success"
      ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`
      : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

    toast.innerHTML = `${icon}<span>${esc(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      toast.style.transition = "all 0.25s ease";
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  // ── Markdown Renderer ───────────────────────────────────
  function renderMarkdown(md) {
    if (!md) return "";
    const lines = md.split("\n");
    let html = "";
    let inList = false, listType = "";
    let inTable = false, tableHeaderDone = false;
    let inCode = false, codeBuf = "";

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      if (line.trim().startsWith("```")) {
        if (inCode) {
          html += `<pre><code>${esc(codeBuf.trim())}</code></pre>`;
          codeBuf = "";
          inCode = false;
        } else {
          inCode = true;
          codeBuf = "";
        }
        continue;
      }
      if (inCode) {
        codeBuf += line + "\n";
        continue;
      }

      // Markdown Tables
      if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
        if (/^\|(\s*[-:]+[-|\s:]*)\|$/.test(line.trim())) {
          tableHeaderDone = true;
          continue;
        }
        if (!inTable) {
          if (inList) { html += `</${listType}>`; inList = false; }
          inTable = true;
          tableHeaderDone = false;
          html += "<table><tbody>";
        }
        const cells = line.trim().slice(1, -1).split("|").map((c) => c.trim());
        const tag = !tableHeaderDone ? "th" : "td";
        html += "<tr>" + cells.map((c) => `<${tag}>${inlineFmt(c)}</${tag}>`).join("") + "</tr>";
        continue;
      } else if (inTable) {
        html += "</tbody></table>";
        inTable = false;
      }

      const t = line.trim();
      if (!t) {
        if (inList) { html += `</${listType}>`; inList = false; }
        continue;
      }

      if (t.startsWith("#### ")) { closeList(); html += `<h4>${inlineFmt(t.substring(5))}</h4>`; continue; }
      if (t.startsWith("### ")) { closeList(); html += `<h3>${inlineFmt(t.substring(4))}</h3>`; continue; }
      if (t.startsWith("## ")) { closeList(); html += `<h2>${inlineFmt(t.substring(3))}</h2>`; continue; }
      if (t.startsWith("# ")) { closeList(); html += `<h1>${inlineFmt(t.substring(2))}</h1>`; continue; }
      if (t.startsWith("> ")) { closeList(); html += `<blockquote>${inlineFmt(t.substring(2))}</blockquote>`; continue; }

      if (/^[-*]\s+/.test(t)) {
        if (!inList || listType !== "ul") {
          if (inList) html += `</${listType}>`;
          inList = true;
          listType = "ul";
          html += "<ul>";
        }
        html += `<li>${inlineFmt(t.replace(/^[-*]\s+/, ""))}</li>`;
        continue;
      }
      if (/^\d+\.\s+/.test(t)) {
        if (!inList || listType !== "ol") {
          if (inList) html += `</${listType}>`;
          inList = true;
          listType = "ol";
          html += "<ol>";
        }
        html += `<li>${inlineFmt(t.replace(/^\d+\.\s+/, ""))}</li>`;
        continue;
      }

      closeList();
      html += `<p>${inlineFmt(t)}</p>`;
    }

    if (inList) html += `</${listType}>`;
    if (inTable) html += "</tbody></table>";
    if (inCode) html += `<pre><code>${esc(codeBuf.trim())}</code></pre>`;
    return html;

    function closeList() {
      if (inList) {
        html += `</${listType}>`;
        inList = false;
      }
    }
  }

  function inlineFmt(s) {
    let o = esc(s);
    o = o.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    o = o.replace(/\*(.*?)\*/g, "<em>$1</em>");
    o = o.replace(/`(.*?)`/g, "<code>$1</code>");
    return o;
  }
});
