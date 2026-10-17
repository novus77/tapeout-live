use crate::domain::Settings;

pub fn commit_with_autostart(
    previous: &Settings,
    next: &Settings,
    mut set_autostart: impl FnMut(bool) -> Result<(), String>,
    persist: impl FnOnce(&Settings) -> Result<(), String>,
) -> Result<(), String> {
    let changed = previous.autostart != next.autostart;
    if changed {
        set_autostart(next.autostart)?;
    }
    if let Err(error) = persist(next) {
        if changed {
            if let Err(rollback) = set_autostart(previous.autostart) {
                return Err(format!(
                    "Settings save failed: {error}; launch-at-login rollback failed: {rollback}"
                ));
            }
        }
        return Err(error);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::Settings;
    use std::cell::{Cell, RefCell};

    #[test]
    fn saves_startup_changes_and_does_not_touch_startup_for_theme_changes() {
        let previous = Settings::default();
        let next = Settings {
            autostart: true,
            ..previous.clone()
        };
        let calls = RefCell::new(vec![]);
        commit_with_autostart(
            &previous,
            &next,
            |enabled| {
                calls.borrow_mut().push(enabled);
                Ok(())
            },
            |_| Ok(()),
        )
        .unwrap();
        assert_eq!(*calls.borrow(), vec![true]);
        let next = Settings {
            theme: "dark".into(),
            ..previous.clone()
        };
        commit_with_autostart(
            &previous,
            &next,
            |_| panic!("Unrelated preference must not modify startup"),
            |_| Ok(()),
        )
        .unwrap();
    }

    #[test]
    fn restores_previous_startup_state_when_persistence_fails() {
        for enabled in [true, false] {
            let previous = Settings {
                autostart: !enabled,
                ..Default::default()
            };
            let next = Settings {
                autostart: enabled,
                ..previous.clone()
            };
            let calls = RefCell::new(vec![]);
            let error = commit_with_autostart(
                &previous,
                &next,
                |value| {
                    calls.borrow_mut().push(value);
                    Ok(())
                },
                |_| Err("Disk full".into()),
            )
            .unwrap_err();
            assert!(error.contains("Disk full"));
            assert_eq!(*calls.borrow(), vec![enabled, !enabled]);
        }
    }

    #[test]
    fn failed_startup_never_persists_and_failed_rollback_is_explicit() {
        let previous = Settings::default();
        let next = Settings {
            autostart: true,
            ..previous.clone()
        };
        assert!(commit_with_autostart(
            &previous,
            &next,
            |_| Err("Startup denied".into()),
            |_| panic!("Must not persist failed startup change")
        )
        .is_err());
        let calls = Cell::new(0);
        let error = commit_with_autostart(
            &previous,
            &next,
            |_| {
                calls.set(calls.get() + 1);
                if calls.get() == 1 {
                    Ok(())
                } else {
                    Err("Rollback denied".into())
                }
            },
            |_| Err("Disk full".into()),
        )
        .unwrap_err();
        assert!(error.contains("Disk full") && error.contains("Rollback denied"));
    }
}
