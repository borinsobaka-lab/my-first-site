import { useState, useRef, useCallback } from 'react';

interface UseAudioRecorderReturn {
  isRecording: boolean;
  audioBlob: Blob | null;
  error: string | null;
  startRecording: (deviceId?: string) => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  clearRecording: () => void;
}

// Store the mimeType globally so it's consistent across recordings
let selectedMimeType: string | null = null;

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeTypeRef = useRef<string>('audio/webm');

  // Cleanup function to release all resources
  const cleanup = useCallback(() => {
    // Stop and release the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });
      streamRef.current = null;
    }

    // Clear the media recorder
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {
          // Ignore
        }
      }
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.onerror = null;
      mediaRecorderRef.current = null;
    }

    // Clear chunks
    chunksRef.current = [];
  }, []);

  const startRecording = useCallback(async (deviceId?: string) => {
    try {
      // Full cleanup before starting new recording
      cleanup();

      setError(null);
      setAudioBlob(null);

      // Request microphone access with fresh stream
      const constraints: MediaStreamConstraints = {
        audio: deviceId
          ? { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true }
          : { echoCancellation: true, noiseSuppression: true },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Determine the best supported MIME type (use cached if available)
      if (!selectedMimeType) {
        selectedMimeType = getSupportedMimeType();
      }
      mimeTypeRef.current = selectedMimeType;

      // Create fresh MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Handle errors
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('Recording error occurred');
        setIsRecording(false);
        cleanup();
      };

      // Start recording - collect data every 250ms for better chunk reliability
      mediaRecorder.start(250);
      setIsRecording(true);

      console.log('Recording started with MIME type:', selectedMimeType);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      console.error('Failed to start recording:', err);
      setError(errorMessage);
      setIsRecording(false);
      cleanup();
    }
  }, [cleanup]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;

      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        setIsRecording(false);
        cleanup();
        resolve(null);
        return;
      }

      // Request final data before stopping
      try {
        mediaRecorder.requestData();
      } catch (e) {
        // Ignore - not all browsers support this
      }

      mediaRecorder.onstop = () => {
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => {
            track.stop();
            track.enabled = false;
          });
          streamRef.current = null;
        }

        // Use the saved mimeType, not from mediaRecorder (which might be undefined)
        const mimeType = mimeTypeRef.current || 'audio/webm';

        // Create blob from chunks
        const chunks = [...chunksRef.current]; // Copy chunks

        if (chunks.length === 0) {
          console.error('No audio chunks recorded');
          setIsRecording(false);
          cleanup();
          resolve(null);
          return;
        }

        const blob = new Blob(chunks, { type: mimeType });

        setAudioBlob(blob);
        setIsRecording(false);

        const sizeKB = (blob.size / 1024).toFixed(1);
        console.log(`Recording stopped: ${chunks.length} chunks, ${sizeKB} KB, mimeType: "${mimeType}"`);

        // Warn if recording seems too small
        if (blob.size < 1000) {
          console.warn(`Warning: Recording is very small (${sizeKB} KB), might be corrupt`);
        }

        // Clear refs after blob is created
        chunksRef.current = [];
        mediaRecorderRef.current = null;

        resolve(blob);
      };

      mediaRecorder.stop();
    });
  }, [cleanup]);

  const clearRecording = useCallback(() => {
    setAudioBlob(null);
    setError(null);
    cleanup();
  }, [cleanup]);

  return {
    isRecording,
    audioBlob,
    error,
    startRecording,
    stopRecording,
    clearRecording,
  };
}

/**
 * Get the best supported MIME type for audio recording
 */
function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/wav',
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  // Fallback
  return 'audio/webm';
}

/**
 * Get list of available audio input devices
 */
export async function getAudioDevices(): Promise<MediaDeviceInfo[]> {
  try {
    // Request permission first
    await navigator.mediaDevices.getUserMedia({ audio: true });

    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === 'audioinput');
  } catch (err) {
    console.error('Failed to get audio devices:', err);
    return [];
  }
}
