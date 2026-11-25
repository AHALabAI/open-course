// Standalone teaching implementation. Coordinates use the unit square.
// Corner order: near left, near right, far right, far left.
static mut H: [f64; 8] = [0.0; 8];
static mut READY: bool = false;

#[no_mangle]
pub extern "C" fn calibrate(x0: f64, y0: f64, x1: f64, y1: f64, x2: f64, y2: f64, x3: f64, y3: f64) -> i32 {
    unsafe { READY = false; }
    let src = [(x0, y0), (x1, y1), (x2, y2), (x3, y3)];
    let dst = [(0., 0.), (1., 0.), (1., 1.), (0., 1.)];
    let mut winding = 0.0;
    for i in 0..4 {
        let ((x, y), (a, b), (c, d)) = (src[i], src[(i + 1) % 4], src[(i + 2) % 4]);
        let cross = (a - x) * (d - b) - (b - y) * (c - a);
        if ![x, y].iter().all(|v| v.is_finite() && (0.0..=1.0).contains(v))
            || cross.abs() < 0.001 || (i > 0 && cross * winding <= 0.0) { return 0; }
        winding = cross;
    }
    let mut a = [[0.0; 9]; 8];
    for i in 0..4 {
        let (x, y) = src[i];
        let (u, v) = dst[i];
        a[2*i] = [x,y,1.,0.,0.,0.,-u*x,-u*y,u];
        a[2*i+1] = [0.,0.,0.,x,y,1.,-v*x,-v*y,v];
    }
    for col in 0..8 {
        let mut pivot = col;
        for row in col + 1..8 {
            if a[row][col].abs() > a[pivot][col].abs() { pivot = row; }
        }
        a.swap(col, pivot);
        let scale = a[col][col];
        if scale.abs() < 1e-10 { return 0; }
        for value in &mut a[col][col..] { *value /= scale; }
        for row in 0..8 {
            if row == col { continue; }
            let factor = a[row][col];
            for j in col..9 { a[row][j] -= factor * a[col][j]; }
        }
    }
    let h = a.map(|row| row[8]);
    let mut sign = 0.0;
    for (x, y) in src {
        let w = h[6]*x+h[7]*y+1.0;
        if !w.is_finite() || w.abs()<1e-8 || (sign != 0.0 && w*sign<0.0) { return 0; }
        sign = w;
    }
    unsafe { H = h; READY = true; }
    1
}

#[no_mangle]
pub extern "C" fn ground_coordinate(x: f64, y: f64, axis: i32) -> f64 {
    if !unsafe { READY } || ![x,y].iter().all(|v| v.is_finite()) { return f64::NAN; }
    let h = unsafe { H };
    let w = h[6]*x+h[7]*y+1.;
    let u = (h[0]*x+h[1]*y+h[2])/w;
    let v = (h[3]*x+h[4]*y+h[5])/w;
    if w.abs() < 1e-8 || !(-1e-6..=1.000001).contains(&u) || !(-1e-6..=1.000001).contains(&v) { return f64::NAN; }
    match axis { 0 => u.clamp(0., 1.), 1 => v.clamp(0., 1.), _ => f64::NAN }
}

#[no_mangle]
pub extern "C" fn distance_m(x: f64, y: f64, length: f64) -> f64 {
    if !length.is_finite() || length <= 0.0 { return f64::NAN; }
    ground_coordinate(x, y, 1) * length
}

#[no_mangle]
pub extern "C" fn crossing_ms(t0: f64, t1: f64, d0: f64, d1: f64) -> f64 {
    if ![t0,t1,d0,d1].iter().all(|v| v.is_finite()) || t1 <= t0 || d0 >= 0.0 || d1 < 0.0 { return f64::NAN; }
    t0 + (t1-t0) * (-d0/(d1-d0))
}

static mut JUMP: u8 = 0; // 0 waits for ground, 1 grounded, 2 airborne.
static mut LAST: f64 = -1.0;
static mut LIFTOFF: f64 = -1.0;

#[no_mangle]
pub extern "C" fn reset_jumps() {
    unsafe { JUMP = 0; LAST = -1.0; LIFTOFF = -1.0; }
}

#[no_mangle]
pub extern "C" fn observe_jump(t: f64, left: f64, right: f64, visible: i32) -> i32 {
    unsafe {
        if visible != 1 || ![t,left,right].iter().all(|v| v.is_finite()) || t <= LAST || (LAST >= 0.0 && t - LAST > 100.0) {
            JUMP = 0; LAST = if t.is_finite() { t } else { -1.0 }; return 0;
        }
        LAST = t;
        if left <= 0.025 && right <= 0.025 {
            let counted = JUMP == 2 && (90.0..=750.0).contains(&(t-LIFTOFF));
            JUMP = 1;
            return counted as i32;
        }
        if JUMP == 1 && left >= 0.07 && right >= 0.07 {
            JUMP = 2; LIFTOFF = t;
        }
        0
    }
}
