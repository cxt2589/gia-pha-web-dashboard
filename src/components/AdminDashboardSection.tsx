import React from 'react';
import { AppConfig, getAppSettings, saveAppSettings, resetAppSettings, hydrateAppSettingsFromBackend } from '../utils/configManager';
import { AdminDashboardHeader } from './admin-dashboard/AdminDashboardHeader';
import { AdminLoginGate } from './admin-dashboard/AdminLoginGate';
import { AppearanceSettingsPanel } from './admin-dashboard/AppearanceSettingsPanel';
import { BrandingLabelsPanel } from './admin-dashboard/BrandingLabelsPanel';
import { CollapsibleAdminFolder } from './admin-dashboard/CollapsibleAdminFolder';
import { ExternalApiSettingsPanel } from './admin-dashboard/ExternalApiSettingsPanel';
import { ImportColumnGuide } from './admin-dashboard/ImportColumnGuide';
import { ImportSourceControls } from './admin-dashboard/ImportSourceControls';
import { LineageDiagnosticsReport } from './admin-dashboard/LineageDiagnosticsReport';
import { SettingsMonitorPanel } from './admin-dashboard/SettingsMonitorPanel';
import { TreeJsonBackupPanel } from './admin-dashboard/TreeJsonBackupPanel';
import { useLineageImportAdmin } from './admin-dashboard/useLineageImportAdmin';

export default function AdminDashboardSection() {
  // Admin Login gate state
  const [isAdminLoggedIn, setIsAdminLoggedIn] = React.useState<boolean>(() => {
    return localStorage.getItem("caogia_admin_authorized") === "true";
  });
  const [passwordInput, setPasswordInput] = React.useState("");
  const [loginError, setLoginError] = React.useState("");

  // App Settings States
  const [settings, setSettings] = React.useState<AppConfig>(getAppSettings());
  const [isSaved, setIsSaved] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void hydrateAppSettingsFromBackend().then((backendSettings) => {
      if (!cancelled) setSettings(backendSettings);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const {
    cancelPendingLineageImport,
    confirmPendingLineageImport,
    diagnostics,
    handleClearAllTreeData,
    handleExportTreeJson,
    handleImportLineageFile,
    handleImportTreeJson,
    handleResetTreeDatabase,
    handleSyncGoogleSheet,
    isImportingFile,
    isSyncing,
    pendingLineageImport,
    rawLineageInput,
    setRawLineageInput,
    setSyncMode,
    syncMode,
    syncStatus,
    treeImportMsg
  } = useLineageImportAdmin({ settings, setSettings });

  // Collapsible Categories (Folder structure)
  // Initially we open the first folder, others closed
  const [openFolders, setOpenFolders] = React.useState<Record<string, boolean>>({
    'sheettree': true,
    'appearance': false,
    'buttons': false,
    'apis': false
  });

  const toggleFolder = (key: string) => {
    setOpenFolders(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === "123") {
      setIsAdminLoggedIn(true);
      localStorage.setItem("caogia_admin_authorized", "true");
      setLoginError("");
    } else {
      setLoginError("Mật khẩu Quản trị không chính xác! Thử lại '123'.");
    }
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    localStorage.removeItem("caogia_admin_authorized");
  };

  const handleSaveSettings = () => {
    saveAppSettings(settings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleResetSettings = () => {
    if (window.confirm("Bạn có chắc chắn muốn đặt lại tất cả màu sắc, hình ảnh và cài đặt giao diện về ban đầu?")) {
      const def = resetAppSettings();
      setSettings(def);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  if (!isAdminLoggedIn) {
    return (
      <AdminLoginGate
        passwordInput={passwordInput}
        loginError={loginError}
        setPasswordInput={setPasswordInput}
        onSubmit={handleAdminLogin}
      />
    );
  }

  return (
    <div className="space-y-8 animate-fade-in" id="admin-dashboard-full-view">
      
      <AdminDashboardHeader onLogout={handleAdminLogout} />

      {/* Main Configurations container formatted as clean folder categories */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Folders list */}
        <div className="lg:col-span-8 space-y-4">
          
          <CollapsibleAdminFolder
            title="1. Quản trị Phả hệ & Đồng bộ Google Sheets"
            isOpen={openFolders['sheettree']}
            onToggle={() => toggleFolder('sheettree')}
          >
            <div className="p-5 space-y-6 animate-fade-in bg-white">
              <ImportSourceControls
                settings={settings}
                setSettings={setSettings}
                syncMode={syncMode}
                setSyncMode={setSyncMode}
                isSyncing={isSyncing}
                isImportingFile={isImportingFile}
                pendingLineageImport={pendingLineageImport}
                onSyncGoogleSheet={handleSyncGoogleSheet}
                onImportLineageFile={handleImportLineageFile}
                onConfirmPendingImport={confirmPendingLineageImport}
                onCancelPendingImport={cancelPendingLineageImport}
              />

              {settings.googleSheetLastSynced && (
                <p className="text-[10px] font-mono text-emerald-800/70">
                  Lần đồng bộ cuối: <strong>{settings.googleSheetLastSynced}</strong>
                </p>
              )}

              {syncStatus.msg && (
                <div className={`p-3 rounded text-xs border ${
                  syncStatus.type === 'success'
                    ? 'bg-emerald-100 border-emerald-300 text-emerald-950'
                    : syncStatus.type === 'error'
                      ? 'bg-red-50 border-red-200 text-red-950'
                      : 'bg-indigo-50 border-indigo-200 text-indigo-950'
                }`}>
                  {syncStatus.type === 'success' ? '✓' : '⚠️'} {syncStatus.msg}
                </div>
              )}

              <ImportColumnGuide />
              <LineageDiagnosticsReport diagnostics={diagnostics} />
              <TreeJsonBackupPanel
                rawLineageInput={rawLineageInput}
                treeImportMsg={treeImportMsg}
                onRawLineageInputChange={setRawLineageInput}
                onExportTreeJson={handleExportTreeJson}
                onImportTreeJson={handleImportTreeJson}
                onResetTreeDatabase={handleResetTreeDatabase}
                onClearAllTreeData={handleClearAllTreeData}
              />
            </div>
          </CollapsibleAdminFolder>

          <CollapsibleAdminFolder
            title="2. Cấu hình Thẩm mỹ, Giao diện & Chế độ hòa trộn"
            isOpen={openFolders['appearance']}
            onToggle={() => toggleFolder('appearance')}
          >
            <AppearanceSettingsPanel settings={settings} setSettings={setSettings} />
          </CollapsibleAdminFolder>

          <CollapsibleAdminFolder
            title="3. Đại quản danh xưng nút bấm, Tiêu đề & Logo nhãn tự"
            isOpen={openFolders['buttons']}
            onToggle={() => toggleFolder('buttons')}
          >
            <BrandingLabelsPanel settings={settings} setSettings={setSettings} />
          </CollapsibleAdminFolder>

          <CollapsibleAdminFolder
            title="4. Kết nối Dịch vụ ngoại vi & APIs (Gemini & Zalo)"
            isOpen={openFolders['apis']}
            onToggle={() => toggleFolder('apis')}
          >
            <ExternalApiSettingsPanel settings={settings} setSettings={setSettings} />
          </CollapsibleAdminFolder>

        </div>

        {/* RIGHT COLUMN: Realtime Live parameters panel status */}
        <div className="lg:col-span-4 space-y-6">
          <SettingsMonitorPanel
            settings={settings}
            isSaved={isSaved}
            onSave={handleSaveSettings}
            onReset={handleResetSettings}
          />
        </div>

      </div>
    </div>
  );
}

