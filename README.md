<div align="center"><img width="1920" height="1080" alt="Screenshot From 2025-11-13 17-45-05" src="https://github.com/user-attachments/assets/ba1bcf1f-264c-4259-b899-f6910db3c17c" /></div>
<div align="center"><img width="407" height="573" alt="Screenshot From 2025-11-13 17-45-27" src="https://github.com/user-attachments/assets/ae4f9012-0949-4c01-9d0d-f070124aa163" /></div>
<div align="center"><img width="673" height="1059" alt="Screenshot From 2025-11-13 17-45-45" src="https://github.com/user-attachments/assets/b7062c48-b084-4f67-beed-3f451acbb08e" /></div>

# Multi Monitor Switcher
GNOME Shell Extension for switching between monitor configurations (primary, mirror, extension) via `gdctl`.

## Functions
- Switch between:
  - One monitor
  - Two monitors (main left/right)
  - Mirror
- Support for scaling
- Support for different update modes
- Support for Russian and English languages

- Polls the real status of the monitors every 5 seconds, if you turn one off, the extension will notice this and remember the current configuration.

- When turned on, it tries to apply the latest installed configuration, if the number of active monitors differs and does not allow it to be applied, it applies the possible configuration in the current conditions.

## Installation
Install the extension via GNOME Extensions

## Setting up
Open the extension settings.
Specify monitor names (for example, DP-3, HDMI-1) — you can get them via gdctl show -M.
Specify the zoom and resolution for each of the monitors — you can get it through gdctl show -M.

## Localization
Russian and English are supported automatically.

#----------------------------------------------------------------------------------------------------------------

# Multi Monitor Switcher
GNOME Shell Extension для переключения между конфигурациями мониторов (основной, зеркало, расширение) через `gdctl`.

## Функции
- Переключение между:
  - Один монитор
  - Два монитора (основной слева/справа)
  - Зеркало
- Поддержка масштабирования
- Поддержка разных режимов обновления
- Поддержка русского и английского языков

- Каждые 5 секунд опрашивает реальное состояние мониторов, если один Вы выключили - расширение это заметит и запомнит текущую конфигурацию.

- При включении пытается применить последнюю установленную конфигурацию, если количество активных мониторов отличается и не позволяет применить ее - применяет возможную в текущих условиях.

## Установка
Установите расширение через GNOME Extensions

## Настройка
Откройте настройки расширения.
Укажите имена мониторов (например, DP-3, HDMI-1) — можно получить через gdctl show -m.
Укажите масштабирование и разрешение для каждого из мониторов — можно получить через gdctl show -m.

## Локализация
Русский и английский языки поддерживаются автоматически.
