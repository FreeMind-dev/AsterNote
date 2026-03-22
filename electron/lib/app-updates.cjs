const path = require('path');

function parseRepositorySlug(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const sshMatch = raw.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/i);
  if (sshMatch) {
    return sshMatch[1].replace(/\.git$/i, '');
  }

  try {
    const url = new URL(raw.replace(/^git\+/, ''));
    if (!/github\.com$/i.test(url.hostname)) return '';
    return url.pathname.replace(/^\/+/, '').replace(/\.git$/i, '').replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function normalizeVersion(value) {
  return String(value || '')
    .trim()
    .replace(/^v/i, '')
    .split('+')[0]
    .split('-')[0];
}

function compareVersions(left, right) {
  const leftParts = normalizeVersion(left)
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = normalizeVersion(right)
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
  const width = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < width; index += 1) {
    const a = leftParts[index] || 0;
    const b = rightParts[index] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }

  return 0;
}

function trimReleaseNotes(body) {
  const text = String(body || '').trim();
  if (!text) return '';

  const lines = text.split(/\r?\n/).slice(0, 16);
  const joined = lines.join('\n').trim();
  return joined.length > 900 ? `${joined.slice(0, 900).trim()}…` : joined;
}

function formatPublishedDate(value, language) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  try {
    return date.toLocaleDateString(language === 'zh-CN' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function formatAssetSize(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '';

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const digits = unitIndex === 0 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(digits)} ${units[unitIndex]}`;
}

function sanitizeDownloadName(value, fallback) {
  const normalized = String(value || fallback || 'AsterNote-update')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || fallback || 'AsterNote-update';
}

function detectAssetArch(fileName) {
  const value = String(fileName || '').toLowerCase();
  if (!value) return null;
  if (/(^|[^a-z0-9])(universal|all)([^a-z0-9]|$)/.test(value)) return 'universal';
  if (/(^|[^a-z0-9])(arm64|aarch64)([^a-z0-9]|$)/.test(value)) return 'arm64';
  if (/(^|[^a-z0-9])(amd64|x86_64|x64)([^a-z0-9]|$)/.test(value)) return 'x64';
  if (/(^|[^a-z0-9])(ia32|i386|x86)([^a-z0-9]|$)/.test(value)) return 'ia32';
  if (/(^|[^a-z0-9])(armv7|armv6|arm)([^a-z0-9]|$)/.test(value)) return 'arm';
  return null;
}

function preferredExtensionsForPlatform(platform) {
  if (platform === 'win32') return ['.exe'];
  if (platform === 'darwin') return ['.dmg', '.zip'];
  return ['.AppImage', '.deb', '.rpm', '.tar.gz'];
}

function matchesExtension(fileName, extension) {
  return String(fileName || '').toLowerCase().endsWith(extension.toLowerCase());
}

function scoreAssetForPlatform(asset, platform, arch) {
  const fileName = String(asset?.name || '');
  if (!fileName) return Number.NEGATIVE_INFINITY;

  const assetArch = detectAssetArch(fileName);
  if (assetArch && assetArch !== 'universal' && assetArch !== arch) {
    return Number.NEGATIVE_INFINITY;
  }

  const preferred = preferredExtensionsForPlatform(platform);
  const extensionScore = preferred.findIndex((extension) => matchesExtension(fileName, extension));
  if (extensionScore === -1) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 100 - extensionScore * 10;
  if (assetArch === arch) score += 8;
  if (assetArch === 'universal') score += 4;
  if (platform === 'darwin' && matchesExtension(fileName, '.dmg')) score += 6;
  if (platform === 'linux' && matchesExtension(fileName, '.AppImage')) score += 6;
  return score;
}

function createUpdateManager({
  app,
  dialog,
  electronSession,
  getMainWindow,
  getUi,
  productName,
  repositoryUrl,
  shell,
}) {
  const repositorySlug = parseRepositorySlug(repositoryUrl);
  const releasesPageUrl = repositorySlug ? `https://github.com/${repositorySlug}/releases` : '';
  const latestReleaseApiUrl = repositorySlug
    ? `https://api.github.com/repos/${repositorySlug}/releases/latest`
    : '';

  let checkInFlight = null;

  function hasReleaseFeed() {
    return Boolean(latestReleaseApiUrl);
  }

  async function openReleaseNotes() {
    if (!releasesPageUrl) return false;
    await shell.openExternal(releasesPageUrl);
    return true;
  }

  async function fetchLatestRelease() {
    if (!latestReleaseApiUrl) {
      throw new Error('Repository release feed is not configured.');
    }

    const response = await fetch(latestReleaseApiUrl, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `${productName}/${app.getVersion()}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub release check failed with status ${response.status}.`);
    }

    return response.json();
  }

  function selectDownloadAsset(release) {
    const assets = Array.isArray(release?.assets) ? release.assets : [];
    const scored = assets
      .map((asset) => ({
        asset,
        score: scoreAssetForPlatform(asset, process.platform, process.arch),
      }))
      .filter((item) => Number.isFinite(item.score))
      .sort((left, right) => right.score - left.score);

    return scored[0]?.asset || null;
  }

  function buildReleaseDetail(ui, release, asset) {
    const currentVersion = app.getVersion();
    const latestVersion = normalizeVersion(release?.tag_name || release?.name || '');
    const publishedAt = formatPublishedDate(release?.published_at, ui.language);
    const assetSize = formatAssetSize(asset?.size);
    const parts = [
      ui.updates.currentVersion(currentVersion),
      ui.updates.latestVersion(latestVersion),
    ];

    if (publishedAt) {
      parts.push(ui.updates.publishedAt(publishedAt));
    }

    if (asset?.name) {
      parts.push(ui.updates.downloadAsset(asset.name, assetSize));
    } else {
      parts.push(ui.updates.noDirectDownload);
    }

    const notes = trimReleaseNotes(release?.body);
    if (notes) {
      parts.push(`${ui.updates.releaseNotesLabel}\n${notes}`);
    }

    return parts.join('\n');
  }

  async function downloadAsset(asset, ui) {
    const currentWindow = getMainWindow();
    const currentSession = currentWindow?.webContents.session || electronSession.defaultSession;
    const fileName = sanitizeDownloadName(asset?.name, `${productName}-update`);
    const savePath = path.join(app.getPath('downloads'), fileName);

    return new Promise((resolve, reject) => {
      const handleWillDownload = (_event, item) => {
        item.setSavePath(savePath);
        item.once('done', (_doneEvent, state) => {
          if (state === 'completed') {
            resolve(savePath);
            return;
          }
          reject(new Error(ui.updates.downloadFailedState(state)));
        });
      };

      currentSession.once('will-download', handleWillDownload);

      try {
        currentSession.downloadURL(asset.browser_download_url);
      } catch (error) {
        currentSession.removeListener('will-download', handleWillDownload);
        reject(error);
      }
    });
  }

  async function notifyDownloadResult(savePath, releaseUrl, ui) {
    const currentWindow = getMainWindow() || undefined;
    const { response } = await dialog.showMessageBox(currentWindow, {
      type: 'info',
      title: ui.updates.downloadCompleteTitle,
      message: ui.updates.downloadCompleteMessage,
      detail: `${ui.updates.savedTo(savePath)}\n${ui.updates.installHint}`,
      buttons: [ui.updates.showInFolder, ui.updates.openReleasePage, ui.updates.close],
      cancelId: 2,
      defaultId: 0,
    });

    if (response === 0) {
      shell.showItemInFolder(savePath);
      return;
    }

    if (response === 1 && releaseUrl) {
      await shell.openExternal(releaseUrl);
    }
  }

  async function notifyDownloadFailure(asset, releaseUrl, error, ui) {
    const currentWindow = getMainWindow() || undefined;
    const { response } = await dialog.showMessageBox(currentWindow, {
      type: 'warning',
      title: ui.updates.downloadFailedTitle,
      message: ui.updates.downloadFailedMessage,
      detail: error?.message || ui.updates.downloadFailedFallback,
      buttons: [ui.updates.openDirectDownload, ui.updates.openReleasePage, ui.updates.close],
      cancelId: 2,
      defaultId: 0,
    });

    if (response === 0 && asset?.browser_download_url) {
      await shell.openExternal(asset.browser_download_url);
      return;
    }

    if (response === 1 && releaseUrl) {
      await shell.openExternal(releaseUrl);
    }
  }

  async function promptForUpdate(release) {
    const ui = getUi();
    const currentWindow = getMainWindow() || undefined;
    const asset = selectDownloadAsset(release);
    const { response } = await dialog.showMessageBox(currentWindow, {
      type: 'info',
      title: ui.updates.updateAvailableTitle,
      message: ui.updates.updateAvailableMessage(release?.name || release?.tag_name || ''),
      detail: buildReleaseDetail(ui, release, asset),
      buttons: asset
        ? [ui.updates.downloadNow, ui.updates.openReleasePage, ui.updates.later]
        : [ui.updates.openReleasePage, ui.updates.later],
      cancelId: asset ? 2 : 1,
      defaultId: 0,
      noLink: true,
    });

    if (!asset) {
      if (response === 0 && release?.html_url) {
        await shell.openExternal(release.html_url);
      }
      return;
    }

    if (response === 0) {
      void downloadAsset(asset, ui)
        .then((savePath) => notifyDownloadResult(savePath, release?.html_url, ui))
        .catch((error) => notifyDownloadFailure(asset, release?.html_url, error, ui));
      return;
    }

    if (response === 1 && release?.html_url) {
      await shell.openExternal(release.html_url);
    }
  }

  async function showUpToDateDialog() {
    const ui = getUi();
    const currentWindow = getMainWindow() || undefined;
    await dialog.showMessageBox(currentWindow, {
      type: 'info',
      title: ui.updates.upToDateTitle,
      message: ui.updates.upToDateMessage,
      detail: ui.updates.currentVersion(app.getVersion()),
    });
  }

  async function showCheckFailure(error) {
    const ui = getUi();
    const currentWindow = getMainWindow() || undefined;
    const buttons = releasesPageUrl
      ? [ui.updates.openReleasePage, ui.updates.close]
      : [ui.updates.close];
    const { response } = await dialog.showMessageBox(currentWindow, {
      type: 'warning',
      title: ui.updates.checkFailedTitle,
      message: ui.updates.checkFailedMessage,
      detail: error?.message || ui.updates.checkFailedFallback,
      buttons,
      cancelId: buttons.length - 1,
      defaultId: 0,
    });

    if (releasesPageUrl && response === 0) {
      await shell.openExternal(releasesPageUrl);
    }
  }

  async function checkForUpdates() {
    if (!hasReleaseFeed()) {
      return false;
    }

    if (checkInFlight) {
      return checkInFlight;
    }

    checkInFlight = (async () => {
      try {
        const release = await fetchLatestRelease();
        const latestVersion = release?.tag_name || release?.name || '';
        if (compareVersions(latestVersion, app.getVersion()) <= 0) {
          await showUpToDateDialog();
          return false;
        }

        await promptForUpdate(release);
        return true;
      } catch (error) {
        await showCheckFailure(error);
        return false;
      } finally {
        checkInFlight = null;
      }
    })();

    return checkInFlight;
  }

  return {
    checkForUpdates,
    hasReleaseFeed,
    openReleaseNotes,
  };
}

module.exports = {
  createUpdateManager,
};
