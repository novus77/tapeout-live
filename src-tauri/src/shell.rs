use crate::{
    domain::{validate_settings, Settings},
    provider,
    runtime::{self, Shared},
    storage::Store,
};
use serde_json::Value;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager, State, WindowEvent};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;

struct Client(reqwest::Client);
#[tauri::command]
fn get_dashboard(state: State<Shared>) -> Result<Value, String> {
    state.lock().map_err(|e| e.to_string())?.dashboard()
}
#[tauri::command]
fn get_history(state: State<Shared>, resource: String, metric: String) -> Result<Value, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.store.history(
        &resource,
        if resource == "address" {
            &state.settings.wallet
        } else {
            ""
        },
        &metric,
    )
}
#[tauri::command]
fn update_settings(
    app: tauri::AppHandle,
    state: State<Shared>,
    mut settings: Settings,
) -> Result<(), String> {
    settings.wallet = settings.wallet.trim().to_lowercase();
    settings.alias = settings.alias.trim().into();
    validate_settings(&settings)?;
    let mut state = state.lock().map_err(|e| e.to_string())?;
    if settings.autostart != state.settings.autostart {
        if settings.autostart {
            app.autolaunch().enable()
        } else {
            app.autolaunch().disable()
        }
        .map_err(|e| e.to_string())?;
    }
    if settings.notifications && !state.settings.notifications {
        app.notification()
            .request_permission()
            .map_err(|e| e.to_string())?;
    }
    state.store.save_settings(&settings)?;
    if settings.wallet != state.settings.wallet {
        state.reset_wallet();
    }
    state.settings = settings;
    for job in state.jobs.values_mut() {
        if !job.terminal && job.failures == 0 {
            job.next_at = job.next_at.min(chrono::Utc::now().timestamp() + 10);
        }
    }
    let _ = app.emit("snapshot_updated", ());
    Ok(())
}
#[tauri::command]
fn refresh_resource(
    app: tauri::AppHandle,
    state: State<Shared>,
    client: State<Client>,
    resource: String,
) -> Result<(), String> {
    if !["address", "market", "network"].contains(&resource.as_str()) {
        return Err("Unsupported resource.".into());
    }
    runtime::refresh(app, (*state).clone(), client.0.clone(), resource, true);
    Ok(())
}
#[tauri::command]
fn set_network_visible(state: State<Shared>, visible: bool) {
    state.lock().unwrap().network_visible = visible;
}
#[tauri::command]
fn clear_history(state: State<Shared>) -> Result<(), String> {
    state.lock().unwrap().store.clear_history()
}
#[tauri::command]
fn open_scan(app: tauri::AppHandle, state: State<Shared>) -> Result<(), String> {
    let wallet = state.lock().unwrap().settings.wallet.clone();
    let url = if wallet.is_empty() {
        provider::ORIGIN.into()
    } else {
        format!("{}/?q={wallet}", provider::ORIGIN)
    };
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}
#[tauri::command]
fn copy_wallet(state: State<Shared>) -> String {
    state.lock().unwrap().settings.wallet.clone()
}
#[tauri::command]
fn hide_panel(window: tauri::WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}
#[tauri::command]
fn quit(app: tauri::AppHandle) {
    app.exit(0);
}
#[tauri::command]
fn open_details(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("details") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    } else {
        tauri::WebviewWindowBuilder::new(
            &app,
            "details",
            tauri::WebviewUrl::App("index.html?details=1".into()),
        )
        .title("TapeOut Live — Circuits")
        .inner_size(900.0, 640.0)
        .min_inner_size(500.0, 400.0)
        .build()
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}
fn show_panel(app: &tauri::AppHandle, position: Option<tauri::PhysicalPosition<f64>>) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let monitor = position
        .and_then(|p| window.monitor_from_point(p.x, p.y).ok().flatten())
        .or_else(|| window.current_monitor().ok().flatten());
    if let Some(monitor) = monitor {
        let scale = monitor.scale_factor();
        let area = monitor.work_area();
        let width = (408.0 * scale)
            .min(area.size.width as f64 - 32.0)
            .max(280.0);
        let height = (740.0 * scale)
            .min(area.size.height as f64 - 32.0)
            .max(300.0);
        let origin = area.position;
        let mut x = origin.x as f64 + (area.size.width as f64 - width) / 2.0;
        let mut y = origin.y as f64 + (area.size.height as f64 - height) / 2.0;
        if let Some(p) = position {
            x = p.x - width / 2.0;
            y = if p.y < origin.y as f64 + area.size.height as f64 / 2.0 {
                p.y + 12.0 * scale
            } else {
                p.y - height - 12.0 * scale
            };
        }
        x = x.clamp(
            origin.x as f64 + 8.0,
            origin.x as f64 + area.size.width as f64 - width - 8.0,
        );
        y = y.clamp(
            origin.y as f64 + 8.0,
            origin.y as f64 + area.size.height as f64 - height - 8.0,
        );
        let _ = window.set_size(tauri::PhysicalSize::new(width as u32, height as u32));
        let _ = window.set_position(tauri::PhysicalPosition::new(x as i32, y as i32));
    }
    let _ = window.show();
    let _ = window.set_focus();
}
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            show_panel(app, None)
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            let path = app.path().app_data_dir()?;
            std::fs::create_dir_all(&path)?;
            let store = Store::open(&path.join("monitor.sqlite")).map_err(std::io::Error::other)?;
            let engine = Arc::new(Mutex::new(
                runtime::Engine::new(store).map_err(std::io::Error::other)?,
            ));
            let client = provider::client()?;
            app.manage(engine.clone());
            app.manage(Client(client.clone()));
            use tauri::menu::{Menu, MenuItem};
            let open = MenuItem::with_id(app, "open", "Open monitor", true, None::<&str>)?;
            let exit = MenuItem::with_id(app, "quit", "Quit TapeOut Live", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &exit])?;
            let mut pixels = vec![0u8; 32 * 32 * 4];
            for y in 5..27 {
                for x in 5..27 {
                    if !(9..=22).contains(&x) || !(9..=22).contains(&y) || (x > 13 && x < 18) {
                        let i = (y * 32 + x) * 4;
                        pixels[i..i + 4].copy_from_slice(&[75, 196, 166, 255]);
                    }
                }
            }
            tauri::tray::TrayIconBuilder::with_id("monitor")
                .icon(tauri::image::Image::new_owned(pixels, 32, 32))
                .icon_as_template(true)
                .tooltip("TapeOut Live")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "open" => show_panel(app, None),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        position,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                show_panel(app, Some(position));
                            }
                        }
                    }
                })
                .build(app)?;
            runtime::launch(app.handle().clone(), engine.clone(), client);
            if engine.lock().unwrap().settings.wallet.is_empty() {
                show_panel(app.handle(), None);
            }
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = window.hide();
            }
            WindowEvent::Focused(false) if window.label() == "main" => {
                let state = window.state::<Shared>();
                if !state.lock().unwrap().settings.pinned {
                    let _ = window.hide();
                }
                state.lock().unwrap().network_visible = false;
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            get_dashboard,
            get_history,
            update_settings,
            refresh_resource,
            set_network_visible,
            clear_history,
            open_scan,
            copy_wallet,
            hide_panel,
            quit,
            open_details
        ])
        .run(tauri::generate_context!())
        .expect("Could not start TapeOut Live");
}
