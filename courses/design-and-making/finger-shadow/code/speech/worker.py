"""Local, memory-only PCM assessment. NDJSON on stdout; models never see the script."""
import base64
import json
import os
from pathlib import Path
import re
import sys
import time
import numpy as np
from assessment import audio_quality, transcript_score, phone_score, words

ROOT = Path(__file__).resolve().parents[1]
ASR_DIR = Path(os.environ.get('SHADOW_SENSEVOICE_MODEL',
    ROOT/'.models-speech/sensevoice-small'))
PHONE_DIR = Path(os.environ.get('SHADOW_PHONE_MODEL', ROOT/'.models-speech/english-phones'))

class Engines:
    def __init__(self):
        self.asr = self.phone = self.processor = self.dictionary = None

    def status(self):
        return {'asr': (ASR_DIR/'model.onnx').is_file() and (ASR_DIR/'tokens.json').is_file(),
                'phones': (PHONE_DIR/'model.safetensors').is_file(), 'asrLoaded': self.asr is not None,
                'phonesLoaded': self.phone is not None, 'local': True,
                'engine': 'SenseVoice Small / ONNX CPU', 'phoneEngine': 'Wav2Vec2 / TIMIT phonemes',
                'calibrated': False}

    def transcribe(self, audio):
        import torch
        import torchaudio
        import onnxruntime as ort
        torch.set_num_threads(4)
        if self.asr is None:
            options = ort.SessionOptions(); options.intra_op_num_threads = 4; options.inter_op_num_threads = 1
            self.asr = ort.InferenceSession(str(ASR_DIR/'model.onnx'), options, providers=['CPUExecutionProvider'])
            self.vocab = json.loads((ASR_DIR/'tokens.json').read_text(encoding='utf-8'))
        # Official FunASR WavFrontend convention: 16 kHz, Kaldi fbank, left-padded LFR 7/6.
        mel = torchaudio.compliance.kaldi.fbank(torch.from_numpy(audio[None]*32768),
            num_mel_bins=80, frame_length=25, frame_shift=10, dither=0, energy_floor=0,
            window_type='hamming', sample_frequency=16000).numpy()
        padded = np.pad(mel, ((3, 6), (0, 0)), mode='edge')
        features = np.stack([padded[t:t+7].reshape(-1) for t in range(0, len(mel), 6)])[None].astype(np.float32)
        outputs = self.asr.run(None, {'speech': features,
            'speech_lengths': np.array([features.shape[1]], dtype=np.int32),
            'language': np.array([4], dtype=np.int32), 'textnorm': np.array([0], dtype=np.int32)})
        logits = next(a for a in outputs if a.ndim == 3 and a.shape[-1] == len(self.vocab))
        seq = logits[0].argmax(-1); ids = seq[np.r_[True, seq[1:] != seq[:-1]]]
        raw = ''.join(self.vocab[i] for i in ids if i != 0).replace('▁', ' ')
        return re.sub(r'<[^>]*>', '', raw).strip(), '<|Speech|>' in raw

    def acoustic_phones(self, audio):
        import torch
        if self.phone is None:
            from transformers import Wav2Vec2Processor, Wav2Vec2ForCTC
            import cmudict
            torch.set_num_threads(4)
            self.processor = Wav2Vec2Processor.from_pretrained(str(PHONE_DIR), local_files_only=True)
            self.phone = Wav2Vec2ForCTC.from_pretrained(str(PHONE_DIR), local_files_only=True, use_safetensors=True).eval()
            self.dictionary = cmudict.dict()
        inputs = self.processor(audio, sampling_rate=16000, return_tensors='pt')
        with torch.inference_mode(): seq = self.phone(**inputs).logits[0].argmax(-1).tolist()
        collapsed = [v for i, v in enumerate(seq) if i == 0 or v != seq[i-1]]
        tokens = self.processor.tokenizer.convert_ids_to_tokens(collapsed)
        return [p for p in tokens if p not in ['[PAD]', '[UNK]', '<pad>', '|', ' ']]

    def assess(self, request):
        started = time.monotonic()
        reference = request.get('reference')
        if not isinstance(reference, str) or not 1 <= len(reference) <= 400:
            raise ValueError('台词长度不正确。')
        if request.get('sampleRate') != 16000: raise ValueError('录音需要 16 kHz 单声道 PCM16。')
        encoded = request.get('pcm', '')
        if not isinstance(encoded, str) or len(encoded) > 1066672: raise ValueError('录音太长。')
        raw = base64.b64decode(encoded, validate=True)
        if len(raw) % 2: raise ValueError('录音格式不正确。')
        audio = np.frombuffer(raw, dtype='<i2').astype(np.float32)/32768
        quality = audio_quality(audio)
        if not quality['usable']:
            return {'quality': quality, 'transcript': '', 'content': None, 'pronunciation': None}
        audio = audio[quality.pop('start'):quality.pop('end')].copy()
        transcript, speech = self.transcribe(audio)
        if not transcript or not speech:
            quality.update(usable=False, message='没有识别到清楚的英语，请一位同学读一句，先关掉配乐。')
            return {'quality': quality, 'transcript': transcript, 'content': None, 'pronunciation': None}
        content = transcript_score(reference, transcript)
        if request.get('command') == 'transcribe':
            return {'quality': quality, 'transcript': transcript, 'content': content, 'pronunciation': None}
        pronunciation = {'score': None, 'reason': '音素模型尚未准备好；本次只核对台词。', 'words': []}
        if self.status()['phones']:
            try:
                phones = self.acoustic_phones(audio)
                phone_reference = reference
                if request.get('command') == 'preview':
                    reached = [w['index']+1 for w in content['words'] if w['kind'] == 'match']
                    phone_reference = ' '.join(words(reference)[:max(reached, default=0)])
                pronunciation = phone_score(phone_reference, phones, self.dictionary) if phones and phone_reference else {
                    'score': None, 'reason': '没有识别到足够的音素，请回听录音。', 'words': []}
            except Exception as error:
                print('Phoneme inference failed: '+str(error), file=sys.stderr, flush=True)
                pronunciation = {'score': None, 'reason': '音素评估暂时不可用；台词核对结果仍可查看。', 'words': []}
        return {'quality': quality, 'transcript': transcript, 'content': content, 'pronunciation': pronunciation,
                'engine': self.status(), 'elapsedMs': round((time.monotonic()-started)*1000)}

if __name__ == '__main__':
    engine = Engines()
    print(json.dumps({'ready': True}), flush=True)
    for line in sys.stdin:
        data = {}
        try:
            if len(line) > 1100000: raise ValueError('输入太长。')
            data = json.loads(line)
            if data.get('command') == 'status': result = engine.status()
            elif data.get('command') == 'prepare':
                engine.transcribe(np.zeros(16000, dtype=np.float32))
                if engine.status()['phones']: engine.acoustic_phones(np.zeros(16000, dtype=np.float32))
                result = engine.status()
            else: result = engine.assess(data)
            print(json.dumps({'id': data.get('id'), 'result': result}, ensure_ascii=False), flush=True)
        except Exception as error:
            print(str(error), file=sys.stderr, flush=True)
            print(json.dumps({'id': data.get('id'), 'error': '语音处理未完成，请检查本机模型或重录。'}, ensure_ascii=False), flush=True)
        finally:
            data.clear()
