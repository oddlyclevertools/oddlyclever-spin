## OddlyClever Spin {{VERSION}}

{{CHANGES}}

### Download

- **Windows 10 and 11:** `OddlyCleverSpin-Setup-{{VERSION}}.exe`. The installer isn't code-signed yet, so if Windows says "Windows protected your PC", click **More info**, then **Run anyway**. It installs just for you, no admin needed.
- **Android 7 and up:** `OddlyCleverSpin-{{VERSION}}.apk`. Open it and allow your browser to install apps if Android asks. Updating? Install it over the old one: your songs and settings stay.
- **Android updates by themselves:** add `https://github.com/oddlyclevertools/oddlyclever-spin` to [Obtainium](https://github.com/ImranR98/Obtainium).

Already have Spin? It tells you about this version by itself.

### Check your download

```
{{SHA256SUMS}}
```

PowerShell: `Get-FileHash .\OddlyCleverSpin-Setup-{{VERSION}}.exe`. Linux or macOS: `sha256sum -c SHA256SUMS.txt`.

Please download only music you have the right to. Something broken? Open an issue and paste what **Copy diagnostics** gives you.
