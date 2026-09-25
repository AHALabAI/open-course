"""Local home reconstruction pilot. Originals are read-only; each preparation creates a new run."""
import argparse
import csv
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time

from PIL import Image, ImageDraw, ImageOps
import cv2
import numpy as np
from photo_metadata import read_photo

HERE = Path(__file__).resolve().parent
CONFIG = HERE / 'tools.json'
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.tif', '.tiff'}


def save_json(path, data):
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


def sha256(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def config():
    return json.loads(CONFIG.read_text(encoding='utf-8'))


def execute(command, cwd, log, timeout=7200, help_check=False):
    """No shell interpolation; complete output goes to a log, including failed commands."""
    command = [str(c) for c in command]
    log = Path(log)
    log.parent.mkdir(parents=True, exist_ok=True)
    start = time.time()
    native_before = set(Path(cwd).glob(f'{Path(command[0]).stem}-*.log'))
    env = os.environ.copy()
    if Path(command[0]).stem.lower() == 'colmap':
        env['QT_PLUGIN_PATH'] = str(Path(command[0]).parent.parent / 'plugins')
    with log.open('x', encoding='utf-8') as f:
        f.write(json.dumps({'command': command, 'cwd': str(cwd)}, ensure_ascii=False) + '\n')
        f.flush()
        result = subprocess.run(command, cwd=cwd, stdout=f, stderr=subprocess.STDOUT,
                                timeout=timeout, shell=False, env=env,
                                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    native_after = set(Path(cwd).glob(f'{Path(command[0]).stem}-*.log'))
    with log.open('a', encoding='utf-8') as f:
        for native in sorted(native_after - native_before):
            f.write('\nNATIVE_LOG: ' + str(native) + '\n')
            f.write(native.read_text(encoding='utf-8', errors='replace'))
    output = log.read_text(encoding='utf-8', errors='replace')
    print(f'{Path(command[0]).name}: exit={result.returncode}, {time.time()-start:.1f}s; {log}', flush=True)
    # OpenMVS v2.4.0 returns 1 for help (no input file), and writes its help to native logs.
    expected_help_exit = help_check and result.returncode == 1 and 'Available options' in output
    if result.returncode and not expected_help_exit:
        raise RuntimeError(f'Command failed; inspect {log}')
    return output


def new_run(path):
    run = Path(path).resolve()
    run.mkdir(parents=True, exist_ok=False)
    for name in ['images', 'logs', 'review']:
        (run / name).mkdir()
    return run


def validate_label(label):
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,63}', label):
        raise ValueError('Group must be a short ASCII identifier, e.g. xiaomi_main_video')


def process_images(sources, run, group, max_size=1920):
    validate_label(group)
    target = run / 'images' / group
    target.mkdir()
    rows = []
    dimensions = set()
    optics = set()
    fingerprints = set()
    thumbs = []
    metadata = []
    for i, source in enumerate(sources, 1):
        fingerprint = sha256(source)
        if fingerprint in fingerprints:
            raise ValueError(f'Exact duplicate source: {source}. Make a curated input copy, keep originals.')
        fingerprints.add(fingerprint)
        original_metadata = read_photo(source)
        metadata.append(original_metadata)
        with Image.open(source) as raw:
            # Preserve GPS locally, not in JPEG derivatives. Extract nested optical EXIF too.
            exif_optics = {k: original_metadata['exif'][k] for k in
                           ['Make','Model','FocalLength','FocalLengthIn35mmFilm','LensModel','DigitalZoomRatio']
                           if k in original_metadata['exif']}
            if exif_optics:
                optics.add(json.dumps(exif_optics, sort_keys=True))
            img = ImageOps.exif_transpose(raw).convert('RGB')
            dimensions.add(img.size)
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            name = f'{i:06d}.jpg'
            destination = target / name
            img.save(destination, quality=95, subsampling=0)
            gray = cv2.cvtColor(np.asarray(img), cv2.COLOR_RGB2GRAY)
            sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
            dark = float((gray < 8).mean())
            bright = float((gray > 247).mean())
            rows.append({'source': str(source.resolve()), 'source_sha256': fingerprint,
                         'image': f'{group}/{name}', 'width': img.width, 'height': img.height,
                         'sharpness': round(sharpness, 2), 'dark_fraction': round(dark, 4),
                         'bright_fraction': round(bright, 4), 'optics': exif_optics})
            preview = ImageOps.contain(img, (192, 128))
            tile = Image.new('RGB', (200, 158), '#eeeeee')
            tile.paste(preview, ((200-preview.width)//2, 0))
            ImageDraw.Draw(tile).text((4, 132), f'{i:03d}  sharp:{sharpness:.0f}', fill='black')
            thumbs.append(tile)
    if len(dimensions) != 1:
        raise ValueError('Mixed source resolutions/orientations in one camera group. Separate them into runs.')
    if len(optics) > 1:
        raise ValueError('Multiple optical EXIF signatures in one camera group. Separate lenses/devices/settings.')
    cols = 6
    for start in range(0, len(thumbs), 60):
        batch = thumbs[start:start+60]
        sheet = Image.new('RGB', (cols*200, math.ceil(len(batch)/cols)*158), 'white')
        for j, tile in enumerate(batch):
            sheet.paste(tile, ((j % cols)*200, (j // cols)*158))
        sheet.save(run / 'review' / f'contact-{start//60+1:02d}.jpg', quality=88)
    with (run / 'review' / 'quality.csv').open('w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=[k for k in rows[0] if k != 'optics'])
        writer.writeheader()
        writer.writerows({k: v for k, v in row.items() if k != 'optics'} for row in rows)
    save_json(run / 'capture-metadata-private.json', {'photos':metadata,
               'scope':'Original EXIF preserved locally; no GPS priors passed to SfM in this baseline.'})
    save_json(run / 'manifest.json', {
        'status': 'prepared_needs_visual_review', 'group': group, 'count': len(rows),
        'camera_model': 'SIMPLE_RADIAL', 'scale_calibrated': False,
        'assumption': 'One physical lens, resolution and crop policy per run; EXIF absence cannot prove this.',
        'quality_note': 'Sharpness/exposure are advisory and content-dependent. No automatic rejection.',
        'images': rows})
    print(f'Prepared {len(rows)} images. Inspect {run / "review"}; originals unchanged.')


def photos(args):
    source = Path(args.source).resolve()
    if not source.is_dir():
        raise FileNotFoundError(source)
    sources = sorted(p for p in source.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS)
    unsupported = [p.name for p in source.iterdir() if p.suffix.lower() in {'.heic', '.heif', '.dng'}]
    if unsupported:
        raise ValueError('Use original JPEG or separately converted copies; HEIC/DNG need explicit conversion: ' + str(unsupported[:5]))
    if not 12 <= len(sources) <= 150:
        raise ValueError(f'Pilot expects 12–150 photos in a single flat camera folder, found {len(sources)}')
    run = new_run(args.run)
    process_images(sources, run, args.group, args.max_size)


def video(args):
    source = Path(args.source).resolve()
    if not source.is_file():
        raise FileNotFoundError(source)
    if not all(math.isfinite(x) for x in [args.start, args.duration, args.fps]):
        raise ValueError('Video times and fps must be finite')
    if args.start < 0 or args.duration <= 0 or args.fps <= 0 or not 12 <= args.duration*args.fps <= 150:
        raise ValueError('Choose a short section yielding 12–150 frames; start must be nonnegative')
    cfg = config()
    probe = subprocess.run([cfg['ffprobe'], '-v', 'error', '-show_streams', '-show_format',
                            '-of', 'json', str(source)], capture_output=True, check=True, text=True)
    metadata = json.loads(probe.stdout)
    stream = next(s for s in metadata['streams'] if s['codec_type'] == 'video')
    if stream.get('color_transfer') in ['smpte2084', 'arib-std-b67']:
        raise ValueError('HDR/HLG input needs an explicit color conversion. Prefer Normal/SDR for the pilot.')
    available = float(metadata['format']['duration'])
    if args.start + args.duration > available + 0.05:
        raise ValueError(f'Request exceeds video length {available:.2f}s')
    run = new_run(args.run)
    save_json(run / 'video-source.json', {'path': str(source), 'sha256': sha256(source),
                                        'start': args.start, 'duration': args.duration, 'fps': args.fps,
                                        'probe': metadata})
    frames = run / 'extracted'
    frames.mkdir()
    execute([cfg['ffmpeg'], '-hide_banner', '-nostdin', '-n', '-ss', args.start,
             '-i', source, '-t', args.duration, '-vf',
             f'fps={args.fps},scale={args.max_size}:{args.max_size}:force_original_aspect_ratio=decrease',
             '-q:v', '2', frames / '%06d.jpg'], run, run / 'logs' / 'extract.log')
    sources = sorted(frames.glob('*.jpg'))
    if not 12 <= len(sources) <= 150:
        raise ValueError(f'Unexpected frame count: {len(sources)}')
    process_images(sources, run, args.group, args.max_size)


def sfm(args):
    cfg = config()
    run = Path(args.run).resolve()
    manifest = json.loads((run / 'manifest.json').read_text(encoding='utf-8'))
    if not args.reviewed:
        raise ValueError('Inspect contact sheets first, then use --reviewed to record that check')
    if (run / 'database.db').exists() or (run / 'sparse').exists():
        raise FileExistsError('SfM already started in this run; preserve it and prepare a new run')
    (run / 'sparse').mkdir()
    commands = [
        ('features', ['feature_extractor', '--database_path', 'database.db', '--image_path', 'images',
                      '--ImageReader.single_camera_per_folder', '1',
                      '--ImageReader.camera_model', 'SIMPLE_RADIAL', '--FeatureExtraction.num_threads', '8']),
        ('matches', ['exhaustive_matcher', '--database_path', 'database.db']),
        ('mapper', ['mapper', '--database_path', 'database.db', '--image_path', 'images',
                    '--output_path', 'sparse']),
    ]
    for stage, command in commands:
        execute([cfg['colmap']] + command, run, run / 'logs' / f'{stage}.log')
    models = sorted(p for p in (run / 'sparse').iterdir() if p.is_dir())
    if not models:
        raise RuntimeError('No sparse reconstruction. Inspect logs and capture overlap before proceeding.')
    summaries = []
    for model in models:
        output = execute([cfg['colmap'], 'model_analyzer', '--path', model], run,
                         run / 'logs' / f'analyzer-{model.name}.log')
        summaries.append({'component': model.name, 'analysis': output})
    save_json(run / 'sfm-review.json', {'status': 'needs_geometry_review', 'input_frames': manifest['count'],
                                      'components': summaries,
                                      'instruction': 'Inspect cameras/points in COLMAP; explicitly choose a component. No automatic acceptance.'})
    print('SfM finished. Inspect sparse geometry and sfm-review.json before mesh generation.')


def mesh(args):
    cfg = config()
    run = Path(args.run).resolve()
    if not re.fullmatch(r'\d+', args.component):
        raise ValueError('Component must be the numeric COLMAP output directory')
    model = run / 'sparse' / args.component
    if not model.is_dir() or not args.reviewed:
        raise ValueError('Select an existing --component and inspect its geometry before --reviewed')
    if (run / 'dense').exists() or (run / 'mvs').exists():
        raise FileExistsError('Dense reconstruction already started; existing outputs are preserved')
    mvs = run / 'mvs'
    mvs.mkdir()
    execute([cfg['colmap'], 'image_undistorter', '--image_path', 'images', '--input_path', model,
             '--output_path', 'dense', '--output_type', 'COLMAP', '--max_image_size', '1920'],
            run, run / 'logs' / 'undistort.log')
    stages = [
        ('InterfaceCOLMAP', ['-i', '../dense', '-o', 'scene.mvs', '--image-folder', '../dense/images']),
        ('DensifyPointCloud', ['scene.mvs', '--resolution-level', '1', '--max-threads', '8']),
        ('ReconstructMesh', ['scene_dense.mvs', '-p', 'scene_dense.ply', '--max-threads', '8']),
    ]
    mesh_name = 'scene_dense_mesh.ply'
    if args.refine:
        stages.append(('RefineMesh', ['scene_dense.mvs', '-m', mesh_name, '-o', 'scene_refined.mvs',
                                      '--scales', '1', '--max-face-area', '16', '--max-threads', '8']))
        mesh_name = 'scene_refined.ply'
    stages.append(('TextureMesh', ['scene_dense.mvs', '-m', mesh_name, '-o', 'scene_textured.mvs',
                                   '--export-type', 'glb', '--max-texture-size', '4096', '--max-threads', '8',
                                   '--global-seam-leveling', '1' if args.seam_leveling else '0',
                                   '--local-seam-leveling', '1' if args.seam_leveling else '0']))
    for name, command in stages:
        execute([str(Path(cfg['openmvs_bin']) / f'{name}.exe')] + command, mvs,
                run / 'logs' / f'{name}.log')
    # This pinned Windows OpenMVS build emits a GLB referencing a sibling PNG.
    # Package it explicitly; changing the suffix alone cannot embed a texture.
    glb = run / 'delivery' / 'scene.glb'
    execute([sys.executable, HERE / 'pack_glb.py', mvs / 'scene_textured.glb', glb], run,
            run / 'logs' / 'pack-glb.log')
    execute([sys.executable, HERE.parent / 'check_glb.py', glb, '--require-texture'], run,
            run / 'logs' / 'glb-check.log')
    save_json(run / 'mesh-result.json', {'glb': str(glb), 'sha256': sha256(glb),
                                      'status': 'textured_mesh_needs_scale_and_geometry_review',
                                      'scale_calibrated': False, 'collision_ready': False})
    print('Textured GLB:', glb, '\nNext: inspect geometry, calibrate measured distances, render.')


def preflight(args):
    cfg = config()
    target = Path(args.out).resolve()
    target.mkdir(parents=True, exist_ok=False)
    results = []
    commands = [('colmap', [cfg['colmap'], '-h']), ('ffmpeg', [cfg['ffmpeg'], '-version']),
                ('ffprobe', [cfg['ffprobe'], '-version']), ('blender', [cfg['blender'], '--version'])]
    for name in ['InterfaceCOLMAP', 'DensifyPointCloud', 'ReconstructMesh', 'RefineMesh', 'TextureMesh']:
        commands.append((name, [str(Path(cfg['openmvs_bin']) / f'{name}.exe'), '-h']))
    for name, command in commands:
        try:
            output = execute(command, target, target / f'{name}.log', timeout=60, help_check=True)
            if name == 'TextureMesh' and 'glb' not in output.lower():
                raise RuntimeError('TextureMesh help does not advertise GLB export')
            results.append({'tool': name, 'status': 'launch_passed', 'mentions_glb': 'glb' in output.lower()})
        except Exception as exc:
            results.append({'tool': name, 'status': 'failed', 'error': str(exc)})
    save_json(target / 'result.json', {'checks': results,
                                      'scope': 'Launch/help only; reconstruction and GPU compute require actual image tests.'})
    if any(r['status'] == 'failed' for r in results):
        raise SystemExit('Some tools failed; inspect preflight logs')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='stage', required=True)
    for name, handler in [('photos', photos), ('video', video)]:
        p = sub.add_parser(name)
        p.add_argument('--source', required=True)
        p.add_argument('--run', required=True)
        p.add_argument('--group', required=True, help='One device/lens/resolution/crop per group and run')
        p.add_argument('--max-size', type=int, default=1920)
        p.set_defaults(handler=handler)
        if name == 'video':
            p.add_argument('--start', type=float, default=0)
            p.add_argument('--duration', type=float, required=True)
            p.add_argument('--fps', type=float, default=2)
    p = sub.add_parser('sfm')
    p.add_argument('--run', required=True)
    p.add_argument('--reviewed', action='store_true')
    p.set_defaults(handler=sfm)
    p = sub.add_parser('mesh')
    p.add_argument('--run', required=True)
    p.add_argument('--component', required=True)
    p.add_argument('--reviewed', action='store_true')
    p.add_argument('--refine', action='store_true')
    p.add_argument('--seam-leveling', action='store_true',
                   help='Enable both OpenMVS seam leveling stages; compare appearance in a separate run')
    p.set_defaults(handler=mesh)
    p = sub.add_parser('preflight')
    p.add_argument('--out', required=True)
    p.set_defaults(handler=preflight)
    args = parser.parse_args()
    if hasattr(args, 'max_size') and not 640 <= args.max_size <= 4096:
        parser.error('--max-size must be 640–4096')
    args.handler(args)


if __name__ == '__main__':
    main()
