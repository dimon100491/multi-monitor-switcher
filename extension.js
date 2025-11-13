import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

// Импортируем локализацию
import {initTranslations, _} from './i18n.js';

// —————————————————————————————————————————————————————————————————————————————
// 🔧 КЛАСС УПРАВЛЕНИЯ КОМАНДАМИ И НАСТРОЙКАМИ
// —————————————————————————————————————————————————————————————————————————————

class MonitorCommandBuilder {
    constructor(settings) {
        this._settings = settings;
        this.commands = {};
        this.modeLabels = {};
        this._loadSettings();
        this._buildCommandsAndLabels();
    }

    _loadSettings() {
        this.primaryMonitor = this._settings.get_string('primary-monitor');
        this.secondaryMonitor = this._settings.get_string('secondary-monitor');
        this.primaryMonitorScale = this._settings.get_string('primary-monitor-scale');
        this.secondaryMonitorScale = this._settings.get_string('secondary-monitor-scale');
        this.primaryDisplayName = this._settings.get_string('primary-display-name');
        this.secondaryDisplayName = this._settings.get_string('secondary-display-name');
        this.primaryMode = this._settings.get_string('primary-mode');
        this.secondaryMode = this._settings.get_string('secondary-mode');
        this.mirrorMode = this._settings.get_string('mirror-mode');
        this.enableDualExtendMon = this._settings.get_boolean('enable-dual-extend-mon');
        this.enableDualExtendTv = this._settings.get_boolean('enable-dual-extend-tv');
        this.enableDualMirror = this._settings.get_boolean('enable-dual-mirror');
    }

    _buildCommandsAndLabels() {
        this.commands = {
            primaryOnly: `gdctl set --logical-monitor --primary --monitor ${this.primaryMonitor} --scale ${this.primaryMonitorScale} --mode ${this.primaryMode}`,
            secondaryOnly: `gdctl set --logical-monitor --primary --monitor ${this.secondaryMonitor} --scale ${this.secondaryMonitorScale} --mode ${this.secondaryMode}`,
        };

        this.modeLabels = {
            primaryOnly: _('Only {display_name}').replace('{display_name}', this.primaryDisplayName),
            secondaryOnly: _('Only {display_name}').replace('{display_name}', this.secondaryDisplayName),
        };

        if (this.enableDualExtendMon) {
            this.commands.dualExtend_mon = `gdctl set --logical-monitor --primary --monitor ${this.primaryMonitor} --scale ${this.primaryMonitorScale} -y 0 --mode ${this.primaryMode} --logical-monitor --monitor ${this.secondaryMonitor} --right-of ${this.primaryMonitor} --scale ${this.secondaryMonitorScale} -y 0 --mode ${this.secondaryMode}`;
            this.modeLabels.dualExtend_mon = _('Both: {primary} main').replace('{primary}', this.primaryDisplayName);
        }

        if (this.enableDualExtendTv) {
            this.commands.dualExtend_tv = `gdctl set --logical-monitor --monitor ${this.primaryMonitor} --scale ${this.primaryMonitorScale} -y 0 --mode ${this.primaryMode} --logical-monitor --primary --monitor ${this.secondaryMonitor} --right-of ${this.primaryMonitor} --scale ${this.secondaryMonitorScale} -y 0 --mode ${this.secondaryMode}`;
            this.modeLabels.dualExtend_tv = _('Both: {secondary} main').replace('{secondary}', this.secondaryDisplayName);
        }

        if (this.enableDualMirror) {
            this.commands.dualMirror = `gdctl set --logical-monitor --primary --monitor ${this.primaryMonitor} --monitor ${this.secondaryMonitor} --scale ${this.primaryMonitorScale} --mode ${this.mirrorMode}`;
            this.modeLabels.dualMirror = _('Both: mirror ({primary} + {secondary})')
                .replace('{primary}', this.primaryDisplayName)
                .replace('{secondary}', this.secondaryDisplayName);
        }
    }

    updateFromSettings() {
        this._loadSettings();
        this._buildCommandsAndLabels();
    }
}

// —————————————————————————————————————————————————————————————————————————————
// 🔧 УТИЛИТЫ
// —————————————————————————————————————————————————————————————————————————————

const runCommand = (cmd, onSuccess = null) => {
    if (!cmd) return false;
    try {
        const proc = Gio.Subprocess.new(
            ['sh', '-c', cmd],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );
        proc.wait_async(null, (proc, res) => {
            try {
                const success = proc.wait_finish(res);
                if (success && onSuccess) onSuccess();
            } catch (e) {
                console.error('[MonitorSwitcher] Command error:', e);
            }
        });
        return true;
    } catch (e) {
        console.error('[MonitorSwitcher] Spawn failed:', e);
        return false;
    }
};

const parseGdctlShow = (stdout) => {
    const lines = stdout.split('\n');

    let logicalMonitors = [];
    let currentLogical = null;

    for (const line of lines) {
        if (line.match(/Logical monitor #\d+/)) {
            currentLogical = { primary: false, monitorNames: [] };
            logicalMonitors.push(currentLogical);
            continue;
        }

        if (!currentLogical) continue;

        if (line.includes('Primary: yes')) {
            currentLogical.primary = true;
        }

        const monitorMatch = line.match(/[├└]──([A-Za-z0-9-]+)\s+\(/);
        if (monitorMatch) {
            const name = monitorMatch[1];
            if (!currentLogical.monitorNames.includes(name)) {
                currentLogical.monitorNames.push(name);
            }
        }
    }

    const physicalMonitors = [];
    for (const line of lines) {
        const monitorMatch = line.match(/[├└]──Monitor\s+([A-Za-z0-9-]+)/);
        if (monitorMatch) {
            const name = monitorMatch[1];
            physicalMonitors.push(name);
        }
    }

    return { logicalMonitors, physicalMonitors };
};

const validateCurrentStateAsync = (builder, lastMode, callback) => {
    const proc = Gio.Subprocess.new(['gdctl', 'show'], Gio.SubprocessFlags.STDOUT_PIPE);
    proc.communicate_utf8_async(null, null, (proc, res) => {
        try {
            const [, stdout] = proc.communicate_utf8_finish(res);
            const { logicalMonitors, physicalMonitors } = parseGdctlShow(stdout);

            let validMode = false;
            let active = false;

            switch (lastMode) {
                case 'dualExtend_mon':
                    if (!builder.enableDualExtendMon) break;
                    validMode = logicalMonitors.length === 2 &&
                                logicalMonitors.some(m => m.monitorNames.includes(builder.primaryMonitor) && m.primary) &&
                                logicalMonitors.some(m => m.monitorNames.includes(builder.secondaryMonitor) && !m.primary);
                    active = physicalMonitors.includes(builder.primaryMonitor) && physicalMonitors.includes(builder.secondaryMonitor);
                    break;

                case 'dualExtend_tv':
                    if (!builder.enableDualExtendTv) break;
                    validMode = logicalMonitors.length === 2 &&
                                logicalMonitors.some(m => m.monitorNames.includes(builder.primaryMonitor) && !m.primary) &&
                                logicalMonitors.some(m => m.monitorNames.includes(builder.secondaryMonitor) && m.primary);
                    active = physicalMonitors.includes(builder.primaryMonitor) && physicalMonitors.includes(builder.secondaryMonitor);
                    break;

                case 'primaryOnly':
                    validMode = logicalMonitors.length === 1 &&
                                logicalMonitors[0].monitorNames.length === 1 &&
                                logicalMonitors[0].monitorNames.includes(builder.primaryMonitor) &&
                                logicalMonitors[0].primary;
                    active = physicalMonitors.includes(builder.primaryMonitor);
                    break;

                case 'secondaryOnly':
                    validMode = logicalMonitors.length === 1 &&
                                logicalMonitors[0].monitorNames.length === 1 &&
                                logicalMonitors[0].monitorNames.includes(builder.secondaryMonitor) &&
                                logicalMonitors[0].primary;
                    active = physicalMonitors.includes(builder.secondaryMonitor);
                    break;

                case 'dualMirror':
                    if (!builder.enableDualMirror) break;
                    validMode = logicalMonitors.length === 1 &&
                                logicalMonitors[0].primary &&
                                logicalMonitors[0].monitorNames.includes(builder.primaryMonitor) &&
                                logicalMonitors[0].monitorNames.includes(builder.secondaryMonitor);
                    active = physicalMonitors.includes(builder.primaryMonitor) && physicalMonitors.includes(builder.secondaryMonitor);
                    break;

                default:
                    validMode = false;
                    active = false;
            }

            callback({ validMode, active });
        } catch (e) {
            console.error('[MonitorSwitcher] Validation failed:', e);
            callback({ validMode: false, active: false });
        }
    });
};

const detectCurrentMode = (logicalMonitors, builder) => {
    const validMonitors = logicalMonitors.filter(m => m.monitorNames && m.monitorNames.length > 0);

    if (validMonitors.length === 1) {
        const m = validMonitors[0];
        if (m.monitorNames.length === 1 && m.primary) {
            if (m.monitorNames.includes(builder.primaryMonitor)) return 'primaryOnly';
            if (m.monitorNames.includes(builder.secondaryMonitor)) return 'secondaryOnly';
        }
        if (m.monitorNames.includes(builder.primaryMonitor) && m.monitorNames.includes(builder.secondaryMonitor)) {
            if (builder.enableDualMirror) return 'dualMirror';
        }
    }

    if (validMonitors.length === 2) {
        const hasPrimaryMon = validMonitors.some(m => m.monitorNames.includes(builder.primaryMonitor) && m.primary);
        const hasSecondaryMon = validMonitors.some(m => m.monitorNames.includes(builder.secondaryMonitor) && !m.primary);
        if (hasPrimaryMon && hasSecondaryMon && builder.enableDualExtendMon) return 'dualExtend_mon';

        const hasPrimaryTV = validMonitors.some(m => m.monitorNames.includes(builder.secondaryMonitor) && m.primary);
        const hasSecondaryTV = validMonitors.some(m => m.monitorNames.includes(builder.primaryMonitor) && !m.primary);
        if (hasPrimaryTV && hasSecondaryTV && builder.enableDualExtendTv) return 'dualExtend_tv';
    }
    return null;
};

// —————————————————————————————————————————————————————————————————————————————
// 🔧 КЛАСС МЕНЮ МОНИТОРА
// —————————————————————————————————————————————————————————————————————————————

const MonitorMenuToggle = GObject.registerClass(
class MonitorMenuToggle extends QuickSettings.QuickMenuToggle {
    _init(settings, extensionObject) {
        initTranslations(extensionObject.dir.get_path()); // инициализируем локализацию

        super._init({
            title: _('Monitors'),
            iconName: 'video-display-symbolic',
        });

        this._settings = settings;
        this.extensionObject = extensionObject;

        this._builder = new MonitorCommandBuilder(this._settings);
        this._items = {};
        this._isApplyingMode = false;

        if (!this._builder.primaryMonitor || !this._builder.secondaryMonitor) {
            this._showSetupWarning();
            return;
        }

        this._setupMenu();
    }

    _showSetupWarning() {
        Main.notifyError(
            _('Monitor Configuration Changed'),
            _('Settings not configured')
        );

        const configureItem = new PopupMenu.PopupMenuItem(_('Configure'));
        configureItem.connect('activate', () => this.extensionObject.openPreferences());
        this.menu.addMenuItem(configureItem);

        this.title = _('Setup Required');
        this.subtitle = _('Setup Needed');
        this.reactive = false;
        this.can_focus = false;
    }

    _setupMenu() {
        this.reactive = true;
        this.can_focus = true;
        this.title = _('Monitors');

        this.menu.removeAll(); // 👈 Очищаем меню перед добавлением

        for (const mode of Object.keys(this._builder.commands)) {
            const item = new PopupMenu.PopupMenuItem(this._builder.modeLabels[mode]);
            item.connect('activate', () => this._activateMode(mode));
            this.menu.addMenuItem(item);
            this._items[mode] = item;
        }

        this._updateActiveItem();
    }

    _activateMode(mode) {
        if (this._isApplyingMode) return;
        this._isApplyingMode = true;

        runCommand(this._builder.commands[mode], () => {
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                validateCurrentStateAsync(this._builder, mode, (result) => {
                    if (result.validMode) {
                        this._settings.set_string('last-mode', mode);
                        this._updateActiveItem();
                    } else {
                        Main.notifyError(_('One of the monitors is disconnected'), '');
                    }
                });
                this._isApplyingMode = false;
                return GLib.SOURCE_REMOVE;
            });
        });
    }

    _updateActiveItem() {
        const lastMode = this._settings.get_string('last-mode');

        for (const [mode, item] of Object.entries(this._items)) {
            item.setOrnament(mode === lastMode ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
        }

        if (!this._appliedAtStart) {
            this._appliedAtStart = true;
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                validateCurrentStateAsync(this._builder, lastMode, (result) => {
                    if (result.active) {
                        runCommand(this._builder.commands[lastMode], () => {
                            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                                validateCurrentStateAsync(this._builder, lastMode, (innerResult) => {
                                    if (!innerResult.validMode) {
                                        this._settings.set_string('last-mode', 'primaryOnly');
                                        this._updateActiveItem();
                                    }
                                });
                                return GLib.SOURCE_REMOVE;
                            });
                        });
                    } else {
                        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                            this._readCurrentStateAndUpdateUi();
                        });
                    }
                });
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    _readCurrentStateAndUpdateUi() {
        const proc = Gio.Subprocess.new(['gdctl', 'show'], Gio.SubprocessFlags.STDOUT_PIPE);
        proc.communicate_utf8_async(null, null, (proc, res) => {
            try {
                const [, stdout] = proc.communicate_utf8_finish(res);
                const { logicalMonitors } = parseGdctlShow(stdout);

                const detectedMode = detectCurrentMode(logicalMonitors, this._builder);
                if (detectedMode) {
                    console.log(`[MonitorSwitcher] Current detectedMode is:`, detectedMode);
                    this._settings.set_string('last-mode', detectedMode);
                    runCommand(this._builder.commands[detectedMode]);

                    for (const [mode, item] of Object.entries(this._items)) {
                        item.setOrnament(mode === detectedMode ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
                    }
                }
            } catch (e) {
                console.error('[MonitorSwitcher] UI sync failed:', e);
            }
        });
    }

    updateFromSettings() {
        this._builder.updateFromSettings();
        if (this.reactive) {
            this._setupMenu();
        } else {
            this._showSetupWarning();
        }
    }
});

// —————————————————————————————————————————————————————————————————————————————
// 🔧 КЛАСС ИНДИКАТОРА
// —————————————————————————————————————————————————————————————————————————————

const MonitorIndicator = GObject.registerClass(
class MonitorIndicator extends QuickSettings.SystemIndicator {
    _init(extensionObject) {
        super._init();
        this._indicator = this._addIndicator();
        this._indicator.icon_name = 'video-display-symbolic';
        this._toggle = new MonitorMenuToggle(extensionObject.getSettings(), extensionObject);
        this.quickSettingsItems.push(this._toggle);
    }

    destroy() {
        this.quickSettingsItems.forEach(item => item.destroy());
        super.destroy();
    }
});

// —————————————————————————————————————————————————————————————————————————————
// 🔧 КЛАСС РАСШИРЕНИЯ
// —————————————————————————————————————————————————————————————————————————————

export default class MultiMonitorExtension extends Extension {
    enable() {
        initTranslations(this.dir.get_path()); // инициализируем локализацию

        this._settings = this.getSettings();
        this._indicator = new MonitorIndicator(this);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);

        this._toggle = this._indicator.quickSettingsItems[0];
        this._settings.connect('changed', () => {
            this._toggle.updateFromSettings();
        });

        this._startMonitorPolling();
    }

    _startMonitorPolling() {
        if (this._pollTimeoutId) {
            GLib.source_remove(this._pollTimeoutId);
        }

        const poll = () => {
            const lastMode = this._settings.get_string('last-mode');

            validateCurrentStateAsync(this._indicator._toggle._builder, lastMode, (result) => {
                if (!result.validMode) {
                    runCommand(this._indicator._toggle._builder.commands[lastMode]);
                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                        this._toggle._readCurrentStateAndUpdateUi();
                    });
                }

                if (!result.active) {
                    Main.notifyError(
                        _('Monitor Configuration Changed'),
                        _('Configuration cannot be applied')
                    );
                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                        this._toggle._readCurrentStateAndUpdateUi();
                    });
                }
            });

            this._pollTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, poll);
            return GLib.SOURCE_REMOVE;
        };

        poll();
    }

    _stopMonitorPolling() {
        if (this._pollTimeoutId) {
            GLib.source_remove(this._pollTimeoutId);
            this._pollTimeoutId = null;
        }
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
        this._stopMonitorPolling();
        this._toggle = null;
        this._settings = null;
    }
}