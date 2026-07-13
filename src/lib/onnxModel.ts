import * as ort from 'onnxruntime-web';
import { supabase } from '@/integrations/supabase/client';

// Configure ONNX Runtime — point to the CDN base for the EXACT installed
// version so the loader fetches matching .wasm/.mjs files. Mismatched
// versions or 404s (which return HTML) cause the
// "expected magic word 00 61 73 6d, found 3c 21 64 6f" error.
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/';

let hidingSession: ort.InferenceSession | null = null;
let revealSession: ort.InferenceSession | null = null;
let isLoadingDefaults = false;
let defaultModelsChecked = false;

const IMG_SIZE = 256;
const DEFAULT_HIDING_MODEL = 'encryption_net.onnx';
const DEFAULT_REVEAL_MODEL = 'decryption_net.onnx';

// --------------------------------------------------------------------------
// Deterministic helpers (KEY + shuffle indices) — match between encode/decode
// --------------------------------------------------------------------------
const SEED = 42;

// Mulberry32 PRNG seeded deterministically (browser-stable, not numpy-compat)
const makeRng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

let CACHED_KEY: Uint8Array | null = null;
let CACHED_SHUFFLE_IDX: Int32Array | null = null;
let CACHED_UNSHUFFLE_IDX: Int32Array | null = null;

const getKey = (): Uint8Array => {
  if (CACHED_KEY) return CACHED_KEY;
  const rng = makeRng(SEED);
  const key = new Uint8Array(IMG_SIZE * IMG_SIZE * 3);
  for (let i = 0; i < key.length; i++) key[i] = Math.floor(rng() * 256);
  CACHED_KEY = key;
  return key;
};

const getShuffleIndices = (): { idx: Int32Array; inv: Int32Array } => {
  if (CACHED_SHUFFLE_IDX && CACHED_UNSHUFFLE_IDX) {
    return { idx: CACHED_SHUFFLE_IDX, inv: CACHED_UNSHUFFLE_IDX };
  }
  const n = IMG_SIZE * IMG_SIZE;
  const idx = new Int32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  const rng = makeRng(SEED + 1);
  // Fisher-Yates
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
  }
  const inv = new Int32Array(n);
  for (let i = 0; i < n; i++) inv[idx[i]] = i;
  CACHED_SHUFFLE_IDX = idx;
  CACHED_UNSHUFFLE_IDX = inv;
  return { idx, inv };
};

const shufflePixels = (rgb: Uint8Array): Uint8Array => {
  const { idx } = getShuffleIndices();
  const out = new Uint8Array(rgb.length);
  for (let i = 0; i < idx.length; i++) {
    const src = idx[i] * 3;
    const dst = i * 3;
    out[dst] = rgb[src];
    out[dst + 1] = rgb[src + 1];
    out[dst + 2] = rgb[src + 2];
  }
  return out;
};

const unshufflePixels = (rgb: Uint8Array): Uint8Array => {
  const { idx } = getShuffleIndices();
  const out = new Uint8Array(rgb.length);
  for (let i = 0; i < idx.length; i++) {
    const src = i * 3;
    const dst = idx[i] * 3;
    out[dst] = rgb[src];
    out[dst + 1] = rgb[src + 1];
    out[dst + 2] = rgb[src + 2];
  }
  return out;
};

const xorKey = (rgb: Uint8Array): Uint8Array => {
  const key = getKey();
  const out = new Uint8Array(rgb.length);
  for (let i = 0; i < rgb.length; i++) out[i] = rgb[i] ^ key[i];
  return out;
};

const sha256Hex = async (text: string): Promise<string> => {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

// Generate a cryptographically strong password (alphanumeric + symbols)
const generatePassword = (length: number = 16): string => {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) out += charset[bytes[i] % charset.length];
  return out;
};

const END_MARKER = '1111111111111110';

const embedTextLSB = (rgb: Uint8Array, text: string): Uint8Array => {
  let bits = '';
  for (const ch of text) bits += ch.charCodeAt(0).toString(2).padStart(8, '0');
  bits += END_MARKER;
  if (bits.length > rgb.length) {
    throw new Error(`Payload too large: ${bits.length} bits > ${rgb.length} bytes`);
  }
  const out = new Uint8Array(rgb);
  for (let i = 0; i < bits.length; i++) {
    out[i] = (out[i] & 0xFE) | (bits.charCodeAt(i) - 48);
  }
  return out;
};

const extractTextLSB = (rgb: Uint8Array): string => {
  let bits = '';
  let chars = '';
  for (let i = 0; i < rgb.length; i++) {
    bits += (rgb[i] & 1).toString();
    if (bits.length >= 16 && bits.endsWith(END_MARKER)) {
      const payload = bits.slice(0, -16);
      for (let j = 0; j < payload.length; j += 8) {
        const byte = payload.slice(j, j + 8);
        if (byte.length < 8) break;
        chars += String.fromCharCode(parseInt(byte, 2));
      }
      return chars;
    }
  }
  return '';
};

// Load models from ArrayBuffer
const loadModelsFromBuffers = async (
  hidingBuffer: ArrayBuffer,
  revealBuffer: ArrayBuffer
): Promise<{ success: boolean; error?: string }> => {
  try {
    hidingSession = await ort.InferenceSession.create(hidingBuffer, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    });
    
    revealSession = await ort.InferenceSession.create(revealBuffer, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    });
    ort.env.wasm.proxy = false;
    
    console.log('ONNX Models loaded successfully!');
    console.log('HidingNet inputs:', hidingSession.inputNames);
    console.log('RevealNet inputs:', revealSession.inputNames);
    
    return { success: true };
  } catch (error) {
    console.error('Failed to load ONNX models:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error loading models'
    };
  }
};

// Load models from uploaded files
export const loadModelsFromFiles = async (
  hidingFile: File,
  revealFile: File
): Promise<{ success: boolean; error?: string }> => {
  const hidingBuffer = await hidingFile.arrayBuffer();
  const revealBuffer = await revealFile.arrayBuffer();
  return loadModelsFromBuffers(hidingBuffer, revealBuffer);
};

// Upload models to storage as defaults
export const uploadDefaultModels = async (
  hidingFile: File,
  revealFile: File
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Upload hiding model
    const { error: hidingError } = await supabase.storage
      .from('onnx-models')
      .upload(DEFAULT_HIDING_MODEL, hidingFile, { 
        upsert: true,
        contentType: 'application/octet-stream'
      });
    
    if (hidingError) throw hidingError;

    // Upload reveal model
    const { error: revealError } = await supabase.storage
      .from('onnx-models')
      .upload(DEFAULT_REVEAL_MODEL, revealFile, { 
        upsert: true,
        contentType: 'application/octet-stream'
      });
    
    if (revealError) throw revealError;

    console.log('Default models uploaded successfully!');
    return { success: true };
  } catch (error) {
    console.error('Failed to upload default models:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error uploading models'
    };
  }
};

// Load default models from storage
export const loadDefaultModels = async (): Promise<{ success: boolean; error?: string }> => {
  if (isLoadingDefaults) {
    return { success: false, error: 'Already loading models' };
  }
  
  if (areModelsLoaded()) {
    return { success: true };
  }

  isLoadingDefaults = true;
  
  try {
    // Get public URLs for models
    const { data: hidingData } = supabase.storage
      .from('onnx-models')
      .getPublicUrl(DEFAULT_HIDING_MODEL);
    
    const { data: revealData } = supabase.storage
      .from('onnx-models')
      .getPublicUrl(DEFAULT_REVEAL_MODEL);

    // Fetch model files
    const [hidingResponse, revealResponse] = await Promise.all([
      fetch(hidingData.publicUrl),
      fetch(revealData.publicUrl)
    ]);

    if (!hidingResponse.ok || !revealResponse.ok) {
      defaultModelsChecked = true;
      isLoadingDefaults = false;
      return { 
        success: false, 
        error: 'Default models not found in storage' 
      };
    }

    const [hidingBuffer, revealBuffer] = await Promise.all([
      hidingResponse.arrayBuffer(),
      revealResponse.arrayBuffer()
    ]);

    const result = await loadModelsFromBuffers(hidingBuffer, revealBuffer);
    defaultModelsChecked = true;
    isLoadingDefaults = false;
    return result;
  } catch (error) {
    console.error('Failed to load default models:', error);
    defaultModelsChecked = true;
    isLoadingDefaults = false;
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error loading default models'
    };
  }
};

// Check if models are loaded
export const areModelsLoaded = (): boolean => {
  return hidingSession !== null && revealSession !== null;
};

// Check if default models check has been performed
export const hasCheckedDefaultModels = (): boolean => {
  return defaultModelsChecked;
};

// Check if currently loading defaults
export const isLoadingDefaultModels = (): boolean => {
  return isLoadingDefaults;
};

// Kept for backward-compatible imports — no longer used by the neural pipeline.
export const textToTensor = (text: string, _size: number = IMG_SIZE): Float32Array =>
  new Float32Array(_size * _size);
export const tensorToText = (_tensor: Float32Array): string => '';

// Convert ImageData to ONNX tensor (NCHW format: [1, 3, H, W])
const imageDataToTensor = (imageData: ImageData): Float32Array => {
  const { width, height, data } = imageData;
  const tensor = new Float32Array(3 * height * width);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIdx = (y * width + x) * 4;
      const tensorIdx = y * width + x;
      
      // Normalize to [0, 1] and arrange as CHW
      tensor[0 * height * width + tensorIdx] = data[pixelIdx] / 255;     // R
      tensor[1 * height * width + tensorIdx] = data[pixelIdx + 1] / 255; // G
      tensor[2 * height * width + tensorIdx] = data[pixelIdx + 2] / 255; // B
    }
  }
  
  return tensor;
};

// Convert ONNX tensor back to ImageData
const tensorToImageData = (
  tensor: Float32Array, 
  width: number, 
  height: number
): ImageData => {
  const imageData = new ImageData(width, height);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tensorIdx = y * width + x;
      const pixelIdx = (y * width + x) * 4;
      
      // Denormalize from [0, 1] to [0, 255]
      imageData.data[pixelIdx] = Math.round(Math.max(0, Math.min(1, tensor[0 * height * width + tensorIdx])) * 255);
      imageData.data[pixelIdx + 1] = Math.round(Math.max(0, Math.min(1, tensor[1 * height * width + tensorIdx])) * 255);
      imageData.data[pixelIdx + 2] = Math.round(Math.max(0, Math.min(1, tensor[2 * height * width + tensorIdx])) * 255);
      imageData.data[pixelIdx + 3] = 255; // Alpha
    }
  }
  
  return imageData;
};

// Helpers to convert between ImageData and packed RGB uint8 (256x256x3)
const resizeImageDataToRGB = (src: ImageData, size: number): Uint8Array => {
  // Fast path: when source is already the target size, copy RGB directly
  // to avoid any canvas resampling / alpha-premultiplication that would
  // corrupt LSB-embedded bits.
  if (src.width === size && src.height === size) {
    const rgb = new Uint8Array(size * size * 3);
    for (let i = 0, j = 0; i < src.data.length; i += 4, j += 3) {
      rgb[j] = src.data[i];
      rgb[j + 1] = src.data[i + 1];
      rgb[j + 2] = src.data[i + 2];
    }
    return rgb;
  }

  const tmp = document.createElement('canvas');
  tmp.width = src.width;
  tmp.height = src.height;
  tmp.getContext('2d')!.putImageData(src, 0, 0);

  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const octx = out.getContext('2d')!;
  octx.drawImage(tmp, 0, 0, size, size);
  const data = octx.getImageData(0, 0, size, size).data;

  const rgb = new Uint8Array(size * size * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    rgb[j] = data[i];
    rgb[j + 1] = data[i + 1];
    rgb[j + 2] = data[i + 2];
  }
  return rgb;
};

const rgbToImageData = (rgb: Uint8Array, size: number): ImageData => {
  const img = new ImageData(size, size);
  for (let i = 0, j = 0; j < rgb.length; i += 4, j += 3) {
    img.data[i] = rgb[j];
    img.data[i + 1] = rgb[j + 1];
    img.data[i + 2] = rgb[j + 2];
    img.data[i + 3] = 255;
  }
  return img;
};

const rgbToFloat32CHW = (rgb: Uint8Array, size: number): Float32Array => {
  const out = new Float32Array(3 * size * size);
  const plane = size * size;
  for (let i = 0, p = 0; p < plane; i += 3, p++) {
    out[p] = rgb[i] / 255;
    out[plane + p] = rgb[i + 1] / 255;
    out[2 * plane + p] = rgb[i + 2] / 255;
  }
  return out;
};

const float32CHWToRGB = (t: Float32Array, size: number): Uint8Array => {
  const plane = size * size;
  const rgb = new Uint8Array(plane * 3);
  for (let p = 0, i = 0; p < plane; p++, i += 3) {
    rgb[i] = Math.round(Math.max(0, Math.min(1, t[p])) * 255);
    rgb[i + 1] = Math.round(Math.max(0, Math.min(1, t[plane + p])) * 255);
    rgb[i + 2] = Math.round(Math.max(0, Math.min(1, t[2 * plane + p])) * 255);
  }
  return rgb;
};

// Encode: EncryptionNet → shuffle → XOR → LSB-embed(sha256(pw)||msg)
export const encodeWithNeuralNet = async (
  coverImageData: ImageData,
  message: string,
  password?: string
): Promise<{ stegoImageData: ImageData; psnr: number; password: string }> => {
  if (!hidingSession) throw new Error('EncryptionNet model not loaded');
  // Auto-generate a strong password if one isn't supplied
  const finalPassword = password && password.length > 0 ? password : generatePassword(16);

  // 1. Resize cover to 256x256 RGB
  const coverRGB = resizeImageDataToRGB(coverImageData, IMG_SIZE);

  // 2. EncryptionNet
  const coverTensor = rgbToFloat32CHW(coverRGB, IMG_SIZE);
  const inT = new ort.Tensor('float32', coverTensor, [1, 3, IMG_SIZE, IMG_SIZE]);
  const feeds: Record<string, ort.Tensor> = {};
  feeds[hidingSession.inputNames[0]] = inT;
  const out = await hidingSession.run(feeds);
  const encTensor = out[hidingSession.outputNames[0]].data as Float32Array;
  const encRGB = float32CHWToRGB(encTensor, IMG_SIZE);

  // 3. Shuffle pixels  4. XOR with KEY
  const shuffled = shufflePixels(encRGB);
  const xored = xorKey(shuffled);

  // 5. LSB embed: sha256(password) || message  + end marker
  const hash = await sha256Hex(finalPassword);
  const payload = `${hash}||${message}`;
  const cipher = embedTextLSB(xored, payload);

  const stegoImageData = rgbToImageData(cipher, IMG_SIZE);

  // PSNR vs resized cover (both 256x256)
  const coverFull = new Uint8ClampedArray(IMG_SIZE * IMG_SIZE * 4);
  for (let i = 0, j = 0; j < coverRGB.length; i += 4, j += 3) {
    coverFull[i] = coverRGB[j];
    coverFull[i + 1] = coverRGB[j + 1];
    coverFull[i + 2] = coverRGB[j + 2];
    coverFull[i + 3] = 255;
  }
  const psnr = calculatePSNR(coverFull, stegoImageData.data);

  return { stegoImageData, psnr, password: finalPassword };
};

// Decode: LSB-extract → XOR → unshuffle → DecryptionNet; verify password hash
export const decodeWithNeuralNet = async (
  stegoImageData: ImageData,
  password?: string
): Promise<{ message: string; recoveredImageData: ImageData; verified: boolean }> => {
  if (!revealSession) throw new Error('DecryptionNet model not loaded');

  // Force 256x256 RGB working buffer (image should already be 256 from encode)
  const cipherRGB = resizeImageDataToRGB(stegoImageData, IMG_SIZE);

  // Password is mandatory for neural-net decoding.
  if (!password || password.length === 0) {
    throw new Error('Password required: enter the password generated during encoding to decrypt.');
  }

  // 1. Extract LSB payload
  const extracted = extractTextLSB(cipherRGB);
  let actualMessage = '';
  let verified = false;
  if (extracted.includes('||')) {
    const sep = extracted.indexOf('||');
    const storedHash = extracted.slice(0, sep);
    actualMessage = extracted.slice(sep + 2);
    const inputHash = await sha256Hex(password);
    verified = inputHash === storedHash;
    if (!verified) {
      throw new Error('Access denied: incorrect password.');
    }
  } else {
    // LSB header missing → stego image was compressed/re-saved and the
    // embedded hash+payload was destroyed. Without the hash we cannot
    // verify the password, so refuse to decrypt.
    throw new Error(
      'Access denied: this image does not contain a verifiable password payload (it may have been re-compressed). Upload the original lossless PNG produced by encoding.'
    );
  }

  // 3. Recover image: XOR → unshuffle → DecryptionNet
  const dexor = xorKey(cipherRGB);
  const deshuffled = unshufflePixels(dexor);
  const recTensor = rgbToFloat32CHW(deshuffled, IMG_SIZE);
  const inT = new ort.Tensor('float32', recTensor, [1, 3, IMG_SIZE, IMG_SIZE]);
  const feeds: Record<string, ort.Tensor> = {};
  feeds[revealSession.inputNames[0]] = inT;
  const out = await revealSession.run(feeds);
  const recoveredFloat = out[revealSession.outputNames[0]].data as Float32Array;
  const recoveredRGB = float32CHWToRGB(recoveredFloat, IMG_SIZE);
  const recoveredImageData = rgbToImageData(recoveredRGB, IMG_SIZE);

  return { message: actualMessage, recoveredImageData, verified };
};

// Calculate PSNR
const calculatePSNR = (original: Uint8ClampedArray, stego: Uint8ClampedArray): number => {
  let mse = 0;
  for (let i = 0; i < original.length; i++) {
    const diff = original[i] - stego[i];
    mse += diff * diff;
  }
  mse /= original.length;
  if (mse === 0) return Infinity;
  return 10 * Math.log10((255 * 255) / mse);
};
