import { useState, useRef, useCallback, useEffect } from "react";

// WAV Encoding Helpers
function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
    for (let i = 0; i < input.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}

function encodeWAV(samples: Float32Array, sampleRate: number) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // file length
    view.setUint32(4, 36 + samples.length * 2, true);
    // RIFF type
    writeString(view, 8, 'WAVE');
    // format chunk identifier
    writeString(view, 12, 'fmt ');
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (raw)
    view.setUint16(20, 1, true);
    // channel count
    view.setUint16(22, 1, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * 2, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, 2, true);
    // bits per sample
    view.setUint16(34, 16, true);
    // data chunk identifier
    writeString(view, 36, 'data');
    // data chunk length
    view.setUint32(40, samples.length * 2, true);

    floatTo16BitPCM(view, 44, samples);

    return new Blob([view], { type: 'audio/wav' });
}

export function useAudioRecorder(onChunk: (blob: Blob) => void) {
    const [isRecording, setIsRecording] = useState(false);

    // Refs for Audio Context & Processing
    const audioContext = useRef<AudioContext | null>(null);
    const processor = useRef<ScriptProcessorNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Data Buffers
    const audioChunks = useRef<Float32Array[]>([]);
    const totalLength = useRef(0);

    // Silence Detection Refs
    const analyser = useRef<AnalyserNode | null>(null);
    const silenceStart = useRef<number | null>(null);
    const frameId = useRef<number | null>(null);
    const lastChunkTime = useRef<number>(Date.now());

    // Improved Dynamic Noise Floor
    const noiseFloor = useRef<number>(0.02);
    const smoothedVol = useRef<number>(0);
    const hasSpeaking = useRef<boolean>(false);

    // Config
    const SILENCE_DURATION = 1200; // Increased to 1.2s for better sentence completion
    const MAX_CHUNK_DURATION = 60000;

    const cleanup = useCallback(() => {
        if (frameId.current) cancelAnimationFrame(frameId.current);

        if (processor.current) {
            processor.current.disconnect();
            processor.current = null;
        }

        if (audioContext.current) {
            audioContext.current.close();
            audioContext.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
    }, []);

    const processAndFlush = useCallback(() => {
        if (totalLength.current === 0 || !audioContext.current) return;

        // Discard if no speaking activity was detected
        if (!hasSpeaking.current) {
            // Optional: Log discarded chunks (throttled/debug)
            // console.log("Silent chunk discarded");
            audioChunks.current = [];
            totalLength.current = 0;
            return;
        }

        // Merge chunks
        const result = new Float32Array(totalLength.current);
        let offset = 0;
        for (const chunk of audioChunks.current) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        // Encode to WAV
        const wavBlob = encodeWAV(result, audioContext.current.sampleRate);
        console.log("Flushing WAV chunk:", { size: wavBlob.size, durationMs: (totalLength.current / audioContext.current.sampleRate) * 1000 });

        onChunk(wavBlob);

        // Reset
        audioChunks.current = [];
        totalLength.current = 0;
        hasSpeaking.current = false;
    }, [onChunk]);

    const startRecording = useCallback(async () => {
        try {
            cleanup(); // Ensure clean slate
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContextClass();
            audioContext.current = ctx;
            const source = ctx.createMediaStreamSource(stream);

            // 1. Setup Analyser
            const anal = ctx.createAnalyser();
            anal.fftSize = 2048;
            source.connect(anal);
            analyser.current = anal;

            // 2. Setup Recorder
            const proc = ctx.createScriptProcessor(4096, 1, 1);
            proc.onaudioprocess = (e) => {
                if (!isRecording) return; // Guard
                const inputData = e.inputBuffer.getChannelData(0);
                const bufferCopy = new Float32Array(inputData);
                audioChunks.current.push(bufferCopy);
                totalLength.current += bufferCopy.length;
            };

            source.connect(proc);
            proc.connect(ctx.destination);

            processor.current = proc;

            setIsRecording(true);
            lastChunkTime.current = Date.now();
            audioChunks.current = [];
            totalLength.current = 0;
            hasSpeaking.current = false;

            // Initial Calibration
            noiseFloor.current = 0.02;
            smoothedVol.current = 0;

            // 3. Loop
            const bufferLength = anal.fftSize;
            const dataArray = new Float32Array(bufferLength);
            let frameCount = 0;

            const checkSilence = () => {
                if (!analyser.current || !audioContext.current) return;

                analyser.current.getFloatTimeDomainData(dataArray);

                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i] * dataArray[i];
                }
                const rms = Math.sqrt(sum / bufferLength);

                // Smoothing (Low-pass filter)
                smoothedVol.current = (smoothedVol.current * 0.95) + (rms * 0.05);
                const vol = smoothedVol.current;

                // Adaptive Noise Floor
                // If current volume is LOWER than floor, lower the floor immediately (found new quiet)
                if (vol < noiseFloor.current) {
                    noiseFloor.current = vol;
                } else {
                    // Otherwise drift up slowly (adapt to changing environment)
                    noiseFloor.current += 0.00002;
                }

                // Thresholds relative to floor
                // Speech must be significantly above floor
                const speechThreshold = noiseFloor.current + 0.01;
                const silenceThreshold = noiseFloor.current + 0.005;

                if (vol > speechThreshold) {
                    hasSpeaking.current = true;
                }

                // Debug Log every ~1s (60 frames)
                frameCount++;
                if (frameCount % 60 === 0) {
                    console.log(`Audio Stats | RMS: ${rms.toFixed(4)} | Smooth: ${vol.toFixed(4)} | Floor: ${noiseFloor.current.toFixed(4)} | Speech?: ${hasSpeaking.current}`);
                }

                const now = Date.now();
                const isSilent = vol < silenceThreshold;

                if (isSilent) {
                    if (!silenceStart.current) {
                        silenceStart.current = now;
                    } else {
                        const silenceDuration = now - silenceStart.current;
                        const chunkDuration = now - lastChunkTime.current;

                        if (silenceDuration > SILENCE_DURATION && chunkDuration > 1000) {
                            if (hasSpeaking.current) {
                                console.log("Silence detected, flushing speech chunk...");
                            }
                            processAndFlush();
                            lastChunkTime.current = now;
                            silenceStart.current = null;
                        }
                    }
                } else {
                    silenceStart.current = null;
                }

                if (now - lastChunkTime.current > MAX_CHUNK_DURATION) {
                    processAndFlush();
                    lastChunkTime.current = now;
                }

                frameId.current = requestAnimationFrame(checkSilence);
            };

            frameId.current = requestAnimationFrame(checkSilence);

        } catch (err) {
            console.error("Failed to start recording", err);
            cleanup();
            setIsRecording(false);
        }
    }, [cleanup, processAndFlush, isRecording]);

    const stopRecording = useCallback(() => {
        processAndFlush();
        setIsRecording(false);
        cleanup();
    }, [cleanup, processAndFlush]);

    useEffect(() => {
        return () => cleanup();
    }, [cleanup]);

    return { isRecording, startRecording, stopRecording };
}
