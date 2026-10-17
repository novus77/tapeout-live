use serde_json::json;
use tapeout_live::{
    domain::{canonical_settings, Account, Settings},
    window_layout::{panel_frame, windows_frame, Rect},
};
#[test]
fn legacy_wallet_migrates_without_replacing_its_address() {
    let old: Settings = serde_json::from_value(
        json!({"wallet":"0x0000000000000000000000000000000000000001","alias":"My miner"}),
    )
    .unwrap();
    let next = canonical_settings(old).unwrap();
    assert_eq!(next.accounts.len(), 1);
    assert_eq!(next.accounts[0].address, next.wallet);
    assert_eq!(next.accounts[0].name, "My miner");
    assert_eq!(next.language, "zh");
}
#[test]
fn duplicate_accounts_and_invalid_selection_are_rejected() {
    let address = "0x0000000000000000000000000000000000000001";
    let account = Account {
        address: address.into(),
        name: "One".into(),
        projects: vec!["bem".into(), "fab".into()],
    };
    assert!(canonical_settings(Settings {
        wallet: address.into(),
        accounts: vec![account.clone(), account.clone()],
        ..Default::default()
    })
    .is_err());
    assert!(canonical_settings(Settings {
        wallet: "0x0000000000000000000000000000000000000002".into(),
        accounts: vec![account],
        ..Default::default()
    })
    .is_err());
}
#[test]
fn mac_panel_keeps_point_dimensions_and_stays_on_negative_origin_screen() {
    let area = Rect {
        x: -1920.0,
        y: 0.0,
        width: 1920.0,
        height: 1056.0,
    };
    let frame = panel_frame(area, (-300.0, 1070.0), true);
    assert_eq!((frame.width, frame.height), (420.0, 520.0));
    assert!(frame.x >= -1920.0 && frame.x + frame.width <= 0.0);
    assert!(frame.y >= 0.0 && frame.y + frame.height <= 1056.0);
}
#[test]
fn small_screen_never_shrinks_the_panel() {
    let frame = panel_frame(
        Rect {
            x: 0.0,
            y: 0.0,
            width: 400.0,
            height: 650.0,
        },
        (100.0, 660.0),
        true,
    );
    assert_eq!((frame.width, frame.height), (420.0, 520.0));
}
#[test]
fn windows_dpi_changes_preserve_perceived_size() {
    for scale in [1.0, 1.5, 2.0] {
        let frame = windows_frame(
            Rect {
                x: 1920.0,
                y: 0.0,
                width: 2560.0,
                height: 1440.0,
            },
            (3000.0, 1420.0),
            scale,
        );
        assert_eq!(frame.width / scale, 420.0);
        assert_eq!(frame.height / scale, 520.0);
    }
}
