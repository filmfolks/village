import numpy as np, json
from scipy.io import wavfile
import subprocess, os

SR = 22050
x = np.fromfile('data/audio_raw.f32', dtype='<f4').astype(np.float64)
n = len(x); dur = n/SR
print("duration", dur)

# --- Onset strength via spectral flux ---
hop = 512; win = 2048
frames = 1 + (n - win)//hop
X = np.lib.stride_tricks.sliding_window_view(x, win)[::hop]
w = np.hanning(win)
S = np.abs(np.fft.rfft(X*w, axis=1))
flux = np.maximum(0, S[1:] - S[:-1]).sum(axis=1)
flux = flux / (flux.max()+1e-9)

# smooth
k = np.ones(3)/3
fl_s = np.convolve(flux, k, mode='same')

# peak-pick onsets with min gap 0.12s
times = (np.arange(len(fl_s))+1)*hop/SR
onsets = []
min_gap = int(0.12*SR/hop)
i = 2
last = -min_gap
thr = 0.12
peaks = []
for i in range(1, len(fl_s)-1):
    if fl_s[i] > fl_s[i-1] and fl_s[i] >= fl_s[i+1] and fl_s[i] > thr and i-last >= min_gap:
        peaks.append(round(float(times[i]),3)); last = i
print("num onsets", len(peaks))

# --- Energy envelope at 50 fps (band energies) ---
fps = 50; step = SR//fps
nf = n//step
freqs = np.fft.rfftfreq(win, 1/SR)
bands = [(20,150,'bass'),(150,500,'mid'),(500,2000,'high'),(2000,8000,'air')]
env = {name: [] for _,_,name in bands}
rms_all = []
for f in range(nf):
    seg = x[f*step:(f+1)*step]
    if len(seg) < step: seg = np.pad(seg,(0,step-len(seg)))
    m = seg * np.hanning(len(seg))
    P = np.abs(np.fft.rfft(m, 1024))**2
    fr = np.fft.rfftfreq(1024, 1/SR)
    for lo,hi,name in bands:
        e = P[(fr>=lo)&(fr<hi)].sum()
        env[name].append(e)
    rms_all.append(np.sqrt((seg**2).mean()))
def norm(a):
    a=np.array(a); 
    # percentile normalize
    p95=np.percentile(a,95)+1e-9
    return np.clip(a/p95,0,1.5)
out = {'sr':SR,'fps':fps,
       'bass':[round(float(v),3) for v in norm(env['bass'])],
       'mid':[round(float(v),3) for v in norm(env['mid'])],
       'high':[round(float(v),3) for v in norm(env['high'])],
       'air':[round(float(v),3) for v in norm(env['air'])],
       'rms':[round(float(v),3) for v in norm(rms_all)],
       'onsets':peaks}
json.dump(out, open('data/analysis.json','w'))
print("saved. bass[:20]", out['bass'][:20])
