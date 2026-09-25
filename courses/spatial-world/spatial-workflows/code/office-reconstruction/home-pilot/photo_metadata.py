"""Read original photo EXIF locally. Does not infer missing GPS or decode vendor gyro streams."""
import argparse
import json
import math
from pathlib import Path
from PIL import Image, ExifTags


def scalar(value):
    if isinstance(value, bytes):
        return value.decode('utf-8', errors='replace').rstrip('\x00')
    if isinstance(value, (str, int, float)) or value is None:
        return value
    if isinstance(value, (list, tuple)):
        return [scalar(x) for x in value]
    try:
        number = float(value)
        return number if math.isfinite(number) else str(value)
    except (TypeError, ValueError, ZeroDivisionError):
        return str(value)


def decimal(values, ref):
    if values is None or len(values) != 3 or ref not in ['N', 'S', 'E', 'W']:
        return None
    try:
        value = sum(float(v)/div for v,div in zip(values,[1,60,3600]))
        value *= -1 if ref in ['S','W'] else 1
        if not math.isfinite(value) or abs(value) > (90 if ref in ['N','S'] else 180):
            return None
        return value
    except (ValueError, TypeError, ZeroDivisionError):
        return None


def read_photo(path):
    with Image.open(path) as image:
        exif = image.getexif()
        camera = dict(exif)
        warnings = []
        try:
            camera.update(exif.get_ifd(34665))
        except (KeyError, TypeError, ValueError, SyntaxError) as exc:
            warnings.append('Cannot decode Exif IFD: ' + str(exc))
        try:
            gps = exif.get_ifd(34853)
        except (KeyError, TypeError, ValueError, SyntaxError) as exc:
            gps = {}
            warnings.append('Cannot decode GPS IFD: ' + str(exc))
        wanted = [271,272,274,306,33434,33437,34855,36867,36868,36880,36881,37521,
                  37386,41988,41989,42036]
        tags = {ExifTags.TAGS.get(k,str(k)):scalar(camera[k]) for k in wanted if k in camera}
        named_gps = {ExifTags.GPSTAGS.get(k,str(k)):scalar(v) for k,v in gps.items()}
        latitude = decimal(gps.get(2), scalar(gps.get(1)))
        longitude = decimal(gps.get(4), scalar(gps.get(3)))
        return {'file':str(Path(path).resolve()), 'dimensions':list(image.size), 'exif':tags,
                'gps':named_gps, 'latitude_deg':latitude, 'longitude_deg':longitude,
                'gps_pair_present':latitude is not None and longitude is not None,
                'gyro_status':'not_decoded; ordinary EXIF orientation is not an IMU attitude record',
                'warnings':warnings}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source')
    parser.add_argument('--out', required=True, help='New JSON file; may contain private location data')
    args = parser.parse_args()
    source, out = Path(args.source), Path(args.out)
    files = [source] if source.is_file() else sorted(p for p in source.iterdir()
              if p.is_file() and p.suffix.lower() in {'.jpg','.jpeg','.png','.tif','.tiff'})
    if not files:
        raise ValueError('No supported images')
    rows = [read_photo(p) for p in files]
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open('x',encoding='utf-8') as f:
        json.dump({'scope':'Private local metadata, not georeferencing or gyro extraction', 'photos':rows},
                  f,ensure_ascii=False,indent=2)
    print(f'{len(rows)} photos; {sum(r["gps_pair_present"] for r in rows)} with GPS. Saved locally: {out}')


if __name__ == '__main__':
    main()
