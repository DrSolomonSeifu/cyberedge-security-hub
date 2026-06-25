<div align="center">

# CyberEdge Security+ Learning Hub

**An installable study app for the CompTIA Security+ (SY0-701) exam.**

Sixteen interactive lessons across the five exam domains, with progress tracking, global search, bookmarks, and offline access, all in one clean, distraction-free hub.

![Type](https://img.shields.io/badge/app-PWA-0E2238)
![Exam](https://img.shields.io/badge/CompTIA-Security%2B%20SY0--701-C9A227)
![Build](https://img.shields.io/badge/build-none%20(vanilla)-1E4E79)
![Hosting](https://img.shields.io/badge/hosting-GitHub%20Pages-0E2238)

</div>

---

## Overview

The Learning Hub wraps sixteen self-contained lesson portals in a single, installable application. Each lesson keeps its own content and review activities, while the hub adds a consistent home screen, navigation, search, and progress tracking around them.

It installs like a normal app on a Windows laptop or a phone, works offline once a lesson has been opened, and saves each learner's progress and bookmarks on their own device. There is no account to create and no server to run.

## Features

- **A study dashboard** that groups all sixteen lessons under the five Security+ domains, with exam weights, completion status, and an overall progress ring.
- **Resume where you left off**, the hub remembers your last lesson and section and drops you back into it.
- **Automatic progress tracking**, section-level progress is recorded as you move through each lesson, no "mark complete" button needed.
- **Global search** across every lesson's headings and key concepts.
- **Bookmarks** for sections you want to revisit.
- **Light and dark modes**, light by default, tuned for long, comfortable study sessions.
- **Installable and offline-ready** on Windows, Android, and iPhone or iPad.
- **Responsive** on desktop, tablet, and mobile.

## The five domains

| Domain | Exam weight | Lessons |
| --- | --- | --- |
| 1. General Security Concepts | 12% | 1, 3, 4 |
| 2. Threats, Vulnerabilities & Mitigations | 22% | 2, 8, 13 |
| 3. Security Architecture | 18% | 5, 6, 7 |
| 4. Security Operations | 28% | 9, 10, 11, 12 |
| 5. Security Program Management & Oversight | 20% | 14, 15, 16 |

## Install the app

Open the published link, then install:

**Windows laptop** (Chrome or Edge)
Click the install icon in the address bar, or the **Install app** button in the top bar, then **Install**. The hub opens in its own window with a Start Menu icon.

**Android** (Chrome)
Open the menu, tap **Add to Home screen**, then confirm.

**iPhone or iPad** (Safari)
Tap **Share**, scroll down, tap **Add to Home Screen**, then **Add**.

The first open needs internet. After that, lessons you have opened are available offline.

## Run it locally

The app is plain HTML, CSS, and JavaScript with no build step. Because it loads data files and registers a service worker, it needs to be served over `http`, not opened directly from the file system.

```bash
# from the project folder
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy

This project is built to host on **GitHub Pages**. Upload the contents so `index.html` sits at the repository root, then enable Pages under **Settings → Pages** with **Deploy from a branch** on `main` / `root`. Pages serves over HTTPS, which is what makes the app installable and offline-capable.

## Project structure

```
index.html               App shell (dashboard, navigation, search, bookmarks)
manifest.webmanifest     PWA manifest
sw.js                    Service worker (offline caching)
assets/
  css/app.css            Design system and layout
  js/app.js              Application logic
  icons/                 App icons
shared/
  lesson-bridge.js       Reports lesson progress to the hub
  mobile-responsive.css  Mobile hardening layer for the lessons
data/
  courses.json           Course registry
  security-plus.json     Lesson manifest, grouped by domain
  search-index.json      Prebuilt search index
lessons/                 The sixteen self-contained lesson portals
```

## Adding a lesson later

The hub is data-driven, so nothing in the interface is hard-coded. To add a lesson:

1. Drop the lesson file into `lessons/`.
2. Add one entry (number, title, domain, file) to `data/security-plus.json`.
3. Rebuild `data/search-index.json` so the new content is searchable.

The same approach supports adding a second certification later by registering a new course in `courses.json`.

## Tech notes

- No framework and no build pipeline, just standard web files.
- Progress, bookmarks, and theme are stored locally in the browser.
- Each lesson stays self-contained; the hub wraps the lessons rather than rewriting them.

## Credit

Created by **Dr. Solomon Seifu**, author and designer of the CyberEdge Security+ learning materials.
