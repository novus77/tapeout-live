use crate::{domain::Settings, runtime::Shared};
use serde::Serialize;
use std::sync::Mutex;
use tauri::{Emitter, Manager, Theme};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeAppearance {
    pub system_dark: bool,
    pub material: bool,
}

#[derive(Default)]
pub struct AppearanceState {
    pub current: Mutex<NativeAppearance>,
    applied: Mutex<Option<(bool, bool, bool)>>,
}

pub fn resolve_dark(settings: &Settings, system_dark: bool) -> bool {
    if settings.follow_system_theme {
        system_dark
    } else {
        settings.theme == "dark"
    }
}

pub fn native_theme(settings: &Settings) -> Option<Theme> {
    if settings.follow_system_theme {
        None
    } else if settings.theme == "dark" {
        Some(Theme::Dark)
    } else {
        Some(Theme::Light)
    }
}

pub fn material_allowed(reduce_transparency: bool, high_contrast: bool, composition: bool) -> bool {
    !reduce_transparency && !high_contrast && composition
}

#[cfg(target_os = "macos")]
fn system_preferences() -> (bool, bool) {
    use objc2_app_kit::NSWorkspace;
    use objc2_foundation::{NSString, NSUserDefaults};
    let dark = NSUserDefaults::standardUserDefaults()
        .stringForKey(&NSString::from_str("AppleInterfaceStyle"))
        .is_some_and(|value| value.to_string() == "Dark");
    let workspace = NSWorkspace::sharedWorkspace();
    let allowed = material_allowed(
        workspace.accessibilityDisplayShouldReduceTransparency(),
        workspace.accessibilityDisplayShouldIncreaseContrast(),
        true,
    );
    (dark, allowed)
}

#[cfg(target_os = "windows")]
fn system_preferences() -> (bool, bool) {
    use windows_sys::Win32::{
        Graphics::Dwm::DwmIsCompositionEnabled,
        System::Registry::{RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_DWORD},
        UI::{
            Accessibility::{HCF_HIGHCONTRASTON, HIGHCONTRASTW},
            WindowsAndMessaging::{SystemParametersInfoW, SPI_GETHIGHCONTRAST},
        },
    };
    fn setting(name: &str) -> Option<u32> {
        let key: Vec<u16> = "Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize\0"
            .encode_utf16()
            .collect();
        let name: Vec<u16> = name.encode_utf16().chain(Some(0)).collect();
        let mut value = 0u32;
        let mut size = std::mem::size_of::<u32>() as u32;
        // Both buffers are null terminated; the API writes only one DWORD.
        let result = unsafe {
            RegGetValueW(
                HKEY_CURRENT_USER,
                key.as_ptr(),
                name.as_ptr(),
                RRF_RT_REG_DWORD,
                std::ptr::null_mut(),
                (&mut value as *mut u32).cast(),
                &mut size,
            )
        };
        (result == 0).then_some(value)
    }
    let mut contrast = HIGHCONTRASTW {
        cbSize: std::mem::size_of::<HIGHCONTRASTW>() as u32,
        ..Default::default()
    };
    let mut composition = 0;
    // Initialized OS-owned structures are queried read-only; unknown state fails closed.
    let (contrast_known, composition_known) = unsafe {
        (
            SystemParametersInfoW(
                SPI_GETHIGHCONTRAST,
                contrast.cbSize,
                (&mut contrast as *mut HIGHCONTRASTW).cast(),
                0,
            ) != 0,
            DwmIsCompositionEnabled(&mut composition) >= 0,
        )
    };
    let dark = setting("AppsUseLightTheme") == Some(0);
    let allowed = material_allowed(
        setting("EnableTransparency") != Some(1),
        !contrast_known || contrast.dwFlags & HCF_HIGHCONTRASTON != 0,
        composition_known && composition != 0,
    );
    (dark, allowed)
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn system_preferences() -> (bool, bool) {
    (false, false)
}

fn apply_material(window: &tauri::WebviewWindow, dark: bool, allowed: bool) -> bool {
    #[cfg(target_os = "macos")]
    let result = if allowed {
        window_vibrancy::apply_vibrancy(
            window,
            window_vibrancy::NSVisualEffectMaterial::Sidebar,
            Some(window_vibrancy::NSVisualEffectState::Active),
            Some(18.0),
        )
    } else {
        window_vibrancy::clear_vibrancy(window).map(|_| ())
    };
    #[cfg(target_os = "windows")]
    let result = if allowed {
        window_vibrancy::apply_acrylic(
            window,
            Some(if dark {
                (24, 32, 29, 210)
            } else {
                (246, 245, 241, 180)
            }),
        )
    } else {
        window_vibrancy::clear_acrylic(window)
    };
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let result: Result<(), String> = {
        let _ = window;
        Err("Native material unavailable".into())
    };
    #[cfg(not(target_os = "windows"))]
    let _ = dark;
    if let Err(error) = &result {
        eprintln!("Native material fallback: {error}");
    }
    allowed && result.is_ok()
}

// All callers execute on the UI thread. OS preference reads are independent of a forced window theme.
pub fn update(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let settings = app.state::<Shared>().lock().unwrap().settings.clone();
    let (system_dark, allowed) = system_preferences();
    let dark = resolve_dark(&settings, system_dark);
    let state = app.state::<AppearanceState>();
    let mut applied = state.applied.lock().unwrap();
    let previous = *state.current.lock().unwrap();
    let desired = (dark, allowed, settings.follow_system_theme);
    let material = if *applied != Some(desired) {
        if let Err(error) = window.set_theme(native_theme(&settings)) {
            eprintln!("Window theme fallback: {error}");
        }
        let material = apply_material(&window, dark, allowed);
        let color = if material {
            tauri::window::Color(0, 0, 0, 0)
        } else if dark {
            tauri::window::Color(24, 32, 29, 255)
        } else {
            tauri::window::Color(246, 245, 241, 255)
        };
        if let Err(error) = window.set_background_color(Some(color)) {
            eprintln!("Window background fallback: {error}");
        }
        *applied = Some(desired);
        material
    } else {
        previous.material
    };
    let current = NativeAppearance {
        system_dark,
        material,
    };
    *state.current.lock().unwrap() = current;
    if current != previous {
        let _ = app.emit("appearance_updated", current);
    }
}

pub fn launch(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        // ThemeChanged handles appearance immediately. Polling also catches accessibility changes
        // on platforms without a uniform event and while the webview is hidden.
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            let handle = app.clone();
            if app.run_on_main_thread(move || update(&handle)).is_err() {
                break;
            }
        }
    });
}
