# Privacy

*OddlyClever Spin, last updated 4 November 2026*

I built Spin to run on your own device, for you, and nobody else. There are no accounts, no sign-up, no ads, no analytics and
no crash tracking. I don't run a server for it, so I never see what you search, play or save.

## What leaves your device

Spin only talks to the internet to do what you ask it to. Each request goes straight from your device to the service below,
on your own connection, so that service sees your IP address like any website you visit.

| When | Who it talks to | What it sends |
|---|---|---|
| You search, open an artist, album or chart, play or save a song | YouTube and YouTube Music (Google) | Your search words, or the song, album or artist you picked |
| You type in the search box | Google's search suggestions | What you've typed so far, once it's two letters or more |
| Covers and artist pictures show up | Google's image servers (`ytimg.com`, `googleusercontent.com`, `ggpht.com`) | Which picture to load (each one is saved, so it's fetched once) |
| You open lyrics | LRCLIB (`lrclib.net`), a free lyrics library | The song's title, artist, album and length |
| Spin checks for a new version | GitHub (the Spin releases page) | Nothing beyond a normal request for the latest release |
| Spin updates its download engine | PyPI (the Python package index) | Nothing beyond a normal request for the newest yt-dlp |
| You use "Send to my phone" | Nobody on the internet | The app is shared on your home network only, behind a one-time link that stops after 15 minutes |

## What never leaves your device

- Your library, playlists, likes, play counts and listening history.
- The songs and covers you save. They stay in your music folder.
- Your settings and theme.
- Anything about you: there's no account, name, email, device ID or advertising ID.

## Where your things are kept

- **Windows:** your songs are in `Music\OddlyClever Music`. Spin's own files (library list, cache, saved covers) are in the same folder.
- **Android:** your songs are in your phone's Music folder. Spin's library list and cache stay in the app's private storage.

Uninstalling Spin leaves your songs where they are. Delete the folder yourself if you want them gone.

## Other people's services

YouTube, Google, LRCLIB, GitHub and PyPI have their own privacy policies, and those cover what they do with a request. Spin isn't made by
or connected to any of them.

## Children

Spin doesn't collect anything from anyone, so there is nothing about children to collect either.

## Changes and questions

If this ever changes, I'll update this page and say so in the release notes first. Questions are welcome on the project's GitHub
Issues page.
