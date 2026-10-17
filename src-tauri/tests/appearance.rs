use serde_json::json;
use tapeout_live::{
    domain::{canonical_settings, Settings},
    storage::Store,
};

#[test]
fn native_policy_preserves_manual_choice_and_accessibility_fallback() {
    use tapeout_live::appearance::{material_allowed, resolve_dark};
    let mut settings = Settings {
        theme: "dark".into(),
        ..Default::default()
    };
    assert!(resolve_dark(&settings, false));
    settings.follow_system_theme = true;
    assert!(!resolve_dark(&settings, false));
    assert!(resolve_dark(&settings, true));
    settings.follow_system_theme = false;
    assert!(resolve_dark(&settings, false));
    assert!(material_allowed(false, false, true));
    assert!(!material_allowed(true, false, true));
    assert!(!material_allowed(false, true, true));
    assert!(!material_allowed(false, false, false));
}

#[test]
fn following_system_does_not_force_a_native_theme_or_suppress_os_events() {
    use tapeout_live::appearance::native_theme;
    let mut settings = Settings {
        theme: "dark".into(),
        ..Default::default()
    };
    assert_eq!(native_theme(&settings), Some(tauri::Theme::Dark));
    settings.follow_system_theme = true;
    assert_eq!(native_theme(&settings), None);
    settings.theme = "light".into();
    assert_eq!(native_theme(&settings), None);
    settings.follow_system_theme = false;
    assert_eq!(native_theme(&settings), Some(tauri::Theme::Light));
}

#[test]
fn legacy_settings_keep_preferences_and_default_to_manual_warm_white() {
    let old = json!({
        "wallet":"0x0000000000000000000000000000000000000001",
        "alias":"Saved miner", "language":"en", "project":"fab",
        "interval":300, "notifications":true, "autostart":true, "pinned":true,
        "powerDrop":25.0
    });
    let migrated = canonical_settings(serde_json::from_value(old).unwrap()).unwrap();
    let encoded = serde_json::to_value(&migrated).unwrap();
    assert_eq!(encoded["theme"], "light");
    assert_eq!(encoded["followSystemTheme"], false);
    assert_eq!(migrated.language, "en");
    assert_eq!(migrated.project, "fab");
    assert_eq!(migrated.interval, 300);
    assert!(migrated.notifications && migrated.autostart && migrated.pinned);
    assert_eq!(migrated.power_drop, 25.0);
    assert_eq!(migrated.accounts[0].name, "Saved miner");
}

#[test]
fn unknown_manual_theme_is_rejected() {
    let settings: Settings = serde_json::from_value(json!({"theme":"invalid"})).unwrap();
    assert!(canonical_settings(settings).is_err());
}

#[test]
fn appearance_survives_restart_and_corrupt_database_recovery() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("monitor.sqlite");
    let settings: Settings =
        serde_json::from_value(json!({"theme":"dark", "followSystemTheme":true})).unwrap();
    let store = Store::open(&path).unwrap();
    store.save_settings(&settings).unwrap();
    drop(store);
    let store = Store::open(&path).unwrap();
    assert_eq!(
        serde_json::to_value(store.settings().unwrap()).unwrap()["theme"],
        "dark"
    );
    drop(store);
    std::fs::write(&path, b"corrupt test database").unwrap();
    let recovered = Store::open_with_recovery(&path).unwrap();
    let encoded = serde_json::to_value(recovered.settings().unwrap()).unwrap();
    assert_eq!(encoded["theme"], "dark");
    assert_eq!(encoded["followSystemTheme"], true);
}

#[test]
fn failed_database_save_keeps_the_confirmed_recovery_backup() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("monitor.sqlite");
    let store = Store::open(&path).unwrap();
    store.save_settings(&Settings::default()).unwrap();
    let previous = std::fs::read(path.with_extension("settings.json")).unwrap();
    let connection = rusqlite::Connection::open(&path).unwrap();
    connection.execute_batch("CREATE TRIGGER reject_settings BEFORE INSERT ON settings BEGIN SELECT RAISE(ABORT, 'Test save failure'); END;").unwrap();
    let next = Settings {
        theme: "dark".into(),
        ..Default::default()
    };
    assert!(store.save_settings(&next).is_err());
    assert_eq!(
        std::fs::read(path.with_extension("settings.json")).unwrap(),
        previous
    );
    assert_eq!(store.settings().unwrap().theme, "light");
}
