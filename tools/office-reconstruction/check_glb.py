"""Small GLB inspection aid, not a full Khronos validator. Python stdlib only."""
import argparse
import json
import struct
from pathlib import Path


def inspect(path):
    raw = Path(path).read_bytes()
    if len(raw) < 20:
        raise ValueError('File is too short for GLB')
    magic, version, size = struct.unpack_from('<4sII', raw)
    if magic != b'glTF' or version != 2 or size != len(raw):
        raise ValueError('Invalid GLB 2.0 header or file length')
    offset = 12
    doc = None
    binary_bytes = 0
    while offset < size:
        if offset + 8 > size:
            raise ValueError('Truncated chunk header')
        length, kind = struct.unpack_from('<II', raw, offset)
        offset += 8
        if length % 4 or offset + length > size:
            raise ValueError('Invalid chunk size')
        chunk = raw[offset:offset + length]
        if kind == 0x4E4F534A:
            if doc is not None:
                raise ValueError('Duplicate JSON chunk')
            doc = json.loads(chunk)
        elif kind == 0x004E4942:
            binary_bytes += length
        offset += length
    if doc is None:
        raise ValueError('Missing JSON chunk')
    primitives = [p for m in doc.get('meshes', []) for p in m.get('primitives', [])]
    triangles = 0
    points = 0
    textured_primitives = 0
    for p in primitives:
        accessors = doc.get('accessors', [])
        index = p.get('indices', p.get('attributes', {}).get('POSITION'))
        count = accessors[index]['count'] if index is not None else 0
        mode = p.get('mode', 4)
        if mode == 4:
            triangles += count // 3
        elif mode in (5, 6):
            triangles += max(0, count - 2)
        elif mode == 0:
            points += count
        mi = p.get('material')
        if mi is not None:
            material = doc['materials'][mi]
            if material.get('pbrMetallicRoughness', {}).get('baseColorTexture') is not None:
                textured_primitives += 1
    external = [x['uri'] for key in ('buffers', 'images') for x in doc.get(key, [])
                if 'uri' in x and not x['uri'].startswith('data:')]
    return {
        'file': str(Path(path).resolve()), 'bytes': size,
        'mesh_definitions': len(doc.get('meshes', [])),
        'triangles_in_mesh_definitions': triangles, 'points': points,
        'base_color_textured_primitives': textured_primitives,
        'images': len(doc.get('images', [])), 'binary_chunk_bytes': binary_bytes,
        'external_resources': external,
        'extensions_required': doc.get('extensionsRequired', []),
        'note': 'Counts are mesh definitions, not scene instances; geometry accuracy, UV quality, collision and scale require separate checks.'
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file')
    parser.add_argument('--require-texture', action='store_true')
    args = parser.parse_args()
    result = inspect(args.file)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if result['triangles_in_mesh_definitions'] == 0:
        raise SystemExit('FAILED: no triangle mesh; this may be a point-cloud GLB.')
    if result['external_resources']:
        raise SystemExit('FAILED: external resources found; package is not self-contained.')
    if args.require_texture and not result['base_color_textured_primitives']:
        raise SystemExit('FAILED: no base-color texture assigned to a mesh primitive.')
