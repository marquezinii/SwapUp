<div align="center">
  <img src="assets/swapup-icon.png" alt="SwapUp! logo" width="112" />
  <h1>SwapUp!</h1>
  <p><strong>A privacy-first, multilingual calendar for Windows — designed to keep planning simple, polished, and local.</strong></p>
</div>

> [!IMPORTANT]
> SwapUp! is currently in active development. Public builds, downloads, and installation instructions are intentionally not available yet.

## Overview

SwapUp! is a lightweight desktop calendar focused on clear daily planning, personal customization, and local-first privacy. It combines month, week, day, and agenda views with event organization, reminders, multiple calendar systems, accessibility preferences, and a carefully designed Windows interface.

The project is currently being developed and tested as a local Windows application. The repository is public to document its progress and technical direction, not to distribute production-ready builds.

## Current Status

- Version: `1.3.2`.
- Stage: private local alpha / active development.
- Initial platform: Windows 10 and Windows 11.
- Distribution: not available yet.
- Data model: local-only browser storage with manual JSON backup and restore.
- Interface languages: Brazilian Portuguese plus 15 additional languages.

## Implemented Features

- Month, week, day, and agenda views.
- Events with dates, start and end times, all-day mode, location, notes, reminders, and recurrence.
- Multiple color-coded calendars with safe deletion and event preservation.
- Search, calendar filters, mini calendar, and next-appointment summary.
- Eight calendar systems: Gregorian, Buddhist, Islamic, Hebrew, Persian, Indian National, Japanese, and Chinese.
- Local profile with an optimized profile photo.
- Light, dark, and system themes with custom accent colors.
- Text scale, compact mode, stronger contrast, reduced transparency, and reduced motion.
- Automatic system time-zone detection.
- Local reminders through the Windows notification area.
- Keyboard shortcuts for navigation and common actions.
- Local backup and restore.
- Built-in bug report form with optional image attachment.
- Custom Windows title bar, in-app confirmation dialogs, and themed scrollbars.

## Languages

The interface currently supports:

- Brazilian Portuguese
- English
- Spanish
- French
- German
- Italian
- Dutch
- Polish
- Russian
- Turkish
- Arabic, including right-to-left layout
- Hindi
- Simplified Chinese
- Japanese
- Korean
- Indonesian

Translations are validated for key coverage as part of the local verification workflow. Additional linguistic review will continue before the first public build.

## Privacy Principles

SwapUp! is designed around local ownership of calendar data:

- Events, notes, addresses, profile information, and preferences stay on the user’s computer.
- The calendar does not require an account.
- No analytics or advertising services are included.
- Bug reports attach only the information explicitly provided by the user.
- External navigation is limited to user-requested actions such as opening an address in a map service.

## Technical Direction

SwapUp! uses:

- .NET 8 and WPF for the Windows application shell, tray integration, shortcuts, notifications, and native window behavior.
- Microsoft WebView2 for the local HTML, CSS, and JavaScript interface.
- `Intl.DateTimeFormat` for locale-aware dates and supported calendar systems.
- Local WebView2 storage for application data.
- Python and Node.js verification scripts for translation and calendar-system coverage.

The interface is packaged with the application and does not depend on remote fonts or hosted frontend assets.

## Validation

The current verification workflow checks:

- JavaScript syntax.
- .NET Release compilation.
- Translation coverage across all 16 interface languages.
- Locale and calendar formatting across 128 language/calendar combinations.
- Installation metadata and stable shortcut targets.
- Visual behavior in compact and maximized Windows layouts.

## Roadmap

Before the first public release, the project is expected to receive:

- Broader accessibility and keyboard-navigation review.
- Native import and synchronization options for established calendar formats.
- Additional translation review by fluent speakers.
- Automated UI and regression tests.
- A documented privacy policy and support channel.
- Signed public builds and a dedicated release process.

## Availability

There are no supported downloads or installation steps at this time. Please do not treat the current source tree as a production release. Public availability will be announced when the application, update process, documentation, and support workflow are ready.

## Author

Developed by **Felipe Marquezini**.

## License

No public software license has been selected yet. Unless a license is added later, all rights are reserved.

Copyright © 2026 Felipe Marquezini / SwapUp!.
