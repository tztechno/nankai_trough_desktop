use std::path::PathBuf;

use tauri::Manager;

/// フロントエンドから受け取ったファイル (CSV / MP4) をダウンロードフォルダに保存し、保存先パスを返す。
/// WebView では <a download> による Blob 保存が動作しないため、このコマンド経由で書き込む。
/// 本文は生バイト列、ファイル名は `x-filename` ヘッダー (URL エンコード) で受け取る。
#[tauri::command]
fn save_file(app: tauri::AppHandle, request: tauri::ipc::Request<'_>) -> Result<String, String> {
  let tauri::ipc::InvokeBody::Raw(data) = request.body() else {
    return Err("expected raw file data".into());
  };
  let encoded = request
    .headers()
    .get("x-filename")
    .and_then(|v| v.to_str().ok())
    .ok_or("missing x-filename header")?;
  let filename = sanitize_filename(&percent_decode(encoded));
  if filename.is_empty() {
    return Err("invalid filename".into());
  }

  let dir = app
    .path()
    .download_dir()
    .or_else(|_| app.path().document_dir())
    .map_err(|e| e.to_string())?;
  let path = unique_path(dir, &filename);
  std::fs::write(&path, data).map_err(|e| e.to_string())?;
  Ok(path.to_string_lossy().into_owned())
}

/// パス区切りなどファイル名に使えない文字を除去
fn sanitize_filename(name: &str) -> String {
  name
    .chars()
    .filter(|c| !matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') && !c.is_control())
    .collect::<String>()
    .trim_matches(|c| c == '.' || c == ' ')
    .to_string()
}

/// 同名ファイルがある場合は "name (1).ext" のように番号を付ける
fn unique_path(dir: PathBuf, filename: &str) -> PathBuf {
  let candidate = dir.join(filename);
  if !candidate.exists() {
    return candidate;
  }
  let (stem, ext) = match filename.rfind('.') {
    Some(i) if i > 0 => (&filename[..i], &filename[i..]),
    _ => (filename, ""),
  };
  (1..)
    .map(|n| dir.join(format!("{stem} ({n}){ext}")))
    .find(|p| !p.exists())
    .unwrap()
}

/// encodeURIComponent で符号化された文字列を復号
fn percent_decode(s: &str) -> String {
  let bytes = s.as_bytes();
  let mut out = Vec::with_capacity(bytes.len());
  let mut i = 0;
  while i < bytes.len() {
    if bytes[i] == b'%' && i + 2 < bytes.len() {
      if let Ok(b) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
        out.push(b);
        i += 3;
        continue;
      }
    }
    out.push(bytes[i]);
    i += 1;
  }
  String::from_utf8_lossy(&out).into_owned()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![save_file])
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
