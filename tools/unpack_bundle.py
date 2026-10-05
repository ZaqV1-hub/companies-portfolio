#!/usr/bin/env python3
"""Unpack the "bundled" Companies_Portfolio.html into plain, editable source files.

The bundle stores every resource gzip+base64 in <script type="__bundler/manifest">
and the page itself (JSON string) in <script type="__bundler/template">, then
rebuilds the document at runtime. This script does the same thing offline and
writes the result to an output folder with readable file names.

Usage: python3 tools/unpack_bundle.py original/Companies_Portfolio.html prototype-v1
"""
import base64, gzip, json, os, re, sys

src_path, out = sys.argv[1], sys.argv[2]
src = open(src_path, encoding='utf-8').read()

def block(kind):
    m = re.search(r'<script type="__bundler/%s">(.*?)</script>' % re.escape(kind), src, re.S)
    return json.loads(m.group(1)) if m else None

manifest = block('manifest')
template = block('template')
ext = block('ext_resources') or []

# Friendly names for the known resources.
names = {
    '2d1c7433-8889-475d-a89e-d6ce2109e038': 'vendor/dc-runtime.js',
    'fe233e42-f4fc-4f41-9a0e-6cb93db780b5': 'vendor/react.production.min.js',
    '7c978767-0670-4f5a-8165-01f3ab18b830': 'vendor/react-dom.production.min.js',
    '4a34b2cb-a203-43c0-b07e-35cb6f2f1c6b': 'src/data/portfolio-companies.js',
    '53b56caa-cc55-4fa3-aa30-b7566849277c': 'assets/img/bph-logo.png',
}
# Fonts: name them from the @font-face comment/family/weight that references them.
# Inter is a variable font (one file for every weight); Poppins has one file per weight.
for m in re.finditer(r"/\* ([\w-]+) \*/\s*@font-face \{\s*font-family: '([^']+)';\s*font-style: \w+;\s*font-weight: (\d+);.*?src: url\(\"([0-9a-f-]+)\"\)", template, re.S):
    subset, family, weight, uuid = m.groups()
    names.setdefault(uuid, 'assets/fonts/%s-%s-%s.woff2' % (family.replace(' ', ''), weight, subset))
assert len(set(names.values())) == len(names), 'two resources would share a file name'

for uuid, entry in manifest.items():
    data = base64.b64decode(entry['data'])
    if entry.get('compressed'):
        data = gzip.decompress(data)
    rel = names.get(uuid, 'assets/misc/' + uuid)
    path = os.path.join(out, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'wb').write(data)
    template = template.replace(uuid, rel)

# The runtime looks React up in window.__resources (CDN url -> local file).
resources = {e['id']: names[e['uuid']] for e in ext}
inject = '<script>window.__resources = %s;</script>' % json.dumps(resources)
template = re.sub(r'(<head[^>]*>)', lambda m: m.group(1) + '\n' + inject, template, count=1)
template = re.sub(r'\s+integrity="[^"]*"', '', template)
template = re.sub(r'\s+crossorigin="[^"]*"', '', template)
open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(template)
print('wrote', out, len(manifest), 'resources')
