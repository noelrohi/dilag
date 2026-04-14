//! Validates written design screens against the rules declared in the
//! skill prompts (see `assets/designer-common.md`). Intended to run after
//! the model writes a screen file so violations can be surfaced to both
//! the user and the model for self-correction.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Rule {
    Keyframes,
    InitialOpacityZero,
    RealUrl,
    EmojiAsIcon,
    AnimationCss,
    /// Tailwind decorative animation utilities (`animate-spin`, `animate-pulse`, etc.).
    /// Hover-state transitions are NOT flagged — they are legitimate interactive UI.
    DecorativeAnimation,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Violation {
    pub rule: Rule,
    pub snippet: String,
}

/// Hosts we permit for `href=""` / `src=""` values. Everything else in
/// an `http(s)` URL is flagged as a real-world link.
const URL_ALLOWLIST: &[&str] = &[
    "images.unsplash.com",
    "fonts.googleapis.com",
    "fonts.gstatic.com",
    "cdn.jsdelivr.net",
    "code.iconify.design",
    "unpkg.com",
];

/// Tauri command wrapping [`validate`] so the frontend can validate ad-hoc HTML
/// (e.g. right after a watcher notices a screen changed on disk).
#[tauri::command]
pub fn validate_screen_html(html: String) -> Vec<Violation> {
    validate(&html)
}

/// Validates the given HTML against the "Never" list declared in
/// `assets/designer-common.md`. Returns an empty vec when clean.
pub fn validate(html: &str) -> Vec<Violation> {
    use regex::Regex;
    use std::sync::OnceLock;

    fn re(s: &str) -> Regex {
        Regex::new(s).expect("valid regex")
    }

    static RE_KEYFRAMES: OnceLock<Regex> = OnceLock::new();
    static RE_OPACITY_ZERO: OnceLock<Regex> = OnceLock::new();
    static RE_ANIMATION: OnceLock<Regex> = OnceLock::new();
    static RE_URL: OnceLock<Regex> = OnceLock::new();
    static RE_ANIMATE_UTIL: OnceLock<Regex> = OnceLock::new();

    let re_keyframes = RE_KEYFRAMES.get_or_init(|| re(r"@keyframes\b"));
    let re_opacity_zero =
        RE_OPACITY_ZERO.get_or_init(|| re(r#"opacity\s*:\s*0\s*(?:[;"}]|$)"#));
    let re_animation = RE_ANIMATION.get_or_init(|| re(r"animation\s*:"));
    let re_url = RE_URL.get_or_init(|| re(r#"(?:href|src)\s*=\s*"https?://([^"/?#]+)"#));
    // Detect `animate-<name>` Tailwind utilities inside a `class="…"` attribute.
    // Excludes `animate-none` (Tailwind's opt-out) via a negative lookahead-style group.
    // Matching inside a class attribute (not prose) is enforced by requiring the token
    // appear after `class="` and before the closing `"`.
    let re_animate_util = RE_ANIMATE_UTIL.get_or_init(|| {
        re(r#"class\s*=\s*"[^"]*\banimate-([a-zA-Z_][\w-]*)"#)
    });

    let mut out = Vec::new();

    if let Some(m) = re_keyframes.find(html) {
        out.push(Violation { rule: Rule::Keyframes, snippet: m.as_str().to_string() });
    }
    if let Some(m) = re_opacity_zero.find(html) {
        out.push(Violation { rule: Rule::InitialOpacityZero, snippet: m.as_str().to_string() });
    }
    if let Some(m) = re_animation.find(html) {
        // `animation:` CSS shorthand — keyframe-driven, always decorative.
        out.push(Violation { rule: Rule::AnimationCss, snippet: m.as_str().to_string() });
    }
    for caps in re_animate_util.captures_iter(html) {
        let name = &caps[1];
        if name == "none" {
            continue; // `animate-none` is the opt-out utility; not a violation.
        }
        out.push(Violation {
            rule: Rule::DecorativeAnimation,
            snippet: format!("animate-{name}"),
        });
        break; // one flag is enough signal per file.
    }
    for caps in re_url.captures_iter(html) {
        let host = &caps[1];
        if !URL_ALLOWLIST.iter().any(|allowed| host.eq_ignore_ascii_case(allowed)) {
            out.push(Violation { rule: Rule::RealUrl, snippet: caps[0].to_string() });
            break; // one violation of each kind is enough for signal
        }
    }
    if html.chars().any(is_emoji) {
        let snippet: String = html.chars().filter(|c| is_emoji(*c)).take(4).collect();
        out.push(Violation { rule: Rule::EmojiAsIcon, snippet });
    }

    out
}

/// True for code points that are almost certainly pictographic emoji.
/// Deliberately excludes General Punctuation (em dash, ellipsis, bullets)
/// and Arrows block (`←`/`→`), since designs legitimately use those.
fn is_emoji(c: char) -> bool {
    let cp = c as u32;
    (0x1F300..=0x1FAFF).contains(&cp) // Misc Symbols & Pictographs, Emoticons, Transport, Supplemental
        || (0x2600..=0x26FF).contains(&cp) // Misc Symbols (warning, sun, cloud, ...)
        || (0x2700..=0x27BF).contains(&cp) // Dingbats
}

#[cfg(test)]
mod tests {
    use super::*;

    // -------- @keyframes --------

    #[test]
    fn flags_keyframes_definition() {
        let html = r##"
            <style>
                @keyframes fade { from { opacity: 0 } to { opacity: 1 } }
            </style>
        "##;
        let v = validate(html);
        assert!(v.iter().any(|v| v.rule == Rule::Keyframes), "expected Keyframes violation, got {v:?}");
    }

    #[test]
    fn passes_when_no_keyframes() {
        let html = r##"<style>@theme { --color-foreground: #000; }</style>"##;
        let v = validate(html);
        assert!(!v.iter().any(|v| v.rule == Rule::Keyframes));
    }

    // -------- decorative animations (Tailwind `animate-*`) --------

    #[test]
    fn flags_animate_spin() {
        let html = r##"<span class="animate-spin w-4 h-4"></span>"##;
        let v = validate(html);
        assert!(v.iter().any(|v| v.rule == Rule::DecorativeAnimation));
    }

    #[test]
    fn flags_animate_pulse() {
        let html = r##"<div class="animate-pulse bg-muted h-8"></div>"##;
        let v = validate(html);
        assert!(v.iter().any(|v| v.rule == Rule::DecorativeAnimation));
    }

    #[test]
    fn flags_custom_animate_utility() {
        // Non-standard `animate-*` classes are still decorative motion.
        let html = r##"<div class="animate-fade-in"></div>"##;
        let v = validate(html);
        assert!(v.iter().any(|v| v.rule == Rule::DecorativeAnimation));
    }

    #[test]
    fn allows_animate_none() {
        // `animate-none` is Tailwind's opt-OUT of animation; must not flag.
        let html = r##"<div class="animate-none"></div>"##;
        let v = validate(html);
        assert!(!v.iter().any(|v| v.rule == Rule::DecorativeAnimation));
    }

    #[test]
    fn allows_hover_transition() {
        // `transition-*` + `hover:*` is legitimate interactive affordance, not AI slop.
        let html =
            r##"<img class="opacity-80 group-hover:opacity-100 transition-opacity" src="https://images.unsplash.com/photo-abc">"##;
        let v = validate(html);
        assert!(
            !v.iter().any(|v| v.rule == Rule::DecorativeAnimation),
            "transition-opacity on hover is NOT a violation, got {v:?}"
        );
    }

    #[test]
    fn allows_the_word_animate_outside_class_context() {
        // Prose / content containing "animate" must not trip.
        let html = r##"<h1>How to animate your life</h1>"##;
        let v = validate(html);
        assert!(!v.iter().any(|v| v.rule == Rule::DecorativeAnimation));
    }

    // -------- opacity: 0 initial state --------

    #[test]
    fn flags_initial_opacity_zero_inline() {
        let html = r##"<div style="opacity: 0"></div>"##;
        let v = validate(html);
        assert!(v.iter().any(|v| v.rule == Rule::InitialOpacityZero));
    }

    #[test]
    fn flags_initial_opacity_zero_no_space() {
        let html = r##"<div style="opacity:0;"></div>"##;
        let v = validate(html);
        assert!(v.iter().any(|v| v.rule == Rule::InitialOpacityZero));
    }

    #[test]
    fn allows_opacity_zero_in_animation_frame() {
        // Non-zero opacity at rest is fine; also explicit non-zero values.
        let html = r##"<div style="opacity: 0.6"></div>"##;
        let v = validate(html);
        assert!(!v.iter().any(|v| v.rule == Rule::InitialOpacityZero));
    }

    // -------- real URLs --------

    #[test]
    fn flags_real_link_href() {
        let html = r##"<a href="https://example.com/pricing">Pricing</a>"##;
        let v = validate(html);
        assert!(v.iter().any(|v| v.rule == Rule::RealUrl));
    }

    #[test]
    fn allows_hash_href() {
        let html = r##"<a href="#">Pricing</a>"##;
        let v = validate(html);
        assert!(!v.iter().any(|v| v.rule == Rule::RealUrl));
    }

    #[test]
    fn allows_unsplash_image_src() {
        let html = r##"<img src="https://images.unsplash.com/photo-123?w=800">"##;
        let v = validate(html);
        assert!(!v.iter().any(|v| v.rule == Rule::RealUrl));
    }

    #[test]
    fn allows_google_fonts_stylesheet() {
        let html = r##"<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">"##;
        let v = validate(html);
        assert!(!v.iter().any(|v| v.rule == Rule::RealUrl));
    }

    #[test]
    fn allows_jsdelivr_and_iconify_cdns() {
        let html = r##"
            <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
            <script src="https://code.iconify.design/3/3.1.0/iconify.min.js"></script>
        "##;
        let v = validate(html);
        assert!(!v.iter().any(|v| v.rule == Rule::RealUrl));
    }

    // -------- emoji as icons --------

    #[test]
    fn flags_emoji_in_markup() {
        let html = r##"<button>🚀 Launch</button>"##;
        let v = validate(html);
        assert!(v.iter().any(|v| v.rule == Rule::EmojiAsIcon));
    }

    #[test]
    fn passes_without_emoji() {
        let html = r##"<button>Launch</button>"##;
        let v = validate(html);
        assert!(!v.iter().any(|v| v.rule == Rule::EmojiAsIcon));
    }

    // -------- animation CSS shorthand --------

    #[test]
    fn flags_animation_shorthand() {
        let html = r##"<div style="animation: fade 200ms"></div>"##;
        let v = validate(html);
        assert!(v.iter().any(|v| v.rule == Rule::AnimationCss));
    }

    // -------- clean screen passes --------

    #[test]
    fn clean_exemplar_like_screen_has_no_violations() {
        let html = r##"
            <!DOCTYPE html>
            <html><head>
              <link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">
              <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
              <style type="text/tailwindcss">@theme { --color-foreground: #000; }</style>
            </head><body>
              <h1>Quiet design</h1>
              <a href="#">Learn more</a>
              <img src="https://images.unsplash.com/photo-abc?w=1200">
            </body></html>
        "##;
        assert_eq!(validate(html), vec![]);
    }

    // -------- our bundled exemplars themselves must pass --------

    #[test]
    fn bundled_web_editorial_exemplar_is_clean() {
        let html = include_str!("../assets/examples/web/editorial.html");
        assert_eq!(validate(html), vec![], "editorial.html violates its own rules");
    }

    #[test]
    fn bundled_web_saas_exemplar_is_clean() {
        let html = include_str!("../assets/examples/web/saas-dashboard.html");
        assert_eq!(validate(html), vec![], "saas-dashboard.html violates its own rules");
    }

    #[test]
    fn bundled_mobile_wellness_exemplar_is_clean() {
        let html = include_str!("../assets/examples/mobile/wellness.html");
        assert_eq!(validate(html), vec![], "wellness.html violates its own rules");
    }

    #[test]
    fn bundled_mobile_finance_exemplar_is_clean() {
        let html = include_str!("../assets/examples/mobile/finance.html");
        assert_eq!(validate(html), vec![], "finance.html violates its own rules");
    }
}
