/**
 * アプリ内ダイアログ・通知・ファイル保存ユーティリティ
 *
 * デスクトップ版 (Tauri / WKWebView) では window.alert / window.confirm が表示されず、
 * <a download> による Blob 保存も動作しないことがあるため、Web 版と共通で使える実装に置き換える。
 */

let okLabel = 'OK';
let cancelLabel = 'キャンセル';

export function setDialogLabels(ok: string, cancel: string): void {
  okLabel = ok;
  cancelLabel = cancel;
}

function openDialog(message: string, withCancel: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'app-dialog-overlay';

    const box = document.createElement('div');
    box.className = 'app-dialog';

    const text = document.createElement('p');
    text.className = 'app-dialog-message';
    text.textContent = message;

    const buttons = document.createElement('div');
    buttons.className = 'app-dialog-buttons';

    const close = (result: boolean) => {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(result);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    };

    if (withCancel) {
      const cancel = document.createElement('button');
      cancel.className = 'btn btn-ghost';
      cancel.textContent = cancelLabel;
      cancel.addEventListener('click', () => close(false));
      buttons.appendChild(cancel);
    }
    const ok = document.createElement('button');
    ok.className = 'btn btn-primary';
    ok.textContent = okLabel;
    ok.addEventListener('click', () => close(true));
    buttons.appendChild(ok);

    box.appendChild(text);
    box.appendChild(buttons);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKey);
    ok.focus();
  });
}

export function showAlert(message: string): Promise<void> {
  return openDialog(message, false).then(() => undefined);
}

export function showConfirm(message: string): Promise<boolean> {
  return openDialog(message, true);
}

/**
 * 画面右下に数秒間表示される通知
 */
export function notify(message: string): void {
  let host = document.getElementById('app-toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'app-toast-host';
    document.body.appendChild(host);
  }
  const toast = document.createElement('div');
  toast.className = 'app-toast';
  toast.textContent = message;
  host.appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
}

interface TauriInternals {
  invoke: (cmd: string, args?: unknown, options?: { headers: Record<string, string> }) => Promise<unknown>;
}

/**
 * Blob をファイルとして保存する。
 * デスクトップ版はダウンロードフォルダに直接書き込み、保存先パスを返す。Web 版はブラウザのダウンロード (戻り値 null)。
 */
export async function saveBlob(blob: Blob, filename: string): Promise<string | null> {
  const tauri = (window as unknown as { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__;
  if (tauri?.invoke) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const savedPath = await tauri.invoke('save_file', bytes, { headers: { 'x-filename': encodeURIComponent(filename) } });
    return String(savedPath);
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return null;
}
