import re, subprocess, os
c = open('index.html','rb').read().decode('utf-8').replace('\r\n','\n')
blocks = re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', c, re.S)
bad = 0
for i, b in enumerate(blocks):
    if not b.strip(): continue
    p = 'nb_%d.js' % i
    open(p,'w',encoding='utf-8').write(b)
    r = subprocess.run(['node','--check',p], capture_output=True, text=True)
    if r.returncode != 0: bad += 1; print('block',i,'FAIL',r.stderr[:120])
i = 0
while os.path.exists('nb_%d.js' % i):
    try: os.remove('nb_%d.js' % i)
    except OSError: pass
    i += 1
print('inline', len(blocks), 'bad', bad)
