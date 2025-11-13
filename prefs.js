import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

// Импортируем локализацию
import {initTranslations, _} from './i18n.js';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class MultiMonitorPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        // Инициализируем локализацию
        initTranslations(this.path);

        // Создаём страницу настроек
        const page = new Adw.PreferencesPage({
            title: _('Monitors'),
            icon_name: 'video-display-symbolic',
        });
        window.add(page);

        // --- Группа: Имена мониторов ---
        const titleGroup = new Adw.PreferencesGroup({
            title: _('Run \'gdctl show -m\' in terminal'),
            description: _('Displays available monitors and their modes. Copy the required data into the fields.')
        });
        page.add(titleGroup);

        // --- Группа: Имена мониторов ---
        const monitorGroup = new Adw.PreferencesGroup({
            title: _('Monitor Names'),
            description: _('Enter technical names of connected monitors (e.g., DP-3, HDMI-1)')
        });
        page.add(monitorGroup);

        // Поле для основного монитора
        const primaryMonitorRow = this._createEntryRow(
            _('Primary Monitor (left)'),
            'primary-monitor',
            ''
        );
        monitorGroup.add(primaryMonitorRow);

        // Поле для масштаба основного монитора
        const primaryMonitorScaleRow = this._createEntryRow(
            _('Primary monitor scale (1 = 100%, 2 = 200%, etc.)'),
            'primary-monitor-scale',
            '1'
        );
        monitorGroup.add(primaryMonitorScaleRow);

        // Поле для вторичного монитора
        const secondaryMonitorRow = this._createEntryRow(
            _('Secondary Monitor (right)'),
            'secondary-monitor',
            ''
        );
        monitorGroup.add(secondaryMonitorRow);

        // Поле для масштаба второго монитора
        const secondaryMonitorScaleRow = this._createEntryRow(
            _('Secondary monitor scale (1 = 100%, 2 = 200%, etc.)'),
            'secondary-monitor-scale',
            '1'
        );
        monitorGroup.add(secondaryMonitorScaleRow);

        // --- Группа: Отображаемые названия ---
        const displayNameGroup = new Adw.PreferencesGroup({
            title: _('Display Names'),
            description: _('Enter names to appear in the menu (e.g., Monitor, TV)')
        });
        page.add(displayNameGroup);

        // Поле для отображаемого имени основного монитора
        const primaryDisplayNameRow = this._createEntryRow(
            _('Primary Display Name'),
            'primary-display-name',
            ''
        );
        displayNameGroup.add(primaryDisplayNameRow);

        // Поле для отображаемого имени вторичного монитора
        const secondaryDisplayNameRow = this._createEntryRow(
            _('Secondary Display Name'),
            'secondary-display-name',
            ''
        );
        displayNameGroup.add(secondaryDisplayNameRow);

        // --- Группа: Режимы обновления ---
        const modeGroup = new Adw.PreferencesGroup({
            title: _('Refresh Modes'),
            description: _('Specify resolution and refresh rate for each monitor (e.g., 1920x1080@144.002, 3840x2160@60.000)')
        });
        page.add(modeGroup);

        // Поле для режима основного
        const primaryModeRow = this._createEntryRow(
            _('Primary Mode'),
            'primary-mode',
            ''
        );
        modeGroup.add(primaryModeRow);

        // Поле для режима вторичного
        const secondaryModeRow = this._createEntryRow(
            _('Secondary Mode'),
            'secondary-mode',
            ''
        );
        modeGroup.add(secondaryModeRow);

        // Поле для режима зеркала
        const mirrorModeRow = this._createEntryRow(
            _('Mirror Mode'),
            'mirror-mode',
            ''
        );
        modeGroup.add(mirrorModeRow);

        // --- Группа: Включение режимов ---
        const enableGroup = new Adw.PreferencesGroup({
            title: _('Enable Modes'),
            description: _('Select which modes to display in the menu')
        });
        page.add(enableGroup);

        // Переключатель для dualExtend_mon
        const dualExtendMonRow = this._createSwitchRow(
            _('Both: Primary on Left'),
            'enable-dual-extend-mon',
            true
        );
        enableGroup.add(dualExtendMonRow);

        // Переключатель для dualExtend_tv
        const dualExtendTvRow = this._createSwitchRow(
            _('Both: Primary on Right'),
            'enable-dual-extend-tv',
            true
        );
        enableGroup.add(dualExtendTvRow);

        // Переключатель для dualMirror
        const dualMirrorRow = this._createSwitchRow(
            _('Both: Mirror'),
            'enable-dual-mirror',
            true
        );
        enableGroup.add(dualMirrorRow);
    }

    // Вспомогательная функция для создания строки с полем ввода
    _createEntryRow(title, key, defaultValue, readonly = false) {
        const settings = this.getSettings();
        const row = new Adw.EntryRow({ title: _(title) });

        // Устанавливаем начальное значение
        const currentValue = settings.get_string(key);
        row.set_text(currentValue || defaultValue);

        // Обновляем значение при изменении
        row.connect('changed', (entry) => {
            const newValue = entry.get_text().trim();
            if (newValue) {
                settings.set_string(key, newValue);
            }
        });

        if (readonly) {
            row.set_sensitive(false);
        }

        return row;
    }

    // Вспомогательная функция для создания строки с переключателем
    _createSwitchRow(title, key, defaultValue) {
        const settings = this.getSettings();
        const row = new Adw.SwitchRow({ title: _(title) });

        // Устанавливаем начальное состояние
        const currentValue = settings.get_boolean(key);
        row.set_active(currentValue ?? defaultValue);

        // Обновляем значение при изменении
        row.connect('notify::active', (switchRow) => {
            settings.set_boolean(key, switchRow.active);
        });

        return row;
    }
}