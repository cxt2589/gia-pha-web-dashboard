import React from 'react';
import * as XLSX from 'xlsx';
import {
  AppConfig,
  getPersistedTreeData,
  parseCSVToObjects,
  resetPersistedTreeData,
  saveAppSettings,
  savePersistedTreeData
} from '../../utils/configManager';
import { ANCESTRAL_TREE } from '../../data/lineageData';
import { analyzeImportRows } from '../../utils/importValidation';
import { parseWorksheetToRows } from '../../utils/spreadsheetImport';
import { PendingLineageImport } from './ImportValidationReport';

type UseLineageImportAdminParams = {
  settings: AppConfig;
  setSettings: React.Dispatch<React.SetStateAction<AppConfig>>;
};

export function useLineageImportAdmin({ settings, setSettings }: UseLineageImportAdminParams) {
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isImportingFile, setIsImportingFile] = React.useState(false);
  const [syncStatus, setSyncStatus] = React.useState<{type: 'success'|'error'|'idle', msg: string}>({type: 'idle', msg: ''});
  const [syncMode, setSyncMode] = React.useState<'overwrite' | 'merge'>('overwrite');
  const [pendingLineageImport, setPendingLineageImport] = React.useState<PendingLineageImport | null>(null);
  const [rawLineageInput, setRawLineageInput] = React.useState('');
  const [treeImportMsg, setTreeImportMsg] = React.useState('');
  const [diagnostics, setDiagnostics] = React.useState<any>(() => {
    const currentTree = getPersistedTreeData(ANCESTRAL_TREE);
    return currentTree?._diagnostics || null;
  });

  const prepareImportedRows = React.useCallback((rows: any[], sourceLabel: string, postConfirmSettings?: AppConfig) => {
    const { treeData, summary } = analyzeImportRows(rows, sourceLabel, {
      syncMode,
      existingTreeToMerge: syncMode === 'merge' ? getPersistedTreeData(ANCESTRAL_TREE) : undefined
    });
    setPendingLineageImport({ rows, sourceLabel, treeData, summary, postConfirmSettings });

    if (summary.errors.length > 0) {
      setSyncStatus({
        type: 'error',
        msg: `${sourceLabel}: phát hiện ${summary.errors.length} lỗi nghiêm trọng. Chưa nhập dữ liệu.`
      });
      return;
    }

    setSyncStatus({
      type: 'idle',
      msg: `${sourceLabel}: đã đọc ${rows.length} dòng. Vui lòng kiểm tra báo cáo rồi bấm "Xác nhận nhập dữ liệu".`
    });
  }, [syncMode]);

  const confirmPendingLineageImport = React.useCallback(() => {
    if (!pendingLineageImport) return;
    const { treeData, summary, sourceLabel, postConfirmSettings } = pendingLineageImport;

    if (summary.errors.length > 0) {
      setSyncStatus({
        type: 'error',
        msg: 'Không thể nhập vì vẫn còn lỗi nghiêm trọng trong báo cáo kiểm tra.'
      });
      return;
    }

    savePersistedTreeData(treeData);

    if (treeData._diagnostics) {
      setDiagnostics(treeData._diagnostics);
    }

    if (postConfirmSettings) {
      setSettings(postConfirmSettings);
      saveAppSettings(postConfirmSettings);
    }

    setSyncStatus({
      type: 'success',
      msg: `${sourceLabel}: đã nhập thành công ${summary.rowCount} dòng. Cây phả hệ đã được cập nhật.`
    });
    setPendingLineageImport(null);
  }, [pendingLineageImport, setSettings]);

  const cancelPendingLineageImport = React.useCallback(() => {
    setPendingLineageImport(null);
    setSyncStatus({ type: 'idle', msg: 'Đã hủy bản kiểm tra import. Dữ liệu hiện tại chưa thay đổi.' });
  }, []);

  const handleImportLineageFile = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isCsv = fileName.endsWith('.csv') || file.type === 'text/csv';
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (!isCsv && !isExcel) {
      setSyncStatus({type: 'error', msg: 'Chỉ hỗ trợ file .csv, .xlsx hoặc .xls.'});
      return;
    }

    setIsImportingFile(true);
    setSyncStatus({type: 'idle', msg: `Đang đọc file: ${file.name}...`});

    try {
      if (isCsv) {
        const csvText = await file.text();
        prepareImportedRows(parseCSVToObjects(csvText), file.name);
      } else {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          throw new Error('File Excel không có sheet dữ liệu.');
        }

        const rows = parseWorksheetToRows(workbook.Sheets[firstSheetName]);
        prepareImportedRows(rows, `${file.name} / ${firstSheetName}`);
      }
    } catch (err: any) {
      console.error(err);
      setSyncStatus({
        type: 'error',
        msg: err.message || 'Lỗi bất định khi đọc file dữ liệu.'
      });
    } finally {
      setIsImportingFile(false);
    }
  }, [prepareImportedRows]);

  const handleSyncGoogleSheet = React.useCallback(async () => {
    if (!settings.googleSheetId.trim()) {
      setSyncStatus({type: 'error', msg: 'Vui lòng nhập ID Google Sheet hợp lệ!'});
      return;
    }

    setIsSyncing(true);
    setSyncStatus({type: 'idle', msg: 'Đang kết nối cổng Google Sheets API...'});

    try {
      const sheetIdClean = settings.googleSheetId.trim();
      let finalId = sheetIdClean;
      let finalGid = '';
      if (sheetIdClean.includes('docs.google.com/spreadsheets')) {
        const matches = sheetIdClean.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (matches && matches[1]) {
          finalId = matches[1];
        }
        const gidMatches = sheetIdClean.match(/[?#&]gid=(\d+)/);
        if (gidMatches && gidMatches[1]) {
          finalGid = gidMatches[1];
        }
      } else {
        const idWithGidMatches = sheetIdClean.match(/^([a-zA-Z0-9-_]+)(?:[#?&]gid=(\d+))?$/);
        if (idWithGidMatches) {
          finalId = idWithGidMatches[1];
          finalGid = idWithGidMatches[2] || '';
        }
      }

      const csvUrl = `https://docs.google.com/spreadsheets/d/${finalId}/export?format=csv${finalGid ? `&gid=${finalGid}` : ''}`;

      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error("Không thể truy xuất dữ liệu Sheet. Đảm bảo Sheet đã được đặt quyền Chia sẻ ở chế độ 'Bất kỳ ai có liên kết đều xem được' (Anyone with link can view).");
      }

      const csvText = await response.text();
      const rows = parseCSVToObjects(csvText);

      if (rows.length === 0) {
        throw new Error('Tập tin CSV rỗng hoặc không đúng định dạng cột tiêu đề!');
      }

      const updatedSettings = {
        ...settings,
        googleSheetId: finalGid ? `${finalId}#gid=${finalGid}` : finalId,
        googleSheetSyncEnabled: true,
        googleSheetLastSynced: new Date().toLocaleString('vi-VN')
      };

      prepareImportedRows(rows, `Google Sheet ${finalGid ? `gid ${finalGid}` : finalId}`, updatedSettings);
    } catch (err: any) {
      console.error(err);
      setSyncStatus({
        type: 'error',
        msg: err.message || 'Lỗi bất định khi phân giải dữ liệu bảng tính.'
      });
    } finally {
      setIsSyncing(false);
    }
  }, [prepareImportedRows, settings]);

  const handleResetTreeDatabase = React.useCallback(() => {
    if (window.confirm('Đặt lại phả hệ về bộ dữ liệu gốc Ninh Bình mặc định ban đầu?')) {
      resetPersistedTreeData();
      setRawLineageInput('');
      const freshTree = getPersistedTreeData(ANCESTRAL_TREE);
      setDiagnostics(freshTree?._diagnostics || null);
      setSyncStatus({type: 'success', msg: 'Khôi phục phả hệ gốc thành công!'});
      setTimeout(() => setSyncStatus({type: 'idle', msg: ''}), 3000);
    }
  }, []);

  const handleClearAllTreeData = React.useCallback(() => {
    if (window.confirm('🔴 CẢNH BÁO QUAN TRỌNG: Quý vị có chắc chắn muốn XÓA SẠCH HOÀN TOÀN toàn bộ phả hệ hiện tại để nhập lại từ đầu không? Hành động này sẽ xóa hết tất cả thành viên cũ (bao gồm cả dữ liệu mẫu) và không thể hoàn tác.')) {
      const emptyTree = {
        id: 'empty-root',
        name: 'Người Sáng Lập Dòng Họ (Nhập từ đầu)',
        generation: 1,
        gender: 'nam',
        title: 'Sáng Lập Tổ',
        isLiving: false,
        children: []
      };
      savePersistedTreeData(emptyTree);
      setRawLineageInput('');
      setDiagnostics(null);
      setSyncStatus({type: 'success', msg: 'Đã xóa trắng toàn bộ dữ liệu thành công! Hãy dán liên kết Google Sheet mới của quý vị để đồng bộ sạch sẽ.'});
      setTimeout(() => setSyncStatus({type: 'idle', msg: ''}), 5000);
    }
  }, []);

  const handleExportTreeJson = React.useCallback(() => {
    const currentTree = getPersistedTreeData(ANCESTRAL_TREE);
    setRawLineageInput(JSON.stringify(currentTree, null, 2));
    setTreeImportMsg('Sao chép chuỗi JSON bên dưới để sao lưu.');
  }, []);

  const handleImportTreeJson = React.useCallback(() => {
    try {
      const parsed = JSON.parse(rawLineageInput);
      if (!parsed || !parsed.id || !parsed.name) {
        throw new Error('Chuỗi dữ liệu bị thiếu trường id hoặc name chính!');
      }
      savePersistedTreeData(parsed);
      setTreeImportMsg('Nhập phả hệ thủ công thành công! Hệ thống đã tải dữ liệu mới.');
    } catch (err: any) {
      setTreeImportMsg('Lỗi phân giải JSON: ' + err.message);
    }
  }, [rawLineageInput]);

  return {
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
    treeImportMsg,
    confirmPendingLineageImport,
    cancelPendingLineageImport
  };
}
