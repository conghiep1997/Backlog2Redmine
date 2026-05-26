/**
 * Styles module for Backlog2Redmine Extension.
 */

function injectStyles() {
  if (document.getElementById("tb-injected-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "tb-injected-styles";
  style.textContent = `
    .tb-redmine-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 20px;
      padding: 0 11px;
      height: 32px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      background: linear-gradient(180deg, #ffffff, #E0FFFF);
      color: #223047;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      margin-left: 8px;
      overflow: hidden;
      transition: all 120ms ease;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
    }
    .tb-redmine-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(25, 31, 51, 0.12);
      background: linear-gradient(180deg, #f8f9fa, #e8ebf0);
    }
    .tb-redmine-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    .tb-redmine-btn svg { width: 16px; height: 16px; }

    .tb-backlog-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-left: 10px !important;
      color: #2563eb !important;
      font-weight: bold;
      vertical-align: middle;
      cursor: pointer;
      text-decoration: none !important;
    }
    .tb-backlog-btn:hover { color: #1d4ed8 !important; text-decoration: underline !important; }
    .tb-backlog-btn svg { width: 14px; height: 14px; fill: currentColor; }

    /* Modal Overlay */
    .tb-modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(4px);
      z-index: 2147483640;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    /* Modal Container */
    .tb-modal-container {
      width: 100%;
      max-width: 950px;
      background: #fcfcfd;
      border-radius: 20px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.1);
      overflow: hidden;
      animation: tb-modal-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes tb-modal-in {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    /* Modal Header */
    .tb-modal-header {
      padding: 10px 24px;
      border-bottom: 1px solid #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f8fafc;
    }

    .tb-modal-title { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0; }
    .tb-modal-close {
      width: 32px;
      height: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: transparent !important;
      border: none !important;
      border-radius: 6px;
      box-shadow: none !important;
      font-size: 24px;
      color: #64748b !important;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      transition: background 0.2s, color 0.2s;
    }
    .tb-modal-close:hover {
      background: #e2e8f0 !important;
      color: #0f172a !important;
    }
    .tb-modal-close:focus-visible {
      outline: 2px solid #3b82f6;
      outline-offset: 2px;
    }

    /* Modal Body */
    .tb-modal-body { padding: 10px 20px ; max-height: 82vh; overflow-y: auto; }
    .tb-modal-subtitle { font-size: 12px; color: #64748b; margin-top: -6px; margin-bottom: 12px; }

    /* Fields */
    .tb-field-group { margin-bottom: 6px; }
    .tb-field-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 6px; }
    .tb-field-group label { display: block; font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 2px; letter-spacing: 0.02em; }
    .tb-field-group input, .tb-field-group select, .tb-field-group textarea {
      width: 100%; padding: 6px 10px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 13px; color: #1e293b; transition: all 0.2s;
    }
    .tb-field-group input:focus, .tb-field-group select:focus, .tb-field-group textarea:focus {
      outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    .tb-field-group input[readonly], .tb-field-group textarea[readonly] { background: #f1f5f9; color: #64748b; }
    .tb-multiline-input { resize: none; overflow-y: auto; line-height: 1.4; min-height: 48px; }
    .tb-preview-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .tb-preview-header label { margin-bottom: 0; }
    .tb-preview-toggle { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 14px; color: #2563eb; font-weight: 600; transition: all 0.2s; display: flex; align-items: center; gap: 4px; }
    .tb-preview-toggle:hover { background: #dbeafe; border-color: #3b82f6; color: #1d4ed8; transform: translateY(-1px); }
    .tb-preview-toggle:active { transform: translateY(0); }
    .tb-preview-container { position: relative; }
    .tb-preview-container textarea, .tb-preview-container .tb-preview-html { width: 100%; min-height: 180px; font-family: inherit; line-height: 1.5; font-size: 13px; box-sizing: border-box; }
    .tb-preview-html { padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fafafa; overflow-y: auto; display: none; }
    .tb-preview-html h1 { font-size: 1.5em; margin: 0.5em 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.25em; }
    .tb-preview-html h2 { font-size: 1.3em; margin: 0.5em 0; }
    .tb-preview-html h3 { font-size: 1.1em; margin: 0.5em 0; }
    .tb-preview-html strong { font-weight: 700; }
    .tb-preview-html em { font-style: italic; }
    .tb-preview-html code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
    .tb-preview-html pre { background: #1e293b; color: #e2e8f0; padding: 12px; border-radius: 8px; overflow-x: auto; font-family: monospace; white-space: pre-wrap; }
    .tb-preview-html li { margin-left: 20px; list-style: disc; }
    .tb-preview-html blockquote { border-left: 3px solid #3b82f6; margin-left: 0; padding-left: 12px; color: #475569; }
    .tb-preview-html a { color: #2563eb; text-decoration: underline; }
    #tb-redmine-preview { min-height: 180px; }
    #tb-redmine-comments-preview { min-height: 180px; font-family: inherit; line-height: 1.5; font-size: 13px; background: #f8fafc; border-left: 3px solid #3b82f6; }

    /* Footer */
    .tb-modal-footer { padding: 10px 24px; background: #f8fafc; border-top: 1px solid #f1f5f9; display: flex; justify-content: flex-end; gap: 10px; }

    /* Buttons */
    .tb-btn { padding: 10px 20px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: none; }
    .tb-btn-primary { background: #3b82f6; color: #fff; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3); }
    .tb-btn-primary:hover { background: #2563eb; transform: translateY(-1px); }
    .tb-btn-primary:disabled { background: #94a3b8; transform: none; box-shadow: none; cursor: not-allowed; }
    .tb-btn-secondary { background: #fff; color: #475569; border: 1px solid #e2e8f0; }
    .tb-btn-secondary:hover { background: #f1f5f9; }
    .tb-btn-danger {
      background: #dc2626;
      color: #ffffff;
      border: 1px solid #dc2626;
      box-shadow: 0 4px 6px -1px rgba(220, 38, 38, 0.24);
    }
    .tb-btn-danger:hover:not(:disabled) {
      background: #b91c1c;
      color: #ffffff;
      border-color: #b91c1c;
      transform: translateY(-1px);
    }
    .tb-btn-danger:disabled {
      background: #fca5a5;
      border-color: #fca5a5;
      box-shadow: none;
      opacity: 0.75;
      cursor: not-allowed;
      transform: none;
    }
    .tb-success-link-container { margin-top: 8px; }
    .tb-success-link { color: #2563eb !important; text-decoration: underline; word-break: break-all; }
    .tb-success-link:visited { color: #1d4ed8 !important; }
    .tb-success-link:hover { color: #1e40af !important; }
    .tb-success-hide-option { display: flex; align-items: center; gap: 8px; margin-top: 14px; font-size: 12px; color: #475569; cursor: pointer; text-transform: none; font-weight: 600; }
    .tb-success-hide-option input { width: auto; height: auto; margin: 0; }

    /* Toast */
    .tb-toast {
      position: fixed; top: 24px; left: 50%; transform: translateX(-50%) translateY(-16px);
      z-index: 2147483647; max-width: 480px; padding: 14px 18px; border-radius: 12px;
      color: #fff; background: rgba(17, 24, 39, 0.96); box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
      opacity: 0; transition: all 0.2s ease; font-size: 14px; font-weight: 500; text-align: center;
    }
    .tb-toast[data-type="success"] { background: rgba(16, 185, 129, 0.95); }
    .tb-toast[data-type="error"] { background: rgba(220, 38, 38, 0.95); }
    .tb-toast--visible { opacity: 1; transform: translateX(-50%) translateY(0); }

    .tb-batch-pill { display: none; padding: 4px 12px; background: #eff6ff; color: #2563eb; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 12px; }
    .tb-modal-hint { font-size: 13px; color: #475569; font-style: italic; margin-top: 12px; display: block; opacity: 0.9; }

    /* Custom Fields Grid */
    .tb-field-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 12px 0; }
    .tb-field-grid .tb-field-group { margin-bottom: 0; }
    .tb-field-grid input[type="checkbox"] { width: auto; height: auto; margin: 4px 8px 0 0; float: left; }
    .tb-field-grid select.tb-cf-input, .tb-field-grid input.tb-cf-input { margin-top: 2px; }

    .tb-batch-option { margin-top: 8px; margin-bottom: 4px; padding: 8px 12px; background: #f0f7ff; border: 1px dashed #bfdbfe; border-radius: 10px; }
    .tb-batch-option label { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #1e40af; cursor: pointer; font-weight: 600; }
    .tb-batch-option input { margin: 0; }
    .tb-required { color: #ef4444; margin-left: 2px; font-weight: bold; }

    /* User Suggestions */
    .tb-suggestions {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      max-height: 200px;
      overflow-y: auto;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      z-index: 1000;
      margin-top: 4px;
      display: none;
    }
    .tb-suggestions:not(:empty) { display: block; }
    .tb-suggestion-item {
      padding: 8px 12px;
      cursor: pointer;
      font-size: 13px;
      color: #1e293b;
      transition: background 0.2s;
    }
    .tb-suggestion-item:hover {
      background: #eff6ff;
    }
    .tb-suggestion-item:not(:last-child) {
      border-bottom: 1px solid #f1f5f9;
    }

    /* Modal Loading Overlay */
    .tb-modal-loading {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(2px);
      z-index: 100;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      border-radius: 20px;
    }
    .tb-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #3b82f6;
      border-radius: 50%;
      animation: tb-spin 1s linear infinite;
    }
    @keyframes tb-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .tb-loading-text {
      color: #1e40af;
      font-weight: 700;
      font-size: 14px;
    }
    .tb-modal-container { position: relative; }

    .tb-monthly-log-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483640;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(15, 23, 42, 0.58);
      backdrop-filter: blur(3px);
    }
    .tb-monthly-log-dialog {
      width: min(1040px, 100%);
      max-height: 88vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #ffffff;
      border: 1px solid #d8dee8;
      border-radius: 8px;
      box-shadow: 0 22px 48px rgba(15, 23, 42, 0.28);
      color: #172033;
    }
    .tb-monthly-log-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 20px;
      padding: 18px 22px;
      background: #f7f9fc;
      border-bottom: 1px solid #e3e8ef;
    }
    .tb-monthly-log-kicker {
      margin: 0 0 4px;
      color: #64748b;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .tb-monthly-log-header h2 {
      margin: 0;
      color: #0f172a;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0;
    }
    .tb-monthly-log-status {
      margin: 6px 0 0;
      color: #475569;
      font-size: 13px;
    }
    .tb-monthly-log-close {
      width: 32px;
      height: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: transparent !important;
      border: none !important;
      border-radius: 6px;
      box-shadow: none !important;
      font-size: 24px;
      color: #64748b !important;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      transition: background 0.2s, color 0.2s;
    }
    .tb-monthly-log-close:hover {
      background: #e2e8f0 !important;
      color: #0f172a !important;
    }
    .tb-monthly-log-close:focus-visible {
      outline: 2px solid #3b82f6;
      outline-offset: 2px;
    }
    .tb-monthly-log-close:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .tb-monthly-log-body {
      padding: 18px 22px;
      overflow: auto;
    }
    .tb-monthly-log-stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 16px;
    }
    .tb-monthly-log-stats div {
      min-height: 70px;
      padding: 12px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }
    .tb-monthly-log-stats span {
      display: block;
      color: #0f172a;
      font-size: 24px;
      font-weight: 700;
      line-height: 1.1;
    }
    .tb-monthly-log-stats small {
      display: block;
      margin-top: 6px;
      color: #64748b;
      font-size: 12px;
      font-weight: 600;
    }
    .tb-monthly-log-grid {
      display: grid;
      grid-template-columns: minmax(260px, 0.9fr) minmax(380px, 1.1fr);
      gap: 14px;
      min-height: 360px;
    }
    .tb-monthly-log-panel {
      min-width: 0;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      background: #ffffff;
    }
    .tb-monthly-log-panel-title {
      padding: 10px 12px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .tb-monthly-log-progress {
      height: 330px;
      margin: 0;
      padding: 10px 12px;
      overflow: auto;
      color: #334155;
      font-size: 12px;
      line-height: 1.5;
      background: #fcfcfd;
    }
    .tb-monthly-log-progress-item {
      margin-bottom: 6px;
      padding: 6px 8px;
      border-radius: 6px;
      border-left: 3px solid transparent;
    }
    .tb-monthly-log-progress-item--info {
      color: #475569;
      background: #f8fafc;
      border-left-color: #cbd5e1;
    }
    .tb-monthly-log-progress-item--date {
      margin-top: 10px;
      color: #0f172a;
      background: #eef2f7;
      border-left-color: #475569;
      font-weight: 700;
    }
    .tb-monthly-log-progress-item--success,
    .tb-monthly-log-progress-item--skip,
    .tb-monthly-log-progress-item--error {
      margin-left: 16px;
      font-size: 12px;
    }
    .tb-monthly-log-progress-item--success {
      color: #065f46;
      background: #ecfdf5;
      border-left-color: #10b981;
    }
    .tb-monthly-log-progress-item--skip {
      color: #475569;
      background: #f8fafc;
      border-left-color: #94a3b8;
    }
    .tb-monthly-log-progress-item--error {
      color: #991b1b;
      background: #fef2f2;
      border-left-color: #ef4444;
    }
    .tb-monthly-log-table-wrap {
      height: 330px;
      overflow: auto;
    }
    .tb-monthly-log-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .tb-monthly-log-table th,
    .tb-monthly-log-table td {
      padding: 9px 10px;
      border-bottom: 1px solid #edf2f7;
      text-align: left;
      vertical-align: top;
    }
    .tb-monthly-log-table th {
      position: sticky;
      top: 0;
      background: #f8fafc;
      color: #475569;
      font-weight: 700;
      z-index: 1;
    }
    .tb-monthly-log-table td:nth-child(2) {
      word-break: break-word;
    }
    .tb-monthly-log-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 12px 22px;
      background: #f7f9fc;
      border-top: 1px solid #e3e8ef;
    }
    .tb-monthly-log-footer .tb-btn-danger {
      margin-right: auto;
    }
    .tb-monthly-log-footer .tb-btn-secondary:hover:not(:disabled) {
      background: #e2e8f0;
      color: #1e293b;
    }
    @media (max-width: 760px) {
      .tb-monthly-log-overlay {
        padding: 10px;
      }
      .tb-monthly-log-header,
      .tb-monthly-log-body,
      .tb-monthly-log-footer {
        padding-left: 14px;
        padding-right: 14px;
      }
      .tb-monthly-log-stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .tb-monthly-log-grid {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(style);
}
