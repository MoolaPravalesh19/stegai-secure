import * as ort from 'onnxruntime-web';
import { supabase } from '@/integrations/supabase/client';

// Configure ONNX Runtime
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/';

let hidingSession: ort.InferenceSession | null = null;
let revealSession: ort.InferenceSession | null = null;

const IMG_SIZE = 256;
const DEFAULT_HIDING_MODEL = 'hiding_net.onnx';
const DEFAULT_REVEAL_MODEL = 'reveal_net.onnx';

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

// Check if default models exist in storage (lightweight HEAD-style check)
export const checkDefaultModelsExist = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.storage
      .from('onnx-models')
      .list('', { limit: 10 });

    if (error || !data) return false;

    const fileNames = data.map(f => f.name);
    return fileNames.includes(DEFAULT_HIDING_MODEL) && fileNames.includes(DEFAULT_REVEAL_MODEL);
  } catch {
    return false;
  }
};

// Upload models to storage as defaults
export const uploadDefaultModels = async (
  hidingFile: File,
  revealFile: File
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error: hidingError } = await supabase.storage
      .from('onnx-models')
      .upload(DEFAULT_HIDING_MODEL, hidingFile, { 
        upsert: true,
        contentType: 'application/octet-stream'
      });
    
    if (hidingError) throw hidingError;

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

// Load default models from storage (only call after confirming they exist)
export const loadDefaultModels = async (): Promise<{ success: boolean; error?: string }> => {
  if (areModelsLoaded()) {
    return { success: true };
  }

  try {
    const [hidingDownload, revealDownload] = await Promise.all([
      supabase.storage.from('onnx-models').download(DEFAULT_HIDING_MODEL),
      supabase.storage.from('onnx-models').download(DEFAULT_REVEAL_MODEL)
    ]);

    if (hidingDownload.error || revealDownload.error || !hidingDownload.data || !revealDownload.data) {
      return {
        success: false,
        error: 'Default models not found in storage'
      };
    }

    const [hidingBuffer, revealBuffer] = await Promise.all([
      hidingDownload.data.arrayBuffer(),
      revealDownload.data.arrayBuffer()
    ]);

    return await loadModelsFromBuffers(hidingBuffer, revealBuffer);
  } catch (error) {
    console.error('Failed to load default models:', error);
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

// Convert text to binary tensor (matching Python implementation)
export const textToTensor = (text: string, size: number = IMG_SIZE): Float32Array => {
  let bits = '';
  for (const char of text) {
    bits += char.charCodeAt(0).toString(2).padStart(8, '0');
  }
  bits += '00000000'; // End marker
  
  const bitArray = bits.split('').map(b => parseFloat(b));
  const totalSize = size * size;
  
  while (bitArray.length < totalSize) {
    bitArray.push(0);
  }
  
  return new Float32Array(bitArray.slice(0, totalSize));
};

// Convert tensor to text (matching Python implementation)
export const tensorToText = (tensor: Float32Array): string => {
  const bits = Array.from(tensor).map(v => v > 0.5 ? 1 : 0);
  let chars = '';
  
  for (let i = 0; i < bits.length; i += 8) {
    const byte = bits.slice(i, i + 8);
    if (byte.length < 8) break;
    
    const charCode = parseInt(byte.join(''), 2);
    if (charCode === 0) break;
    if (charCode >= 32 && charCode <= 126) {
      chars += String.fromCharCode(charCode);
    }
  }
  
  return chars;
};

// Convert ImageData to ONNX tensor (NCHW format: [1, 3, H, W])
const imageDataToTensor = (imageData: ImageData): Float32Array => {
  const { width, height, data } = imageData;
  const tensor = new Float32Array(3 * height * width);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIdx = (y * width + x) * 4;
      const tensorIdx = y * width + x;
      
      tensor[0 * height * width + tensorIdx] = data[pixelIdx] / 255;
      tensor[1 * height * width + tensorIdx] = data[pixelIdx + 1] / 255;
      tensor[2 * height * width + tensorIdx] = data[pixelIdx + 2] / 255;
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
      
      imageData.data[pixelIdx] = Math.round(Math.max(0, Math.min(1, tensor[0 * height * width + tensorIdx])) * 255);
      imageData.data[pixelIdx + 1] = Math.round(Math.max(0, Math.min(1, tensor[1 * height * width + tensorIdx])) * 255);
      imageData.data[pixelIdx + 2] = Math.round(Math.max(0, Math.min(1, tensor[2 * height * width + tensorIdx])) * 255);
      imageData.data[pixelIdx + 3] = 255;
    }
  }
  
  return imageData;
};

// Encode message into cover image using HidingNet
export const encodeWithNeuralNet = async (
  coverImageData: ImageData,
  message: string
): Promise<{ stegoImageData: ImageData; psnr: number }> => {
  if (!hidingSession) {
    throw new Error('HidingNet model not loaded');
  }
  
  const { width, height } = coverImageData;
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = IMG_SIZE;
  canvas.height = IMG_SIZE;
  
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCanvas.width = width;
  tempCanvas.height = height;
  tempCtx.putImageData(coverImageData, 0, 0);
  ctx.drawImage(tempCanvas, 0, 0, IMG_SIZE, IMG_SIZE);
  
  const resizedImageData = ctx.getImageData(0, 0, IMG_SIZE, IMG_SIZE);
  
  const coverTensor = imageDataToTensor(resizedImageData);
  const messageTensor = textToTensor(message, IMG_SIZE);
  
  const coverOrtTensor = new ort.Tensor('float32', coverTensor, [1, 3, IMG_SIZE, IMG_SIZE]);
  const messageOrtTensor = new ort.Tensor('float32', messageTensor, [1, 1, IMG_SIZE, IMG_SIZE]);
  
  const feeds: Record<string, ort.Tensor> = {};
  const inputNames = hidingSession.inputNames;
  
  if (inputNames.includes('cover') && inputNames.includes('message')) {
    feeds['cover'] = coverOrtTensor;
    feeds['message'] = messageOrtTensor;
  } else if (inputNames.length === 2) {
    feeds[inputNames[0]] = coverOrtTensor;
    feeds[inputNames[1]] = messageOrtTensor;
  } else {
    throw new Error(`Unexpected input names: ${inputNames.join(', ')}`);
  }
  
  const results = await hidingSession.run(feeds);
  const outputName = hidingSession.outputNames[0];
  const stegoTensor = results[outputName].data as Float32Array;
  
  const stegoImageDataSmall = tensorToImageData(stegoTensor, IMG_SIZE, IMG_SIZE);
  
  const outputCanvas = document.createElement('canvas');
  const outputCtx = outputCanvas.getContext('2d')!;
  outputCanvas.width = width;
  outputCanvas.height = height;
  
  const stegoTempCanvas = document.createElement('canvas');
  const stegoTempCtx = stegoTempCanvas.getContext('2d')!;
  stegoTempCanvas.width = IMG_SIZE;
  stegoTempCanvas.height = IMG_SIZE;
  stegoTempCtx.putImageData(stegoImageDataSmall, 0, 0);
  outputCtx.drawImage(stegoTempCanvas, 0, 0, width, height);
  
  const stegoImageData = outputCtx.getImageData(0, 0, width, height);
  
  const psnr = calculatePSNR(coverImageData.data, stegoImageData.data);
  
  return { stegoImageData, psnr };
};

// Decode message from stego image using RevealNet
export const decodeWithNeuralNet = async (
  stegoImageData: ImageData
): Promise<string> => {
  if (!revealSession) {
    throw new Error('RevealNet model not loaded');
  }
  
  const { width, height } = stegoImageData;
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = IMG_SIZE;
  canvas.height = IMG_SIZE;
  
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCanvas.width = width;
  tempCanvas.height = height;
  tempCtx.putImageData(stegoImageData, 0, 0);
  ctx.drawImage(tempCanvas, 0, 0, IMG_SIZE, IMG_SIZE);
  
  const resizedImageData = ctx.getImageData(0, 0, IMG_SIZE, IMG_SIZE);
  
  const stegoTensor = imageDataToTensor(resizedImageData);
  const stegoOrtTensor = new ort.Tensor('float32', stegoTensor, [1, 3, IMG_SIZE, IMG_SIZE]);
  
  const feeds: Record<string, ort.Tensor> = {};
  const inputNames = revealSession.inputNames;
  feeds[inputNames[0]] = stegoOrtTensor;
  
  const results = await revealSession.run(feeds);
  const outputName = revealSession.outputNames[0];
  const revealedTensor = results[outputName].data as Float32Array;
  
  return tensorToText(revealedTensor);
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
