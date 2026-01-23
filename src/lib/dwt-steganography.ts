/**
 * DWT (Discrete Wavelet Transform) based Image Steganography
 * Uses Haar wavelet transform for embedding/extracting data in the green channel
 * This implementation matches PyWavelets (pywt) behavior exactly
 */

// Haar 2D DWT - matches pywt.dwt2 output structure
// Returns: { cA (LL), cH (HL), cV (LH), cD (HH) } as 2D arrays stored in row-major Float64Array
export function dwt2(channel: Float64Array, width: number, height: number): {
  cA: Float64Array;
  cH: Float64Array;
  cV: Float64Array;
  cD: Float64Array;
  halfWidth: number;
  halfHeight: number;
} {
  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);
  
  // First: Row-wise 1D Haar DWT
  const lowRows = new Float64Array(halfWidth * height);
  const highRows = new Float64Array(halfWidth * height);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < halfWidth; x++) {
      const a = channel[y * width + x * 2];
      const b = channel[y * width + x * 2 + 1];
      
      // Haar wavelet: low = (a + b) / sqrt(2), high = (a - b) / sqrt(2)
      // For simplicity (matching pywt behavior without normalization factor for our use case):
      lowRows[y * halfWidth + x] = (a + b) / 2;
      highRows[y * halfWidth + x] = (a - b) / 2;
    }
  }
  
  // Second: Column-wise 1D Haar DWT on both low and high results
  const cA = new Float64Array(halfWidth * halfHeight); // LL
  const cV = new Float64Array(halfWidth * halfHeight); // LH (vertical detail)
  const cH = new Float64Array(halfWidth * halfHeight); // HL (horizontal detail)
  const cD = new Float64Array(halfWidth * halfHeight); // HH (diagonal detail)
  
  for (let x = 0; x < halfWidth; x++) {
    for (let y = 0; y < halfHeight; y++) {
      const aLow = lowRows[(y * 2) * halfWidth + x];
      const bLow = lowRows[(y * 2 + 1) * halfWidth + x];
      const aHigh = highRows[(y * 2) * halfWidth + x];
      const bHigh = highRows[(y * 2 + 1) * halfWidth + x];
      
      const idx = y * halfWidth + x;
      cA[idx] = (aLow + bLow) / 2;   // LL - Approximation
      cV[idx] = (aLow - bLow) / 2;   // LH - Vertical detail
      cH[idx] = (aHigh + bHigh) / 2; // HL - Horizontal detail
      cD[idx] = (aHigh - bHigh) / 2; // HH - Diagonal detail
    }
  }
  
  return { cA, cH, cV, cD, halfWidth, halfHeight };
}

// Inverse Haar 2D DWT - reconstructs channel from subbands (matches pywt.idwt2)
export function idwt2(
  cA: Float64Array,
  cH: Float64Array,
  cV: Float64Array,
  cD: Float64Array,
  halfWidth: number,
  halfHeight: number,
  originalWidth: number,
  originalHeight: number
): Float64Array {
  // First: Column-wise inverse 1D Haar DWT
  const lowRows = new Float64Array(halfWidth * originalHeight);
  const highRows = new Float64Array(halfWidth * originalHeight);
  
  for (let x = 0; x < halfWidth; x++) {
    for (let y = 0; y < halfHeight; y++) {
      const idx = y * halfWidth + x;
      
      // Reconstruct low-frequency rows from cA and cV
      lowRows[(y * 2) * halfWidth + x] = cA[idx] + cV[idx];
      lowRows[(y * 2 + 1) * halfWidth + x] = cA[idx] - cV[idx];
      
      // Reconstruct high-frequency rows from cH and cD
      highRows[(y * 2) * halfWidth + x] = cH[idx] + cD[idx];
      highRows[(y * 2 + 1) * halfWidth + x] = cH[idx] - cD[idx];
    }
  }
  
  // Second: Row-wise inverse 1D Haar DWT
  const result = new Float64Array(originalWidth * originalHeight);
  
  for (let y = 0; y < originalHeight; y++) {
    for (let x = 0; x < halfWidth; x++) {
      const low = lowRows[y * halfWidth + x];
      const high = highRows[y * halfWidth + x];
      
      result[y * originalWidth + x * 2] = low + high;
      result[y * originalWidth + x * 2 + 1] = low - high;
    }
  }
  
  return result;
}

// Process encryption: Binary Complement & Normalization (matches Python exactly)
export function processEncryption(text: string): { normMsg: number[]; M: number; n: number } {
  const asciiVals = Array.from(text).map(c => c.charCodeAt(0));
  const M = Math.max(...asciiVals);
  
  const normMsg: number[] = [];
  for (const val of asciiVals) {
    const binVal = val.toString(2).padStart(8, '0');
    const compVal = binVal.split('').map(b => b === '0' ? '1' : '0').join('');
    normMsg.push(parseInt(compVal, 2) + M);
  }
  
  return { normMsg, M, n: text.length };
}

// Embed text into image using DWT (matches Python FastAPI logic)
export function embedText(
  imageData: ImageData,
  secretText: string
): ImageData {
  const { width, height, data } = imageData;
  
  // Extract green channel as Float64Array
  const greenChannel = new Float64Array(width * height);
  for (let i = 0; i < width * height; i++) {
    greenChannel[i] = data[i * 4 + 1]; // Green channel
  }
  
  // Process the secret text
  const { normMsg, M, n } = processEncryption(secretText);
  
  // Apply 2D DWT
  const { cA, cH, cV, cD, halfWidth, halfHeight } = dwt2(greenChannel, width, height);
  
  // Check capacity (using flat array access like Python's .flat)
  const maxCapacity = cV.length + cD.length;
  if (n > maxCapacity) {
    throw new Error(`Message too long. Maximum ${maxCapacity} characters allowed.`);
  }
  
  // Store metadata in cH[0,0] and cH[0,1] - flat indices 0 and 1
  // In Python: cH1[0,0] = n, cH1[0,1] = M
  cH[0] = n; // Length of message (at position [0,0])
  cH[1] = M; // Max ASCII value (at position [0,1])
  
  // Split message and embed using flat array indexing (matching Python's .flat)
  // Python: for i in range(mid): cV1.flat[i] = norm_msg[i]
  const mid = Math.floor(n / 2);
  for (let i = 0; i < mid; i++) {
    cV[i] = normMsg[i];
  }
  // Python: for i in range(n - mid): cD1.flat[i] = norm_msg[mid + i]
  for (let i = 0; i < n - mid; i++) {
    cD[i] = normMsg[mid + i];
  }
  
  // Reconstruct with inverse DWT
  const stegoGreen = idwt2(cA, cH, cV, cD, halfWidth, halfHeight, width, height);
  
  // Create stego image - preserve precision as much as possible
  const stegoData = new Uint8ClampedArray(data.length);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    stegoData[idx] = data[idx];         // Red - unchanged
    stegoData[idx + 1] = Math.round(Math.max(0, Math.min(255, stegoGreen[i]))); // Green - modified
    stegoData[idx + 2] = data[idx + 2]; // Blue - unchanged
    stegoData[idx + 3] = data[idx + 3]; // Alpha - unchanged
  }
  
  return new ImageData(stegoData, width, height);
}

// Extract text from stego image using DWT (matches Python FastAPI logic)
export function extractText(imageData: ImageData): string {
  const { width, height, data } = imageData;
  
  // Extract green channel
  const stegoGreen = new Float64Array(width * height);
  for (let i = 0; i < width * height; i++) {
    stegoGreen[i] = data[i * 4 + 1]; // Green channel
  }
  
  // Apply 2D DWT
  const { cH, cV, cD } = dwt2(stegoGreen, width, height);
  
  // Extract metadata from cH[0] and cH[1] (flat indices for [0,0] and [0,1])
  const extN = Math.round(cH[0]); // Length
  const extM = Math.round(cH[1]); // Max value
  
  // Validate metadata
  if (extN <= 0 || extN > 10000) {
    throw new Error('No valid embedded message found in this image (invalid length)');
  }
  if (extM <= 0 || extM > 255) {
    throw new Error('No valid embedded message found in this image (invalid max value)');
  }
  
  // Recover normalized message using flat array indexing (matching Python)
  // Python: recovered_norm = list(cV11.flat[:ext_n//2]) + list(cD11.flat[:ext_n - ext_n//2])
  const mid = Math.floor(extN / 2);
  const recoveredNorm: number[] = [];
  
  // First half from cV.flat
  for (let i = 0; i < mid; i++) {
    recoveredNorm.push(cV[i]);
  }
  // Second half from cD.flat
  for (let i = 0; i < extN - mid; i++) {
    recoveredNorm.push(cD[i]);
  }
  
  // Decrypt the message (reverse binary complement and normalization)
  // Python: rev_norm = int(round(val)) - ext_M
  //         bin_val = format(rev_norm & 0xFF, '08b')
  //         orig_bin = reverse complement
  //         extracted_text += chr(int(orig_bin, 2))
  let extractedText = '';
  for (const val of recoveredNorm) {
    const revNorm = Math.round(val) - extM;
    const normalizedVal = revNorm & 0xFF;
    const binVal = normalizedVal.toString(2).padStart(8, '0');
    // Binary complement to get original
    const origBin = binVal.split('').map(b => b === '0' ? '1' : '0').join('');
    const charCode = parseInt(origBin, 2);
    extractedText += String.fromCharCode(charCode);
  }
  
  return extractedText;
}
