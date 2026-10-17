#[derive(Clone, Copy, Debug)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}
pub const PANEL_WIDTH: f64 = 420.0;
pub const PANEL_HEIGHT: f64 = 520.0;
impl Rect {
    pub fn contains(&self, p: (f64, f64)) -> bool {
        p.0 >= self.x && p.0 < self.x + self.width && p.1 >= self.y && p.1 < self.y + self.height
    }
}
fn clamp_origin(v: f64, o: f64, a: f64, p: f64) -> f64 {
    if a < p + 16.0 {
        o
    } else {
        v.clamp(o + 8.0, o + a - p - 8.0)
    }
}
pub fn panel_frame(area: Rect, anchor: (f64, f64), bottom_left: bool) -> Rect {
    let top = if bottom_left {
        anchor.1 > area.y + area.height / 2.0
    } else {
        anchor.1 < area.y + area.height / 2.0
    };
    let y = match (bottom_left, top) {
        (true, true) | (false, false) => anchor.1 - PANEL_HEIGHT - 12.0,
        _ => anchor.1 + 12.0,
    };
    Rect {
        x: clamp_origin(
            anchor.0 - PANEL_WIDTH / 2.0,
            area.x,
            area.width,
            PANEL_WIDTH,
        ),
        y: clamp_origin(y, area.y, area.height, PANEL_HEIGHT),
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
    }
}
pub fn windows_frame(area: Rect, anchor: (f64, f64), scale: f64) -> Rect {
    let f = panel_frame(
        Rect {
            x: area.x / scale,
            y: area.y / scale,
            width: area.width / scale,
            height: area.height / scale,
        },
        (anchor.0 / scale, anchor.1 / scale),
        false,
    );
    Rect {
        x: f.x * scale,
        y: f.y * scale,
        width: f.width * scale,
        height: f.height * scale,
    }
}
