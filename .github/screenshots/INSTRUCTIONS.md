# 📸 Adding Your Screenshots

I've prepared the README to showcase your beautiful Docker Dashboard! Here's what you need to do:

## 📁 Save Your Screenshots Here

Based on the images you showed me, save these 4 screenshots in this folder:

### 1. `dashboard.png` 
The main dashboard view showing:
- ✅ 23 Running, 3 Stopped, 26 Total containers at the top
- ✅ Global stats cards (CPU 100%, RAM 11.4 GB, Network speed, Data usage)
- ✅ Container cards in a grid (docker-dashboard, qbittorrent, immich, postgres, etc.)
- ✅ Green "Running" and Red "Stopped" badges
- ✅ "View Details" buttons

### 2. `container-details.png`
A container detail page showing:
- ✅ Live charts (CPU Usage, RAM Usage, Network RX/TX, Disk Usage)
- ✅ Real-time metrics at the top
- ✅ Time range selector dropdown (30 seconds)
- ✅ Bandwidth usage section with Last 24h/Week/Month/All Time tabs
- ✅ Download (339.34 GB) and Upload (549.17 GB) stats

### 3. `cpu-breakdown.png`
The CPU modal showing:
- ✅ Title "CPU Usage by Container"
- ✅ List of containers sorted by CPU usage
- ✅ postgres_db at 101.0%, dashdot at 5.5%, qbittorrent at 4.0%, etc.
- ✅ Container IDs below names
- ✅ Purple progress bars

### 4. `data-usage.png`
The data usage modal showing:
- ✅ Title "Total Data Usage by Container"
- ✅ List of containers with download/upload stats
- ✅ teldrive: 339.34 GB down, 549.16 GB up
- ✅ immich-immich-server-1: 34.07 GB down, 15.28 GB up
- ✅ Green (download) and blue (upload) arrows
- ✅ Total data per container

## 🎯 Quick Steps

### Windows (Your Setup):

1. **Take the screenshots:**
   - Press `Win + Shift + S` to open Snipping Tool
   - Or use `Print Screen` and paste into Paint
   - Or use your browser's screenshot tool

2. **Save them in this folder:**
   ```
   E:\Code\docker-dashboard\.github\screenshots\
   ```

3. **Name them exactly as:**
   - `dashboard.png`
   - `container-details.png`
   - `cpu-breakdown.png`
   - `data-usage.png`

4. **Git add and commit:**
   ```bash
   cd E:\Code\docker-dashboard
   git add .github/screenshots/
   git commit -m "docs: add screenshots to showcase features"
   git push origin main
   ```

## 📋 Screenshot Checklist

- [ ] Main dashboard (`dashboard.png`)
- [ ] Container details with charts (`container-details.png`)
- [ ] CPU breakdown modal (`cpu-breakdown.png`)
- [ ] Data usage modal (`data-usage.png`)
- [ ] All saved in `.github/screenshots/` folder
- [ ] Files named exactly as listed above
- [ ] Committed and pushed to GitHub

## 🎨 Tips for Best Results

- **Use 1920x1080 or higher resolution**
- **Take full browser window screenshots**
- **Dark mode** (your dashboard already uses it)
- **Show real data** (makes it more impressive than empty charts)
- **Clean up any sensitive info** if needed

## ✅ What's Already Done

I've already:
- ✅ Created the `.github/screenshots/` directory
- ✅ Updated README.md with screenshot placeholders
- ✅ Added emojis to the features list
- ✅ Created this guide for you

## 🚀 After Adding Screenshots

Once you push them, your README will automatically display them at:

```
https://github.com/MNDL-27/docker-dashboard
```

And they'll look like this in the README:

```markdown
### Dashboard Overview
![Dashboard Overview](.github/screenshots/dashboard.png)
*Monitor all your containers at a glance with real-time stats*
```

## 🤔 Alternative: Use URLs

If you prefer, you can also:
1. Upload screenshots to GitHub as a release asset
2. Or host them on imgur.com
3. Then update the README with the URLs

But saving them in `.github/screenshots/` is the recommended approach! 

---

**Need help?** Just let me know! 🙋‍♂️
