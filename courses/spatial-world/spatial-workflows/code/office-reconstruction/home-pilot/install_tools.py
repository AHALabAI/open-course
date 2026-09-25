"""Install pinned official portable packages without changing PATH or existing environments."""
import hashlib
import json
from pathlib import Path
import urllib.request
import zipfile

ROOT = Path('C:/recon-tools')
PACKAGES = [
    ('colmap/colmap', '4.2.0', 'colmap-x64-windows-cuda.zip', 'colmap-4.2.0',
     '991e0bae403a496fcc4de0c1f1f428619bf12f8000978f77bc6799d9bfeac23e'),
    ('cdcseacave/openMVS', 'v2.4.0', 'OpenMVS_Windows_x64.zip', 'openmvs-2.4.0',
     '0c31660c15c9ebc4c106873cf67564d9570d404aef7a6403451da1b6178b2167'),
]


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def main():
    downloads = ROOT / 'downloads'
    downloads.mkdir(parents=True, exist_ok=True)
    results = []
    for repo, version, asset, folder, expected in PACKAGES:
        url = f'https://github.com/{repo}/releases/download/{version}/{asset}'
        archive = downloads / (folder + '-' + asset)
        if not archive.exists():
            print('Downloading', url, flush=True)
            req = urllib.request.Request(url, headers={'User-Agent': 'AHALab-Recon-Pilot'})
            with urllib.request.urlopen(req, timeout=60) as response, archive.open('xb') as f:
                for chunk in iter(lambda: response.read(1024 * 1024), b''):
                    f.write(chunk)
        actual = digest(archive)
        if actual != expected:
            raise RuntimeError(f'Checksum mismatch: {archive}. Preserve/archive it before retrying.')
        target = ROOT / folder
        marker = target / 'installation.json'
        if target.exists():
            if not marker.exists() or json.loads(marker.read_text())['sha256'] != expected:
                raise FileExistsError(f'Unrecognized installation, refusing to overwrite: {target}')
            print('Already installed', target, flush=True)
        else:
            target.mkdir()
            with zipfile.ZipFile(archive) as z:
                for name in z.namelist():
                    if not (target / name).resolve().is_relative_to(target.resolve()):
                        raise ValueError('Archive entry escapes installation directory')
                z.extractall(target)
            marker.write_text(json.dumps({'source': url, 'sha256': actual, 'version': version}, indent=2))
            print('Installed', target, flush=True)
        results.append({'root': str(target), 'sha256': actual,
                        'executables': [str(p) for p in target.rglob('*.exe')
                                        if p.name.lower() in ['colmap.exe', 'interfacecolmap.exe',
                                                               'densifypointcloud.exe', 'reconstructmesh.exe',
                                                               'refinemesh.exe', 'texturemesh.exe']]})
    Path(__file__).with_name('installed-tools.json').write_text(json.dumps(results, indent=2))
    print(json.dumps(results, indent=2))


if __name__ == '__main__':
    main()
