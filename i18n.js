import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

let _translations = {};
let _currentLang = 'en';

export function initTranslations(extensionDir) {
    const lang = GLib.getenv('LANG') || GLib.getenv('LC_MESSAGES') || 'en_US.UTF-8';
    _currentLang = lang.startsWith('ru') ? 'ru' : 'en';

    const localePath = `${extensionDir}/locale/${_currentLang}.json`;
    const file = Gio.File.new_for_path(localePath);

    try {
        const [, contents] = file.load_contents(null);
        const decoder = new TextDecoder('utf-8');
        const jsonString = decoder.decode(contents);
        _translations = JSON.parse(jsonString);
    } catch (e) {
        console.warn(`[MonitorSwitcher] Could not load translations from ${localePath}:`, e);
        _translations = {};
    }
}

export function _(str) {
    return _translations[str] || str;
}