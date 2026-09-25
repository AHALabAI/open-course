"""Embed sibling PNG/JPEG image resources in an OpenMVS GLB; preserve geometry bytes and originals."""
import argparse
import base64
import json
from pathlib import Path
import struct
from urllib.parse import unquote, urlsplit


def pack(source, destination):
    source, destination = Path(source).resolve(), Path(destination).resolve()
    if destination.exists():
        raise FileExistsError(destination)
    raw = source.read_bytes()
    if len(raw) < 20 or struct.unpack_from('<4sII', raw) != (b'glTF', 2, len(raw)):
        raise ValueError('Invalid GLB header')
    chunks = []
    offset = 12
    while offset < len(raw):
        if offset + 8 > len(raw):
            raise ValueError('Truncated GLB chunk header')
        length, kind = struct.unpack_from('<II', raw, offset)
        offset += 8
        if length % 4 or offset + length > len(raw):
            raise ValueError('Invalid GLB chunk')
        chunks.append((kind, raw[offset:offset+length]))
        offset += length
    if [x[0] for x in chunks] != [0x4E4F534A, 0x004E4942]:
        raise ValueError('Expected one JSON chunk followed by one BIN chunk')
    doc = json.loads(chunks[0][1])
    buffers = doc.get('buffers', [])
    if not buffers or 'uri' in buffers[0]:
        raise ValueError('Buffer 0 must use the GLB binary chunk')
    if not 0 <= len(chunks[1][1]) - buffers[0]['byteLength'] <= 3:
        raise ValueError('BIN chunk length does not match buffer 0')
    binary = bytearray(chunks[1][1])
    offsets = [0]
    # OpenMVS emits additional texture-atlas geometry in base64 buffers.
    # Merge every buffer and remap views, retaining the exact accessor bytes.
    for buffer in buffers[1:]:
        uri = buffer.get('uri', '')
        prefix, separator, encoded_buffer = uri.partition(',')
        if separator != ',' or prefix not in ('data:application/octet-stream;base64',
                                              'data:application/gltf-buffer;base64'):
            raise ValueError('Additional geometry buffers must be base64 data URIs')
        payload = base64.b64decode(encoded_buffer, validate=True)
        if len(payload) != buffer['byteLength']:
            raise ValueError('Additional buffer length mismatch')
        binary.extend(b'\x00' * (-len(binary) % 4))
        offsets.append(len(binary))
        binary.extend(payload)
    for view in doc.get('bufferViews', []):
        index = view['buffer']
        offset = view.get('byteOffset', 0)
        if not 0 <= index < len(buffers) or offset < 0 or view['byteLength'] < 0 or offset + view['byteLength'] > buffers[index]['byteLength']:
            raise ValueError('Buffer view outside declared buffer')
        view['byteOffset'] = offsets[index] + offset
        view['buffer'] = 0
    doc['buffers'] = [{'byteLength': 0}]
    count = 0
    for img in doc.get('images', []):
        uri = img.get('uri')
        if not uri or uri.startswith('data:'):
            continue
        parsed = urlsplit(uri)
        if parsed.scheme or parsed.netloc or parsed.query or parsed.fragment:
            raise ValueError('Only local image paths are supported')
        image_path = (source.parent / unquote(parsed.path)).resolve()
        if not image_path.is_relative_to(source.parent):
            raise ValueError('Texture path escapes source directory')
        image_bytes = image_path.read_bytes()
        if image_bytes.startswith(b'\x89PNG\r\n\x1a\n'):
            mime = 'image/png'
        elif image_bytes.startswith(b'\xff\xd8\xff'):
            mime = 'image/jpeg'
        else:
            raise ValueError('Unsupported texture encoding: ' + str(image_path))
        binary.extend(b'\x00' * (-len(binary) % 4))
        view = {'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(image_bytes)}
        binary.extend(image_bytes)
        views = doc.setdefault('bufferViews', [])
        img.pop('uri')
        img['bufferView'] = len(views)
        img['mimeType'] = mime
        views.append(view)
        count += 1
    doc['buffers'][0]['byteLength'] = len(binary)
    binary.extend(b'\x00' * (-len(binary) % 4))
    encoded = json.dumps(doc, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    encoded += b' ' * (-len(encoded) % 4)
    size = 12 + 8 + len(encoded) + 8 + len(binary)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open('xb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, size))
        f.write(struct.pack('<II', len(encoded), 0x4E4F534A))
        f.write(encoded)
        f.write(struct.pack('<II', len(binary), 0x004E4942))
        f.write(binary)
    print(json.dumps({'output':str(destination), 'embedded_images':count, 'bytes':size}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source')
    parser.add_argument('destination')
    args = parser.parse_args()
    pack(args.source, args.destination)
