"""Separate transcript matching from experimental acoustic phone matching."""
import re
import numpy as np

def words(text):
    return re.findall(r"[a-z]+(?:'[a-z]+)?", text.lower().replace('’', "'"))

def alignment(expected, actual):
    """Levenshtein alignment. Rows include insertions; nothing silently disappears."""
    d = [[0] * (len(actual) + 1) for _ in range(len(expected) + 1)]
    for i in range(len(expected) + 1): d[i][0] = i
    for j in range(len(actual) + 1): d[0][j] = j
    for i, a in enumerate(expected, 1):
        for j, b in enumerate(actual, 1):
            d[i][j] = min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1]+(a != b))
    rows, i, j = [], len(expected), len(actual)
    while i or j:
        if i and j and d[i][j] == d[i-1][j-1]+(expected[i-1] != actual[j-1]):
            rows.append({'expected': expected[i-1], 'heard': actual[j-1], 'index': i-1,
                         'kind': 'match' if expected[i-1] == actual[j-1] else 'replace'})
            i -= 1; j -= 1
        elif i and d[i][j] == d[i-1][j]+1:
            rows.append({'expected': expected[i-1], 'heard': '', 'index': i-1, 'kind': 'missing'}); i -= 1
        else:
            rows.append({'expected': '', 'heard': actual[j-1], 'index': i, 'kind': 'extra'}); j -= 1
    return d[-1][-1], rows[::-1]

def transcript_score(reference, transcript):
    expected, actual = words(reference), words(transcript)
    edits, rows = alignment(expected, actual)
    return {'score': round(100 * max(0, 1-edits/max(1, len(expected)))), 'edits': edits,
            'expectedWords': len(expected), 'words': rows, 'method': 'word-edit-distance'}

def audio_quality(samples):
    if len(samples) < 6400: return {'usable': False, 'message': '录音太短，请读完一句再停止。'}
    if len(samples) > 16000*25: raise ValueError('每句录音最多 25 秒。')
    if not np.isfinite(samples).all() or np.max(np.abs(samples)) > 1.01: raise ValueError('录音数据不正确。')
    frames = samples[:len(samples)//320*320].reshape(-1, 320)
    energy = np.sqrt(np.mean(frames**2, axis=1))
    active = np.flatnonzero(energy > .008)
    if len(active) < 6:
        return {'usable': False, 'message': '声音太轻或没有录到声音，请靠近麦克风再试。'}
    clipped = float(np.mean(np.abs(samples) > .995))
    return {'usable': clipped < .05, 'message': '声音失真较多，请离麦克风稍远一些。' if clipped >= .05 else '',
            'seconds': round(len(samples)/16000, 2), 'activeSeconds': round(len(active)*.02, 2),
            'clippedFraction': round(clipped, 4), 'start': max(0, int(active[0])*320-2400),
            'end': min(len(samples), (int(active[-1])+1)*320+3200)}

ARPABET = dict(zip(
    'AA AE AH AO AW AY B CH D DH EH ER EY F G HH IH IY JH K L M N NG OW OY P R S SH T TH UH UW V W Y Z ZH'.split(),
    'ɑ æ ə ɑ aʊ aɪ b ʧ d ð ɛ ɝ eɪ f g h ɪ i ʤ k l m n ŋ oʊ ɔɪ p ɹ s ʃ t θ ʊ u v w j z ʃ'.split()))

def expected_phones(reference, dictionary):
    phones, owners, missing = [], [], []
    for index, word in enumerate(words(reference)):
        pronunciations = dictionary.get(word)
        if not pronunciations:
            missing.append(word); continue
        for token in pronunciations[0]:
            phone = ARPABET.get(re.sub(r'\d', '', token))
            if phone is None: missing.append(word); break
            phones.append(phone); owners.append(index)
    return phones, owners, sorted(set(missing))

def phone_score(reference, actual, dictionary):
    expected, owners, missing = expected_phones(reference, dictionary)
    if missing or not expected:
        return {'score': None, 'reason': '这些词还没有读音资料：'+', '.join(missing), 'words': []}
    # A pronunciation lattice keeps CMU-listed alternatives (including weak forms).
    # These alternatives are chosen BEFORE looking at audio, not invented to lift scores.
    vocab = words(reference)
    nodes = [(None, 0, [])]; ends = [0]
    for owner, word in enumerate(vocab):
        next_ends = []
        variants = {tuple(ARPABET[re.sub(r'\d', '', token)] for token in variant) for variant in dictionary[word]}
        for variant in sorted(variants):
            previous = ends
            for phone in variant:
                nodes.append((phone, owner, previous)); previous = [len(nodes)-1]
            next_ends.extend(previous)
        ends = next_ends
    width = len(actual)+1
    costs = [list(range(width))]; back = [[None]*width]
    for node, (phone, owner, predecessors) in enumerate(nodes[1:], 1):
        row, steps = [], []
        for j in range(width):
            options = [(costs[p][j]+1, p, j, 'missing') for p in predecessors]
            if j:
                same = phone == actual[j-1] or (actual[j-1] == 'ɾ' and phone in ['t','d'])
                options.extend((costs[p][j-1]+(not same), p, j-1, 'match' if same else 'replace') for p in predecessors)
                options.append((row[j-1]+1, node, j-1, 'extra'))
            best = min(options, key=lambda item:(item[0], item[3]!='match', item[3]=='extra'))
            row.append(best[0]); steps.append(best[1:])
        costs.append(row); back.append(steps)
    node = min(ends, key=lambda i:costs[i][-1]); edits=costs[node][-1]; j=len(actual); rows=[]
    while node:
        prev, previous_j, kind = back[node][j]
        phone, owner, _ = nodes[node]
        rows.append({'expected': '' if kind=='extra' else phone, 'heard': actual[j-1] if j>previous_j else '', 'owner': owner, 'kind': kind})
        node, j = prev, previous_j
    while j:
        rows.append({'expected':'', 'heard':actual[j-1], 'owner':0, 'kind':'extra'});j-=1
    rows.reverse(); expected=[r['expected'] for r in rows if r['expected']];owners=[r['owner'] for r in rows if r['expected']]
    result = []
    for i, word in enumerate(words(reference)):
        group = [r for r in rows if r['owner'] == i]
        count = owners.count(i)
        errors = sum(r['kind'] != 'match' for r in group)
        result.append({'word': word, 'score': round(100 * max(0, 1-errors/max(1, count))),
                       'expected': ''.join(p for p, owner in zip(expected, owners) if owner == i),
                       'heard': ''.join(r['heard'] for r in group)})
    return {'score': round(100 * max(0, 1-edits/len(expected))), 'words': result,
            'method': 'unprompted-phone-lexicon-lattice-v1', 'calibrated': False,
            'expected': ' '.join(expected), 'heard': ' '.join(actual),
            'note': '音素序列相似度；未用儿童语音校准，不是标准发音准确率。弱读、连读和口音可能被误判，请回听并由教师确认。'}
