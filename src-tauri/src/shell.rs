use crate::{
    domain::{canonical_settings, Settings},
    provider,
    runtime::{self, Shared},
    storage::Store,
    window_layout::{PANEL_HEIGHT, PANEL_WIDTH},
};
use serde_json::Value;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager, State, WindowEvent};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_notification::NotificationExt;
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
    settings: Settings,
) -> Result<Settings, String> {
    let settings = canonical_settings(settings)?;
    let previous = state.lock().map_err(|e| e.to_string())?.settings.clone();
    if settings.autostart != previous.autostart {
        if settings.autostart {
            app.autolaunch().enable()
        } else {
            app.autolaunch().disable()
        }
        .map_err(|e| e.to_string())?;
    }
    if settings.notifications && !previous.notifications {
        app.notification()
            .request_permission()
            .map_err(|e| e.to_string())?;
    }
    {
        let mut state = state.lock().map_err(|e| e.to_string())?;
        state.store.save_settings(&settings)?;
        if settings.wallet != state.settings.wallet {
            state.reset_wallet();
        }
        state.settings = settings.clone();
    }
    let _ = app.emit("snapshot_updated", ());
    Ok(settings)
}
#[tauri::command]
fn select_account(
    app: tauri::AppHandle,
    state: State<Shared>,
    address: String,
) -> Result<Settings, String> {
    let mut settings = state.lock().map_err(|e| e.to_string())?.settings.clone();
    if !settings
        .accounts
        .iter()
        .any(|a| a.address.eq_ignore_ascii_case(&address))
    {
        return Err("Selected wallet is not saved.".into());
    }
    settings.wallet = address;
    update_settings(app, state, settings)
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
fn hide_panel(window: tauri::WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
fn position_native_panel(window: &tauri::WebviewWindow, toggle: bool) -> Result<bool, String> {
    use crate::window_layout::{panel_frame, Rect};
    use objc2::MainThreadMarker;
    use objc2_app_kit::{NSEvent, NSScreen, NSWindow};
    use objc2_foundation::{NSPoint, NSRect, NSSize};
    let mtm = MainThreadMarker::new().ok_or("Panel positioning requires the main thread.")?;
    let cursor = NSEvent::mouseLocation();
    let screens = NSScreen::screens(mtm);
    let screen = screens
        .iter()
        .find(|screen| {
            let f = screen.frame();
            Rect {
                x: f.origin.x,
                y: f.origin.y,
                width: f.size.width,
                height: f.size.height,
            }
            .contains((cursor.x, cursor.y))
        })
        .or_else(|| screens.iter().next())
        .ok_or("No display available.")?;
    let area = screen.visibleFrame();
    let target = panel_frame(
        Rect {
            x: area.origin.x,
            y: area.origin.y,
            width: area.size.width,
            height: area.size.height,
        },
        (cursor.x, cursor.y),
        true,
    );
    let ptr = window.ns_window().map_err(|e| e.to_string())?;
    // Tauri owns the NSWindow. Borrow it only on AppKit's main thread, without retaining or releasing it.
    let native = unsafe { &*(ptr as *const NSWindow) };
    let current = native.frame();
    let screen_frame = screen.frame();
    let same = Rect {
        x: screen_frame.origin.x,
        y: screen_frame.origin.y,
        width: screen_frame.size.width,
        height: screen_frame.size.height,
    }
    .contains((
        current.origin.x + current.size.width / 2.0,
        current.origin.y + current.size.height / 2.0,
    ));
    if toggle && window.is_visible().unwrap_or(false) && same {
        return Ok(true);
    }
    native.setFrame_display(
        NSRect::new(
            NSPoint::new(target.x, target.y),
            NSSize::new(PANEL_WIDTH, PANEL_HEIGHT),
        ),
        true,
    );
    Ok(false)
}
fn show_panel(
    app: &tauri::AppHandle,
    position: Option<tauri::PhysicalPosition<f64>>,
    toggle: bool,
) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        let Some(window) = handle.get_webview_window("main") else {
            return;
        };
        #[cfg(target_os = "macos")]
        {
            let _ = position;
            match position_native_panel(&window, toggle) {
                Ok(true) => {
                    let _ = window.hide();
                    return;
                }
                Err(error) => {
                    eprintln!("Panel positioning failed: {error}");
                    return;
                }
                _ => {}
            }
        }
        #[cfg(not(target_os = "macos"))]
        {
            use crate::window_layout::{windows_frame, Rect};
            let point = position.or_else(|| window.cursor_position().ok());
            let monitor = point
                .and_then(|p| window.monitor_from_point(p.x, p.y).ok().flatten())
                .or_else(|| window.primary_monitor().ok().flatten());
            if let Some(monitor) = monitor {
                let area = monitor.work_area();
                let scale = monitor.scale_factor();
                let same = window
                    .current_monitor()
                    .ok()
                    .flatten()
                    .is_some_and(|m| m.position() == monitor.position());
                if toggle && same && window.is_visible().unwrap_or(false) {
                    let _ = window.hide();
                    return;
                }
                let anchor = point.map(|p| (p.x, p.y)).unwrap_or((
                    area.position.x as f64 + area.size.width as f64 / 2.0,
                    area.position.y as f64,
                ));
                let frame = windows_frame(
                    Rect {
                        x: area.position.x as f64,
                        y: area.position.y as f64,
                        width: area.size.width as f64,
                        height: area.size.height as f64,
                    },
                    anchor,
                    scale,
                );
                let _ = window
                    .set_position(tauri::PhysicalPosition::new(frame.x as i32, frame.y as i32));
                let _ = window.set_size(tauri::PhysicalSize::new(
                    frame.width as u32,
                    frame.height as u32,
                ));
            }
        }
        let _ = window.show();
        let _ = window.set_focus();
        handle.state::<Shared>().lock().unwrap().network_visible = true;
    });
}
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            show_panel(app, None, false)
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            let path = app.path().app_data_dir()?;
            std::fs::create_dir_all(&path)?;
            let store = Store::open_with_recovery(&path.join("monitor.sqlite"))
                .map_err(std::io::Error::other)?;
            let engine = Arc::new(Mutex::new(
                runtime::Engine::new(store).map_err(std::io::Error::other)?,
            ));
            let client = provider::client()?;
            app.manage(engine.clone());
            app.manage(Client(client.clone()));
            let mut pixels = vec![0u8; 32 * 32 * 4];
            for y in 5..27 {
                for x in 5..27 {
                    if !(9..=22).contains(&x) || !(9..=22).contains(&y) || (14..18).contains(&x) {
                        let i = (y * 32 + x) * 4;
                        pixels[i..i + 4].copy_from_slice(&[75, 196, 166, 255]);
                    }
                }
            }
            tauri::tray::TrayIconBuilder::with_id("monitor")
                .icon(tauri::image::Image::new_owned(pixels, 32, 32))
                .icon_as_template(true)
                .tooltip("TapeOut Live")
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        position,
                        ..
                    } = event
                    {
                        show_panel(tray.app_handle(), Some(position), true);
                    }
                })
                .build(app)?;
            runtime::launch(app.handle().clone(), engine.clone(), client);
            show_panel(app.handle(), None, false);
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = window.hide();
            }
            WindowEvent::Focused(focused) if window.label() == "main" => {
                let state = window.state::<Shared>();
                let mut engine = state.lock().unwrap();
                engine.network_visible =
                    *focused || (engine.settings.pinned && window.is_visible().unwrap_or(false));
                let dismiss = !*focused && !engine.settings.pinned;
                drop(engine);
                if dismiss {
                    let _ = window.hide();
                }
            }
            #[cfg(not(target_os = "macos"))]
            WindowEvent::ScaleFactorChanged { scale_factor, .. } => {
                let _ = window.set_size(tauri::PhysicalSize::new(
                    (PANEL_WIDTH * scale_factor) as u32,
                    (PANEL_HEIGHT * scale_factor) as u32,
                ));
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            get_dashboard,
            get_history,
            update_settings,
            select_account,
            refresh_resource,
            set_network_visible,
            clear_history,
            hide_panel
        ])
        .run(tauri::generate_context!())
        .expect("Could not start TapeOut Live");
}
